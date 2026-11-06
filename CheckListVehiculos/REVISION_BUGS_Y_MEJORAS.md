# Revisión de bugs, riesgos y mejoras — CheckList Vehículos

Fecha: 2026-11-03. Foco: problemas al subir checklists con imágenes.

Severidad: 🔴 crítico · 🟠 alto · 🟡 medio · ⚪ bajo · ✅ corregido (falta desplegar)

## Resumen

| # | Sev. | Problema | Archivo |
|---|---|---|---|
| B1 | 🔴 ✅ | Las fotos no llegan al servidor: axios convierte el `FormData` a JSON | `checklist-vehiculos/src/api.ts:7` |
| B2 | 🔴 | `GET /checklists` devuelve `password_hash` de los usuarios | `checklists.service.ts:78-80` |
| B3 | 🟠 | Se pueden subir archivos de cualquier tipo (`.html`, `.svg`) y quedan públicos en el mismo dominio | `checklists.controller.ts:17-30` |
| B4 | 🟠 ✅ | El envío se queda pegado en "Guardando…" si una foto está vacía o corrupta | `ChecklistForm.tsx:88-107`, `PhotoCaptureModal.tsx:43-55` |
| B5 | 🟠 | Tras el primer login (sin recargar) la app vuelve a la pantalla de login | `App.tsx:22,51` |
| B6 | 🟡 | La alerta de mantención usa el km de la última mantención en vez de los km recorridos desde ella | `VehicleCard.tsx:12-17` |
| B7 | 🟡 | Historial vacío muestra "Error al cargar checklists" | `ChecklistList.tsx:16-18` |
| B8 | 🟡 | Sin vehículo seleccionado (recarga o pestaña reabierta), "Guardar" no hace nada y se pierde todo | `ChecklistForm.tsx:111` |
| B9 | 🟡 | El body del checklist no se valida (el `ValidationPipe` no actúa sobre `JSON.parse`) | `checklists.controller.ts:38` |
| B10 | 🟡 | Archivos huérfanos en `uploads/` al fallar la transacción o al eliminar un checklist | `checklists.service.ts:66-69,103-106` |
| B11 | 🟡 | La lista de checklists genera un PDF por tarjeta al cargar (descarga todas las fotos) | `ChecklistList.tsx:126-132` |
| B12 | 🟡 | La cámara puede quedar encendida y no hay aviso si se niega el permiso | `PhotoCaptureModal.tsx:15-41` |
| B13 | 🟡 | URL de fotos con doble barra en el detalle (`…/checklist-vehiculos//uploads/…`) | `ChecklistDetail.tsx:134` |
| S1–S6 | 🟠/🟡 | Problemas de seguridad del backend | ver sección Seguridad |

---

## Bugs en la subida de reportes con imágenes

### B1 🔴 Las fotos se descartan en silencio

La instancia de axios fija `Content-Type: application/json` por defecto (`api.ts:7`). En el commit `8b69889` (24-oct) se quitó el header `multipart/form-data` del `api.post('/checklists', formData)`. Con axios 1.x, si el header es JSON, `transformRequest` convierte el `FormData` en JSON y los `Blob` quedan como `{}`.

Comprobado con el axios instalado (1.19.0):

```
content-type: application/json
data: {"data":"{\"a\":1}","files":[{},{}]}
```

Efecto: el backend recibe JSON, `express.json` lee `data`, Multer no ve archivos, y el checklist se guarda **sin ninguna foto** mientras el usuario ve "Checklist guardado exitosamente". El build en `checklist-vehiculos/dist/` ya trae este bug.

Historia probable de los reportes de usuarios: antes del 24-oct las fotos viajaban dos veces (como archivo y como base64 dentro de `data`). El campo `data` superaba el límite por defecto de Multer (1 MB) y el envío fallaba. El arreglo del 24-oct corrigió eso pero introdujo B1.

Arreglo (cualquiera de los dos):

