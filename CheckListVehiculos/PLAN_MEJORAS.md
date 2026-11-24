# Plan de mejoras — CheckList Vehículos

Fecha: 2026-11-24. Complementa `REVISION_BUGS_Y_MEJORAS.md` (2026-11-03): de ese documento solo B1 y B4 están corregidos en el código, y el resto sigue abierto. Aquí se priorizan las tareas por fases y se agrega el problema de zona horaria.

## 0. Zona horaria (prioridad inmediata)

### Qué hace el código hoy

- `created_at` / `updated_at` de checklists, imágenes, usuarios y vehículos usan `@CreateDateColumn()` / `@UpdateDateColumn()` sin tipo. En Postgres, TypeORM los crea como **`timestamp without time zone`** con `DEFAULT now()`.
- `error_log.timestamp` también es `timestamp` sin zona.
- Un `timestamp` sin zona guarda la hora de pared de la **zona de sesión de la conexión** (`now()` la convierte a esa zona) y no guarda el instante real.
- El driver `pg` lee ese valor y lo interpreta como hora local del **proceso Node**. Luego `JSON.stringify` lo manda como UTC (`...Z`) y el navegador lo muestra en su zona (`date-fns format(new Date(...))`).
- El resultado solo es correcto si la zona de sesión de la BD y la zona del proceso Node coinciden. Si no coinciden, la hora se corre en bloque. La hora ya guardada está mal para siempre, porque no guarda el instante.

### Por qué puede fallar aunque "el servidor y el motor estén en America/Santiago"

- `api-checklist-vehiculos/.env` apunta a una **instancia RDS** (`jte-analytics-bd…us-east-1.rds.amazonaws.com`), no a un Postgres local. En RDS la zona por defecto es **UTC** (parámetro `timezone` del parameter group). Que el motor esté "en Santiago" debe confirmarse con `SHOW timezone` desde esta app.
- `ALTER DATABASE … SET timezone` o `ALTER ROLE … SET timezone` pueden dar zonas distintas por base o por usuario.
- PM2 puede arrancar con otro `TZ` que el shell (`ecosystem.config.js` no fija `TZ`).
- Esta misma BD la comparten otras apps de JTE que escriben con otra zona (no verificado).

Cálculo esperado si la sesión es UTC y Node es Santiago: hoy (UTC-3) la hora se vería **3 h adelantada** y en invierno (UTC-4) **4 h**. Usted observa unas 2 h, así que la causa exacta no está confirmada y hay que medirla (siguiente sección).

### Diagnóstico (5 minutos, sin tocar datos)

1. En la BD (con el mismo usuario de la app): `SHOW timezone; SELECT now(), now() AT TIME ZONE 'UTC';`
2. Un registro reciente, creado con la hora conocida: `SELECT id, created_at, pg_typeof(created_at) FROM checklists ORDER BY id DESC LIMIT 3;`
   Compare `created_at` (hora de pared guardada) con la hora real en que se creó.
3. En el servidor, desde la carpeta de la API: `node -e "console.log(new Date().toString(), process.env.TZ, Intl.DateTimeFormat().resolvedOptions().timeZone)"`, y con PM2: `pm2 env <id> | grep TZ`.
4. En el navegador, `new Date().toString()` (por si un celular tiene la zona mal configurada).

Con esos datos se sabe cuál de los tres componentes (BD, Node, navegador) está desfasado.

### Arreglo propuesto

1. **Migrar las columnas a `timestamptz`** (`@CreateDateColumn({ type: 'timestamptz' })`, igual en `updated_at` y `error_log.timestamp`). Guarda el instante real, y la zona de la BD y de Node deja de importar.
   - Migración de los datos existentes: `ALTER TABLE … ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE '<zona con la que se escribió>';`. La zona correcta sale del diagnóstico (probablemente `'UTC'` si la sesión es UTC). Hay que hacerlo con un respaldo previo, y **no** dejar que `synchronize: true` lo haga solo, porque lo convertiría con la zona de la sesión.
2. **Fijar la zona en la capa de formato del frontend:** `Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', … })` (o `date-fns-tz`), para que no dependa de la zona del celular. Reemplaza los 3 `format(new Date(...))` de `ChecklistDetail`, `ChecklistList` y `PDFChecklistReport`.
3. **Fijar `TZ=America/Santiago` en `ecosystem.config.js`** y la zona de sesión en la conexión TypeORM (`extra: { options: '-c timezone=America/Santiago' }`) como defensa extra.
4. Las fechas `date` (`fecha_venc_*`, `fecha_prox_mantencion`) no sufren este problema, porque no tienen hora. Se mantienen.
5. Verificar tras el despliegue: crear un checklist de prueba y comparar la hora mostrada con el reloj.

## 1. Seguridad y corrección de datos (Fase 1)

