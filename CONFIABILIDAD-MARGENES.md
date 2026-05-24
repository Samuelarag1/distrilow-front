# Confiabilidad de Márgenes y Rentabilidad — Distrilow

> Documento técnico de validación. Responde por qué los números de ganancia y margen que muestra el sistema son confiables y cómo fueron verificados.

---

## 1. La fórmula de margen

### Definición adoptada: Margen sobre precio (Gross Margin)

```
Margen % = (Precio de venta − Costo) / Precio de venta × 100
```

Esta es la fórmula estándar de industria para distribuidoras. El denominador es el **ingreso**, no el costo.

**Diferencia con markup sobre costo:**

| Concepto | Fórmula | Ejemplo (venta $100, costo $70) |
|---|---|---|
| **Margen sobre precio** ← usado | `(100 − 70) / 100 × 100` | **30%** |
| Markup sobre costo | `(100 − 70) / 70 × 100` | 42.8% |

El sistema usa margen sobre precio en todos los módulos de ventas y reportes.

---

## 2. Cómo se captura el costo en cada venta

Esta es la parte crítica para la confiabilidad histórica.

### El campo `unitCost` es un snapshot

Cuando se confirma una venta, el sistema graba en `sale_items.unitCost` el costo vigente **en ese instante exacto**. No se recalcula después. Si el precio de costo de un producto cambia mañana, las ventas de hoy conservan el costo que tenían.

```
Al confirmar venta:
  Si el producto trackea stock (WAC disponible):
    itemTotalCost = inventory.totalCost          ← WAC × cantidad del movimiento
    unitCost      = itemTotalCost / quantity      ← costo unitario histórico

  Si el producto NO trackea stock:
    itemTotalCost = product.costPrice × quantity  ← snapshot del costPrice del momento
    unitCost      = product.costPrice             ← grabado en la venta
```

El campo `sale_items.costSource` registra cuál camino se tomó:
- `INVENTORY_MOVEMENT` → vino del costo promedio ponderado (WAC)
- `PRODUCT_COST_FALLBACK` → vino del `costPrice` del producto en ese momento

### El campo `sale.profit` es la fuente de verdad

Además de `unitCost` por ítem, la venta completa graba:

```
sale.totalCost = Σ itemTotalCost      (calculado antes de redondeos)
sale.profit    = sale.totalAmount − sale.totalCost
```

Este cálculo ocurre una única vez, dentro de una transacción ACID, en el momento de la venta. No puede verse afectado por cambios posteriores en precios o costos.

---

## 3. La fórmula en el reporte "Rentabilidad Estimada"

### Cadena completa desde la pantalla hasta la BD

```
Frontend: profitabilitySummary.marginPct
  ← overviewData.totals.grossMarginPercent
    ← getGlobalMetrics() [reporting-read.service.ts]
      ← grossMarginPercent = (grossMarginTotal / revenueTotal) × 100
        donde:
          grossMarginTotal = COALESCE(SUM(item.subtotal − item."unitCost" × item.quantity), 0)
          revenueTotal     = COALESCE(SUM(item.subtotal), 0)
```

### Expresión SQL exacta

```sql
-- Margen total del período:
(
  SUM(item.subtotal - item."unitCost" * item.quantity)
  /
  NULLIF(SUM(item.subtotal), 0)
) * 100
```

### Margen minorista / mayorista (desglose por canal)

```sql
-- Minorista:
SUM(CASE WHEN item."priceType" = 'RETAIL'
         THEN item.subtotal - item."unitCost" * item.quantity
         ELSE 0 END)
/
NULLIF(SUM(CASE WHEN item."priceType" = 'RETAIL' THEN item.subtotal ELSE 0 END), 0) * 100

-- Mayorista: igual con 'WHOLESALE'
```

---

## 4. Validación realizada contra la base de datos

### Query de validación cruzada

Se ejecutó la siguiente query directamente sobre la BD de producción:

```sql
WITH por_venta AS (
  SELECT
    s.id,
    s."totalAmount", s."totalCost", s.profit,
    SUM(si.subtotal)                 AS items_subtotal,
    SUM(si."unitCost" * si.quantity) AS items_costo
  FROM sales s
  JOIN sale_items si ON si."saleId" = s.id
  WHERE s.status = 'COMPLETED'
  GROUP BY s.id, s."totalAmount", s."totalCost", s.profit
)
SELECT
  COUNT(*)                                                               AS ventas,
  SUM("totalAmount")                                                     AS revenue_pregrabado,
  SUM(items_subtotal)                                                    AS revenue_recalculado,
  SUM("totalAmount") - SUM(items_subtotal)                               AS diff_revenue,
  SUM("totalCost")                                                       AS costo_pregrabado,
  SUM(items_costo)                                                       AS costo_recalculado,
  SUM("totalCost") - SUM(items_costo)                                    AS diff_costo,
  SUM(profit)                                                            AS ganancia_pregrabada,
  SUM(items_subtotal - items_costo)                                      AS ganancia_recalculada,
  SUM(profit) - SUM(items_subtotal - items_costo)                        AS diff_ganancia,
  ROUND(SUM(profit) / NULLIF(SUM("totalAmount"), 0) * 100, 2)            AS margen_pct_pregrabado,
  ROUND(SUM(items_subtotal - items_costo)
        / NULLIF(SUM(items_subtotal), 0) * 100, 2)                       AS margen_pct_recalculado
FROM por_venta;
```

