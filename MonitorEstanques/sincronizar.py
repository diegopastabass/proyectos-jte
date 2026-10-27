"""
Copia monitorEstanques.py a cada sitio con el nombre de archivo que ya usa su servicio
(pm2 / NSSM / programador de tareas), y verifica que todas las copias sean idénticas.

  python MonitorEstanques/sincronizar.py              copia a todos los sitios
  python MonitorEstanques/sincronizar.py --verificar  solo compara, no escribe (exit 1 si hay diferencias)
"""

import argparse
import filecmp
import os
import shutil
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, "MonitorEstanques", "monitorEstanques.py")

# carpeta del sitio -> nombre del script que ejecuta el servicio en ese sitio
DESTINOS = {
    "Cuevas": "tankService.py",
    "Zuniga": "tankService.py",
    "Puquillay": "tankService.py",
    "Manzano": "tankService.py",
    "California": "tankService.py",
    "Compania": "tankService.py",
    "Cumpeo": "tankService.py",
    "Hornillas": "tankServiceHornillas.py",
    "VillaCarmen": "monitorEstanqueVillaCarmen.py",
    "Cocalan": "monitorEstanqueCocalan.py",
    "Auquinco": "monitorEstanqueAuquinco.py",
    "Nerquihue": "monitorEstanqueNerquihue.py",
    "Boldos": "monitorBoldos.py",
    "Ranguil": "MonitoreoEstanqueRanguil.py",
    "Carmen": "monitorEstanqueCarmen.py",
    "Aromos": "monitorAromos.py",
    "Idahue": "monitorEstanqueIdahue.py",
    "Gonzalez": "monitorEstanqueGonzalez.py",
    "Marchigue": "tankService.py",
    "Bucalemu": "tankServiceBucalemu.py",
    "Araucarias": "connectionService.py",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verificar", action="store_true")
    args = parser.parse_args()

    errores = 0
    for carpeta, archivo in DESTINOS.items():
        destino = os.path.join(RAIZ, carpeta, archivo)
        config = os.path.join(RAIZ, carpeta, "monitor_config.json")
        if not os.path.exists(config):
            print(f"✗ {carpeta}: falta monitor_config.json")
            errores += 1
        if args.verificar:
            igual = os.path.exists(destino) and filecmp.cmp(ORIGEN, destino, shallow=False)
            print(f"{'✓' if igual else '✗'} {carpeta}/{archivo}")
            errores += 0 if igual else 1
        else:
            shutil.copyfile(ORIGEN, destino)
            print(f"→ {carpeta}/{archivo}")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
