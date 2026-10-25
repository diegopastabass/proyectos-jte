import csv
import requests
import os
import sys
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

# Obtener directorio actual
script_dir = os.path.dirname(os.path.abspath(__file__))
log_file_path = os.path.join(script_dir, "reporte_masivo.log")

# Configuración de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path),
        logging.StreamHandler()
    ]
)

# Cargar variables de entorno del archivo .env
load_dotenv()

# Puerto de la API California (por defecto 3034)
API_PORT = os.getenv('API_PORT', '3034')

# Divisores de métricas para California:
# - Freático: Si los datos en el CSV vienen en centímetros, se dividen por 100 para obtener metros (m).
# - Totalizador: Si los datos en el CSV vienen en decalitros (0.1 m³), se dividen por 10 para obtener m³.
#   Si el CSV ya viene en m³, puede ajustarse DIVISOR_TOTALIZADOR=1 en el .env.
# - Caudal: Viene en litros/segundo (l/s), divisor por defecto 1.
DIVISOR_FREATICO = float(os.getenv('DIVISOR_FREATICO', '1'))
DIVISOR_TOTALIZADOR = float(os.getenv('DIVISOR_TOTALIZADOR', '10'))
DIVISOR_CAUDAL = float(os.getenv('DIVISOR_CAUDAL', '100'))

# Delay de 5 minutos (300 segundos) entre envíos para cumplir con la tasa y no saturar la DGA
DELAY_SECONDS = int(os.getenv('DELAY_SECONDS', '300'))

def normalize_date(raw_date):
    """Convierte cualquier formato DD/MM/YYYY, YYYY/MM/DD, DD-MM-YYYY a YYYY-MM-DD."""
    raw = raw_date.strip()
    if '/' in raw:
        parts = raw.split('/')
        if len(parts[0]) == 4:
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    elif '-' in raw:
        parts = raw.split('-')
        if len(parts[0]) == 4:
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return raw

def normalize_time(raw_time):
    """Asegura formato HH:MM:SS."""
    parts = raw_time.strip().split(':')
    if len(parts) == 3:
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2)}"
    elif len(parts) == 2:
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"
    return raw_time.strip()

def get_existing_reports():
    """Obtiene los reportes ya almacenados en la API para evitar reenvíos."""
    url = f"http://127.0.0.1:{API_PORT}/reports?start=2020-01-01&end=2035-12-31"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logging.error(f"Error obteniendo reportes existentes de la API local: {e}")
    return []

