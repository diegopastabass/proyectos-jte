# Plan de actualización: Viveros El Tambo

Fecha de análisis: 2026-11-18

Alcance: `api-viveros` (NestJS, puerto 3005, tabla `viveros_tambo`), `viverosDashboard` (React + Vite + Chart.js, publicado en `https://jteanalytics.cl/viveros/`) y `services/` (ingesta MQTT y monitores de alarma por WhatsApp).

Objetivo de la actualización: que el cliente entienda **de un vistazo** si sus cámaras están dentro de rango, cómo han evolucionado y cuánto tiempo estuvieron fuera de rango. Hoy el dashboard muestra números sueltos y gráficos que no permiten responder ninguna de esas tres preguntas.

Sensores (`sensor_id`):

| ID | Señal | Origen | Cadencia real |
|----|-------|--------|---------------|
| 1, 2 | Estado cámara de calor / frío (0/1) | PLC | **sin datos desde 2026-07-31** |
| 3, 5 | Humedad / temperatura cámara de calor | MQTT `/CAMARA_VET` (`HR_CALOR`, `T_CALOR`, ÷10) | 2 min |
| 4, 6 | Humedad / temperatura cámara de frío | MQTT (`HR_FRIO`, `T_FRIO`, 4–20 mA escalado) | 2 min |
| 7, 8 | Temperatura / humedad "Ambiente" | **Open-Meteo** (pronóstico en `LAT`/`LNG`), no un sensor del vivero | 5 min |

La ingesta real es [brokerViverosTempHumedad.py](services/brokerViverosTempHumedad.py), que escribe directo en la BD. El `POST /` de la API sigue existiendo (ver A4).

---

## 0. Lo que muestran los datos (API pública, semana 2026-11-11 → 2026-11-18)

| Verificación | Resultado | Consecuencia |
|--------------|-----------|--------------|
| Frescura de `/latest` (14:43 hora Chile) | Cámaras a 8 min, ambiente a 1 min; sensores 1 y 2 con último dato el **2026-07-31** | El LED "Estado de Cámara" muestra un dato de hace 3,5 meses sin avisarlo (B2) |
| HR cámara de calor (sensor 3) | **2.762 lecturas, un solo valor: 99,9 %** | Sensor saturado o dañado. El VPD de calor es 0 toda la semana y el dashboard dice "Baja transpiración" sin parar (S3) |
| HR cámara de frío (sensor 4) | 88,1–89,2 %, solo 12 valores distintos | Plausible para una cámara húmeda, pero confirmar que el sensor responde |
| T cámara de calor (sensor 5) | 17,7–23,2 °C | El monitor tiene rango 22–30 °C por defecto: estuvo bajo el mínimo buena parte de la semana (S1) |
| T cámara de frío (sensor 6) | 4,1–14,2 °C | El `.env` del monitor tiene **0–5 °C** (el 5–30 era el valor por defecto del código): estuvo sobre el máximo casi toda la semana y el monitor avisó cada 10 min (S1) |
| Huecos | Un corte de **4 h 48 min** en las cámaras; ninguno en ambiente | El monitor actual no detecta desconexiones (S2) |
| Formato de `value` | Llega como texto (`"1.00"`, `"24.60"`) | Rompe el LED (B2) y deja decimales distintos en la misma tarjeta (B6) |
| Validación | `GET /min-max?date=abc` → **500** | Falta validación de entrada (A2) |

---

## 1. Fortalezas (lo que conviene conservar)

- **Datos en vivo y estables:** las cámaras reportan cada 2 min sin repetir lecturas; la hora del último dato es real (no se reinserta el último valor), así que el monitor de desconexión F3 se puede instalar sin tocar la ingesta.
- **VPD ya calculado** en la API (`/latest`) y con gráfico en el dashboard: es la métrica agronómica que diferencia este dashboard de uno de temperatura genérico.
- **Informe semanal en PDF** ya implementado en la API ([reports.service.ts](api-viveros/src/metrics/services/reports.service.ts)) con min/máx/promedio, tiempo fuera de rango y alertas.
- **Monitor unificado** con alarmas configurables, interruptores por alarma y umbrales que se releen en caliente ([monitorUnificado.py](services/monitorUnificado.py)).
- **`ValidationPipe` global** y un filtro de excepciones ya puestos en [main.ts](api-viveros/src/main.ts).
- **Base visual limpia** (Bootstrap, logo del cliente, diseño responsivo de una columna que funciona en el celular).

