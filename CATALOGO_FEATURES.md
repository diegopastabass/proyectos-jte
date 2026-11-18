# Catálogo de features para dashboards de monitoreo

Versión: 2026-11-18 (revisión completa del repo, cliente por cliente) · Referencias: Viña Montes (`Montes/`), Undurraga (`Undurraga/`), SSR Las Balsas (`Balsas/`), Cumpeo (`Cumpeo/`) y Conciliación Bancaria (`ConciliacionBancaria/`).

Este documento describe features ya implementadas y probadas que se pueden llevar a otros clientes, y las convenciones que mantienen el repo coherente. Está escrito para que una persona o un LLM pueda:

1. entender el contexto de la plataforma sin leer todo el repo (§1, §12);
2. elegir qué features aplicar a un cliente (§2);
3. implementar cada feature siguiendo su ficha (§4–§6, §8–§9), que es autocontenida;
4. crear un cliente nuevo o modernizar uno existente con la plantilla actual (§10) o, si no es de monitoreo, con las convenciones de apps de negocio (§11);
5. saber qué está roto o pendiente antes de tocar un cliente (§13).

---

## 0. Cómo usar este documento (instrucciones para un LLM)

- **Lee §1 y §3 siempre.** Son el contexto y las reglas que aplican a cualquier feature.
- **Busca el cliente en §12 y revisa §13** antes de tocarlo: ahí están su puerto, su tabla, qué tiene implementado y los bugs conocidos.
- **Para un cliente nuevo o una reescritura, parte de §10** (plantilla Balsas), no de un cliente antiguo: la mayoría de los clientes antiguos arrastran los errores de §13.
- **Usa la tabla de §2 para decidir.** No implementes una feature si el cliente no cumple sus requisitos (columna "Requiere"). Si falta un requisito, dilo y propón cómo cubrirlo antes de escribir código.
- **Cada ficha tiene la misma estructura:** qué es, cuándo usarla, requisitos, archivos de referencia, pasos, adaptación, verificación y errores conocidos. Sigue los pasos en orden.
- **Copia desde las implementaciones de referencia en vez de reescribir.** La consistencia visual y de comportamiento entre clientes es parte del valor.
- **Antes de tocar código, revisa el proyecto del cliente:** stack, rutas de la API, unidades de los sensores, cómo llegan los datos (§1.3). Las diferencias entre clientes son grandes.
- **No inventes datos de negocio.** Los nombres de equipos, las unidades y la relación entre equipos se confirman con el cliente (§3).

Ejemplo de pedido a un LLM:

> Lee `CATALOGO_FEATURES.md`. Para el cliente `<Cliente>`, revisa su API y su dashboard y dime cuáles de las features F1, F2 y F3 se pueden aplicar, qué falta para las demás y en qué orden las implementarías. No escribas código todavía.

---

## 1. Contexto de la plataforma

### 1.1 Qué es

JTE Analytics monitorea instalaciones de agua de clientes (APR, SSR, viñas, agrícolas): pozos, bombas, estanques, caudalímetros y totalizadores. Cada cliente tiene su propia carpeta en este repo, con una API y un dashboard web, y en algunos casos servicios Python (ingesta, alertas y reportes a la DGA). El repo también contiene apps de negocio que no son de monitoreo (§11).

Familias de proyectos (inventario completo en §12):

| Familia | Clientes | Qué los distingue |
|---------|----------|-------------------|
| **SSR / APR con estanques** (la mayoría) | Balsas, Tambo, Cuevas, Cumpeo, Zuñiga, Ranguil, Boldos, Bucalemu, California, Carmen, Cocalán, Compañía, González, Hornillas, Idahue, Manzano, Nerquihue, Puquillay, Quillay, Trinidad, Villa Carmen, Aromos, Auquinco | Tabla `ssr_<cliente>(mt_name, mt_value, mt_time_2)`, rutas `snapshot`, `nivel`, `caudal`, `totalizador`, `horometro`; diagrama SCADA (F2); monitor de estanques (F3). Plantilla actual: §10 |
| **Pozos con reporte DGA** | Auquinco, California, Carracedo, Encinos (Araucarias tiene el módulo sin uso) | Script diario que envía freático, caudal y totalizador a la DGA y guarda el resultado en `<cliente>_reports` (F5, §9) |
| **Caudal y totalizadores sin estanques** | Montes, Undurraga | Rutas por sensor (`caudal/:sensor`, `totalizador-hora/:sensor`…), consumo diario cacheado, exportador `exceljs` (F1). Ver §4 y §7 |
| **Pozos simples (sin SCADA)** | Amigos, Miraflores, Araucarias, Carracedo, Encinos | Dashboard de tarjetas y `TimeSeriesChart`; tablas sin prefijo `ssr_` (`araucarias`, `carracedo`, `encinos`, `ssr_amigos`, `pozo_miraflores`); sin monitor salvo Araucarias |
| **Agro** | Zagal (parcelas 18, 57 y 82), Viveros, Olivar Bajo | Riego por sectores con mapa Leaflet y triggers SQL (Zagal); temperatura, humedad y VPD (Viveros); API con `POST` de ingesta (Olivar, Viveros) |
| **Apps de terreno y negocio** | Mantenimiento, RanguilMediciones, ZunigaMediciones, DemoMediciones, CheckListVehiculos, Cotizaciones, Maval, MavalECommerce, ReconocimientoVehiculos, ConciliacionBancaria | Login JWT, formularios con fotos, PDFs generados en el navegador. Convenciones en §11 |
| **Portal** | `jte/JTEFront` | Página de entrada con enlaces a los dashboards |

### 1.2 Estructura típica de un cliente de monitoreo

| Pieza | Ubicación habitual | Stack |
|-------|--------------------|-------|
| API | `<Cliente>/api-<cliente>/` | NestJS 11 + TypeORM + PostgreSQL en AWS RDS. Amigos y Miraflores tienen además una versión MySQL antigua (`api-<cliente>` frente a `api-<cliente>-pg`); Trinidad lee también la MySQL de Marchigüe con `mysql2` |
| Dashboard | `<Cliente>/front-<cliente>/` (nombre de los proyectos nuevos), `<Cliente>/Dashboard<Cliente>React/` o `<Cliente>/dashboard-<cliente>/` (antiguos) | React 19 + Vite + TypeScript + Bootstrap 5 + bootstrap-icons + Chart.js (`react-chartjs-2`) |
| Ingesta | Script Python MQTT → BD (`Tambo/providerTambo.py` es la referencia, §10.4), un equipo en terreno que hace `POST` a la API (Undurraga, Olivar, Viveros) o un colector fuera del repo (la mayoría de los SSR) | Python 3, `paho-mqtt`, `psycopg2` |
| Alertas | `<Cliente>/<script>.py` + `monitor_config.json` (monitor unificado, F3) | Python 3, `requests`, `python-dotenv` |
| Reporte DGA | `<Cliente>/<cliente>Reports.py` + módulo `reports` de la API (F5) | Python 3, `schedule`, `requests` |

