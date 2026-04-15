#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificación de Origenes de Datos - Aurora S-Chain
Valida:
  1. Conexion a AURORA (SQL Server)
  2. Existencia de tablas principales
  3. Datos de productos Aurora (LB%, K%)
  4. Conexion a PRECIOS (MySQL)
  5. Estado de integracion
"""

import sys
import json
from datetime import datetime

# Try imports
try:
    import pyodbc
    PYODBC_OK = True
except ImportError:
    PYODBC_OK = False
    print("[!] pyodbc no instalado. Instala: pip install pyodbc")

try:
    import mysql.connector
    MYSQL_OK = True
except ImportError:
    MYSQL_OK = False
    print("[!] mysql-connector-python no instalado. Instala: pip install mysql-connector-python")

# Configuration
AURORA_CONFIG = {
    "server": "10.10.4.173",
    "database": "AURORA",
    "uid": "MRH",
    "pwd": "Aurora_2019_1+#",
    "instance": "SAGE",
    "driver": "ODBC Driver 17 for SQL Server",
}

PRECIOS_CONFIG = {
    "host": "10.10.4.175",
    "port": 3306,
    "user": "root",
    "password": "H4p!mK22yy$9",
    "database": "precios",
}

AURORA_TABLES = [
    "VArticulosFichaTecnica",
    "AcumuladoStock",
    "MovimientoStock",
    "MRH_StatusStock",
    "CabeceraPedidoCliente",
    "LineasPedidoCliente",
    "CabeceraAlbaranCliente",
    "LineasAlbaranCliente",
    "CabeceraPedidoProveedor",
    "LineasPedidoProveedor",
    "CabeceraAlbaranProveedor",
    "LineasAlbaranProveedor",
    "ArticuloProveedor",
    "Articulos",
    "Almacenes",
    "Proveedores",
    "OrdenesFabricacion",
    "Incidencias",
    "EstadisVenta",
]

# Results
results = {
    "timestamp": datetime.now().isoformat(),
    "aurora": {
        "connection": False,
        "tables": {},
        "products_aurora": 0,
        "products_lbk": 0,
        "errors": [],
    },
    "precios": {
        "connection": False,
        "tables": [],
        "errors": [],
    },
    "summary": "",
}

# ──────────────────────────────────────────────────────────────────
# 1. AURORA (SQL Server)
# ──────────────────────────────────────────────────────────────────

if PYODBC_OK:
    print("\n" + "=" * 70)
    print("[CHK] AURORA (SQL Server)")
    print("=" * 70)

    try:
        conn_str = (
            f"Driver={AURORA_CONFIG['driver']};"
            f"Server={AURORA_CONFIG['server']}\\{AURORA_CONFIG['instance']};"
            f"Database={AURORA_CONFIG['database']};"
            f"UID={AURORA_CONFIG['uid']};"
            f"PWD={AURORA_CONFIG['pwd']};"
            f"TrustServerCertificate=yes;"
        )

        conn = pyodbc.connect(conn_str, timeout=10)
        cursor = conn.cursor()
        results["aurora"]["connection"] = True

        print(f"[OK] Conexión establecida: {AURORA_CONFIG['server']}\\{AURORA_CONFIG['instance']}")
        print(f"   BD: {AURORA_CONFIG['database']}, Usuario: {AURORA_CONFIG['uid']}")

        # Check tables
        print("\n[TB] Verificando tablas...")
        for table_name in AURORA_TABLES:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                results["aurora"]["tables"][table_name] = {
                    "exists": True,
                    "rows": count,
                }
                status = "[OK]" if count > 0 else "[!] "
                print(f"  {status} {table_name}: {count:,} rows")
            except Exception as e:
                results["aurora"]["tables"][table_name] = {
                    "exists": False,
                    "error": str(e)[:100],
                }
                print(f"  [ERR] {table_name}: {str(e)[:50]}")

        # Check Aurora products (LB%, K%)
        print("\n[LB]  Verificando Productos Aurora...")
        try:
            cursor.execute("""
                SELECT
                    COUNT(DISTINCT CodigoArticulo) AS count_lbk,
                    COUNT(DISTINCT CASE WHEN CodigoArticulo LIKE 'LB%' THEN CodigoArticulo END) AS count_lb,
                    COUNT(DISTINCT CASE WHEN CodigoArticulo LIKE 'K%' THEN CodigoArticulo END) AS count_k
                FROM VArticulosFichaTecnica
                WHERE CodigoArticulo LIKE 'LB%' OR CodigoArticulo LIKE 'K%'
            """)
            row = cursor.fetchone()
            results["aurora"]["products_lbk"] = row[0] or 0
            results["aurora"]["products_lb"] = row[1] or 0
            results["aurora"]["products_k"] = row[2] or 0

            print(f"  [OK] Artículos LB%: {row[1] or 0:,}")
            print(f"  [OK] Artículos K%: {row[2] or 0:,}")
            print(f"  [OK] Total Aurora (LB+K): {row[0] or 0:,}")
        except Exception as e:
            results["aurora"]["errors"].append(f"Productos Aurora: {str(e)}")
            print(f"  [ERR] Error: {e}")

        # Check stock data
        print("\n[ST] Verificando Inventario...")
        try:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total_movs,
                    COUNT(DISTINCT CodigoArticulo) AS distinct_articles
                FROM AcumuladoStock
                WHERE CodigoArticulo LIKE 'LB%' OR CodigoArticulo LIKE 'K%'
            """)
            row = cursor.fetchone()
            print(f"  [OK] Movimientos Stock Aurora: {row[0]:,}")
            print(f"  [OK] Artículos con stock: {row[1]:,}")
        except Exception as e:
            results["aurora"]["errors"].append(f"Stock data: {str(e)}")
            print(f"  [ERR] Error: {e}")

        # Check demand data
        print("\n[DD] Verificando Demanda...")
        try:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total_lineas,
                    COUNT(DISTINCT CodigoArticulo) AS distinct_articles
                FROM LineasPedidoCliente lpc
                WHERE lpc.CodigoArticulo LIKE 'LB%' OR lpc.CodigoArticulo LIKE 'K%'
            """)
            row = cursor.fetchone()
            print(f"  [OK] Líneas de Demanda Aurora: {row[0]:,}")
            print(f"  [OK] Artículos demandados: {row[1]:,}")
        except Exception as e:
            results["aurora"]["errors"].append(f"Demand data: {str(e)}")
            print(f"  [ERR] Error: {e}")

        # Check supply data
        print("\n[SU] Verificando Suministro...")
        try:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total_lineas,
                    COUNT(DISTINCT CodigoArticulo) AS distinct_articles,
                    COUNT(DISTINCT Codigo_Proveedor) AS suppliers
                FROM LineasPedidoProveedor lpp
                WHERE lpp.CodigoArticulo LIKE 'LB%' OR lpp.CodigoArticulo LIKE 'K%'
            """)
            row = cursor.fetchone()
            print(f"  [OK] Líneas de Suministro Aurora: {row[0]:,}")
            print(f"  [OK] Artículos suministrados: {row[1]:,}")
            print(f"  [OK] Proveedores: {row[2]:,}")
        except Exception as e:
            results["aurora"]["errors"].append(f"Supply data: {str(e)}")
            print(f"  [ERR] Error: {e}")

        cursor.close()
        conn.close()

    except Exception as e:
        results["aurora"]["errors"].append(str(e))
        print(f"[ERR] Conexión fallida: {e}")
        print("\n   Causas posibles:")
        print("   - ODBC Driver 17 no instalado")
        print("   - Credenciales incorrectas (MRH / Aurora_2019_1+#)")
        print("   - IP/puerto no accesible (10.10.4.173:1433)")
        print("   - Firewall bloqueando")

