# 2026-06-25

## Gonzalez:

Cambio de nombre de key para almacenar la caché en el frontend, solución de problemas datos faltantes backend.

## Carmen:

Optimizaciones para la velocidad de carga de la página.

## Compañía:

Cálculo de Horómetro en base a la actividad de la bomba.

## Viveros: 

Se agrega cálculo de VPD, falta agregar reportes semanales.


# 2026-05-26

## MavalECommerce:

- Inicialización del servicio backend NestJS (`api-maval-ecommerce`) con persistencia en PostgreSQL mediante TypeORM.
- Implementación de autenticación con JWT clásico (Access Tokens y Refresh Tokens con rotación).
- Módulo de publicaciones/productos con soporte para almacenamiento local de imágenes (guardando rutas relativas en formato JSONB).
- Módulo de categorías jerárquicas y etiquetas para estructurar el catálogo.
- Flujo de pedidos (Orders) y clientes (Customers) público (sin requerir inicio de sesión), con gestión de estados (pending, contacted, confirmed, in_progress, completed, cancelled) e historial de cambios para el administrador.
- Filtros globales de excepción e interceptores de respuesta estandarizados.