def send_massive_report(csv_file_path):
    if not os.path.exists(csv_file_path):
        logging.error(f"El archivo CSV {csv_file_path} no existe.")
        return

    existing_reports = get_existing_reports()
    reported_times = set()
    for r in existing_reports:
        if r.get('time'):
            try:
                time_str = str(r['time']).replace('Z', '+00:00')
                dt = datetime.fromisoformat(time_str)
                reported_times.add(int(dt.timestamp()))
            except Exception:
                pass

    logging.info(f"Se encontraron {len(reported_times)} reportes ya registrados en la base de datos.")
    logging.info(f"Divisores configurados -> Freatico: {DIVISOR_FREATICO}, Caudal: {DIVISOR_CAUDAL}, Totalizador: {DIVISOR_TOTALIZADOR}")
    logging.info(f"Pausa entre solicitudes: {DELAY_SECONDS // 60} minutos ({DELAY_SECONDS}s)")

    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.reader(file)
        # Encabezado esperado: Código OB, Fecha Medición, Hora Medición, Caudal, Totalizador, Nivel Freático
        header = next(reader, None)
        logging.info(f"Encabezado del CSV: {header}")

        registros_procesados = 0
        for row in reader:
            if len(row) < 6:
                continue

            codigo_ob = row[0].strip()
            fecha_medicion_raw = row[1].strip()
            hora_medicion_raw = row[2].strip()
            caudal_raw = row[3].strip()
            totalizador_raw = row[4].strip()
            nivel_freatico_raw = row[5].strip()

            fecha_medicion = normalize_date(fecha_medicion_raw)
            hora_medicion = normalize_time(hora_medicion_raw)

            # Validar si ya fue reportado previamente
            timestamp_iso = f"{fecha_medicion}T{hora_medicion}-03:00"
            try:
                dt_current = datetime.fromisoformat(timestamp_iso)
                if int(dt_current.timestamp()) in reported_times:
                    logging.info(f"Registro omitido (ya reportado): {fecha_medicion} {hora_medicion}")
                    continue
            except Exception as e:
                logging.warning(f"Error evaluando timestamp para omisión ({timestamp_iso}): {e}")

            # Conversión y aplicación de divisores
            try:
                caudal_val = float(caudal_raw) / DIVISOR_CAUDAL
                totalizador_val = float(totalizador_raw) / DIVISOR_TOTALIZADOR
                nivel_freatico_val = float(nivel_freatico_raw) / DIVISOR_FREATICO
            except ValueError as e:
                logging.error(f"Error convirtiendo valores numéricos en fila {row}: {e}")
                continue

            payload = {
                "autenticacion": {
                    "rutEmpresa": os.getenv('DGA_RUT_EMPRESA'),
                    "rutUsuario": os.getenv('DGA_RUT_USUARIO'),
                    "password": os.getenv('DGA_PASSWORD')
                },
                "medicionSubterranea": {
                    "fechaMedicion": fecha_medicion,
                    "horaMedicion": hora_medicion,
                    "totalizador": f"{int(totalizador_val)}",
                    "caudal": f"{float(caudal_val):.2f}",
                    "nivelFreaticoDelPozo": f"{nivel_freatico_val:.2f}"
                }
            }

            headers = {
                "Content-Type": "application/json",
                "codigoObra": os.getenv('DGA_CODIGO_OBRA', codigo_ob),
                "timeStampOrigen": datetime.now().strftime("%Y-%m-%dT%H:%M:%S-03:00")
            }

            logging.info(
                f"Enviando a DGA -> Fecha: {fecha_medicion} {hora_medicion} | "
                f"Caudal: {caudal_val:.2f} l/s, Totalizador: {int(totalizador_val)} m3, Nivel: {nivel_freatico_val:.2f} m"
            )

            dga_response_data = {}
            try:
                resp = requests.post(
                    os.getenv('DGA_API_URL'),
                    json=payload,
                    headers=headers,
                    timeout=15
                )

                try:
                    dga_response_data = resp.json()
                except ValueError:
                    dga_response_data = {"raw_text": resp.text}

                if resp.status_code == 200:
                    logging.info(f"Éxito DGA (200). Respuesta: {dga_response_data}")
                else:
                    logging.warning(f"Advertencia DGA ({resp.status_code}). Respuesta: {dga_response_data}")

            except Exception as e:
                logging.error(f"Error crítico enviando a DGA: {e}")
                dga_response_data = {"exception": str(e)}

            # Guardar respaldo en la base de datos local con el timestamp original de la medición
            try:
                logging.info(f"Guardando respaldo en DB local para fecha {fecha_medicion} {hora_medicion}...")
                audit_payload = {
                    "freatico": float(nivel_freatico_val),
                    "caudal": float(caudal_val),
                    "totalizador": float(totalizador_val),
                    "response": dga_response_data,
                    "time": timestamp_iso
                }

                audit_url = f"http://127.0.0.1:{API_PORT}/reports"
                audit_headers = {
                    "Content-Type": "application/json",
                    "x-api-password": os.getenv('REPORTS_API_PASSWORD', '')
                }

                audit_resp = requests.post(audit_url, json=audit_payload, headers=audit_headers, timeout=10)

                if audit_resp.status_code == 201:
                    logging.info("Respaldo local guardado correctamente.")
                    # Añadir a reported_times para evitar duplicados en la misma ejecución
                    try:
                        reported_times.add(int(dt_current.timestamp()))
                    except Exception:
                        pass
                else:
                    logging.error(f"Error guardando respaldo local: {audit_resp.status_code} - {audit_resp.text}")

            except Exception as e:
                logging.error(f"Excepción guardando respaldo local: {e}")

            registros_procesados += 1

            # Pausa de 5 minutos entre envíos para cumplir con la cuota de la DGA
            logging.info(f"Pausa de {DELAY_SECONDS // 60} minutos ({DELAY_SECONDS}s) antes del siguiente reporte...")
            time.sleep(DELAY_SECONDS)

    logging.info(f"--- Proceso finalizado. Total registros enviados en esta ejecución: {registros_procesados} ---")

if __name__ == "__main__":
    # Permite especificar el archivo CSV por parámetro o busca uno de California en el directorio
    if len(sys.argv) > 1:
        csv_filename = sys.argv[1]
    else:
        csv_files = [f for f in os.listdir(script_dir) if f.endswith('.csv') and 'california' in f.lower()]
        if csv_files:
            csv_filename = csv_files[0]
        else:
            csv_filename = os.getenv('CSV_FILENAME', 'california_niv_tot_caud_2026.csv')

    csv_path = os.path.join(script_dir, csv_filename)

    logging.info(f"--- Iniciando reporte masivo para California desde {csv_filename} ---")
    send_massive_report(csv_path)
