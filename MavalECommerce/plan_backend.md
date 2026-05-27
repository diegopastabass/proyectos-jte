# Plan de Acción — Backend MavalECommerce (NestJS)

## Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **NestJS** | Framework principal del backend |
| **TypeORM** | ORM para mapeo de entidades y migraciones |
| **PostgreSQL** | Base de datos relacional |
| **JWT (Access + Refresh)** | Autenticación y autorización |
| **Multer** | Subida de imágenes (integrado con NestJS) |
| **class-validator / class-transformer** | Validación de DTOs |
| **bcrypt** | Hashing de contraseñas |
| **uuid** | Claves primarias (generadas por TypeORM/PostgreSQL) |

---

## Estructura del Proyecto

```
backend/
├── src/
│   ├── main.ts                         # Bootstrap de la aplicación
│   ├── app.module.ts                    # Módulo raíz
│   │
│   ├── config/                          # Configuración centralizada
│   │   ├── database.config.ts           # Conexión TypeORM a PostgreSQL
│   │   ├── jwt.config.ts                # Secretos y tiempos de expiración JWT
│   │   └── upload.config.ts             # Configuración de Multer (destino, límites)
│   │
│   ├── common/                          # Utilidades compartidas
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts       # @Roles('admin')
│   │   │   └── current-user.decorator.ts # @CurrentUser() para extraer el usuario del token
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # Guard que valida el access token
│   │   │   └── roles.guard.ts           # Guard que valida el rol del usuario
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts # Interceptor para formatear respuestas
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Filtro global de excepciones
│   │   ├── dto/
│   │   │   └── pagination.dto.ts        # DTO reutilizable para paginación
│   │   └── utils/
│   │       └── slug.util.ts             # Generación de slugs desde títulos
│   │
│   ├── auth/                            # Módulo de Autenticación
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts           # Endpoints: login, register, refresh, logout
│   │   ├── auth.service.ts              # Lógica de autenticación
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts          # Estrategia Passport JWT
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── register.dto.ts
│   │       └── refresh-token.dto.ts
│   │
│   ├── users/                           # Módulo de Usuarios (Administradores)
│   │   ├── users.module.ts
│   │   ├── users.controller.ts          # CRUD de usuarios (solo admin)
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts           # Entidad TypeORM → tabla 'users'
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── categories/                      # Módulo de Categorías
│   │   ├── categories.module.ts
│   │   ├── categories.controller.ts     # CRUD + listado jerárquico
│   │   ├── categories.service.ts
│   │   ├── entities/
│   │   │   └── category.entity.ts       # Entidad TypeORM → tabla 'categories'
│   │   └── dto/
│   │       ├── create-category.dto.ts
│   │       └── update-category.dto.ts
│   │
│   ├── publications/                    # Módulo de Publicaciones (Productos)
│   │   ├── publications.module.ts
│   │   ├── publications.controller.ts   # CRUD + búsqueda + filtros + upload imágenes
│   │   ├── publications.service.ts
│   │   ├── entities/
│   │   │   └── publication.entity.ts    # Entidad TypeORM → tabla 'publications'
│   │   └── dto/
│   │       ├── create-publication.dto.ts
│   │       ├── update-publication.dto.ts
│   │       └── query-publication.dto.ts # Filtros: categoría, precio, búsqueda, paginación
│   │
│   ├── tags/                            # Módulo de Etiquetas
│   │   ├── tags.module.ts
│   │   ├── tags.controller.ts           # CRUD de tags
│   │   ├── tags.service.ts
│   │   ├── entities/
│   │   │   └── tag.entity.ts            # Entidad TypeORM → tabla 'tags'
│   │   └── dto/
│   │       ├── create-tag.dto.ts
│   │       └── update-tag.dto.ts
│   │
│   ├── customers/                       # Módulo de Clientes
│   │   ├── customers.module.ts
│   │   ├── customers.controller.ts      # Creación al hacer pedido + consulta (admin)
│   │   ├── customers.service.ts
│   │   ├── entities/
│   │   │   └── customer.entity.ts       # Entidad TypeORM → tabla 'customers'
│   │   └── dto/
│   │       ├── create-customer.dto.ts
│   │       └── update-customer.dto.ts
│   │
│   ├── orders/                          # Módulo de Pedidos
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts         # Crear pedido (público) + gestión (admin)
│   │   ├── orders.service.ts
│   │   ├── entities/
│   │   │   ├── order.entity.ts          # Entidad TypeORM → tabla 'orders'
│   │   │   ├── order-item.entity.ts     # Entidad TypeORM → tabla 'order_items'
│   │   │   └── order-status-history.entity.ts
│   │   └── dto/
│   │       ├── create-order.dto.ts      # Incluye datos del cliente + items
│   │       ├── update-order-status.dto.ts
│   │       └── query-order.dto.ts
│   │
│   ├── uploads/                         # Módulo de Subida de Archivos
│   │   ├── uploads.module.ts
│   │   ├── uploads.controller.ts        # Endpoint para subir/eliminar imágenes
│   │   └── uploads.service.ts           # Gestión del filesystem (guardar, eliminar)
│   │
│   └── settings/                        # Módulo de Configuración del Sitio
│       ├── settings.module.ts
│       ├── settings.controller.ts       # Leer (público) / Actualizar (admin)
│       ├── settings.service.ts
│       └── entities/
│           └── site-setting.entity.ts   # Entidad TypeORM → tabla 'site_settings'
│
├── uploads/                             # Directorio donde se guardan las imágenes subidas
│   └── products/
│
├── .env                                 # Variables de entorno
├── .env.example                         # Plantilla de variables de entorno
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── README.md
```