Publicación: `https://app.jteanalytics.cl/<cliente>/`. Un nginx en Windows enruta `/<cliente>/` al puerto de la API y quita el prefijo: las rutas de la API **no** llevan `/<cliente>`. La copia de `Montes/nginx.conf` está desactualizada (solo llega al puerto 3020); los puertos reales están en §12. El dashboard se compila con `base: "/<cliente>/"` en `vite.config.ts`, con barra final. Las APIs corren con pm2 (`ecosystem.config.js`, `script: 'dist/main.js'`) y los servicios Python como servicio de Windows (pm2, NSSM o el programador de tareas), en carpetas `C:\AutomatizationServices\<cliente>\`.

### 1.3 Datos

- Las tablas guardan lecturas crudas `(sensor, valor, hora)`. El nombre de la tabla, de las columnas y el tipo cambian por cliente: `montes(name, value varchar, time timestamp)`, `undurraga_metrics(sensor_id int, value numeric, time timestamptz)`, `ssr_<cliente>(mt_name, mt_value, mt_time_2)`, etc.
- En las tablas `ssr_*`:
  - `mt_name` lleva el prefijo del equipo que reporta: `<EQUIPO>--slave.<variable>` (`DOS_BALSAS--slave.caudal`, `ESTANQUE_20M3--slave.AI12`). Un sitio puede tener varios equipos, cada uno con su prefijo y su hora de último dato.
  - `mt_value` es **texto** y llega en unidades crudas del PLC (×10, ×100, mV); hay que convertirlo con `Number()` y un divisor.
  - `mt_time_2` es `timestamp` **sin zona, en hora de Chile**. Lo pone la BD al insertar (por eso los providers insertan apenas llega el dato) o el provider con la hora de llegada.
  - Muchas tablas repiten la misma lectura con el mismo `mt_time_2` (Cocalán la repite unas 10 veces). La entidad TypeORM declara `mt_time_2` como PK, así que TypeORM fusiona esas filas: con `LIMIT` usa SQL directo con `DISTINCT ON` o sondeos `LATERAL` (§10.2).
- Junto a la tabla cruda suele existir `ssr_<cliente>_daily_metrics(mt_name, mt_day, mt_value)` con los totales diarios cacheados (PK `(mt_name, mt_day)`). Su `CREATE TABLE` no está en el repo en la mayoría de los clientes.
- Tipos de sensor habituales: **caudal** (m³/h o L/s, instantáneo), **totalizador** (m³ acumulados; algunos se reinician cada día), **nivel** (m o %, a veces en cm), **presión**, **horómetro**, **bomba on/off**.
- Señales eléctricas (Balsas, Cuevas, Ranguil, Auquinco, Nerquihue, Quillay): tensiones de fase y de línea, corrientes por fase, kWh del PLC. Estado de tablero: `bomba`, `falla`, `automatico`/`manual` (0/1). Algunos sitios tienen además panel solar (`solar`, en mV) y nivel freático del pozo (`freatico`, en cm).
- Frecuencia: de 1 lectura por minuto (Undurraga) a 1 cada 10 min (Montes).
- La hora relevante para el cliente es siempre **hora de Chile** (`America/Santiago`, con horario de verano).

### 1.4 Convenciones de código

- UI, comentarios y mensajes en **español**.
- Fechas de día como texto `AAAA-MM-DD`; instantes como ISO 8601 en UTC.
- Rutas de la API para series (contrato usado por F1; Montes y Undurraga ya lo tienen):

| Ruta | Devuelve |
|------|----------|
| `GET latest` (o `snapshot`) | `{ [sensor]: { value, time } }`: última lectura por sensor |
| `GET caudal/:sensor?start=AAAA-MM-DD&end=AAAA-MM-DD` | lecturas crudas `[{ value, time }]` en orden cronológico; días completos en hora Chile, `end` inclusivo |
| `GET totalizador/:sensor?start&end` | consumo por día `[{ time: "AAAA-MM-DD", value }]` (m³) |
| `GET totalizador-hora/:sensor?start&end` | consumo por hora `[{ time: ISO, value }]` (m³) |
| `GET totalizador-mes/:sensor?meses=12` | consumo por mes `[{ time: "AAAA-MM", value }]` |
| `GET consumo-hora/:sensor?start&end` | volumen por hora integrado desde el caudal `[{ time: ISO, value }]` |

  Implementación de referencia: `Montes/api-montes/src/services/metrics.service.ts` (`time` sin zona) y `Undurraga/api-undurraga/src/metrics/services/metrics.service.ts` (`time` con zona).

- Rutas de los clientes SSR (contrato usado por los dashboards, el monitor F3 y los reportes F5). La forma exacta de la plantilla está en §10.2:

| Ruta | Parámetros | Devuelve |
|------|------------|----------|
| `GET snapshot` | — | `{ snapshot: { [variable]: { value, time } }, tiempo_vaciado…, nivel_alerta? }`; variables **sin prefijo** de equipo |
| `GET nivel`, `nivel2`, `caudal`, `presion`… | `start`/`end` (días, `end` inclusivo) **o** `limit` (los N más recientes, 100 por defecto, tope 5000) | `[{ time: ISO, value }]` en orden cronológico |
| `GET totalizador`, `horometro`, `kwh` | `start`/`end` obligatorios | `[{ time: "AAAA-MM-DD", value }]`: consumo del día (m³), minutos de operación, kWh |
| `GET voltaje`, `corriente` | `start`/`end` opcionales (sin rango: últimas 6 h o `limit`) | `{ L1L2: [...], ... }` o `{ v1, v2, v3 }` según el cliente |
| `GET reports` | `start`/`end` | historial de envíos a la DGA (F5) |

  Cuando un sitio tiene varios pozos o estanques, los clientes nuevos usan un parámetro (`?pozo=pozo_1`, `?estanque=estanque_superior`; Balsas y Tambo) en vez de rutas numeradas (`nivel2`, `caudal-pozo2`, `horometro_planta1`).

---

## 2. Tabla de decisión

| Feature | Aporta | Requiere | Esfuerzo | Ficha |
|---------|--------|----------|----------|-------|
| **F1 Exportador a Excel** | Descarga de un libro `.xlsx` con resumen diario, consumo por hora y lecturas de caudal; atajos de rango; una hoja por serie | Rutas de §1.4 (al menos `totalizador` y `caudal` con `start`/`end`), o adaptar las que tenga el cliente | 2–4 h si la API ya tiene las rutas | §4 |
| **F2 Diagrama SCADA** | Esquema animado del proceso (pozo, bomba, tuberías, estanques, instrumentos) con el estado en vivo | Endpoint de snapshot con las señales del proceso; inventario de equipos y unidades confirmado | 0,5–1,5 días | §5 |
| **F3 Monitor de desconexión** | Aviso por WhatsApp al grupo admin cuando un equipo deja de reportar, aviso de recuperación, recordatorio cada 24 h, alerta si la API falla; opcional: nivel crítico y rebalse de estanques | Endpoint con la hora del último dato (snapshot o serie con `?limit=`); que la ingesta **no** reinserte datos viejos | 1–2 h (solo configuración) | §6 |
| **F4 Panel eléctrico** | Tensiones, corrientes, desbalance y estado de cada bomba; en la versión completa (Ranguil) salud del equipo, kWh/m³, costo y diagnósticos | Señales eléctricas en la tabla (V, I, kWh); escalas confirmadas | 0,5 día (panel Balsas) a 2 días (panel Ranguil) | §8 |
| **F5 Reporte DGA** | Envío diario a la DGA de freático, caudal y totalizador, con respaldo de cada respuesta y su historial en el dashboard | Pozo inscrito en la DGA (código de obra y credenciales del cliente); freático, caudal y totalizador en el snapshot | 2–4 h | §9 |
| Otras (selector de día, tarjetas de consumo, caché diaria, consumo por hora, aviso "sin datos", resumen mensual, indicador de llegada de datos, tiempo de vaciado robusto, horómetro por corriente) | Ver §7 | Ver §7 | — | §7 |

Combinaciones habituales:

- **Cliente nuevo con estanques:** API y dashboard desde la plantilla §10 + F3 (con estanques) + F2 + F1. Si tiene tablero eléctrico, F4.
- **Pozo con obligación de reportar a la DGA:** F5 además de lo anterior.
- **Cliente con caudal y totalizadores, sin estanques:** F3 (solo conexión) + F1 + las de §7 (como Montes).
- **Cliente existente sin cambios grandes:** empieza por F3: es configuración pura y detecta caídas de inmediato. En Undurraga habría avisado de 11 meses sin datos.

---

## 3. Reglas transversales (lecciones aprendidas)

Aplican a cualquier feature. Cada una salió de un problema real.

1. **El endpoint de ingesta no se toca.** Si los datos llegan por `POST` desde terreno, su ruta, cuerpo, validación, respuestas y errores se mantienen idénticos: cambiar el emisor es caro. Lo interno se puede mejorar (Undurraga guarda ahora la hora de llegada) sin cambiar el contrato.
2. **No inventes relaciones entre equipos.** No agregues proporciones ni comparaciones ("Riles / General", "Piscina / Pozos") sin confirmarlas. En Montes, Riles y General son sistemas independientes y la tarjeta de proporción hubo que quitarla.
3. **Confirma las unidades con el cliente.** Montes mostraba m³/h en el dashboard y L/s en el Excel. Hay niveles en cm, presiones en décimas de bar y horómetros en minutos.
4. **Todo en hora de Chile.** Nunca uses `toISOString().split("T")[0]` para obtener "el día": entre las 21:00 y las 23:59 devuelve el día siguiente. Usa `Intl.DateTimeFormat(..., { timeZone: "America/Santiago" })` (ver `Montes/dashboard-montes/src/lib/fechas.ts`).
5. **Revisa los datos antes de calcular.** Consultas útiles: tipos de columnas, zona horaria de la BD, índices, filas con la misma hora, bajadas de totalizadores, valores no numéricos. Ver §0 de `Montes/PLAN_MEJORAS.md` y §0 de `Undurraga/PLAN_MEJORAS.md`.
6. **Despliegue:**
   - el orden es BD (migraciones) → API → dashboard;
   - antes de copiar `src` al servidor, revisa que el **puerto** de `main.ts` coincida con el de nginx (en Montes eso dio un 502 que el navegador mostró como error de CORS);
   - si cambia `package.json`, copia también `package-lock.json` y ejecuta `npm ci`;
   - revisa con `pm2 describe` que el `script` apunte a lo que genera la compilación (`dist/main.js`).
7. **Dependencias:** npm de este equipo bloquea paquetes desde URLs remotas. Usa paquetes del registro (`exceljs`, no la versión de `xlsx` desde el CDN de SheetJS; `xlsx@0.18.5` de npm está abandonada).
8. **Verifica en el navegador** antes de dar por terminado un cambio visual, y prueba la API contra una BD local con el mismo esquema que producción cuando la de producción no es accesible.
9. **Al copiar de otro cliente, busca su nombre.** Casi todos los dashboards nacieron copiando otro, y quedaron URLs, claves y textos del original: hoy hay exportadores que consultan la API de otro cliente y un reporte DGA que envía datos de otro pozo (§13). Después de copiar, ejecuta `grep -rniE "zuniga|ranguil|carracedo|auquinco|nerquihue|<cliente de origen>" src/` y deja **una sola** constante con la URL base (`API_BASE`, §10.3).
10. **Claves de `localStorage` con el nombre del cliente.** Todos los dashboards comparten origen (`app.jteanalytics.cl`) y por lo tanto `localStorage`. Una clave como `jte_cache_totalizador` hace que un dashboard muestre la caché de otro. Usa `jte_cache_<cliente>_<endpoint>_<parámetros>` (Balsas, Tambo). González ya pasó por esto (notas del 2026-05-25).
11. **La API entrega unidades de ingeniería.** Los divisores (cm → m, ×10, mV → V) van en un solo archivo de la API (`sensores.config.ts`, §10.2), no repartidos entre `Home.tsx`, el diagrama, el exportador y el monitor. En los clientes antiguos la misma conversión está en tres o cuatro sitios y no siempre coincide (Zuñiga, Ranguil).
12. **Caché de totales diarios:** el día en curso nunca se guarda (ni en `*_daily_metrics` ni en `localStorage`) y el día anterior se recalcula siempre, porque pudo cachearse incompleto (Cumpeo). Un día sin lecturas es `NULL`/"sin datos", no `0`.
13. **Valida la entrada y responde 400, no 500.** `ValidationPipe({ transform: true })` global y DTO con `class-validator`: fechas `AAAA-MM-DD`, `start <= end`, `limit` entero entre 1 y 5000, parámetros de lista con `@IsIn`. Sin el pipe, las validaciones del DTO no se aplican (Zuñiga, Ranguil).
14. **Umbrales en un solo lugar.** El nivel de alerta que dibuja el dashboard debe ser el mismo con que avisa el monitor. La plantilla lo lee del `.env` de la API y lo devuelve en el snapshot (`nivel_alerta`, `nivel_maximo`); Boldos y Cuevas lo leen del `.env` del monitor (`C:\AutomatizationServices\<cliente>\.env`, receta en `PROMPT_NivelAlarmas.txt`). En ambos casos documenta que `nivel_alerta` de `monitor_config.json` debe coincidir.
15. **Puertos únicos y registrados.** Antes de asignar un puerto, revisa §12: hoy hay choques reales. Usa el siguiente libre (el último asignado es 3042) y anótalo en §12 y en el nginx.
16. **Secretos sin valor por defecto.** `JWT_SECRET` con `config.getOrThrow` (la API no arranca sin él), CORS restringido con `CORS_ORIGINS` y `synchronize: false`. Varias apps firman tokens con `'secreto_super_seguro'` o `'defaultSecret'` si falta la variable (§13).
17. **Código muerto fuera.** Componentes sin importar (`LoginModal`, `BurgerMenu`, `DropdownCard*`, `pages/Chart.tsx`, `CaudalChart`), copias de componentes en la raíz del cliente (`Ranguil/Pipe.tsx`) y `.zip` de la API versionados confunden la siguiente revisión. Si se deja, que sea con un motivo escrito.

---

## 4. F1 · Exportador a Excel

### 4.1 Qué es

Un modal ("Exportar historial de datos") abierto desde la barra superior, que genera un libro `.xlsx` en el navegador:

- **Selector de reporte:** "Todo" o una serie concreta, agrupadas por línea con `<optgroup>`. Cada línea (equipo) ofrece los tipos que tiene: consumo diario, consumo por hora, caudal (lecturas).
- **Atajos de rango:** Hoy, 7 días, Mes actual, Mes anterior. Rango por defecto: últimos 7 días. Ninguna fecha puede ser posterior a hoy.
- **"Todo"** genera un libro con varias hojas:
  - **Resumen diario:** una columna por línea, sin cálculos entre ellas;
  - **Consumo por hora** de cada línea (según totalizador);
  - **Lecturas de caudal** de cada línea que tenga caudal.
- **Cada hoja** tiene un título, una línea "<Sitio> · del X al Y (hora Chile)", una fila vacía, los encabezados en negrita con la unidad (`Consumo (m³)`, `Caudal (m³/h)`) y las filas congeladas hasta el encabezado.
- **Valores numéricos** (no texto), fecha `AAAA-MM-DD` y hora `HH:mm` en hora Chile.
- **Validación inline** (`Alert`) en vez de `alert()`: fechas vacías, inicio posterior al fin, rango sin datos, error de la API.
- **Nombre del archivo:** `<cliente>_<reporte>_<inicio>_<fin>.xlsx`.
- **`exceljs` se carga con `import()` dinámico** solo al exportar: queda en un chunk aparte (~940 kB) y no pesa en la carga inicial.

### 4.2 Cuándo usarla

Siempre que el cliente pida descargar datos. Reemplaza los exportadores antiguos (un solo reporte, `xlsx` + `file-saver`, fechas en UTC, unidades fijas).

### 4.3 Requisitos

- Rutas de la API con rango por días (§1.4). Como mínimo, consumo diario y lecturas crudas. Si el cliente tiene otras rutas, se adapta `hojaDe` (ver 4.6).
- Que la API devuelva números. Si devuelve texto (Montes devolvía `"21.34"`), `getSerie` lo convierte, pero conviene corregirlo en la API.
- Unidades confirmadas por sensor (§3.3).
- `react-bootstrap` (`Modal`, `Form`, `Alert`, `ButtonGroup`, `Spinner`) y `exceljs@^4.4.0`.

### 4.4 Archivos de referencia

Versión más general (tres líneas, una sin caudal): `Undurraga/dashboardUndurraga/src/`.

| Archivo | Rol |
|---------|-----|
| `components/ExportToExcel.tsx` | Formulario, armado de hojas (`hojaDe`, `hojaResumen`) y escritura del libro (`descargarLibro`) |
| `components/ExportModal.tsx` | Modal de `react-bootstrap` que lo envuelve y le pasa `onClose` |
| `config.ts` | `LINEAS`: id, nombre visible, sensor de caudal (opcional), sensor de totalizador y color por línea; `ORDEN_LINEAS`, `LINEAS_CAUDAL` |
| `lib/api.ts` | `getJson`, `getSerie` (convierte `value` a número), `getDiario` (normaliza el día con `aDia`), `conRango` |
| `lib/fechas.ts` | `diaChile`, `horaChile`, `hoyChile`, `sumarDias`, `listarDias` (todo en hora Chile) |
| `components/types.tsx` | Tipo `Punto { value, time }` |

Versión con dos líneas, ambas con caudal: `Montes/dashboard-montes/src/` (mismos nombres de archivo).

### 4.5 Pasos

1. **Dependencias:** `npm install exceljs@^4.4.0`. Quita `xlsx` y `file-saver` (y `@types/file-saver`) si ya no se usan en otra parte.
2. **Copia** `lib/fechas.ts`, `lib/api.ts`, `components/types.tsx`, `components/ExportModal.tsx` y `components/ExportToExcel.tsx` desde la referencia.
3. **Crea o adapta `config.ts`**:
   - `API_BASE` con la URL del cliente; acepta `VITE_API_BASE` para probar contra una API local;
   - `LINEAS`, una entrada por equipo, con los ids de sensor que usa la API;
   - `ORDEN_LINEAS` y `LINEAS_CAUDAL`.
4. **Ajusta en `ExportToExcel.tsx`**:
   - el nombre del sitio en la segunda fila de cada hoja;
   - el prefijo del archivo;
   - `TIPOS` y `tiposDe` si el cliente tiene otras series (4.6).
5. **Conéctalo en la página:**
   - un botón en la barra superior (`<Navbar>{children}</Navbar>`) con `aria-label="Exportar a Excel"` que haga `setIsOpenExport(true)`;
   - `<ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />`.
6. **Elimina el exportador anterior** y lo que solo usaba él.

### 4.6 Adaptación

- **Otra serie** (nivel, presión, horómetro):
  1. agrega una clave a `TIPOS`;
  2. agrega una rama en `hojaDe` con la ruta, las columnas (con unidad) y el formato de cada fila;
  3. filtra en `tiposDe` las líneas que no la tienen.

  Ejemplo de horómetro: columnas `["Fecha", "Horas de operación"]` y valor `minutos / 60`.
- **Rutas distintas a §1.4:** cambia solo la URL dentro de `hojaDe`. Si la ruta antigua usa otros nombres de parámetro (Undurraga usaba `startDate`/`endDate`), adáptalos ahí.
- **Línea sin caudal** (la piscina de Undurraga): deja `caudal` sin definir en `LINEAS` y `tiposDe` no ofrecerá esa opción; "Todo" la incluye en el resumen y en el consumo por hora.
- **Respuestas diarias antiguas con ISO** en vez de `AAAA-MM-DD`: `aDia` las normaliza.
- **Rangos grandes:** con 1 lectura por minuto, un año de caudal son ~525.000 filas por hoja, demasiado para generar en el navegador. Si el cliente tiene datos tan densos, limita el rango de las hojas de caudal (por ejemplo, 92 días) y avísalo en el formulario. Montes y Undurraga **no** tienen ese límite todavía.

### 4.7 Verificación

1. `npx tsc -b`, `npx eslint .`, `npx vite build`. En el build, `exceljs` debe aparecer como chunk aparte (`exceljs.min-*.js`).
2. En el navegador (dev server), abre el modal y prueba los atajos, la validación (inicio > fin) y Cancelar.
3. Genera el libro **sin descargarlo**: intercepta el clic de descarga y léelo en memoria. Pega esto en la consola con el modal abierto:

   ```js
   window.__descargas = [];
   HTMLAnchorElement.prototype.click = function () { window.__descargas.push({ href: this.href, name: this.download }); };
   URL.revokeObjectURL = () => {};
   [...document.querySelectorAll('.modal button')].find(b => b.textContent.includes('Exportar a Excel')).click();
   await new Promise(r => setTimeout(r, 6000));
   const d = window.__descargas[0];
   const buf = await (await fetch(d.href)).arrayBuffer();
   const E = (await import('/<base>/node_modules/.vite/deps/exceljs.js')).default;
   const wb = new E.Workbook(); await wb.xlsx.load(buf);
   wb.worksheets.map(ws => ({ hoja: ws.name, filas: ws.rowCount, encabezado: ws.getRow(4).values.slice(1), primera: ws.getRow(5).values.slice(1) }));
   ```

   Comprueba los nombres de hoja, que los valores sean números, que las fechas estén en hora Chile y que las unidades sean las correctas.

### 4.8 Errores conocidos

- **Fecha en UTC:** `new Date(time).toISOString().split("T")[0]` da el día siguiente entre las 21:00 y las 23:59 (Montes, B6). Usa `diaChile`.
- **Botón Cancelar que no hace nada:** pasa `onClose` desde el modal (Montes y Undurraga, B12/B14).
- **`<hr>` dentro de un `<select>`:** es HTML inválido. Usa `<optgroup>`.
- **Nombres de hoja:** Excel admite como máximo **31 caracteres** y no acepta `[]:*?/\`. Con nombres de línea largos, acórtalos en `hojaDe`.
- **`URL.revokeObjectURL` inmediato:** las referencias revocan la URL justo después del `click()`. Funciona en Chrome; en Firefox y Safari conviene revocar con `setTimeout(() => URL.revokeObjectURL(url), 1000)`. No está verificado en esos navegadores.
- **Columnas calculadas entre líneas:** no las agregues sin confirmarlas (§3.2). El resumen diario pone las líneas lado a lado y nada más.

---

## 5. F2 · Diagrama SCADA

### 5.1 Qué es

Un esquema del proceso dibujado con CSS y componentes React (sin imágenes):

- pozo con bomba sumergible;
- tuberías con codos de 90° y pulsos de flujo cuya velocidad depende del caudal;
- estanques cilíndricos con nivel animado y nivel de alarma;
- manómetros, válvulas, caudalímetros y placas de datos (horómetro, totalizador, tiempo de vaciado).

El estado viene del snapshot de la API: bomba encendida o en falla, niveles, caudal y presión. El lienzo es fijo (1200×630) y se escala al contenedor.

### 5.2 Cuándo usarla

Cuando el cliente tiene equipos físicos que conviene ver como proceso: pozos, bombas y estanques. También para reemplazar diagramas antiguos hechos con sprites PNG. No aporta en clientes que solo tienen caudalímetros sin relación física entre sí (Montes no lo usa).

### 5.3 Requisitos

- **Inventario de señales:** cada equipo con su tag (B-01, PI-01, LIT-01, FIT-01), su campo en la API, su unidad y su rango (nivel máximo y de alarma de cada estanque).
- **Geometría del proceso:** qué tubería conecta con qué, cuántos pozos y estanques.
- **Endpoint de snapshot** con la última lectura de cada señal (y, si se muestran, horómetro y totalizador).

### 5.4 Guía y archivos de referencia

**La guía completa es la skill `scada-css-diagrams`** (`~/.agents/skills/scada-css-diagrams/`). Úsala para crear, migrar desde sprites o agregar una pieza. Contiene:

| Ruta en la skill | Contenido |
|------------------|-----------|
| `SKILL.md` | Modos de trabajo, flujo, lenguaje visual, reglas de animación e interfaz |
| `assets/reference/` | `ScadaDiagram.tsx`, `Tank.tsx`, `Pipe.tsx`, `Pump.tsx`, `Instruments.tsx`, `scada.css` (referencia: Zuñiga) |
| `references/components.md` | Props y reglas de geometría de cada componente |
| `references/legacy-migration.md` | Migración desde diagramas con sprites PNG |
| `references/pitfalls.md` | Problemas conocidos y lista de verificación visual |
| `assets/preview-harness.tsx` | Página temporal con controles para probar todos los estados |

Implementaciones en el repo, de la más reciente a la más antigua:

| Cliente | Archivo | Particularidad |
|---------|---------|----------------|
| Cumpeo | `Cumpeo/front-cumpeo/src/components/ScadaDiagram.tsx` | Dos pozos que se unen a la línea, un estanque, indicadores de llegada de datos (`DataArrivalIndicator`), conversión de unidades en constantes |
| Balsas | `Balsas/front-balsas/src/components/ScadaDiagram.tsx` | Dos pozos (uno sin caudalímetro todavía: muestra `--`), estanque y descarga a la red; la API ya entrega unidades de ingeniería, así que el diagrama no divide |
| Cuevas | `Cuevas/front-cuevas/src/components/ScadaDiagram.tsx` | Dos estanques de equipos distintos (`SSR_CUEVAS` y `ESTANQUE_20M3`) |
| Tambo | `Tambo/front-tambo/src/components/ScadaDiagram.tsx` | Tres estanques en cascada, dos pozos |
| Ranguil | `Ranguil/DashboardRanguilReact/src/components/ScadaDiagram.tsx` | Dos estanques (uno en cm y otro en m) |
| Zuñiga | `Zuniga/DashboardZunigaReact/src/components/ScadaDiagram.tsx` | Referencia de la skill |

Los demás SSR (Aromos, Auquinco, Boldos, Bucalemu, California, Carmen, Cocalán, Compañía, González, Hornillas, Idahue, Manzano, Nerquihue, Puquillay, Quillay, Trinidad, Villa Carmen) siguen con el diagrama antiguo de sprites PNG (`Elbow.tsx`, imágenes de bomba y estanque). Son candidatos al modo "migrar desde sprites" de la skill.

### 5.5 Pasos (resumen; el detalle está en la skill)

1. Invoca la skill `scada-css-diagrams` y decide el modo: crear, migrar desde sprites o agregar una pieza.
2. Haz el inventario de señales y **confirma las unidades** (§3.3). Pásalas a constantes al inicio del diagrama, como `PRESION_DIV` y `TOTALIZADOR_DIV` en Cumpeo.
3. Copia los componentes de `assets/reference/` a `components/` y `scada.css` a `components/scada/`.
4. Define la geometría como constantes en unidades del lienzo (`PIPE_Y`, `GROUND_Y`, posición de pozos y estanques).
5. Compón con `Tank`, `Pipe` (lista de puntos), `Pump`, `PressureGauge`, `GateValve` y `FlowMeter`, y conecta el estado mediante props.
6. Verifica en el navegador con el harness y todos los estados (bomba encendida, apagada, en falla; estanque lleno, vacío, en alarma). Borra el harness al terminar.

### 5.6 Errores conocidos (resumen de `references/pitfalls.md`)

- **No definas el diagrama como componente dentro de la página:** cada refresco lo remonta y las transiciones de nivel no se ven.
- **Anima solo `transform` y `opacity`.** Nada de `top`, `height` ni `background-position` en bucle.
- **Escala con `ResizeObserver`**, no con media queries.
- **Respeta `prefers-reduced-motion`.**
- **Al migrar, mantén la interfaz:** las props públicas (`data`, `horometro`, `totalizador`) no cambian, así la página que lo llama tampoco.
- **El nivel del agua del pozo es una posición del dibujo**, no una profundidad medida. Dilo si no hay sensor.

---

## 6. F3 · Monitor de desconexión (y de estanques)

### 6.1 Qué es

Un servicio Python **único e idéntico para todos los sitios**: `MonitorEstanques/monitorEstanques.py`, v1.1.0. Se copia a cada sitio con el nombre de archivo que ya usa su servicio, y lo propio de cada sitio vive en `monitor_config.json` y `.env`. Consulta la API pública del sitio (nunca la BD) y envía avisos por WhatsApp con UltraMsg:

- **Desconexión** al grupo admin cuando un equipo o sensor pasa `UMBRAL_DESCONEXION_MINUTOS` (30) sin datos: un aviso, otro al recuperarse y un recordatorio cada `RECORDATORIO_DESCONEXION_HORAS` (24). Si se desconectan varios en el mismo ciclo, van agrupados en un solo mensaje.
- **Falla de la API** al grupo admin, tras `UMBRAL_FALLOS_API` (5) ciclos fallidos seguidos, y aviso de recuperación.
- **Opcional, estanques**, al grupo del cliente:
  - nivel crítico, con tendencia y tiempo estimado de vaciado por regresión lineal sobre una ventana de 30 min;
  - posible rebalse;
  - las alertas se repiten cada `REPETIR_ALERTA_MINUTOS`.
- **Estado persistido** en `estado_monitor.json`: un reinicio no repite avisos.
- **Configuración que se relee en cada ciclo:** cambiar un umbral no requiere reiniciar.

Formato de los mensajes (siempre con el sitio, porque el grupo admin recibe avisos de ~25 sitios):

```
⚠️ ALERTA DESCONEXIÓN ⚠️
Sitio: Undurraga
El equipo no ha reportado datos recientes.

