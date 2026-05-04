# Aurora App — Guía del sistema

Buscador-escandallador del catálogo I+D+i de Aurora Corp. FastAPI + uvicorn, frontend estático (`frontend/index.html`).

---

## 1. Arquitectura

```
frontend/index.html → FastAPI (backend/main.py)
  ├── api/filters.py   → categorizer.py → MySQL (tipos, precios)
  ├── api/search.py    → profiles.py    → SQL Server (Articulos, …)
  ├── api/products.py  → escandallo     → SQL Server + MySQL
  └── api/prices.py    → motor PHP (10.10.4.175)
```

**Doble BD:**
| BD | Rol | Tablas clave |
|----|-----|-------------|
| **SQL Server** (Sage) | Fuente de verdad del producto | `Articulos` (267 cols), `Vis_MRH_EsquemaEscandallo`, `VArticuloAlergenos`, `Vis_MRH_ArticulosAlergenos`, `ConcentracionCompuestosAF`, `Mat_Formula`, `VPreciosReposicion` |
| **MySQL** (`precios`) | Taxonomía + precios manuales | `tipos` (árbol vía `id_padre`), `precios` |

Conexiones: `backend/config.py` + `.env` → `backend/db/mssql.py` (pyodbc) + `backend/db/precios.py` (pymysql).

**Schema real — trampas conocidas:**
- `Articulos` NO tiene macros estructurados (solo `VValoresNutricionales` texto libre) ni certificaciones bool.
- Físico real: `PesoBrutoUnitario_`, `PesoNetoUnitario_`, `PesoPlastico`, `VolumenUnitario_`, `Colores_`.
- Vitaminas/minerales: `ConcentracionCompuestosAF` filtrado por `TipoCompuesto`.
- Alérgenos: `VArticuloAlergenos` con convención mixta (ver §5).
- `gluten_free`: solo de `Vis_MRH_ArticulosAlergenos.AptoGlutenFree`.
- `VTipoReposicion` vive en `VPreciosReposicion`, NO en `Articulos`.
- `MovimientoStock` (sin prefijo MRH_) no existe → Nivel 4 escandallo es no-op.

---

## 2. Fuentes de datos por producto

```
CodigoArticulo
  ├── Articulos              → descripción, físico, VValoresNutricionales
  ├── VArticuloAlergenos     → 14 alérgenos UE (moderno + legacy)
  ├── Vis_MRH_ArticulosAlergenos → gluten_free (AptoGlutenFree)
  ├── ConcentracionCompuestosAF  → vitaminas + minerales (%VRN)
  ├── precios.precios        → id_tipo → categoría
  └── DescripcionArticulo    → sabores (flavors.py regex)
```

Todo unificado por `backend/profiles.py`.

---

## 3. Endpoints

| Endpoint | Módulo | Notas |
|----------|--------|-------|
| `GET /api/categories` | `filters.py` + `categorizer.py` | Árbol MySQL `tipos` con conteos reales |
| `GET /api/filters/vitaminas\|minerales\|alergenos\|tags` | `filters.py` | Alérgenos: lista fija en `config.py::ALLERGEN_MASTER` |
| `GET /api/products?...` | `search.py` | Filtro por categoría vía `categorizer.codigos_en_categoria()` → IN clause |
| `GET /api/product/{cod}/detail` | `products.py` | `profiles.enrich_one` + caché 3 min |
| `GET /api/product/{cod}/escandallo` | `products.py` | Cascada 5 niveles, caché 30 min. **No tocar sin leer docstring.** |
| `GET /api/search/suggest?q=` | `search.py` | Autocomplete CodigoArticulo + Descripcion |
| `POST /api/prices/calcular` | `prices.py` | Proxy puro al motor PHP; no short-circuit |

---

## 4. Categorizer (`backend/categorizer.py`)

TTL 10 min. Produce `CAT_TREE` y `CODIGO_MAP` (codigo → `{cat_slug, subcat_slug, source}`).

**Pipeline (primer hit gana):**
| Canal | Fuente | source |
|-------|--------|--------|
| 0 | `precios.id_tipo` (ground-truth) | `"precios"` |
| 1 | Prefijo alfanumérico auto-aprendido (2-6 chars) | `"prefix"` |
| 2 | `(CodigoFamilia, TipoArticulo)` auto-aprendido | `"familia"` |
| 3 | Regex sobre `DescripcionArticulo` (`_DESC_RULES`, ≥45 reglas) | `"desc"` |
| 4 | Fallback → `sin_clasificar` (🗂️) | `"none"` |

Umbrales canales 1/2: `_MIN_PUREZA=0.70`, `_MIN_SAMPLES=5`, prefijos `(6,5,4,3,2)`. NO hay mapping hard-coded de prefijos.