```ts
// api.ts — quitar el header por defecto (axios ya pone JSON para objetos)
const api = axios.create({ baseURL: ..., timeout: 60000 });
```

```ts
// ChecklistForm.tsx — o forzarlo en la llamada; en el navegador axios lo reemplaza por el boundary correcto
await api.post('/checklists', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
```

**Corregido (2026-11-03):** se quitó el header por defecto de `api.ts`. Verificado en navegador con un servidor de eco: antes `application/json` (36 bytes, 0 archivos); ahora `multipart/form-data; boundary=…` con todos los archivos. Las peticiones con objetos siguen saliendo como `application/json`.

Para medir el daño: `SELECT count(*) FROM checklists c LEFT JOIN checklist_images i ON i.checklist_id = c.id WHERE i.id IS NULL AND c.created_at >= '2026-10-24';`

### B4 🟠 Envío colgado para siempre

- `PhotoCaptureModal.capturePhoto` no espera a que el video esté listo. Si `videoWidth` es 0 (cámara cargando o permiso denegado), `canvas.toDataURL` devuelve `"data:,"`.
- Ese valor pasa la validación del formulario (es un string no vacío que empieza con `data:`).
- `compressImage` no tiene `img.onerror`, así que la promesa nunca se resuelve y el botón queda en "Guardando…".
- Si llegara a `dataURLtoBlob`, el `match(...)!` lanzaría una excepción.

**Corregido (2026-11-03):**
- `PhotoCaptureModal`: el botón de captura queda deshabilitado hasta `loadedmetadata`, y `capturePhoto` ignora frames sin dimensiones.
- `ChecklistForm`: `compressImage` rechaza la promesa si la imagen no carga o mide 0 px; `dataURLtoBlob` lanza un error legible en vez de romperse.
- El `catch` del envío distingue errores locales (no axios) y muestra "Una de las fotos está vacía o dañada. Vuelva a tomarla…", en vez de "No se pudo conectar con el servidor".

### B8 🟡 Formulario sin vehículo

El hash `#checklist-form` sobrevive a una recarga, pero `selectedVehicle` vive en memoria. En celulares con poca RAM, el navegador puede recargar la pestaña (por ejemplo, con 6 a 26 fotos a resolución completa en memoria). El usuario vuelve a ver el formulario sin la tarjeta del vehículo, lo completa, y `handleSubmit` termina en `if (!vehicle) return;` sin mostrar ningún mensaje.

Arreglo: si no hay vehículo, redirigir a `home` con un aviso; guardar `vehicle.id` en el hash o en `sessionStorage`.

### B10 🟡 Archivos huérfanos

Multer escribe las fotos en disco antes de que corra el servicio. Si el vehículo no existe, el km es menor o falla la BD, se hace rollback pero los archivos quedan. `DELETE /checklists/:id` tampoco borra los archivos. Arreglo: `fs.unlink` de `files` en el `catch` y de `images[].image_path` en `remove`.

### Otros detalles del flujo de fotos

- Si un ítem se marca MALO, se le saca foto y luego se cambia a OK, la foto se sube igual y queda `hasPhoto: true`.
- Las imágenes se guardan con `check_type = 'general'` y `check_item = 'general'`. La relación foto↔ítem solo queda en `description` (nombre de archivo como `frenos.jpg`). Conviene enviar y guardar `check_item` real.
- Las capturas se guardan a resolución nativa (JPEG 0.8) hasta el envío. Comprimir al capturar reduce mucho el uso de memoria.
- No hay barra de progreso (`onUploadProgress`) ni reintento automático. Ante un fallo de red, el estado se conserva solo mientras el usuario no salga de la vista.
- El proxy delante de la API (nginx u otro) puede tener `client_max_body_size` de 1 MB por defecto. Con 6 a 26 fotos comprimidas (aprox. 100–250 KB c/u) el request supera fácilmente 1 MB → 413. **Revisar la configuración del servidor** y la tabla `error_log` (el frontend registra `status` y `fileCount`).

## Otros bugs funcionales

### B5 🟠 Rebote al login