Equipo 1 (caudal y totalizador 1)
Tiempo sin datos: 329 día(s), 7 hora(s) y 44 minuto(s).
Último dato: 2025-12-23 16:42 (hora Chile)
```

### 6.2 Cuándo usarla

En **todos** los clientes con datos en vivo. Es configuración pura, así que es la primera feature a instalar en un cliente nuevo o en uno que se retoma.

Estado al 2026-11-18: 25 sitios registrados en `sincronizar.py` y todas las copias idénticas a la v1.1.0 (`--verificar` da 25 ✓). Modos en uso:

- **solo estanques:** Aromos, Auquinco, Bucalemu (4), California (2), Carmen (2), Cocalán, Compañía, Cuevas (2), Cumpeo, González (2), Hornillas (2), Idahue (2), Manzano, Marchigüe, Nerquihue, Puquillay, Villa Carmen, Zuñiga;
- **estanques + conexión:** Balsas (`/equipos`, por sensor), Boldos (por sensor, umbral 10 min), Ranguil (equipo completo), Tambo (3 estanques, por sensor);
- **solo conexión:** Araucarias (equipo), Montes (`/latest`, por sensor), Undurraga (por sensor).

**Sin monitor:** Amigos, Carracedo, Encinos, Miraflores, Quillay, Trinidad, Zagal, Guindo y Llaveria (estos dos necesitan una API nueva: hoy leen MySQL directo). Viveros y Olivar Bajo tienen sus propios monitores en `services/`. Zuñiga mantiene además `healthCheckService.py` (latido "todo OK" a las 00:00 y 12:00 al grupo del cliente).

### 6.3 Requisitos

- **Un endpoint público con la hora del último dato:**
  - **Snapshot** (`/snapshot`, `/latest`) con formato `{ sensor: { value, time } }` o `{ snapshot: { ... } }`, para desconexión por equipo o por sensor;
  - o **series por estanque** con `?limit=N` (lo más reciente), para estanques.
- **Horas en ISO.** Si la API entrega hora Chile sin `Z` (Cumpeo), se configura `zona_horaria_api: "America/Santiago"` y en Windows hay que instalar `tzdata`.
- **Que la ingesta no reinserte datos viejos.** Si el proveedor sigue guardando el último valor con hora nueva cuando el equipo se cae (era el caso del provider antiguo de Montes), la hora del último dato avanza igual y la desconexión **nunca se detecta**. Hay que corregirlo antes; ver `Montes/providerMontes.py`, que solo guarda lo recibido en cada ventana.
- **Credenciales de UltraMsg en `.env`:** `API_URL`, `API_TOKEN`, `API_TO_ADMIN` y `API_TO` (este solo si hay estanques). Son las mismas en todos los sitios; se pueden copiar del `.env` de otro sitio sin mostrarlas.

### 6.4 Archivos de referencia

| Archivo | Rol |
|---------|-----|
| `MonitorEstanques/monitorEstanques.py` | El script único (origen). `PARAMETROS_DEFECTO` al inicio lista todos los parámetros |
| `MonitorEstanques/sincronizar.py` | Copia el script a cada sitio (`DESTINOS`) y verifica que todas las copias sean idénticas |
| `MonitorEstanques/env.example` | Plantilla del `.env` con todas las variables comentadas |
| `MonitorEstanques/requirements.txt` | `requests`, `python-dotenv`, `tzdata` (Windows) |
| `DEPLOY_MONITOREO.md` | Checklist de despliegue por sitio y decisiones pendientes |
| `HOMOGENEIZACION_MONITOREO.md` | Análisis de origen y diseño (por qué cada pieza es como es) |
| `Montes/monitor_config.json` | Ejemplo: solo conexión, por sensor, con nombres visibles |
| `Undurraga/monitor_config.json` | Ejemplo: solo conexión, por sensor, ignorando totalizadores y un sensor de prueba |
| `Araucarias/monitor_config.json` | Ejemplo: solo conexión, equipo completo |
| `Boldos/monitor_config.json`, `Ranguil/monitor_config.json` | Ejemplos: estanques y conexión |

### 6.5 Pasos

1. **Elige el modo según los datos del cliente:**
   - **Solo conexión, por sensor** (`"modo": "sensor"`): un aviso por sensor. Usa `ignorar_sensores` para no duplicar avisos de sensores del mismo equipo (por ejemplo, el totalizador que llega en el mismo mensaje que el caudal) y `nombres` para mostrar nombres legibles.
   - **Solo conexión, equipo completo** (`"modo": "equipo"`): un aviso cuando el sensor más reciente supera el umbral.
   - **Estanques** (`"estanques": [...]`): nivel crítico, rebalse y desconexión por estanque. Puede combinarse con `conexion`.
2. **Crea `<Cliente>/monitor_config.json`**:

   ```json
   {
     "sitio": "Undurraga",
     "api_base": "https://app.jteanalytics.cl/undurraga",
     "estanques": [],
     "conexion": {
       "endpoint": "/snapshot",
       "modo": "sensor",
       "nombre": "Equipos Undurraga",
       "ignorar_sensores": ["3", "4", "6"],
       "nombres": { "1": "Equipo 1 (caudal y totalizador 1)", "2": "Equipo 2 (caudal y totalizador 2)", "5": "Piscina" }
     }
   }
   ```

   Con estanques, cada entrada lleva `id`, `nombre`, `endpoint`, `divisor` (100 si la API entrega cm), `unidad` (`m` o `%`), `nivel_alerta` y `nivel_rebalse` (o `null`). Los umbrales se pueden sobrescribir en `.env` con `NIVEL_ALERTA_<ID>` y `NIVEL_REBALSE_<ID>`. Los parámetros propios del sitio van en `"parametros"` (Boldos usa `UMBRAL_DESCONEXION_MINUTOS: 10`).
3. **Registra el sitio** en `DESTINOS` de `sincronizar.py` con el nombre del archivo del servicio (`monitor<Cliente>.py` si es nuevo) y ejecuta `python MonitorEstanques/sincronizar.py`. Después, `python MonitorEstanques/sincronizar.py --verificar` debe dar ✓ en todos.
4. **Crea `<Cliente>/.env`** (está en `.gitignore`) con `API_URL`, `API_TOKEN`, `API_TO_ADMIN` y, si hay estanques, `API_TO`. Si el sitio ya tiene un `.env` de otro servicio en la misma carpeta (Montes comparte el del provider), agrega lo que falte.
5. **Prueba sin enviar:** `python monitor<Cliente>.py --una-vez --sin-enviar` ejecuta un ciclo, imprime los mensajes que enviaría y no guarda estado.
6. **Agrega el sitio** a `DEPLOY_MONITOREO.md`.
7. **En el servidor:**
   - instala `requirements.txt` y copia el script, `monitor_config.json` y `.env`;
   - repite la prueba sin enviar;
   - déjalo como servicio (pm2, NSSM o el programador de tareas);
   - revisa `logs_monitor.txt` en los primeros minutos.

### 6.6 Cambios en el script único

- **Hazlos en `MonitorEstanques/monitorEstanques.py`, nunca en una copia,** y sincroniza.
- **Que sean compatibles hacia atrás:** claves nuevas opcionales con valor por defecto, para que los sitios con la versión anterior en el servidor sigan funcionando. Así se agregó `conexion.nombres` en la v1.1.0.
- **Sube `VERSION`** y documenta el cambio en `DEPLOY_MONITOREO.md`.
- **Prueba en otro sitio que use el mismo modo,** con `--una-vez --sin-enviar`, para confirmar que no cambió su comportamiento.

### 6.7 Verificación

- **Prueba sin enviar contra la API real** (paso 5): debe listar cada equipo con "último dato hace X".
- **Prueba de transiciones con una API y un UltraMsg falsos:**
  - un servidor HTTP local que sirva el snapshot desde un archivo y registre los `POST`;
  - `api_base` y `API_URL` apuntando a ese servidor, en una carpeta temporal con copias del script y la configuración.

  Recorre estos casos y revisa los mensajes:
  1. todo al día (sin mensajes);
  2. un equipo sin datos (un aviso);
  3. siguiente ciclo (sin repetir);
  4. reinicio del proceso (sin repetir: estado persistido);
  5. recuperación (aviso de reconexión);
  6. API caída hasta el umbral (una alerta de API);
  7. API recuperada (aviso de recuperación).

### 6.8 Errores conocidos

- **Ingesta que reinserta datos viejos:** el monitor no detecta nada (§6.3).
- **Sitio que ya tenía alertas propias:** al instalar el monitor, quítalas para no duplicar avisos. El provider de Montes las tenía y se eliminaron.
- **Equipos caídos hace tiempo:** al instalarlo llega un aviso de inmediato. Es lo esperado; avísalo antes al equipo.
- **Windows sin `tzdata`:** las horas se muestran en la zona del servidor y no se puede usar `zona_horaria_api`.
- **Lecturas duplicadas en la tabla:** el monitor ya las tolera (un valor por hora en las series de estanques).
- **API que ignora `?limit=` u ordena al revés:** el monitor ordena por hora y toma lo más reciente, pero si la API devuelve datos de hace horas, revisa la API (ver bugs B1 y B2 en `HOMOGENEIZACION_MONITOREO.md`).

---

## 7. Otras features disponibles

Implementadas en Montes y Undurraga, con el mismo diseño. Para cada una, copia los archivos indicados (rutas relativas a `Montes/dashboard-montes/src/` o `Undurraga/dashboardUndurraga/src/`) y revisa la sección correspondiente de su `PLAN_MEJORAS.md`.

| Feature | Qué hace | Archivos | Requiere en la API |
|---------|----------|----------|--------------------|
| Caudal del día | Gráfico del día completo en hora Chile con selector (◀ fecha ▶ Hoy), cortes cuando faltan datos y resumen: máximo con hora, promedio, tiempo con caudal, volumen | `components/CaudalDiaChart.tsx`, `components/DaySelector.tsx`, `lib/charts.ts` | `caudal/:sensor?start&end`, `consumo-hora/:sensor` |
| Tarjetas por línea | Caudal actual con estado de conexión ("hace X min", verde, amarillo o rojo), consumo de hoy, de ayer y de 7 días con variación; contador del totalizador como dato secundario; variante sin caudal | `components/MetricCard.tsx`, `components/EstadoDato.tsx`, `lib/frescura.ts` | `latest`, `totalizador/:sensor` |
| Consumo diario cacheado | Tabla `<cliente>_daily_metrics` (días cerrados; hoy siempre calculado; NULL = sin datos). Consumo = suma de incrementos positivos entre lecturas con tope de caudal creíble, robusto ante reinicios del medidor | Servicio de la API (`diario`, `consumoPorDia`) + migración SQL | Migración en la BD |
| Consumo por hora desde caudal | Volumen por hora integrando el caudal; más fino que un totalizador entero | `getHourlyVolumeFromFlow` en la API | `consumo-hora/:sensor` |
| Diario y mensual | Barras agrupadas por línea (15 días y 12 meses) con tabla mensual desplegable | `components/BarrasAgrupadas.tsx`, `pages/Home.tsx` | `totalizador/:sensor`, `totalizador-mes/:sensor` |
| Aviso "sin datos" | Banner rojo cuando una línea lleva más de 30 min sin datos | `pages/Home.tsx` | `latest` |
| Refresco eficiente | Consulta cada 5 min y se pausa con la pestaña oculta | `hooks/usePolling.ts` | — |

Al calcular consumos, el orden de las lecturas depende de la columna de hora:

- **`timestamp` sin zona** (Montes): ordenar por `id`. Así se evita la hora repetida de abril.
- **`timestamptz`** (Undurraga): ordenar por `time, id`. Así no quedan fuera de lugar las filas cargadas a mano después.

Ver los comentarios en cada `metrics.service.ts`.

Implementadas en otros clientes (rutas relativas a la carpeta del dashboard o de la API indicada):

| Feature | Qué hace | Archivos de referencia | Requiere en la API |
|---------|----------|------------------------|--------------------|
| Resumen mensual (calendario) | Calendario del mes con el consumo de cada día coloreado en 5 niveles, navegación entre meses, total, promedio, día máximo y mínimo, días sin operación, horas de bomba, caudal medio (m³ ÷ minutos de operación), proyección al cierre y comparación con **los mismos días** del mes anterior (se oculta si ese mes tuvo menos del 60 % de días con operación). Vista de tabla y exportación a Excel. Se refresca cada 5 min solo si se mira el mes en curso; los meses cerrados quedan en memoria | `Cumpeo/front-cumpeo/src/components/MonthlySummary.tsx` + `.css` | `totalizador` y `horometro` diarios con `start`/`end` |
| Indicador de llegada de datos | Pastilla "Datos al día / retrasados / sin datos" por equipo, con modo compacto para ponerla dentro del diagrama SCADA | `Cumpeo/front-cumpeo/src/components/DataArrivalIndicator.tsx`; versión por equipo en `Balsas/front-balsas/src/balsas.ts` (`estadoComunicacion`, `RETRASO_MIN` = 10, `SIN_DATOS_MIN` = 30, el mismo umbral del monitor) | Hora del último dato por equipo (`snapshot.equipos` en Balsas) |
| Tiempo de vaciado robusto | Pendiente Theil-Sen (mediana de las pendientes entre pares) sobre los últimos 20 min, banda muerta de 1 mm/min y tope de 7 días. Distingue `vaciado`, `llenado`, `estable` y `sin_datos`, así "Llenando…" ya no aparece con el nivel estable. Reemplaza el cálculo con las dos últimas lecturas de los clientes antiguos | `Balsas/api-balsas/src/metrics/metrics.service.ts` (`calcularTiempoVaciado`), `Tambo/api-tambo/src/metrics/metrics.service.ts` | Serie del estanque |
| Horómetro desde la corriente | Minutos por día con la bomba en marcha (`I1 > 1 A`) cuando el tablero no reporta horómetro ni señal de bomba. Cada muestra vale hasta la siguiente, con tope de 5 min, y los tramos que cruzan medianoche se reparten. Compañía hace lo mismo con la señal `bomba` (0/1) | `getHorometro` en `Balsas/api-balsas/src/metrics/metrics.service.ts`; Compañía en `api-compania` (agrupa días en UTC: ver §13) | Corriente por fase o estado de bomba |
| Series por recurso independientes | Cada serie se pide por separado con `Promise.allSettled`: si una falla, las demás se actualizan y se conserva el último valor bueno de la que falló. El día "hoy" se recalcula en cada ciclo porque la pantalla queda abierta pasada la medianoche | `Balsas/front-balsas/src/pages/Home.tsx` | — |
| Gráfico de varias series | Tensiones y corrientes por fase en un solo gráfico | `MultiLineGraphCard.tsx` (Balsas, Cuevas) | `voltaje`, `corriente` |

---

## 8. F4 · Panel eléctrico

### 8.1 Qué es

Vista del tablero de cada bomba a partir de las señales eléctricas del PLC. Hay dos niveles:

- **Panel básico** (Balsas, `components/ElectricPanel.tsx`): por pozo, tensiones de fase y de línea, corrientes por fase, desbalance de corriente (desviación máxima respecto al promedio, en %; "—" con la bomba detenida) y estado de la bomba. Se acompaña de `MultiLineGraphCard` con las tres fases del día.
- **Panel completo** (Ranguil, `ranguil-electrico/` y la ruta `/ranguil/electrico`): alinea voltaje, corriente, caudal y presión en muestras de 5 min y calcula potencia aparente, kWh del día (contador del PLC × factor), costo, kWh/m³, factor de potencia implícito (solo con ≥ 90 % de muestras), desbalance P95, arranques y un puntaje de salud ponderado (tensión 25 %, balance 25 %, arranques 15 %, eficiencia 20 %, carga 15 %). Tarifa, factor de kWh, tensión nominal y corriente de placa se editan en un modal y se guardan en `localStorage`.

### 8.2 Cuándo usarla

Cuando el tablero reporta tensiones y corrientes. Ayuda a detectar desbalance, arranques excesivos y pérdida de eficiencia de la bomba (más kWh por m³). El panel completo vale la pena si además hay caudal y kWh confiables.

### 8.3 Requisitos

- Señales `L1N…L3N`, `L1L2…L3L1` (o `v1…v3`) e `I1…I3`, con su escala confirmada. En Balsas llegan ×100 (41452 = 414,52 V); en Ranguil la tensión llega ×10 y la corriente ×100. Valida la escala con la física: potencia eléctrica ≈ potencia hidráulica (caudal × presión) y corriente coherente con la placa del motor.
- Rutas `voltaje` y `corriente` (en la plantilla, `?pozo=...&tipo=linea|fase`), y `kwh` diario si se calcula energía.
- Para el estado "en marcha" sin señal de bomba: umbral de corriente (`UMBRAL_CORRIENTE_A = 1`), el mismo que usa el horómetro calculado (§7).

### 8.4 Archivos de referencia

| Archivo | Rol |
|---------|-----|
| `Balsas/api-balsas/src/config/sensores.config.ts` | Escalas y nombres públicos de las variables eléctricas por pozo (`variablePozo`) |
| `Balsas/front-balsas/src/components/ElectricPanel.tsx`, `MultiLineGraphCard.tsx` | Panel básico |
| `Ranguil/DashboardRanguilReact/src/electrico/lib/electrical.ts` | Cálculos del panel completo (`buildSamples`, `buildDailyRows`, `computeHealth`, `computeFindings`) |
| `Ranguil/DOCUMENTACION.md` §5.3–§5.4 | Fórmulas y constantes |

### 8.5 Errores conocidos

- **Escalas distintas por cliente**, incluso para la misma señal. Nunca copies el divisor de otro sitio.
- **Diagnósticos con datos viejos:** el panel de Ranguil no avisa si las muestras tienen horas de antigüedad (`Ranguil/POSIBLES_BUGS.md` #14). Muestra la hora del último dato junto al diagnóstico.
- **`ranguil-electrico/` es una copia** del panel que vive dentro de `DashboardRanguilReact/src/electrico/`. Los cambios hay que hacerlos en los dos o eliminar la copia.

---

## 9. F5 · Reporte DGA

### 9.1 Qué es

Un script Python por pozo que, una vez al día, toma el snapshot de la API, arma la medición subterránea (fecha y hora, totalizador entero, caudal y nivel freático con dos decimales) y la envía a la API de la DGA. Siempre guarda el resultado, con la respuesta de la DGA o la excepción, en la tabla `<cliente>_reports` mediante `POST /reports` de la propia API. El dashboard muestra el historial (`ReportsHistoryModal`).

| Cliente | Script | Hora | Puerto de la API |
|---------|--------|------|------------------|
| Auquinco | `Auquinco/auquincoReports.py` | 12:00 | 3025 |
| California | `California/californiaReports.py` (el más completo: divisores por `.env`, hora de la medición desde el sensor) | 21:00 | 3034 |
| Carracedo | `Carracedo/carracedoReports.py` | 21:00 | 3021 |
| Encinos | `Encinos/encinoReports.py` (**copia idéntica del de Carracedo**: ver §13) | 21:00 | 3039 |

### 9.2 Piezas

- **API:** módulo `reports` (`reports.controller.ts`, `reports.service.ts`, entidad `<cliente>_reports(id, freatico, caudal, totalizador, response jsonb, time)`).
  - `POST /reports` solo acepta peticiones desde `127.0.0.1`/`::1` **y** con el encabezado `x-api-password` igual a `REPORTS_API_PASSWORD`. Por eso el script lo llama en `http://127.0.0.1:<API_PORT>/reports` y no por la URL pública.
  - `GET /reports?start&end` es público y alimenta el historial.
