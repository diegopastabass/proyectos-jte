import os
import re
import psycopg2
from dotenv import load_dotenv

# Obtener directorio actual
script_dir = os.path.dirname(os.path.abspath(__file__))
log_file_path = os.path.join(script_dir, "reporte_masivo.log")

# Cargar variables de entorno
load_dotenv()

def update_db_dates():
    # Establecer la conexión con la base de datos PostgreSQL
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT", "5432"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            dbname=os.getenv("DB_NAME"),
            sslmode=os.getenv("DB_SSLMODE", "require")
        )
        cursor = conn.cursor()
        print("Conexión a la base de datos establecida correctamente.")
    except Exception as e:
        print(f"Error conectando a la base de datos: {e}")
        return

    if not os.path.exists(log_file_path):
        print(f"No se encontró el archivo de log: {log_file_path}")
        return

    with open(log_file_path, "r", encoding="latin-1") as f:
        lines = f.readlines()

    current_date = None
    updated_count = 0

    print("Analizando archivo de log y corrigiendo registros...")
    
    for line in lines:
        # Extraer la fecha desde la línea de información de envío
        # Formato esperado: Enviando a DGA -> Fecha: YYYY-MM-DD
        date_match = re.search(r"Enviando a DGA -> Fecha:\s*(\d{4}-\d{2}-\d{2})", line)
        if date_match:
            current_date = date_match.group(1)

        # Extraer el comprobante desde la respuesta
        # Formato esperado: ... 'data': {'numeroComprobante': 'XBLG3Wt...'}
        comp_match = re.search(r"'numeroComprobante':\s*'([^']+)'", line)
        
        if comp_match and current_date:
            comprobante = comp_match.group(1)
            new_time = f"{current_date} 12:00:00"
            
            try:
                # Utilizamos ::jsonb por seguridad en caso de que la columna 'response' sea de tipo text o json
                update_query = """
                    UPDATE carracedo_reports
                    SET time = %s
                    WHERE (response::jsonb)->'data'->>'numeroComprobante' = %s;
                """
                cursor.execute(update_query, (new_time, comprobante))
                
                if cursor.rowcount > 0:
                    print(f"[OK] Comprobante {comprobante} actualizado a {new_time}")
                    updated_count += cursor.rowcount
                else:
                    print(f"[WARN] No se encontró el comprobante {comprobante} en la DB.")
                    
            except Exception as e:
                print(f"[ERROR] actualizando {comprobante}: {e}")
                conn.rollback() # Prevenir que la transacción entera aborte si un update falla
                continue
            
            # Resetear la fecha para el siguiente bloque de registros
            current_date = None
    
    # Aplicar todos los cambios
    conn.commit()

    print(f"\nProceso finalizado. Total de registros corregidos: {updated_count}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    update_db_dates()
