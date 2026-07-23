# 2026-06-01

## Mantenimiento:

- **Nuevos Formularios Preventivos**: Se implementaron dos nuevos tipos de reportes: "Mantención Preventiva de Sala de Bombas" y "Mantención Preventiva de Tablero Eléctrico", basados en las listas de chequeo de referencia.
- **Ocultamiento de Secciones Irrelevantes**: Para los nuevos tipos preventivos se ocultan las secciones estándar ("Diagnóstico", "Desarrollo", "Solución Técnica" y "Repuestos/Materiales"), dejando un flujo adaptado a listas de verificación.
- **Gestión de Checklists**: Creación de flujos interactivos en el frontend para responder a cada ítem con los estados `Realizado`, `No Realizado` o `N/A`, soportando el registro fotográfico y observaciones generales.
- **Flujo de Firma Simplificado**: Para los formularios preventivos, se deshabilitó el proceso de verificación/firma del cliente y entrega de documentos. Solo se requiere la firma del técnico, quien actúa como "Operador".
- **PDFs Dinámicos con Tablas de Checklists**: Se adaptó `PDFReport.tsx` para generar de forma dinámica tablas separadas por secciones para las listas de chequeo, mostrando cada tarea y su estado respectivo, y omitiendo las secciones estándar. Además, en los PDF de estos formularios se oculta el recuadro de firma del cliente y se centra la firma del operador.
- **Compatibilidad de Backend sin Migración**: Se estructuraron los datos bajo campos opcionales dentro de la propiedad `data` (guardada como JSONB en PostgreSQL), permitiendo guardar y recuperar los nuevos formularios sin necesidad de alterar el backend NestJS.

# 2026-05-25

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