API: `get_tree()`, `get_codigo_map()`, `get_coverage_stats()`, `codigos_en_categoria(cat,sub=None)`, `classify_one(cod,…)`, `invalidate()`.

---

## 5. Profiles (`backend/profiles.py`)

API: `enrich_one(row)`, `enrich_many(rows)`, `coverage_report(sample_size)`. Batch ≤500 códigos por IN-clause (límite SQL Server 2100 params). 4 batch queries en `enrich_many`.

**Columnas clave (único lugar donde renombrarlas):**
```python
_FISICO_COLUMNS = [
    ("peso_bruto_u","PesoBrutoUnitario_"), ("peso_neto_u","PesoNetoUnitario_"),
    ("peso_plastico","PesoPlastico"), ("volumen_unit","VolumenUnitario_"), ("colores_code","Colores_"),
]
_MACRO_COLUMNS = []          # sin columnas estructuradas — VValoresNutricionales es texto
_CERT_COLUMNS  = {}          # sin bools en Articulos; gluten_free vía vista aparte
_ARTICULOS_PROFILE_COLS = "CodigoArticulo, DescripcionArticulo, TipoArticulo, CodigoFamilia, VCodigoMarca, VConAlergenos, VAlergenos, VConservacion, VValoresNutricionales, PesoBrutoUnitario_, PesoNetoUnitario_, PesoPlastico, VolumenUnitario_, Colores_, PrecioCompra, VUnidadesAmasijo"
```

Claves legacy (`macros.*`, `fisico.peso_optimo`, `certificaciones.vegano/halal/kosher`, …) se exponen a `None`/`False` por compat frontend.

---

## 6. Alérgenos (`VArticuloAlergenos`)

Convención mixta — precedencia en `_fetch_alergenos`:
1. `MRH_PropiedadAlergeno ∈ {-1,1}` → usar directo.
2. `VNoAlergeno == -1` → skip.
3. `VContieneAlergeno == -1` → `propiedad=-1` (contiene).
4. `VTRazasAlergeno == -1` → `propiedad=1` (trazas).

Output: `-1`=contiene (rojo), `1`=trazas (amarillo). IDs 1-14 son los estándar UE; >14 se conservan con `VDescripcionAlergeno`.

---

## 7. Sabores (`backend/flavors.py`)

~85 slugs canónicos + `ABBREV_FLAVOR` (2-4 letras Aurora: `cch`, `van`, `frb`, …). Regex con word-boundary estrictos. Variantes <4 chars van por canal abreviaturas.

API: `detect(desc)`, `detect_compound(desc)` → `{primary, secondary, all, labels, display, is_compound}`, `label_for(slug)`.

---

## 8. Escandallo (`/api/product/{cod}/escandallo`)

Cascada **5 niveles** por componente (1 query batch por nivel, ~4-5 queries total independientemente de N componentes):

| Nivel | Fuente | Query |
|-------|--------|-------|
| 1 | PrecioEscalado VPR — tier por cantidad | `_fetch_vpr_batch` (VPreciosReposicion formato wide `HastaUnidades1..10`+`Precio1..10`) |
| 2 | PrecioReposicion directo — primer precio>0 de la fila VPR | ídem |
| 3 | PrecioUltimaCompra — `Vis_MRH_EsquemaEscandallo.PrecioUltimaCompra` → `Articulos.PrecioCompra` → batch fallback | `_fetch_ultima_compra_batch` |
| 4 | PrecioCambioCodigo — **NO IMPLEMENTABLE** (tabla `MovimientoStock` sin schema correcto) | no-op, devuelve `{}` |
| 5 | CosteRecetaUnitario — `SUM(UnidadesNecesarias×CosteUnitario)/UnidadesEscandallo` desde `Mat_Formula` | `_fetch_receta_batch` |

**VPR — política de fecha vigente:**
```sql
WHERE FechaDesde IS NOT NULL AND FechaDesde <= GETDATE()
  AND (FechaHasta IS NULL OR FechaHasta >= GETDATE())
```
(eliminado `MRH_ActivoFormulas=-1`).

**Diferenciación LB/K:** `_select_vpr_row_for(rows, parent_vtipo)` prefiere la fila cuyo `VTipoReposicion` coincide con el del padre. `parent_vtipo` se obtiene por prioridad:
1. Fila VPR propia del producto padre (raro en productos terminados — ningún K* ni LB* tiene fila VPR).
2. Inferencia por prefijo: `K*` → vtipo=0 (MILLAR), `LB*` → vtipo=1 (BATCH). Implementado en `_infer_parent_vtipo()`. Confirmado mayo 2026: todos los 11322 productos con escandallo son K* o LB*. Sin este fallback `parent_vtipo` sería siempre None y 176 MPs con precios distintos por vtipo (impacto hasta ±150%, ej. chocolates) darían precio incorrecto.
3. None → fallback a fila VPR más reciente.

