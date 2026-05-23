# Corrección de Costos en Base de Datos — Distrilow

> Registro de la corrección de `unitCost = 0` en `sale_items` y recálculo de `totalCost` / `profit` en `sales`.
> Estado actual: transacción abierta pendiente de COMMIT o ROLLBACK.

---

## 1. Problema identificado

Cuando se carga stock mediante **ajuste de inventario sin especificar precio de costo**, el WAC (Weighted Average Cost) queda en 0. Al vender ese producto, el sistema graba:

- `sale_items.unitCost = 0`
- `sales.totalCost = 0` (o subestimado)
- `sales.profit = totalAmount` (ganancia inflada al 100%)

Esto genera **márgenes fantasma del 100%** en reportes por producto.

### Alcance detectado

| Métrica | Valor |
|---|---|
| Items con `unitCost = 0` | **793** |
| Ventas afectadas | pendiente confirmar |
| Revenue en juego | pendiente confirmar |

Query de diagnóstico:
```sql
SELECT 
  COUNT(DISTINCT si."saleId") AS ventas_afectadas,
  COUNT(si.id)                AS items_afectados,
  ROUND(SUM(si.subtotal))     AS revenue_en_juego
FROM sale_items si
JOIN products p ON p.id = si."productId"
WHERE si."unitCost" = 0
  AND p."costPrice" > 0;
```

---

## 2. Fix aplicado (transacción abierta)

La corrección actualiza tres cosas en orden:

1. `sale_items.unitCost` → pasa de `0` a `product.costPrice`
2. `sales.totalCost` → recalculado como `SUM(unitCost × quantity)` de todos los ítems de esa venta
3. `sales.profit` → recalculado como `totalAmount - totalCost`

```sql
BEGIN;

CREATE TEMP TABLE ventas_afectadas AS
SELECT DISTINCT si."saleId"
FROM sale_items si
JOIN products p ON p.id = si."productId"
WHERE si."unitCost" = 0
  AND p."costPrice" > 0;

UPDATE sale_items si
SET "unitCost" = p."costPrice"
FROM products p
WHERE si."productId" = p.id
  AND si."unitCost" = 0
  AND p."costPrice" > 0;

UPDATE sales s
SET 
  "totalCost" = nc.new_total_cost,
  "profit"    = s."totalAmount" - nc.new_total_cost
FROM (
  SELECT 
    si."saleId",
    COALESCE(SUM(si."unitCost" * si.quantity), 0) AS new_total_cost
  FROM sale_items si
  WHERE si."saleId" IN (SELECT "saleId" FROM ventas_afectadas)
  GROUP BY si."saleId"
) nc
WHERE s.id = nc."saleId"
  AND s.status = 'COMPLETED';

-- Verificación
SELECT 
  (SELECT COUNT(*) FROM sale_items WHERE "unitCost" = 0)        AS items_costo_cero_restantes,
  (SELECT COUNT(*) FROM sales s
   WHERE s.id IN (SELECT "saleId" FROM ventas_afectadas)
     AND s.profit < 0)                                           AS ventas_profit_negativo,
  (SELECT ROUND(AVG(s.profit / NULLIF(s."totalAmount",0) * 100)::numeric, 2)
   FROM sales s
   WHERE s.id IN (SELECT "saleId" FROM ventas_afectadas)
     AND s.status = 'COMPLETED')                                 AS margen_promedio_pct;

ROLLBACK; -- cambiar a COMMIT cuando se valide
```

---

## 3. Resultado de la verificación

| Campo | Resultado | Evaluación |
|---|---|---|
| `items_costo_cero_restantes` | **0** | ✅ Todos corregidos |
| `ventas_profit_negativo` | **15** | ⚠️ Revisar antes de COMMIT |
| `margen_promedio_pct` | **23.59%** | ✅ Valor razonable |

---

## 4. Pendiente: investigar 15 ventas con profit negativo

Antes de confirmar, revisar si son redondeo o un error real:

```sql
SELECT 
  s.id,
  s."totalAmount",
  s."totalCost",
  s.profit,
  ROUND((s.profit / NULLIF(s."totalAmount", 0) * 100)::numeric, 2) AS margen_pct,
  s."createdAt"::date AS fecha
FROM sales s
WHERE s.id IN (SELECT "saleId" FROM ventas_afectadas)
  AND s.profit < 0
  AND s.status = 'COMPLETED'
ORDER BY s.profit ASC;
```

**Interpretación del resultado:**

- Profit negativo de pocos pesos → probablemente redondeo o descuento puntual → OK para COMMIT
- Profit negativo grande → el `costPrice` del producto está más alto que el precio de venta → revisar ese producto antes de confirmar

Para ver qué productos componen esas ventas negativas:

```sql
SELECT 
  s.id                                    AS sale_id,
  s."totalAmount",
  s.profit,
  p.name                                  AS producto,
  si."unitCost",
  si.quantity,
  si.subtotal,
  ROUND((si."unitCost" * si.quantity)::numeric, 2) AS costo_item
FROM sales s
JOIN sale_items si ON si."saleId" = s.id
JOIN products p    ON p.id = si."productId"
WHERE s.id IN (SELECT "saleId" FROM ventas_afectadas)
  AND s.profit < 0
  AND s.status = 'COMPLETED'
ORDER BY s.profit ASC, s.id;
```

---

## 5. Cómo confirmar o revertir

```sql
-- Si todo está bien:
COMMIT;

-- Si algo no cierra:
ROLLBACK;
```

`ROLLBACK` revierte todo: `sale_items`, `sales`, y la tabla temporal. La base queda exactamente como antes del `BEGIN`.

---

## 6. Causa raíz solucionada en el backend

Para que esto no vuelva a pasar, se aplicaron dos cambios en el backend:

### `inventory-command.service.ts`
- El campo `costPriceFallback` se agregó al tipo `InventoryMutationInput`
- El costo resuelto ahora usa: `unitCost ?? (WAC > 0 ? WAC : costPriceFallback ?? 0)`
- Los ajustes de tipo `ADJUSTMENT` ahora actualizan el WAC igual que una compra

### `stock-movement.service.ts`
- Al llamar `applyMovement`, ahora se pasa `costPriceFallback: Number(product.costPrice ?? 0)`

Con estos cambios, cualquier ajuste de stock futuro usa el `costPrice` del producto como fallback si el WAC es 0, evitando que se graben costos en cero.

---

## 7. Cadena completa de datos (para referencia)

```
sale_items.unitCost  (snapshot al momento de la venta)
    ↓
buildSaleItemCostExpr() = item."unitCost" * item."quantity"
    ↓
marginPct = SUM(subtotal - costo) / NULLIF(SUM(subtotal), 0) * 100
    ↓
reporting-read.service.ts → marginTotalPct / marginPct
    ↓
Frontend → "Margen s/ ventas XX%"
```

Cache TTL: **30 segundos** (`HOT_CACHE_REPORTING_TTL_MS`, default 30000ms).
Después del COMMIT, el reporte se actualiza solo en 30 segundos.

---

## 8. Queries de validación cruzada post-COMMIT

Una vez confirmado, ejecutar para verificar consistencia general:

```sql
-- Margen total histórico (debe estar entre 20% y 35% aprox)
SELECT
  COUNT(*)                                                                AS ventas,
  ROUND(SUM("totalAmount"))                                              AS revenue,
  ROUND(SUM("totalCost"))                                                AS costo,
  ROUND(SUM(profit))                                                     AS ganancia,
  ROUND(SUM(profit) / NULLIF(SUM("totalAmount"), 0) * 100, 2)           AS margen_pct
FROM sales
WHERE status = 'COMPLETED';

-- Productos que aún tienen algún item con unitCost = 0
SELECT p.name, COUNT(*) AS items_sin_costo
FROM sale_items si
JOIN products p ON p.id = si."productId"
WHERE si."unitCost" = 0
GROUP BY p.name
ORDER BY items_sin_costo DESC;
```

---

*Documento generado el 2026-05-22. Transacción pendiente de COMMIT/ROLLBACK.*