- **Script:** `schedule.every().day.at("HH:MM")`, log en `dga_reporte.log` junto al script. `.env` con `INTERNAL_API_URL`, `API_PORT`, `REPORTS_API_PASSWORD`, `DGA_API_URL`, `DGA_CODIGO_OBRA`, `DGA_RUT_EMPRESA`, `DGA_RUT_USUARIO` y `DGA_PASSWORD`. Encabezados de la DGA: `codigoObra` y `timeStampOrigen` (ISO con zona de Chile). Documento de la API de la DGA: `Transmision_mee_superficiales_flujometro_nueva-API.pdf` en la raíz (también en `DGA/`).
- **Recuperación:** `reporteMasivo.py` reenvía mediciones desde un CSV (`<cliente>_niv_tot_caud_2026.csv`) saltando las que ya están en `/reports`; `corregir_fechas.py` corrige fechas de registros ya guardados.

### 9.3 Pasos para un pozo nuevo

1. Copia `California/californiaReports.py` (no el de Carracedo) y cambia **la ruta del snapshot**, los nombres de las variables y los divisores. Después aplica la regla 9 de §3: busca el nombre del cliente de origen.
2. Copia el módulo `reports` de `California/api-california/src/reports/` y regístralo en `app.module.ts`. Crea la tabla y define `REPORTS_API_PASSWORD` en el `.env` de la API.
3. Prueba primero sin enviar a la DGA: comenta el `requests.post` o apunta `DGA_API_URL` a un servidor local, y revisa el payload en el log.
4. Agrega `ReportsHistoryModal` al dashboard.

