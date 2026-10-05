import csv
import requests
import os
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

# Cargar variables de entorno del mismo archivo .env
load_dotenv()

def send_massive_report(csv_file_path):
    if not os.path.exists(csv_file_path):
        logging.error(f"El archivo {csv_file_path} no existe.")
        return

    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.reader(file)
        # Saltar el encabezado: "Código OB","Fecha Medición","Hora Medición","Caudal (l/s)",Totalizador(m3),"Nivel Freatico(m)"
        header = next(reader) 
        
        for row in reader:
            if len(row) < 6:
                continue
            
            codigo_ob = row[0]
            fecha_medicion_raw = row[1]
            hora_medicion = row[2]
            caudal = row[3]
            totalizador = row[4]
            nivel_freatico = row[5]
            
            # Formatear la fecha de DD/MM/YYYY a YYYY-MM-DD
            try:
                day, month, year = fecha_medicion_raw.split('/')
                fecha_medicion = f"{year}-{month}-{day}"
            except ValueError:
                # Si falla, asumimos que ya viene en un formato que no es DD/MM/YYYY
                fecha_medicion = fecha_medicion_raw 
            
            # Ajuste de valores numéricos
            # El nivel freático viene en centímetros, por lo que se divide entre 100 para pasarlo a metros
            nivel_freatico_val = float(nivel_freatico) / 100
            totalizador_val = float(totalizador) / 10
            
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
                    "caudal": f"{float(caudal):.2f}",
                    "nivelFreaticoDelPozo": f"{nivel_freatico_val:.2f}"
                }
            }
            
            headers = {
                "Content-Type": "application/json",
                # Se utiliza el código del .env por seguridad y consistencia con el servicio original
                "codigoObra": os.getenv('DGA_CODIGO_OBRA'),
                "timeStampOrigen": datetime.now().strftime("%Y-%m-%dT%H:%M:%S-03:00")
            }
            
            logging.info(f"Enviando a DGA -> Fecha: {fecha_medicion} {hora_medicion} | Cau: {caudal}, Tot: {totalizador_val}, Nivel: {nivel_freatico_val:.2f}")
            
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

            try:
                logging.info(f"Guardando respaldo en base de datos local para la fecha {fecha_medicion}...")
                audit_payload = {
                    "freatico": float(nivel_freatico_val),
                    "caudal": float(caudal),
                    "totalizador": float(totalizador_val),
                    "response": dga_response_data 
                }
                
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
            
            # Pausa de 2 segundos entre envíos para no saturar la API de la DGA y evitar bloqueos (Rate Limiting)
            time.sleep(2)

if __name__ == "__main__":
    csv_filename = "auquinco_niv_tot_caud_2026.csv"
    csv_path = os.path.join(script_dir, csv_filename)
    
    logging.info(f"--- Iniciando reporte masivo desde {csv_filename} ---")
    send_massive_report(csv_path)
    logging.info("--- Reporte masivo finalizado ---")
