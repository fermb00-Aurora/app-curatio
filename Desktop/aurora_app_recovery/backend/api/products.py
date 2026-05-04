"""
backend/api/products.py — ficha detallada y escandallo de productos Aurora.

Implementa la lógica del escandallo descrita en
`Escandallo_Logica_Aurora.docx` / "Aurora I+D+i — Lógica del Escandallo de
Productos — Abril 2026".

ENDPOINTS
─────────
GET /api/products/escandallo-index    → índice paginado con conteos
GET /api/products/index-completo      → variante enriquecida
GET /api/product/{cod}/detail         → objeto Articulos enriquecido
GET /api/product/{cod}/escandallo     → receta + costes agregados (ver abajo)
GET /api/product/{cod}/raw            → [DEBUG] dump de Vis_MRH_EsquemaEscandallo
                                        + Articulos. Útil para depurar schemas.

CASCADA DE PRECIOS — POR COMPONENTE (5 niveles, ahora en BATCH)
───────────────────────────────────────────────────────────────
  1. PrecioEscalado          VPR (VPreciosReposicion), tier `HastaUnidadesN`
                             que cubre la cantidad. Formato wide de 10
                             pares desnormalizado en memoria.
  2. PrecioReposicionDirecto VPR sin considerar tier (menor precio > 0).
  3. PrecioUltimaCompra      Articulos.PrecioCompra del componente
                             (JOIN con Articulos). El schema real NO
                             tiene una columna llamada exactamente
                             `PrecioUltimaCompra`; `PrecioCompra` es la
                             más cercana semánticamente y sirve como
                             referencia del último coste registrado.
  4. PrecioCambioCodigo      MovimientoStock Serie='SGA-TR', TipoMovimiento=1,
                             más reciente.
  5. CosteRecetaUnitario     Σ(Cantidad·PrecioUnitario) / UnidadesEscandallo
                             sobre Mat_Formula del propio componente.

Política de filtrado VPR (cambios Plan B.1 — abr 2026):
  • Se ELIMINA el filtro por la columna MRH_ActivoFormulas (que antes
    exigía el valor -1). La bandera se imputaba manualmente sólo en
    algunas fórmulas, por lo que excluía filas válidas.
  • Fechas — ahora la regla es:
        FechaDesde IS NULL           → fila inválida (se descarta)
        FechaDesde <= GETDATE()
        (FechaHasta IS NULL OR FechaHasta >= GETDATE()) → fila vigente
  • Diferenciación LB/K — cuando el producto padre tiene `VTipoReposicion`
    conocido, se prefiere la fila VPR del componente que comparte ese
    `VTipoReposicion` sobre otras filas con distinto. Si no hay match,
    fallback a la fila más reciente por `FechaDesde`.

Batch:
  · Se hace UNA query por nivel para TODOS los componentes del escandallo
    en curso (≈ 4 queries por endpoint en vez de 5·N).
  · Límite prudente de 1.500 parámetros por chunk IN (SQL Server admite 2.100).

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
  numero_unidades       Articulos.VUnidadesAmasijo (o equivalente)
  coste_unitario        coste_amasijo_bobina / numero_unidades
  coste_millar          coste_unitario × 1000
  pct_coste             por componente, sobre coste_amasijo_bobina
  cost_type             "MILLAR"|"BATCH"|"AMASIJO" — derivado del
                        VTipoReposicion del padre (vía su propia fila
                        en VPreciosReposicion, no de Articulos) o de
                        heurística textual sobre TipoArticulo.
"""
from __future__ import annotations

import logging
from typing import Any, Iterable, Optional

from fastapi import APIRouter, HTTPException, Query

from backend import profiles, state
from backend.db import mssql

log = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Utilidades de batch
# ═══════════════════════════════════════════════════════════════════════════

_MAX_IN_PARAMS = 1500  # SQL Server admite hasta ~2100, dejamos margen


def _in_placeholders(n: int) -> str:
    return ",".join(["?"] * n)