### 9.4 Errores conocidos

- **Hora de la medición:** el sensor del freático se actualiza poco y su `time` puede estar en UTC; usarlo produjo fechas futuras y registros duplicados en la DGA (Auquinco usa ahora la hora actual de Chile). Decide con el cliente qué hora se informa.
- **Divisores:** freático en cm o dm, totalizador en décimas, caudal ×100. Cada script los tiene distintos y algunos fijos en el código. Si el snapshot ya entrega unidades de ingeniería (plantilla §10), los divisores son 1.
- **Un envío fallido no se reintenta:** queda en `<cliente>_reports` con la excepción. Revisa el historial y usa `reporteMasivo.py` para recuperar.

---

## 10. Plantilla actual para un cliente SSR

La implementación más moderna es **SSR Las Balsas** (`Balsas/`, noviembre 2026), con `Balsas/DOCUMENTACION.md` como ejemplo del documento por cliente. Tambo, Cuevas y Cumpeo comparten parte de sus ideas. Para un cliente nuevo, copia Balsas y adapta; para modernizar uno antiguo, aplica estas piezas una a una.

### 10.1 Estructura

```
<Cliente>/
  api-<cliente>/           NestJS: config/ (database, sensores), metrics/, filters/, migrations/, env.example, ecosystem.config.js
  front-<cliente>/         React: <cliente>.ts (config y tipos), components/, components/scada/, pages/
  tankService.py           copia del monitor unificado (F3), con monitor_config.json
  provider<Cliente>.py     solo si la ingesta MQTT es nuestra (§10.4)
  env.example, requirements.txt
  DOCUMENTACION.md         señales, rutas, alarmas, despliegue y "por confirmar con el cliente"
```

