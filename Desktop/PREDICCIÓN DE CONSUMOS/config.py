# -*- coding: utf-8 -*-
"""
Configuración del Sistema de Forecasting de Consumos
"""

# Configuración de archivos Excel
EXCEL_FILES = [
    "consumos/CONSUMOS BLOQUE CHOCOLATES.xlsx",
    "consumos/CONSUMOS BLOQUE FRUTOS SECOS.xlsx",
    "consumos/CONSUMOS BLOQUE PROTEINAS.xlsx",
    "consumos/CONSUMOS BLOQUE VARIOS.xlsx"
]

# Configuración de modelos de forecasting
FORECASTING_CONFIG = {
    'min_data_points': 12,
    'max_forecast_horizon': 12,
    'default_forecast_horizon': 4,
    'models': ['exponential', 'arima', 'seasonal']
}

# Configuración de la interfaz
UI_CONFIG = {
    'page_title': "Sistema de Forecasting de Consumos",
    'page_icon': "📊",
    'layout': "wide",
    'initial_sidebar_state': "expanded",
    'max_upload_size': 200 * 1024 * 1024  # 200MB
}

# Configuración de gráficas
PLOT_CONFIG = {
    'template': 'plotly_white',
    'height': 500,
    'colors': {
        'historical': '#1f77b4',
        'forecast': '#2ca02c',
        'ma_forecast': '#9467bd',
        'rotura': '#d62728',
        'sobrestock': '#ff7f0e'
    }
}

# Configuración de métricas
METRICS_CONFIG = {
    'decimal_places': 2,
    'percentage_decimal_places': 1
}

# Configuración de procesamiento de datos
DATA_CONFIG = {
    'date_column': 'FechaRegistro',
    'unit_column': 'Unidades',
    'interpolation_method': 'linear',
    'iqr_window': 12,
    'iqr_multiplier': 1.5
} 