# Aurora S-Chain

App interna Aurora para visualizar el dashboard **EyeOn Stock** y el panel **KPIs por Área** del Strategy Map de Cadena de Suministro 2025, calculados directamente contra la base de datos AURORA (SQL Server).

- Stack: **Node.js + TypeScript** (backend) + **React + TypeScript (Vite)** (frontend).
- Login: mismo API que `aurora_app` (ERP Aurora), restringido a `fmorenob@auroracorp.es`.
- Estilo: guía oficial Aurora Intelligent Nutrition (`#0524de`, `#252eac`, `#6fc4fa`, `#f3f6fb`, Open Sans).
- Las métricas sin fuente de datos se muestran en **gris / bloqueado** con su explicación en la pestaña **Documentación**.

## Arranque rápido

```bash
# Backend
cd backend
cp ../.env.example .env
npm install
npm run dev   # http://localhost:8010

# Frontend (otra terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Ver `REFERENCE.md` para detalle completo.

## Escaneo de la BD

```bash
cd scripts
python scan_db.py    # genera scripts/output/db_scan.json
```

Requiere `pyodbc` y `python-dotenv` (heredables del venv de `aurora_app`).
