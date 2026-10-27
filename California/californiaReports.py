import time
import schedule
import requests
import json
import os
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

# Determinar el directorio donde se encuentra este script
script_dir = os.path.dirname(os.path.abspath(__file__))
log_file_path = os.path.join(script_dir, "dga_reporte.log")

# Configuración de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path),
        logging.StreamHandler()
    ]
)

load_dotenv()

# La API entrega los tiempos en UTC (ISO con 'Z'); la DGA espera hora local de Chile
TZ_CHILE = ZoneInfo('America/Santiago')

def get_snapshot():
    try:
        url = f"{os.getenv('INTERNAL_API_URL')}/california/snapshot"
        logging.info(f"Obteniendo snapshot desde {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.error(f"Fallo al obtener snapshot: {e}")
        return None

# Divisores de métricas para California:
# - Freático: En BD viene en centímetros -> Se divide por 100 para obtener metros (m).
# - Caudal: El endpoint /california/snapshot ya lo entrega dividido por 100 en litros/segundo (l/s).
# - Totalizador: En BD viene en decalitros (0.1 m³) -> Se divide por 10 para obtener metros cúbicos (m³).
DIVISOR_FREATICO = float(os.getenv('DIVISOR_FREATICO', 100))
DIVISOR_CAUDAL = float(os.getenv('DIVISOR_CAUDAL', 1))
DIVISOR_TOTALIZADOR = float(os.getenv('DIVISOR_TOTALIZADOR', 10))

def format_payload_dga(snapshot):
    try:
        data = snapshot.get('snapshot', snapshot) if isinstance(snapshot, dict) else snapshot

        nivel_freatico = data['FREATICO']['value'] / DIVISOR_FREATICO
        caudal_raw = data['CAUDAL']['value'] / DIVISOR_CAUDAL
        totalizador_raw = data['TOTALIZADOR']['value'] / DIVISOR_TOTALIZADOR
        
        iso_time = data['FREATICO']['time'] 
        dt_obj = datetime.fromisoformat(iso_time.replace('Z', '+00:00')).astimezone(TZ_CHILE)
        
        fecha_medicion = dt_obj.strftime('%Y-%m-%d')
        hora_medicion = dt_obj.strftime('%H:%M:%S')

        logging.info(f"Datos procesados -> Freatico: {nivel_freatico:.2f} m, Caudal: {caudal_raw:.2f} l/s, Total: {totalizador_raw:.2f} m3")

        payload = {
            "autenticacion": {
                "rutEmpresa": os.getenv('DGA_RUT_EMPRESA'),
                "rutUsuario": os.getenv('DGA_RUT_USUARIO'),
                "password": os.getenv('DGA_PASSWORD')
            },
            "medicionSubterranea": {
                "fechaMedicion": fecha_medicion,
                "horaMedicion": hora_medicion,
                "totalizador": f"{int(totalizador_raw)}",
                "caudal": f"{float(caudal_raw):.2f}",
                "nivelFreaticoDelPozo": f"{float(nivel_freatico):.2f}"
            }
        }
        return payload, nivel_freatico, caudal_raw, totalizador_raw, iso_time
    except KeyError as e:
        logging.error(f"Error procesando datos del snapshot (KeyError): {e}")
        return None, 0, 0, 0, None

def send_report():
    logging.info("--- INICIANDO CICLO DE REPORTE ---")
    
    snapshot = get_snapshot()
    if not snapshot:
        return

    result = format_payload_dga(snapshot)
    if not result[0]:
        return
    dga_payload, freatico, caudal, totalizador, measurement_time = result
    
    dga_response_data = {}
    
    try:
        headers = {
            "Content-Type": "application/json",
            "codigoObra": os.getenv('DGA_CODIGO_OBRA'),
            "timeStampOrigen": datetime.now(TZ_CHILE).isoformat(timespec='seconds')
        }
        
        logging.info("Enviando datos a DGA...")
        resp = requests.post(
            os.getenv('DGA_API_URL'), 
            json=dga_payload,
            headers=headers,
            timeout=15
        )
        
        try:
            dga_response_data = resp.json()
        except:
            dga_response_data = {"raw_text": resp.text}

        if resp.status_code == 200:
            logging.info(f"Éxito DGA (200). Respuesta: {dga_response_data}")
        else:
            logging.warning(f"Advertencia DGA ({resp.status_code}). Respuesta: {dga_response_data}")

    except Exception as e:
        logging.error(f"Error crítico enviando a DGA: {e}")
        dga_response_data = {"exception": str(e)}

    try:
        logging.info("Guardando respaldo en base de datos local...")
        audit_payload = {
            "freatico": float(freatico),
            "caudal": float(caudal),
            "totalizador": float(totalizador),
            "response": dga_response_data,
            "time": measurement_time
        }
        
        # Accedemos directo a la API localmente en lugar de a través de la URL pública
        # de esta forma validamos el chequeo de localhost
        local_port = os.getenv('API_PORT', '3034')
        audit_url = f"http://127.0.0.1:{local_port}/reports"
        
        audit_headers = {
            "Content-Type": "application/json",
            "x-api-password": os.getenv('REPORTS_API_PASSWORD', '')
        }
        
        audit_resp = requests.post(audit_url, json=audit_payload, headers=audit_headers, timeout=10)
        
        if audit_resp.status_code == 201:
             logging.info("Respaldo local guardado correctamente.")
        else:
             logging.error(f"Error guardando respaldo local: {audit_resp.status_code} - {audit_resp.text}")

    except Exception as e:
        logging.error(f"Excepción guardando respaldo local: {e}")

    logging.info("--- FIN CICLO DE REPORTE ---\n")

# Ejecución
if __name__ == "__main__":
    logging.info("Servicio de Reporte DGA Inicializado. Esperando hora programada (21:00)...")
    
    schedule.every().day.at("21:00").do(send_report)
    
    while True:
        schedule.run_pending()
        time.sleep(60)