---

## 2. Fallas encontradas

### 2.1 Dashboard

| # | Falla | Dónde | Efecto para el cliente |
|---|-------|-------|------------------------|
| **B1** | **El indicador de última actualización está roto.** `Object.values(metricsData)` incluye `vpd_calor`, `vpd_frio` y `vpd_ambiente` (números sin `time`), `Math.max` da `NaN` y `toISOString()` lanza `RangeError`. El error lo traga el `catch` y `lastUpdate` nunca se fija. Verificado en producción: la pastilla dice "Desconocida" en blanco sobre fondo claro (no se ve) | [Home.tsx:119-122](viverosDashboard/src/pages/Home.tsx:119) | El cliente no sabe si los datos están al día. Se rompió al agregar el VPD |
| **B2** | **El LED de estado de cámara siempre está rojo.** `value` llega como `"1.00"` y se compara con `status === 1`. Además los sensores 1 y 2 no reportan desde el 2026-07-31 | [StatusLed.tsx:15](viverosDashboard/src/components/StatusLed.tsx:15) | Las dos cámaras aparecen "apagadas" o en falla de forma permanente |
| **B3** | **Eje Y desde cero** (`beginAtZero: true`): una temperatura que va de 18 a 23 °C se ve como una línea plana arriba del gráfico | [DropDownCard.tsx:94](viverosDashboard/src/components/DropDownCard.tsx:94) | Los gráficos no muestran ninguna variación |
| **B4** | **VPD emparejado por posición** (`temp[i]` con `hum[i]`), no por hora. Si se omite una lectura no numérica (el broker descarta `T_FRIO = "AI2"`), las series se desfasan y el VPD mezcla momentos distintos. El informe semanal hace lo mismo | [VpdChart.tsx:63](viverosDashboard/src/components/VpdChart.tsx:63), [reports.service.ts:141](api-viveros/src/metrics/services/reports.service.ts:141) | VPD erróneo después de cualquier lectura perdida |
| **B5** | **Exportador con día UTC** (`toISOString().split("T")[0]`): entre las 21:00 y las 23:59 propone el día siguiente. Usa `xlsx@0.18.5` (abandonada) y entrega una sola hoja larga con `sensor_name` | [ExportarHistorial.tsx:6](viverosDashboard/src/components/ExportarHistorial.tsx:6) | Excel vacío de noche y difícil de leer |
| **B6** | **Formato numérico mezclado:** "24.60°C" (texto de la API) junto a "12°C" (`Number`), punto decimal en vez de coma | [Home.tsx](viverosDashboard/src/pages/Home.tsx) | Aspecto descuidado |
| **B7** | **"Ambiente" es Open-Meteo**, un modelo meteorológico para las coordenadas del vivero, pero se presenta como si fuera una medición propia | [Home.tsx](viverosDashboard/src/pages/Home.tsx), [brokerViverosTempHumedad.py](services/brokerViverosTempHumedad.py) | El cliente puede tomar decisiones con un dato que no es de su vivero |
| **B8** | **El informe semanal no tiene botón**: `GET /reports/weekly` existe, pero el dashboard no lo enlaza | — | Una funcionalidad ya pagada que el cliente no ve |
| B9 | Los gráficos muestran "las últimas 100 lecturas" (≈ 3–6 h según los huecos), con etiquetas `HH:MM` sin fecha, rotadas y sin opción de cambiar el periodo | [metrics.service.ts](api-viveros/src/metrics/services/metrics.service.ts) `findChartData` | No se puede ver el día completo ni la semana |

### 2.2 API

