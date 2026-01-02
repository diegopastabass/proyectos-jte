import time
import logging
import requests
import mysql.connector
from datetime import datetime

# --- Configuración ---
DB_CONFIG = {
    "host": "3.235.75.8",
    "user": "INFORMATICO",
    "password": "informatico_2025",
    "database": "telemetria",
}

API_URL = "https://api.ultramsg.com/instance79783/messages/chat"
TOKEN = "j51no2r6amlze29z"
TO = "120363296047263190@g.us" 
INTERVALO_MINUTOS = 10

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# --- Funciones ---
def obtener_niveles():
    """Obtiene los dos últimos registros del estanque desde MySQL."""
    query = """
        SELECT mt_value, mt_time_2 
        FROM apr_marchigue
        WHERE mt_name = 'TK_MARCHIGUE--slave.AI12'
        ORDER BY mt_time_2 DESC
        LIMIT 2;
    """
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if len(rows) < 2:
        logging.warning("No hay suficientes datos en la BD.")
        return None, None, None, None

    nivel_actual, time_actual = rows[0]
    nivel_anterior, time_anterior = rows[1]

    return (float(nivel_actual) / 100), (float(nivel_anterior) / 100), time_actual, time_anterior


def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    """Calcula tiempo estimado de vaciado y lo devuelve en formato HH:MM:SS."""
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None  # No hay vaciado o timestamps inválidos

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = nivel_actual / tasa_descenso

    return str(datetime.utcfromtimestamp(tiempo_restante_segundos).strftime("%H:%M:%S"))


def enviar_alerta(nivel_actual, tiempo_vaciado):
    """Envía alerta a la API y loguea toda la respuesta."""
    body_msg = (
        f"⚠️ Nivel de Estanque crítico\n"
        f"Nivel Actual: {nivel_actual:.2f} m\n"
        f"Tiempo Estimado de Vaciado: {tiempo_vaciado} Hrs"
    )
    data = {"token": TOKEN, "to": TO, "body": body_msg}
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        logging.info(f"Respuesta API (status {response.status_code}): {response.text}")
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Error al enviar alerta: {e}")


def monitorear():
    """Bucle principal de monitoreo."""
    while True:
        logging.info("Consultando datos de estanque...")
        nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles()

        if nivel_actual is not None and nivel_anterior is not None:
            if nivel_actual < nivel_anterior and nivel_actual < 2:
                tiempo_vaciado = calcular_tiempo_vaciado(
                    nivel_actual, nivel_anterior, time_actual, time_anterior
                )
                if tiempo_vaciado:
                    enviar_alerta(nivel_actual, tiempo_vaciado)
                else:
                    logging.info("No se pudo calcular tiempo de vaciado.")
            else:
                logging.info("Condiciones no cumplidas. Todo normal.")
        else:
            logging.warning("No se obtuvieron datos válidos.")

        logging.info(f"Esperando {INTERVALO_MINUTOS} minutos para la siguiente consulta...")
        time.sleep(INTERVALO_MINUTOS * 60)


if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")