| Tarea | Ref. | Notas |
|---|---|---|
| Dejar de devolver `password_hash` (`select: false` o `@Exclude`) | B2/S1 | Hoy sale en `GET /checklists` y `GET /users/:id` |
| `fileFilter` para subidas (solo jpeg/png/webp, extensión forzada) y `nosniff` | B3/S2 | Hoy se puede subir `.html`/`.svg` al mismo dominio |
| Validar el DTO tras `JSON.parse` (`plainToInstance` + `validateOrReject`) y `ParseUUIDPipe` en los `:id` | B9 | Hoy los datos inválidos dan 500 |
| `JwtStrategy` debe devolver `is_admin` desde la BD | S3 | Hoy el rol queda fijo en el token 8 h |
| Proteger o eliminar `POST /users`; limitar `POST /error-logs` | S4/S5 | |
| Borrar archivos de `uploads/` al hacer rollback y al borrar un checklist | B10 | |
| Rebote al login tras el primer ingreso | B5 | `handleHash` usa un `token` fijo del montaje (`App.tsx`) |
| Bloqueo de fila (`pessimistic_write`) del vehículo al crear checklist | | Evita carreras en el kilometraje |

## 2. Fiabilidad del flujo de fotos (Fase 2)

- Guardar `check_item` real en `checklist_images` (hoy todo es `general`).
- Exigir en el servidor las 6 fotos obligatorias, y que un ítem MALO lleve `observation`.
- Calcular `has_issues` en el servidor.
- Comprimir al capturar (no al enviar), barra de progreso y botón "Reintentar".
- Guardar el borrador (incluidas las fotos) en IndexedDB, y restaurar el vehículo tras una recarga (B8).
- Revisar `client_max_body_size` del proxy, y que un redeploy no borre `uploads/`.
- Medir el daño de B1 con la consulta del documento anterior (checklists sin fotos desde el 24-oct).

## 3. Cálculos y UX (Fase 3)

- B6: alerta de mantención con `kilometraje - km_ultima_mantencion`, no con el odómetro absoluto.
- B7: historial vacío no debe mostrar "Error al cargar".
- B11: generar el PDF solo al hacer clic, no uno por tarjeta; paginar `GET /checklists`.
- B12/B13: cámara (liberar el stream, alternativa con `<input type="file" capture>`) y URL de fotos con doble barra.
- Historial y filtros (patente, fecha, estado) también para operadores.
- Normalizar la patente (mayúsculas, formato chileno) y capturar duplicados en `update` (hoy 500).
- Duplicación del umbral `10000 km` en `VehicleCard` y `EditVehicleModal`: moverlo a una constante o al backend.

## 4. Deuda técnica (Fase 4)

- `synchronize: true` → migraciones de TypeORM (necesario antes de cambiar las columnas de la sección 0).
- `ssl.rejectUnauthorized: false` → usar el certificado de RDS.
- CORS abierto → restringir al origen de la app.
- Controladores con `try/catch` que solo relogean: los hace redundantes el `HttpExceptionFilter`.
- `checklists.service` tipa `user: any`; tipos compartidos front/back.
- Frontend: `dist/` y `api-checklist.zip` están versionados (ensucian el repo); `visual_checks`/`mechanical_checks` como `any`.
- Tests: ninguno. Empezar por `ChecklistsService.create` y por el armado del `FormData`.
- Credenciales: `.env` (clave de BD y `JWT_SECRET`) está ignorado por git y no está versionado. Falta revisar que no haya estado en commits antiguos.

## Orden sugerido

1. Zona horaria (sección 0): diagnóstico y luego migración.
2. Fase 1 de seguridad: B2, B3, B5, B9.
3. Fases 2 y 3 según lo que más reporten los usuarios.

---

## Estado de ejecución (2026-11-24)

Implementado y compilado (backend `nest build`, frontend `tsc` + `vite build`). Sin probar contra la BD real ni en un navegador.

Pendiente a propósito: edición de checklists (se quitó el botón que no hacía nada), miniaturas con `sharp`, fotos por ítem en el detalle y el PDF (ya se guarda `check_item`, falta mostrarlo), migraciones de TypeORM (por ahora scripts en `api-checklist-vehiculos/sql/`), tests.

### Orden de despliegue

1. Respaldo (snapshot de RDS).
2. `sql/00_diagnostico_zona_horaria.sql` → decidir las dos zonas en `sql/01_migracion_timestamptz.sql` y ejecutarlo.
3. Desplegar el backend (`npm run build`, reiniciar PM2). Variables nuevas en `.env` (todas opcionales):
   - `CORS_ORIGINS=https://app.jteanalytics.cl` (sin definir, queda abierto)
   - `DB_SYNCHRONIZE=true` solo en desarrollo (ahora es `false` por defecto)
   - `DB_SSL_CA=/ruta/global-bundle.pem` para validar el certificado de RDS (sin definir, no se valida, como antes)
4. Desplegar `checklist-vehiculos/dist/`.
5. Si el proxy limita el cuerpo de las peticiones, subir `client_max_body_size` a 40m o más.
