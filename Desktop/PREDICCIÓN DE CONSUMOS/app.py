import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import os
import sys
from data_processor import DataProcessor
from forecasting_engine import ForecastingEngine
from config import UI_CONFIG, EXCEL_FILES, FORECASTING_CONFIG
import warnings
warnings.filterwarnings('ignore')

# Configurar página
st.set_page_config(
    page_title=UI_CONFIG['page_title'],
    page_icon=UI_CONFIG['page_icon'],
    layout=UI_CONFIG['layout'],
    initial_sidebar_state=UI_CONFIG['initial_sidebar_state']
)

# CSS personalizado
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
        font-weight: bold;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #1f77b4;
    }
    .success-message {
        background-color: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #c3e6cb;
    }
    .error-message {
        background-color: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #f5c6cb;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def load_data_processor():
    """
    Carga el procesador de datos con los archivos Excel disponibles
    """
    excel_files = EXCEL_FILES
    
    # Filtrar archivos que existen
    existing_files = [f for f in excel_files if os.path.exists(f)]
    
    if not existing_files:
        st.error("No se encontraron archivos Excel en el directorio actual.")
        return None
    
    processor = DataProcessor(existing_files)
    return processor

@st.cache_data
def load_materials(_processor):
    """
    Carga todas las materias primas disponibles
    """
    if _processor is None:
        return {}
    
    with st.spinner("Cargando materias primas..."):
        materials = _processor.load_all_materials()
    
    return materials

def main():
    """
    Función principal de la aplicación
    """
    # Header
    st.markdown('<h1 class="main-header">📊 Sistema de Forecasting de Consumos</h1>', 
                unsafe_allow_html=True)
    
    # Cargar procesador de datos
    processor = load_data_processor()
    if processor is None:
        st.stop()
    
    # Cargar materias primas
    materials = load_materials(processor)
    
    if not materials:
        st.error("No se pudieron cargar las materias primas. Verifica que los archivos Excel contengan datos válidos.")
        st.stop()
    
    # Sidebar para selección
    st.sidebar.markdown("## 🔍 Selección de Materia Prima")

    # Mostrar estadísticas
    st.sidebar.markdown(f"**📁 Archivos cargados:** {len(set([m['file_name'] for m in materials.values()]))}")
    st.sidebar.markdown(f"**📋 Materias primas disponibles:** {len(materials)}")

    # Agrupar materias primas por bloque
    bloques = {}
    for key, info in materials.items():
        bloque = info['file_name']
        hoja = info['sheet']
        if bloque not in bloques:
            bloques[bloque] = []
        bloques[bloque].append((key, hoja))

    # Selector de bloque
    bloque_options = list(bloques.keys())
    selected_bloque = st.sidebar.selectbox(
        "Selecciona un bloque:",
        options=bloque_options,
        index=0 if bloque_options else None,
        help="Elige el bloque (archivo Excel)"
    )

    # Selector de materia prima (solo nombre de hoja)
    materia_options = bloques[selected_bloque] if selected_bloque else []
    materia_names = [hoja for _, hoja in materia_options]
    selected_materia_name = st.sidebar.selectbox(
        "Selecciona una materia prima:",
        options=materia_names,
        index=0 if materia_names else None,
        help="Elige la materia prima para la cual quieres generar el forecast"
    )
    # Obtener la clave interna
    selected_material = None
    for key, hoja in materia_options:
        if hoja == selected_materia_name:
            selected_material = key
            break

    # Configuración del forecast
    st.sidebar.markdown("## ⚙️ Configuración")
    horizonte_opciones = [
        ("1 semana", 1, "W"),
        ("2 semanas", 2, "W"),
        ("3 semanas", 3, "W"),
        ("1 mes", 1, "M"),
        ("2 meses", 2, "M"),
        ("3 meses", 3, "M")
    ]
    horizonte_labels = [x[0] for x in horizonte_opciones]
    selected_horizontes = st.sidebar.multiselect(
        "Horizontes de predicción:",
        options=horizonte_labels,
        default=[horizonte_labels[3]],
        help="Selecciona uno o varios horizontes de forecast"
    )
    # Botón para generar forecast
    generate_forecast = st.sidebar.button(
        "🚀 Generar Forecast",
        type="primary",
        help="Haz clic para generar el forecast"
    )
    
    # Contenido principal
    if selected_material:
        material_info = materials[selected_material]
        df = material_info['data']
        # Mostrar datos históricos o advertencia
        if df is None or df.empty or df['Unidades'].dropna().empty:
            st.warning("No hay datos válidos para esta materia prima. Verifica el Excel o selecciona otra.")
            return
        
        # Mostrar información de la materia prima seleccionada
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric(
                "Archivo",
                material_info['file_name']
            )
        
        with col2:
            st.metric(
                "Hoja",
                material_info['sheet']
            )
        
        with col3:
            data_points = len(material_info['data'])
            st.metric(
                "Puntos de datos",
                f"{data_points:,}"
            )
        
        # Mostrar datos históricos
        st.markdown("## 📈 Datos Históricos")
        
        # Gráfica de datos históricos
        fig_historical = go.Figure()
        
        fig_historical.add_trace(go.Scatter(
            x=df.index,
            y=df['Unidades'],
            mode='lines+markers',
            name='Datos Históricos',
            line=dict(color='blue', width=2),
            marker=dict(size=4)
        ))
        
        # Añadir media móvil dinámica (ventana 3)
        media_movil = df['Unidades'].rolling(window=3, min_periods=1).mean()
        fig_historical.add_trace(go.Scatter(
            x=df.index,
            y=media_movil,
            mode='lines',
            name='Media Móvil (3 semanas)',
            line=dict(color='purple', width=2, dash='dot')
        ))
        
        # Agregar umbrales si existen
        if 'rotura_min' in df.columns:
            fig_historical.add_trace(go.Scatter(
                x=df.index,
                y=df['rotura_min'],
                mode='lines',
                name='Umbral Rotura',
                line=dict(color='red', dash='dash', width=1),
                opacity=0.7
            ))
            
        if 'sobre_max' in df.columns:
            fig_historical.add_trace(go.Scatter(
                x=df.index,
                y=df['sobre_max'],
                mode='lines',
                name='Umbral Sobrestock',
                line=dict(color='green', dash='dash', width=1),
                opacity=0.7
            ))
        
        fig_historical.update_layout(
            title=f"Datos Históricos: {selected_material}",
            xaxis_title='Fecha',
            yaxis_title='Unidades',
            template='plotly_white',
            height=400
        )
        
        st.plotly_chart(fig_historical, use_container_width=True)
        
        # Estadísticas descriptivas
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Promedio", f"{df['Unidades'].mean():.2f}")
        
        with col2:
            st.metric("Máximo", f"{df['Unidades'].max():.2f}")
        
        with col3:
            st.metric("Mínimo", f"{df['Unidades'].min():.2f}")
        
        with col4:
            st.metric("Desv. Estándar", f"{df['Unidades'].std():.2f}")
        
        # Generar forecast si se solicita
        if generate_forecast and selected_horizontes:
            st.markdown("## 🔮 Generando Forecast...")
            
            # Inicializar motor de forecasting
            forecasting_engine = ForecastingEngine()
            
            # Mostrar progreso
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            all_results = {}
            all_future_dates = {}
            progress_step = int(100 / len(selected_horizontes))
            for idx, horizonte_label in enumerate(selected_horizontes):
                for label, value, unidad in horizonte_opciones:
                    if label == horizonte_label:
                        forecast_horizon = value
                        forecast_unit = unidad
                        break
                status_text.text(f"Configurando modelo para {horizonte_label}...")
                result = forecasting_engine.generate_forecast(
                    df=material_info['data'],
                    material_name=selected_material,
                    forecast_horizon=forecast_horizon,
                    forecast_unit=forecast_unit
                )
                all_results[horizonte_label] = result
                if result['success']:
                    all_future_dates[horizonte_label] = result['future_dates']
                progress_bar.progress(min(100, (idx+1)*progress_step))
            status_text.text("Finalizando...")
            
            st.markdown("## 📊 Resultados del Forecast")
            # Gráfica combinada
            fig = go.Figure()
            # Datos históricos
            fig.add_trace(go.Scatter(
                x=df.index,
                y=df['Unidades'],
                mode='lines+markers',
                name='Datos Históricos',
                line=dict(color='blue', width=2),
                marker=dict(size=4)
            ))
            # Media móvil
            media_movil = df['Unidades'].rolling(window=3, min_periods=1).mean()
            fig.add_trace(go.Scatter(
                x=df.index,
                y=media_movil,
                mode='lines',
                name='Media Móvil (3 semanas)',
                line=dict(color='purple', width=2, dash='dot')
            ))
            # Forecasts puntuales
            colores = ['#2ca02c', '#ff7f0e', '#9467bd', '#d62728', '#17becf', '#e377c2']
            for idx, (horizonte_label, result) in enumerate(all_results.items()):
                if result['success']:
                    fig.add_trace(go.Scatter(
                        x=result['future_dates'],
                        y=result['predictions'],
                        mode='markers',
                        name=f'Forecast {horizonte_label}',
                        marker=dict(color=colores[idx % len(colores)], size=16, symbol='diamond'),
                        showlegend=True
                    ))
            fig.update_layout(
                title=f"Forecasts: {selected_material}",
                xaxis_title='Fecha',
                yaxis_title='Unidades',
                template='plotly_white',
                height=500
            )
            st.plotly_chart(fig, use_container_width=True)
            # Tabla y CSV
            st.markdown("## 📋 Predicciones puntuales y fiabilidad")
            # Construir tabla de resultados
            rows = []
            for horizonte_label, result in all_results.items():
                if result['success']:
                    row = {
                        'Horizonte': horizonte_label,
                        'Fecha objetivo': result['future_dates'][0],
                        'Predicción': result['predictions'][0],
                        'RMSE': result['metrics']['rmse'],
                        'MAE': result['metrics']['mae'],
                        'MAPE': result['metrics']['mape'],
                    }
                    rows.append(row)
            pred_df = pd.DataFrame(rows)
            st.dataframe(pred_df, use_container_width=True)
            # Métricas de fiabilidad visuales
            st.markdown("## 🔎 Fiabilidad de cada forecast")
            for horizonte_label, result in all_results.items():
                if result['success']:
                    st.markdown(f"### {horizonte_label} - {result['future_dates'][0].strftime('%d/%m/%Y')}")
                    interpretaciones = result.get('interpretacion', {})
                    cols = st.columns(3)
                    for idx, metrica in enumerate(['rmse', 'mae', 'mape']):
                        interp = interpretaciones.get(metrica, {})
                        color = interp.get('color', 'gray')
                        icono = interp.get('icono', '❓')
                        texto = interp.get('texto', 'Sin interpretación disponible')
                        with cols[idx]:
                            st.markdown(
                                f"<div style='padding:0.7em;background-color:{color};color:white;border-radius:8px;margin:0.2em 0;font-size:1.1em;text-align:center'>"
                                f"<b>{icono} {metrica.upper()}: {texto}</b></div>",
                                unsafe_allow_html=True
                            )
            # Exportar CSV
            csv = pred_df.to_csv(index=False)
            st.download_button(
                label="📥 Descargar predicciones (CSV)",
                data=csv,
                file_name=f"forecast_{selected_material.replace(' ', '_')}.csv",
                mime="text/csv"
            )

if __name__ == "__main__":
    main() 