| # | Falla | Dónde | Riesgo |
|---|-------|-------|--------|
| **A1** | **Seguridad:** `/users/find/:id` y `/users/email/:email` tienen `@Roles('0')`, pero no `@UseGuards`, así que **son públicos**. `/auth/register` está abierto y el `LoginModal` deja registrarse a cualquiera. El JWT se firma con `'defaultSecret'` si falta la variable y CORS acepta `*` | [users.controller.ts](api-viveros/src/users/users.controller.ts), [auth.controller.ts:9](api-viveros/src/auth/auth.controller.ts:9), [auth.module.ts:14](api-viveros/src/auth/auth.module.ts:14), [main.ts:11](api-viveros/src/main.ts:11) | Cualquiera puede consultar usuarios por correo y crear cuentas (regla 16 de §3) |
| **A2** | Sin DTO en `summary`, `data` y `min-max`: fechas inválidas dan 500 | [metric.controller.ts](api-viveros/src/metrics/controllers/metric.controller.ts) | Errores opacos (regla 13) |
| **A3** | Los rangos de día se arman con `new Date("AAAA-MM-DDT00:00:00")`, que usa la zona del proceso Node, sobre una columna `timestamp` sin zona. Hoy las horas salen bien, pero depende de la configuración del servidor | `getMinMax`, `findMetricsBySensorsAndDateRange`, `getViverosDataForExcel` | Si el proceso corre en UTC, el "hoy" del min/máx se corre 3 h (regla 4). Fijar `TZ=America/Santiago` en `ecosystem.config.js` y verificar la zona de la BD |
| A4 | **`POST /` con buffer en memoria y pm2 `instances: 2`:** cada instancia tiene su propio buffer, la hora guardada es la del *flush* (`CreateDateColumn`), no la de llegada, y un reinicio pierde hasta 2 min de datos (`onModuleDestroy` no espera el `flush`) | [metrics.service.ts](api-viveros/src/metrics/services/metrics.service.ts), [ecosystem.config.js:6](api-viveros/ecosystem.config.js:6) | Solo si algún equipo sigue usando el `POST`. Confirmarlo; si se usa, mejorar lo interno sin tocar el contrato (regla 1) |
| **A5** | **El panel de administración edita umbrales que el monitor activo no lee.** `env-manager` escribe `TEMP_MONITOREO`, `HUM_MONITOREO`, `TEMP_AMB` en `C:\AutomatizationServices\Viveros\env.txt`; `monitorUnificado.py` lee `.env` con `TEMP_CAM_FRIO_INF/SUP`, `TEMP_CAM_CALOR_INF/SUP`, `HUM_CAM_CALOR`, `HUM_AMB`… Solo los monitores antiguos leen `env.txt` | [env-manager.service.ts:6](api-viveros/src/env-manager/env-manager.service.ts:6) | El administrador cambia un umbral, ve "Variables actualizadas correctamente" y las alarmas siguen igual. Confirmar qué monitor corre en el servidor |

### 2.3 Servicios

| # | Falla | Dónde | Efecto |
|---|-------|-------|--------|
| **S1** | **Alerta repetida en cada ciclo, sin estado:** mientras la condición dure, envía el mismo WhatsApp cada `MONITOR_INTERVAL` (600 s), y nunca avisa la recuperación. Con la T de calor bajo 22 °C buena parte de la semana, son decenas de mensajes por día | [monitorUnificado.py:370](services/monitorUnificado.py:370) | Fatiga de alertas: el cliente silencia el grupo y deja de ver las alertas importantes |
| **S2** | **No detecta desconexión:** evalúa el último valor aunque tenga horas. El corte de 4 h 48 min de esta semana y los sensores 1 y 2 caídos desde julio no generaron ningún aviso | `ejecutar_monitoreo` | Una cámara puede quedar sin vigilancia sin que nadie lo sepa |
| **S3** | **HR de calor clavada en 99,9 %** toda la semana | Sensor en terreno | Datos inútiles para la cámara de calor; la alarma "humedad < 80 %" nunca puede saltar |
| S4 | **Temperaturas bajo 0 °C leídas como 6553,x.** La serie de frío baja 0,2 → 0,1 → 0,0 → 6553,5: es un entero con signo ×10 leído sin signo (6553,5 = −0,1 °C; 6553,1 = −0,5 °C). El broker del repo aplica `(x − 4000) × 0,00625` a `T_FRIO`, que no puede producir esos valores: **el broker del servidor no coincide con el del repo** | [brokerViverosTempHumedad.py:29-31](services/brokerViverosTempHumedad.py:29) | Gráficos con picos de 6553 °C, mínimos falsos y alertas de "6553 °C". Corregido al leer (API y monitor); falta revisar el broker desplegado (ver §9) |

---

## 3. Riesgos (sin falla visible todavía)