### 10.2 API

| Pieza | Cómo es en la plantilla | Archivo |
|-------|-------------------------|---------|
| Sensores | Un único mapa `SENSORES: { nombrePúblico: { mtName, divisor } }`, más `EQUIPOS` (id, nombre visible, prefijo) y su inverso `NOMBRE_DE`. La API **siempre** entrega m, l/s, bar, V, A y m³ | `src/config/sensores.config.ts` |
| Consultas | SQL directo con `DataSource.query` y parámetros (`$1`…). Última lectura por sensor con `unnest($1::text[]) CROSS JOIN LATERAL (... ORDER BY mt_time_2 DESC LIMIT 1)`: un sondeo por índice en vez de `DISTINCT ON` sobre toda la tabla | `src/metrics/metrics.service.ts` |
| Zona horaria | Los filtros comparan `mt_time_2` (hora Chile sin zona) contra fechas locales: `mt_time_2 >= $2::DATE AND mt_time_2 < $3::DATE + 1`. La salida se convierte con `mt_time_2 AT TIME ZONE 'America/Santiago'` y se serializa con `toISOString()`. No depende de la zona de Node ni de la sesión de la BD | `TIME_SQL` en el servicio |
| Totales diarios | `generate_series` de días + dos sondeos `LATERAL` (primera y última lectura del día), `GREATEST(último − primero, 0)`. Sin tabla `*_daily_metrics`: con el índice es suficientemente rápido. Si usas la tabla, aplica la regla 12 de §3 | `totalDiario` |
| Tiempo de vaciado | Theil-Sen sobre 20 min (§7) | `calcularTiempoVaciado` |
| Umbrales | `NIVEL_ALERTA` y `NIVEL_MAXIMO` en el `.env` de la API, devueltos en el snapshot | `umbral()` |
| Último dato por equipo | `snapshot.equipos` y `GET /equipos` con la forma `{ snapshot: { "<Nombre> (<EQUIPO>)": { time } } }` que lee el monitor en modo sensor | `getEquipos` |
| Validación | `ValidationPipe({ transform: true })` global; `DateRangeDto` (`start`/`end` con `@Matches`, `limit` 1–5000), `PozoQueryDto` y `VoltajeQueryDto` con `@IsIn` | `src/main.ts`, `models/dto/date-range.dto.ts` |
| Errores | `HttpExceptionFilter` → `{ success: false, statusCode, message }`; `uncaughtException` se escribe en `fatal-crashes.log` y el proceso sale (pm2 lo levanta) | `src/filters/`, `src/main.ts` |
| Caché | `CacheModule` global de 60 s con `CacheInterceptor` en todas las rutas GET | `src/app.module.ts` |
| BD | TypeORM `forRootAsync` con `ConfigService`, `synchronize: false`, SSL sin verificar certificado (RDS), pool de 5, `statement_timeout` de 10 s | `src/config/database.config.ts` |
| Índice | `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_<cliente>_name_time ON ssr_<cliente> (mt_name, mt_time_2 DESC)`, a mano y fuera de una transacción | `migrations/add-performance-indexes.sql` |
| pm2 | `name: 'api-<cliente>'`, `script: 'dist/main.js'`, 2 instancias, `PORT` en `env` | `ecosystem.config.js` |

Zagal añade una variante útil para APIs con consultas pesadas y varios usuarios a la vez: `QueryCache` en memoria con TTL y *single-flight* (peticiones iguales simultáneas esperan la misma promesa y llega una sola consulta a la BD), y SQL compartido entre parcelas con los nombres de tabla como constantes del código (`Zagal/api-zagal-pg/src/common/`).

### 10.3 Dashboard

| Pieza | Cómo es en la plantilla | Archivo |
|-------|-------------------------|---------|
| Configuración | `API_BASE = import.meta.env.VITE_API_URL ?? "https://app.jteanalytics.cl/<cliente>"`, `apiUrl(path, params)` con `URL` y `searchParams`, tipos (`Metric`, `Snapshot`, `Datos`), constantes de frescura y formateadores, todo en un archivo | `src/<cliente>.ts` |
| Fecha | `todayInChile()` con `Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })`, recalculada en cada ciclo de refresco | `src/<cliente>.ts` |
| Carga | `Promise.allSettled` por recurso; refresco cada 60 s (los antiguos usan 120 s) | `src/pages/Home.tsx` |
| Caché de diarios | `fetchWithCache(endpoint, params, hoy)`: pide desde el último día cacheado, fusiona por fecha, no guarda el día en curso. Clave `jte_cache_<cliente>_<endpoint>_<params>`. Lectura del JSON con `try/catch` (Cumpeo) | `src/components/fetchWithcache.tsx` |
| Estado de comunicación | Por equipo: en línea (≤ 10 min), retrasado (≤ 30 min), sin datos (> 30 min, el umbral del monitor) | `estadoComunicacion` |
| SCADA | Componentes CSS de la skill (F2) en `components/` y `components/scada/scada.css` | — |
| Exportador | Hoy Balsas usa el exportador antiguo (`xlsx` + `file-saver`). Para uno nuevo, usa F1 (`exceljs`) | — |
| Desarrollo local | `VITE_API_URL=http://localhost:<puerto> npm run dev` y abrir `/<cliente>/` | — |

