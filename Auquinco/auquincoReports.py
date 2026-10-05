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

CHILE_TZ = ZoneInfo('America/Santiago')

def get_snapshot():
    try:
        url = f"{os.getenv('INTERNAL_API_URL')}/auquinco/snapshot"
        logging.info(f"Obteniendo snapshot desde {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.error(f"Fallo al obtener snapshot: {e}")
        return None

def format_payload_dga(snapshot):
    try:
        snapshot_data = snapshot['snapshot']
        
        nivel_freatico = snapshot_data['pozo']['value'] / 100
        caudal_raw = snapshot_data['caudal']['value']
        totalizador_raw = snapshot_data['totalizador']['value'] / 10
        
        # Usar la hora actual en zona horaria de Chile para la medición.
        # El timestamp del sensor 'pozo' está en UTC y se actualiza infrecuentemente,
        # lo que causaba fechas futuras y registros duplicados en la DGA.
        now_chile = datetime.now(CHILE_TZ)
        fecha_medicion = now_chile.strftime('%Y-%m-%d')
        hora_medicion = now_chile.strftime('%H:%M:%S')

        logging.info(f"Datos procesados -> Freatico: {nivel_freatico}, Caudal: {caudal_raw}, Total: {totalizador_raw}")

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
        return payload, nivel_freatico, caudal_raw, totalizador_raw
    except KeyError as e:
        logging.error(f"Error procesando datos del snapshot (KeyError): {e}")
        return None, 0, 0, 0

def send_report():
    logging.info("--- INICIANDO CICLO DE REPORTE ---")
    
    snapshot = get_snapshot()
    if not snapshot:
        return

    dga_payload, freatico, caudal, totalizador = format_payload_dga(snapshot)
    if not dga_payload:
        return
    
    dga_response_data = {}
    
    try:
        headers = {
            "Content-Type": "application/json",
            "codigoObra": os.getenv('DGA_CODIGO_OBRA'),
            "timeStampOrigen": datetime.now(CHILE_TZ).strftime("%Y-%m-%dT%H:%M:%S%z")
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
            "response": dga_response_data 
        }
        
        # Accedemos directo a la API localmente en lugar de a través de la URL pública
        # de esta forma validamos el chequeo de localhost
        local_port = os.getenv('API_PORT', '3035')
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
    logging.info("Servicio de Reporte DGA Auquinco Inicializado. Esperando hora programada (12:00)...")
    
    schedule.every().day.at("12:00").do(send_report)
    
    while True:
        schedule.run_pending()
        time.sleep(60)