- **Rangos de VPD iguales para las tres zonas (0,8–1,2 kPa).** En una cámara de frío (conservación o aclimatación) un VPD bajo es lo buscado; hoy el dashboard la marca en azul como "Baja transpiración" de forma permanente. Los rangos deben ser por zona y confirmados con el cliente, o el VPD debe ocultarse donde no aplique.
- **Umbrales en tres lugares** que no coinciden: VPD fijo en el dashboard y en el informe, umbrales del monitor en `.env` y los del panel de administración en `env.txt` (regla 14 de §3). El gráfico no puede dibujar el rango permitido porque no lo conoce.
- **Dependencia de Open-Meteo** para la zona "Ambiente": si el servicio cambia de formato o limita las consultas, la zona queda vacía sin aviso.
- **Credenciales en la carpeta del front:** `viverosDashboard/.env` tiene datos de la BD y `JWT_SECRET`. Git las ignora y Vite no las publica (no tienen prefijo `VITE_`), pero no deberían estar ahí: se copian con la carpeta.
- **Monitores duplicados** en `services/` (`monitorTemperatura.py`, `monitorHumedad.py`, `monitorTemperaturaAmbiental.py`, `monitorTemperatura copy.py`, `monitorUnificado.py`). Si en el servidor corren varios a la vez, el cliente recibe alertas duplicadas con umbrales distintos.
- **pm2 con 2 instancias** sin necesidad: duplica el buffer del `POST` (A4) y cualquier tarea periódica que se agregue a la API.

---

## 4. Propuesta visual (prioridad del cliente)

### 4.1 Principios

1. **Primero el estado, después el detalle.** Lo primero que se ve responde "¿está todo bien?": color y texto por zona, no números que haya que comparar mentalmente con un umbral.
2. **Siempre con contexto.** Cada valor se muestra junto a su rango permitido y a lo que pasó hoy; cada gráfico, con la banda de rango sombreada.
3. **Colores con un solo significado.** Hoy el rojo es a la vez "cámara de calor", "estrés hídrico" y "LED apagado". Propuesta:
   - **estado:** verde = en rango, ámbar = cerca del límite, rojo = fuera de rango, gris = sin datos;
   - **zona** (solo en líneas y encabezados, nunca para estado): frío = azul, calor = naranja, exterior = gris verdoso.
4. **Un formato numérico:** coma decimal (`es-CL`), 1 decimal para °C y %, 2 para kPa, unidad con espacio (`9,2 °C`).
5. **Fechas siempre en hora de Chile** y con día cuando el periodo cruza la medianoche.

### 4.2 Barra de estado general (nueva, arriba)

Una pastilla por zona: **Frío ✓ En rango · hace 2 min**, **Calor ⚠ Bajo el mínimo desde 09:40**, **Exterior · Open-Meteo**. Reemplaza el indicador roto (B1) con la hora del último dato **por zona**, con los umbrales de frescura de Montes (`EstadoDato.tsx` y `lib/frescura.ts`: verde ≤ 10 min, ámbar ≤ 30 min, rojo > 30 min). Si un sensor deja de reportar, el cliente lo ve aquí antes de leer cualquier número.

### 4.3 Tarjeta de zona rediseñada

```
┌ Cámara de Frío ─────────────────────────── ● hace 2 min ┐
│  Temperatura                    Humedad                 │
│  9,2 °C   ✓ en rango            88,9 %   ✓ en rango     │
│  ├──░░░░[▓▓▓▓▓▓▓▓●▓▓]░░──┤      ├────────[▓▓●]──┤       │
│   4,1 mín hoy     14,2 máx       88,1        89,2       │
│  ╱╲_╱‾╲__╱╲ (24 h)              ‾‾‾‾‾‾‾‾‾‾ (24 h)       │
│  Fuera de rango hoy: 0 min · VPD 0,13 kPa               │
│  Equipo de frío: sin datos desde 31-07-2026             │
└─────────────────────────────────────────────────────────┘
```

- **Valor actual grande**, coloreado por estado, con texto ("en rango", "bajo el mínimo") para quien no distingue colores.
- **Barra de rango** (*bullet chart*): rango permitido sombreado, mínimo y máximo de hoy como extremos, marcador del valor actual. Se entiende sin leer números.
- **Sparkline de 24 h** debajo de cada valor.
- **"Fuera de rango hoy: X h Y min"**, calculado en la API con la duración real entre lecturas.
- **Estado del equipo** (sensores 1 y 2) en gris con la fecha del último dato mientras no vuelvan a reportar; se corrige B2.
- En escritorio, **tres tarjetas lado a lado** (hoy una sola columna al 50 % del ancho deja media pantalla vacía); en el celular, una columna como ahora.

### 4.4 Gráficos

Un gráfico por zona en lugar de tres tarjetas separadas:

