# Aurora S-Chain — CLAUDE.md

## Descripción General

**Aurora S-Chain** es un dashboard interno de Aurora para visualizar:
- **EyeOn Stock**: análisis detallado de cadena de suministro (inventario, demanda, suministro, proveedores)
- **KPIs por Área**: métricas del Strategy Map 2025 (Salud Negocio, Flujo de Caja, Efectividad Operativa)

Stack: **Node.js + TypeScript (backend)** + **React + TypeScript + Vite (frontend)**.

Usuarios: restringido a `fmorenob@auroracorp.es` (autenticación OAuth contra ERP Aurora).

---

## Arquitectura de Datos

### Base de Datos Primaria: AURORA (SQL Server)
**Host**: `10.10.4.173\SAGE:1433`  
**BD**: `AURORA`  
**Usuario**: `MRH`  
**Credenciales**: `backend/.env`

**Tablas principales**:
- `VArticulosFichaTecnica` — vista de artículos con metadatos maestros
- `AcumuladoStock`, `MovimientoStock`, `MRH_StatusStock` — inventario
- `CabeceraPedidoCliente`, `LineasPedidoCliente` — órdenes de cliente
- `CabeceraAlbaranCliente`, `LineasAlbaranCliente` — entregas a cliente
- `CabeceraPedidoProveedor`, `LineasPedidoProveedor` — órdenes a proveedores
- `CabeceraAlbaranProveedor`, `LineasAlbaranProveedor` — recepciones de proveedores
- `ArticuloProveedor` — master proveedor (lead time, etc.)
- `Articulos`, `Almacenes`, `Proveedores` — master data
- `OrdenesFabricacion`, `Incidencias`, `EstadisVenta` — operacional

**Filtro Aurora**: todos los queries restringen a productos Aurora: `CodigoArticulo LIKE 'LB%' OR LIKE 'K%'`

### Base de Datos Secundaria: PRECIOS (MySQL)
**Host**: `10.10.4.175:3306`  
**BD**: `precios`  
**Usuario**: `root`  
**Credenciales**: `backend/.env`

⚠️ **Estado**: configurada en `.env` pero **NO INTEGRADA AÚN** en servicios/queries. Reservada para futuras métricas de precios/margen.

---

## Estructura de Carpetas

```
Aurora S-Chain/
├── backend/
│   ├── src/
│   │   ├── server.ts                 # Entry point Express
│   │   ├── config.ts                 # Variables de entorno (DB, auth, CORS)
│   │   ├── auth/
│   │   │   ├── routes.ts             # POST /login, POST /logout, GET /user
│   │   │   └── sessions.ts           # Gestión de sesiones (secret, TTL)
│   │   ├── middleware/
│   │   │   └── requireAuth.ts        # Protección rutas /api/*
│   │   ├── db/
│   │   │   └── mssql.ts              # Pool SQL Server singleton, query helper
│   │   └── routes/
│   │       ├── health.ts             # GET /health
│   │       ├── docs.ts               # GET /docs (metadata visuals + formulas)
│   │       ├── eyeon.ts              # GET /eyeon/* (10 secciones dashboard)
│   │       └── kpis.ts               # GET /kpis/por-area
│   ├── services/
│   │   ├── eyeon.ts                  # Queries AURORA (DonutDatum, BarMonthDatum, etc.)
│   │   └── documentation.ts          # Metadata: SECTIONS, visuals, status, sources
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                          # Credenciales DB + auth config (⚠️ .gitignore)
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                   # Router setup (Login, SectionPage, KpisPorAreaPage, Docs)
│   │   ├── lib/
│   │   │   ├── api.ts                # Cliente HTTP (fetch + auth header)
│   │   │   └── auth.tsx              # React Context + hooks (useAuth, useUser)
│   │   ├── pages/
│   │   │   ├── Login.tsx             # Form → POST /api/auth/login
│   │   │   ├── SectionPage.tsx       # GET /api/eyeon/{slug} → Visual grid (blocked en gris)
│   │   │   ├── KpisPorAreaPage.tsx   # GET /api/kpis/por-area → KPI cards
│   │   │   └── DocumentationPage.tsx # Metadata: target, fórmula, tendencia
│   │   ├── components/
│   │   │   ├── Layout.tsx            # Header + nav
│   │   │   └── Visual.tsx            # Renderiza charts / blocked state
│   │   └── styles/
│   │       └── tokens.css            # Colores Aurora (#0524de, #252eac, #6fc4fa)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── scripts/
│   └── scan_db.py                    # Escanea AURORA (genera db_scan.json)
│
├── docs/
│   └── eyeon_sections.md             # Descripción EyeOn Stock (10 secciones)
│
├── REFERENCE.md                      # Setup completo, troubleshooting
├── README.md                         # Quick start
├── CLAUDE.md                         # Este archivo
└── .env.example                      # Plantilla variables entorno
```

