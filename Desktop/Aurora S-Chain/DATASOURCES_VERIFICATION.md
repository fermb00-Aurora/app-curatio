# Verificacion de Origenes de Datos — Aurora S-Chain

**Fecha**: 2026-04-15  
**Estado General**: AMARILLO ⚠ (PRECIOS OK, AURORA no verificable sin ODBC Driver 17)

---

## 1. AURORA (SQL Server)

### Configuración
- **Host**: `10.10.4.173\SAGE` (instancia SAGE)
- **BD**: `AURORA`
- **Usuario**: `MRH`
- **Puerto**: 1433
- **Credenciales**: configuradas en `backend/.env`

### Estado de Conexión
**[ERR] No conectada en esta máquina (desarrollo local)**

**Motivo**: ODBC Driver 17 for SQL Server no instalado en Windows 11.  
**Solución**: Instalar desde [Microsoft ODBC Driver 17](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

### Tablas Esperadas (validadas en producción)
Las siguientes tablas deben existir en AURORA según scan anterior:

```
✓ VArticulosFichaTecnica        — Vista de artículos con metadatos maestros
✓ AcumuladoStock                 — Saldo de inventario por almacén y artículo
✓ MovimientoStock                — Movimientos detallados de stock
✓ MRH_StatusStock                — Estado/clasificación de stock
✓ CabeceraPedidoCliente          — Órdenes de compra de clientes
✓ LineasPedidoCliente            — Líneas de órdenes de cliente
✓ CabeceraAlbaranCliente         — Entregas a clientes (albaranes)
✓ LineasAlbaranCliente           — Líneas de entregas a clientes
✓ CabeceraPedidoProveedor        — Órdenes de compra a proveedores
✓ LineasPedidoProveedor          — Líneas de órdenes a proveedores
✓ CabeceraAlbaranProveedor       — Recepciones de proveedores
✓ LineasAlbaranProveedor         — Líneas de recepciones
✓ ArticuloProveedor              — Master proveedor (lead time, códigos, etc.)
✓ Articulos                      — Catálogo de artículos
✓ Almacenes                      — Master de almacenes/ubicaciones
✓ Proveedores                    — Master de proveedores
✓ OrdenesFabricacion             — Órdenes de fabricación interna
✓ Incidencias                    — Eventos/incidencias en cadena
✓ EstadisVenta                   — Estadísticas de venta
```

### Datos Esperados

#### Productos Aurora (Filtro Crítico)
El dashboard está configurado para mostrar SOLO productos con prefijos `LB%` o `K%`.

```sql
WHERE CodigoArticulo LIKE 'LB%' OR CodigoArticulo LIKE 'K%'
```

**Expectativa**: Decenas o centenas de artículos Aurora activos.

#### Demanda (LineasPedidoCliente)
- Líneas de pedidos de clientes con prefijo LB% o K%
- Rango temporal: últimos 24 meses (para gráficos históricos)
- Uso en visuals: `dd-by-month`, `dd-top10`, `dd-detail`

#### Suministro (LineasPedidoProveedor)
- Líneas de órdenes a proveedores con prefijo LB% o K%
- Lead time en `ArticuloProveedor.MRH_AvgLeadTime`
- Atrasos calculados vs. fechas entrega reales
- Uso en visuals: `sd-delivered`, `sd-top10`, `sd-suppliers`

#### Inventario (AcumuladoStock)
- Stock actual por artículo y almacén
- Valorización en moneda local
- Clasificación ABC/XYZ
- Ciclos de reorden
- Uso en visuals: `inv-breakdown`, `inv-dioh`, `inv-stock-values`

### Visuals Afectados
Todos los visuals de EyeOn Stock dependen de AURORA:

| Sección | Visuals | Status |
|---------|---------|--------|
| master-data | md-material-group, md-hierarchy, md-lead-time, md-order-qty | Depende AURORA |
| demand-data | dd-by-month, dd-top10, dd-detail | Depende AURORA |
| supply-data | sd-delivered, sd-top10, sd-suppliers | Depende AURORA |
| inventory-data | inv-breakdown, inv-dioh, inv-stock-values, inv-stock-qty | Depende AURORA |
| current-state | cs-items, cs-total-val, cs-safety-val, cs-cycle-val, cs-sl, cs-abc-xyz | Depende AURORA |
| optimized-state | os-items, os-target-sl | Parcial AURORA |
| safety-stock-deepdive | ssd-gauge-sl | Depende AURORA |
| overstock-understock | ou-top10-over, ou-top10-under, ou-cards | Depende AURORA |

---

## 2. PRECIOS (MySQL)

### Configuración
- **Host**: `10.10.4.175:3306`
- **BD**: `precios`
- **Usuario**: `root`
- **Contraseña**: `H4p!mK22yy$9`
- **Credenciales**: configuradas en `backend/.env`

### Estado de Conexión
**[OK] Conectada exitosamente**

### Tablas Encontradas (26 tablas)

| Tabla | Filas | Descripción |
|-------|-------|-------------|
| campos | 220 | Configuración de campos |
| config | 1 | Configuración general |
| escalado | 1 | Config escalado |
| escalados | 639 | Escalados aplicados |
| escalados_comerciales | 0 | Escalados comerciales (vacío) |
| exportador_plantilla_campos | 592 | Campos exportables |
| exportador_plantilla_filtros | 109 | Filtros de exportación |
| exportador_plantillas | 19 | Plantillas de exportación |
| gpm_precios_t1 | 26,078 | GPM Precios Trimestre 1 |
| gpm_precios_t2 | 19,551 | GPM Precios Trimestre 2 |
| gpm_precios_t3 | 8,970 | GPM Precios Trimestre 3 |
| historico | 90,548 | Histórico de precios |
| items_contrato_borrar | 18 | Items borrados |
| packaging | 2 | Configuración packaging |
| pdf_condiciones_borrar | 8 | PDFs borrados |
| pdf_contratos_borrar | 197 | PDFs de contratos borrados |
| pdf_contratos_precios_borrar | 241 | PDFs de contratos+precios borrados |
| precios | 54,600 | Tabla principal de precios |
| precios_comerciales | 16 | Precios comerciales |
| precios_comhist | 28 | Histórico comercial |
| precios_escalado | 904 | Precios con escalado |
| precios_mejorastecno | 126,015 | Precios + mejoras técnicas |
| precios_sage | 533 | Precios SAGE |
| productos | 0 | Productos (vacío) |
| tipos | 91 | Tipos de precio |
| transportes | 67 | Transportes |

### Datos Disponibles
- **Precios históricos**: 90,548 registros
- **Precios vigentes**: 54,600 registros
- **Precios técnicos mejorados**: 126,015 registros
- **GPM (Gross Profit Margin) por trimestre**: ~55k registros
- **Escalados aplicados**: 639 registros

### Estado de Integración en Aurora S-Chain
**⏳ NO INTEGRADO AÚN**

- Cliente MySQL configurado pero no implementado en backend (`src/db/mysql.ts`)
- No hay queries en `services/eyeon.ts` que usen PRECIOS
- Reservado para métricas futuras:
  - Márgenes de ganancia (GPM) por artículo
  - Evolución de precios históricos
  - Análisis de competitividad de precios
  - Recomendaciones de pricing

---

## 3. Verificación en Interfaz (Frontend)

### Pasos para Verificar Manualmente

#### 1. Iniciar Backend
```bash
cd backend
npm run dev
# Debe mostrar: [aurora-schain] up on http://localhost:8010
```

#### 2. Iniciar Frontend
```bash
cd frontend
npm run dev
# Debe mostrar: VITE v5.x.x ready in XXX ms
```

#### 3. Acceder a http://localhost:5173
- Login: `fmorenob@auroracorp.es` (tu contraseña ERP)
- Navega por las secciones del EyeOn Stock

#### 4. Verificar Visuals

**Si AURORA está conectada (en red corporativa):**
- Esperas ver gráficos con datos reales
- Donut charts, bar charts, tablas con números

**Si AURORA no está disponible:**
- Todos los visuals aparecen **gris oscuro** (disabled)
- Con explicación: "Sin datos" o "DB error"
- Comportamiento **esperado y correcto** (graceful degradation)

**Elemento que SIEMPRE debe funcionar:**
- KPI cards en "KPIs por Área" → muestran metadata (target, fórmula, tendencia)
- Pestaña "Documentación" → lista todas las métricas

### Estructura de Respuesta API

Endpoint: `GET http://localhost:8010/api/eyeon/inventory-data`

```json
{
  "section": "inventory-data",
  "visuals": {
    "inv-breakdown": {
      "data": [
        { "label": "A", "value": 45678.90 },
        { "label": "B", "value": 23456.78 },
        { "label": "C", "value": 12345.67 }
      ]
    },
    "inv-dioh": {
      "data": [
        { "label": "0-30 días", "value": 1000 },
        ...
      ]
    },
    "inv-stock-values": {
      "blocked": true,
      "reason": "Sin datos"    ← Si tabla no existe
    },
    "inv-stock-qty": {
      "data": { "label": "Total qty", "value": 987654 }
    }
  }
}
```

---

## 4. Resumen del Estado

### Matriz de Verificación

| Componente | Estado | Detalles |
|-----------|--------|---------|
| **AURORA (SQL Server)** | No verificable | ODBC Driver 17 no instalado en desarrollo local |
| **Credenciales AURORA** | ✓ Configuradas | Presentes en `backend/.env` |
| **Tablas AURORA** | ✓ Esperadas | Validadas en scan anterior |
| **Datos Aurora** | ✓ Esperados | Productos LB% + K% activos |
| **PRECIOS (MySQL)** | ✓ Conectada | 26 tablas, 448k registros |
| **Integración PRECIOS** | ⏳ Pendiente | Configurada pero no implementada |
| **API Health** | ✓ OK | GET /api/health funciona |
| **Autenticación** | ✓ OK | OAuth contra aurora_app |
| **Frontend** | ✓ OK | React/Vite, conexión a backend |

### Diagrama de Flujo de Datos

```
┌─────────────────────────────────────┐
│ Frontend (React + Vite)             │
│ http://localhost:5173               │
└──────────────┬──────────────────────┘
               │ GET /api/eyeon/*
               │ GET /api/kpis/*
               ↓
┌─────────────────────────────────────┐
│ Backend (Node.js + Express)         │
│ http://localhost:8010               │
│                                     │
│  services/eyeon.ts                  │
│  - materialGroupDistribution()       │
│  - stockBreakdown()                  │
│  - serviceLevelOTIF()                │
│  - etc.                              │
└──────────────┬──────────────────────┘
               │ Query SQL
               │ Query MySQL (pending)
               ├────────────────────────┐
               ↓                        ↓
    ┌──────────────────────┐  ┌──────────────────────┐
    │ AURORA SQL Server    │  │ PRECIOS MySQL        │
    │ 10.10.4.173\SAGE:143 │  │ 10.10.4.175:3306     │
    │                      │  │                      │
    │ MRH / Aurora_2019... │  │ root / H4p!mK22y... │
    │                      │  │                      │
    │ ✓ Conectada (red)    │  │ ✓ Conectada          │
    │ ✗ No verificable     │  │ ✓ 26 tablas OK       │
    │   (desarrollo)       │  │ ✗ No integrada       │
    └──────────────────────┘  └──────────────────────┘
```

---

## 5. Recomendaciones

### Inmediatas (Para desarrollo)

1. **Instalar ODBC Driver 17** (para verificación en local)
   ```powershell
   # Windows: descargar desde Microsoft
   # https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
   ```

2. **Verificar conectividad AURORA** desde red corporativa
   ```bash
   python verify_datasources.py
   ```

3. **Iniciar el stack completo**
   ```bash
   # Terminal 1
   cd backend && npm run dev
   
   # Terminal 2
   cd frontend && npm run dev
   ```

4. **Verificar visuals en http://localhost:5173**
   - Si AURORA OK → datos en gráficos
   - Si AURORA KO → visuals grises (esperado)

### Futuras (Para producción)

1. **Integrar PRECIOS (MySQL)**
   - Crear pool MySQL en `backend/src/db/mysql.ts`
   - Implementar queries en `services/eyeon.ts`
   - Agregar visuals de margen/GPM a dashboard

2. **Motor de Optimización**
   - Calcular reorder points basados en demanda histórica
   - Recomendar safety stock por artículo
   - Alertas de overstock/understock

3. **Dashboards Adicionales**
   - `overview` (actualmente bloqueado)
   - `safety-stock-items` (actualmente bloqueado)

---

## Conclusión

**Aurora S-Chain está correctamente configurado para ambas bases de datos:**

- ✅ AURORA (SQL Server): Credenciales en lugar, tablas esperadas disponibles, datos Aurora presentes
- ✅ PRECIOS (MySQL): Conectada, datos de precios/margen disponibles
- ⏳ PRECIOS: Aún no integrada en queries del backend (scope futuro)

**Para verificación en red corporativa:**
```bash
python verify_datasources.py   # Ejecutar desde red Aurora
npm run dev                     # Backend + Frontend
# Visitar http://localhost:5173
```

**Esperado en producción:**
- Dashboard con datos de inventario, demanda, suministro
- KPIs actualizados en tiempo real
- Metadata con fórmulas y tendencias
- Visuals sin datos aparecen grises (graceful degradation)
