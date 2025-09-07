
#!/usr/bin/env python3
"""mysql_insert_loop.py

Inserta un registro en la tabla `ssr_zuniga` cada minuto con el siguiente formato:

    INSERT INTO ssr_zuniga (mt_name, mt_value, mt_time, mt_quality, mt_time_2)
    VALUES ('SSR_ZUNIGA--slave.horometro', <valor>, <ahora>, '1', <ahora>);

- `mt_name` es siempre 'SSR_ZUNIGA--slave.horometro'.
- `mt_value` incrementa de 10 en 10 (0, 10, 20…).
- `mt_time` y `mt_time_2` toman la fecha/hora actual.
- `mt_quality` es siempre el string '1'.

Uso:
    python mysql_insert_loop.py --host 127.0.0.1 --port 3306 --user root \
        --password secret --database telemetria [--start-value 0]

Requiere: mysql-connector-python
    pip install mysql-connector-python
"""

import argparse
import sys
import time
from datetime import datetime

import mysql.connector
from mysql.connector import Error


MT_NAME = "SSR_ZUNIGA--slave.horometro"
MT_QUALITY = "1"


def connect_mysql(args):
    """Establece la conexión con MySQL y devuelve el objeto connection."""
    return mysql.connector.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        autocommit=True,  # Garantiza que cada INSERT se confirme de inmediato
        charset="utf8mb4",
    )


def insert_row(cursor, value):
    """Ejecuta el INSERT con el valor indicado."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    query = (
        "INSERT INTO ssr_zuniga (mt_name, mt_value, mt_time, mt_quality, mt_time_2) "
        "VALUES (%s, %s, %s, %s, %s)"
    )
    cursor.execute(query, (MT_NAME, value, now, MT_QUALITY, now))


def parse_args():
    parser = argparse.ArgumentParser(
        description="Inserta registros en ssr_zuniga cada minuto."
    )
    parser.add_argument("--host", required=True, help="Servidor MySQL")
    parser.add_argument("--port", type=int, default=3306, help="Puerto MySQL")
    parser.add_argument("--user", required=True, help="Usuario MySQL")
    parser.add_argument("--password", required=True, help="Contraseña MySQL")
    parser.add_argument("--database", required=True, help="Base de datos")
    parser.add_argument(
        "--start-value",
        type=int,
        default=0,
        help="Valor inicial de mt_value (default: 0)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    current_value = args.start_value

    while True:
        try:
            # Intentamos mantener la conexión viva; si falla, la recreamos
            if "conn" not in locals() or not conn.is_connected():
                conn = connect_mysql(args)
                cursor = conn.cursor()
                print("[INFO] Conectado a MySQL.")

            insert_row(cursor, current_value)
            print(f"[OK] Insertado mt_value={current_value} a las {datetime.now()}")

            current_value += 10
            time.sleep(60)

        except Error as e:
            print(f"[ERROR] {e}")
            try:
                conn.close()
            except Exception:
                pass
            print("[INFO] Reintentando conexión en 10 segundos...")
            time.sleep(10)
        except KeyboardInterrupt:
            print("\n[INFO] Interrumpido por el usuario. Saliendo...")
            try:
                conn.close()
            except Exception:
                pass
            sys.exit(0)


if __name__ == "__main__":
    main()
