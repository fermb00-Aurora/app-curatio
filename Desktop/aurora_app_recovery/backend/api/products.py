"""
backend/api/products.py — ficha detallada y escandallo de productos Aurora.

Implementa la lógica del escandallo descrita en
`Escandallo_Logica_Aurora.docx` / "Aurora I+D+i — Lógica del Escandallo de
Productos — Abril 2026".

ENDPOINTS
─────────
GET /api/product/{cod}/detail         → objeto Articulos enriquecido
GET /api/product/{cod}/escandallo     → receta + costes agregados (ver abajo)
GET /api/product/{cod}/raw            → [DEBUG] dump de Vis_MRH_EsquemaEscandallo
                                        + Articulos. Útil mientras resolvemos
                                        nombres reales de columnas.

CASCADA DE PRECIOS — POR COMPONENTE (5 niveles)
───────────────────────────────────────────────
  1. PrecioEscalado          VPR (MRH_ActivoFormulas=-1) — el tier más
                             bajo cuyo HastaUnidadesN >= cantidad.
  2. PrecioReposicionDirecto VPR activo sin tier (primer registro).
  3. PrecioUltimaCompra      Articulos.PrecioUltimaCompra.
  4. PrecioCambioCodigo      MovimientoStock, Serie='SGA-TR',
                             TipoMovimiento=1, el más reciente.
  5. CosteRecetaUnitario     SUM(Mat_Formula.Cantidad*Precio) / UnidadesEscandallo.

Cada nivel se consulta por separado y con try/except — si la tabla no
existe o tiene otro nombre en esta BD, simplemente ese nivel queda en
`None` y la cascada cae al siguiente.

CLASIFICACIÓN DE COMPONENTES
───────────────────────────
  material_auxiliar  CodigoFamilia == 4000
  bobina             descripción empieza por 'BOB' o 'BO.'
  formato_solido     descripción contiene CAPSULA/COMPRIMIDO/TABLETA/
                     SOFTGEL/GRAGEA
  mp                 resto (materia prima — entra en el amasijo)

AGREGADOS DEVUELTOS
──────────────────
  coste_amasijo         Σ(cantidad × precio) de MP
  coste_auxiliar        Σ de material_auxiliar
  coste_bobina          Σ de bobina
  coste_formato         Σ de formato_solido
  coste_amasijo_bobina  coste_amasijo + coste_auxiliar + coste_bobina + coste_formato
  kg_amasijo            Σ(cantidad) de MP (excluye formato_solido)
  numero_unidades       Articulos.MRH_UnidadesEscandallo (o equivalente)
  coste_unitario        coste_amasijo_bobina / numero_unidades
  coste_millar          coste_unitario × 1000
  pct_coste             por componente, sobre coste_amasijo_bobina
  cost_type             "MILLAR"|"BATCH"|"AMASIJO" — para el motor de precios
                        (derivado de MRH_VTipoReposicion o heurística)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from backend import state
from backend.db import mssql

log = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Clasificación de componentes
# ═══════════════════════════════════════════════════════════════════════════

_FORMATO_SOLIDO_TOKENS = (
    "CAPSULA", "CÁPSULA", "CAPS", "COMPRIMIDO", "TABLETA",
    "SOFTGEL", "GRAGEA",
)


def _classify_component(row: dict) -> str:
    """Devuelve el tipo del componente según la fila enriquecida."""
    cod_familia = row.get("CodigoFamilia")
    desc = (
        row.get("DescripcionArticuloComponente")
        or row.get("DescripcionComponente")
        or row.get("Descripcion")
        or ""
    ).upper()

    # CodigoFamilia puede venir como int, str o Decimal
    try:
        if cod_familia is not None and int(cod_familia) == 4000:
            return "material_auxiliar"
    except (TypeError, ValueError):
        pass

    if desc.startswith("BOB") or desc.startswith("BO."):
        return "bobina"
    if any(tok in desc for tok in _FORMATO_SOLIDO_TOKENS):
        return "formato_solido"
    return "mp"


# ═══════════════════════════════════════════════════════════════════════════
# Cascada de precios — cada nivel es una función independiente
# ═══════════════════════════════════════════════════════════════════════════

def _precio_escalado(cod_comp: str, cantidad: float) -> Optional[float]:
    """
    Nivel 1: VPR activo con tier.
    Escoge el primer escalón (menor HastaUnidadesN) que cubra la cantidad
    solicitada. Si ninguno cubre, devuelve el mayor escalón disponible.
    """
    if not cod_comp:
        return None
    try:
        # Tier que cubre la cantidad pedida
        row = mssql.fetch_one(
            "SELECT TOP 1 PrecioUnidad AS p "
            "FROM VariantesArticulo "
            "WHERE CodigoArticulo = ? "
            "  AND MRH_ActivoFormulas = -1 "
            "  AND (FechaDesde IS NULL OR FechaDesde <= GETDATE()) "
            "  AND (FechaHasta IS NULL OR FechaHasta >= GETDATE()) "
            "  AND HastaUnidadesN >= ? "
            "ORDER BY HastaUnidadesN ASC",
            (cod_comp, float(cantidad or 0)),
        )
        if row and row.get("p"):
            return float(row["p"])
    except Exception as e:
        log.debug("precio_escalado (tier ajustado) falló para %s: %s", cod_comp, e)
    return None


def _precio_vpr_directo(cod_comp: str) -> Optional[float]:
    """Nivel 2: VPR activo sin considerar tier — el primer registro vigente."""
    if not cod_comp:
        return None
    try:
        row = mssql.fetch_one(
            "SELECT TOP 1 PrecioUnidad AS p "
            "FROM VariantesArticulo "
            "WHERE CodigoArticulo = ? "
            "  AND MRH_ActivoFormulas = -1 "
            "  AND (FechaDesde IS NULL OR FechaDesde <= GETDATE()) "
            "  AND (FechaHasta IS NULL OR FechaHasta >= GETDATE()) "
            "ORDER BY HastaUnidadesN ASC",
            (cod_comp,),
        )
        if row and row.get("p"):
            return float(row["p"])
    except Exception as e:
        log.debug("precio_vpr_directo falló para %s: %s", cod_comp, e)
    return None


def _precio_ultima_compra(row_articulo: dict | None) -> Optional[float]:
    """Nivel 3: Articulos.PrecioUltimaCompra (ya vino en el JOIN)."""
    if not row_articulo:
        return None
    val = row_articulo.get("PrecioUltimaCompra")
    try:
        return float(val) if val and float(val) > 0 else None
    except (TypeError, ValueError):
        return None


def _precio_cambio_codigo(cod_comp: str) -> Optional[float]:
    """
    Nivel 4: último movimiento SGA-TR (cambio de código interno) del
    componente. Indica el coste con el que se dio de alta al cambiar de
    referencia. TipoMovimiento=1 es entrada según el doc.
    """
    if not cod_comp:
        return None
    try:
        row = mssql.fetch_one(
            "SELECT TOP 1 PrecioUnitario AS p "
            "FROM MovimientoStock "
            "WHERE CodigoArticulo = ? "
            "  AND SerieMovimiento = 'SGA-TR' "
            "  AND TipoMovimiento = 1 "
            "ORDER BY FechaMovimiento DESC",
            (cod_comp,),
        )
        if row and row.get("p"):
            return float(row["p"])
    except Exception as e:
        log.debug("precio_cambio_codigo falló para %s: %s", cod_comp, e)
    return None


def _precio_receta(cod_comp: str) -> Optional[float]:
    """
    Nivel 5: CosteRecetaUnitario — si el componente es semielaborado, el
    coste se calcula desde su propia receta en Mat_Formula.
        coste = Σ(Cantidad × Precio) / UnidadesEscandallo
    """
    if not cod_comp:
        return None
    try:
        row = mssql.fetch_one(
            "SELECT SUM(Cantidad * PrecioUnitario) / "
            "       NULLIF(MAX(UnidadesEscandallo), 0) AS p "
            "FROM Mat_Formula "
            "WHERE CodigoArticulo = ?",
            (cod_comp,),
        )
        if row and row.get("p"):
            return float(row["p"])
    except Exception as e:
        log.debug("precio_receta falló para %s: %s", cod_comp, e)
    return None


def _cascade(cod_comp: str, cantidad: float, row_art: dict | None
             ) -> tuple[Optional[float], str, dict]:
    """
    Aplica la cascada completa. Devuelve (precio, fuente, mapa_fuentes).

    Consulta los 5 niveles (en este orden) y elige el primero que tenga
    un valor > 0.
    """
    fuentes = {
        "escalado":       _precio_escalado(cod_comp, cantidad),
        "vpr_directo":    _precio_vpr_directo(cod_comp),
        "ultima_compra":  _precio_ultima_compra(row_art),
        "cambio_codigo":  _precio_cambio_codigo(cod_comp),
        "receta":         _precio_receta(cod_comp),
    }
    for key in ("escalado", "vpr_directo", "ultima_compra",
                "cambio_codigo", "receta"):
        v = fuentes[key]
        if v is not None and v > 0:
            return float(v), key, fuentes
    return None, "no_disponible", fuentes


# ═══════════════════════════════════════════════════════════════════════════
# Queries de componentes
# ═══════════════════════════════════════════════════════════════════════════

# Query canónica. Usa ROW_NUMBER() para quedarse solo con el registro más
# reciente por (CodigoArticulo, CodigoArticuloComponente), y hace LEFT JOIN
# con Articulos para traer CodigoFamilia + PrecioUltimaCompra en una sola
# pasada.
_SQL_COMPONENTES = """
WITH ranked AS (
    SELECT e.*,
           ROW_NUMBER() OVER (
               PARTITION BY e.CodigoArticulo, e.CodigoArticuloComponente
               ORDER BY e.FechaFormula DESC
           ) AS rn
    FROM Vis_MRH_EsquemaEscandallo e
    WHERE e.CodigoArticulo = ?
)
SELECT r.*,
       a.CodigoFamilia,
       a.PrecioUltimaCompra,
       a.DescripcionArticulo AS DescripcionArticuloJoin