- **Temperatura (eje izquierdo) y humedad (eje derecho) juntas**, con la banda de rango permitido sombreada para cada una.
- **Eje de tiempo real** (`type: "time"` con `chartjs-adapter-date-fns`) y `spanGaps: false`: el corte de 4 h 48 min se ve como un hueco y no como una recta.
- **Eje Y ajustado a los datos** (B3), con un margen.
- **Selector de periodo:** Hoy · 24 h · 7 días · día específico (◀ fecha ▶, `DaySelector.tsx` de Montes). Para 7 días (~5.000 puntos por serie) se activa la diezmación de Chart.js.
- **Tooltip** con fecha, hora, T, HR y VPD del mismo instante.
- Sin leyenda redundante ni etiquetas rotadas.

### 4.5 VPD bien presentado

- **Calculado en la API emparejando por hora** (B4), no en el navegador.
- **Bandas de fondo** azul / verde / rojo en vez de dos líneas punteadas: se ve de inmediato en qué zona estuvo la curva.
- **Rangos por zona** y desde la configuración (§4.8); oculto en la cámara de frío si el cliente confirma que no aplica.
- *Opcional, alto valor agronómico:* gráfico T vs HR (puntos de las últimas 24 h) sobre el mapa de VPD, con la zona óptima marcada.

### 4.6 Cumplimiento (vista nueva)

- **Barras por día (7 o 30 días): % del tiempo en rango** por zona, apiladas en verde / ámbar / rojo / gris (sin datos). Es el indicador que el cliente puede mostrar a su propio cliente o a una auditoría.
- **Mapa de calor día × hora** de la temperatura de cada cámara: deja ver patrones (por ejemplo, la cámara de calor que baja todas las madrugadas).
- **Episodios fuera de rango:** tabla con inicio, fin, duración, valor extremo y zona, en lugar de un punto por lectura.

### 4.7 Informe semanal y exportador

- **Botón "Informe semanal (PDF)"** en el dashboard (B8). En el PDF, % del tiempo en rango, episodios agrupados (hoy lista hasta 50 lecturas sueltas) y "tiempo fuera de rango" calculado con la duración real (hoy supone 2 min por lectura).
- **Exportador F1** (`exceljs`, §4 del catálogo): una hoja por zona con T, HR y VPD alineados por hora, y una hoja de resumen diario (mín, máx, promedio, % en rango). Atajos de rango (hoy, 7 días, mes) y días en hora de Chile (B5).

### 4.8 Umbrales en un solo lugar

- Rangos permitidos de T, HR y VPD **por zona en la API** (`.env` o una tabla `viveros_config`), devueltos por un `GET /config` y usados por las tarjetas, los gráficos, el informe y el monitor.
- El panel de administración edita **esos** valores (A5); se elimina la escritura de `env.txt` o se alinea con las claves que lee el monitor.

### 4.9 Lo que necesita la API

| Ruta nueva | Devuelve | Para |
|------------|----------|------|
| `GET serie?zona=frio&start&end` (o `&limit=`) | `[{ time, t, hr, vpd }]` emparejado por hora | Gráficos, sparklines, VPD |
| `GET resumen-diario?start&end` | Por zona y día: mín, máx, promedio, minutos en rango, fuera de rango y sin datos | Tarjetas ("fuera de rango hoy"), cumplimiento, Excel |
| `GET episodios?start&end` | `[{ zona, variable, inicio, fin, extremo }]` | Tabla de episodios, informe |
| `GET config` | Rangos por zona y variable | Todo lo anterior y el monitor |
| `latest` (ampliar) | Agregar `zonas: { frio: { time, estado } }` sin romper las claves actuales | Barra de estado. El monitor lee las claves actuales: **no se cambian** |

Revisar que exista un índice `(sensor_id, time DESC)` en `viveros_tambo` antes de abrir rangos de 30 días.

---

## 5. Alertas (servicios)

1. **Instalar el monitor F3** (`MonitorEstanques/monitorEstanques.py`, §6 del catálogo) en modo **solo conexión, por sensor**, sobre `/latest`, con umbral de 30 min para los sensores 3 a 8. Los sensores 1 y 2 quedan fuera hasta que el cliente confirme si deben reportar. Es configuración pura (1–2 h) y resuelve S2.
2. **Agregar estado a `monitorUnificado.py`** (S1): un aviso al entrar fuera de rango, un recordatorio cada N horas y un aviso de recuperación, con el estado guardado en un JSON (igual que `estado_monitor.json` de F3). Mientras tanto, como mitigación, subir el intervalo o desactivar la alarma de T de calor hasta confirmar su rango.
3. **Detectar sensor pegado:** si una señal tiene el mismo valor durante más de 6 h, avisar al grupo admin (habría detectado S3).
4. **Leer los umbrales desde `GET /config`** cuando exista (§4.8), para que monitor y dashboard digan lo mismo.