---

## Endpoints API

### Autenticación
- **POST** `/api/auth/login` → `{ email, password }` → `{ user: { email, ... }, sessionToken }`
- **POST** `/api/auth/logout` → limpia sesión
- **GET** `/api/auth/user` → usuario autenticado (requiere token)

### Dashboard EyeOn Stock
Cada endpoint devuelve `{ section: string, visuals: { [id]: { data } | { blocked, reason } } }`.

1. **GET** `/api/eyeon/master-data`
   - `md-material-group` → distribución artículos por grupo (donut)
   - `md-hierarchy` → distribución por tipo (baño/decoración, etc.)
   - `md-lead-time` → histograma lead time proveedores
   - `md-order-qty` → tabla qty promedio de orden

2. **GET** `/api/eyeon/demand-data`
   - `dd-by-month` → demanda 24 meses (bar chart)
   - `dd-top10` → top 10 productos demanda
   - `dd-detail` → tabla detalle demanda

3. **GET** `/api/eyeon/supply-data`
   - `sd-delivered` → suministro 24 meses
   - `sd-top10` → top 10 proveedores
   - `sd-suppliers` → ranking atrasos proveedores

4. **GET** `/api/eyeon/inventory-data`
   - `inv-breakdown` → distribución inventario por tipo (ABC)
   - `inv-dioh` → días inventario buckets (DIOH)
   - `inv-stock-values` → cycle vs safety stock (valor)
   - `inv-stock-qty` → cantidad total

5. **GET** `/api/eyeon/current-state`
   - `cs-items` → total artículos
   - `cs-total-val` → valor total inventario
   - `cs-safety-val`, `cs-cycle-val` → desglose
   - `cs-sl` → service level OTIF
   - `cs-abc-xyz` → matriz ABC/XYZ

6. **GET** `/api/eyeon/optimized-state`
   - `os-items` → ídem current state
   - `os-target-sl` → target SL 95%
   - resto → blocked (pendiente motor optimización)

7. **GET** `/api/eyeon/overview` → **blocked** (diseño pendiente)

8. **GET** `/api/eyeon/safety-stock-deepdive`
   - `ssd-gauge-sl` → gauge SL actual vs target 95%
   - resto → blocked

9. **GET** `/api/eyeon/safety-stock-items` → **blocked** (pendiente motor)

10. **GET** `/api/eyeon/overstock-understock`
    - `ou-top10-over` → top 10 overstock
    - `ou-top10-under` → top 10 understock
    - `ou-cards` → total qty/value

### KPIs por Área
- **GET** `/api/kpis/por-area` → array KPIs (Salud Negocio, Flujo de Caja, Efectividad Operativa)
  - Cada KPI: `{ id, title, description, formula, status, sources, value (si computable), target, nivel, tendencia }`

### Documentación
- **GET** `/api/docs` → `{ sections: [ { slug, title, visuals: [...] } ] }`

### Health
- **GET** `/api/health` → `{ status: "ok" }`

---

## Estado de las Fuentes de Datos

### ✅ Integrado (AURORA)
Todos los visuals de EyeOn Stock sacan datos del servidor SQL AURORA.  
**Queries**: `services/eyeon.ts` contiene lógica para cada visual.  
**Fallback**: si tabla/columna no existe o query falla → visual se pinta gris con razón ("Sin datos", "DB error").

### 📋 Metadata (Documentación estática)
`services/documentation.ts` define metadata (status, formula, tendencia, sources).  
**Visuals "blocked"**: especificado como `status: "blocked"` en metadata → siempre salen gris en UI, sin intento de query.

### ⏳ No Integrado Aún
- **PRECIOS (MySQL)**: configurada en `.env` pero sin cliente/queries.
- **Visuals "pending"**: requieren nuevo motor (ej: `optimized-state` espera logic de optimización).
- **Visuals deferred**: especificados en backlog (ej: `overview`).

---

## Flujo de Datos (Ejemplo)