else:
    print("[!]  pyodbc no disponible. Salta verificación AURORA.")

# ──────────────────────────────────────────────────────────────────
# 2. PRECIOS (MySQL)
# ──────────────────────────────────────────────────────────────────

if MYSQL_OK:
    print("\n" + "=" * 70)
    print("[CHK] PRECIOS (MySQL)")
    print("=" * 70)

    try:
        conn = mysql.connector.connect(
            host=PRECIOS_CONFIG["host"],
            port=PRECIOS_CONFIG["port"],
            user=PRECIOS_CONFIG["user"],
            password=PRECIOS_CONFIG["password"],
            database=PRECIOS_CONFIG["database"],
            connection_timeout=10,
        )
        cursor = conn.cursor()
        results["precios"]["connection"] = True

        print(f"[OK] Conexión establecida: {PRECIOS_CONFIG['host']}:{PRECIOS_CONFIG['port']}")
        print(f"   BD: {PRECIOS_CONFIG['database']}, Usuario: {PRECIOS_CONFIG['user']}")

        # List tables
        print("\n[TB] Tablas en PRECIOS...")
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        results["precios"]["tables"] = tables

        if tables:
            for table_name in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = cursor.fetchone()[0]
                    print(f"  [OK] {table_name}: {count:,} rows")
                except Exception as e:
                    print(f"  [!]  {table_name}: {e}")
        else:
            print("  [!]  No hay tablas en la BD")

        cursor.close()
        conn.close()

    except Exception as e:
        results["precios"]["errors"].append(str(e))
        print(f"[ERR] Conexión fallida: {e}")
        print("\n   Causas posibles:")
        print("   - Servidor MySQL no accesible (10.10.4.175:3306)")
        print("   - Credenciales incorrectas (root / H4p!mK22yy$9)")
        print("   - BD 'precios' no existe")
        print("   - Firewall bloqueando")