---

## 6. Orden sugerido

| Fase | Contenido | Esfuerzo estimado | Valor visible |
|------|-----------|-------------------|---------------|
| **0. Correcciones rápidas** | B1, B2, B3, B6; A1 y A2; F3 de conexión; mitigación de S1 | 0,5–1 día | El dashboard deja de mostrar información falsa (LED, "Desconocida", gráficos planos) |
| **1. Núcleo visual** | API `serie`, `resumen-diario`, `config` · barra de estado (4.2) · tarjetas (4.3) · gráficos (4.4) · VPD (4.5) · etiqueta "Exterior (Open-Meteo)" (B7) | 2,5–3,5 días | El cambio que el cliente percibe |
| **2. Análisis y reportes** | Cumplimiento y episodios (4.6), botón e informe semanal mejorado (4.7), exportador F1 | 1,5–2 días | Información para decidir y para mostrar a terceros |
| **3. Alertas y orden** | Estado en `monitorUnificado.py`, sensor pegado, umbrales desde la API, A3–A5, limpieza (§8) | 1 día | Menos mensajes, más útiles |

Despliegue: BD (índice, tabla de configuración si se usa) → API → dashboard. El monitor F3 puede ir antes que todo.

---

## 7. Preguntas para el cliente (antes de la fase 1)

