# Checklist de deploy: monitoreo unificado de estanques

Contexto y análisis completo en [HOMOGENEIZACION_MONITOREO.md](HOMOGENEIZACION_MONITOREO.md).

## Cómo funciona ahora

- **Un solo script**: [`MonitorEstanques/monitorEstanques.py`](MonitorEstanques/monitorEstanques.py). Se copia idéntico a cada sitio **con el nombre de archivo que ya tenía**, así que pm2, NSSM o el programador de tareas no cambian.
  - Después de editarlo: `python MonitorEstanques/sincronizar.py`
  - Para verificar que todas las copias son iguales: `python MonitorEstanques/sincronizar.py --verificar`
- **Lo propio de cada sitio** está en `<Sitio>/monitor_config.json` (estanques, endpoints, divisor, umbrales por defecto) y en el `.env` (credenciales y overrides). Ambos se releen en cada ciclo, así que no hace falta reiniciar para cambiar un umbral.
- **Overrides en `.env`**:
  - Umbrales: `NIVEL_ALERTA_<ID>`, `NIVEL_ALERTA`, `NIVEL_REBALSE_<ID>`. Se mantienen las claves que ya existían (`NIVEL_ALERTA`, `NIVEL_ALERTA_CERRO`, `NIVEL_ALERTA_50`, etc.).
  - Parámetros: `REPETIR_ALERTA_MINUTOS` (si no está, se usa el antiguo `INTERVALO_MINUTOS`), `UMBRAL_DESCONEXION_MINUTOS`, `VENTANA_VACIADO_MINUTOS`, `ALERTAR_NIVEL_ESTABLE`, etc. La lista completa está en `PARAMETROS_DEFECTO`, al inicio del script.
- **Credenciales**: acepta `API_TOKEN` o `TOKEN`, `API_TO` o `TO`, y `API_TO_ADMIN` o `TO_ADMIN`. Con eso se elimina el problema de nombres distintos entre el código y el `.env`.
- **Archivos que genera junto al script**: `logs_monitor.txt` (rotativo, 5 × 5 MB) y `estado_monitor.json` (estado de alertas y desconexiones, para no repetir avisos al reiniciar). Ambos están en `.gitignore`.
- **Prueba sin enviar mensajes**: `python <script>.py --una-vez --sin-enviar` ejecuta un ciclo, imprime los mensajes que enviaría y no guarda estado.

### Pasos comunes para cada sitio (marcados como "pasos comunes" más abajo)

1. Instalar dependencias en el servidor: `pip install -r requirements.txt` (copiar [`MonitorEstanques/requirements.txt`](MonitorEstanques/requirements.txt)). En Windows instala `tzdata` para mostrar la hora de Chile.
2. Copiar el script y `monitor_config.json` a la carpeta del servicio en el servidor.
3. Revisar que el `.env **del servidor**` tenga `API_URL`, `API_TOKEN`/`TOKEN`, `API_TO`/`TO` y `API_TO_ADMIN`. Los `.env` locales ya se actualizaron, pero no están en git, así que hay que replicarlos a mano.
4. Ejecutar `python <script>.py --una-vez --sin-enviar` en el servidor y revisar la salida.
5. Reiniciar el servicio y revisar `logs_monitor.txt` en los primeros minutos.
6. Desde el servidor puedes borrar el log antiguo (`logs_*.txt`, `logs.txt`), que ya no se escribe.

---

## Fase 0: tareas manuales de seguridad

- [ ] **Cambiar la contraseña de MySQL** (usuario `INFORMATICO`, host `3.235.75.8`). Estaba escrita en `Marchigue/tankService.py` y sigue en el historial de git.
- [ ] **Cambiar la contraseña de PostgreSQL RDS** (usuario `JTEanalytics`). Estaba en `Bucalemu/tankServiceBucalemu copy.py` (eliminado, pero sigue en el historial). Después hay que actualizar todos los `.env` y APIs que la usan.
- [ ] **Regenerar el token de UltraMsg** (`instance79783`), que estaba en los dos archivos anteriores, y actualizar todos los `.env`.

## Fase 1: APIs (desplegar antes que los monitores que dependen de ellas)

Ninguno de estos cambios altera lo que reciben los dashboards cuando no se envía `?limit=`.

- [ ] **Auquinco** (`Auquinco/api-auquinco`): `/nivel?limit=N` devuelve los N registros más recientes. Antes ignoraba `limit` y el monitor tomaba los 2 más antiguos de las últimas 6 h.
  - Verificar: `curl "https://app.jteanalytics.cl/auquinco/nivel?limit=3"` → 3 registros con la hora actual.