### 10.4 Ingesta MQTT (cuando es nuestra)

Referencia: `Tambo/providerTambo.py` v1.0.0 (equipo COPSET, topic `data/<SITIO>/COPSET/<id>`), con `Tambo/env.example` y `requirements.txt`. Comparado con los providers antiguos (`providerCumpeo.py`, `provideorCalifornia.py`, `mqttProviderCompania.py`, que acumulan 5 min o abren una conexión por mensaje):

- inserta apenas llega el dato (cada `FLUSH_SEGUNDOS` = 2), para que el `mt_time_2` que pone la BD sea la hora real de la lectura;
- conexión persistente con *keepalive* y reconexión al broker y a la BD;
- si la BD falla, las filas quedan en memoria (tope `MAX_PENDIENTES`) y al detenerse se escriben en `pendientes_<cliente>.jsonl`, que se recupera al iniciar;
- descarta reenvíos con el mismo `_terminalTime` y el mensaje retenido que el broker entrega al suscribirse: así **no reinserta datos viejos**, condición de F3 (§6.3);
- log rotativo `logs_provider.txt` (5 × 5 MB) y alertas opcionales al grupo admin (sin datos del equipo, BD caída);
- `--sin-bd` imprime lo que insertaría y `--probar-bd` prueba la conexión y la tabla.

Montes tiene un provider propio que guarda un valor por sensor cada 10 min (`Montes/providerMontes.py`). Bucalemu tiene el flujo inverso: `brokerAutomatizacion.py` lee el nivel de Casuto en la BD y lo publica en MQTT (`/DownloadTopic`, con `retain`) para automatizar un equipo en terreno.

### 10.5 Documento por cliente

Cada cliente nuevo o revisado lleva un `DOCUMENTACION.md` con: resumen y diagrama, tabla de señales (equipo, `mt_name`, nombre en la API, divisor, unidad y de dónde salió la escala), rutas, valores derivados, alarmas, despliegue y una tabla **"Por confirmar con el cliente"** con el valor provisorio y dónde se cambia. Ejemplos: `Balsas/DOCUMENTACION.md` (el más reciente), `Zuniga/DOCUMENTACION.md`, `Ranguil/DOCUMENTACION.md` + `POSIBLES_BUGS.md`. Montes y Undurraga usan `PLAN_MEJORAS.md`.

---

## 11. Apps de terreno y de negocio

No son de monitoreo, pero comparten stack (NestJS + TypeORM + PostgreSQL, React + Vite + Bootstrap) y conviene que nuevas apps sigan el mismo patrón.

### 11.1 Inventario

| App | Carpeta | Qué hace | Particularidades |
|-----|---------|----------|------------------|
| Conciliación bancaria | `ConciliacionBancaria/` | Importa cartolas (BancoEstado, Banco de Chile) y el RCV del SII, concilia movimientos con documentos, motor de sugerencias, boletas con foto, proyectos con balance e IVA | **Referencia para apps nuevas** (§11.2). Documentada en `api-conciliacion/README.md`, `PLAN_IMPLEMENTACION.md` y `GUIA_DE_USO.md` |
| Mantenimiento | `Mantenimiento/` | Informes de mantención con fotos, firma del técnico y del cliente, PDF | Datos variables en una columna `jsonb` (`data`): se agregaron los formularios preventivos sin migración (`RELEASENOTES.md`, 2026-06-01). `old/` es la versión MySQL anterior |
| Mediciones | `RanguilMediciones/`, `ZunigaMediciones/`, `DemoMediciones/` | Sesiones de medición en terreno con foto por medición; PDF por sesión y acumulado | Tres copias del mismo código con el nombre cambiado (Zuñiga agrega edición de sesiones). Un cambio se hace en las tres |
| Checklist de vehículos | `CheckListVehiculos/` | Inspecciones de flota con fotos, alertas de mantención y revisión técnica, PDF | React 18 y NestJS 10, navegación por hash sin router. Ver `DOCUMENTACION.md` y `REVISION_BUGS_Y_MEJORAS.md` |
| Cotizaciones | `Cotizaciones/`, `Maval/` | Cotizaciones con PDF | Dos copias del mismo código (JTE y Maval) |
| E-commerce Maval | `MavalECommerce/` | Catálogo, categorías, pedidos sin login con historial de estados | Única con refresh tokens rotativos, prefijo global `/api` e interceptor de respuesta. Plan en `plan_backend.md` |
| Reconocimiento de vehículos | `ReconocimientoVehiculos/` | Patentes con AWS Rekognition, personas y vehículos | — |

### 11.2 Convenciones (tomadas de Conciliación Bancaria)

- **Esquema por scripts SQL numerados** (`db/001_esquema.sql`, `002_…`) y entidades TypeORM ajustadas a mano; `synchronize: false`. Lógica que debe ser atómica (saldos, estados) en funciones SQL llamadas dentro de la misma transacción.
- **Auth:** JWT de 8 h, `bcrypt`, `JWT_SECRET` con `getOrThrow`, usuario admin inicial con un script (`npm run crear-admin`), roles por recurso (lector, operador, admin) además del admin global. El front guarda el token en `localStorage` y ante un 401 limpia la sesión.
- **CORS** limitado con `CORS_ORIGINS`.
- **Archivos subidos:** `memoryStorage` de multer, tipo validado por el contenido (no por la extensión), tope de tamaño, nombre `<uuid>.<ext>` en una carpeta configurable fuera del proyecto (`COMPROBANTES_DIR`); en la tabla solo el id y la ruta. Servirlos por una ruta autenticada, no como estáticos públicos (CheckList los expone en `/uploads` y acepta cualquier tipo: B3).
- **Fotos desde el celular:** se reducen en el navegador antes de subir (Conciliación: lado mayor de 2000 px en JPG). `PhotoCaptureModal` (Mantenimiento, Mediciones, CheckList) usa `getUserMedia`; hay que apagar la cámara al cerrar y avisar si se niega el permiso.
- **PDF en el navegador** con `@react-pdf/renderer` (Mantenimiento, Mediciones, CheckList, Cotizaciones). Generarlo al hacer clic, no al renderizar listas (CheckList B11).
- **`multipart/form-data`:** no fijes `Content-Type` a mano en axios, o el `FormData` se envía como JSON y las fotos se pierden (CheckList B1).
- **Montos en pesos** como `bigint` con un *transformer* a `number`. **RUT** validado con dígito verificador (`common/rut.ts`).
- **Tests** de la lógica pura (lectores de archivos, motor) con archivos sintéticos; los datos reales no van a git (`.gitignore` de la carpeta). Script `probar-lectores` para diagnosticar un archivo sin tocar la BD.

---

## 12. Inventario de clientes

Estado al 2026-11-18. "Puerto" es el de `ecosystem.config.js` o, si no tiene, el valor por defecto de `main.ts`. SCADA: **CSS** = componentes de la skill (F2); **sprites** = diagrama antiguo con PNG; — = no tiene. Monitor: estanques vigilados y modo de conexión (F3).

### 12.1 Monitoreo

