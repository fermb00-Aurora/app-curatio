# Aurora S-Chain — Referencia del proyecto

> Documento de referencia para futuras sesiones. Resume credenciales, decisiones de arquitectura, stack, fuentes de datos y estado de implementación de la app **Aurora S-Chain** (réplica + extensión del dashboard *EyeOn Stock* y panel de **KPIs por Área** del Strategy Map de Cadena de Suministro 2025).

---

## 1. Credenciales (heredadas de `aurora_app/.env`)

```
AURORA_DB_HOST=10.10.4.173\SAGE
AURORA_DB_PORT=1433
AURORA_DB_USER=MRH
AURORA_DB_PASS=Aurora_2019_1+#
AURORA_DB_NAME=AURORA

AURORA_AUTH_API_URL=https://intranet.auroracorp.digital/apicomun/index.php/login/

# Base secundaria (precios — MySQL) — no usada por S-Chain salvo valor de inventario
PRECIOS_DB_HOST=10.10.4.175
PRECIOS_DB_PORT=3306
PRECIOS_DB_USER=root
PRECIOS_DB_PASS=H4p!mK22yy$9
PRECIOS_DB_NAME=precios
```

> Estas credenciales son las mismas que usa `aurora_app`. La API de login ERP devuelve `{res:"ok", email, nombre, id}` cuando las credenciales son válidas. Se consume vía `GET {AUTH_API_URL}/{email_urlenc}/{password_urlenc}`. Se ignora TLS (intranet usa self-signed).

**Allowlist S-Chain:** solo `fmorenob@auroracorp.es` (configurable vía variable `SCHAIN_ALLOWED_EMAILS`).

---

## 2. Stack elegido

| Capa | Tecnología |
| --- | --- |
| Backend | **Node.js 20 + TypeScript + Express 4** (separable, proceso propio en puerto 8010) |
| Driver SQL Server | `mssql` (Tedious) |
| Auth | Proxy al API del ERP Aurora + sesión en memoria + allowlist |
| Frontend | **React 18 + TypeScript + Vite** (puerto 5173 en dev) |
| Gráficos | `recharts` |
| Estilos | CSS-in-plain (variables) — mismo sistema que `aurora_app` |
| Fuentes | Open Sans, Barlow Condensed, JetBrains Mono (Google Fonts) |

**Paleta oficial (PDF "Guía de estilo App Aurora Intelligent Nutrition"):**

| Rol | HEX |
| --- | --- |
| Primario | `#0524de` |
| Secundario 1 | `#252eac` |
| Secundario 2 | `#6fc4fa` |
| Fondo | `#f3f6fb` |

Tipografía body = **Open Sans**; headline = **Open Sans Bold**; display/UI decorativo heredado de `aurora_app` = **Barlow Condensed** (compatible con la guía porque la guía solo fija Open Sans para body/headline).

---

## 3. Arquitectura

```
Aurora S-Chain/
└─ aurora_schain_app/
   ├─ REFERENCE.md                # este fichero
   ├─ README.md                   # cómo arrancar
   ├─ .env.example
   ├─ backend/                    # Node + TS
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ server.ts             # entry — express app, CORS, auth middleware
   │     ├─ config.ts             # lee .env
   │     ├─ db/mssql.ts           # pool SQL Server singleton
   │     ├─ auth/
   │     │  ├─ erp.ts             # llamada al API ERP
   │     │  ├─ sessions.ts        # store en memoria
   │     │  └─ routes.ts          # /api/auth/*
   │     ├─ middleware/
   │     │  ├─ requireAuth.ts
   │     │  └─ errorHandler.ts
   │     ├─ services/
   │     │  ├─ eyeon.ts           # cálculos EyeOn Stock
   │     │  ├─ kpisPorArea.ts     # cálculos de KPIs del Excel
   │     │  └─ documentation.ts   # metadata origen de datos
   │     └─ routes/
   │        ├─ eyeon.ts           # /api/eyeon/*
   │        ├─ kpis.ts            # /api/kpis/*
   │        ├─ docs.ts            # /api/docs/*
   │        └─ health.ts
   ├─ frontend/                   # React + TS + Vite
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  ├─ vite.config.ts
   │  ├─ index.html
   │  └─ src/
   │     ├─ main.tsx
   │     ├─ App.tsx
   │     ├─ lib/api.ts            # fetch wrapper con Bearer
   │     ├─ lib/auth.tsx          # contexto de sesión
   │     ├─ styles/tokens.css     # variables de la guía de estilo
   │     ├─ components/
   │     │  ├─ Sidebar.tsx
   │     │  ├─ Topbar.tsx
   │     │  ├─ MetricCard.tsx
   │     │  ├─ LockedMetric.tsx   # placeholder gris para datos no disponibles
   │     │  └─ Charts/*.tsx
   │     └─ pages/
   │        ├─ Login.tsx
   │        ├─ Dashboard.tsx      # wrapper con tabs
   │        ├─ EyeOn/
   │        │  ├─ OverviewPage.tsx
   │        │  ├─ StockPage.tsx
   │        │  ├─ CoveragePage.tsx
   │        │  ├─ SlowObsoletePage.tsx
   │        │  └─ ServiceLevelPage.tsx
   │        ├─ KpisPorAreaPage.tsx
   │        └─ DocumentationPage.tsx
   ├─ scripts/
   │  └─ scan_db.py               # script para escanear AURORA y detectar tablas de stock (ejecuta el usuario)
   └─ docs/
      ├─ eyeon_sections.md        # mapeo hoja Power BI → implementación
      └─ data_dictionary.md       # origen de datos por métrica
```

