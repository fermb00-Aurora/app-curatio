import pandas as pd
import numpy as np
import os
from typing import Dict, List, Tuple, Optional
import warnings
from config import DATA_CONFIG
import re
warnings.filterwarnings('ignore')

class DataProcessor:
    def __init__(self, excel_files: List[str]):
        """
        Inicializa el procesador de datos con los archivos Excel
        
        Args:
            excel_files: Lista de rutas a archivos Excel
        """
        self.excel_files = excel_files
        self.materials_data = {}
        self.available_materials = []
        
    def load_all_materials(self) -> Dict[str, Dict]:
        """
        Carga todas las materias primas de todos los archivos Excel
        
        Returns:
            Diccionario con información de todas las materias primas
        """
        all_materials = {}
        
        for excel_file in self.excel_files:
            if not os.path.exists(excel_file):
                print(f"Archivo no encontrado: {excel_file}")
                continue
                
            try:
                xls = pd.ExcelFile(excel_file)
                file_name = os.path.basename(excel_file)
                
                for sheet_name in xls.sheet_names:
                    try:
                        df_raw = xls.parse(sheet_name)
                        
                        # Detectar columnas de fecha y unidades
                        cols = [str(c).lower() for c in df_raw.columns]
                        
                        if DATA_CONFIG['date_column'].lower() not in cols or DATA_CONFIG['unit_column'].lower() not in cols:
                            continue
                            
                        date_col = df_raw.columns[cols.index(DATA_CONFIG['date_column'].lower())]
                        unit_col = df_raw.columns[cols.index(DATA_CONFIG['unit_column'].lower())]
                        
                        # Preprocesar datos
                        df_processed = self._preprocess_data(df_raw, date_col, unit_col)
                        
                        if df_processed is not None and not df_processed.empty:
                            material_key = f"{file_name} - {sheet_name}"
                            all_materials[material_key] = {
                                'file': excel_file,
                                'sheet': sheet_name,
                                'data': df_processed,
                                'date_col': date_col,
                                'unit_col': unit_col,
                                'file_name': file_name
                            }
                            
                    except Exception as e:
                        print(f"Error procesando hoja {sheet_name} en {excel_file}: {str(e)}")
                        continue
                        
            except Exception as e:
                print(f"Error abriendo archivo {excel_file}: {str(e)}")
                continue
                
        self.materials_data = all_materials
        self.available_materials = list(all_materials.keys())
        return all_materials
    
    def _clean_unidades(self, val):
        if pd.isna(val):
            return np.nan
        s = str(val).replace(' ', '')
        # Si hay más de un punto, son miles
        if s.count('.') > 1:
            s = s.replace('.', '')
        # Si hay coma y punto, quitar puntos y cambiar coma a punto
        if ',' in s and '.' in s:
            s = s.replace('.', '').replace(',', '.')
        # Si solo hay comas, cambiar a punto
        elif ',' in s:
            s = s.replace(',', '.')
        # Si solo hay puntos y uno solo, dejarlo (decimal)
        # Si solo hay puntos y más de uno, quitar todos
        elif s.count('.') > 1:
            s = s.replace('.', '')
        try:
            return float(s)
        except Exception:
            return np.nan

    def _preprocess_data(self, df: pd.DataFrame, date_col: str, unit_col: str) -> Optional[pd.DataFrame]:
        try:
            df.columns = df.columns.map(str)
            # Excluir CodigoArticulo si existe
            cols_to_use = [c for c in df.columns if c.lower() != 'codigoarticulo']
            df = df[cols_to_use].copy()
            # Parsear fecha
            df[date_col] = pd.to_datetime(df[date_col], dayfirst=True, errors='coerce')
            df[unit_col] = df[unit_col].apply(self._clean_unidades)
            df = df.dropna(subset=[date_col, unit_col])
            df = df.sort_values(date_col)
            if df.empty:
                print('Advertencia: No hay datos válidos tras limpieza de unidades/fechas')
                return None
            df = df.set_index(date_col)
            # Reagrupar a frecuencia semanal (sumando las unidades y promediando el resto)
            agg_dict = {col: 'sum' if col == unit_col else 'mean' for col in df.columns}
            df = df.resample('W-MON').agg(agg_dict)
            df[unit_col] = df[unit_col].interpolate()
            window = min(DATA_CONFIG['iqr_window'], len(df) // 2)
            if window > 0:
                Q1 = df[unit_col].rolling(window).quantile(0.25)
                Q3 = df[unit_col].rolling(window).quantile(0.75)
                IQR = Q3 - Q1
                df['rotura_min'] = (Q1 - DATA_CONFIG['iqr_multiplier'] * IQR).clip(lower=0)
                df['sobre_max'] = Q3 + DATA_CONFIG['iqr_multiplier'] * IQR
            else:
                df['rotura_min'] = 0
                df['sobre_max'] = df[unit_col].max() * 1.5
            if df[unit_col].dropna().empty:
                print('Advertencia: No hay datos numéricos válidos tras limpieza final')
                return None
            return df
        except Exception as e:
            print(f"Error en preprocesamiento: {str(e)}")
            return None
    
    def get_material_data(self, material_key: str) -> Optional[pd.DataFrame]:
        """
        Obtiene los datos de una materia prima específica
        
        Args:
            material_key: Clave de la materia prima
            
        Returns:
            DataFrame con los datos o None si no existe
        """
        if material_key in self.materials_data:
            return self.materials_data[material_key]['data']
        return None
    
    def get_material_info(self, material_key: str) -> Optional[Dict]:
        """
        Obtiene información de una materia prima específica
        
        Args:
            material_key: Clave de la materia prima
            
        Returns:
            Diccionario con información o None si no existe
        """
        return self.materials_data.get(material_key) 