- [ ] **Cocalan** (`Cocalan/api-cocalan`): `/nivel?limit=N` devuelve los más recientes. Antes devolvía los más antiguos de las últimas 6 h.
  - Verificar: `curl "https://app.jteanalytics.cl/cocalan/nivel?limit=3"` → 3 registros recientes.
- [ ] **Carmen** (`Carmen/api-carmen`): `/nivel_bajo` y `/nivel_sentina` aceptan `?limit=` (100 por defecto).
- [ ] **González** (`Gonzalez/api-gonzalez`): `/nivel` y `/nivel2` aceptan `?limit=` (100 por defecto).
- [ ] **Aromos** (`Aromos/api-aromos`): `/nivel` y `/nivel2` aceptan `?limit=` (300 por defecto).
- [ ] **Nerquihue** (`Nerquihue/api-nerquihue`, versión no `-pg`): `/nivel` acepta `?limit=`. Solo hay que desplegarla si es la que está en producción. La `-pg` ya lo soportaba.
- [ ] **Bucalemu** (`Bucalemu/api-bucalemu-postgres`): endpoints nuevos `/metrics/nivel_nilahue`, `/nivel_casuto`, `/nivel_bucalemu_bajo` y `/nivel_bucalemu_alto`.
  - Aceptan `?limit=N` o `?start=YYYY-MM-DD&end=YYYY-MM-DD` (días completos, `end` inclusivo). Casuto se entrega en metros (÷100).
  - Son las mismas URLs que **ya usa el dashboard** (`DashboardBucalemuNuevo`), que hoy reciben 404, así que el filtro por fecha de esos gráficos también queda arreglado.
  - Verificar: `curl "https://app.jteanalytics.cl/bucalemu/metrics/nivel_casuto?limit=3"` → valores en metros.

## Fase 2: monitores por sitio

Al final de la Fase 2, ejecutar `python MonitorEstanques/sincronizar.py --verificar` → 21 ✓.

### Sitios que ya consultaban la API

- [ ] **Cuevas**: `Cuevas/tankService.py` + `monitor_config.json`
  - Pasos comunes. El `.env` del servidor está en `C:\AutomatizationServices\cuevas\.env`; la API lee `NIVEL_ALERTA` desde ahí y el monitor lo sigue respetando.
  - ⚠️ Hoy el estanque está en **0.19 m y estable**. No alerta porque no baja (igual que antes). Confirmar si es real.
- [ ] **Zuñiga**: `Zuniga/tankService.py` + `monitor_config.json`
  - Pasos comunes. Corrige el aviso de desconexión, que antes se repetía cada 5 min.
- [ ] **Puquillay**: `Puquillay/tankService.py` + `monitor_config.json`
  - Pasos comunes. Antes leía `TOKEN`/`TO`, pero el `.env` tiene `API_TOKEN`/`API_TO`, así que **probablemente nunca envió alertas**. Revisarlo en el servidor.
  - ⚠️ Al 2026-10-26 el equipo lleva **3 días sin datos**: va a llegar un aviso de desconexión apenas se despliegue.
- [ ] **Manzano**: `Manzano/tankService.py` + `monitor_config.json`
  - Pasos comunes. Mantiene la alerta aunque el nivel esté estable (`ALERTAR_NIVEL_ESTABLE: true`), como antes.
- [ ] **California**: `California/tankService.py` + `monitor_config.json`
  - Pasos comunes. Unidad `%`; umbrales `NIVEL_ALERTA_CERRO` y `NIVEL_ALERTA_METALICO`.
- [ ] **Compañía**: `Compania/tankService.py` + `monitor_config.json`
  - Pasos comunes. Revisa cada 1 min (antes cada 30) y repite la alerta cada 30 min, como antes.
- [ ] **Cumpeo**: `Cumpeo/tankService.py` + `monitor_config.json`
  - Pasos comunes. Su API entrega hora Chile sin zona horaria, y `zona_horaria_api: America/Santiago` lo interpreta bien. En Windows esto requiere `tzdata`; sin él usa la zona del servidor.
  - Mantiene la alerta con nivel estable, como antes.
- [ ] **Hornillas**: `Hornillas/tankServiceHornillas.py` + `monitor_config.json`
  - Pasos comunes. Umbrales `NIVEL_ALERTA_50` y `NIVEL_ALERTA_100`.
- [ ] **Villa Carmen**: `VillaCarmen/monitorEstanqueVillaCarmen.py` + `monitor_config.json`
  - Pasos comunes. **La API entrega cm**: ahora se divide por 100. Antes comparaba 336 contra 2, así que **la alerta de nivel nunca podía dispararse**.
