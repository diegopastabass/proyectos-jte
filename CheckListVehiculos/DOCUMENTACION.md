# CheckList Vehículos — Documentación

App web para que operadores registren inspecciones (checklists) de vehículos con fotos, y para que administradores gestionen la flota y revisen el historial.

| Parte | Carpeta | Stack |
|---|---|---|
| Frontend | `checklist-vehiculos/` | React 18 + Vite + Bootstrap 5 + axios + @react-pdf/renderer |
| Backend | `api-checklist-vehiculos/` | NestJS 10 + TypeORM + PostgreSQL + Passport JWT + Multer |

## 1. Arquitectura general

```
Navegador (React, base /checklist-vehiculos/)
   │  axios  → baseURL = VITE_API_URL o https://app.jteanalytics.cl/checklist-vehiculos/
   │  Header Authorization: Bearer <jwt_token de localStorage>
   ▼
NestJS (puerto PORT o 3037, pm2: dist/main.js)
   ├─ /auth, /users, /vehicles, /checklists, /error-logs
   ├─ /uploads/*  → archivos estáticos (fotos) desde ./uploads
   └─ TypeORM → PostgreSQL (synchronize: true, SSL)
```

- **Autenticación:** login devuelve un JWT (8 h). El frontend lo guarda en `localStorage` (`jwt_token`, `user_data`). Ante un 401, el interceptor borra la sesión y manda a `#login`.
- **Navegación:** no usa router. `App.tsx` maneja una variable `view` sincronizada con el hash de la URL (`#home`, `#checklist-form`, etc.).
- **Fotos:** se capturan con la cámara del navegador (`getUserMedia`), se comprimen en el cliente y viajan como `multipart/form-data` al backend, que las guarda en disco (`./uploads`) y registra su nombre en la tabla `checklist_images`.
- **PDF:** se genera 100 % en el navegador con `@react-pdf/renderer`, descargando las fotos desde `/uploads`.
- **Errores del cliente:** `errorLogger.ts` los envía a `POST /error-logs`; si falla, los guarda en `localStorage` y los reintenta al iniciar sesión.

### Modelo de datos

| Tabla | Campos clave |
|---|---|
| `users` | id (uuid), name, email (único), password_hash, is_admin, is_active |
| `vehicles` | id (uuid), model, patente (única), kilometraje, km_ultima_mantencion, fecha_venc_revision_tecnica, fecha_venc_circulacion, fecha_prox_mantencion, is_active |
| `checklists` | id (bigint), user_id, vehicle_id, kilometraje_actual, visual_checks (jsonb), mechanical_checks (jsonb), observaciones_generales, has_issues |
| `checklist_images` | id, checklist_id (FK, cascade), image_path, description, check_type, check_item |
| `error_log` | id (uuid), user_id, error, timestamp |

## 2. Componentes y Endpoints

### Componentes React (`checklist-vehiculos/src/components`)

| Componente | Función |
|---|---|
| `App.tsx` | Estado global (vista, usuario, vehículo y checklist seleccionados, toasts) y "router" por hash |
| `Login` / `Register` | Inicio de sesión y registro (la cuenta queda inactiva hasta que un admin la active) |
| `Navbar` | Marca, pestañas Vehículos/Checklists (solo admin), cerrar sesión |
| `Home` → `VehicleList` → `VehicleCard` | Lista de flota, alertas de vencimientos y mantención, botón "Iniciar CheckList" |
| `EditVehicleModal` | Crear / editar vehículo (admin) |
| `ChecklistForm` | Formulario de inspección: kilometraje, 12 ítems visuales, 8 mecánicos, 4 fotos exteriores y 2 interiores obligatorias |
| `PhotoCaptureModal` | Cámara trasera del dispositivo y captura a JPEG |
| `ChecklistList` | Historial (admin) con exportar PDF, editar (sin implementar) y eliminar |
| `ChecklistDetail` | Detalle de un checklist con sus fotos y exportación PDF |
| `PDFChecklistReport` | Documento PDF (`ReportDocument`) |
| `SwipeableItem` | Gesto de deslizar: derecha = eliminar, izquierda = editar |
| `ConfirmationModal`, `ToastContainer`, `AlertBadge`, `Loading`, `Error` | UI de apoyo |

### Endpoints NestJS

| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| POST | `/auth/login` | pública | Devuelve `access_token` y `user` |
| POST | `/auth/register` | pública | Crea usuario inactivo |
| POST | `/users` | **pública** | Crea usuario (duplica `/auth/register`) |
| GET | `/users` | JWT + admin | Lista usuarios |
| GET | `/users/:id` | JWT | Un usuario (entidad completa) |
| PATCH | `/users/:id` | JWT + admin | Edita usuario / activa / da admin |
| DELETE | `/users/:id` | JWT + admin | Desactiva usuario (borrado lógico) |
| GET | `/vehicles` | JWT | Vehículos activos |
| GET | `/vehicles/:id` | JWT | Un vehículo |
| POST | `/vehicles` | JWT + admin | Crea vehículo |
| PATCH | `/vehicles/:id` | JWT + admin | Edita vehículo |
| PATCH | `/vehicles/:id/reset-mantencion` | JWT + admin | `km_ultima_mantencion = kilometraje` |
| DELETE | `/vehicles/:id` | JWT + admin | Desactiva vehículo |
| POST | `/checklists` | JWT | Multipart: campo `data` (JSON) + hasta 30 `files` (5 MB c/u) |
| GET | `/checklists` | JWT | Admin: todos. Operador: los suyos. Incluye `images`, `vehicle`, `user` |
| GET | `/checklists/:id` | JWT | Uno (mismo filtro por dueño) |
| DELETE | `/checklists/:id` | JWT | Elimina checklist e imágenes (solo BD) |
| POST | `/error-logs` | **pública** | Guarda un error del cliente |
| GET | `/uploads/:archivo` | **pública** | Sirve la foto desde disco |