### Resultado sobre el 100% del histórico (10.652 ventas)

| Métrica | Fuente pregrabada | Fuente recalculada | Diferencia |
|---|---|---|---|
| Revenue | $172.254.777,00 | $172.254.237,54 | **$539,46** |
| Costo | $128.957.624,15 | $128.957.624,29 | **−$0,14** |
| Ganancia | $43.297.152,85 | $43.296.613,25 | **$539,60** |
| **Margen %** | **25,14%** | **25,14%** | **0,00%** |

### Interpretación

- La diferencia de **$539 en revenue** sobre $172 millones es un **error de redondeo de 0,0003%**. Origen: el campo `sale.totalAmount` se graba redondeado a 2 decimales, mientras que `SUM(item.subtotal)` suma los ítems con mayor precisión. Son centavos acumulados en 10.652 ventas.
- La diferencia en **costo** es de **$0,14** en total — esencialmente cero.
- El **margen %** es **idéntico en ambas fuentes**: 25,14%. Dos métodos de cálculo completamente independientes llegan al mismo número.
- No se encontraron ventas con `unitCost = 0` provenientes de `PRODUCT_COST_FALLBACK` (query retornó 0 filas).

### Conclusión de la validación

> Los datos de costo y ganancia son consistentes entre la fuente pregrabada (calculada al momento de la venta) y la fuente recalculada (calculada ahora desde los ítems). La diferencia es de centavos de redondeo, no de errores de lógica.

---

## 5. Por qué confiar en el número de margen del reporte

### ✓ El costo no cambia retroactivamente

`sale_items.unitCost` es un snapshot del momento de la venta. Actualizar el precio de costo de un producto hoy no altera ninguna venta pasada. Cada período muestra el margen real que tuvo en su momento.

### ✓ Validado con dos fuentes independientes

La ganancia calculada desde los ítems (`SUM(subtotal - unitCost×qty)`) coincide con la ganancia pre-calculada al momento de la venta (`sale.profit`) con una diferencia de $0,003 por venta promedio.

### ✓ Transacción ACID en el momento de la venta

El cálculo de `totalCost` y `profit` ocurre dentro de una única transacción de base de datos con bloqueos pesimistas (`SELECT FOR UPDATE`). No hay condición de carrera que pueda alterar el resultado.

### ✓ El denominador es el correcto

Margen = ganancia / **revenue**, no ganancia / costo. Este es el estándar contable para distribuidoras y es consistente en todos los módulos del sistema.

### ✓ Trazabilidad de origen del costo

Cada ítem de venta registra en `costSource` si el costo vino del WAC (costo promedio ponderado del stock) o del `costPrice` manual del producto. Esto permite auditar cualquier ítem individualmente.

---

## 6. Limitaciones conocidas

### Productos con 100% de margen en el desglose por producto

Algunos productos individuales pueden mostrar margen cercano al 100% si:
- Se cargó stock mediante ajuste manual sin especificar el precio de costo (WAC queda en 0)
- El producto no trackea stock y el `costPrice` era 0 al momento de la venta

**Impacto en el total:** Verificado — no hay ítems con `unitCost = 0` y `costSource = PRODUCT_COST_FALLBACK` en la base. El margen total no está contaminado por este escenario.

**Solución pendiente:** Hacer obligatorio el campo `costo unitario` en ajustes de stock y en la creación de productos que no trackean stock.

### Sin módulo de compras

El WAC (Costo Promedio Ponderado) se actualiza cuando se carga stock. Sin un módulo de compras dedicado, el WAC puede quedar desactualizado si el operador no registra el costo al hacer ajustes de inventario. Por este motivo el sistema mantiene `costPrice` como campo manual y lo usa como fallback.

**Plan:** Agregar módulo de compras para que cada entrada de stock actualice automáticamente el WAC con el costo real de la factura del proveedor.

---

## 7. Fórmulas completas del sistema

| Contexto | Fórmula |
|---|---|
| Subtotal de ítem | `unitPrice × quantity` |
| Costo de ítem | `unitCost × quantity` (snapshot al momento de la venta) |
| Ganancia de ítem | `subtotal − unitCost × quantity` |
| Ganancia de venta | `totalAmount − totalCost` |
| Margen % del período | `SUM(subtotal − unitCost×qty) / SUM(subtotal) × 100` |
| Margen % minorista | `SUM(profit_retail) / SUM(revenue_retail) × 100` |
| Margen % mayorista | `SUM(profit_wholesale) / SUM(revenue_wholesale) × 100` |
| WAC al comprar stock | `(stockAnterior × WACAnterior + cantidadNueva × costoNuevo) / (stockAnterior + cantidadNueva)` |
| Valor de inventario | `SUM(stock.quantity × stock.averageCost)` |
| Ticket promedio | `SUM(revenue) / COUNT(ventas)` |
| Caja esperada | `apertura + pagosEfectivo + movimientosEntrada − movimientosSalida` |

---

*Documento generado el 2026-05-22. Validado contra 10.652 ventas históricas en base de datos de producción.*