---

## Fases de Desarrollo

### Fase 1 — Inicialización del Proyecto

**Objetivo:** Tener el proyecto NestJS corriendo y conectado a PostgreSQL.

1. Crear el proyecto NestJS dentro de `backend/`:
   ```bash
   npx -y @nestjs/cli new backend --package-manager npm --skip-git
   ```
2. Instalar dependencias principales:
   ```bash
   npm install @nestjs/typeorm typeorm pg
   npm install @nestjs/config
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt
   npm install bcrypt class-validator class-transformer
   npm install @nestjs/platform-express multer
   npm install uuid
   npm install -D @types/passport-jwt @types/bcrypt @types/multer
   ```
3. Crear archivo `.env` con las variables:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=***
   DB_NAME=maval_ecommerce

   JWT_SECRET=clave_secreta_segura
   JWT_EXPIRATION=15m
   JWT_REFRESH_SECRET=clave_refresh_segura
   JWT_REFRESH_EXPIRATION=7d

   UPLOAD_DEST=./uploads
   MAX_FILE_SIZE=5242880
   PORT=3000
   ```
4. Configurar `database.config.ts` con TypeORM apuntando a PostgreSQL usando las variables de `.env`.
5. Configurar `app.module.ts` con `ConfigModule.forRoot()` y `TypeOrmModule.forRootAsync()`.
6. Verificar que la aplicación inicia y se conecta a la base de datos correctamente.

**Entregable:** Proyecto corriendo con `npm run start:dev`, conectado a PostgreSQL.

---

### Fase 2 — Entidades TypeORM

**Objetivo:** Mapear todas las tablas del `database_schema.sql` a entidades TypeORM.

Crear las siguientes entidades, una por tabla:

| Entidad | Tabla | Relaciones clave |
|---|---|---|
| `User` | `users` | Tiene muchas `Publication`, muchos `RefreshToken` |
| `RefreshToken` | `refresh_tokens` | Pertenece a `User` |
| `Category` | `categories` | Auto-referencia `parent` ↔ `children`, tiene muchas `Publication` |
| `Publication` | `publications` | Pertenece a `User` y `Category`, ManyToMany con `Tag` |
| `Tag` | `tags` | ManyToMany con `Publication` (tabla intermedia `publication_tags`) |
| `Customer` | `customers` | Tiene muchas `Order`, relación opcional con `User` |
| `Order` | `orders` | Pertenece a `Customer`, tiene muchos `OrderItem` y `OrderStatusHistory` |
| `OrderItem` | `order_items` | Pertenece a `Order`, referencia opcional a `Publication` |
| `OrderStatusHistory` | `order_status_history` | Pertenece a `Order`, referencia opcional a `User` |
| `SiteSetting` | `site_settings` | Independiente |

**Consideraciones:**
- Usar `@PrimaryGeneratedColumn('uuid')` en todas las entidades.
- Usar `@CreateDateColumn()` y `@UpdateDateColumn()` para timestamps.
- El campo `images` en `Publication` se mapea como `jsonb` con `@Column({ type: 'jsonb', default: [] })`.
- El campo `metadata` en `Publication` se mapea como `jsonb` con `@Column({ type: 'jsonb', default: {} })`.
- El enum `user_role` se mapea con `@Column({ type: 'enum', enum: UserRole })`.
- El enum `order_status` se mapea con `@Column({ type: 'enum', enum: OrderStatus })`.
- La relación ManyToMany entre `Publication` y `Tag` usa `@JoinTable({ name: 'publication_tags' })`.
- La auto-referencia en `Category` usa `@ManyToOne(() => Category)` y `@OneToMany(() => Category, c => c.parent)`.

**Entregable:** Todas las entidades creadas. Al iniciar la app, TypeORM las reconoce sin errores (usando `synchronize: false` ya que las tablas se crean con el SQL).

---

### Fase 3 — Autenticación (Auth Module)

**Objetivo:** Registro de administradores, login con JWT, refresh token y logout.

#### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | Público* | Registrar un nuevo administrador |
| `POST` | `/api/auth/login` | Público | Iniciar sesión, retorna access + refresh token |
| `POST` | `/api/auth/refresh` | Público | Renovar access token usando el refresh token |
| `POST` | `/api/auth/logout` | Autenticado | Revocar el refresh token activo |
| `GET` | `/api/auth/profile` | Autenticado | Obtener datos del usuario autenticado |

> *\*El registro puede protegerse después para que solo un admin existente pueda crear nuevos admins.*

#### Lógica principal
1. **Register:** Validar datos → hashear contraseña con bcrypt → crear usuario con rol `admin` → retornar tokens.
2. **Login:** Buscar por email → comparar contraseña con bcrypt → generar access token (15min) + refresh token (7d) → guardar hash del refresh token en `refresh_tokens` → retornar ambos tokens.
3. **Refresh:** Validar refresh token → verificar que no esté revocado ni expirado → generar nuevo par de tokens → revocar el anterior (rotación de tokens).
4. **Logout:** Revocar el refresh token del usuario.
5. **JWT Strategy:** Extraer `sub` (user id) y `role` del payload del token. El guard `JwtAuthGuard` lo valida automáticamente.

#### Guards y Decoradores
- `@UseGuards(JwtAuthGuard)` — Protege rutas que requieren autenticación.
- `@UseGuards(RolesGuard)` + `@Roles('admin')` — Protege rutas que requieren rol admin.
- `@CurrentUser()` — Decorador que extrae el usuario del request.

**Entregable:** Login y registro funcionales. Se puede obtener y refrescar tokens. Las rutas protegidas rechazan peticiones sin token válido.

---

### Fase 4 — Módulo de Categorías

**Objetivo:** CRUD completo de categorías jerárquicas.

#### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/categories` | Público | Listar categorías activas (con estructura jerárquica) |
| `GET` | `/api/categories/:slug` | Público | Obtener una categoría por su slug |
| `POST` | `/api/categories` | Admin | Crear categoría |
| `PATCH` | `/api/categories/:id` | Admin | Actualizar categoría |
| `DELETE` | `/api/categories/:id` | Admin | Eliminar categoría (soft: desactivar) |