## 3. Mapeo de Variables

| Endpoint | Variables que usa el frontend | Dónde |
|---|---|---|
| `POST /auth/login` | `access_token` (o `token`), `user.id`, `user.name`, `user.email`, `user.is_admin` | `Login.tsx` |
| `POST /auth/register` | `message` (solo en error) | `Register.tsx` |
| `GET /vehicles` | `id`, `patente`, `model`, `kilometraje`, `km_ultima_mantencion`, `fecha_venc_revision_tecnica`, `fecha_venc_circulacion`, `fecha_prox_mantencion` | `VehicleList`, `VehicleCard`, `EditVehicleModal`, `ChecklistForm` |
| `POST/PATCH /vehicles` | Respuesta completa del vehículo para reemplazarlo en la lista | `VehicleList.tsx` |
| `GET /checklists` | `id`, `created_at`, `has_issues`, `kilometraje_actual`, `observaciones_generales`, `visual_checks{*}.label/isGood/observation`, `mechanical_checks{*}...`, `vehicle.patente`, `vehicle.model`, `user.name`, `images[].image_path`, `images[].description` | `ChecklistList`, `ChecklistDetail`, `PDFChecklistReport` |
| `POST /checklists` (envío) | `data` = `{ vehicle_id, kilometraje_actual, visual_checks, mechanical_checks, observaciones_generales, has_issues }` + `files[]` (`<item>.jpg`, `foto_frontal.jpg`, …) | `ChecklistForm.tsx` |
| Errores | `response.data.message` (string o array del `ValidationPipe`) | Todos los catch |

Forma de cada ítem de checklist guardado en `visual_checks` / `mechanical_checks`:

```json
{ "id": "frenos", "label": "Frenos", "isGood": false, "observation": "Pastillas gastadas", "hasPhoto": true }
```

## 4. Transformaciones y Formateo

| Qué | Dónde | Detalle |
|---|---|---|
| Rol del usuario | Frontend, `Login.tsx` | `is_admin` → `role: "admin" \| "operador"` |
| `has_issues` | Frontend, `ChecklistForm.tsx` | `true` si algún ítem tiene `isGood = false`. El backend lo guarda tal cual |
| Compresión de fotos | Frontend, `ChecklistForm.compressImage` | Redimensiona a máx. 1024 px de ancho (`alto = alto * 1024 / ancho`), JPEG calidad 0.6 |
| Captura | Frontend, `PhotoCaptureModal` | Frame de video a canvas → JPEG calidad 0.8 (resolución nativa de la cámara) |
| base64 → binario | Frontend, `dataURLtoBlob` | DataURL → `Blob` para el `FormData` |
| Limpieza del JSON | Frontend, `cleanChecks` | Quita `photo` (base64) y agrega `hasPhoto: boolean` |
| Días a vencimiento | Frontend, `VehicleCard.getDaysDiff` | `differenceInDays(fecha, hoy)`; ≤ 7 días = rojo, ≤ 30 = amarillo |
| Km para mantención | Frontend, `VehicleCard` y `EditVehicleModal` | `10000 − (kilometraje − km_ultima_mantencion)` |
| Alerta de mantención | Frontend, `VehicleCard.getMaintenanceAlert` | Rojo si ≥ 10 000, amarillo si ≥ 8 000 (ver bug B6 en el informe) |
| Números y fechas | Frontend | `toLocaleString()` para km; `date-fns format` `dd/MM/yyyy HH:mm` (detalle/PDF) y `dd/MM` (lista) |
| Campos vacíos del vehículo | Frontend, `EditVehicleModal` | Elimina `""`, `null`, `undefined` antes de enviar |
| URL de fotos | Frontend, `ChecklistDetail` / PDF | `${VITE_API_URL}/uploads/${image_path}` |
| Kilometraje del vehículo | Backend, `ChecklistsService.create` | Rechaza si `kilometraje_actual < vehicle.kilometraje`; si no, actualiza `vehicle.kilometraje` |
| Reset mantención | Backend, `VehiclesService.resetMantencion` | `km_ultima_mantencion = kilometraje` |
| Nombre de archivo | Backend, `diskStorage` | `files-<timestamp>-<random><ext original>` |
| Hash de contraseña | Backend, `UsersService` | bcrypt, 10 rondas |
| Formato de error | Backend, `HttpExceptionFilter` | `{ statusCode, timestamp, path, message }` |

No hay divisiones ni cálculos matemáticos en el backend; todos los cálculos de km, días y tamaño de imagen ocurren en el frontend.

## 5. Configuración

Backend (`api-checklist-vehiculos/.env`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `PORT`, `JWT_SECRET`.

Frontend: `VITE_API_URL` (opcional, por defecto el servidor de producción).

```bash
# Backend
cd api-checklist-vehiculos && npm install && npm run start:dev
# Frontend
cd checklist-vehiculos && npm install && npm run dev
```

Problemas conocidos y mejoras: ver [REVISION_BUGS_Y_MEJORAS.md](REVISION_BUGS_Y_MEJORAS.md).