1. **Rangos permitidos** de temperatura y humedad para cada cámara. Los actuales del monitor son frío 0–5 °C, calor 22–30 °C, HR ≥ 80 % en ambas. Con esos rangos, esta semana frío estuvo en rango el 13 % del tiempo y calor el 8 %: o los rangos no son los reales, o las cámaras no están funcionando como se espera.
2. **¿Aplica el VPD a la cámara de frío?** ¿Qué rango de VPD buscan en la cámara de calor?
3. **Sensor de humedad de la cámara de calor:** lleva toda la semana en 99,9 %. ¿Hay condensación o hay que revisarlo en terreno?
4. **Estado de los equipos (sensores 1 y 2):** ¿qué significan exactamente y por qué dejaron de llegar el 31-07?
5. **Temperatura bajo cero en la cámara de frío:** la serie llega a −0,5 °C. ¿Es esperable? (La lectura ya se corrige; ver S4.)
6. **Zona "Ambiente":** ¿basta con el dato de Open-Meteo rotulado como "Exterior (estimado)" o quieren un sensor propio?
7. **Destinatarios de alertas:** qué va al grupo del cliente y qué solo al grupo admin.
8. Interno: ¿algún equipo sigue enviando por `POST /`? ¿Qué monitores corren hoy en `C:\AutomatizationServices\Viveros\`?

---

## 8. Limpieza

- Eliminar `services/monitorTemperatura copy.py` y, si el unificado ya los reemplaza en el servidor, `monitorTemperatura.py`, `monitorHumedad.py` y `monitorTemperaturaAmbiental.py`.
- Eliminar `api-viveros.zip` del repo (§13, hallazgo 14).
- Componentes sin uso: `Level.tsx`, `BurgerMenu.tsx`, `ToggleThemeButton.tsx` (o usarlo si se hace el modo oscuro), `App.css` (plantilla de Vite), la parte de registro de `LoginModal.tsx`.
- `PDFCumulativeReport.tsx` y `PDFMeasurementReport.tsx` en la raíz son referencias de otro cliente: moverlos fuera de la carpeta o borrarlos. `implementation_plan.md` ya está implementado: reemplazarlo por este plan.
- `package.json` del dashboard: declarar `chart.js` (hoy llega como dependencia transitiva de `react-chartjs-2`), quitar `router`, `xlsx`, `file-saver` y `@types/file-saver` al migrar a F1.
- Una sola constante `API_BASE` en el dashboard (hoy la URL está repetida en 4 archivos).
- Sacar `viverosDashboard/.env` (credenciales de BD y `JWT_SECRET` que el front no usa).
- `ecosystem.config.js`: `instances: 1` y `TZ: 'America/Santiago'`.

---

## 9. Estado de implementación (2026-11-18)

Todo el plan quedó implementado en el repo. **Nada está desplegado ni commiteado.** Se verificó contra un PostgreSQL local con 40 días de datos reales copiados de la API pública (la BD de producción no es accesible desde este equipo).

### Qué se hizo

| Ítem | Estado | Dónde |
|------|--------|-------|
| B1 indicador roto | Cada tarjeta muestra su estado y "hace X min" (`GET /estado`). La barra de estado general se quitó el 2026-11-19 a pedido: repetía la información de las tarjetas | `components/ZonaCard.tsx`, `EstadoDato.tsx` |
| B2 LED siempre rojo | Estado del equipo con "sin datos desde 31-07-2026" mientras no reporte; la API entrega números | `components/ZonaCard.tsx` |
| B3–B9, 4.1–4.6 | Tarjetas con barra de rango y sparkline, gráficos con eje de tiempo real, franja del rango y línea roja fuera de rango, VPD con franjas, cumplimiento, mapa de calor, episodios, "Exterior (Open-Meteo)" | `viverosDashboard/src/` |
| 4.7 informe y Excel | Botón "Informe PDF" (con período elegible) y exportador F1 (`exceljs`, hoja por zona, resumen diario y episodios). **El informe estaba roto en producción**: pdfmake 0.3 ya no exporta `PdfPrinter`, así que `GET /reports/weekly` respondía 500 | `components/InformeModal.tsx`, `ExportToExcel.tsx`, `services/reports.service.ts` |
| 4.8 umbrales | Tabla `viveros_umbrales` + `GET/PATCH /config`; el panel "Rangos" del dashboard la edita | `sql/001_viveros_umbrales.sql`, `components/AdminModal.tsx` |
| A1 seguridad | `/users/*` y `/auth/register` exigen JWT de rol 0; `JWT_SECRET` obligatorio (sin valor por defecto); CORS restringido (`CORS_ORIGINS`) | `auth/`, `users/`, `main.ts` |
| A2 validación | DTO en todas las rutas: fechas inválidas, rangos invertidos o demasiado largos → 400 | `models/dto/viveros.dto.ts` |
| A3 zona horaria | Las consultas comparan con texto en hora Chile y devuelven `AT TIME ZONE`; `TZ` en pm2 | `lib/fechas.ts`, `ecosystem.config.js` |
| A4 POST | Contrato idéntico; guarda la hora de llegada, vacía el buffer al detenerse y pm2 pasa a 1 instancia | `services/metrics.service.ts` |
| A5 env-manager | Eliminado (lo reemplaza `/config`) | — |
| S1 alertas repetidas | `monitorUnificado.py` v2: aviso al salir, recordatorio cada 2 h, aviso al volver (con histéresis), estado persistido | `services/monitorUnificado.py` |
| S2 desconexión | Monitor F3 en modo conexión por sensor | `services/monitorConexionViveros.py`, `services/monitor_config.json` |
| S3 sensor pegado | Aviso al grupo admin si una señal de las cámaras no varía en 12 h; aviso en la tarjeta | `monitorUnificado.py`, `ZonaCard.tsx` |
| S4 temperaturas bajo 0 °C | Se corrigen al leer (`valor − 6553,6`) en todas las consultas y en el monitor | `viveros.config.ts` (`valorSql`) |
| §8 limpieza | Hecha (monitores antiguos, `env.txt`, `.zip`, PDFs de otro cliente, componentes sin uso, `.env` del front, dependencias) | — |

### Diferencias con el plan

- **`GET /estado` nuevo en vez de ampliar `/latest`:** `/latest` no cambia de forma (lo leen los dos monitores), así que no hay riesgo para ellos.
- **Gráficos apilados (T, HR, VPD) en vez de doble eje:** con dos franjas de rango en ejes distintos el gráfico se leía peor. Comparten el eje de tiempo.
- **El exterior no tiene estado ni cumplimiento:** es un dato de Open-Meteo que sirve de referencia; sus rangos solo se usan para alertas, si se activan.
- **El estado de la zona se calcula con T y HR;** el VPD se informa aparte (depende de ellas y la HR de calor está pegada).
- **"Sin datos" usa un tope de 20 min entre lecturas** (no 10): en las cámaras el 10 % de los intervalos dura 8 min o más. La frescura pasa a ámbar a los 15 min y a rojo a los 30 (igual que F3).
- **"Sin variación" a las 12 h** (no 6): la HR de frío repite el mismo valor ~5 h con normalidad.

### Verificación

- API: `tsc`, 8 tests de `lib/analisis.spec.ts` (VPD, clasificación, resumen diario con huecos, episodios, medianoche en horario de verano e invierno), y todas las rutas contra la BD local: validación (400), seguridad (401), caché del resumen, invalidación al cambiar rangos y PDF.
- Dashboard: `tsc -b`, `eslint`, `vite build` (`exceljs` en un chunk aparte) y navegador a 375 px (sin scroll horizontal), 800 px y 1400 px: tarjetas, gráficos, cumplimiento, Excel leído en memoria (5 hojas, números y hora Chile), informe PDF, ingreso y edición de rangos.
- Monitores: F3 con `--una-vez --sin-enviar` contra la API real; `monitorUnificado.py` contra una API y un UltraMsg falsos, en 12 transiciones (alerta, sin repetir, recordatorio, histéresis, normalizado, dato viejo, sensor pegado y su recuperación, 6553,1 → −0,5 °C).

### Despliegue (en este orden)

1. **BD:** ejecutar `api-viveros/sql/001_viveros_umbrales.sql` (índice `CONCURRENTLY` y tabla de rangos; es idempotente).
2. **API:** copiar `src`, `package.json`, `package-lock.json`, `ecosystem.config.js` y `sql/`; `npm ci` (obligatorio: en el primer despliegue del 2026-11-19 quedó pdfmake 0.2 en el servidor y la API no arrancaba; el navegador lo mostraba como error de CORS con estado 502. Desde entonces el informe funciona con la 0.2 y la 0.3, pero conviene que el servidor tenga lo que dice el lock); `npm run build`; revisar que el `.env` tenga `JWT_SECRET` (ya lo tiene) y, si el dashboard se sirve desde otro origen, `CORS_ORIGINS`; `pm2 delete api-viveros` y `pm2 start ecosystem.config.js` (cambia a 1 instancia); comprobar `pm2 describe` (puerto 3005, `dist/main.js`).
3. **Dashboard:** `npm ci && npm run build` y publicar `dist/` en `/viveros/`.
4. **Monitores** (en `C:\AutomatizationServices\Viveros\`): detener `monitorTemperatura.py`, `monitorHumedad.py` y `monitorTemperaturaAmbiental.py` si corren; copiar `monitorUnificado.py`, `monitorConexionViveros.py`, `monitor_config.json` y `requirements.txt`; agregar `API_TO_ADMIN` al `.env`; `pip install -r requirements.txt`; probar ambos con `--una-vez --sin-enviar`; dejarlos como servicio. Ver `DEPLOY_MONITOREO.md`.

Al desplegar el monitor F3 no debería llegar ningún aviso inmediato (los sensores vigilados están al día). `monitorUnificado.py` enviará **una** alerta por cada alarma activa que esté fuera de rango (hoy frío y calor) y luego solo recordatorios cada 2 h.

### Correcciones tras el primer despliegue (2026-11-19)

- **API caída (502, visto como CORS):** el servidor tenía pdfmake 0.2. El informe ahora funciona con la 0.2 y la 0.3 (`lib/pdf.ts`) y pdfmake se carga recién al generar.
- **`latest`, `chart` y `estado` con error 500 (`integer = text`):** en producción `viveros_tambo.sensor_id` es **integer**, aunque la entidad diga varchar. Las consultas pasan el id como parámetro sin tipo (`lib/consultas.ts`) y el `INSERT` del `POST /` también (antes forzaba `varchar[]` y habría fallado). Se probó contra una tabla con `sensor_id integer` y `value double precision`.

### Pendiente

- **Confirmar con el cliente** las preguntas de §7, sobre todo los rangos (con los actuales, las dos cámaras pasan la mayor parte del tiempo fuera de rango) y el sensor de HR de calor.
- **Revisar el broker en el servidor** (S4): el del repo no corresponde a los datos. Cuando se sepa qué transformación usa `T_FRIO`/`T_CALOR`, corregir la ingesta y quitar `valorSql`. Hasta entonces, la corrección al leer es segura: ninguna temperatura real llega a 6000.
- Crear el primer administrador si no existe (los registros nuevos exigen un JWT de rol 0, así que el primero se inserta en `viveros_tambo_users` con rol `'0'`).
- `Tambo/tankService.py` quedó en v1.0.0 en el commit d18f163 y `sincronizar.py --verificar` lo marca ✗ (ajeno a Viveros).
