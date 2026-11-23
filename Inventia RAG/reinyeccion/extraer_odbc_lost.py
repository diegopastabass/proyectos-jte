#!/usr/bin/env python3
"""Extrae a CSV los INSERT fallidos de una tabla desde odbc_lost.log de MTDP.

MT Data Provider deja en odbc_lost.log cada INSERT que la base rechazó, con la
forma:
  insert into TABLA (mt_name, mt_value, mt_time, mt_quality) values ('..', '..', '..', '..'),...;

El CSV resultante se carga con \\copy en una tabla de staging (ver
Zagal/api-zagal-pg/sql/003_fix_insert_parc57.sql). Columnas:
  mt_name, mt_value, mt_time_dispositivo, mt_quality, mt_time_2

mt_time_dispositivo es la hora del equipo tal como viene en el log.
mt_time_2 es esa hora corregida con --offset para que quede en la misma
referencia que el DEFAULT now() de la columna (ver PASO 0e del SQL).

Lee el archivo línea a línea: no lo carga entero en memoria (pesa ~500 MB).

Uso:
  python3 extraer_odbc_lost.py odbc_lost.log --tabla PARC_57_ZAGAL \\
      --offset -49 --salida parc57_reinyeccion.csv

  --offset acepta minutos fijos ("-49") o tramos por fecha del equipo
  ("2025-10-01=-40,2026-06-01=-49"): cada tramo rige desde su fecha.
"""
import argparse
import csv
import re
import sys
from datetime import datetime, timedelta

FILA = re.compile(r"\('((?:[^']|'')*)', '((?:[^']|'')*)', '([^']*)', '([^']*)'\)")
NUMERO = re.compile(r"^\s*-?\d+(\.\d+)?\s*$")

# Mismo criterio que verificar_salto_totalizador (003): el totalizador de la 57
# sube como máximo ~4.000 por hora (medido en el propio log), así que un salto
# mayor a 10.000 + 5.000 por hora transcurrida es una lectura errónea.
# Las lecturas erróneas observadas valen ~1.110.000.000 o 0.
SALTO_BASE = 10_000
SALTO_POR_HORA = 5_000


def parse_offset(texto):
    """Devuelve [(desde, timedelta)] ordenado. '-49' => un tramo sin fecha."""
    tramos = []
    for parte in texto.split(','):
        parte = parte.strip()
        if '=' in parte:
            fecha, minutos = parte.split('=', 1)
            tramos.append((datetime.fromisoformat(fecha.strip()), timedelta(minutes=float(minutos))))
        else:
            tramos.append((datetime.min, timedelta(minutes=float(parte))))
    tramos.sort()
    return tramos


def offset_para(ts, tramos):
    actual = timedelta(0)
    for desde, delta in tramos:
        if ts >= desde:
            actual = delta
        else:
            break
    return actual


def es_salto_invalido(valor, ts, ref):
    """ref = (valor, ts) del último totalizador aceptado, o None."""
    if ref is None:
        return False
    ref_valor, ref_ts = ref
    if valor == 0 and ref_valor > 0:
        return True
    horas = max((ts - ref_ts).total_seconds() / 3600, 0)
    return valor >= ref_valor + SALTO_BASE + SALTO_POR_HORA * horas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('log', help='ruta a odbc_lost.log')
    ap.add_argument('--tabla', required=True, help='tabla destino tal como aparece en el log, ej. PARC_57_ZAGAL')
    ap.add_argument('--salida', required=True, help='CSV de salida')
    ap.add_argument('--offset', default='0', help='minutos a sumar a la hora del equipo (ver docstring)')
    ap.add_argument('--desde', help='solo filas con hora de equipo >= esta (YYYY-MM-DD[ HH:MM])')
    ap.add_argument('--hasta', help='solo filas con hora de equipo < esta')
    ap.add_argument('--tag-totalizador', help='mt_name del totalizador a filtrar (default <TABLA>--slave.totalizador)')
    ap.add_argument('--sin-filtro-totalizador', action='store_true', help='no descartar lecturas erróneas del totalizador')
    ap.add_argument('--ref-totalizador', help='"valor,YYYY-MM-DD HH:MM:SS" del último totalizador válido en la base')
    args = ap.parse_args()

    tramos = parse_offset(args.offset)
    desde = datetime.fromisoformat(args.desde) if args.desde else None
    hasta = datetime.fromisoformat(args.hasta) if args.hasta else None
    tag_tot = None if args.sin_filtro_totalizador else (args.tag_totalizador or f'{args.tabla}--slave.totalizador')
    prefijo = f'insert into {args.tabla.lower()} '

    stats = {'statements': 0, 'filas': 0, 'fuera_de_rango': 0, 'mal_formadas': 0,
             'tot_descartados': 0, 'tot_no_numericos': 0}
    totalizador = []  # se filtra al final, en orden cronológico
    min_ts = max_ts = None

    with open(args.salida, 'w', newline='', encoding='utf-8') as fsal:
        w = csv.writer(fsal)
        w.writerow(['mt_name', 'mt_value', 'mt_time_dispositivo', 'mt_quality', 'mt_time_2'])

        def escribir(name, value, ts, quality):
            nonlocal min_ts, max_ts
            ts2 = ts + offset_para(ts, tramos)
            w.writerow([name, value, ts.isoformat(sep=' ', timespec='milliseconds'), quality,
                        ts2.isoformat(sep=' ', timespec='milliseconds')])
            stats['filas'] += 1
            min_ts = ts if min_ts is None or ts < min_ts else min_ts
            max_ts = ts if max_ts is None or ts > max_ts else max_ts

        with open(args.log, 'r', encoding='latin-1', newline='') as f:
            for linea in f:
                if not linea[:len(prefijo)].lower() == prefijo:
                    continue
                stats['statements'] += 1
                for name, value, ts_txt, quality in FILA.findall(linea):
                    name, value = name.replace("''", "'"), value.replace("''", "'")
                    try:
                        ts = datetime.fromisoformat(ts_txt)
                    except ValueError:
                        stats['mal_formadas'] += 1
                        continue
                    if (desde and ts < desde) or (hasta and ts >= hasta):
                        stats['fuera_de_rango'] += 1
                        continue
                    if name == tag_tot:
                        totalizador.append((ts, name, value, quality))
                    else:
                        escribir(name, value, ts, quality)

        ref = None
        if args.ref_totalizador:
            v, t = args.ref_totalizador.split(',', 1)
            ref = (float(v), datetime.fromisoformat(t.strip()))
        for ts, name, value, quality in sorted(set(totalizador)):
            if not NUMERO.match(value):
                stats['tot_no_numericos'] += 1
                continue
            v = float(value)
            if es_salto_invalido(v, ts, ref):
                stats['tot_descartados'] += 1
                continue
            ref = (v, ts)
            escribir(name, value, ts, quality)

    print(f"tabla {args.tabla}: {stats['statements']} statements, {stats['filas']} filas escritas "
          f"({min_ts} -> {max_ts})", file=sys.stderr)
    print(f"  fuera de rango: {stats['fuera_de_rango']}, mal formadas: {stats['mal_formadas']}, "
          f"totalizador descartado: {stats['tot_descartados']}, no numérico: {stats['tot_no_numericos']}",
          file=sys.stderr)
    print('  (los duplicados se eliminan al insertar, con DISTINCT ON)', file=sys.stderr)


if __name__ == '__main__':
    main()
