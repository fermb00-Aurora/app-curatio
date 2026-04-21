"""
Aurora I+D+i — Price Data Routes (MySQL)
==========================================
  GET  /api/prices/scatter?codes=LB001,LB002,...  — latest prices for scatter plot
  GET  /api/prices/history/{cod}                  — price history for a product
  POST /api/prices/calcular                        — proxy to pricing engine API
"""

import logging
import requests as _requests
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from ..db.precios import get_mysql_conn, is_available

logger = logging.getLogger("aurora.prices")
router = APIRouter()


@router.get("/api/prices/scatter")
def get_scatter_prices(
    codes: str = Query(..., description="Comma-separated product codes"),
):
    """
    Return the most recent price for each code.
    Used to build the scatter plot above similarity results.
    """
    if not is_available():
        return JSONResponse(
            {"error": "Base de datos de precios no disponible"},
            status_code=503,
        )

    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    if not code_list or len(code_list) > 200:
        return JSONResponse({"error": "Listado de codigos invalido"}, status_code=400)

    try:
        conn = get_mysql_conn()
        cur = conn.cursor()

        placeholders = ",".join(["%s"] * len(code_list))
        cur.execute(
            f"""
            SELECT p.codigo, p.fecha, p.precioVentaPack, p.precio1kgProd,
                   p.precio1bargel, p.ddpprecio, p.nombre_producto,
                   p.costo1kgmasa, p.margenCostoPorc, p.beneficio,
                   p.costoPackaging, p.nombre_cliente, p.peso_grs,
                   p.escalado3000, p.escalado5000, p.escalado25000, p.escalado50000
            FROM precios p
            INNER JOIN (
                SELECT codigo, MAX(fecha) AS max_fecha
                FROM precios
                WHERE codigo IN ({placeholders})
                  AND deleted_at IS NULL
                GROUP BY codigo
            ) latest ON p.codigo = latest.codigo AND p.fecha = latest.max_fecha
            WHERE p.codigo IN ({placeholders})
              AND p.deleted_at IS NULL
            GROUP BY p.codigo
            """,
            code_list + code_list,
        )
        rows = cur.fetchall()
        conn.close()

        result = {}
        for row in rows:
            result[row["codigo"]] = {
                "fecha": str(row["fecha"]) if row["fecha"] else None,
                "precioVentaPack": float(row["precioVentaPack"] or 0),
                "precio1kgProd": float(row["precio1kgProd"] or 0),
                "precio1bargel": float(row["precio1bargel"] or 0),
                "ddpprecio": float(row["ddpprecio"] or 0),
                "nombre_producto": row.get("nombre_producto", ""),
                "costo1kgmasa": float(row["costo1kgmasa"] or 0),
                "margenCostoPorc": float(row["margenCostoPorc"] or 0),
                "beneficio": float(row["beneficio"] or 0),
                "costoPackaging": float(row["costoPackaging"] or 0),
                "nombre_cliente": row.get("nombre_cliente", ""),
                "peso_grs": float(row["peso_grs"] or 0),
                "escalado3000": float(row["escalado3000"] or 0),
                "escalado5000": float(row["escalado5000"] or 0),
                "escalado25000": float(row["escalado25000"] or 0),
                "escalado50000": float(row["escalado50000"] or 0),
            }

        return {"prices": result, "total": len(result)}

    except Exception as e:
        logger.error("Error en /api/prices/scatter: %s", e)
        return JSONResponse({"error": "Error al consultar precios"}, status_code=500)