#### Lógica principal
- El slug se genera automáticamente desde el `name` al crear.
- El listado público retorna un árbol jerárquico usando `parent_id`.
- Solo se listan categorías con `is_active = true` en endpoints públicos.
- Los endpoints admin permiten ver todas, incluyendo las inactivas.

**Entregable:** CRUD funcional. El listado público retorna las categorías como árbol.

---

### Fase 5 — Módulo de Publicaciones (Productos) + Uploads

**Objetivo:** CRUD de productos con subida y gestión de imágenes.

#### Endpoints de Publicaciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/publications` | Público | Listar productos con filtros, búsqueda y paginación |
| `GET` | `/api/publications/featured` | Público | Listar productos destacados |
| `GET` | `/api/publications/:slug` | Público | Obtener un producto por slug |
| `POST` | `/api/publications` | Admin | Crear publicación |
| `PATCH` | `/api/publications/:id` | Admin | Actualizar título, descripción, precio, etc. |
| `DELETE` | `/api/publications/:id` | Admin | Eliminar publicación (soft: desactivar) |

#### Endpoints de Imágenes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/publications/:id/images` | Admin | Subir imágenes (multipart/form-data) |
| `PATCH` | `/api/publications/:id/images/reorder` | Admin | Reordenar imágenes |
| `DELETE` | `/api/publications/:id/images/:index` | Admin | Eliminar una imagen específica |

#### Lógica principal
- **Filtros del listado:** por `category_id`, rango de `price`, búsqueda por texto en `title`/`description`, por `tag`, por `is_featured`.
- **Paginación:** `page` y `limit` con valores por defecto (page=1, limit=12).
- **Subida de imágenes:** Multer guarda los archivos en `uploads/products/` con nombres únicos (UUID). Las rutas se agregan al array JSONB `images` de la publicación.
- **Eliminación de imágenes:** Se borra el archivo del filesystem y se remueve la entrada del array JSONB.
- **Slug:** Se genera automáticamente desde el `title`.
- **Servir archivos estáticos:** Configurar NestJS para servir la carpeta `uploads/` como archivos estáticos bajo la ruta `/uploads/`.

**Entregable:** CRUD de publicaciones funcional. Se pueden subir, reordenar y eliminar imágenes. El catálogo soporta filtros y paginación.

---

### Fase 6 — Módulo de Etiquetas (Tags)