### Separación back/front

- **Backend**: puerto `8010`. Sirve sólo JSON.
- **Frontend**: Vite dev server `5173` con proxy `/api` → `http://localhost:8010`.
- **Producción**: `npm run build` del frontend genera `frontend/dist`; el backend puede servirlo opcionalmente con `express.static` (flag `SERVE_STATIC=true`).

### Sesiones

Igual que aurora_app: token aleatorio de 32 bytes hex, store en `Map<token, {email, nombre, id}>` en memoria. Se pasa en `Authorization: Bearer <token>`. Cualquier `/api/*` salvo `/api/auth/login` y `/api/health` requiere token válido.

---

## 4. Fuentes de datos conocidas (AURORA — SQL Server)

Heredadas de `aurora_app`:

| Tabla / Vista | Descripción | Uso en S-Chain |
| --- | --- | --- |
| `VArticulosFichaTecnica` | Vista maestra de artículos (~51k filas), filtro `LB%`/`K%` | Catálogo de SKUs, dimensiones, categorías |
| `ConcentracionCompuestosAF` | Vitaminas/minerales por producto | No se usa en S-Chain |
| `VArticuloAlergenos` | Alérgenos (fallback) | No se usa |
| `MRH_MatrizAlergenos` | Alérgenos a nivel ingrediente | No se usa |
| `Vis_MRH_EsquemaEscandallo` | Escandallo / BOM | Potencial valoración de inventario por coste estándar |

### Pendientes de descubrimiento (Sage AURORA)

Candidatos habituales en Sage 200/X3 para stock, ventas, compras y logística. El script `scripts/scan_db.py` detecta su existencia real:

- `AcumuladoStocks`, `Stocks`, `Almacen`, `AlmacenProducto`
- `LineasPedidoCli`, `CabeceraPedidoCli`, `LineasAlbaranCli`, `CabeceraAlbaranCli`
- `LineasPedidoProv`, `LineasAlbaranProv`
- `MovimientosStock`, `MovimientoStock`, `ContadorEntrada`, `ContadorSalida`
- `Clientes`, `Proveedores`
- `VistasStock` (varias posibles)

Cuando se confirmen, se mapean en `docs/data_dictionary.md` y se activan las queries en `backend/src/services/eyeon.ts`.

---

## 5. Secciones del dashboard

### 5.1 Dashboard EyeOn Stock (réplica)
**Pendiente de confirmación** — las hojas exactas se detallan en `docs/eyeon_sections.md` tras recibir capturas del usuario. Estructura inicial prevista (secciones típicas EyeOn Stock):

1. **Overview** — Stock value total, DIO, Rotación, Cobertura media, nº SKUs activos, top movers.
2. **Stock Value & Quantity** — valor por almacén, por categoría, por ABC, evolución mensual.
3. **Coverage & Days Inventory on Hand (DIO)** — histogramas, top/bottom 10 SKUs.
4. **Slow Movers & Obsoletes** — SKUs sin salida > 90/180 días, valor obsoleto, %.
5. **Service Level / Stockouts** — disponibilidad, nº stockouts, OTIF.
6. **Forecast Accuracy** — forecast vs real (si existe tabla forecast).

### 5.2 KPIs por Área (Excel *Strategy Map — KPIs por Área*)