- [ ] **Cocalán**: `Cocalan/monitorEstanqueCocalan.py` + `monitor_config.json`
  - **Requiere la Fase 1 (Cocalan)**. Sin ella, avisa que lleva unas 5 h desconectado.
  - Pasos comunes.
  - ⚠️ Confirmar el sensor: `/nivel` usa `SSR_COCALAN--slave.nivel`, pero el snapshot calcula el vaciado con `SSR_COCALAN--slave.estanque`.
- [ ] **Auquinco**: `Auquinco/monitorEstanqueAuquinco.py` + `monitor_config.json`
  - **Requiere la Fase 1 (Auquinco)**.
  - Pasos comunes. **La API entrega cm**: ahora se divide por 100 (antes nunca alertaba). También tenía el problema `TOKEN`/`API_TOKEN`.
- [ ] **Nerquihue**: `Nerquihue/monitorEstanqueNerquihue.py` + `monitor_config.json`
  - Pasos comunes.
- [ ] **Los Boldos**: `Boldos/monitorBoldos.py` + `monitor_config.json`
  - Pasos comunes. Ahora incluye la **desconexión por sensor** del snapshot (umbral de 10 min) que hacía `connectionMonitorBoldos.py`.
  - [ ] **Detener y eliminar** en el servidor el proceso de `connectionMonitorBoldos.py` (ya se eliminó del repo).
  - Reinicio automático de un servicio Windows: definir `REINICIO_SERVICIO_WINDOWS=<nombre exacto en services.msc>` en el `.env` **solo** si el monitor corre en el mismo servidor Windows. Antes tenía un nombre de ejemplo y siempre fallaba.

### Sitios migrados de base de datos a API

En estos sitios ya no se necesitan `mysql-connector-python` ni `psycopg2`.

- [ ] **Ranguil**: `Ranguil/MonitoreoEstanqueRanguil.py` + `monitor_config.json`
  - Pasos comunes. Usa `/ranguil/nivel` (÷100) y `/nivel2`, más la desconexión del equipo por snapshot.
  - [ ] **Detener y eliminar** en el servidor el proceso de `ConnectionMonitorRanguil.py`. Ojo: ese avisaba al **grupo del cliente** y ahora la desconexión va al admin.
- [ ] **Carmen Bajo**: `Carmen/monitorEstanqueCarmen.py` + `monitor_config.json`
  - Recomendado tener antes la Fase 1 (Carmen). Sin ella funciona igual, pero con 100 muestras.
  - Pasos comunes. Antes **se caía con la primera alerta** (`NameError`) y leía `API_TOKEN` cuando el `.env` tiene `TOKEN`.
- [ ] **Los Aromos**: `Aromos/monitorAromos.py` + `monitor_config.json`
  - Pasos comunes.
- [ ] **Idahue**: `Idahue/monitorEstanqueIdahue.py` + `monitor_config.json`
  - Pasos comunes.
  - ⚠️ Al 2026-10-26 **Planta 1 lleva 20 días y Planta 2 lleva 11 días sin datos**: llegará un aviso de desconexión.
- [ ] **González**: `Gonzalez/monitorEstanqueGonzalez.py` + `monitor_config.json`
  - Pasos comunes.
- [ ] **Marchigüe**: `Marchigue/tankService.py` + `monitor_config.json`
  - Pasos comunes. Usa `https://app.jteanalytics.cl/trinidad/nivel` (÷100), verificado con datos reales.
  - [ ] Crear el `.env` en el servidor. Antes no tenía y las credenciales estaban en el código; el `.env` local ya tiene `API_URL`, `API_TOKEN`, `API_TO` y `API_TO_ADMIN`.
- [ ] **Bucalemu**: `Bucalemu/tankServiceBucalemu.py` + `monitor_config.json`
  - **Requiere la Fase 1 (Bucalemu)**. Sin ella recibe 404.
  - Pasos comunes. Mantiene sus umbrales: crítico 1 m (Alto y Casuto 2 m), rebalse 4.25/4.30 m, y repetición cada 30 min.
  - [ ] Agregar al `.env` del servidor `API_URL`, `API_TOKEN`, `API_TO` y `API_TO_ADMIN`. El `.env` local no los tenía: los valores salieron de la copia con credenciales que se eliminó.

### Solo desconexión

- [ ] **Araucarias**: `Araucarias/connectionService.py` + `monitor_config.json`
  - Pasos comunes. Compara en UTC: se eliminó el `DESFASE_BACKEND = 3h` fijo, que fallaba con el cambio de horario de abril.
  - Ya no necesita la librería `schedule`. Puedes borrar el `connection_state.json` antiguo.

## Fase 3: servicios corregidos sin migrar

