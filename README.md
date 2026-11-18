# proyectos-jte

Monorepo de **JTE Analytics**. Contiene los sistemas que JTE desarrolla y opera para sus clientes. La mayoría son plataformas de monitoreo de instalaciones de agua (APR, SSR, viñas y campos agrícolas): pozos, bombas, estanques, caudalímetros y totalizadores. También hay algunas aplicaciones de gestión (mantención, checklists, cotizaciones, conciliación bancaria).

Cada cliente tiene su propia carpeta con una API, un dashboard web y, según el caso, servicios Python de ingesta, alertas o reportes. Todo se publica en `https://app.jteanalytics.cl/<cliente>/`.

> **Antes de tocar cualquier cliente, lee [CATALOGO_FEATURES.md](CATALOGO_FEATURES.md).** Es el documento de referencia del repo: explica las convenciones, las features reutilizables, la plantilla para clientes nuevos, el inventario de clientes con sus puertos y los problemas conocidos. Este README es solo la puerta de entrada.

---

## Stack

| Pieza | Tecnología |
|-------|------------|
| APIs | NestJS 11 + TypeORM + PostgreSQL (AWS RDS). Hay algunas versiones antiguas en MySQL |
| Dashboards | React 19 + Vite + TypeScript + Bootstrap 5 + Chart.js |
| Servicios | Python 3: ingesta MQTT (`paho-mqtt`, `psycopg2`), alertas por WhatsApp vía UltraMsg (`requests`) y reportes a la DGA |
| Servidor | Windows con nginx como proxy inverso; las APIs corren con pm2 y los servicios Python como servicios de Windows |

La UI, los comentarios y los mensajes se escriben en español. Fechas y horas siempre en hora de Chile (`America/Santiago`).

## Cómo está organizado

```
Proyectos/
├── <Cliente>/                  una carpeta por cliente o app
│   ├── api-<cliente>/          API NestJS
│   ├── front-<cliente>/        dashboard React (en clientes antiguos: Dashboard<Cliente>React/ o dashboard-<cliente>/)
│   ├── tankService.py          monitor de alertas (copia del monitor unificado)
│   ├── monitor_config.json     configuración del monitor para ese sitio
│   ├── provider<Cliente>.py    ingesta MQTT → BD (solo si la ingesta es nuestra)
│   ├── <cliente>Reports.py     reporte diario a la DGA (solo pozos con esa obligación)
│   └── DOCUMENTACION.md        documentación del cliente (en los revisados)
├── MonitorEstanques/           origen único del monitor de alertas y su sincronizador
├── CATALOGO_FEATURES.md        referencia principal del repo
├── DEPLOY_MONITOREO.md         checklist de despliegue del monitor por sitio
├── HOMOGENEIZACION_MONITOREO.md  análisis y diseño del monitor unificado
└── RELEASENOTES.md             notas de cambios
```

### Tipos de proyecto

| Tipo | Ejemplos | Qué hacen |
|------|----------|-----------|
| **SSR / APR con estanques** (la mayoría) | Balsas, Tambo, Cuevas, Cumpeo, Zuñiga, Ranguil, Boldos, Bucalemu… | Diagrama SCADA animado del proceso, gráficos de nivel, caudal, totalizador y horómetro, alertas de nivel crítico y de desconexión |
| **Pozos con reporte a la DGA** | Auquinco, California, Carracedo, Encinos | Lo anterior más el envío diario de freático, caudal y totalizador a la Dirección General de Aguas |
| **Caudal y consumo** | Montes, Undurraga | Consumo diario, por hora y por mes por línea, y exportación a Excel |
| **Agro** | Zagal, Viveros, Olivar Bajo | Riego por sectores con mapa (Zagal); temperatura, humedad y VPD de invernadero (Viveros) |
| **Apps de gestión** | Mantenimiento, *Mediciones, CheckListVehiculos, Cotizaciones/Maval, ConciliacionBancaria, ReconocimientoVehiculos, MavalECommerce | Login, formularios en terreno con fotos y PDFs |

El listado completo de clientes, con su puerto, tabla y lo que tiene implementado, está en la §12 del catálogo.

### Carpetas que no son clientes