FROM ranked r
LEFT JOIN Articulos a
       ON a.CodigoArticulo = r.CodigoArticuloComponente
WHERE r.rn = 1
ORDER BY r.OrdenEscandallo
"""

# Fallback sin ROW_NUMBER — por si la vista no tiene FechaFormula o la BD
# usa otro esquema que no nos deja particionar.
_SQL_COMPONENTES_FALLBACK = """
SELECT e.*,
       a.CodigoFamilia,
       a.PrecioUltimaCompra,
       a.DescripcionArticulo AS DescripcionArticuloJoin
FROM Vis_MRH_EsquemaEscandallo e
LEFT JOIN Articulos a
       ON a.CodigoArticulo = e.CodigoArticuloComponente
WHERE e.CodigoArticulo = ?
"""


def _fetch_componentes(cod: str) -> tuple[list[dict], Optional[str]]:
    """Devuelve (filas, error). error es None si la query canónica funcionó."""
    try:
        rows = mssql.fetch_all(_SQL_COMPONENTES, (cod,))
        return rows, None
    except Exception as e:
        err = str(e)
        log.warning("Escandallo query canónica falló para %s: %s", cod, err)
    try:
        rows = mssql.fetch_all(_SQL_COMPONENTES_FALLBACK, (cod,))
        return rows, None
    except Exception as e2:
        log.error("Escandallo fallback también falló para %s: %s", cod, e2)
        return [], str(e2)


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _enrich_product(row: dict) -> dict:
    cod = row.get("CodigoArticulo") or ""
    tipo = row.get("MRH_TipoProducto") or ""
    row["_is_k"] = cod.upper().startswith("K")
    row["_category"] = row.get("MRH_Categoria") or tipo or "Otros"
    return row


def _cost_type_for(head: dict, componentes: list[dict]) -> str:
    """
    Deduce cost_type para el motor de precios.
      0 → MILLAR  (barritas, cookies, galletas)
      1 → BATCH   (cápsulas, comprimidos, polvos)
      2 → AMASIJO (cremas, líquidos)
    """
    vtipo = head.get("MRH_VTipoReposicion")
    try:
        vtipo_i = int(vtipo) if vtipo is not None else None
    except (TypeError, ValueError):
        vtipo_i = None

    if vtipo_i == 0:
        return "MILLAR"
    if vtipo_i == 1:
        return "BATCH"
    if vtipo_i == 2:
        return "AMASIJO"

    # Heurística de respaldo — mira el tipo de producto + presencia de
    # formato sólido / material auxiliar entre los componentes.
    tipo_s = (head.get("MRH_TipoProducto") or "").lower()
    if any(k in tipo_s for k in ("barrita", "barra", "cookie", "galleta")):
        return "MILLAR"
    if any(k in tipo_s for k in ("capsula", "cápsula", "comprimido",
                                  "softgel", "tablet", "pastilla")):
        return "BATCH"
    has_fmt = any(c.get("tipo_componente") == "formato_solido"
                  for c in componentes)
    has_aux = any(c.get("tipo_componente") == "material_auxiliar"
                  for c in componentes)
    if has_fmt:
        return "BATCH"
    if has_aux:
        return "BATCH"
    return "AMASIJO"


def _num(x, default: float = 0.0) -> float:
    try:
        return float(x) if x is not None else default
    except (TypeError, ValueError):
        return default


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/products/escandallo-index")
def escandallo_index(
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
    q: Optional[str] = None,
):
    """
    Índice paginado de TODOS los productos que aparecen como CodigoArticulo
    en Vis_MRH_EsquemaEscandallo (es decir: productos con receta/escandallo).

    - page       : número de página (1-indexado)
    - per_page   : filas por página (default 15, max 100)
    - q          : filtro opcional (sub-string de CodigoArticulo o Descripción)

    Respuesta:
      {
        "page":       int,
        "per_page":   int,
        "total":      int,        # total de productos distintos con escandallo
        "pages":      int,        # ceil(total/per_page)
        "productos":  [
            {"codigo": str, "descripcion": str,
             "tipo_producto": str, "numero_unidades": int|None,
             "componentes_count": int}
        ]
      }

    Pensado para carga lazy — el frontend pide solo la página visible y el
    desplegable de cada fila llama a `/api/product/{cod}/escandallo` bajo
    demanda.
    """
    # Cache por (page, per_page, q) — 5 min, evita repetir COUNT grandes.
    cache_key = f"esc_index:{page}:{per_page}:{q or ''}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    where_sql = ""
    params: list[Any] = []
    # Filtro por familia: solo MMP (3000) y mmaux (4000)
    familia_filter = " (a.CodigoFamilia = 3000 OR a.CodigoFamilia = 4000)"
    where_sql = f" WHERE {familia_filter}"

    if q and q.strip():
        like = f"%{q.strip()}%"
        where_sql += (
            " AND (v.CodigoArticulo LIKE ? OR "
            "      a.DescripcionArticulo LIKE ?)"
        )
        params.extend([like, like])

    # ── Total (count distinct) ──────────────────────────────────────────────
    try:
        count_row = mssql.fetch_one(
            "SELECT COUNT(*) AS n FROM ("
            "  SELECT DISTINCT v.CodigoArticulo "
            "  FROM Vis_MRH_EsquemaEscandallo v "
            "  LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
            f" {where_sql}"
            ") t",
            params,
        )
        total = int((count_row or {}).get("n", 0) or 0)
    except Exception as e:
        return {
            "error":     f"No se pudo contar productos con escandallo: {e}",
            "page":      page,
            "per_page":  per_page,
            "total":     0,
            "pages":     0,
            "productos": [],
        }

    if total == 0:
        result = {
            "page":      page,
            "per_page":  per_page,
            "total":     0,
            "pages":     0,
            "productos": [],
        }
        state.set_cached(cache_key, result, "filters")
        return result

    # ── Página actual ───────────────────────────────────────────────────────
    offset = (page - 1) * per_page
    pages = (total + per_page - 1) // per_page

    # Query: agrupamos por CodigoArticulo para tener componentes_count y
    # luego JOIN con Articulos para datos humanos.
    try:
        rows = mssql.fetch_all(
            "SELECT v.CodigoArticulo AS codigo, "
            "       a.DescripcionArticulo AS descripcion, "
            "       a.MRH_TipoProducto AS tipo_producto, "
            "       a.MRH_UnidadesEscandallo AS numero_unidades, "
            "       COUNT(*) AS componentes_count "
            "FROM Vis_MRH_EsquemaEscandallo v "
            "LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
            f"{where_sql} "
            "GROUP BY v.CodigoArticulo, a.DescripcionArticulo, "
            "         a.MRH_TipoProducto, a.MRH_UnidadesEscandallo "
            "ORDER BY v.CodigoArticulo "
            "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            params + [offset, per_page],
        )
    except Exception as e:
        # Fallback sin MRH_UnidadesEscandallo por si no existe la columna
        log.warning("escandallo_index query canónica falló: %s", e)
        try:
            rows = mssql.fetch_all(
                "SELECT v.CodigoArticulo AS codigo, "
                "       a.DescripcionArticulo AS descripcion, "
                "       a.MRH_TipoProducto AS tipo_producto, "
                "       COUNT(*) AS componentes_count "
                "FROM Vis_MRH_EsquemaEscandallo v "
                "LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
                f"{where_sql} "
                "GROUP BY v.CodigoArticulo, a.DescripcionArticulo, "
                "         a.MRH_TipoProducto "
                "ORDER BY v.CodigoArticulo "
                "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                params + [offset, per_page],
            )
            for r in rows:
                r["numero_unidades"] = None
        except Exception as e2:
            return {
                "error":     f"Query de página falló: {e2}",
                "page":      page,
                "per_page":  per_page,
                "total":     total,
                "pages":     pages,
                "productos": [],
            }

    # Normalizar numero_unidades a int o None
    productos = []
    for r in rows:
        nu = r.get("numero_unidades")
        try:
            nu_int = int(nu) if nu not in (None, "", 0) else None
        except (TypeError, ValueError):
            nu_int = None
        productos.append({
            "codigo":             r.get("codigo"),
            "descripcion":        r.get("descripcion") or "(sin descripción)",
            "tipo_producto":      r.get("tipo_producto") or "",
            "numero_unidades":    nu_int,
            "componentes_count":  int(r.get("componentes_count") or 0),
        })

    result = {
        "page":      page,
        "per_page":  per_page,
        "total":     total,
        "pages":     pages,
        "productos": productos,
    }
    state.set_cached(cache_key, result, "filters")
    return result


@router.get("/product/{cod}/detail")
def detail(cod: str):
    """Ficha detallada (todos los campos MRH_* de Articulos + enrich)."""
    cache_key = f"product:{cod}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        row = mssql.fetch_one(
            "SELECT * FROM Articulos WHERE CodigoArticulo = ?",
            (cod,),
        )
    except Exception as e:
        return {"error": str(e)}
    if not row:
        raise HTTPException(status_code=404, detail="producto no encontrado")

    enriched = _enrich_product(row)
    state.set_cached(cache_key, enriched, "product")
    return enriched


@router.get("/product/{cod}/escandallo")
def escandallo(cod: str):
    """
    Escandallo completo con cascada de precios y agregados. Cacheado a
    30 min (state.CACHE_TTL['escandallo']) porque son muchas queries.
    """
    cache_key = f"escandallo:{cod}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    # ── Cabecera ────────────────────────────────────────────────────────────
    try:
        head = mssql.fetch_one(
            "SELECT CodigoArticulo, DescripcionArticulo, MRH_TipoProducto, "
            "       MRH_UnidadesEscandallo, MRH_VTipoReposicion, "
            "       MRH_PesoOptimo, MRH_PesoUnidad "
            "FROM Articulos WHERE CodigoArticulo = ?",
            (cod,),
        )
    except Exception as e:
        # Si MRH_UnidadesEscandallo o MRH_VTipoReposicion no existen,
        # hacemos un SELECT * defensivo.
        log.warning("Cabecera restringida falló (%s). Uso SELECT *.", e)
        try:
            head = mssql.fetch_one(
                "SELECT * FROM Articulos WHERE CodigoArticulo = ?", (cod,),
            )
        except Exception as e2:
            return {"error": f"No se pudo leer la cabecera: {e2}",
                    "componentes": []}

    if not head:
        raise HTTPException(status_code=404, detail="producto no encontrado")

    # ── Componentes ─────────────────────────────────────────────────────────
    filas, err = _fetch_componentes(cod)
    if err and not filas:
        return {
            "error":            f"No se pudo leer el escandallo: {err}",
            "codigo":           cod,
            "descripcion":      head.get("DescripcionArticulo"),
            "tipo_producto":    head.get("MRH_TipoProducto"),
            "componentes":      [],
            "coste_amasijo":    0,
            "numero_unidades":  None,
        }

    # ── Construir componentes con cascada ───────────────────────────────────
    componentes: list[dict] = []
    for row in filas:
        cod_comp = (
            row.get("CodigoArticuloComponente")
            or row.get("CodigoComponente")
            or ""
        )
        desc = (
            row.get("DescripcionArticuloComponente")
            or row.get("DescripcionArticuloJoin")
            or row.get("DescripcionComponente")
            or ""
        )
        # Cantidad y unidad — el nombre real puede variar
        cantidad = _num(
            row.get("UnidadesEscandallo")
            or row.get("Cantidad")
            or row.get("cantidad")
            or 0
        )
        unidad = (
            row.get("UnidadMedidaEscandallo")
            or row.get("UnidadMedida")
            or row.get("unidad")
        )
        orden = row.get("OrdenEscandallo") or row.get("Orden") or 0

        precio, fuente, fuentes = _cascade(cod_comp, cantidad, row)
        tipo_c = _classify_component(row)
        subtotal = (precio or 0.0) * cantidad

        componentes.append({
            "codigo":          cod_comp,
            "descripcion":     desc,
            "cantidad":        cantidad,
            "unidad":          unidad,
            "precio":          precio,
            "precio_fuente":   fuente,
            "tipo_componente": tipo_c,
            "subtotal":        round(subtotal, 6),
            "codigo_familia":  row.get("CodigoFamilia"),
            "orden":           orden,
            # Exposición de las 5 fuentes — útil para depurar en la UI
            "_fuentes":        fuentes,
        })

    # Ordenar por OrdenEscandallo si existe, si no por subtotal desc
    try:
        componentes.sort(key=lambda c: (int(c.get("orden") or 0), c["codigo"]))
    except Exception:
        componentes.sort(key=lambda c: -c["subtotal"])

    # ── Agregados ───────────────────────────────────────────────────────────
    def _sum(pred):
        return round(sum(c["subtotal"] for c in componentes if pred(c)), 6)

    coste_amasijo  = _sum(lambda c: c["tipo_componente"] == "mp")
    coste_auxiliar = _sum(lambda c: c["tipo_componente"] == "material_auxiliar")
    coste_bobina   = _sum(lambda c: c["tipo_componente"] == "bobina")
    coste_formato  = _sum(lambda c: c["tipo_componente"] == "formato_solido")

    # kg_amasijo es la masa física — excluye formato sólido (cápsulas vacías
    # no suman masa al amasijo) y excluye también material auxiliar / bobina.
    kg_amasijo = round(
        sum(c["cantidad"] for c in componentes
            if c["tipo_componente"] == "mp"),
        6,
    )

    coste_amasijo_bobina = round(
        coste_amasijo + coste_auxiliar + coste_bobina + coste_formato, 6
    )

    # Número de unidades del lote
    numero_unidades = head.get("MRH_UnidadesEscandallo")
    try:
        numero_unidades = (
            int(numero_unidades)
            if numero_unidades not in (None, "", 0) else None
        )
    except (TypeError, ValueError):
        numero_unidades = None

    coste_unitario = (
        round(coste_amasijo_bobina / numero_unidades, 6)
        if numero_unidades and numero_unidades > 0 else None
    )
    coste_millar = (
        round(coste_unitario * 1000, 6) if coste_unitario else None
    )

    # Porcentaje por componente
    if coste_amasijo_bobina > 0:
        for c in componentes:
            c["pct_coste"] = round(
                (c["subtotal"] / coste_amasijo_bobina) * 100, 3
            )
    else:
        for c in componentes:
            c["pct_coste"] = None

    # ── Tipo de coste para el motor de precios ──────────────────────────────
    cost_type = _cost_type_for(head, componentes)

    # ── Resumen de debug (cuántos componentes cayeron a cada nivel) ─────────
    fuentes_count: dict[str, int] = {}
    for c in componentes:
        fuentes_count[c["precio_fuente"]] = fuentes_count.get(
            c["precio_fuente"], 0
        ) + 1

    result = {
        # Cabecera
        "codigo":               head.get("CodigoArticulo"),
        "descripcion":          head.get("DescripcionArticulo"),
        "tipo_producto":        head.get("MRH_TipoProducto"),
        "vtipo_reposicion":     head.get("MRH_VTipoReposicion"),
        "cost_type":            cost_type,
        # Peso y datos para motor de precios
        "peso_optimo":          head.get("MRH_PesoOptimo"),
        "peso_unidad":          head.get("MRH_PesoUnidad"),
        # Componentes
        "componentes":          componentes,
        # Agregados de coste
        "coste_amasijo":        coste_amasijo,
        "coste_auxiliar":       coste_auxiliar,
        "coste_bobina":         coste_bobina,
        "coste_formato":        coste_formato,
        "coste_amasijo_bobina": coste_amasijo_bobina,
        "kg_amasijo":           kg_amasijo,
        # Datos del lote
        "numero_unidades":      numero_unidades,
        "coste_unitario":       coste_unitario,
        "coste_millar":         coste_millar,
        # Debug
        "_fuentes_count":       fuentes_count,
        "_total_componentes":   len(componentes),
    }

    state.set_cached(cache_key, result, "escandallo")
    return result


@router.get("/product/{cod}/raw")
def escandallo_raw(cod: str):
    """
    [DEBUG] Volcado crudo. Expone qué columnas existen realmente en
    Vis_MRH_EsquemaEscandallo y Articulos para el código dado. Úsalo
    para diagnosticar si alguna columna en la cascada tiene otro nombre.
    """
    out: dict[str, Any] = {"codigo": cod}

    try:
        out["articulo"] = mssql.fetch_one(
            "SELECT * FROM Articulos WHERE CodigoArticulo = ?", (cod,),
        )
    except Exception as e:
        out["articulo_error"] = str(e)

    try:
        out["escandallo"] = mssql.fetch_all(
            "SELECT TOP 50 * FROM Vis_MRH_EsquemaEscandallo "
            "WHERE CodigoArticulo = ?",
            (cod,),
        )
    except Exception as e:
        out["escandallo_error"] = str(e)

    # Probar cada tabla de la cascada con TOP 1 para ver si existe y qué
    # columnas tiene.
    out["cascada_probes"] = {}
    probes = {
        "VariantesArticulo": "SELECT TOP 1 * FROM VariantesArticulo",
        "MovimientoStock":   "SELECT TOP 1 * FROM MovimientoStock",
        "Mat_Formula":       "SELECT TOP 1 * FROM Mat_Formula",
    }
    for name, sql in probes.items():
        try:
            row = mssql.fetch_one(sql)
            out["cascada_probes"][name] = {
                "ok": True,
                "columnas": list(row.keys()) if row else [],
            }
        except Exception as e:
            out["cascada_probes"][name] = {"ok": False, "error": str(e)}

    return out