**Objetivo:** CRUD de etiquetas y asignación a publicaciones.

#### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/tags` | Público | Listar todas las etiquetas |
| `POST` | `/api/tags` | Admin | Crear etiqueta |
| `PATCH` | `/api/tags/:id` | Admin | Actualizar etiqueta |
| `DELETE` | `/api/tags/:id` | Admin | Eliminar etiqueta |

- La asignación de tags a publicaciones se maneja desde el endpoint `PATCH /api/publications/:id` enviando un array de `tagIds`.

**Entregable:** CRUD de tags funcional. Se pueden asignar/desasignar tags a productos.

---

### Fase 7 — Módulo de Pedidos y Clientes

**Objetivo:** Permitir que clientes anónimos creen pedidos, y que el admin los gestione.

#### Endpoints Públicos (Sin autenticación)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/orders` | Público | Crear un pedido (incluye datos del cliente + items) |

El body del `POST /api/orders` tiene esta estructura:
```json
{
  "customer": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@email.com",
    "phone": "+56912345678",
    "address": "Calle Ejemplo 123",
    "city": "Santiago",
    "region": "Metropolitana"
  },
  "items": [
    { "publicationId": "uuid-del-producto", "quantity": 2 },
    { "publicationId": "uuid-del-producto-2", "quantity": 1 }
  ],
  "customerNotes": "Necesito factura"
}
```

**Lógica al crear pedido:**
1. Buscar o crear el `Customer` por email.
2. Validar que todas las `publicationId` existan y estén activas.
3. Capturar el `title` y `price` actual de cada publicación como snapshot.
4. Calcular `subtotal` y `total`.
5. Crear la `Order` con sus `OrderItem`.
6. Registrar el estado inicial `pending` en `order_status_history`.

#### Endpoints Admin (Requieren autenticación)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/admin/orders` | Admin | Listar pedidos con filtros (estado, fecha, cliente) |
| `GET` | `/api/admin/orders/:id` | Admin | Ver detalle de un pedido |
| `PATCH` | `/api/admin/orders/:id/status` | Admin | Cambiar estado del pedido |
| `PATCH` | `/api/admin/orders/:id` | Admin | Actualizar notas admin del pedido |
| `GET` | `/api/admin/customers` | Admin | Listar clientes con búsqueda |
| `GET` | `/api/admin/customers/:id` | Admin | Ver detalle de un cliente con su historial de pedidos |

**Lógica al cambiar estado:**
1. Validar que la transición de estado sea válida (ej: no pasar de `completed` a `pending`).
2. Actualizar el campo `status` en la orden.
3. Registrar el cambio en `order_status_history` con el `changed_by` (admin que hizo el cambio) y una `note` opcional.

**Entregable:** Los clientes pueden enviar pedidos sin autenticación. El admin puede ver, filtrar y gestionar pedidos desde el panel.

---

### Fase 8 — Módulo de Configuración del Sitio + Pulido Final

**Objetivo:** Endpoint de configuración del sitio y ajustes finales.

#### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/settings` | Público | Obtener todas las configuraciones del sitio |
| `GET` | `/api/settings/:key` | Público | Obtener una configuración específica |
| `PATCH` | `/api/settings/:key` | Admin | Actualizar una configuración |

#### Pulido Final
1. **CORS:** Configurar `enableCors()` en `main.ts` para permitir peticiones del frontend.
2. **Validación Global:** Configurar `ValidationPipe` global con `whitelist: true` y `transform: true`.
3. **Prefijo Global:** Configurar `setGlobalPrefix('api')` para que todas las rutas comiencen con `/api/`.
4. **Filtro de Excepciones:** Implementar filtro global para respuestas de error estandarizadas.
5. **Interceptor de Respuesta:** Formatear todas las respuestas exitosas con estructura `{ data, message, statusCode }`.
6. **Swagger (Opcional):** Agregar `@nestjs/swagger` para documentación automática de la API.
7. **Rate Limiting (Opcional):** Agregar `@nestjs/throttler` para prevenir abuso en endpoints públicos.

**Entregable:** API completa, pulida y lista para conectar con el frontend.

---

## Resumen del Orden de Ejecución

| # | Fase | Dependencias |
|---|---|---|
| 1 | Inicialización del proyecto | Ninguna |
| 2 | Entidades TypeORM | Fase 1 |
| 3 | Autenticación (Auth) | Fases 1-2 |
| 4 | Categorías | Fases 1-3 |
| 5 | Publicaciones + Uploads | Fases 1-4 |
| 6 | Etiquetas (Tags) | Fases 1-5 |
| 7 | Pedidos y Clientes | Fases 1-6 |
| 8 | Configuración + Pulido | Fases 1-7 |
