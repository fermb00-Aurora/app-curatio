# Sistema de Forecasting de Consumos

## Descripción
Sistema de predicción de consumos de materias primas basado en datos históricos de Excel, con interfaz web desarrollada en Streamlit.

## Características
- **Procesamiento automático** de archivos Excel con múltiples hojas
- **Forecasting inteligente** usando PyCaret para selección automática del mejor modelo
- **Media móvil** para horizontes de 2-3 meses
- **Frecuencia semanal** de datos
- **Interfaz intuitiva** con visualizaciones interactivas
- **Métricas de fiabilidad** (MAPE, MAE, RMSE) con interpretación automática

## Estructura del Proyecto
```
PREDICCIÓN DE CONSUMOS/
├── app.py                 # Interfaz principal de Streamlit
├── forecasting_engine.py  # Motor de forecasting con PyCaret
├── data_processor.py      # Procesamiento de datos Excel
├── config.py             # Configuración de la aplicación
├── requirements.txt      # Dependencias de Python
├── README.md            # Este archivo
└── consumos/            # Carpeta con archivos Excel
    ├── CONSUMOS BLOQUE CHOCOLATES.xlsx
    ├── CONSUMOS BLOQUE FRUTOS SECOS.xlsx
    ├── CONSUMOS BLOQUE PROTEINAS.xlsx
    └── CONSUMOS BLOQUE VARIOS.xlsx
```

## Instalación
1. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```

2. Ejecutar la aplicación:
   ```bash
   streamlit run app.py
   ```

## Uso
1. Seleccionar el bloque de materias primas
2. Seleccionar la materia prima específica
3. Elegir el horizonte de predicción
4. Generar el forecast
5. Revisar métricas de fiabilidad y descargar resultados

## Modelos de Forecasting
- **1, 2, 3 semanas y 1 mes**: PyCaret (selección automática del mejor modelo)
- **2 y 3 meses**: Media móvil de 3 periodos 