@router.get("/api/prices/history/{cod}")
def get_price_history(cod: str):
    """
    Return all historical price entries for a product.
    Used to draw price evolution charts in the comparison view.
    """
    if not is_available():
        return JSONResponse(
            {"error": "Base de datos de precios no disponible"},
            status_code=503,
        )

    if not cod or len(cod) > 80:
        return JSONResponse({"error": "Codigo invalido"}, status_code=400)

    try:
        conn = get_mysql_conn()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, fecha, precioVentaPack, precio1kgProd, precio1bargel,
                   ddpprecio, margenCosto, margenCostoPorc, beneficio,
                   costoPackaging, nombre_producto, nombre_cliente,
                   fecha_entrada_vigor, fecha_fin_vigor,
                   costo1kgmasa, escalado3000, escalado5000,
                   escalado25000, escalado50000
            FROM precios
            WHERE codigo = %s
              AND deleted_at IS NULL
            ORDER BY fecha ASC
            """,
            (cod,),
        )
        rows = cur.fetchall()
        conn.close()

        history = []
        for row in rows:
            history.append({
                "id": row["id"],
                "fecha": str(row["fecha"]) if row["fecha"] else None,
                "precioVentaPack": float(row["precioVentaPack"] or 0),
                "precio1kgProd": float(row["precio1kgProd"] or 0),
                "precio1bargel": float(row["precio1bargel"] or 0),
                "ddpprecio": float(row["ddpprecio"] or 0),
                "margenCosto": float(row["margenCosto"] or 0),
                "margenCostoPorc": float(row["margenCostoPorc"] or 0),
                "beneficio": float(row["beneficio"] or 0),
                "costoPackaging": float(row["costoPackaging"] or 0),
                "nombre_producto": row.get("nombre_producto", ""),
                "nombre_cliente": row.get("nombre_cliente", ""),
                "fecha_entrada_vigor": str(row["fecha_entrada_vigor"]) if row.get("fecha_entrada_vigor") else None,
                "fecha_fin_vigor": str(row["fecha_fin_vigor"]) if row.get("fecha_fin_vigor") else None,
                "costo1kgmasa": float(row["costo1kgmasa"] or 0),
                "escalado3000": float(row["escalado3000"] or 0),
                "escalado5000": float(row["escalado5000"] or 0),
                "escalado25000": float(row["escalado25000"] or 0),
                "escalado50000": float(row["escalado50000"] or 0),
            })

        return {"cod": cod, "history": history, "total": len(history)}

    except Exception as e:
        logger.error("Error en /api/prices/history/%s: %s", cod, e)
        return JSONResponse({"error": "Error al consultar historico"}, status_code=500)


# ─── MOTOR DE PRECIOS — PROXY ─────────────────────────────────────────────────

_MOTOR_BASE = "http://10.10.4.175/precios/api/api_precios.php"
_MOTOR_TIMEOUT = 12  # segundos


class CalcularPrecioRequest(BaseModel):
    endpoint: int = 1           # 1, 2 o 3
    codigo: str
    coste_amasijo: float
    # Endpoint 2/3 — comunes
    id_matriz: Optional[int] = None
    peso_grs: Optional[float] = None
    peso_amasijo: Optional[float] = None
    unitspbox: Optional[int] = None
    # Endpoint 3 — tipo explícito
    tipo: Optional[int] = None
    # Tipo 3 (caps/tabs)
    tabspills: Optional[int] = None


@router.post("/api/prices/calcular")
def calcular_precio(req: CalcularPrecioRequest):
    """
    Proxy al motor de precios interno (10.10.4.175).
    Siempre usa crea_precio=false — solo calcula, no persiste.

    Endpoint 1: recalcula a partir del último registro existente del producto.
    Endpoint 2: crea cálculo desde cero con id_matriz (tipos.id) como base.
    Endpoint 3: igual que 2 pero con tipo explícito.
    """
    if req.endpoint not in (1, 2, 3):
        return JSONResponse({"error": "endpoint debe ser 1, 2 o 3"}, status_code=400)

    if not req.codigo or len(req.codigo) > 80:
        return JSONResponse({"error": "codigo invalido"}, status_code=400)

    url = f"{_MOTOR_BASE}/precio_endpoint{req.endpoint}"

    # Construir params según endpoint
    params: dict = {"codigo": req.codigo, "crea_precio": "false"}

    if req.endpoint == 1:
        params["coste_amasijo"] = req.coste_amasijo

    elif req.endpoint == 2:
        if req.id_matriz is None:
            return JSONResponse({"error": "id_matriz requerido para endpoint 2"}, status_code=400)
        params["id_matriz"] = req.id_matriz
        params["coste_amasijo"] = req.coste_amasijo
        if req.peso_grs is not None:
            params["peso_grs"] = req.peso_grs
        if req.peso_amasijo is not None:
            params["peso_amasijo"] = req.peso_amasijo
        if req.unitspbox is not None:
            params["unitspbox"] = req.unitspbox
        if req.tabspills is not None:
            params["tabspills"] = req.tabspills

    elif req.endpoint == 3:
        if req.id_matriz is None:
            return JSONResponse({"error": "id_matriz requerido para endpoint 3"}, status_code=400)
        if req.tipo is None:
            return JSONResponse({"error": "tipo requerido para endpoint 3"}, status_code=400)
        params["id_matriz"] = req.id_matriz
        params["tipo"] = req.tipo
        params["coste_amasijo"] = req.coste_amasijo
        if req.peso_grs is not None:
            params["peso_grs"] = req.peso_grs
        if req.peso_amasijo is not None:
            params["peso_amasijo"] = req.peso_amasijo
        if req.unitspbox is not None:
            params["unitspbox"] = req.unitspbox
        if req.tabspills is not None:
            params["tabspills"] = req.tabspills

    try:
        resp = _requests.post(url, data=params, timeout=_MOTOR_TIMEOUT)
    except _requests.exceptions.ConnectionError:
        logger.error("Motor de precios no accesible: %s", url)
        return JSONResponse({"error": "Motor de precios no accesible"}, status_code=503)
    except _requests.exceptions.Timeout:
        logger.error("Timeout al llamar al motor de precios")
        return JSONResponse({"error": "Motor de precios tardó demasiado"}, status_code=504)
    except Exception as e:
        logger.error("Error inesperado al llamar motor de precios: %s", e)
        return JSONResponse({"error": "Error interno"}, status_code=500)

    try:
        body = resp.json()
    except Exception:
        logger.error("Respuesta no-JSON del motor de precios (HTTP %s): %s", resp.status_code, resp.text[:200])
        return JSONResponse({"error": "Respuesta inesperada del motor de precios"}, status_code=502)

    # Propagar el status del motor (200 ok, 400/404 error del motor)
    if resp.status_code not in (200, 400, 404):
        logger.warning("Motor de precios respondió HTTP %s", resp.status_code)
        return JSONResponse(body, status_code=502)

    return JSONResponse(body, status_code=resp.status_code)
