import sys
import json
import pandas as pd

def process_excel(file_path):
    """
    Process an Excel file to extract sales data and convert it to JSON format.
    Expected columns for Datos ventas:
    Fecha, Hora, Vendedor, Código, Cliente / Descripción, Tipo, TA, Uni., P.Ant., P.V.P.,
    Imp. Bruto, Dto., Imp. Neto, Número Doc., R.P., Fact., A Cuenta, Entrega, Devoluc., Tipo de Pago
    """
    try:
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Define expected columns
        expected_columns = [
            'Fecha', 'Hora', 'Vendedor', 'Código', 'Cliente / Descripción', 'Tipo', 'TA',
            'Uni.', 'P.Ant.', 'P.V.P.', 'Imp. Bruto', 'Dto.', 'Imp. Neto', 'Número Doc.',
            'R.P.', 'Fact.', 'A Cuenta', 'Entrega', 'Devoluc.', 'Tipo de Pago'
        ]
        
        # Check for missing columns
        missing_columns = [col for col in expected_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f'Missing required columns in Excel file: {missing_columns}')
        
        # Rename columns to match Supabase schema (replace spaces and special characters)
        df = df.rename(columns={
            'Cliente / Descripción': 'Cliente_Descripción',
            'Uni.': 'Uni',
            'P.Ant.': 'P_Ant',
            'P.V.P.': 'P_V_P',
            'Imp. Bruto': 'Imp_Bruto',
            'Dto.': 'Dto',
            'Imp. Neto': 'Imp_Neto',
            'Número Doc.': 'Número_Doc',
            'R.P.': 'R_P',
            'Fact.': 'Fact',
            'A Cuenta': 'A_Cuenta',
            'Devoluc.': 'Devoluc',
            'Tipo de Pago': 'Tipo_de_Pago'
        })
        
        # Convert DataFrame to list of dictionaries
        sales_data = df.to_dict('records')
        
        # Convert any non-serializable objects (like dates) to string
        for record in sales_data:
            if pd.api.types.is_datetime64_any_dtype(record['Fecha']):
                record['Fecha'] = record['Fecha'].isoformat()
            if 'Hora' in record and pd.api.types.is_datetime64_any_dtype(record['Hora']):
                record['Hora'] = record['Hora'].isoformat()
        
        return json.dumps(sales_data)
    except Exception as e:
        return json.dumps({'error': str(e)})

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Please provide the path to the Excel file as an argument'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = process_excel(file_path)
    print(result) 