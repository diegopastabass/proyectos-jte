import time
import logging
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

# --- Configuración desde .env ---
API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = os.getenv("TO")

# Estos valores se recargarán en cada ciclo
def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 5)),
        "NIVEL_ALERTA": float(os.getenv("NIVEL_ALERTA", 3.5)),
    }

# Nombre de sensores
SENSOR_ESTANQUE = "SALA_BOMBAS_NIVEL_METROS"

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_compania.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)


# --- Funciones ---
def obtener_niveles(nombre_sensor):
    """Obtiene los dos últimos registros desde la API."""
    url = "https://app.jteanalytics.cl/compania/nivel?limit=2"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if len(data) < 2:
            logging.warning(f"No hay suficientes datos desde la API para {nombre_sensor}.")
            return None, None, None, None
            
        # Ordenar por time ascendente para tener el anterior y luego el actual
        data_sorted = sorted(data, key=lambda x: x["time"])
        
        registro_anterior = data_sorted[0]
        registro_actual = data_sorted[1]
        
        def parse_time(t_str):
            if t_str.endswith("Z"):
                t_str = t_str[:-1] + "+00:00"
            return datetime.fromisoformat(t_str).replace(tzinfo=None)
            
        time_anterior = parse_time(registro_anterior["time"])
        time_actual = parse_time(registro_actual["time"])
        
        nivel_anterior = float(registro_anterior["value"])
        nivel_actual = float(registro_actual["value"])
        
        return nivel_actual, nivel_anterior, time_actual, time_anterior
        
    except Exception as e:
        logging.error(f"Error obteniendo niveles desde la API: {e}")
        return None, None, None, None


def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    """Estimación de vaciado en HH:MM:SS."""
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = nivel_actual / tasa_descenso

    return datetime.utcfromtimestamp(tiempo_restante_segundos).strftime("%H:%M:%S")

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito: {mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta UltaMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a UltaMsg: {e}")

def procesar_estanque(sensor, nombre_publico, nivel_alerta):
    nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles(sensor)

    if nivel_actual is None:
        return False

    nivel_actual = nivel_actual
    nivel_anterior = nivel_anterior

    if nivel_actual < nivel_anterior and nivel_actual < nivel_alerta:
        tiempo_vaciado = calcular_tiempo_vaciado(
            nivel_actual, nivel_anterior, time_actual, time_anterior
        )
        if tiempo_vaciado:
            mensaje = (
                f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
                f"Estanque: {nombre_publico}\n"
                f"Nivel Actual: {nivel_actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo_vaciado if tiempo_vaciado else 'N/A'}"
            )
            enviar_alerta(mensaje)
            return True
        else:
            logging.info(f"No se pudo calcular tiempo de vaciado para {nombre_publico}.")
            return False
    else:
        logging.info(f"{nombre_publico}: condiciones normales.")
        return False

def monitorear():
    """Bucle principal con intervalo dinámico."""
    while True:
        cfg = get_dynamic_config()
        intervalo_alerta = cfg["INTERVALO_MINUTOS"]   
        nivel_alerta = cfg["NIVEL_ALERTA"]

        logging.info("Iniciando ciclo de monitoreo...")

        alerta_nuevo = procesar_estanque(SENSOR_ESTANQUE, "Estanque Nuevo", nivel_alerta)

        hay_alerta = alerta_nuevo

        # Intervalos dinámicos
        intervalo = intervalo_alerta if hay_alerta else 1

        logging.info(
            f"{'⚠ Intervalo aumentado por alerta' if hay_alerta else '✓ Intervalo normal'}: "
            f"{intervalo} minuto(s)."
        )

        time.sleep(intervalo * 60)



if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")
