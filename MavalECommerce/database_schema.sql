-- ============================================================================
-- MavalECommerce - Database Schema
-- PostgreSQL
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USUARIOS (Administradores y futuros roles)
-- ============================================================================
-- Tabla base de usuarios con soporte para múltiples roles.
-- Actualmente solo se usa el rol 'admin', pero permite escalar
-- a roles como 'customer', 'moderator', etc.

CREATE TYPE user_role AS ENUM ('admin', 'customer');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(30),
    role            user_role NOT NULL DEFAULT 'customer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- ============================================================================
-- 2. CATEGORÍAS (Jerárquicas - soporte para subcategorías)
-- ============================================================================
-- Estructura de categorías con auto-referencia para crear jerarquías.
-- Ejemplo: PID > Sensores > Accesorios, etc.

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(170) NOT NULL UNIQUE,
    description     TEXT,
    parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url       VARCHAR(500),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories (slug);
CREATE INDEX idx_categories_parent ON categories (parent_id);

-- ============================================================================
-- 3. PUBLICACIONES (Productos del catálogo)
-- ============================================================================
-- Cada publicación es un producto visible en el catálogo.
-- Las imágenes se almacenan como JSONB con las rutas a los archivos
-- en el directorio 'uploads/' del backend.
--
-- Formato esperado del campo 'images':
-- [
--   { "url": "/uploads/products/abc123.jpg", "alt": "Descripción", "order": 1 },
--   { "url": "/uploads/products/def456.jpg", "alt": "Vista lateral", "order": 2 }
-- ]

CREATE TABLE publications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(320) NOT NULL UNIQUE,
    description     TEXT,
    short_description VARCHAR(500),
    price           DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    compare_price   DECIMAL(12, 2) CHECK (compare_price IS NULL OR compare_price >= 0),
    images          JSONB NOT NULL DEFAULT '[]'::JSONB,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publications_slug ON publications (slug);
CREATE INDEX idx_publications_category ON publications (category_id);
CREATE INDEX idx_publications_user ON publications (user_id);
CREATE INDEX idx_publications_active ON publications (is_active);
CREATE INDEX idx_publications_featured ON publications (is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_publications_price ON publications (price);
CREATE INDEX idx_publications_created ON publications (created_at DESC);

-- Índice GIN para búsquedas eficientes sobre el campo JSONB de imágenes
CREATE INDEX idx_publications_images ON publications USING GIN (images);
-- Índice GIN para búsquedas full-text sobre título y descripción
CREATE INDEX idx_publications_search ON publications USING GIN (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- ============================================================================
-- 4. ETIQUETAS (Tags para clasificación flexible)
-- ============================================================================
-- Sistema de etiquetas independiente de las categorías.
-- Permite clasificación transversal: "oferta", "nuevo", "popular", etc.

CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    color           VARCHAR(7),  -- Código hex para UI, ej: #FF5733
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags (slug);

-- Tabla intermedia: relación muchos-a-muchos entre publicaciones y etiquetas
CREATE TABLE publication_tags (
    publication_id  UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, tag_id)
);

CREATE INDEX idx_publication_tags_tag ON publication_tags (tag_id);

-- ============================================================================
-- 5. CLIENTES (Personas que realizan pedidos)
-- ============================================================================
-- Información de los clientes que realizan pedidos.
-- Como los clientes no necesitan crearse una cuenta ni loggearse,
-- esta tabla almacena los datos de contacto que ingresan al momento de realizar 
-- un pedido (nombre, correo, teléfono, etc.). La relación con la tabla 'users' 
-- es opcional (NULL por defecto) por si en el futuro se implementa registro de clientes.

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    address         VARCHAR(500),
    city            VARCHAR(150),
    region          VARCHAR(150),
    postal_code     VARCHAR(20),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers (email);
CREATE INDEX idx_customers_user ON customers (user_id);

-- ============================================================================
-- 6. PEDIDOS (Orders)
-- ============================================================================
-- Registro de pedidos realizados por los clientes.
-- El administrador gestiona estos pedidos contactando directamente al cliente.

CREATE TYPE order_status AS ENUM (
    'pending',      -- Pedido recibido, sin gestionar
    'contacted',    -- Admin se ha puesto en contacto con el cliente
    'confirmed',    -- Pedido confirmado por ambas partes
    'in_progress',  -- Pedido en preparación/proceso
    'completed',    -- Pedido entregado/finalizado
    'cancelled'     -- Pedido cancelado
);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number    SERIAL UNIQUE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status          order_status NOT NULL DEFAULT 'pending',
    subtotal        DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    total           DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    admin_notes     TEXT,
    customer_notes  TEXT,
    contact_info    JSONB DEFAULT '{}'::JSONB,  -- Info de contacto al momento del pedido
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created ON orders (created_at DESC);
CREATE INDEX idx_orders_number ON orders (order_number);

-- ============================================================================
-- 7. DETALLE DE PEDIDOS (Order Items)
-- ============================================================================
-- Cada línea de un pedido, vinculada a una publicación.
-- Se guarda el precio unitario al momento de la compra para mantener
-- el historial aunque el precio del producto cambie después.

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    publication_id  UUID REFERENCES publications(id) ON DELETE SET NULL,
    product_title   VARCHAR(300) NOT NULL,  -- Snapshot del título al momento del pedido
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price      DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_price     DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_publication ON order_items (publication_id);

-- ============================================================================
-- 8. HISTORIAL DE ESTADOS DE PEDIDOS
-- ============================================================================
-- Registro de cada cambio de estado en un pedido para auditoría.

CREATE TABLE order_status_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status      order_status NOT NULL,
    changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_order ON order_status_history (order_id);

-- ============================================================================
-- 9. CONFIGURACIÓN DEL SITIO (Key-Value)
-- ============================================================================
-- Almacén flexible de configuraciones del sitio.
-- Ejemplos: nombre de la tienda, logo, colores, teléfono de contacto,
-- redes sociales, textos legales, etc.

CREATE TABLE site_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL DEFAULT '{}'::JSONB,
    description     VARCHAR(500),
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. REFRESH TOKENS (Para autenticación JWT)
-- ============================================================================
-- Almacena refresh tokens para el sistema de autenticación.

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ============================================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at en cada tabla relevante
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_publications_updated_at
    BEFORE UPDATE ON publications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DATOS INICIALES (Seeds)
-- ============================================================================

-- Insertar configuraciones iniciales del sitio
INSERT INTO site_settings (key, value, description) VALUES
    ('store_name', '"Maval"'::JSONB, 'Nombre de la tienda'),
    ('store_description', '"Catálogo de productos Maval"'::JSONB, 'Descripción de la tienda'),
    ('contact_email', '""'::JSONB, 'Email de contacto principal'),
    ('contact_phone', '""'::JSONB, 'Teléfono de contacto principal'),
    ('social_media', '{"instagram": "", "facebook": "", "whatsapp": ""}'::JSONB, 'Redes sociales'),
    ('currency', '"CLP"'::JSONB, 'Moneda predeterminada'),
    ('items_per_page', '12'::JSONB, 'Cantidad de productos por página');