def _chunks(seq: list, size: int = _MAX_IN_PARAMS) -> Iterable[list]:
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _int_or_none(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _num(x, default: float = 0.0) -> float:
    try:
        return float(x) if x is not None else default
    except (TypeError, ValueError):
        return default


# ═══════════════════════════════════════════════════════════════════════════
# Clasificación de componentes
# ═══════════════════════════════════════════════════════════════════════════

_FORMATO_SOLIDO_TOKENS = (
    "CAPSULA", "CÁPSULA", "CAPS", "COMPRIMIDO", "TABLETA",
    "SOFTGEL", "GRAGEA",
)


def _classify_component(row: dict) -> str:
    """Devuelve el tipo del componente según la fila enriquecida.

    Convención Aurora (confirmada por el usuario 2026-04-23):
      - CodigoFamilia 3000 → "mp"              (materia prima)
      - CodigoFamilia 4000 → "material_auxiliar"
      - Cualquier otra familia → clasificación por descripción:
          bobina   (desc empieza por BOB / BO.)
          formato_solido  (CAPSULA/COMPRIMIDO/TABLETA/SOFTGEL/GRAGEA)
          mp       (fallback)
    """
    cod_familia = row.get("CodigoFamilia")
    try:
        fam_int = int(cod_familia) if cod_familia is not None else None
    except (TypeError, ValueError):
        fam_int = None

    if fam_int == 3000:
        return "mp"
    if fam_int == 4000:
        return "material_auxiliar"

    desc = (
        row.get("DescripcionArticuloComponente")
        or row.get("DescripcionArticuloJoin")
        or row.get("DescripcionArticulo")
        or row.get("DescripcionComponente")
        or row.get("Descripcion")
        or ""
    ).upper()

    if desc.startswith("BOB") or desc.startswith("BO."):
        return "bobina"
    if any(tok in desc for tok in _FORMATO_SOLIDO_TOKENS):
        return "formato_solido"
    return "mp"


# ═══════════════════════════════════════════════════════════════════════════
# VPR (VPreciosReposicion) — lectura wide + desnormalización
# ═══════════════════════════════════════════════════════════════════════════
#
# La tabla real es `VPreciosReposicion` (la antigua `VariantesArticulo` no
# existe en este schema). El formato es *wide*: 10 tiers codificados como
# columnas `HastaUnidades1..HastaUnidades10` + `Precio1..Precio10`. Puede
# haber varias filas por (CodigoArticulo) con diferente `VTipoReposicion`
# — eso permite que la misma materia prima tenga distinto precio según el
# contexto del producto padre (p.ej. LB vs K). La selección se hace en
# `_select_vpr_row_for`.

_VPR_TIER_COLS = ", ".join(
    f"HastaUnidades{i}, Precio{i}" for i in range(1, 11)
)

_VPR_BASE_COLS = "CodigoArticulo, VTipoReposicion, FechaDesde, FechaHasta"


def _fetch_vpr_batch(codigos: list[str]) -> dict[str, list[dict]]:
    """Lee VPreciosReposicion para todos los `codigos` en una query (chunks).

    Aplica la regla de fechas vigente Plan B.1:
        · FechaDesde IS NOT NULL
        · FechaDesde <= GETDATE()
        · (FechaHasta IS NULL OR FechaHasta >= GETDATE())
    La columna MRH_ActivoFormulas NO se filtra (ver docstring del módulo).

    Devuelve {cod: [row1, row2, ...]} ordenadas por FechaDesde DESC, con
    todas las filas vigentes. La selección del "mejor" row para cada
    componente (según VTipoReposicion del padre) se hace en
    `_select_vpr_row_for`.
    """
    out: dict[str, list[dict]] = {}
    if not codigos:
        return out
    codigos = [c for c in codigos if c]  # dedupe-friendly, no None
    for chunk in _chunks(codigos):
        sql = (
            f"SELECT {_VPR_BASE_COLS}, {_VPR_TIER_COLS} "
            f"FROM VPreciosReposicion "
            f"WHERE CodigoArticulo IN ({_in_placeholders(len(chunk))}) "
            f"  AND FechaDesde IS NOT NULL "
            f"  AND FechaDesde <= GETDATE() "
            f"  AND (FechaHasta IS NULL OR FechaHasta >= GETDATE()) "
            f"ORDER BY FechaDesde DESC"
        )
        try:
            rows = mssql.fetch_all(sql, chunk)
        except Exception as e:
            log.warning("VPR batch falló para chunk de %d codigos: %s",
                        len(chunk), e)
            continue
        for r in rows:
            cod = r.get("CodigoArticulo")
            if not cod:
                continue
            out.setdefault(cod, []).append(r)
    return out


def _select_vpr_row_for(rows: list[dict],
                        parent_vtipo: int | None) -> dict | None:
    """De una lista de filas VPR vigentes para un mismo CodigoArticulo,
    escoge la "mejor" según la preferencia:
        1) Fila cuyo VTipoReposicion == parent_vtipo (si se pasa).
        2) Fila más reciente por FechaDesde (la primera, ya vienen DESC).
    """
    if not rows:
        return None
    if parent_vtipo is not None:
        matches = [r for r in rows
                   if _int_or_none(r.get("VTipoReposicion")) == parent_vtipo]
        if matches:
            return matches[0]
    return rows[0]


# Mapeado confirmado por exploración de BD (mayo 2026):
# - Todos los productos terminados son K* o LB* (0 excepciones sobre 11322 escandallo).
# - Ningún producto terminado tiene fila en VPreciosReposicion, por lo que
#   parent_vtipo siempre sería None sin este fallback.
# - VTipoReposicion=0 → precio MILLAR (usado en productos K*)
# - VTipoReposicion=1 → precio BATCH/LB (usado en productos LB*)
_VTIPO_BY_PREFIX: list[tuple[str, int]] = [
    ("LB", 1),  # BATCH — prefijo más específico primero
    ("K",  0),  # MILLAR
]


def _infer_parent_vtipo(cod: str) -> int | None:
    """Infiere VTipoReposicion del producto padre desde el prefijo del código.
    Devuelve None si no hay match (fallback a fila VPR más reciente).
    """
    up = (cod or "").upper()
    for prefix, vtipo in _VTIPO_BY_PREFIX:
        if up.startswith(prefix):
            return vtipo
    return None


def _extract_vpr_tiers(row: dict | None) -> list[tuple[float, float]]:
    """Desnormaliza los 10 pares wide a [(limite, precio), ...] ordenados
    por límite ascendente. Descarta tiers con Precio<=0. Los catch-all
    (HastaUnidadesN=0, Precio>0) reciben límite=+∞ para sortarlos al final,
    de modo que los tiers específicos se evalúen primero.
    """
    if not row:
        return []
    tiers: list[tuple[float, float]] = []
    for i in range(1, 11):
        lim_raw = row.get(f"HastaUnidades{i}")
        pr_raw = row.get(f"Precio{i}")
        try:
            pr = float(pr_raw) if pr_raw is not None else 0.0
        except (TypeError, ValueError):
            continue
        if pr <= 0:
            continue
        try:
            lim = float(lim_raw) if lim_raw is not None else 0.0
        except (TypeError, ValueError):
            lim = 0.0
        tiers.append((lim, pr))
    tiers.sort(key=lambda t: (t[0] if t[0] > 0 else float("inf"), t[1]))
    return tiers


def _precio_escalado_from_tiers(tiers: list[tuple[float, float]],
                                cantidad: float) -> Optional[float]:
    """Nivel 1. Escoge el primer escalón (menor HastaUnidadesN) que cubra
    la cantidad solicitada. Si ninguno cubre, devuelve el mayor."""
    if not tiers:
        return None
    try:
        qty = float(cantidad or 0)
    except (TypeError, ValueError):
        qty = 0.0
    for lim, pr in tiers:
        if lim <= 0 or lim >= qty or lim == float("inf"):
            return pr
    return tiers[-1][1]


def _precio_vpr_directo_from_tiers(tiers: list[tuple[float, float]]
                                   ) -> Optional[float]:
    """Nivel 2. Primer precio > 0 del registro vigente."""
    return tiers[0][1] if tiers else None


# ═══════════════════════════════════════════════════════════════════════════
# Cascada — batches para niveles 3, 4, 5
# ═══════════════════════════════════════════════════════════════════════════

def _fetch_ultima_compra_batch(codigos: list[str]) -> dict[str, float]:
    """Nivel 3. Lee Articulos.PrecioCompra para `codigos` en batch.

    Nota (abr 2026, post-discover): el schema real de Articulos NO tiene
    una columna llamada literalmente `PrecioUltimaCompra`. La más cercana
    semánticamente es `PrecioCompra` (decimal). El nombre de la función
    se conserva por claridad de lectura respecto del documento original
    del escandallo (que hablaba de "precio de última compra").
    """
    out: dict[str, float] = {}
    if not codigos:
        return out
    for chunk in _chunks([c for c in codigos if c]):
        sql = (
            "SELECT CodigoArticulo, PrecioCompra "
            "FROM Articulos "
            f"WHERE CodigoArticulo IN ({_in_placeholders(len(chunk))})"
        )
        try:
            rows = mssql.fetch_all(sql, chunk)
        except Exception as e:
            log.warning("ultima_compra batch falló: %s", e)
            continue
        for r in rows:
            cod = r.get("CodigoArticulo")
            val = r.get("PrecioCompra")
            try:
                f = float(val) if val is not None else 0.0
            except (TypeError, ValueError):
                f = 0.0
            if cod and f > 0:
                out[cod] = f
    return out


def _fetch_cambio_codigo_batch(codigos: list[str]) -> dict[str, float]:
    """Nivel 4 — PrecioCambioCodigo.

    **No implementable en el schema actual (abr 2026).**

    El documento original `Escandallo_Logica_Aurora.docx` describe este
    nivel como "último `MovimientoStock` con `SerieMovimiento='SGA-TR'`
    y `TipoMovimiento=1`, valor tomado de `PrecioUnitario`". Pero la
    exploración con `integration_audit.py --discover` demuestra que:

      · NO existe una tabla `MovimientoStock` (sin prefijo) en este
        schema. La tabla más cercana es `MRH_MovimientosStock` (61
        filas) que NO contiene `SerieMovimiento`, ni `PrecioUnitario`,
        ni `FechaMovimiento`. Sólo `TipoMovimiento`, `Unidades`,
        `FechaRegistro`, `CodigoArticulo`.
      · Tampoco existe ninguna tabla que combine `SerieMovimiento='SGA-TR'`
        con un precio asociado. La serie `SGA-TR` no aparece como
        literal en ningún sample del discover.

    Por tanto el nivel se degrada a no-op: devuelve siempre un dict
    vacío y cada componente pasa del Nivel 3 (PrecioCompra) directamente
    al Nivel 5 (CosteRecetaUnitario) si Nivel 3 no aporta. Cuando el
    DBA confirme la tabla real que materializa el cambio de código
    (p. ej. una vista `Vis_MRH_CambioCodigo` futura) basta con rellenar
    esta función — la cascada ya contempla su hueco.
    """
    # Nota: recibimos `codigos` por compat con el flujo `escandallo()`;
    # no los usamos para evitar generar queries inválidas.
    _ = codigos
    return {}


def _fetch_receta_batch(codigos: list[str]) -> dict[str, float]:
    """Nivel 5. CosteRecetaUnitario batch desde Mat_Formula.

    Fórmula (verificada contra el schema real, abr 2026):
        coste = Σ(UnidadesNecesarias · CosteUnitario) / UnidadesEscandallo

    Columnas reales (no inventar más):
      · UnidadesNecesarias   (equivale al "Cantidad" del docstring original)
      · CosteUnitario        (equivale al "PrecioUnitario" del docstring)
      · UnidadesEscandallo   (denominador: unidades producidas del padre)

    `Mat_Formula` también expone `CosteComponente` como acumulado ya
    calculado (UnidadesNecesarias·CosteUnitario con mermas aplicadas en
    algunos casos); se prefiere calcular en memoria para mantener la
    semántica documentada.
    """
    out: dict[str, float] = {}
    if not codigos:
        return out
    for chunk in _chunks([c for c in codigos if c]):
        sql = (
            "SELECT CodigoArticulo, "
            "       SUM(UnidadesNecesarias * CosteUnitario) AS acum, "
            "       MAX(UnidadesEscandallo) AS ue "
            "FROM Mat_Formula "
            f"WHERE CodigoArticulo IN ({_in_placeholders(len(chunk))}) "
            "GROUP BY CodigoArticulo"
        )
        try:
            rows = mssql.fetch_all(sql, chunk)
        except Exception as e:
            log.warning("receta batch falló: %s", e)
            continue
        for r in rows:
            cod = r.get("CodigoArticulo")
            acum = _num(r.get("acum"))
            ue = _num(r.get("ue"))
            if cod and acum > 0 and ue > 0:
                out[cod] = acum / ue
    return out


def _cascade_from_batches(
    cod_comp: str,
    cantidad: float,
    vpr_row: dict | None,
    ultima_compra: float | None,
    cambio_codigo: float | None,
    receta: float | None,
) -> tuple[Optional[float], str, dict]:
    """Evalúa la cascada usando datos ya pre-fetcheados en batch."""
    tiers = _extract_vpr_tiers(vpr_row)
    fuentes = {
        "escalado":      _precio_escalado_from_tiers(tiers, cantidad),
        "vpr_directo":   _precio_vpr_directo_from_tiers(tiers),
        "ultima_compra": ultima_compra if (ultima_compra or 0) > 0 else None,
        "cambio_codigo": cambio_codigo if (cambio_codigo or 0) > 0 else None,
        "receta":        receta if (receta or 0) > 0 else None,
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
# reciente por (CodigoArticulo, ArticuloComponente), y hace LEFT JOIN
# con Articulos para traer CodigoFamilia + PrecioCompra del componente
# en una sola pasada.
#
# Nota (abr 2026, post-discover): Articulos NO tiene las columnas
# `PrecioUltimaCompra` ni `VTipoReposicion` ni `MRH_VTipoReposicion`
# en el schema real. Sin embargo, la **vista**
# `Vis_MRH_EsquemaEscandallo` SÍ expone `PrecioUltimaCompra` (valor
# precalculado por Sage al materializar el escandallo) — ese es el
# valor preferente para Nivel 3. Como red de seguridad adicional
# hacemos JOIN con `Articulos.PrecioCompra` (coste de la última
# compra registrada del artículo, fallback).
# El `VTipoReposicion` del padre se deriva después de su VPR row, no
# de Articulos, dentro del endpoint `escandallo()`.
_SQL_COMPONENTES = """
WITH ranked AS (
    SELECT e.*,
           ROW_NUMBER() OVER (
               PARTITION BY e.CodigoArticulo, e.ArticuloComponente
               ORDER BY e.fechaRegistro DESC
           ) AS rn
    FROM Vis_MRH_EsquemaEscandallo e
    WHERE e.CodigoArticulo = ?
)
SELECT r.*,
       a.CodigoFamilia,
       a.PrecioCompra,
       a.DescripcionArticulo AS DescripcionArticuloJoin
FROM ranked r
LEFT JOIN Articulos a
       ON a.CodigoArticulo = r.ArticuloComponente
WHERE r.rn = 1
ORDER BY r.Orden
"""

# Fallback sin ROW_NUMBER — por si la vista no tiene fechaRegistro.
_SQL_COMPONENTES_FALLBACK = """
SELECT e.*,
       a.CodigoFamilia,
       a.PrecioCompra
FROM Vis_MRH_EsquemaEscandallo e
LEFT JOIN Articulos a
       ON a.CodigoArticulo = e.ArticuloComponente
WHERE e.CodigoArticulo = ?
ORDER BY e.Orden
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
# Helpers de enriquecimiento
# ═══════════════════════════════════════════════════════════════════════════

def _enrich_product(row: dict) -> dict:
    """Enriquece un producto con el perfil completo (ver backend.profiles)."""
    return profiles.enrich_one(row)


# ═══════════════════════════════════════════════════════════════════════════
# Mapa de TIPO de coste desde idtool.form_cabecera_formulas
# ═══════════════════════════════════════════════════════════════════════════
#
# Cada LB/K tiene asignada una `Linea` de producción (varchar, prefijo
# de 2-3 caracteres + descripción) y un `Grupo`. Esos campos son la
# fuente de verdad — cada línea implica un tipo canónico de coste:
#
#   CA  = Cápsulas/comprimidos        → MILLAR
#   CR  = Cremas                       → BATCH
#   CAN = Polvo en canister            → BATCH
#   DD  = Polvo en doypack             → BATCH
#   DE  = Polvo en sobres              → BATCH
#   DJ  = Polvo en botes               → BATCH
#   DS  = Polvo en stick               → BATCH
#   FJ  = Flapjack                     → MILLAR
#   GE  = Geles planos (sobre)         → MILLAR
#   GS  = Geles stick                  → MILLAR
#   JB  = Gominolas                    → MILLAR
#   L1  = Barritas con baño            → MILLAR
#   L2  = Barritas sin baño            → MILLAR
#   VI  = Viales                       → MILLAR
#   1   = Batidos (polvo líquido)      → BATCH
#
# Fallback: campo `Grupo` (30.3 POLVOS, 30.1 BARRITAS, etc.). Último
# recurso: heurística por texto. La tabla tiene ~5500 filas, cacheamos
# el dict completo en memoria (TTL 1 h — datos estables).

_LINEA_PREFIX_TYPE: dict[str, str] = {
    "CA":  "MILLAR",
    "CR":  "BATCH",
    "CAN": "BATCH",
    "DD":  "BATCH",
    "DE":  "BATCH",
    "DJ":  "BATCH",
    "DS":  "BATCH",
    "FJ":  "MILLAR",
    "GE":  "MILLAR",
    "GS":  "MILLAR",
    "JB":  "MILLAR",
    "L1":  "MILLAR",
    "L2":  "MILLAR",
    "VI":  "MILLAR",
    "1":   "BATCH",
}

_GRUPO_TOKEN_TYPE: dict[str, str] = {
    "POLVOS":       "BATCH",
    "POLVO":        "BATCH",
    "BATIDOS":      "BATCH",
    "BARRITAS":     "MILLAR",
    "CAPSULAS":     "MILLAR",
    "CÁPSULAS":     "MILLAR",
    "COMPRIMIDOS":  "MILLAR",
    "GOMINOLAS":    "MILLAR",
    "FLAPJACKS":    "MILLAR",
    "VIALES":       "MILLAR",
    "GELES":        "MILLAR",
    "CREMAS":       "BATCH",
}

_fab_type_cache: dict = {"ts": 0, "map": None}
_FAB_TYPE_TTL = 3600  # 1 h


# Tokens del nombre de tipo en MySQL `precios.tipos.tipo`. Ejemplos:
#   'Polvos doypack - 1kg 100kg amasijo'  → BATCH (polvo)
#   'Caps, Comp y Tab en bote 20kg'       → MILLAR
#   'Flapjack'                             → MILLAR
#   'Gominolas'                            → MILLAR
#   'Cremas Stick'                         → BATCH
#   'Perlas botes de 60 y 90'              → MILLAR
# Orden: más específico primero.
_TIPOS_NAME_TOKENS: list[tuple[tuple[str, ...], str]] = [
    # MILLAR — formatos contables por pieza
    (("barrit", "flapjack", "bocadito", "bolita"),            "MILLAR"),
    (("gomin",),                                               "MILLAR"),
    (("c\u00e1psul", "capsul", "comprimid", "tableta",
      "perla", "blister", "grage"),                            "MILLAR"),
    (("smoothie",),                                            "MILLAR"),
    (("gel ", " gel", "vial"),                                 "MILLAR"),
    # BATCH — polvos, cremas, porridges
    (("polvo", "porridge", "sachet", "doypack", "canister",
      "bolsa 15kg", "envasado directo"),                       "BATCH"),
    (("crema",),                                               "BATCH"),
    (("batido",),                                              "BATCH"),
]


def _classify_by_tipo_name(nombre: str) -> str | None:
    n = (nombre or "").lower()
    if not n:
        return None
    for toks, t in _TIPOS_NAME_TOKENS:
        if any(tok in n for tok in toks):
            return t
    return None


def _load_fabrication_type_map() -> dict[str, str]:
    """Devuelve dict[codigo → tipo] con tipo ∈ {AMASIJO, BATCH, MILLAR}.

    **Fuente primaria y autoritativa**: `precios.tipos.tipo_producto`
    (MySQL), el mismo campo que el motor PHP `api_precios.php` usa
    internamente para decidir qué fórmula aplicar. Mapeo directo:

        tipo_producto = 1 → AMASIJO
          (Barritas, Geles, Gominolas, Smoothies, Flapjacks, Bolas,
          Grageados, Cookies, Bocaditos — productos contables
          fabricados en un amasijo de lote)
        tipo_producto = 2 → BATCH
          (Polvos, Cremas, Porridge, Botellas, Cremas Stick,
          Crunchy — productos pesables en envase)
        tipo_producto = 3 → MILLAR
          (Cápsulas, Comprimidos, Tabletas, Perlas, Blisters —
          productos en bote medidos por tabs/pills)

    Resolución por código: `precios.precios.codigo → id_tipo →
    precios.tipos.tipo_producto` con última versión vigente.

    **Fuente secundaria** (fallback si el código no está en
    `precios.precios`): `idtool.form_cabecera_formulas.Linea/Grupo`
    con mapeo por prefijo de línea de producción.

    Cacheado en memoria (TTL 1 h).
    """
    import time as _t
    now = _t.time()
    if _fab_type_cache["map"] and (now - _fab_type_cache["ts"]) < _FAB_TYPE_TTL:
        return _fab_type_cache["map"]

    out: dict[str, str] = {}
    _TP_MAP = {1: "AMASIJO", 2: "BATCH", 3: "MILLAR"}

    # ── Fuente PRIMARIA: precios.tipos.tipo_producto ──────────────
    from backend.db import precios as _precios
    if _precios.is_available():
        try:
            # tipo_id → tipo_producto
            tipos = _precios.fetch_all(
                "SELECT id, tipo_producto FROM tipos "
                "WHERE deleted_at IS NULL AND tipo_producto IS NOT NULL"
            )
            tp_by_id: dict[int, int] = {}
            for t in tipos:
                try:
                    tp_by_id[int(t["id"])] = int(t["tipo_producto"])
                except (TypeError, ValueError):
                    pass

            # Última fila vigente por código → id_tipo → tipo_producto
            filas = _precios.fetch_all(
                "SELECT p.codigo, p.id_tipo "
                "FROM precios p "
                "INNER JOIN ("
                "  SELECT codigo, MAX(fecha) AS f "
                "  FROM precios WHERE deleted_at IS NULL "
                "  GROUP BY codigo) lx "
                "  ON lx.codigo = p.codigo AND lx.f = p.fecha "
                "WHERE p.deleted_at IS NULL"
            )
            added = 0
            for r in filas:
                cod = (r.get("codigo") or "").strip()
                if not cod:
                    continue
                tid = r.get("id_tipo")
                try:
                    tid = int(tid) if tid is not None else None
                except (TypeError, ValueError):
                    tid = None
                if tid is None:
                    continue
                tp = tp_by_id.get(tid)
                canon = _TP_MAP.get(tp) if tp is not None else None
                if canon:
                    out[cod] = canon
                    added += 1
            log.info("fab_map fuente precios.tipos.tipo_producto: %d productos",
                     added)
        except Exception as e:
            log.warning("fab_map fuente precios.tipos falló: %s", e)

    # ── Fuente SECUNDARIA: idtool.form_cabecera_formulas.Linea/Grupo ──
    # Rellena sólo los códigos que no estaban en precios.precios.
    from backend.db import idtool as _idtool
    if _idtool.is_available():
        import re as _re
        try:
            rows = _idtool.fetch_all(
                "SELECT f.CodigoArticulo AS cod, f.Linea, f.Grupo "
                "FROM form_cabecera_formulas f "
                "INNER JOIN ("
                "  SELECT CodigoArticulo, MAX(version) AS v "
                "  FROM form_cabecera_formulas "
                "  WHERE CodigoArticulo IS NOT NULL "
                "  GROUP BY CodigoArticulo) lx "
                "  ON lx.CodigoArticulo = f.CodigoArticulo "
                "  AND lx.v = f.version"
            )
            added2 = 0
            for r in rows:
                cod = (r.get("cod") or "").strip()
                if not cod or cod in out:
                    continue
                linea = (r.get("Linea") or "").strip()
                grupo = (r.get("Grupo") or "").strip()
                tipo: str | None = None
                if linea:
                    m = _re.match(r"^([A-Z0-9]+)\s*[-\u2013:]", linea)
                    pref = m.group(1) if m else linea.split()[0]
                    tipo = _LINEA_PREFIX_TYPE.get(pref.upper())
                if tipo is None and grupo:
                    up = grupo.upper()
                    for tok, t in _GRUPO_TOKEN_TYPE.items():
                        if tok in up:
                            tipo = t
                            break
                # IMPORTANTE: mapeo Linea/Grupo se hizo pensando en la
                # semántica vieja (barritas=MILLAR, polvos=BATCH). Ahora
                # que sabemos que barritas son AMASIJO por la BD, hay
                # que corregir: MILLAR de la capa Linea es en realidad
                # AMASIJO en la convención precios.tipos.tipo_producto.
                # BATCH y AMASIJO se mantienen.
                if tipo == "MILLAR":
                    # Si la línea es CA (cápsulas), sí es MILLAR real.
                    if linea.upper().startswith("CA"):
                        pass  # mantener MILLAR
                    else:
                        tipo = "AMASIJO"  # barritas/geles/gominolas
                if tipo:
                    out[cod] = tipo
                    added2 += 1
            log.info("fab_map fuente idtool (fallback): +%d productos",
                     added2)
        except Exception as e:
            log.warning("fab_map fuente idtool falló: %s", e)

    _fab_type_cache["map"] = out
    _fab_type_cache["ts"] = now
    log.info("fabrication_type_map: total %d productos mapeados",
             len(out))
    return out


def _cost_type_for(head: dict,
                   componentes: list[dict],
                   parent_vtipo: int | None = None) -> str:
    """
    Deduce cost_type para el motor de precios (PHP api_precios.php).

    La API del motor mapea tipo 1/2/3 a concepts Aurora:
      tipo 1 = AMASIJO  — sólo coste_amasijo (granel puro).
      tipo 2 = BATCH    — coste_amasijo (=Coste BATCH) + peso_grs
                          (=Peso BOTE en g) + peso_amasijo (=PESO BATCH
                          en kg). Polvos en doypack, botes, cremas.
      tipo 3 = MILLAR   — tabspills (tabs o pills/bote) + coste_millar.
                          Barritas, cápsulas, gominolas, flapjacks —
                          cualquier pieza contable discreta.

    El tipo NO vive en BD explícitamente — lo derivamos con esta heurística:

      0.  `parent_vtipo` (si el padre tiene VPR) manda: 0→MILLAR,
          1→BATCH, 2→AMASIJO. Raro en productos terminados; fiable en
          materias primas.

      1.  Texto del TipoArticulo + DescripcionArticulo. Palabras como
          "barrita", "bar", "flapjack", "FJ.", "cookie", "gomin",
          "cápsul", "comprimid", "softgel", "perla", "gragea",
          "pastilla", "wafer", "chew" → MILLAR. Regex con word-boundary
          para evitar falsos positivos.

      2.  Componentes con tipo_componente == "formato_solido" (la
          fórmula consume cápsulas/comprimidos como ingrediente) →
          MILLAR.

      3.  Material auxiliar (fam=4000) o bobina entre los componentes,
          o `VUnidadesAmasijo > 1` (nº packs por batch) → BATCH
          (producto pesable envasado).

      4.  Ninguna señal → AMASIJO (granel puro, producción intermedia).

    La heurística vieja `uds/kg > 5 → MILLAR` se quitó (abr 2026) porque
    daba falsos positivos con polvos en sobres pequeños (LBAU13718:
    whey en doypacks de 35g, 8k unidades/batch pero es BATCH real).
    """
    # 0. Fuente PRIMARIA: idtool.form_cabecera_formulas.Linea/Grupo.
    # Cada LB/K tiene su línea de producción registrada ahí. Es el dato
    # fundamentado que el usuario pidió usar en lugar de regex.
    cod_padre = (head.get("CodigoArticulo") or "").strip()
    if cod_padre:
        fab_map = _load_fabrication_type_map()
        t = fab_map.get(cod_padre)
        if t:
            return t

    # 1. Si el padre es una materia prima con VPR propio, usa su
    # VTipoReposicion (raro para productos terminados).
    if parent_vtipo == 0:
        return "MILLAR"
    if parent_vtipo == 1:
        return "BATCH"
    if parent_vtipo == 2:
        return "AMASIJO"

    # 2. Texto combinado del padre (fallback último)
    tipo_s = (head.get("TipoArticulo") or "").lower()
    desc_s = (head.get("DescripcionArticulo") or "").lower()
    texto  = f"{tipo_s} {desc_s}"

    import re as _re
    # Nomenclatura alineada con precios.tipos.tipo_producto:
    #   MILLAR (3)  = sólo cápsulas, comprimidos, tabletas, perlas
    #   AMASIJO (1) = barritas, geles, gominolas, flapjacks, cookies,
    #                 smoothies, bolas, grageados
    #   BATCH (2)   = polvos, cremas, batidos, porridge
    _millar_re = _re.compile(
        r"\b(c[aá]psul|comprimid|softgel|tablet|perla|gragea|"
        r"pastilla|blister)"
    )
    if _millar_re.search(texto):
        return "MILLAR"

    _amasijo_re = _re.compile(
        r"\b(barrit|barra|bar\b|flapjack|fj\.|fj\b|cookie|galleta|"
        r"gomin|gummy|bomb[oó]n|jelly|wafer|chew|bocadito|"
        r"gel\b|gel[-_ ]|shot\b|vial|bolit|grageado|smoothie)"
    )
    if _amasijo_re.search(texto):
        return "AMASIJO"

    _batch_re = _re.compile(
        r"\b(whey|isolate|concentrate|caseina|case[ií]n|prote[ií]n|"
        r"shake|batido|porridge|polvo|powder|mix\b|blend|"
        r"crema\b|crema[-_]|spread|doypack|sobre\b|sachet|canister|"
        r"bote\b|jar)"
    )
    if _batch_re.search(texto):
        return "BATCH"

    # 2. Componentes: formato_solido → MILLAR
    has_fmt = any(c.get("tipo_componente") == "formato_solido"
                  for c in componentes)
    if has_fmt:
        return "MILLAR"

    # 3. Material auxiliar / bobina / VUnidadesAmasijo > 1 → BATCH
    has_aux = any(c.get("tipo_componente") == "material_auxiliar"
                  for c in componentes)
    has_bob = any(c.get("tipo_componente") == "bobina"
                  for c in componentes)
    try:
        uds = int(head.get("VUnidadesAmasijo") or 0)
    except (TypeError, ValueError):
        uds = 0
    if has_aux or has_bob or uds > 1:
        return "BATCH"

    # 4. Fallback: granel puro
    return "AMASIJO"


def cost_type_to_tipo_int(cost_type: str) -> int:
    """Mapea el label Aurora al parámetro `tipo` que espera
    `api_precios.php`: AMASIJO→1, BATCH→2, MILLAR→3.
    """
    m = {"AMASIJO": 1, "BATCH": 2, "MILLAR": 3}
    return m.get((cost_type or "").upper(), 1)


# ═══════════════════════════════════════════════════════════════════════════
# AMASIJO TEÓRICO — peso declarado y peso unidad (para dimensionar uds reales)
# ═══════════════════════════════════════════════════════════════════════════
#
# Para productos cost_type=AMASIJO (barritas, geles, gominolas, flapjacks,
# cookies, smoothies) necesitamos distinguir dos escenarios:
#
#   • AMASIJO TEÓRICO = peso del amasijo declarado en la ficha de
#     producción (`form_cabecera_formulas.VkilosAmasijo` en idtool MySQL).
#     Es el peso objetivo del lote — lo que deberías obtener SI no hubiera
#     mermas, ajustes ni variación respecto al diseño de la fórmula.
#
#   • AMASIJO REAL    = Σ(cantidad_kg de las MP del escandallo).
#     Es lo que sale de agregar las materias primas tal cual están en
#     Vis_MRH_EsquemaEscandallo en el momento actual.
#
# Las unidades producidas se CALCULAN SIEMPRE (no se leen de
# VUnidadesAmasijo, por decisión del usuario — puede no estar
# actualizado o ser el valor teórico): uds = kg_amasijo * 1000 /
# peso_unidad_gr. Por eso necesitamos peso_unidad_gr fiable.
#
# Fuentes de `peso_unidad_gr` (en orden de preferencia):
#   1. idtool.form_cabecera_formulas.PesoUnitarioPieza  (gramos/pieza)
#   2. idtool.ficha_tec_caracteristicas.peso_unidad      (texto "40g"...
#      parseado a número)
#   3. Articulos.PesoNetoUnitario_  (kg, * 1000 → gramos)
#
# Si ninguna de las tres devuelve un valor > 0, `peso_unidad_gr` = None y
# no se puede calcular uds_real ni uds_teor → el endpoint devuelve ambas
# tarjetas con `None` y la UI debe pintar "Dato faltante: peso unidad".

def _parse_num_txt(v) -> float | None:
    """Parsea un texto como "40g", "1,5 g", " 40 " a float (ignora
    sufijos alfabéticos). Devuelve None si no hay número > 0."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if float(v) > 0 else None
    s = str(v).strip().replace(",", ".")
    if not s:
        return None
    import re as _re
    m = _re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
    if not m:
        return None
    try:
        f = float(m.group(1))
        return f if f > 0 else None
    except ValueError:
        return None


def _fetch_amasijo_teorico(cod: str) -> dict:
    """Lee peso_amasijo_teor_kg y peso_unidad_gr desde idtool + Articulos.

    Devuelve un dict con claves `peso_amasijo_teor_kg`, `peso_unidad_gr`,
    `_teor_source` (qué tabla ganó) y `_punid_source`. Cualquiera puede
    ser None si no hay dato. Ambas lecturas son independientes:
    puede haber peso teor y no peso unidad, o al revés.

    CONVENCIÓN DE PESO TEÓRICO — alineada con la herramienta PHP de precios
    ────────────────────────────────────────────────────────────────────
    `form_cabecera_formulas` expone DOS magnitudes que pueden parecer la
    misma pero no lo son:

      A) `VkilosAmasijo`                    → peso BRUTO del amasijo
                                              cargado en masa cruda
                                              (incluye merma de proceso,
                                              recortes, roturas).
      B) `UnidadesEscandallo × PesoUnitarioPieza / 1000`
           (equivalente a VUnidadesAmasijo × PesoUnitarioPieza / 1000
            cuando ambas columnas coinciden, que es el caso habitual)
                                            → peso NETO empaquetable
                                              (producto terminado
                                              efectivamente vendible).

    Ejemplo real: LBAU18987T148AVV-40 tiene `VkilosAmasijo = 70 kg`
    (masa cruda cargada) pero `1.662 uds × 40 g / 1000 = 66.48 kg` de
    producto empaquetable — la diferencia (~5%) es merma de proceso.

    La herramienta PHP de precios (`api_precios.php`) divide el coste
    total entre las unidades que se envasan, no entre los kg de masa
    cruda, así que su noción de "peso amasijo" es la **neta**
    empaquetable (B). Este helper sigue esa convención.

    Cascada completa de fuentes (en orden de prioridad descendente):

      1. idtool.form_cabecera_formulas — PRIMARIO:
         UnidadesEscandallo × PesoUnitarioPieza / 1000.

      2. idtool.form_cabecera_formulas — FALLBACK 1:
         VkilosAmasijo (peso bruto, incluye merma — usado sólo cuando
         el PRIMARIO no puede calcularse por columnas vacías).

      3. Articulos — FALLBACK 2:
         VUnidadesAmasijo × PesoNetoUnitario_ (peso neto empaquetable).
         Activa cuando idtool no tiene fila para el código (típico de
         productos K* dados de alta en Sage pero no en idtool —
         caso K44995 detectado abr 2026 vía
         tests/diag_amasijo_teorico.py). Mismo principio que el
         PRIMARIO pero leyendo de SQL Server.
    """
    out = {
        "peso_amasijo_teor_kg": None,
        "peso_unidad_gr":       None,
        "_teor_source":         None,
        "_punid_source":        None,
    }

    # ── idtool.form_cabecera_formulas (última version) ─────────────
    try:
        from backend.db import idtool as _idtool
        if _idtool.is_available():
            row = _idtool.fetch_one(
                "SELECT f.VkilosAmasijo, f.PesoUnitarioPieza, f.PesoNetoPieza, "
                "       f.UnidadesEscandallo, f.VUnidadesAmasijo, f.UnidadesCalculo "
                "FROM form_cabecera_formulas f "
                "INNER JOIN ("
                "  SELECT CodigoArticulo, MAX(version) AS v "
                "  FROM form_cabecera_formulas "
                "  WHERE CodigoArticulo = %s "
                "  GROUP BY CodigoArticulo) lx "
                "  ON lx.CodigoArticulo = f.CodigoArticulo "
                "  AND lx.v = f.version",
                (cod,),
            )
            if row:
                pu = _parse_num_txt(row.get("PesoUnitarioPieza"))
                if pu is not None:
                    out["peso_unidad_gr"] = pu
                    out["_punid_source"] = "form_cabecera_formulas.PesoUnitarioPieza"

                # PRIMARIO: UnidadesEscandallo × PesoUnitarioPieza / 1000
                # (peso neto empaquetable, lo que usa la herramienta PHP)
                # Cascada de fallback para "unidades teóricas":
                #   UnidadesEscandallo → VUnidadesAmasijo → UnidadesCalculo
                uds_teor = (
                    _parse_num_txt(row.get("UnidadesEscandallo"))
                    or _parse_num_txt(row.get("VUnidadesAmasijo"))
                    or _parse_num_txt(row.get("UnidadesCalculo"))
                )
                if uds_teor is not None and pu is not None:
                    # Redondeo a 4 decimales — evita drift por fp
                    out["peso_amasijo_teor_kg"] = round(uds_teor * pu / 1000.0, 4)
                    out["_teor_source"] = (
                        "form_cabecera_formulas "
                        "(UnidadesEscandallo × PesoUnitarioPieza / 1000)"
                    )
                else:
                    # FALLBACK: VkilosAmasijo (peso bruto). Se usa sólo
                    # si no llegan UnidadesEscandallo o PesoUnitarioPieza.
                    # Menos preciso porque incluye merma, pero mejor que
                    # devolver None cuando el producto es legítimo.
                    kg_bruto = _parse_num_txt(row.get("VkilosAmasijo"))
                    if kg_bruto is not None:
                        out["peso_amasijo_teor_kg"] = kg_bruto
                        out["_teor_source"] = (
                            "form_cabecera_formulas.VkilosAmasijo "
                            "(fallback: peso bruto, incluye merma)"
                        )
    except Exception as e:
        log.warning("amasijo_teorico idtool falló para %s: %s", cod, e)

    # ── Fallback peso_unidad: ficha_tec_caracteristicas.peso_unidad ─
    if out["peso_unidad_gr"] is None:
        try:
            from backend.db import idtool as _idtool
            if _idtool.is_available():
                row = _idtool.fetch_one(
                    "SELECT car.peso_unidad "
                    "FROM ficha_tec_cabecera cab "
                    "INNER JOIN ("
                    "  SELECT cod_producto, MAX(version_ficha) AS v "
                    "  FROM ficha_tec_cabecera "
                    "  WHERE cod_producto = %s AND deleted_at IS NULL "
                    "  GROUP BY cod_producto) lx "
                    "  ON lx.cod_producto = cab.cod_producto "
                    "  AND lx.v = cab.version_ficha "
                    "LEFT JOIN ficha_tec_caracteristicas car "
                    "  ON car.id_ficha = cab.id_ficha "
                    "  AND car.version_ficha = cab.version_ficha "
                    "  AND car.deleted_at IS NULL "
                    "WHERE cab.deleted_at IS NULL "
                    "LIMIT 1",
                    (cod,),
                )
                if row:
                    pu = _parse_num_txt(row.get("peso_unidad"))
                    if pu is not None:
                        out["peso_unidad_gr"] = pu
                        out["_punid_source"] = "ficha_tec_caracteristicas.peso_unidad"
        except Exception as e:
            log.warning("amasijo_teorico ficha_tec falló para %s: %s", cod, e)

    # ── Fallback Articulos: peso amasijo teórico Y peso/unidad ─────
    #
    # Se activa cuando idtool.form_cabecera_formulas no tiene fila
    # para el código (caso típico: productos como K44995 que están
    # dados de alta en Sage pero NO en idtool — la "herramienta PHP"
    # api_precios.php los maneja igual leyendo de aquí).
    #
    # Calcula DOS cosas en una sola query:
    #
    #   (a) peso_amasijo_teor_kg = Articulos.VUnidadesAmasijo
    #                              × Articulos.PesoNetoUnitario_
    #
    #       Es el mismo principio que el PRIMARIO de idtool
    #       (UnidadesEscandallo × PesoUnitarioPieza / 1000) pero con
    #       columnas de Articulos. Devuelve peso NETO empaquetable
    #       (no incluye merma de proceso), alineado con la herramienta
    #       PHP. Verificado abr 2026 con K44995 vía
    #       tests/diag_amasijo_teorico.py:
    #         2100 × 0.030 = 63 kg = lo que muestra la herramienta.
    #
    #   (b) peso_unidad_gr = Articulos.PesoNetoUnitario_ × 1000
    #       (PesoNetoUnitario_ viene en kg en el schema real;
    #       lo convertimos a gramos para alinear con la convención
    #       del normalizador y de la UI).
    #
    # Cada uno se asigna sólo si NO ha sido resuelto antes por una
    # capa con más prioridad (idtool form_cabecera_formulas, o
    # ficha_tec_caracteristicas para peso_unidad).
    if out["peso_amasijo_teor_kg"] is None or out["peso_unidad_gr"] is None:
        try:
            row = mssql.fetch_one(
                "SELECT PesoNetoUnitario_, VUnidadesAmasijo "
                "FROM Articulos WHERE CodigoArticulo = ?",
                (cod,),
            )
            if row:
                pnu = _parse_num_txt(row.get("PesoNetoUnitario_"))   # kg
                vua = _parse_num_txt(row.get("VUnidadesAmasijo"))    # unidades

                # (a) Peso amasijo teórico — peso NETO empaquetable
                if (
                    out["peso_amasijo_teor_kg"] is None
                    and pnu is not None
                    and vua is not None
                ):
                    out["peso_amasijo_teor_kg"] = round(pnu * vua, 4)
                    out["_teor_source"] = (
                        "Articulos (VUnidadesAmasijo × PesoNetoUnitario_)"
                    )

                # (b) Peso unidad — kg → gramos
                if out["peso_unidad_gr"] is None and pnu is not None:
                    out["peso_unidad_gr"] = pnu * 1000.0
                    out["_punid_source"] = "Articulos.PesoNetoUnitario_"
        except Exception as e:
            log.warning("amasijo_teorico Articulos falló para %s: %s", cod, e)

    return out


def _fetch_coste_manual_vigente(cod: str) -> dict | None:
    """Lee la última ficha vigente de `precios.precios` (MySQL) para el
    código. Devuelve los campos relevantes para usar como override del
    coste de amasijo, o None si no existe.

    CONTEXTO
    ────────
    `precios.precios` es la tabla donde la herramienta PHP de precios
    (api_precios.php) persiste TODO el cálculo de cada ficha cuando el
    usuario edita y guarda. El campo `coste_amasijo` es un valor
    INTRODUCIDO POR EL USUARIO (no calculado), y es la fuente de
    verdad oficial para precios comerciales.

    Verificado abr 2026 con K44995 vía tests/diag_coste_disparidad.py:
    la app calculaba 335.806 € desde el escandallo (cascada VPR/UC),
    pero la fila 55142 de precios.precios tiene coste_amasijo = 406 €
    porque el usuario lo ajustó manualmente ("AJUSTE AVELLANA Y
    CACAHUETE" en obs_tot). La diferencia (~70 €) NO es un bug — es
    una decisión comercial.

    REGLA DE VIGENCIA
    ─────────────────
    Se elige la fila con `deleted_at IS NULL` y `fecha` más reciente
    (desempate por `updated_at` más reciente). Si una ficha posterior
    está `deleted_at != NULL` se ignora aunque tenga fecha más nueva.

    DEVUELVE
    ────────
    dict con keys:
      coste_amasijo_eur:  float (ej. 406.0) — autoritativo
      peso_amasijo_kg:    float (ej. 63.0)  — debería coincidir con el
                                              calculado pero da
                                              fiabilidad oficial
      costo_kg_masa_eur:  float (ej. 6.444) — = coste / peso
      ficha_id:           int   (ej. 55142) — PK en la tabla
      ficha_num:          str   (ej. "AU-19768") — código Zoho/comercial
      fecha:              str   ISO date
      updated_at:         str   ISO datetime
      _source:            str   "precios.precios"

    Devuelve None si:
    - MySQL precios no está disponible
    - No hay fila vigente para el código
    - La fila tiene coste_amasijo NULL o ≤ 0
    """
    try:
        from backend.db import precios as _precios
        if not _precios.is_available():
            return None
        row = _precios.fetch_one(
            "SELECT id, ficha_num, fecha, updated_at, "
            "       coste_amasijo, peso_amasijo, costo1kgmasa, "
            "       peso_grs, "
            "       precioVentaPack, precio1kgProd, precio1bargel, "
            "       escalado3000, escalado5000, escalado25000, escalado50000, "
            "       beneficio, margenCosto, margenCostoPorc, "
            "       coeficientePP "
            "FROM precios "
            "WHERE codigo = %s AND deleted_at IS NULL "
            "ORDER BY fecha DESC, updated_at DESC "
            "LIMIT 1",
            (cod,),
        )
        if not row:
            return None
        coste = _parse_num_txt(row.get("coste_amasijo"))
        if coste is None or coste <= 0:
            return None
        peso = _parse_num_txt(row.get("peso_amasijo"))
        ckg  = _parse_num_txt(row.get("costo1kgmasa"))
        # Precios finales — usados por /api/prices/calcular cuando hay
        # ficha vigente (la app pinta valores guardados, no recalcula
        # llamando al motor PHP, porque el motor en crea_precio=false
        # anula gastos_marketing y ecoembes_T3 — verificado mayo 2026).
        return {
            "coste_amasijo_eur": coste,
            "peso_amasijo_kg":   peso,
            "costo_kg_masa_eur": ckg,
            # peso_grs: peso del envase en gramos, tal como lo almacena el motor
            # PHP en su propia tabla. Es la fuente autoritativa para el parámetro
            # `peso_grs` del endpoint 1 — el motor usa este valor internamente
            # cuando recalcula con la regla "toma el último registro como base".
            "peso_grs":          _parse_num_txt(row.get("peso_grs")),
            "ficha_id":          row.get("id"),
            "ficha_num":         row.get("ficha_num"),
            "fecha":             str(row.get("fecha")) if row.get("fecha") else None,
            "updated_at":        str(row.get("updated_at")) if row.get("updated_at") else None,
            "_source":           "precios.precios",
            # Precios finales (autoritativos para la UI)
            "precioVentaPack":   _parse_num_txt(row.get("precioVentaPack")),
            "precio1kgProd":     _parse_num_txt(row.get("precio1kgProd")),
            "precio1bargel":     _parse_num_txt(row.get("precio1bargel")),
            "escalado3000":      _parse_num_txt(row.get("escalado3000")),
            "escalado5000":      _parse_num_txt(row.get("escalado5000")),
            "escalado25000":     _parse_num_txt(row.get("escalado25000")),
            "escalado50000":     _parse_num_txt(row.get("escalado50000")),
            "beneficio":         _parse_num_txt(row.get("beneficio")),
            "margenCosto":       _parse_num_txt(row.get("margenCosto")),
            "margenCostoPorc":   _parse_num_txt(row.get("margenCostoPorc")),
            "coeficientePP":     _parse_num_txt(row.get("coeficientePP")),
        }
    except Exception as e:
        log.warning("coste_manual_vigente falló para %s: %s", cod, e)
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Columnas proyectadas en /detail (Plan B.3)
# ═══════════════════════════════════════════════════════════════════════════
#
# Antes se hacía `SELECT *` sobre Articulos (267 columnas). Ahora
# proyectamos sólo las columnas que el normalizador de perfil
# (`backend.profiles`) realmente consume. Esto reduce el ancho de
# respuesta y el tráfico de red contra SQL Server.
#
# Si alguna columna falla en cierta BD (schemas antiguos), el wrapper
# `mssql.fetch_one` lanza excepción y en detail() caemos a un SELECT *
# defensivo.
_ARTICULOS_PROFILE_COLS = (
    "CodigoArticulo, DescripcionArticulo, TipoArticulo, CodigoFamilia, "
    "VCodigoMarca, VConAlergenos, VAlergenos, VConservacion, "
    "VValoresNutricionales, "
    "PesoBrutoUnitario_, PesoNetoUnitario_, PesoPlastico, "
    "VolumenUnitario_, Colores_, "
    "PrecioCompra, VUnidadesAmasijo"
)
# Nota (abr 2026): Se quitaron del SELECT:
#   · `PrecioUltimaCompra` y `MRH_VTipoReposicion` — NO existen en el schema
#     real de Articulos (verificado con integration_audit.py --discover).
#     `PrecioCompra` es la columna real usada para el Nivel 3 de la cascada.
#     El VTipoReposicion del producto padre se deriva ahora de su propia
#     fila en VPreciosReposicion, no de Articulos.
#   · `MRH_PesoOptimo` y `MRH_PesoUnidad` — tampoco existen en Articulos.
#     Los campos `peso_optimo` / `peso_unidad` del resultado viven a `None`
#     mientras no aparezca la columna real equivalente. Las columnas MRH_
#     de peso específicas (MRH_PesoBarrita, MRH_PesoSinBano, …) viven en
#     otras tablas (producción/barritas) y no se proyectan aquí.


def _fetch_articulo_row(cod: str) -> dict | None:
    """Lee una fila de Articulos con proyección de columnas del perfil.
    Si falla por columna inexistente, cae a SELECT * defensivo."""
    try:
        return mssql.fetch_one(
            f"SELECT {_ARTICULOS_PROFILE_COLS} "
            "FROM Articulos WHERE CodigoArticulo = ?",
            (cod,),
        )
    except Exception as e:
        log.warning("Proyección Articulos falló (%s); fallback SELECT *", e)
        return mssql.fetch_one(
            "SELECT * FROM Articulos WHERE CodigoArticulo = ?", (cod,),
        )


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/products/index-completo")
def index_completo(
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
    q: Optional[str] = None,
):
    """Índice completo con paginación de Vis_MRH_EsquemaEscandallo."""
    cache_key = f"idx_completo:{page}:{per_page}:{q or ''}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    # Filtro de catálogo público: siempre aplicado sobre v.CodigoArticulo.
    from backend.config import sql_catalog_where
    catalog_clause = sql_catalog_where("v.CodigoArticulo")
    where_sql = f" WHERE {catalog_clause}"
    params: list[Any] = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        where_sql += (
            " AND (v.CodigoArticulo LIKE ? OR "
            "      a.DescripcionArticulo LIKE ?)"
        )
        params.extend([like, like])

    try:
        count_row = mssql.fetch_one(
            "SELECT COUNT(DISTINCT v.CodigoArticulo) AS n "
            "FROM Vis_MRH_EsquemaEscandallo v "
            "LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
            f"{where_sql}",
            params,
        )
        total = int((count_row or {}).get("n", 0) or 0)
    except Exception as e:
        log.error("Error en count: %s", e)
        return {"error": str(e), "page": page, "per_page": per_page,
                "total": 0, "pages": 0, "productos": []}

    if total == 0:
        return {"page": page, "per_page": per_page, "total": 0,
                "pages": 0, "productos": []}

    offset = (page - 1) * per_page
    pages = (total + per_page - 1) // per_page

    try:
        rows = mssql.fetch_all(
            "SELECT DISTINCT v.CodigoArticulo AS codigo "
            "FROM Vis_MRH_EsquemaEscandallo v "
            + ("LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo " if q else "")
            + f"{where_sql} "
            + "ORDER BY v.CodigoArticulo "
            + "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            params + [offset, per_page],
        )
    except Exception as e:
        log.error("Error en query: %s", e)
        return {"error": str(e), "page": page, "per_page": per_page,
                "total": total, "pages": pages, "productos": []}

    productos = []
    for r in rows:
        cod = r.get("codigo")
        try:
            esc_data = escandallo(cod)
            descripcion = esc_data.get("descripcion") or "(sin descripción)"
            tipo_producto = esc_data.get("tipo_producto") or ""
        except Exception as e:
            log.debug("No se pudo enriquecer %s: %s", cod, e)
            descripcion = "(sin descripción)"
            tipo_producto = ""

        productos.append({
            "codigo": cod,
            "descripcion": descripcion,
            "tipo_producto": tipo_producto,
        })

    result = {"page": page, "per_page": per_page, "total": total,
              "pages": pages, "productos": productos}
    state.set_cached(cache_key, result, "filters")
    return result


@router.get("/products/escandallo-index")
def escandallo_index(
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
    q: Optional[str] = None,
):
    """Índice paginado de productos con escandallo. Cacheado TTL filters."""
    cache_key = f"esc_index:{page}:{per_page}:{q or ''}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    # Filtro de catálogo público: siempre aplicado sobre v.CodigoArticulo.
    from backend.config import sql_catalog_where
    catalog_clause = sql_catalog_where("v.CodigoArticulo")
    where_sql = f" WHERE {catalog_clause}"
    params: list[Any] = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        where_sql += (
            " AND (v.CodigoArticulo LIKE ? OR "
            "      a.DescripcionArticulo LIKE ?)"
        )
        params.extend([like, like])

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
        return {"error": f"No se pudo contar productos: {e}",
                "page": page, "per_page": per_page,
                "total": 0, "pages": 0, "productos": []}

    if total == 0:
        result = {"page": page, "per_page": per_page, "total": 0,
                  "pages": 0, "productos": []}
        state.set_cached(cache_key, result, "filters")
        return result

    offset = (page - 1) * per_page
    pages = (total + per_page - 1) // per_page

    try:
        rows = mssql.fetch_all(
            "SELECT v.CodigoArticulo AS codigo, "
            "       a.DescripcionArticulo AS descripcion, "
            "       a.TipoArticulo AS tipo_producto, "
            "       a.VUnidadesAmasijo AS numero_unidades, "
            "       COUNT(*) AS componentes_count "
            "FROM Vis_MRH_EsquemaEscandallo v "
            "LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
            f"{where_sql} "
            "GROUP BY v.CodigoArticulo, a.DescripcionArticulo, "
            "         a.TipoArticulo, a.VUnidadesAmasijo "
            "ORDER BY v.CodigoArticulo "
            "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            params + [offset, per_page],
        )
    except Exception as e:
        log.warning("escandallo_index query canónica falló: %s", e)
        try:
            rows = mssql.fetch_all(
                "SELECT v.CodigoArticulo AS codigo, "
                "       a.DescripcionArticulo AS descripcion, "
                "       a.TipoArticulo AS tipo_producto, "
                "       COUNT(*) AS componentes_count "
                "FROM Vis_MRH_EsquemaEscandallo v "
                "LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo "
                f"{where_sql} "
                "GROUP BY v.CodigoArticulo, a.DescripcionArticulo, "
                "         a.TipoArticulo "
                "ORDER BY v.CodigoArticulo "
                "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                params + [offset, per_page],
            )
            for r in rows:
                r["numero_unidades"] = None
        except Exception as e2:
            return {"error": f"Query de página falló: {e2}",
                    "page": page, "per_page": per_page, "total": total,
                    "pages": pages, "productos": []}

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

    result = {"page": page, "per_page": per_page, "total": total,
              "pages": pages, "productos": productos}
    state.set_cached(cache_key, result, "filters")
    return result


@router.get("/product/{cod}/detail")
def detail(cod: str):
    """Ficha detallada enriquecida. Cacheada TTL 3 min.

    Devuelve 404 si el código:
      (a) no pasa el filtro de prefijo del catálogo (LB/K),
      (b) no tiene ninguna fila en `Vis_MRH_EsquemaEscandallo`,
      (c) no existe en `Articulos`.
    """
    from backend.config import is_catalog_code
    if not is_catalog_code(cod):
        raise HTTPException(status_code=404, detail="producto no encontrado")

    # Productos sin escandallo no forman parte del catálogo público.
    esc_exists = mssql.fetch_one(
        "SELECT TOP 1 1 AS x FROM Vis_MRH_EsquemaEscandallo "
        "WHERE CodigoArticulo = ?",
        (cod,),
    )
    if not esc_exists:
        raise HTTPException(status_code=404, detail="producto no encontrado")

    cache_key = f"product:{cod}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        row = _fetch_articulo_row(cod)
    except Exception as e:
        return {"error": str(e)}
    if not row:
        raise HTTPException(status_code=404, detail="producto no encontrado")

    enriched = _enrich_product(row)
    state.set_cached(cache_key, enriched, "product")
    return enriched


@router.get("/product/{cod}/escandallo")
def escandallo(cod: str):
    """Escandallo completo con cascada de precios en BATCH. TTL 30 min.

    NOTA: El filtro `is_catalog_code` se aplica SÓLO al código del
    producto padre (el que se pide al endpoint). La resolución de
    componentes — materias primas, materiales auxiliares, envases —
    NO se filtra: esos componentes son imprescindibles para el
    cálculo de coste aunque sus códigos no empiecen por LB/K.
    """
    from backend.config import is_catalog_code
    if not is_catalog_code(cod):
        raise HTTPException(status_code=404, detail="producto no encontrado")

    cache_key = f"escandallo:{cod}"
    cached = state.get_cached(cache_key)
    if cached is not None:
        return cached

    # ── Cabecera ────────────────────────────────────────────────────────────
    # Nota: Articulos NO tiene VTipoReposicion ni MRH_VTipoReposicion ni
    # MRH_PesoOptimo ni MRH_PesoUnidad en el schema real (verificado con
    # integration_audit.py --discover). El VTipoReposicion del producto
    # padre se deriva más abajo desde su propia fila en VPreciosReposicion
    # (ver `parent_vtipo`). Los campos `peso_optimo` y `peso_unidad` del
    # resultado quedan a None hasta que aparezca la columna real.
    try:
        head = mssql.fetch_one(
            "SELECT CodigoArticulo, DescripcionArticulo, TipoArticulo, "
            "       VUnidadesAmasijo, CodigoFamilia "
            "FROM Articulos WHERE CodigoArticulo = ?",
            (cod,),
        )
    except Exception as e:
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

    # parent_vtipo: prioridad →
    #   1) Fila VPR propia del producto (raro en productos terminados).
    #   2) Inferencia por prefijo de código: LB*→1 (BATCH), K*→0 (MILLAR).
    #      Todos los productos terminados son K* o LB* (verificado mayo 2026).
    #   3) None → fallback a fila VPR más reciente del componente.
    parent_vpr_rows = _fetch_vpr_batch([cod]).get(cod, [])
    parent_vpr_row = parent_vpr_rows[0] if parent_vpr_rows else None
    if parent_vpr_row is not None:
        parent_vtipo = _int_or_none(parent_vpr_row.get("VTipoReposicion"))
        parent_vtipo_source = "vpr"
    else:
        parent_vtipo = _infer_parent_vtipo(cod)
        parent_vtipo_source = "prefix" if parent_vtipo is not None else "fallback"

    # ── Componentes ─────────────────────────────────────────────────────────
    filas, err = _fetch_componentes(cod)
    if err and not filas:
        return {
            "error":            f"No se pudo leer el escandallo: {err}",
            "codigo":           cod,
            "descripcion":      head.get("DescripcionArticulo"),
            "tipo_producto":    head.get("TipoArticulo"),
            "componentes":      [],
            "coste_amasijo":    0,
            "numero_unidades":  None,
        }

    # ── Extraer lista única de componentes para batch ───────────────────────
    cods_comp: list[str] = []
    seen_cods: set[str] = set()
    for row in filas:
        cod_comp = (row.get("ArticuloComponente")
                    or row.get("CodigoComponente") or "")
        if cod_comp and cod_comp not in seen_cods:
            seen_cods.add(cod_comp)
            cods_comp.append(cod_comp)

    # ── BATCH FETCH: 4 queries para TODOS los componentes ───────────────────
    vpr_rows_by_cod       = _fetch_vpr_batch(cods_comp)
    # Nivel 3 se resuelve en el loop de componentes con preferencia:
    #   1º `PrecioUltimaCompra` precalculada por la vista
    #      `Vis_MRH_EsquemaEscandallo`.
    #   2º `PrecioCompra` del JOIN a `Articulos` dentro de
    #      `_SQL_COMPONENTES` (fallback de la propia fila).
    #   3º Batch `_fetch_ultima_compra_batch` (sólo se dispara si los
    #      dos anteriores vinieron NULL en todos los registros).
    ultima_compra_backup  = {}
    cambio_codigo_by_cod  = _fetch_cambio_codigo_batch(cods_comp)
    receta_by_cod         = _fetch_receta_batch(cods_comp)

    # ── Construir componentes usando los batches ────────────────────────────
    componentes: list[dict] = []
    for row in filas:
        cod_comp = (row.get("ArticuloComponente")
                    or row.get("CodigoComponente") or "")
        # Descripción del COMPONENTE — preferimos el JOIN con Articulos
        # (alias `DescripcionArticuloJoin` inyectado por _SQL_COMPONENTES).
        # `DescripcionArticulo` de la vista es del PADRE y no sirve aquí.
        desc = (
            row.get("DescripcionArticuloJoin")
            or row.get("DescripcionArticuloComponente")
            or row.get("DescripcionComponente")
            or ""
        )
        # Cantidad del componente — en `Vis_MRH_EsquemaEscandallo` la
        # columna real es `UnidadesNecesarias` (verificado en
        # tests/discover_output.txt línea 16285). Las otras claves son
        # fallbacks defensivos por si la fuente cambia en el futuro.
        cantidad = _num(
            row.get("UnidadesNecesarias")
            or row.get("UnidadesEscandallo")
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

        # Nivel 3 — la vista Vis_MRH_EsquemaEscandallo YA trae
        # `PrecioUltimaCompra` precalculada (aunque la tabla Articulos no
        # tenga esa columna, la vista la expone). Preferimos ese valor
        # sobre `PrecioCompra` del JOIN a Articulos.
        uc_raw = row.get("PrecioUltimaCompra")
        if uc_raw is None:
            uc_raw = row.get("PrecioCompra")
        if uc_raw is None and cod_comp not in ultima_compra_backup:
            # Lazy batch fallback sólo si toda la columna del JOIN vino vacía
            ultima_compra_backup.update(
                _fetch_ultima_compra_batch(cods_comp)
            )
        ultima_compra = _num(uc_raw) if uc_raw is not None else \
                        ultima_compra_backup.get(cod_comp)

        # VPR: filtrar por VTipoReposicion del padre si existe
        vpr_rows = vpr_rows_by_cod.get(cod_comp, [])
        vpr_row = _select_vpr_row_for(vpr_rows, parent_vtipo)

        precio, fuente, fuentes = _cascade_from_batches(
            cod_comp, cantidad,
            vpr_row=vpr_row,
            ultima_compra=ultima_compra,
            cambio_codigo=cambio_codigo_by_cod.get(cod_comp),
            receta=receta_by_cod.get(cod_comp),
        )

        # Enriquecer la fila con CodigoFamilia antes de clasificar
        row_with_fam = dict(row)
        row_with_fam["DescripcionArticuloJoin"] = desc
        tipo_c = _classify_component(row_with_fam)
        subtotal = (precio or 0.0) * cantidad

        # Alias de `precio_fuente` para el frontend. La cascada interna
        # usa 'escalado' / 'vpr_directo' / 'ultima_compra' / 'cambio_codigo'
        # / 'receta'. El frontend muestra badges con estos labels:
        #   reposicion  → Rep  (tier VPR o directo)
        #   ultima_compra → UC
        #   cambio_codigo → CC
        #   receta        → Rec
        _fuente_display_map = {
            "escalado":     "reposicion",
            "vpr_directo":  "reposicion",
            "ultima_compra": "ultima_compra",
            "cambio_codigo": "cambio_codigo",
            "receta":       "receta",
        }
        fuente_display = _fuente_display_map.get(fuente, fuente)

        componentes.append({
            # Claves canónicas (API moderno)
            "codigo":          cod_comp,
            "descripcion":     desc,
            "cantidad":        cantidad,
            "unidad":          unidad,
            "precio":          precio,
            "precio_fuente":   fuente_display,  # mapeado para frontend
            "precio_fuente_raw": fuente,         # valor original de la cascada
            "tipo_componente": tipo_c,
            "subtotal":        round(subtotal, 6),
            "codigo_familia":  row.get("CodigoFamilia"),
            "orden":           orden,

            # Alias retro-compat con el frontend legacy (renderInlineRows)
            "ArticuloComponente":  cod_comp,
            "DescripcionArticulo": desc,
            "UnidadesNecesarias":  cantidad,
            "precio_efectivo":     precio,

            # Exposición de las 5 fuentes — útil para depurar en la UI
            "_fuentes":        fuentes,
            # Info de VPR row utilizado (para debug / distinción LB/K)
            "_vpr_vtipo":      (_int_or_none(vpr_row.get("VTipoReposicion"))
                                if vpr_row else None),
        })

    # Ordenar por OrdenEscandallo
    try:
        componentes.sort(key=lambda c: (int(c.get("orden") or 0), c["codigo"]))
    except Exception:
        componentes.sort(key=lambda c: -c["subtotal"])

    # ── Agregados ───────────────────────────────────────────────────────────
    def _sum(pred):
        return round(sum(c["subtotal"] for c in componentes if pred(c)), 6)

    coste_amasijo_tecnico = _sum(lambda c: c["tipo_componente"] == "mp")
    coste_auxiliar = _sum(lambda c: c["tipo_componente"] == "material_auxiliar")
    coste_bobina   = _sum(lambda c: c["tipo_componente"] == "bobina")
    coste_formato  = _sum(lambda c: c["tipo_componente"] == "formato_solido")

    # NOTA arquitectónica (mayo 2026): el override del coste manual
    # desde `precios.precios.coste_amasijo` se eliminó por decisión del
    # usuario para que la app sea PURAMENTE algorítmica. El coste que
    # se muestra (y el que el frontend envía al motor PHP) es siempre
    # el calculado desde la cascada (VPR / Última Compra / Receta).
    # `coste_amasijo_tecnico` se mantiene en el response como alias
    # (= coste_amasijo) por retro-compat del frontend que lo lee.
    # `_coste_manual_meta` siempre es None — el badge ámbar de "ficha
    # manual" no se pintará. Si necesitas ver el coste manual de la
    # herramienta, puedes consultarlo aún con
    # `_fetch_coste_manual_vigente(cod)` desde un diagnóstico.
    coste_amasijo = coste_amasijo_tecnico
    coste_manual_meta = None

    kg_amasijo = round(
        sum(c["cantidad"] for c in componentes
            if c["tipo_componente"] == "mp"),
        6,
    )

    coste_amasijo_bobina = round(
        coste_amasijo + coste_auxiliar + coste_bobina + coste_formato, 6
    )

    numero_unidades = head.get("VUnidadesAmasijo")
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

    if coste_amasijo_bobina > 0:
        for c in componentes:
            c["pct_coste"] = round(
                (c["subtotal"] / coste_amasijo_bobina) * 100, 3
            )
    else:
        for c in componentes:
            c["pct_coste"] = None

    cost_type = _cost_type_for(head, componentes, parent_vtipo)

    fuentes_count: dict[str, int] = {}
    for c in componentes:
        fuentes_count[c["precio_fuente"]] = fuentes_count.get(
            c["precio_fuente"], 0
        ) + 1

    # ── AMASIJO: diferenciación Teórico vs Real ─────────────────────────────
    # Sólo tiene sentido cuando cost_type=AMASIJO (barritas, geles, gominolas,
    # flapjacks, cookies, smoothies). Para BATCH/MILLAR la ventana del
    # frontend no pinta este bloque (ver propuesta de extensión al final del
    # respuesta del agente). Claves siempre presentes para que el frontend
    # pueda inspeccionarlas de forma predecible; valor None cuando no aplica.
    amasijo_real: dict | None = None
    amasijo_teor: dict | None = None
    merma_vs_teor_pct: float | None = None
    datos_faltantes_amasijo: list[str] = []

    # Fetch teor_info para AMASIJO (bloque teórico vs real) y también BATCH
    # (solo necesitamos peso_unidad_gr → peso_grs para el motor PHP).
    # Antes este fetch era exclusivo de AMASIJO, lo que dejaba peso_grs sin
    # enviar al motor en productos BATCH → precio/pack = precio/kg (motor
    # asumía 1000 g como peso de envase en lugar del real).
    teor_info: dict = {}
    if (cost_type or "").upper() in ("AMASIJO", "BATCH"):
        teor_info = _fetch_amasijo_teorico(head.get("CodigoArticulo") or cod)

    # Para BATCH: peso del envase en gramos → parámetro `peso_grs` del motor PHP.
    # Para AMASIJO: ídem (pieza), aunque no se pasa al motor en ese caso.
    peso_grs_bote: float | None = teor_info.get("peso_unidad_gr")

    if (cost_type or "").upper() == "AMASIJO":
        peso_amasijo_teor_kg = teor_info.get("peso_amasijo_teor_kg")
        peso_unidad_gr = teor_info.get("peso_unidad_gr")

        # Override de peso desde precios.precios eliminado (mayo 2026).
        # El peso teórico viene SIEMPRE de _fetch_amasijo_teorico, que
        # implementa la cascada idtool → Articulos.

        # ── Coste amasijo (siempre el técnico de la cascada) ──
        # Coincide para teórico/real porque es el gasto total registrado;
        # lo que cambia entre teórico y real es el peso y, por tanto,
        # las unidades derivadas y el €/kg.
        coste_total_shared = coste_amasijo

        # ── Datos faltantes — bandera explícita para que UI comunique ──
        if peso_amasijo_teor_kg is None:
            datos_faltantes_amasijo.append(
                "peso_amasijo_teor_kg (idtool.form_cabecera_formulas.VkilosAmasijo)"
            )
        if peso_unidad_gr is None:
            datos_faltantes_amasijo.append(
                "peso_unidad_gr (form_cabecera_formulas.PesoUnitarioPieza / "
                "ficha_tec_caracteristicas.peso_unidad / Articulos.PesoNetoUnitario_)"
            )
        if kg_amasijo in (None, 0):
            datos_faltantes_amasijo.append(
                "kg_amasijo (suma de cantidades MP en Vis_MRH_EsquemaEscandallo)"
            )

        def _ud_calc(kg: float | None, pu_gr: float | None) -> float | None:
            if kg is None or pu_gr is None or pu_gr <= 0 or kg <= 0:
                return None
            return round(kg * 1000.0 / pu_gr, 2)

        def _div(n: float | None, d: float | None) -> float | None:
            if n is None or d is None or d == 0:
                return None
            try:
                return round(float(n) / float(d), 6)
            except (TypeError, ValueError, ZeroDivisionError):
                return None

        # AMASIJO REAL — peso = kg_amasijo (suma cantidades MP)
        kg_real = kg_amasijo if kg_amasijo and kg_amasijo > 0 else None
        uds_real = _ud_calc(kg_real, peso_unidad_gr)
        amasijo_real = {
            "kg":             kg_real,
            "peso_unidad_gr": peso_unidad_gr,
            "unidades":       uds_real,
            "coste_total":    coste_total_shared,
            "coste_por_kg":   _div(coste_total_shared, kg_real),
            "coste_por_ud":   _div(coste_total_shared, uds_real),
            "_source": {
                "kg":             "kg_amasijo (ΣMP cantidades)",
                "peso_unidad_gr": teor_info.get("_punid_source"),
            },
        }

        # AMASIJO TEÓRICO — peso = form_cabecera_formulas.VkilosAmasijo
        kg_teor = peso_amasijo_teor_kg
        uds_teor = _ud_calc(kg_teor, peso_unidad_gr)
        amasijo_teor = {
            "kg":             kg_teor,
            "peso_unidad_gr": peso_unidad_gr,
            "unidades":       uds_teor,
            "coste_total":    coste_total_shared,  # mismo coste (ver arriba)
            "coste_por_kg":   _div(coste_total_shared, kg_teor),
            "coste_por_ud":   _div(coste_total_shared, uds_teor),
            "_source": {
                "kg":             teor_info.get("_teor_source"),
                "peso_unidad_gr": teor_info.get("_punid_source"),
            },
        }

        # Merma vs teórico — delta kg_real − kg_teor como % del teórico.
        # Signo: negativo = produje menos amasijo del declarado (merma
        # positiva desde el punto de vista del proceso). Positivo = produje
        # MÁS del declarado (sobrante).
        if kg_real is not None and kg_teor and kg_teor > 0:
            try:
                merma_vs_teor_pct = round(
                    (kg_real - kg_teor) / kg_teor * 100.0, 2
                )
            except (TypeError, ValueError, ZeroDivisionError):
                merma_vs_teor_pct = None

    result = {
        "codigo":               head.get("CodigoArticulo"),
        "descripcion":          head.get("DescripcionArticulo"),
        "tipo_producto":        head.get("TipoArticulo"),
        "vtipo_reposicion":     parent_vtipo,
        "v_tipo_reposicion":    parent_vtipo,
        "parent_vtipo_used":    parent_vtipo,
        "parent_vtipo_source":  parent_vtipo_source,
        "cost_type":            cost_type,
        # `peso_optimo` / `peso_unidad` — no existen columnas MRH_PesoOptimo /
        # MRH_PesoUnidad en Articulos (verificado con --discover). Se
        # mantienen las claves con valor None por retrocompat del frontend.
        "peso_optimo":          None,
        "peso_unidad":          None,
        # Peso del envase/pieza en gramos — calculado por _fetch_amasijo_teorico
        # para AMASIJO y BATCH. Para BATCH es el parámetro `peso_grs` que
        # el motor PHP necesita para dividir correctamente precio/pack ÷ peso_grs.
        "peso_grs_bote":        peso_grs_bote,
        "componentes":          componentes,
        "coste_amasijo":        coste_amasijo,           # AUTORITATIVO (manual si existe)
        "coste_amasijo_tecnico": coste_amasijo_tecnico,  # calc desde escandallo (referencia)
        "_coste_manual_meta":    coste_manual_meta,       # None o dict con ficha
        "coste_auxiliar":       coste_auxiliar,
        "coste_bobina":         coste_bobina,
        "coste_formato":        coste_formato,
        "coste_amasijo_bobina": coste_amasijo_bobina,
        "kg_amasijo":           kg_amasijo,
        "numero_unidades":      numero_unidades,
        "coste_unitario":       coste_unitario,
        "coste_millar":         coste_millar,
        # Nuevas claves — diferenciación teórico vs real (sólo AMASIJO)
        "amasijo_real":         amasijo_real,
        "amasijo_teor":         amasijo_teor,
        "merma_vs_teor_pct":    merma_vs_teor_pct,
        "datos_faltantes_amasijo": datos_faltantes_amasijo,
        "_fuentes_count":       fuentes_count,
        "_total_componentes":   len(componentes),
        "_queries_batched":     4,   # vpr + cambio_codigo + receta + (ultima_compra backup opc.)
    }

    state.set_cached(cache_key, result, "escandallo")
    return result


@router.get("/products/explore-articulos")
def explore_articulos():
    """[DEBUG] Explora estructura de Articulos."""
    try:
        columnas_info = mssql.fetch_all(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, "
            "       CHARACTER_MAXIMUM_LENGTH "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME = 'Articulos' "
            "ORDER BY COLUMN_NAME"
        )
        muestra = mssql.fetch_one(
            "SELECT TOP 1 * FROM Articulos WHERE CodigoArticulo IN ("
            "  SELECT TOP 1 CodigoArticulo FROM Vis_MRH_EsquemaEscandallo"
            ")"
        )
        columnas_dict = {
            c['COLUMN_NAME']: (
                f"{c['DATA_TYPE']}({c['CHARACTER_MAXIMUM_LENGTH']})"
                if c['CHARACTER_MAXIMUM_LENGTH'] else c['DATA_TYPE']
            )
            for c in columnas_info
        }
        potenciales = {}
        for kw in ['categoria', 'subcategoria', 'sabor', 'macronutriente',
                   'proteina', 'grasa', 'carbohidrato', 'certificacion',
                   'alergeno']:
            potenciales[kw] = [col for col in columnas_dict.keys()
                               if kw.lower() in col.lower()]
        return {
            "total_columnas":         len(columnas_dict),
            "columnas":               columnas_dict,
            "columnas_potenciales":   potenciales,
            "muestra_primer_producto": muestra,
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}
