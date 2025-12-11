import time
import paho.mqtt.client as mqtt

# Configuración del Broker
BROKER = "app.jteanalytics.cl"
PORT = 443
TOPIC = "sensor/datos"
WS_PATH = "/mosquitto/" 

# Inicialización del Cliente
client = mqtt.Client(transport="websockets")
client.ws_set_options(path=WS_PATH)
client.tls_set() # Habilita SSL para conectar por puerto 443

# Conexión
print(f"Conectando a {BROKER}...")
client.connect(BROKER, PORT, 60)
client.loop_start()

# Loop de Publicación
contador = 1
try:
    while True:
        mensaje = str(contador)
        client.publish(TOPIC, mensaje)
        print(f"Mensaje publicado: {mensaje}")
        
        contador += 1
        time.sleep(1)

except KeyboardInterrupt:
    print("\nDesconectando...")
    client.loop_stop()
    client.disconnect()
