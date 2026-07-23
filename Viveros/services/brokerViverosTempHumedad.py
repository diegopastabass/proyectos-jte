import os
import time
import logging
import requests
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, 'telemetria.log')

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format='%(asctime)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Conexion BD
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            dbname=os.getenv("DB_NAME"),
            sslmode='require'
        )
        return conn
    except Exception as e:
        logging.error(f"[ERROR] Conexion DB fallida: {e}")
        return None

# Fetch API
def fetch_weather_data():
    url = f"{os.getenv('API_URL_OPEN_METEO')}?latitude={os.getenv('LAT')}&longitude={os.getenv('LNG')}&current=temperature_2m,relative_humidity_2m"
    try:
        response = requests.get(url, timeout=10)
        
        try:
            data = response.json()
        except ValueError:
            logging.error(f"[ERROR] La respuesta no es JSON válido. Texto: {response.text}")
            return None, None

        if 'current' in data:
            logging.info("[FETCH] [SUCCESS] Datos leídos correctamente")
            return data['current']['temperature_2m'], data['current']['relative_humidity_2m']
        else:
            logging.error(f"[ERROR] Respuesta inesperada de la API: {data}")
            return None, None

    except Exception as e:
        logging.error(f"[ERROR] Fallo al conectar o procesar API: {e}")
        return None, None

# Insercion
def insert_data(conn, temp, hum):
    try:
        cursor = conn.cursor()
        table_name = os.getenv("DB_TABLE")
        
        query = sql.SQL("""
            INSERT INTO {} (sensor_id, value, time)
            VALUES 
            (7, %s, NOW()),
            (8, %s, NOW())
        """).format(sql.Identifier(table_name))
        
        cursor.execute(query, (temp, hum))
        conn.commit()
        cursor.close()
        logging.info("[INSERT] [SUCCESS] Insercion exitosa")
    except Exception as e:
        conn.rollback()
        logging.error(f"[ERROR] Fallo al insertar registros: {e}")

# Main
def main():
    logging.info("[INFO] Iniciando servicio")
    frecuencia = int(os.getenv("FREC_MUESTREO", 300))
    
    while True:
        temp, hum = fetch_weather_data()
        
        if temp is not None and hum is not None:
            conn = get_db_connection()
            if conn:
                insert_data(conn, temp, hum)
                conn.close()
        
        time.sleep(frecuencia)

if __name__ == "__main__":
    main()