En `App.tsx` el handler de `hashchange` usa la constante `token` leída **una sola vez al montar**. Si la app se abrió sin sesión, después del login `changeView('home')` cambia el hash, el handler ve `token = null` y vuelve a poner `login`. Reproducir: ventana de incógnito → iniciar sesión. Arreglo: leer `localStorage.getItem('jwt_token')` dentro de `handleHash`.

### B6 🟡 Alerta de mantención

`getMaintenanceAlert` compara `km_ultima_mantencion` (odómetro en la última mantención) con 8 000/10 000. Un vehículo mantenido a los 50 000 km queda siempre en rojo. Debe usar `kilometraje - km_ultima_mantencion`, igual que la etiqueta.

### B7 🟡 Historial vacío

`console.log(Object.keys(response.data[0]))` lanza `TypeError` si no hay checklists; se muestra el toast de error. Quitar los `console.log` de depuración.

### B11 🟡 PDFs en la lista

Cada `PDFDownloadLink` genera su PDF al montar, incluyendo la descarga de todas las fotos. Con decenas de checklists, la lista se vuelve muy lenta en celulares. Generar el PDF solo al hacer clic (`pdf(<ReportDocument/>).toBlob()` + `file-saver`, que ya está instalado). Además, `GET /checklists` no tiene paginación.

### B12 🟡 Cámara

- La función de limpieza del `useEffect` captura un `stream` antiguo (`null`). Si se cierra el modal antes de que `getUserMedia` responda, o se desmonta, la cámara queda encendida. Guardar el stream en un `useRef`.
- Si el permiso se niega o el navegador no soporta `getUserMedia` (requiere HTTPS), solo se ve un fondo negro. Mostrar el error y ofrecer `<input type="file" accept="image/*" capture="environment">` como alternativa.

### B13 🟡 Doble barra en URL de fotos

`ChecklistDetail` arma `${BASE}/uploads/…` y el `BASE` por defecto ya termina en `/`. El PDF sí la quita (`replace(/\/$/, '')`). Según cómo el proxy normalice la URL, las miniaturas del detalle pueden no cargar. Usar la misma función en ambos lados.

### Menores ⚪

- `addToast` usa `Date.now()` como id; dos toasts en el mismo milisegundo duplican la `key`.
- Nombre del PDF: `.replace('/', '')` solo quita la primera barra (`dd/MM/yyyy HH:mm`).
- `ChecklistDetail` tras recargar muestra "No se encontró el checklist" (no lo pide a `GET /checklists/:id`).
- `EditVehicleModal` cierra el modal también ante error (se pierde lo escrito) y muestra un mensaje genérico, incluso con patente duplicada.
- No se puede borrar una fecha del vehículo: el `""` se descarta antes de enviar.
- Los operadores no ven su propio historial (las pestañas de `Navbar` son solo para admin), aunque el backend lo permite.
- `UpdateChecklistDto` existe pero no hay endpoint `PATCH /checklists/:id`; el modal de edición es un placeholder.

## Seguridad (backend)

| # | Sev. | Problema | Arreglo |
|---|---|---|---|
| S1 (=B2) | 🔴 | `relations: ['user']` trae la entidad completa, incluido `password_hash`, en `GET /checklists` y `GET /checklists/:id`. `GET /users/:id` también lo devuelve a cualquier usuario autenticado | `@Column({ select: false })` en `password_hash` o `ClassSerializerInterceptor` + `@Exclude()` |
| S2 (=B3) | 🟠 | Sin `fileFilter`: la extensión viene del nombre original y `/uploads` es público. Un `.html`/`.svg` subido corre en el mismo dominio que el frontend y puede leer el JWT de `localStorage` | `fileFilter` solo `image/jpeg`, `image/png`, `image/webp`; forzar extensión `.jpg`; header `X-Content-Type-Options: nosniff` |
| S3 | 🟠 | `RolesGuard` usa `is_admin` del token. Si se le quita el rol a alguien, sigue siendo admin hasta 8 h | Devolver `user.is_admin` desde la BD en `JwtStrategy.validate` (ya se consulta) |
| S4 | 🟡 | `POST /users` es público y duplica `/auth/register` | Protegerlo con admin o eliminarlo |
| S5 | 🟡 | `POST /error-logs` es público, sin DTO ni límite de tamaño; acepta cualquier `user_id` | DTO con `@MaxLength`, rate limit (`@nestjs/throttler`), tomar el usuario del JWT si existe |
| S6 | 🟡 | `synchronize: true` en producción; `ssl.rejectUnauthorized: false`; CORS abierto a todos los orígenes | Migraciones de TypeORM; restringir `enableCors({ origin })` |

