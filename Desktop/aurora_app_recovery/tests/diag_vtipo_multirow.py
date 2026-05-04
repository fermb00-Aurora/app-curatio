# -*- coding: utf-8 -*-
"""tests/diag_vtipo_multirow.py — Verifica si hay materias primas con
multiples filas VPR (VPreciosReposicion) con distinto VTipoReposicion.

Uso:
    python tests/diag_vtipo_multirow.py
    python tests/diag_vtipo_multirow.py K44995
"""
from __future__ import annotations
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

CODIGO = sys.argv[1] if len(sys.argv) > 1 else None


def _num(x, d=0.0):
    try:
        return float(x) if x is not None else d
    except (TypeError, ValueError):
        return d


def pr(s=""):
    print(s, flush=True)


def main() -> int:
    pr("=== DIAG VTipoReposicion multi-fila en VPreciosReposicion ===")
    pr()

    try:
        from backend.db import mssql
    except Exception as e:
        pr(f"  ERROR importando backend.db: {e}")
        return 1

    if not mssql.is_available():
        pr("  ERROR: SQL Server no disponible.")
        return 1
    pr("  SQL Server: OK")
    pr()

    # ── 1. Cuantas MPs tienen >=2 filas vigentes con distinto VTipoReposicion ──
    pr("[1] MPs con multiples VTipoReposicion distintos (vigentes hoy)")
    sql_count = """
        SELECT COUNT(*) AS n
        FROM (
            SELECT CodigoArticulo
            FROM VPreciosReposicion
            WHERE FechaDesde IS NOT NULL
              AND FechaDesde <= GETDATE()
              AND (FechaHasta IS NULL OR FechaHasta >= GETDATE())
            GROUP BY CodigoArticulo
            HAVING COUNT(DISTINCT VTipoReposicion) >= 2
        ) AS sub
    """
    try:
        row = mssql.fetch_one(sql_count)
        n_multi = (row or {}).get("n", 0)
        if n_multi:
            pr(f"  *** {n_multi} articulo(s) tienen >=2 filas VPR vigentes "
               f"con VTipoReposicion distinto. ***")
            pr("  -> Para esas MPs, el precio cambia segun el tipo "
               "del producto padre (LB/K/etc.).")
        else:
            pr("  0 articulos con multiple VTipoReposicion vigente. "
               "El fenomeno no ocurre en datos actuales.")
    except Exception as e:
        pr(f"  Consulta fallo: {e}")
        return 1
    pr()

    # ── 2. Ejemplos concretos ─────────────────────────────────────────────────
    pr("[2] Hasta 25 ejemplos — precio por VTipoReposicion")
    sql_examples = """
        SELECT TOP 50
            v.CodigoArticulo,
            a.DescripcionArticulo,
            v.VTipoReposicion,
            v.FechaDesde,
            v.FechaHasta,
            v.HastaUnidades1, v.Precio1,
            v.HastaUnidades2, v.Precio2,
            v.HastaUnidades3, v.Precio3
        FROM VPreciosReposicion v
        LEFT JOIN Articulos a ON a.CodigoArticulo = v.CodigoArticulo
        WHERE v.CodigoArticulo IN (
            SELECT CodigoArticulo
            FROM VPreciosReposicion
            WHERE FechaDesde IS NOT NULL
              AND FechaDesde <= GETDATE()
              AND (FechaHasta IS NULL OR FechaHasta >= GETDATE())
            GROUP BY CodigoArticulo
            HAVING COUNT(DISTINCT VTipoReposicion) >= 2
        )
          AND v.FechaDesde IS NOT NULL
          AND v.FechaDesde <= GETDATE()
          AND (v.FechaHasta IS NULL OR v.FechaHasta >= GETDATE())
        ORDER BY v.CodigoArticulo, v.VTipoReposicion
    """
    try:
        rows = mssql.fetch_all(sql_examples)
    except Exception as e:
        pr(f"  Consulta fallo: {e}")
        rows = []

    if not rows:
        pr("  Sin datos (coincide con n=0 del punto anterior).")
    else:
        by_cod: dict[str, list] = {}
        for r in rows:
            cod = r.get("CodigoArticulo", "")
            by_cod.setdefault(cod, []).append(r)

        for cod, filas in list(by_cod.items())[:25]:
            desc = (filas[0].get("DescripcionArticulo") or "")[:55]
            pr(f"  [{cod}]  {desc}")
            for f in filas:
                vtipo = f.get("VTipoReposicion")
                fd = str(f.get("FechaDesde", ""))[:10]
                fh = str(f.get("FechaHasta", "inf"))[:10]
                # Tiers con precio > 0
                tiers_str = ""
                for i in range(1, 4):
                    p = _num(f.get(f"Precio{i}"))
                    h = f.get(f"HastaUnidades{i}")
                    if p > 0:
                        tiers_str += f"  hasta {h}u -> {p:.4f}EUR"
                pr(f"      vtipo={vtipo}  [{fd} -> {fh}]{tiers_str}")
        if len(by_cod) > 25:
            pr(f"  ... y {len(by_cod)-25} mas (TOP 25 mostrados)")
    pr()

    # ── 3. Analisis del escandallo de un producto concreto ────────────────────
    if not CODIGO:
        pr("  (Para analizar un escandallo concreto: "
           "python tests/diag_vtipo_multirow.py <CODIGO>)")
        return 0

    pr(f"[3] Escandallo de {CODIGO} -- impacto del VTipoReposicion")

    try:
        from backend.api.products import (
            _fetch_componentes, _fetch_vpr_batch, _select_vpr_row_for,
            _extract_vpr_tiers, _infer_parent_vtipo,
        )
    except ImportError as e:
        pr(f"  ERROR importando logica de escandallo: {e}")
        return 1

    parent_vpr_rows = _fetch_vpr_batch([CODIGO]).get(CODIGO, [])
    parent_vpr_row  = parent_vpr_rows[0] if parent_vpr_rows else None
    try:
        parent_vtipo_vpr = (int(parent_vpr_row["VTipoReposicion"])
                            if parent_vpr_row and
                               parent_vpr_row.get("VTipoReposicion") is not None
                            else None)
    except (TypeError, ValueError):
        parent_vtipo_vpr = None

    if parent_vtipo_vpr is not None:
        parent_vtipo = parent_vtipo_vpr
        vtipo_source = "vpr"
    else:
        parent_vtipo = _infer_parent_vtipo(CODIGO)
        vtipo_source = "prefix" if parent_vtipo is not None else "fallback"

    pr(f"  VTipoReposicion del padre: {parent_vtipo}  (fuente: {vtipo_source})")

    filas, err = _fetch_componentes(CODIGO)
    if err and not filas:
        pr(f"  _fetch_componentes fallo: {err}")
        return 1

    cods_comp = list({r.get("ArticuloComponente") for r in filas
                      if r.get("ArticuloComponente")})
    if not cods_comp:
        pr("  Sin componentes.")
        return 0

    vpr_by_cod = _fetch_vpr_batch(cods_comp)

    afectados = []
    for fila in filas:
        cod_comp = fila.get("ArticuloComponente")
        if not cod_comp:
            continue
        all_rows = vpr_by_cod.get(cod_comp, [])
        if not all_rows:
            continue
        vtipos_disponibles = list({r.get("VTipoReposicion") for r in all_rows})
        if len(vtipos_disponibles) < 2:
            continue

        row_con = _select_vpr_row_for(all_rows, parent_vtipo)
        row_sin = _select_vpr_row_for(all_rows, None)

        def _primer_precio(row):
            if not row:
                return None
            tiers = _extract_vpr_tiers(row)
            for _, precio in tiers:
                if precio > 0:
                    return precio
            return None

        p_con = _primer_precio(row_con)
        p_sin = _primer_precio(row_sin)
        vtipo_con = (row_con.get("VTipoReposicion") if row_con else None)
        vtipo_sin = (row_sin.get("VTipoReposicion") if row_sin else None)

        afectados.append({
            "cod": cod_comp,
            "desc": (fila.get("DescripcionComponente") or "")[:45],
            "cantidad": fila.get("CantidadComponente") or 0,
            "vtipos_disponibles": vtipos_disponibles,
            "vtipo_elegido": vtipo_con,
            "precio_con_vtipo": p_con,
            "vtipo_fallback": vtipo_sin,
            "precio_sin_vtipo": p_sin,
        })

    if not afectados:
        pr("  Ningun componente de este escandallo tiene multiples VTipoReposicion.")
        pr("  El fenomeno no aplica a este producto.")
    elif all(a["precio_con_vtipo"] == a["precio_sin_vtipo"] for a in afectados):
        pr(f"  {len(afectados)} componente(s) con multiples vtipos, pero vtipo_correcto==fallback: sin impacto.")
    else:
        pr(f"  {len(afectados)} componente(s) con multiples VTipoReposicion:")
        pr()
        pr(f"  {'cod':<12} {'vtipo_OK':>9} {'precio_OK':>11} "
           f"{'vtipo_fb':>9} {'precio_fb':>11} {'delta%':>8}  descripcion")
        pr("  " + "-"*90)
        for a in afectados:
            p1 = a["precio_con_vtipo"]
            p2 = a["precio_sin_vtipo"]
            if p1 is not None and p2 is not None and p2 > 0:
                delta_pct = (p1 - p2) / p2 * 100
                delta_s = f"{delta_pct:+.1f}%"
            else:
                delta_s = "?"
            p1_s = f"{p1:.4f}" if p1 is not None else "—"
            p2_s = f"{p2:.4f}" if p2 is not None else "—"
            pr(f"  {a['cod']:<12} {str(a['vtipo_elegido']):>9} {p1_s:>11} "
               f"{str(a['vtipo_fallback']):>9} {p2_s:>11} {delta_s:>8}  {a['desc']}")
        pr()
        pr("  CONCLUSION:")
        pr("  El codigo ya selecciona el vtipo correcto del padre (_select_vpr_row_for).")
        if parent_vtipo is None:
            pr("  AVISO: parent_vtipo=None para este producto -> usa fallback "
               "(fila mas reciente), puede ser precio incorrecto.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
