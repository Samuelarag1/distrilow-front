# DistriLow Frontend

Interfaz web del sistema de punto de venta (POS) e inventario multi-sucursal, construida con Next.js 15 App Router, React 19 y TypeScript.

---

## Tabla de contenidos

- [Requisitos](#requisitos)
- [Inicio rapido](#inicio-rapido)
- [Variables de entorno](#variables-de-entorno)
- [Arquitectura](#arquitectura)
- [Rutas](#rutas)
- [Autenticacion](#autenticacion)
- [Estado y sincronizacion](#estado-y-sincronizacion)
- [Modo offline](#modo-offline)
- [Componentes](#componentes)
- [Despliegue en produccion](#despliegue-en-produccion)

---

## Requisitos

| Herramienta | Version minima |
|---|---|
| Node.js | 20.x |
| npm | 10.x |
| Backend DistriLow | corriendo en puerto 3000 |

---

## Inicio rapido

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd distrilow-frontend
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con los valores correctos
```

### 3. Iniciar en modo desarrollo

```bash
npm run dev
```

La aplicacion queda disponible en `http://localhost:3001`.

---

## Variables de entorno

Crear un archivo `.env.local` en la raiz del proyecto.

| Variable | Default | Descripcion |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3000` | URL base del servidor backend (sin `/api`) |
| `NEXT_PUBLIC_API_PREFIX` | `/api` | Prefijo de la API REST |
| `NEXT_PUBLIC_API_BASE_URL` | — | Alternativa a `NEXT_PUBLIC_BACKEND_URL` (legacy) |
| `NEXT_PUBLIC_API_URL` | — | URL completa incluyendo prefijo (legacy) |
| `BACKEND_URL` | — | URL del backend para server components (SSR) |

La URL final de cada request se construye como: `NEXT_PUBLIC_BACKEND_URL + NEXT_PUBLIC_API_PREFIX + /ruta`.

---

## Arquitectura

```
distrilow-frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Layout raiz con providers
│   ├── page.tsx                 # Dashboard principal
│   ├── providers/               # SWRConfig global
│   ├── login/                   # Pagina de autenticacion
│   ├── onboarding/branch/       # Setup inicial de sucursal
│   ├── pos/                     # Modulo POS
│   ├── cash/                    # Gestion de caja
│   ├── sales/                   # Historial de ventas
│   ├── products/                # Catalogo de productos
│   ├── inventory/               # Control de stock
│   ├── expenses/                # Gastos
│   ├── branches/                # Sucursales
│   ├── users/                   # Usuarios (admin)
│   ├── profile/                 # Perfil del usuario
│   ├── reports/                 # Reportes y analitica
│   └── offline/                 # Pagina de fallback sin red
│
├── components/
│   ├── ui/                      # 48 primitivos Radix UI (shadcn)
│   ├── modules/                 # Modulos de negocio por pagina
│   ├── sales/                   # Componentes de ventas
│   ├── products/                # Componentes de productos
│   ├── reports/                 # Graficos y exportacion
│   ├── dashboard/               # Tarjetas del dashboard
│   ├── dialogs/                 # Modales de confirmacion y formularios
│   ├── branchSelector/          # Selector de sucursal activa
│   ├── layout/                  # Navbar, sidebar, headers
│   └── pwa/                     # Registro del service worker
│
├── lib/
│   ├── api-client.ts            # Cliente HTTP con auto-refresh de JWT
│   ├── server-api.ts            # Cliente HTTP para server components
│   ├── backend-api.ts           # 100+ metodos tipados de la API
│   ├── api-types.ts             # Tipos de request/response de la API
│   ├── adapters/                # Normalizacion de respuestas a ViewModels
│   │   └── sales.ts            # SaleSummary -> SaleViewModel
│   ├── db.ts                    # Schema de Dexie (IndexedDB)
│   ├── sync-manager.ts          # Sincronizacion de acciones offline
│   ├── permissions.ts           # RBAC del lado del cliente
│   ├── *-live-sync.ts           # Sincronizacion entre pestanas (BroadcastChannel)
│   └── utils.ts                 # Helpers generales
│
├── hooks/                       # React hooks de negocio
├── types/                       # Tipos de TypeScript compartidos
├── middleware.ts                # Proteccion de rutas y redireccion
└── next.config.mjs              # Config de Next.js con headers CSP
```

### Flujo de una request autenticada

```
Componente React
    |
    v
backend-api.ts        <- Metodo tipado (ej: BackendApi.getSales())
    |
    v
api-client.ts         <- Adjunta Authorization header + x-branch-id
    |
    v
fetch()               <- Con credentials: "include" (cookies)
    |
    v
[Si 401]              <- Auto-refresh del access token (una vez)
    |
    v
Backend DistriLow     <- http://localhost:3000/api/...
```

### Patron de adaptadores

Las respuestas de la API se normalizan antes de llegar a los componentes:

```
SaleSummary (API)  ->  normalizeSale()  ->  SaleViewModel (UI)
SalePayment (API)  ->  normalizeSalePayment()  ->  SalePaymentViewModel (UI)
```

Esto desacopla la forma del backend de la forma que consumen los componentes, permitiendo que el
backend cambie sin romper la UI.

---

## Rutas

| Ruta | Acceso | Descripcion |
|---|---|---|
| `/` | Todos | Dashboard con metricas de la sucursal activa |
| `/login` | Publico | Inicio de sesion |
| `/onboarding/branch` | Restringidos | Asignacion de sucursal inicial |
| `/pos` | Todos | Punto de venta (venta, escaneo, pagos) |
| `/cash` | Cajero+ | Sesiones de caja y libro diario |
| `/sales` | Cajero+ | Historial de ventas con filtros |
| `/products` | Staff+ | Catalogo de productos |
| `/inventory` | Staff+ | Stock y lotes |
| `/expenses` | Cajero+ | Registro de gastos |
| `/reports` | Manager+ | Reportes y analitica |
| `/branches` | Admin/Manager | Gestion de sucursales |
| `/users` | Admin | Gestion de usuarios |
| `/profile` | Todos | Configuracion del perfil |

### Logica de redireccion (`middleware.ts`)

- Sin sesion → `/login`
- Vendedores o usuarios de una sola sucursal sin rol de gestion → `/pos`
- Ya autenticado en `/login` → `/` o `/pos` segun rol

---

## Autenticacion

El sistema usa **JWT con cookies HTTP-only** gestionadas por el backend.

### Flujo completo

```
1. POST /auth/login
       |
       v
   Backend setea cookies: accessToken + refreshToken
       |
       v
   middleware.ts lee las cookies en cada request SSR
       |
       v
   api-client.ts adjunta el token en el header Authorization
       |
       v
   Si 401 -> POST /auth/refresh -> retry original request
       |
       v
   Si refresh falla -> clearSessionCookies() + redirect /login
```

### Cookies manejadas

| Cookie | Descripcion |
|---|---|
| `accessToken` | JWT de corta duracion (15 min por defecto) |
| `refreshToken` | JWT de larga duracion (30 dias por defecto) |
| `user` | JSON con rol del usuario (`{ role: string }`) |
| `branches` | JSON array de sucursales asignadas |
| `activeBranchId` | UUID de la sucursal activa actual |

### Roles del cliente

| Rol | Acceso |
|---|---|
| `admin` | Total: usuarios, productos, precios, reportes, cancelaciones |
| `manager` | Reportes, sucursales, productos, ventas |
| `cashier` | Ventas, caja, gastos |
| `seller` | Solo POS y caja |
| `staff` | Solo lectura |

---

## Estado y sincronizacion

### Datos del servidor (SWR)

SWR se usa para todos los datos que vienen del backend. Configuracion global:

```typescript
// revalidateOnFocus: false  — no refetch al volver a la ventana
// shouldRetryOnError: false — manejo manual de errores
```

### Sincronizacion entre pestanas (BroadcastChannel)

Cuando una pestana modifica datos, notifica a las demas para que invaliden su cache SWR:

| Canal | Dispara cuando |
|---|---|
| `products-sync` | Se crea, edita o elimina un producto |
| `sales-sync` | Se registra o cancela una venta |
| `cash-sync` | Se abre, cierra o mueve caja |
| `expenses-sync` | Se agrega o elimina un gasto |

---

## Modo offline

El POS puede operar sin conexion a internet usando **Dexie** (IndexedDB).

### Tablas en IndexedDB

| Tabla | Descripcion |
|---|---|
| `products` | Catalogo de productos cacheado localmente |
| `clients` | Clientes cacheados |
| `sales` | Ventas creadas offline (estado `PENDING`) |
| `pendingActions` | Cola de operaciones pendientes de sincronizacion |

### Ciclo offline

```
1. useNetworkStatus() detecta que no hay red
       |
       v
2. POS encola la venta en pendingActions (IndexedDB)
       |
       v
3. Al recuperar conexion, syncPendingActions() procesa la cola
       |
       v
4. Cada accion se envia al backend en orden
       |
       v
5. Las acciones exitosas se eliminan; las fallidas quedan con failedCount++
```

---

## Componentes

### Modulos de negocio (`components/modules/`)

| Archivo | Descripcion |
|---|---|
| `pos-module.tsx` | Pantalla principal del POS: escaneo, carrito, pagos |
| `sales-module.tsx` | Historial de ventas con filtros y detalle |
| `cash-module.tsx` | Apertura/cierre de caja, movimientos, libro diario |
| `expenses-module.tsx` | Alta y listado de gastos por categoria |
| `inventory-module.tsx` | Stock por sucursal con alertas de minimo |
| `inventory-lots-section.tsx` | Seguimiento de lotes con vencimiento |
| `reports-module.tsx` | Dashboard de analitica con graficos Recharts |
| `branches-module.tsx` | ABM de sucursales |
| `users-module.tsx` | ABM de usuarios con asignacion de roles |
| `profile-module.tsx` | Cambio de contrasena y datos del perfil |

### Libreria de UI (`components/ui/`)

48 primitivos accesibles basados en Radix UI (botones, dialogos, tablas, selects, toasts, etc.).
Se siguen las convenciones de **shadcn/ui** — los componentes son propios del proyecto y se pueden modificar libremente.

---

## Despliegue en produccion

### Checklist

- [ ] `NEXT_PUBLIC_BACKEND_URL` apuntando al backend de produccion (HTTPS)
- [ ] Backend con `CORS_ORIGIN` configurado con el dominio del frontend
- [ ] Backend con `COOKIE_SECURE=true` y `COOKIE_SAME_SITE=strict`
- [ ] Verificar que el CSP en `next.config.mjs` incluye el dominio del backend
- [ ] `npm run build` sin errores de TypeScript
- [ ] Probar el flujo de refresh de token en produccion (cookies Secure requieren HTTPS)

### Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo en puerto 3001
npm run build     # Build de produccion
npm run start     # Servidor de produccion (requiere build previo)
npm run lint      # ESLint
npm test          # Tests con Vitest
```

### Build con Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
```

Requiere `output: 'standalone'` en `next.config.mjs`.