else:
    print("[!]  mysql-connector-python no disponible. Salta verificación PRECIOS.")

# ──────────────────────────────────────────────────────────────────
# 3. Resumen
# ──────────────────────────────────────────────────────────────────

print("\n" + "=" * 70)
print("[SU] RESUMEN")
print("=" * 70)

if results["aurora"]["connection"]:
    aurora_status = "[OK] Conectada"
    n_tables = len([t for t in results["aurora"]["tables"].values() if t["exists"]])
    aurora_status += f" ({n_tables}/{len(AURORA_TABLES)} tablas)"
else:
    aurora_status = "[ERR] No conectada"

if results["precios"]["connection"]:
    precios_status = f"[OK] Conectada ({len(results['precios']['tables'])} tablas)"
else:
    precios_status = "[ERR] No conectada"

print(f"\nAURORA (SQL Server): {aurora_status}")
print(f"PRECIOS (MySQL):    {precios_status}")

if results["aurora"]["connection"] and results["aurora"]["products_lbk"] > 0:
    print(f"\n[TB] Datos Aurora encontrados: {results['aurora']['products_lbk']:,} artículos (LB+K)")
    print(f"   [OK] Demanda: OK")
    print(f"   [OK] Suministro: OK")
    print(f"   [OK] Inventario: OK")
    results["summary"] = "Verde: ambas BDs configuradas, AURORA con datos Aurora"
else:
    if not results["aurora"]["connection"]:
        results["summary"] = "Rojo: AURORA no conectada"
    elif results["aurora"]["products_lbk"] == 0:
        results["summary"] = "Amarillo: AURORA conectada pero sin datos Aurora (LB%/K%)"

print("\n" + "=" * 70)
print(f"Estado: {results['summary']}")
print("=" * 70)

# Save report
report_path = "verify_datasources_report.json"
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n[SAV] Reporte guardado: {report_path}")
print("\nRecomendaciones:")
if results["aurora"]["connection"] and results["aurora"]["products_lbk"] > 0:
    print("[OK] Ejecuta: npm run dev (backend) + npm run dev (frontend)")
    print("[OK] Luego verifica interfaz en http://localhost:5173")
else:
    print("[!]  Revisa conexión AURORA antes de iniciar backend")
    print("   - Verifica IP: 10.10.4.173\\SAGE")
    print("   - Usuario/contraseña: MRH / Aurora_2019_1+#")
    print("   - Instancia SAGE activa en SQL Server")
