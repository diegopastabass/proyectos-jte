import time
import schedule
import requests
import json
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

# Configuración de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("dga_reporte.log"),
        logging.StreamHandler()
    ]
)

load_dotenv()

def get_snapshot():
    try:
        url = f"{os.getenv('INTERNAL_API_URL')}/carracedo/snapshot"
        logging.info(f"Obteniendo snapshot desde {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.error(f"Fallo al obtener snapshot: {e}")
        return None

def format_payload_dga(snapshot):
    try:
        nivel_freatico = snapshot['pozo']['value'] / 10
        caudal_raw = snapshot['caudal']['value']
        totalizador_raw = snapshot['totalizador']['value']
        
        iso_time = snapshot['pozo']['time'] 
        dt_obj = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
        
        fecha_medicion = dt_obj.strftime('%Y-%m-%d')
        hora_medicion = dt_obj.strftime('%H:%M:%S')

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
            "timeStampOrigen": datetime.now().strftime("%Y-%m-%dT%H:%M:%S-0400")
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
        
        audit_url = f"{os.getenv('INTERNAL_API_URL')}/carracedo/reports"
        audit_resp = requests.post(audit_url, json=audit_payload, timeout=10)
        
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