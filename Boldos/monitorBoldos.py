import time
import logging
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = os.getenv("TO")

# --- Configuración dinámica ---
def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 5)),
        "NIVEL_ALERTA": float(os.getenv("NIVEL_ALERTA", 1.5)),
    }

# URLs de los estanques
URL_ESTANQUE_1 = "https://app.jteanalytics.cl/boldos/nivel?limit=5"
URL_ESTANQUE_2 = "https://app.jteanalytics.cl/boldos/nivel2?limit=5"

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_BOLDOS.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)

def obtener_datos_endpoint(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        datos = response.json()
        return datos
    except Exception as e:
        logging.error(f"Error obteniendo datos de {url}: {e}")
        return None

def calcular_tendencia(datos):
    """
    Calcula la tendencia (Estable, Llenado, Vaciado), el nivel actual y el tiempo estimado de vaciado.
    """
    if not datos or len(datos) < 2:
        return "Desconocido", None, None

    parsed_data = []
    for d in datos:
        t_str = d['time'].replace('Z', '+00:00')
        t = datetime.fromisoformat(t_str)
        parsed_data.append({'time': t, 'value': float(d['value'])})
        
    # Ordenar por tiempo (el más antiguo primero)
    parsed_data.sort(key=lambda x: x['time'])
    
    t0 = parsed_data[0]['time']
    x = [(d['time'] - t0).total_seconds() for d in parsed_data]
    y = [d['value'] for d in parsed_data]
    
    # Regresión lineal simple
    n = len(x)
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_xx = sum(xi * xi for xi in x)
    
    denominator = (n * sum_xx - sum_x * sum_x)
    if denominator == 0:
        return "Estable", y[-1], None
        
    slope = (n * sum_xy - sum_x * sum_y) / denominator # metros por segundo
    slope_per_min = slope * 60 # metros por minuto
    
    estado = "Estable"
    if slope_per_min > 0.001:  # gana más de 1 mm por minuto de forma consistente
        estado = "Llenado"
    elif slope_per_min < -0.001: # pierde más de 1 mm por minuto de forma consistente
        estado = "Vaciado"
        
    tiempo_vaciado_str = None
    if estado == "Vaciado" and slope < 0:
        nivel_actual = y[-1]
        tiempo_restante_segundos = nivel_actual / abs(slope)
        
        # Convertir a formato HH:MM:SS
        horas = int(tiempo_restante_segundos // 3600)
        minutos = int((tiempo_restante_segundos % 3600) // 60)
        segundos = int(tiempo_restante_segundos % 60)
        tiempo_vaciado_str = f"{horas:02d}:{minutos:02d}:{segundos:02d}"
            
    return estado, y[-1], tiempo_vaciado_str

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito:\n{mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta API ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a API: {e}")

def procesar_estanque(url, nombre_publico, nivel_alerta):
    datos = obtener_datos_endpoint(url)
    
    if datos is None:
        return False
        
    estado, nivel_actual, tiempo_vaciado = calcular_tendencia(datos)
    
    if nivel_actual is None:
        return False
        
    logging.info(f"{nombre_publico} - Estado: {estado}, Nivel Actual: {nivel_actual:.2f} m")

    if estado == "Vaciado" and nivel_actual < nivel_alerta:
        mensaje = (
            f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
            f"Estanque: {nombre_publico}\n"
            f"Estado: {estado}\n"
            f"Nivel Actual: {nivel_actual:.2f} m"
        )
        if tiempo_vaciado:
            mensaje += f"\nTiempo Estimado de Vaciado: {tiempo_vaciado}"
            
        enviar_alerta(mensaje)
        return True
    else:
        return False

def monitorear():
    while True:
        cfg = get_dynamic_config()
        intervalo_alerta = cfg["INTERVALO_MINUTOS"]   
        nivel_alerta = cfg["NIVEL_ALERTA"]

        logging.info("Iniciando ciclo de monitoreo...")

        alerta_estanque_1 = procesar_estanque(URL_ESTANQUE_1, "Estanque 1", nivel_alerta)
        alerta_estanque_2 = procesar_estanque(URL_ESTANQUE_2, "Estanque 2", nivel_alerta)
        
        alerta_global = alerta_estanque_1 or alerta_estanque_2
        
        intervalo = intervalo_alerta if alerta_global else 1

        logging.info(
            f"{'⚠ Intervalo aumentado por alerta' if alerta_global else '✓ Intervalo normal'}: "
            f"{intervalo} minuto(s)."
        )

        time.sleep(intervalo * 60)

if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")