## Validaciones recomendadas

Backend (`POST /checklists`):

1. Validar el DTO tras `JSON.parse`: `plainToInstance(CreateChecklistDto, json)` + `validateOrReject`. Hoy un `kilometraje_actual` no numérico o un `vehicle_id` que no es uuid dan **500** en vez de 400.
2. `@IsUUID()` en `vehicle_id`; `@Min(0)` y `@Max(…)` en `kilometraje_actual`; `@MaxLength` en `observaciones_generales`.
3. Rechazar vehículos con `is_active = false`.
4. Exigir en el servidor las 6 fotos obligatorias (4 exteriores + 2 interiores) por nombre de campo, no solo en el cliente.
5. Exigir `observation` no vacía en todo ítem con `isGood = false`.
6. Calcular `has_issues` en el servidor en vez de confiar en el cliente.
7. Avisar o pedir confirmación si el salto de km es inusual (por ejemplo, > 2 000 km desde el último checklist).
8. Bloquear la fila del vehículo (`lock: { mode: 'pessimistic_write' }`) para evitar carreras entre dos checklists simultáneos.
9. Limitar `files` a 26 (el máximo real del formulario) en vez de 30.
10. `ParseUUIDPipe` / `ParseIntPipe` en los `:id` para devolver 400 en vez de 500.

Backend (vehículos y usuarios):

- Normalizar `patente` a mayúsculas sin espacios ni guiones y validar el formato chileno (`/^([A-Z]{2}\d{4}|[A-Z]{4}\d{2})$/`). Hoy `text-uppercase` es solo visual y permite duplicados como `abcd12` / `ABCD12`.
- Capturar duplicados de `patente` y `email` en `update` (hoy dan 500 por la restricción única).
- No permitir bajar `kilometraje` por debajo del último checklist.

Frontend:

- Guardar el borrador del checklist (incluidas las fotos) en IndexedDB y restaurarlo si la pestaña se recarga.
- Comprimir al capturar (1024 px, JPEG 0.6), no al enviar.
- Barra de progreso de subida y botón "Reintentar" que conserve los datos.
- Antes de enviar, verificar que cada foto pese más de 0 bytes.
- Mostrar el `status` HTTP en el error (413 = fotos muy pesadas, 401 = sesión vencida) para diagnosticar.
- Avisar cuando falte poco para que venza el JWT, para que un 401 a mitad de un checklist largo no borre la sesión y el formulario.

## Oportunidades de mejora

- **Historial para operadores** y filtros por patente/fecha/estado (con paginación en el backend).
- **Miniaturas**: generar una versión pequeña al subir (p. ej. con `sharp`) para la lista y el detalle; `loading="lazy"` en `<img>`.
- **Fotos por ítem en el detalle y el PDF**: mostrar cada foto junto al ítem MALO al que pertenece.
- **Edición de checklist** (completar el `PATCH` y el modal).
- **Panel de admin de usuarios** (hoy solo existe la API para activar cuentas).
- **Almacenamiento de fotos** fuera del disco del servidor (S3 o similar) o, al menos, respaldo de `uploads/`; asegurarse de que un redeploy no borre la carpeta.
- **Tests**: no hay ninguno. Empezar por `ChecklistsService.create` y por el armado del `FormData` en el frontend (un test habría detectado B1).
