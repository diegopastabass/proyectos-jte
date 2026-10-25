import pandas as pd

def check_csv_data(file_path):
    print(f"Analyzing {file_path}...\n")
    try:
        # Read the CSV
        df = pd.read_csv(file_path)
        
        # The date column name is "Fecha Medición"
        date_column = 'Fecha Medición'
        
        if date_column not in df.columns:
            print(f"Error: Column '{date_column}' not found in the CSV.")
            return

        # Convert to datetime object
        df[date_column] = pd.to_datetime(df[date_column], format='%d/%m/%Y')
        
        # 1. Check for duplicate dates
        duplicates = df[df.duplicated(subset=[date_column], keep=False)]
        if not duplicates.empty:
            print("1. Fechas repetidas encontradas:")
            for date, group in duplicates.groupby(date_column):
                print(f"  - {date.strftime('%d/%m/%Y')} tiene {len(group)} mediciones.")
        else:
            print("1. No se encontraron fechas con datos repetidos.")
            
        print("-" * 40)
        
        # 2. Check for missing days
        min_date = df[date_column].min()
        max_date = df[date_column].max()
        
        # Create a complete date range between min and max date
        expected_dates = pd.date_range(start=min_date, end=max_date)
        
        # Find dates that are in expected_dates but not in the dataframe
        actual_dates = df[date_column].unique()
        missing_dates = expected_dates.difference(actual_dates)
        
        if not missing_dates.empty:
            print(f"2. Se encontraron {len(missing_dates)} días sin datos entre {min_date.strftime('%d/%m/%Y')} y {max_date.strftime('%d/%m/%Y')}:")
            for d in missing_dates:
                print(f"  - Falta dato el día: {d.strftime('%d/%m/%Y')}")
        else:
            print("2. No hay días sin datos en el rango evaluado.")
            
    except Exception as e:
        print(f"Error procesando el archivo: {e}")

if __name__ == "__main__":
    file_name = 'carracedo_niv_tot_caud_2026.csv'
    check_csv_data(file_name)
