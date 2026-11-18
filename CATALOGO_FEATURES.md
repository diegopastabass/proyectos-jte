# Catálogo de features para dashboards de monitoreo

Versión: 2026-11-18 · Referencias: Viña Montes (`Montes/`) y Undurraga (`Undurraga/`).

Este documento describe features ya implementadas y probadas que se pueden llevar a otros clientes. Está escrito para que una persona o un LLM pueda:

1. entender el contexto de la plataforma sin leer todo el repo (§1);
2. elegir qué features aplicar a un cliente (§2);
3. implementar cada feature siguiendo su ficha (§4–§6), que es autocontenida.

---

## 0. Cómo usar este documento (instrucciones para un LLM)

- **Lee §1 y §3 siempre.** Son el contexto y las reglas que aplican a cualquier feature.
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

JTE Analytics monitorea instalaciones de agua de clientes (APR, viñas, agrícolas): pozos, bombas, estanques, caudalímetros y totalizadores. Cada cliente tiene su propia carpeta en este repo, con una API y un dashboard web, y en algunos casos servicios Python (ingesta y alertas).

### 1.2 Estructura típica de un cliente

| Pieza | Ubicación habitual | Stack |
|-------|--------------------|-------|
| API | `<Cliente>/api-<cliente>/` | NestJS 11 + TypeORM + PostgreSQL (algunos MySQL) |
| Dashboard | `<Cliente>/front-<cliente>/`, `<Cliente>/Dashboard<Cliente>React/` o `<Cliente>/dashboard-<cliente>/` | React 19 + Vite + TypeScript + Bootstrap 5 + bootstrap-icons + Chart.js (`react-chartjs-2`) |
| Ingesta | Script Python con MQTT → BD (p. ej. `Montes/providerMontes.py`), o un equipo en terreno que hace `POST` a la API (Undurraga) | Python 3, `paho-mqtt`, `psycopg2` |
| Alertas | `<Cliente>/<script>.py` + `monitor_config.json` (monitor unificado, F3) | Python 3, `requests`, `python-dotenv` |

Publicación: `https://app.jteanalytics.cl/<cliente>/`. Un nginx en Windows enruta `/<cliente>/` al puerto de la API (copia de referencia en `Montes/nginx.conf`) y el dashboard se compila con `base: "/<cliente>/"` en `vite.config.ts`. Las APIs corren con pm2 (`ecosystem.config.js`).

### 1.3 Datos

- Las tablas guardan lecturas crudas `(sensor, valor, hora)`. El nombre de la tabla, de las columnas y el tipo cambian por cliente: `montes(name, value varchar, time timestamp)`, `undurraga_metrics(sensor_id int, value numeric, time timestamptz)`, `ssr_<cliente>(mt_name, mt_value, mt_time_2)`, etc.
- Tipos de sensor habituales: **caudal** (m³/h o L/s, instantáneo), **totalizador** (m³ acumulados; algunos se reinician cada día), **nivel** (m o %, a veces en cm), **presión**, **horómetro**, **bomba on/off**.
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

---

## 2. Tabla de decisión

| Feature | Aporta | Requiere | Esfuerzo | Ficha |
|---------|--------|----------|----------|-------|
| **F1 Exportador a Excel** | Descarga de un libro `.xlsx` con resumen diario, consumo por hora y lecturas de caudal; atajos de rango; una hoja por serie | Rutas de §1.4 (al menos `totalizador` y `caudal` con `start`/`end`), o adaptar las que tenga el cliente | 2–4 h si la API ya tiene las rutas | §4 |
| **F2 Diagrama SCADA** | Esquema animado del proceso (pozo, bomba, tuberías, estanques, instrumentos) con el estado en vivo | Endpoint de snapshot con las señales del proceso; inventario de equipos y unidades confirmado | 0,5–1,5 días | §5 |
| **F3 Monitor de desconexión** | Aviso por WhatsApp al grupo admin cuando un equipo deja de reportar, aviso de recuperación, recordatorio cada 24 h, alerta si la API falla; opcional: nivel crítico y rebalse de estanques | Endpoint con la hora del último dato (snapshot o serie con `?limit=`); que la ingesta **no** reinserte datos viejos | 1–2 h (solo configuración) | §6 |
| Otras (selector de día, tarjetas de consumo, caché diaria, consumo por hora, aviso "sin datos") | Ver §7 | Ver §7 | — | §7 |

Combinaciones habituales:

- **Cliente nuevo con estanques:** F3 (con estanques) + F2 + F1.
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
| Balsas | `Balsas/front-balsas/src/components/ScadaDiagram.tsx` | — |
| Cuevas | `Cuevas/front-cuevas/src/components/ScadaDiagram.tsx` | — |
| Tambo | `Tambo/front-tambo/src/components/ScadaDiagram.tsx` | Varios estanques |
| Zuñiga | `Zuniga/DashboardZunigaReact/src/components/ScadaDiagram.tsx` | Referencia de la skill |

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