| Cliente | API (puerto) | Tabla | Dashboard | SCADA | Monitor | Notas |
|---------|--------------|-------|-----------|-------|---------|-------|
| Amigos | `api-amigos-pg` (3010) | `ssr_amigos` | `amigosReact` | — | — | `api-amigos` es la versión MySQL anterior, mismo puerto |
| Araucarias | `api-araucarias` (3022) | `araucarias` | `dashboard-araucarias` | — | conexión (equipo) | Módulo `reports` sin script propio: `carracedoReports.py` de la carpeta apunta a Carracedo. Sin `ecosystem.config.js` |
| Aromos | `api-aromos` (3014) | `ssr_aromos` | `dashboard-aromos` | sprites | 1 estanque | — |
| Auquinco | `api-auquinco` (3025) | `ssr_auquinco` | `DashboardAuquinco` | sprites | 1 estanque | DGA 12:00 (F5); señales eléctricas y presión |
| Balsas | `api-balsas` (3042) | `ssr_balsas` | `front-balsas` | CSS | 1 estanque + conexión | **Plantilla §10**; F4 básico |
| Boldos | `api-boldos` (3013) | `ssr_boldos` | `DashboardBoldos` | sprites | 2 estanques + conexión (10 min) | Nivel de alarma desde el `.env` del monitor. Sin `ecosystem.config.js` |
| Bucalemu | `api-bucalemu-postgres` (3004) | `ssr_bucalemu` | `DashboardBucalemuNuevo` | sprites | 4 estanques | Rutas bajo `/metrics/`; `brokerAutomatizacion.py` publica el nivel de Casuto por MQTT |
| California | `api-california` (3034) | `ssr_california` | `front-california` | sprites | 2 estanques | DGA 21:00 (F5, script de referencia); `provideorCalifornia.py` |
| Carmen | `api-carmen` (3023) | `ssr_carmen_bajo` | `DashboardCarmenReact` | sprites | 2 estanques | Rutas `nivel_bajo`, `nivel_sentina`. `package.json` incluye `mysql2`, pero la conexión es PostgreSQL |
| Carracedo | `api-carracedo` (3021) | `carracedo` | `dashboard-carracedo` | — | — | DGA 21:00 (F5). Sin `ecosystem.config.js` |
| Cocalán | `api-cocalan` (3029) | `ssr_cocalan` | `front-cocalan` | sprites | 1 estanque | Lecturas repetidas ×10 (`DISTINCT ON`); `base: "/cocalan"` sin barra final |
| Compañía | `api-compania` (3028) | `ssr_compania` | `front-compania` | sprites | 1 estanque | Horómetro desde la señal `bomba`; `mqttProviderCompania.py` |
| Cuevas | `api-cuevas` (3032) | `ssr_cuevas` | `front-cuevas` | CSS | 2 estanques | Dos equipos (`SSR_CUEVAS`, `ESTANQUE_20M3`) con alias en `metrics/models/sensors.ts`; nivel de alarma desde el `.env` del monitor; señales eléctricas. Sin `ecosystem.config.js` |
| Cumpeo | `api-cumpeo` (3036) | `ssr_cumpeo` | `front-cumpeo` | CSS | 1 estanque | Resumen mensual, indicador de llegada de datos; `providerCumpeo.py`. Sin `ecosystem.config.js` |
| Encinos | `api-encinos` (3039) | `encinos` | `front-encinos` | — | — | DGA 21:00 (F5, con el bug de §13). Sin `ecosystem.config.js` |
| González | `api-gonzalez` (3012) | `ssr_gonzalez` | `gonzalez-dashboard` | sprites | 2 estanques | Sin `ecosystem.config.js` |
| Guindo, Llaveria | — | MySQL `apr_guindo_alto`, `apr_llaveria` | — | — | scripts propios con MySQL | Fuera del monitor unificado hasta tener API |
| Hornillas | `api-hornillas` (3031) | `ssr_hornillas` | `front-hornillas` | sprites | 2 estanques | Varios pozos, caudales y presiones con rutas numeradas |
| Idahue | `api-idahue` (3024) | `ssr_idahue` | `DashboardIdahueReact` | sprites | 2 estanques | Rutas por planta (`nivel_planta1`…) |
| Manzano | `api-manzano` (3033) | `ssr_manzano` | `front-manzano` | sprites | 1 estanque | — |
| Marchigüe | (usa la de Trinidad) | MySQL `apr_marchigue` | — | — | 1 estanque | El monitor lee `https://app.jteanalytics.cl/trinidad/nivel` |
| Miraflores | `api-miraflores-pg` (3011) | `pozo_miraflores` | `mirafloresReact` | — | — | `api-miraflores` es la versión MySQL anterior, mismo puerto |
| Montes | `api-montes` (3020) | `montes` | `dashboard-montes` | — | conexión (sensor) | Referencia F1 y §7; `providerMontes.py`; `PLAN_MEJORAS.md` |
| Nerquihue | `api-nerquihue-pg` (3006) | `ssr_nerquihue` | `DashboardNerquihueReact` | sprites | 1 estanque | Señales eléctricas. El nombre del paquete dice `mysql2`, pero conecta a PostgreSQL |
| Olivar Bajo | `api-olivar` (3006, nginx 3008) | `ssr_olivar_bajo_metrics` | (no está en el repo) | — | `services/MonitoreoEstanqueOlivarBajo.py` | Ingesta por `POST`. Puerto en conflicto (§13) |
| Puquillay | `api-puquillay` (3016) | `ssr_puquillay` | `front-puquillay` | sprites | 1 estanque | Sin `ecosystem.config.js` |
| Quillay | `api-quillay` (3007) | `ssr_quillay` | `quillayDashboard` | sprites | — | Señales eléctricas |
| Ranguil | `api-ranguil` (3009) | `ssr_ranguil` | `DashboardRanguilReact` (+ `ranguil-electrico`) | CSS | 2 estanques + conexión (equipo) | F4 completo; `DOCUMENTACION.md`, `POSIBLES_BUGS.md` |
| Tambo | `api-tambo` (3040) | `ssr_tambo` | `front-tambo` | CSS | 3 estanques + conexión | `providerTambo.py` (§10.4); totalizadores por pozo aún no llegan (`/totalizador` responde 503). Sin `ecosystem.config.js` |
| Trinidad | `api-trinidad` (3038; `main.ts` dice 3000) | `ssr_trinidad` + MySQL `apr_marchigue` | `front-trinidad` | sprites | — | Sirve también el nivel de Marchigüe |
| Undurraga | `api-undurraga` (3002) | `undurraga_metrics` | `dashboardUndurraga` | — | conexión (sensor) | Referencia F1 y §7; ingesta por `POST`; `PLAN_MEJORAS.md` |
| Villa Carmen | `api-villacarmen` (3030) | `ssr_villa_carmen` | `front-villacarmen` | sprites | 1 estanque | Sin `ecosystem.config.js` |
| Viveros | `api-viveros` (3005) | `viveros_tambo` | `viverosDashboard` | — | `services/monitorUnificado.py` y otros | VPD; `env-manager` edita umbrales del monitor en `C:\AutomatizationServices\Viveros\env.txt`; reporte semanal |
| Zagal | `api-zagal-pg` (3003) | `parc_18_zagal`, `parc_57_zagal`, `parc_82_zagal` | `Zagal/18`, `57`, `82` (mismo código, cambia `config.ts`) | — (mapa Leaflet + KML) | — | Riego por sectores con triggers (`sql/002_triggers_riego.sql`); `QueryCache`; `ApiZagal` es la versión MySQL anterior |
| Zuñiga | `api-zuniga` (3000) | `ssr_zuniga` | `DashboardZunigaReact` | CSS (referencia de la skill) | 1 estanque | `healthCheckService.py`; `DOCUMENTACION.md` |

### 12.2 Apps de negocio

| App | API (puerto) | Front (`base`) |
|-----|--------------|----------------|
| Mantenimiento | `api-mantenimiento` (3015) | `/mantenimiento/` |
| RanguilMediciones | `api-ranguilmediciones` (3017) | `/ranguil-mediciones/` |
| DemoMediciones | `api-demomediciones` (`main.ts` 3018; `ecosystem` 3017) | `/demo-mediciones/` |
| Cotizaciones | `api-cotizaciones` (3019) | `/cotizaciones/` |
| Maval | `api-maval` (3026) | `/maval-cotizaciones/` |
| ZunigaMediciones | `api-zunigamediciones` (`main.ts` 3027; `ecosystem` 3017) | `/zuniga-mediciones/` |
| CheckListVehiculos | `api-checklist-vehiculos` (3037) | `/checklist-vehiculos/` |
| ConciliacionBancaria | `api-conciliacion` (3041) | relativa (`./`) |
| ReconocimientoVehiculos | `api-reconocimiento` (3000) | `/reconocimiento/` |
| MavalECommerce | `api-maval-ecommerce` (3000, prefijo `/api`) | sin front en el repo |

Siguiente puerto libre: **3043**.

---

## 13. Hallazgos pendientes (revisión del 2026-11-18)

Encontrados al revisar el repo; **ninguno está corregido**. Se basan en el código del repo: confirma en el servidor antes de actuar, porque la copia desplegada puede ser distinta.

### 13.1 Alta

1. **El reporte DGA de Encinos envía datos de Carracedo.** `Encinos/encinoReports.py` es idéntico a `Carracedo/carracedoReports.py`: lee `/carracedo/snapshot` y lo envía con el `DGA_CODIGO_OBRA` del `.env` de Encinos (el respaldo sí va a la API de Encinos, por `API_PORT=3039`). Si así está en el servidor, la DGA tiene mediciones de Carracedo informadas como de Encinos. Corregir la ruta y revisar el historial de `encinos_reports`.
2. **Cocalán pide sus totales diarios a la API de Auquinco.** `Cocalan/front-cocalan/src/components/fetchWithcache.tsx` arma `https://app.jteanalytics.cl/auquinco/<endpoint>` y `Home.tsx` le pasa `cocalan/horometro` y `cocalan/totalizador`. La URL resultante (`/auquinco/cocalan/horometro`) no corresponde a ninguna ruta de la API de Auquinco, así que esos gráficos probablemente están vacíos.
3. **Exportadores que consultan la API de otro cliente** (`components/ExportToExcel.tsx`): Bucalemu → `nerquihue`, California → `ranguil`, Quillay → `ranguil`, Cuevas → `zuniga` y Manzano → `zuniga` (estos dos además con `fechaInicio`/`fechaFin`, que ninguna API lee: es el error que se corrigió en Zuñiga). El Excel descargado trae datos de otro sitio o falla.
4. **Claves de caché compartidas entre dashboards.** Araucarias, Amigos, Aromos, Boldos, Cocalán, Quillay, Ranguil y Zuñiga usan `jte_cache_<endpoint>` sin el cliente. Quien abra dos de esos dashboards en el mismo navegador ve en el segundo los totalizadores y horómetros cacheados del primero (regla 10 de §3).
5. **Puertos en conflicto:**
   - Olivar Bajo escucha en 3006, igual que Nerquihue, y el nginx lo espera en 3008;
   - `DemoMediciones/api-demomediciones/ecosystem.config.js` usa el puerto 3017 y el nombre pm2 `api-ranguilmediciones`, los mismos de RanguilMediciones: arrancarla con ese archivo reemplaza o choca con la otra;
   - `ZunigaMediciones/api-zunigamediciones/ecosystem.config.js` también usa 3017 (su `main.ts` dice 3027);
   - ReconocimientoVehiculos y MavalECommerce usan 3000, el de Zuñiga.
6. **Secretos con valor por defecto:** Mantenimiento, las tres Mediciones, Cotizaciones y Maval firman los JWT con `'secreto_super_seguro'` si falta `JWT_SECRET`; ReconocimientoVehiculos con `'secretKey'`; Viveros y MavalECommerce con `'defaultSecret'`. CheckListVehiculos tiene `synchronize: true` en producción y devuelve `password_hash` en `GET /checklists` (B2).

### 13.2 Media

7. **Días y horas en UTC** en los SSR antiguos: la mayoría arma rangos con `T00:00:00Z` y `toISOString()` (Zuñiga, hallazgo 3; Ranguil, #7–#8); Compañía agrupa el horómetro con `AT TIME ZONE 'UTC'`. Entre las 21:00 y las 24:00 el "hoy" de la API no coincide con el del cliente. La corrección es la de §10.2.
8. **Sin `ValidationPipe`** en casi todas las APIs SSR (entre ellas solo lo tienen Balsas, Bucalemu, Cuevas, Montes y Undurraga): fechas inválidas dan 500 (regla 13 de §3).
9. **Once APIs sin `ecosystem.config.js`** (Araucarias, Boldos, Carracedo, Cuevas, Cumpeo, Encinos, González, Maval, Puquillay, Tambo, Villa Carmen): el puerto y el nombre en pm2 dependen de cómo se lanzaron a mano.
10. **`Montes/nginx.conf` desactualizado** (llega a 3020). Conviene versionar el nginx real del servidor o, al menos, mantener §12 al día.
11. **Exportador antiguo** (`xlsx@0.18.5` + `file-saver`) en todos los dashboards salvo Montes y Undurraga: librería abandonada y fechas en UTC. Migrar con F1 cuando se toque cada cliente.
12. **Cumpeo tiene cambios sin commit** (API, SCADA, resumen mensual): confirmar que lo desplegado coincide con el repo.

### 13.3 Baja

13. Worktree huérfano en `Balsas/.claude/worktrees/cool-satoshi-0d05c2` (rama `claude/cool-satoshi-0d05c2`, copia completa del repo). Eliminarlo con `git worktree remove` si ya no se usa: duplica resultados en cualquier búsqueda.
14. `.zip` de las APIs versionados en git (29 archivos `api-<cliente>.zip` en 28 carpetas) y archivos sueltos (capturas, `logs_*.txt`, `test_*.js`, copias `monitorTemperatura copy.py`).
15. `LoginModal` apunta a `undurraga/auth/login` y `viveros/auth/register` (Amigos, Araucarias, Carracedo, Encinos, Miraflores), pero no se importa en ninguna parte y Undurraga ya no tiene autenticación. Eliminarlo.
16. En `.gitignore` de la raíz, la línea `package-lock.json  # Si usas npm…` no ignora nada (git no admite comentarios al final de una línea) y los lock están versionados, que es lo correcto (regla 6 de §3). Conviene borrar la línea para que no confunda.