**Clasificación de componentes:**
- `material_auxiliar`: `CodigoFamilia==4000`
- `bobina`: desc empieza por `BOB`/`BO.`
- `formato_solido`: desc contiene CAPSULA/COMPRIMIDO/TABLETA/SOFTGEL/GRAGEA
- `mp`: resto (entra en amasijo)

**AMASIJO Teórico** (`_fetch_amasijo_teorico` — cascada 3 niveles):
1. `idtool.form_cabecera_formulas`: `UnidadesEscandallo × PesoUnitarioPieza / 1000` (NETO, coincide herramienta PHP).
2. `form_cabecera_formulas.VkilosAmasijo` (BRUTO, fallback).
3. `Articulos.VUnidadesAmasijo × PesoNetoUnitario_` (fallback 2, e.g. K44995 sin fila idtool).

**Coste:** siempre algorítmico (cascada VPR/UC/Receta sobre `Vis_MRH_EsquemaEscandallo`). Sin override manual de `precios.precios`. El helper `_fetch_coste_manual_vigente()` está definido pero no se llama en producción (solo scripts de diagnóstico).

**App vs herramienta PHP:** la app es estimador técnico independiente; la herramienta PHP es el registrador comercial autoritativo. Diferencias en PRECIO/PACK (~10%) son intencionales — el motor PHP omite `gastos_marketing`+`ecoembes` en modo `crea_precio=false`.

---

## 9. Performance (Plan B)

| Sub-plan | Qué hace | Dónde |
|----------|----------|-------|
| B.3 | Column projection (`_ARTICULOS_PROFILE_COLS`) en `/detail` — fallback a `SELECT *` si falla | `products.py::_fetch_articulo_row` |
| B.4 | Caché TTL en memoria: `/detail` 3 min, `/escandallo` 30 min | `backend/state.py` |
| B.5 | `GZipMiddleware(minimum_size=512)` | `backend/main.py` |
| B.6 | `search.py` sin columnas inexistentes; filtros huérfanos en `_ignored_filters` | `backend/api/search.py` |
| B.7 | DDL recomendado (no auto-ejecutado) | `backend/db/indexes.sql` |
| B.8 | Warm-up startup: `categorizer.get_tree()` en background | `backend/main.py::_warmup` |

---

## 10. Frontend (`frontend/index.html`)

Vanilla JS. Carga `/api/categories` + `/api/filters/*` al montar. Escandallo lazy-load (`toggleCardEsc` — solo al abrir tarjeta).

Campos consumidos: `CodigoArticulo`, `DescripcionArticulo`, `categoria.{cat_name,subcat_name}`, `sabores.{display,is_compound}`, `fisico.*`, `certificaciones.gluten_free`, `alergenos[]`, `vitaminas[]`, `minerales[]`. Los `null` se ocultan silenciosamente.

---

## 11. Auditoría

```bash
python tests/unified_audit.py              # QA primario (Plan A+B)
python tests/unified_audit.py --no-cascade # rápido, sin escandallo
python tests/integration_audit.py          # granular legacy
python tests/integration_audit.py --codigo K44995  # perfil individual
python tests/integration_audit.py --discover       # introspección schema
python tests/prefix_audit.py              # diagnóstico canal 1
python tests/diag_amasijo_teorico.py      # debug peso teórico (default K44995)
python tests/diag_coste_disparidad.py     # debug coste vs herramienta
python tests/diag_motor_full.py           # debug motor PHP vs precios.precios
```

Ejecutar `unified_audit.py` tras cualquier cambio en `categorizer.py`, `profiles.py`, `flavors.py`, `products.py`, `search.py` o columnas de BD. Output: `tests/output/unified_audit_output.txt`.

---

## 12. Setup local

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
# .env con AURORA_DB_HOST/USER/PASS/NAME + PRECIOS_DB_HOST=10.10.4.175/USER/PASS/NAME=precios
python tests/integration_audit.py         # valida integraciones
python -m uvicorn backend.main:app --reload --port 8001
```

---

## 13. Reglas de mantenimiento

- Actualizar este doc al añadir/eliminar endpoints, renombrar columnas, añadir sabores/certificaciones, cambiar lógica de escandallo.
- Los nombres de columna **solo** se tocan en `profiles.py` (`_MACRO_COLUMNS`, `_FISICO_COLUMNS`, `_CERT_COLUMNS`, `_ARTICULOS_PROFILE_COLS`).
- Historial detallado de cambios: ver `git log` — el log de commits es la fuente autoritativa del historial.
