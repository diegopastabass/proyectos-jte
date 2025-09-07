import mysql.connector
import time

# Configura tu conexión MySQL
db_config = {
    "host": "localhost",         # O el nombre del contenedor si lo llamas desde fuera
    "port": 3306,                # Asegúrate que esté expuesto si estás fuera del contenedor
    "user": "user",
    "password": "mypassword",
    "database": "ssr_zuniga"
}

tabla = "ssr_zuniga"

def eliminar_ultima_fila():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # Obtener el ID máximo (última fila)
        cursor.execute(f"SELECT mt_id FROM {tabla} ORDER BY mt_id DESC LIMIT 1")
        resultado = cursor.fetchone()

        if resultado:
            ultimo_id = resultado[0]
            cursor.execute(f"DELETE FROM {tabla} WHERE mt_id = %s", (ultimo_id,))
            conn.commit()
            print(f"Fila con mt_id {ultimo_id} eliminada.")
        else:
            print("La tabla está vacía.")

        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error: {err}")

# Loop que elimina una fila cada 1 segundo
if __name__ == "__main__":
    while True:
        eliminar_ultima_fila()
        time.sleep(10)

