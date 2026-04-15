import pandas as pd
import numpy as np
import plotly.graph_objs as go
from typing import Dict
import datetime
import warnings
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
warnings.filterwarnings('ignore')

class ForecastingEngine:
    def __init__(self):
        pass

    def generate_forecast(self, df: pd.DataFrame, material_name: str, forecast_horizon: int = 4, forecast_unit: str = 'M') -> Dict:
        try:
            data_series = df['Unidades']
            if len(data_series) < 12:
                return {
                    'success': False,
                    'error': f"Se requieren al menos 12 puntos de datos. Actuales: {len(data_series)}",
                    'predictions': None,
                    'ma_forecast': None,
                    'future_dates': None,
                    'metrics': None,
                    'plot': None,
                    'data_points': len(data_series)
                }
            # SIEMPRE usar la fecha actual como punto de partida para el horizonte de predicción
            today = pd.Timestamp(datetime.datetime.now().date())
            
            # Calcular las fechas futuras desde hoy
            if forecast_unit == 'W':
                # Para semanas: sumar 7, 14, 21 días desde hoy
                future_dates = pd.date_range(start=today, periods=forecast_horizon, freq='W-MON')
            else:  # 'M'
                # Para meses: sumar 1, 2, 3 meses desde hoy
                future_dates = pd.date_range(start=today, periods=forecast_horizon, freq='M')
            
            # Log para verificar el cálculo de fechas
            print(f"DEBUG: Horizonte de predicción: {forecast_horizon} {forecast_unit}")
            print(f"DEBUG: Fecha de inicio (hoy): {today}")
            print(f"DEBUG: Fechas calculadas: {future_dates}")
            print(f"DEBUG: Fecha objetivo final: {future_dates[-1]}")
            # Solo usar media móvil para 2 y 3 meses
            if forecast_unit == 'M' and forecast_horizon in [2, 3]:
                return self._media_movil_forecast(df, material_name, forecast_horizon, future_dates, data_series)
            # Para cualquier otro horizonte, usar solo PyCaret
            return self._pycaret_forecast(df, material_name, forecast_horizon, future_dates, data_series)
        except Exception as e:
            return {
                'success': False,
                'error': f"Error en forecasting: {str(e)}",
                'predictions': None,
                'ma_forecast': None,
                'future_dates': None,
                'metrics': None,
                'plot': None,
                'data_points': len(df['Unidades']) if 'Unidades' in df.columns else 0
            }

    def _media_movil_forecast(self, df, material_name, forecast_horizon, future_dates, data_series):
        """Forecast usando solo media móvil para 2-3 meses/semanas"""
        # Log para verificar las fechas calculadas
        print(f"DEBUG: Fecha actual: {pd.Timestamp.now().date()}")
        print(f"DEBUG: Fechas futuras calculadas: {future_dates}")
        print(f"DEBUG: Fecha objetivo final: {future_dates[-1]}")
        
        # Media móvil de 3 periodos
        media_movil = data_series.rolling(window=3, min_periods=1).mean()
        ultimo_valor_mm = media_movil.iloc[-1]
        
        # Predicción puntual para la fecha objetivo (calculada desde hoy)
        predictions = [ultimo_valor_mm]
        
        # Log para verificar la predicción
        print(f"DEBUG: Predicción Media Móvil para {future_dates[-1]}: {ultimo_valor_mm}")
        
        # Calcular métricas
        metrics = self._calculate_metrics(data_series, [ultimo_valor_mm])
        
        # Crear gráfica (solo el punto)
        fig = self._create_forecast_plot(
            df, {'predictions': predictions, 'info': {'model_name': 'Media Móvil'}},
            predictions, [future_dates[-1]], material_name, metrics, {'ma': predictions},
            ma_full=media_movil
        )
        interpretacion = self._interpretar_metricas(metrics, data_series)
        
        return {
            'success': True,
            'predictions': predictions,
            'ma_forecast': predictions,
            'future_dates': [future_dates[-1]],  # Esta es la fecha calculada desde hoy
            'metrics': metrics,
            'plot': fig,
            'model_info': {'model_name': 'Media Móvil'},
            'interpretacion': interpretacion,
            'data_points': len(data_series)
        }

    def _pycaret_forecast(self, df, material_name, forecast_horizon, future_dates, data_series):
        """Forecast usando PyCaret exclusivamente"""
        try:
            from pycaret.time_series import setup, compare_models, predict_model
            
            # Log para verificar las fechas calculadas
            print(f"DEBUG: Fecha actual: {pd.Timestamp.now().date()}")
            print(f"DEBUG: Fechas futuras calculadas: {future_dates}")
            print(f"DEBUG: Fecha objetivo final: {future_dates[-1]}")
            
            feature_cols = [col for col in df.columns if col not in ['rotura_min', 'sobre_max']]
            ts_df = df[feature_cols].copy().reset_index()
            ts_df = ts_df.rename(columns={ts_df.columns[0]: 'ds', 'Unidades': 'y'})
            ts_df = ts_df.set_index('ds')
            target = 'y'
            
            exp = setup(
                data=ts_df,
                target=target,
                session_id=42,
                fold=3,
                fh=forecast_horizon,
                verbose=False,
                n_jobs=1,
                html=False,
                numeric_imputation_target='mean',
                numeric_imputation_exogenous='mean'
            )
            
            best_model = compare_models(sort='MAE', turbo=True, n_select=1)
            future_preds = predict_model(best_model, fh=forecast_horizon)
            
            # Tomar solo la predicción para la última fecha objetivo (que es la fecha calculada desde hoy)
            pred_value = future_preds['y_pred'].values[-1]
            
            # Log para verificar la predicción
            print(f"DEBUG: Predicción para {future_dates[-1]}: {pred_value}")
            
            metrics = self._calculate_metrics(data_series, [pred_value])
            fig = self._create_forecast_plot(
                df, {'predictions': [pred_value], 'info': {'model_name': str(best_model)}},
                [pred_value], [future_dates[-1]], material_name, metrics, {'pycaret': [pred_value]}
            )
            interpretacion = self._interpretar_metricas(metrics, data_series)
            
            return {
                'success': True,
                'predictions': [pred_value],
                'ma_forecast': [pred_value],
                'future_dates': [future_dates[-1]],  # Esta es la fecha calculada desde hoy
                'metrics': metrics,
                'plot': fig,
                'model_info': {'model_name': str(best_model)},
                'interpretacion': interpretacion,
                'data_points': len(data_series)
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Error en PyCaret: {str(e)}",
                'predictions': None,
                'ma_forecast': None,
                'future_dates': None,
                'metrics': None,
                'plot': None,
                'model_info': {'model_name': 'PyCaret'},
                'interpretacion': {},
                'data_points': len(data_series)
            }

    def _try_exponential_smoothing(self, data_series, forecast_horizon):
        """Probar modelo de suavizado exponencial"""
        try:
            model = ExponentialSmoothing(data_series, seasonal_periods=min(12, len(data_series)//2))
            fitted_model = model.fit()
            predictions = fitted_model.forecast(forecast_horizon)
            return predictions.values
        except:
            return None

    def _try_arima(self, data_series, forecast_horizon):
        """Probar modelo ARIMA"""
        try:
            # Usar ARIMA(1,1,1) como punto de partida
            model = ARIMA(data_series, order=(1, 1, 1))
            fitted_model = model.fit()
            predictions = fitted_model.forecast(forecast_horizon)
            return predictions.values
        except:
            return None

    def _try_media_movil(self, data_series, forecast_horizon):
        """Probar media móvil"""
        try:
            media_movil = data_series.rolling(window=3, min_periods=1).mean()
            ultimo_valor = media_movil.iloc[-1]
            return [ultimo_valor] * forecast_horizon
        except:
            return None

    def _calculate_metrics(self, actual, predicted):
        """Calcular métricas de error"""
        if len(actual) != len(predicted):
            # Si tienen diferentes longitudes, usar solo los últimos puntos
            min_len = min(len(actual), len(predicted))
            actual = actual[-min_len:]
            predicted = predicted[-min_len:]
        
        # Calcular errores
        errors = np.array(actual) - np.array(predicted)
        
        # RMSE
        rmse = np.sqrt(np.mean(errors**2))
        
        # MAE
        mae = np.mean(np.abs(errors))
        
        # MAPE
        mape = np.mean(np.abs(errors / np.array(actual))) * 100
        
        return {
            'rmse': rmse,
            'mae': mae,
            'mape': mape
        }

    def _create_forecast_plot(self, df, best_model, ma_forecast, future_dates, material_name, metrics, all_predictions, ma_full=None):
        """Crear gráfica de forecast"""
        import plotly.graph_objs as go
        
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
        
        # Media móvil de 3 periodos (histórico + forecast)
        if ma_full is not None:
            fig.add_trace(go.Scatter(
                x=ma_full.index,
                y=ma_full.values,
                mode='lines',
                name='Media Móvil (3 semanas)',
                line=dict(color='purple', width=2, dash='dot')
            ))
        
        # Predicciones
        if best_model and 'predictions' in best_model:
            predictions = best_model['predictions']
            fig.add_trace(go.Scatter(
                x=future_dates,
                y=predictions,
                mode='lines+markers',
                name=f"Forecast ({best_model['info']['model_name']})",
                line=dict(color='red', width=2),
                marker=dict(size=6)
            ))
        
        # Configurar layout
        fig.update_layout(
            title=f'Forecast de Consumo - {material_name}',
            xaxis_title='Fecha',
            yaxis_title='Unidades',
            hovermode='x unified',
            showlegend=True
        )
        
        return fig

    def _interpretar_metricas(self, metrics, data_series=None):
        """
        Interpreta la fiabilidad de cada métrica individualmente
        
        Args:
            metrics: Diccionario con métricas (rmse, mae, mape)
            data_series: Serie de datos históricos para calcular umbrales relativos
            
        Returns:
            Diccionario con interpretaciones de cada métrica
        """
        interpretaciones = {}
        
        # Interpretación MAPE
        mape = metrics.get('mape', 0)
        if mape < 10:
            interpretaciones['mape'] = {
                'texto': f"MAPE: {mape:.1f}% - Muy fiable (error < 10%)",
                'color': 'green',
                'icono': '✅'
            }
        elif mape < 20:
            interpretaciones['mape'] = {
                'texto': f"MAPE: {mape:.1f}% - Fiable (error 10-20%)",
                'color': 'orange',
                'icono': '⚠️'
            }
        elif mape < 30:
            interpretaciones['mape'] = {
                'texto': f"MAPE: {mape:.1f}% - Precaución (error 20-30%)",
                'color': 'orange',
                'icono': '⚠️'
            }
        else:
            interpretaciones['mape'] = {
                'texto': f"MAPE: {mape:.1f}% - Poco fiable (error > 30%)",
                'color': 'red',
                'icono': '❌'
            }
        
        # Interpretación MAE y RMSE (si hay datos históricos)
        if data_series is not None:
            promedio_historico = data_series.mean()
            
            # MAE
            mae = metrics.get('mae', 0)
            mae_porcentaje = (mae / promedio_historico) * 100 if promedio_historico > 0 else 0
            
            if mae_porcentaje < 10:
                interpretaciones['mae'] = {
                    'texto': f"MAE: {mae:.1f} unidades ({mae_porcentaje:.1f}% del promedio) - Muy fiable",
                    'color': 'green',
                    'icono': '✅'
                }
            elif mae_porcentaje < 20:
                interpretaciones['mae'] = {
                    'texto': f"MAE: {mae:.1f} unidades ({mae_porcentaje:.1f}% del promedio) - Fiable",
                    'color': 'orange',
                    'icono': '⚠️'
                }
            elif mae_porcentaje < 30:
                interpretaciones['mae'] = {
                    'texto': f"MAE: {mae:.1f} unidades ({mae_porcentaje:.1f}% del promedio) - Precaución",
                    'color': 'orange',
                    'icono': '⚠️'
                }
            else:
                interpretaciones['mae'] = {
                    'texto': f"MAE: {mae:.1f} unidades ({mae_porcentaje:.1f}% del promedio) - Poco fiable",
                    'color': 'red',
                    'icono': '❌'
                }
            
            # RMSE
            rmse = metrics.get('rmse', 0)
            rmse_porcentaje = (rmse / promedio_historico) * 100 if promedio_historico > 0 else 0
            
            if rmse_porcentaje < 10:
                interpretaciones['rmse'] = {
                    'texto': f"RMSE: {rmse:.1f} unidades ({rmse_porcentaje:.1f}% del promedio) - Muy fiable",
                    'color': 'green',
                    'icono': '✅'
                }
            elif rmse_porcentaje < 20:
                interpretaciones['rmse'] = {
                    'texto': f"RMSE: {rmse:.1f} unidades ({rmse_porcentaje:.1f}% del promedio) - Fiable",
                    'color': 'orange',
                    'icono': '⚠️'
                }
            elif rmse_porcentaje < 30:
                interpretaciones['rmse'] = {
                    'texto': f"RMSE: {rmse:.1f} unidades ({rmse_porcentaje:.1f}% del promedio) - Precaución",
                    'color': 'orange',
                    'icono': '⚠️'
                }
            else:
                interpretaciones['rmse'] = {
                    'texto': f"RMSE: {rmse:.1f} unidades ({rmse_porcentaje:.1f}% del promedio) - Poco fiable",
                    'color': 'red',
                    'icono': '❌'
                }
        
        return interpretaciones 