```
Frontend: GET /api/eyeon/inventory-data
    ↓
Backend: eyeonRouter.get("/inventory-data")
    ↓
eyeon.ts:
  - invBreakdown() → AURORA query → treemap data
  - diohBuckets() → AURORA query → buckets
  - cycleAndSafety() → AURORA query → {cycleValue, safetyValue}
  - totalStockValue() → AURORA query → {qty, value}
    ↓
Response: {
  section: "inventory-data",
  visuals: {
    "inv-breakdown": { data: [...] },
    "inv-dioh": { data: [...] },
    "inv-stock-values": { data: [...] },
    "inv-stock-qty": { data: [...] }
  }
}
    ↓
Frontend: SectionPage.tsx → Visual.tsx renderiza charts / bloqueados en gris
```

---

## Verificación de Datos

### 1. Conexión a AURORA
```bash
# Desde backend/
npm run dev
# Debe mostrar: [aurora-schain] up on http://localhost:8010
# Verifica GET http://localhost:8010/api/health
```

### 2. Verificar Tablas en AURORA
```sql
-- En SQL Server Management Studio
SELECT o.name AS TableName
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U','V')
  AND s.name = 'dbo'
  AND o.name IN ('VArticulosFichaTecnica', 'AcumuladoStock', 'ArticuloProveedor', ...)
ORDER BY o.name;
```

### 3. Verificar Productos Aurora
```sql
SELECT COUNT(DISTINCT CodigoArticulo) AS count_lbk
FROM VArticulosFichaTecnica
WHERE CodigoArticulo LIKE 'LB%' OR CodigoArticulo LIKE 'K%';
```

### 4. Verificar UI (Frontend)
```bash
# Terminal 1: backend
cd backend && npm run dev    # http://localhost:8010

# Terminal 2: frontend
cd frontend && npm run dev   # http://localhost:5173
```
- Navega a `http://localhost:5173`
- Login: `fmorenob@auroracorp.es` + tu contraseña ERP
- Verifica cada sección:
  - Visuals **gris** = `{ blocked: true }` (tabla no existe / sin datos)
  - Visuals **con datos** = query ejecutada correctamente

---

## Troubleshooting

### Backend no conecta a AURORA
1. Verifica credenciales en `backend/.env`
2. `AURORA_DB_HOST` debe ser IP+instancia: `10.10.4.173\SAGE`
3. Puerto 1433 abierto (firewall)
4. Usuario `MRH` tiene permisos SELECT en tablas

### Visuals salen bloqueados en UI
- **Esperado**: si tabla no existe, query devuelve null → blocked con "Sin datos"
- **Debug**: revisa logs backend (`[eyeon:xxx]` errors)
- **Check**: SQL Management Studio → verifica tabla existe y tiene datos

### PRECIOS BD (MySQL) no configurada
- `.env` tiene credenciales pero sin cliente
- Para integrar: crear pool MySQL en `backend/src/db/mysql.ts`
- Importar en servicios que la necesiten
- Agregar queries en `services/eyeon.ts`

---

## Comandos Útiles

```bash
# Backend
cd backend
npm install                 # Install deps
npm run dev                 # Start (tsx watch)
npm run build               # Compile TypeScript → dist/
npm start                   # Run compiled (node dist/server.js)

# Frontend
cd frontend
npm install
npm run dev                 # Vite dev server
npm run build               # Build prod bundle → dist/
npm run preview             # Preview prod build

# Python scan (requiere pyodbc)
cd scripts
python scan_db.py          # Genera output/db_scan.json (tablas AURORA)

# Testing/Debug
curl http://localhost:8010/api/health  # Health check
curl -X POST http://localhost:8010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fmorenob@auroracorp.es","password":"..."}'
```

---

## Notas para Desarrolladores

- **Auth token**: almacenado en `sessionStorage` (frontend); session en memory (backend)
- **CORS**: permite localhost:5173 en dev; configurable en `.env`
- **Error handling**: queries fallidas → visual bloqueado (graceful degradation)
- **Colores**: guía oficial Aurora (scss tokens.css)
- **Documentación dinámica**: `/api/docs` devuelve metadata; UI renderiza fórmulas, tendencias, sources
- **Scope futuro**: motor optimización (recommends SS, reorder points), integración PRECIOS (margen), dashboards adicionales

---

## Contactos & Referencias

- **Autor**: Fernando Moreno Borrego (`fmorenob@auroracorp.es`)
- **BD AURORA**: intranet.auroracorp.digital (MRH:Aurora_2019_1+#)
- **BD PRECIOS**: 10.10.4.175:3306 (root:H4p!mK22yy$9)
- **Docs**: `REFERENCE.md` (setup détaillé), `eyeon_sections.md` (descripción visual)
- **ERP**: https://intranet.auroracorp.digital (OAuth login)