| KPI | Nivel | Fórmula (Excel) | Estado |
| --- | --- | --- | --- |
| Cumplimiento de Ventas | Salud Negocio | Ventas 2025 / Ventas 2024 × 100 | Requiere tabla de pedidos/albaranes cliente |
| EBITDA | Salud Negocio | Ingresos − Costes operativos | No hay origen de datos → **bloqueado/gris** |
| OTIF Clientes | Salud Negocio | Órdenes entregadas a tiempo / Totales × 100 | Requiere albaranes con fecha comprometida vs fecha entrega |
| Accidentes | Salud Negocio | Nº accidentes reportados | No hay origen → **bloqueado** |
| Rotación de Stocks | Flujo de Caja | Coste ventas / Inventario medio | Requiere ventas + stock valorado |
| Inventarios | Flujo de Caja | SKUs inventariados / SKUs total × 100 | Requiere tabla inventarios cíclicos |
| Reciclaje | Flujo de Caja | Kgs reprocesados | No hay origen → **bloqueado** |
| % Ocupación Almacenes | Flujo de Caja | Volumen ocupado / Volumen total × 100 | No hay origen (volumen almacén) → **bloqueado** |
| Necesidades Working Capital | Flujo de Caja | Inventario + AR − AP | Requiere contabilidad (AR/AP) → probablemente **bloqueado** |
| Productividad Logística | Efectividad Operativa | Pickings / Persona / Semana | Requiere WMS/SGA → **bloqueado** |
| OEE | Efectividad Operativa | Disp × Rend × Calidad × 100 | Requiere MES → **bloqueado** |
| Reclamos Calidad Externos | Efectividad Operativa | Reclamos / 1000€ ventas × 100 | Requiere módulo reclamaciones → **bloqueado** |
| MTBF | Efectividad Operativa | Tiempo op sin fallos | → **bloqueado** |
| Ahorros Buy Power | Efectividad Operativa | Ahorro COVI anual | → **bloqueado** |
| % Cumplimiento de pedidos | Efectividad Operativa | Pedidos con Fecha pedido ≥ Lead Time / Totales | Compras a proveedor |
| OTIF Proveedores | Efectividad Operativa | Pedidos con Un. recibidas = Un. pedidas y Fecha Albarán −2 ≤ Fecha Pedido / Totales | Compras a proveedor |
| Roturas Picking | Efectividad Operativa | Nº roturas picking | → **bloqueado** (no hay campo identificable) |
| Órdenes no Cerradas | Efectividad Operativa | Nº órdenes con >10 días abiertas al lunes | Requiere órdenes producción |
| Incidencias Logísticas GDM | Efectividad Operativa | Nº incidencias / entregas | → **bloqueado** |
| Roturas Materiales | Efectividad Operativa | Nº roturas materiales | → **bloqueado** |
| Resolución Solicitudes Mantenimiento | Efectividad Operativa | Resueltas / Totales × 100 (ValueKeep) | Externo (ValueKeep) → **bloqueado** |

Los KPIs marcados **bloqueado** se muestran en gris con el texto *"Sin datos disponibles en AURORA"* y su ficha correspondiente en la página de Documentación.

---

## 6. Sección Documentación (dentro de la app)

Todas las páginas llevan un botón `ℹ Documentación de esta sección` que abre la pestaña `Documentación` filtrada por sección. Para cada métrica/gráfico se detalla:

- **Origen**: base de datos, tabla/vista, columnas concretas.
- **Cálculo**: fórmula exacta (tal y como se define en el Excel o en el Power BI original).
- **Filtros aplicados** (p. ej. `CodigoArticulo LIKE 'LB%' OR LIKE 'K%'`).
- **Periodicidad / cache** (si aplica).
- **Limitaciones conocidas** (nulls, campos rotos — p. ej. `MRH_TipoProducto` con encoding).

El endpoint `GET /api/docs/sections` devuelve este catálogo en JSON (fuente única).

---

## 7. Cómo arrancar (dev)

```bash
# Backend
cd backend
cp .env.example .env    # completar con credenciales AURORA
npm install
npm run dev             # http://localhost:8010

# Frontend
cd ../frontend
npm install
npm run dev             # http://localhost:5173
```

## 8. Cómo arrancar (prod mínima local)

```bash
cd frontend && npm run build
cd ../backend && SERVE_STATIC=true npm start   # http://localhost:8010
```

---

## 9. TODO para próxima sesión

- [ ] Ejecutar `scripts/scan_db.py` con credenciales reales para mapear tablas de stock.
- [ ] Cuando el usuario comparta capturas del `EyeOn Stock.pbix`, completar `docs/eyeon_sections.md` con el layout exacto (visuales, medidas DAX equivalentes en SQL).
- [ ] Activar queries reales en `backend/src/services/eyeon.ts` y `kpisPorArea.ts`.
- [ ] Revisar `VALID_ORDER_COLS` / whitelists antidrá-inyección en nuevos endpoints.
- [ ] Tests E2E de login contra el API ERP (mockear respuesta `{res:"ok"}`).