- [ ] **Olivar Bajo**: `Olivar_Bajo/services/MonitoreoEstanqueOlivarBajo.py`
  - Sigue leyendo PostgreSQL porque no encontré la ruta pública de `api-olivar`.
  - Correcciones:
    - `.env` y log con ruta absoluta;
    - log rotativo;
    - timeout al enviar;
    - el ciclo ya no muere ante un error inesperado;
    - **nueva alerta al admin si el equipo deja de escribir más de 30 min**: antes solo detectaba el sensor en 0;
    - `sensor_id = '1'`: la columna es `varchar`, y comparar contra el número `1` falla en PostgreSQL.
  - [ ] Agregar `API_TO_ADMIN` al `.env` del servidor (el local ya lo tiene) y reiniciar.
- [ ] **Zuñiga, latido diario**: `Zuniga/healthCheckService.py`
  - Solo cambió la carga del `.env`, que ahora usa ruta absoluta.
  - Sigue enviando el "todo OK" al **grupo del cliente** (decisión pendiente, ver abajo).

## Fuera de esta implementación

- **Guindo** (`Guindo/monitorEstanqueGuindo.py` y su copia `Llaveria/monitorEstanqueGuindo.py`) y **Llaveria** (`Llaveria/monitorEstanqueLlaveria.py`): no tienen API y habría que crearla. **No se tocaron.**
  - Guindo conserva estos bugs:
    - lee `API_TOKEN` y su `.env` tiene `TOKEN`;
    - el tiempo de vaciado vuelve a cero a las 24 h;
    - registra "Todo normal" justo después de alertar.
  - Llaveria conserva estos bugs:
    - el tiempo de vaciado vuelve a cero a las 24 h;
    - la desconexión compara la hora local con la de la BD.

## Decisiones pendientes

- [ ] **Nivel bajo pero estable**: hoy solo alertan Manzano y Cumpeo (`ALERTAR_NIVEL_ESTABLE: true` en su `monitor_config.json`). Para cambiarlo en otro sitio, agregar `ALERTAR_NIVEL_ESTABLE=true` a su `.env`.
- [ ] **Repetición de alertas de nivel**: 5 min por defecto (30 en Compañía y Bucalemu). Se cambia con `REPETIR_ALERTA_MINUTOS`.
- [ ] **Recordatorio de desconexión**: cada 24 h (`RECORDATORIO_DESCONEXION_HORAS`, 0 lo desactiva).
- [ ] **Nombres de estanques**: en los sitios con un solo estanque se cambió "Estanque Nuevo" por "Estanque". Ajustar `nombre` en `monitor_config.json` si se prefiere otro.
- [ ] **Segundos estanques sin monitorear**: `/cuevas/nivel2`, `/zuniga/nivel2` y `/cumpeo/nivel2`. Para monitorearlos, basta con agregar un estanque al `monitor_config.json`.
- [ ] **Latido de Zuñiga**: ¿enviarlo al admin en vez de al cliente?
- [ ] **Aromos `/nivel2`**: consulta el mismo sensor que `/nivel` y Aromos tiene un solo estanque. ¿Eliminar el endpoint?

## Bugs del análisis y su estado

| Bug | Estado |
|-----|--------|
| B1 Auquinco con datos de 6 h | ✅ API (Fase 1) + el monitor toma siempre los más recientes |
| B2 Cocalan con datos de 6 h | ✅ API (Fase 1) |
| B3 Sensor de Cocalan | ⏳ Confirmar (ver Cocalán) |
| B4 Vaciado vuelve a 0 a las 24 h | ✅ Formato `1 d HH:MM:SS`, con tope "más de 7 días" |
| B5 `.env` y código con nombres distintos | ✅ El monitor acepta ambos nombres |
| B6 Carmen se cae al alertar | ✅ Reemplazado |
| B7 Configuración "dinámica" falsa | ✅ `.env` y json se releen en cada ciclo |
| B8 Zonas horarias mezcladas | ✅ Todo en UTC, con `zona_horaria_api` para Cumpeo y aviso si llegan datos "del futuro" |
| B9 Desfase fijo en Araucarias | ✅ |
| B10 Spam de desconexión en Zuñiga | ✅ Aviso único + recuperación + recordatorio 24 h |
| B11 Proceso muere por error de BD | ✅ Ya no se usa la BD; el ciclo captura cualquier excepción |
| B12 `load_dotenv()` sin ruta | ✅ En todos los servicios tocados |
| B13 Reinicio de Boldos siempre falla | ✅ Configurable y desactivado por defecto |
| Nuevo: Auquinco y Villa Carmen en cm | ✅ Divisor 100 |
| Nuevo: endpoints de nivel de Bucalemu con 404 en el dashboard | ✅ Creados |
| Nuevo: `sensor_id = 1` en Olivar | ✅ |
| S1 Credenciales en git | ✅ Movidas a `.env` y copia eliminada · ⏳ Cambiar claves (Fase 0) |