| Carpeta | Contenido |
|---------|-----------|
| `MonitorEstanques/` | Script único de alertas (`monitorEstanques.py`) que se copia a cada sitio con `sincronizar.py` |
| `jte/` | Portal de entrada con enlaces a los dashboards |
| `DGA/` | Documentación de la API de la DGA |
| `MQTT/` | Scripts de prueba del broker |
| `DataProvider/`, `jteAtumatizationDashboard/` | Restos de proyectos anteriores |

## Flujo de datos

```
Equipo en terreno (PLC / COPSET)
   │  MQTT, o POST directo a la API
   ▼
PostgreSQL (RDS) ── tabla de lecturas crudas por cliente, p. ej. ssr_<cliente>(mt_name, mt_value, mt_time_2)
   │
   ▼
API NestJS (puerto propio) ◄── nginx: /<cliente>/ → localhost:<puerto>
   │
   ├─► Dashboard React (https://app.jteanalytics.cl/<cliente>/)
   ├─► Monitor Python → WhatsApp (grupo del cliente y grupo admin)
   └─► Reporte DGA (pozos que reportan)
```

Los monitores y los reportes consultan la **API pública**, nunca la base de datos directamente.

## Empezar a trabajar

1. Lee las §0 a §3 de [CATALOGO_FEATURES.md](CATALOGO_FEATURES.md) (contexto y reglas) y busca el cliente en la §12 (inventario) y la §13 (problemas conocidos).
2. Si el cliente tiene `DOCUMENTACION.md` o `PLAN_MEJORAS.md`, léelo.
3. Para desarrollar en local:

   ```bash
   cd <Cliente>/api-<cliente>
   npm install
   npm run start:dev
   ```

   La API necesita un `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` y `PORT`. Usa el `env.example` de la carpeta si existe; si no, el de `Balsas/api-balsas/`.

   ```bash
   cd <Cliente>/front-<cliente>
   npm install
   npm run dev
   ```

   Abre `http://localhost:5173/<cliente>/`. En los dashboards nuevos, `VITE_API_URL=http://localhost:<puerto>` apunta el front a la API local. En los antiguos, la URL de producción está escrita en el código.

4. Para probar un monitor sin enviar mensajes:

   ```bash
   python <Cliente>/tankService.py --una-vez --sin-enviar
   ```

### Cliente nuevo

Parte de **SSR Las Balsas** (`Balsas/`), la implementación más reciente. Sigue la plantilla de la §10 del catálogo, toma el siguiente puerto libre de la §12 y registra el sitio en el monitor (§6). No copies un cliente antiguo: arrastran errores conocidos.

## Reglas que más se olvidan

- **Después de copiar código de otro cliente**, busca el nombre del cliente de origen en `src/`. Hoy hay dashboards que consultan la API de otro cliente por este motivo.
- **Las claves de `localStorage` llevan el nombre del cliente.** Todos los dashboards comparten dominio y, por lo tanto, `localStorage`.
- **Nunca calcules "el día" con `toISOString().split("T")[0]`.** Entre las 21:00 y las 23:59 de Chile devuelve el día siguiente.
- **El monitor se edita solo en `MonitorEstanques/monitorEstanques.py`.** Después ejecuta `python MonitorEstanques/sincronizar.py` y comprueba con `--verificar`.
- **Despliegue:** primero la BD, después la API y al final el dashboard. Comprueba que el puerto de `main.ts` coincida con el de nginx.
- **Los `.env` no van a git.** Las credenciales de BD, UltraMsg y DGA se replican a mano en el servidor.

## Documentación

| Documento | Para qué |
|-----------|----------|
| [CATALOGO_FEATURES.md](CATALOGO_FEATURES.md) | Referencia principal: convenciones, features, plantilla, inventario y problemas pendientes |
| [DEPLOY_MONITOREO.md](DEPLOY_MONITOREO.md) | Estado y pasos de despliegue del monitor en cada sitio |
| [HOMOGENEIZACION_MONITOREO.md](HOMOGENEIZACION_MONITOREO.md) | Por qué el monitor unificado es como es |
| [RELEASENOTES.md](RELEASENOTES.md) | Notas de cambios por fecha |
| `<Cliente>/DOCUMENTACION.md` | Detalle de un cliente: señales, rutas, alarmas y lo que falta confirmar (Balsas, Zuñiga, Ranguil, CheckListVehiculos) |
| `<Cliente>/PLAN_MEJORAS.md` | Diagnóstico y mejoras aplicadas (Montes, Undurraga) |
| `ConciliacionBancaria/api-conciliacion/README.md` | API de conciliación bancaria |
