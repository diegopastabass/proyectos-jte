#!/bin/bash
# Script de prueba para api-reconocimiento
# Prueba el endpoint de reconocimiento de patentes con 5 imágenes

BASE_URL="https://app.jteanalytics.cl/vehicle-rekognition"
IMAGES_DIR="/home/diego/Documentos/proyectoEduardo/Proyectos/ReconocimientoVehiculos/imagenes prueba"
OUTPUT_FILE="/home/diego/Documentos/proyectoEduardo/Proyectos/ReconocimientoVehiculos/resultados_prueba.txt"

echo "============================================" > "$OUTPUT_FILE"
echo "  PRUEBAS API RECONOCIMIENTO DE PATENTES" >> "$OUTPUT_FILE"
echo "  Fecha: $(date)" >> "$OUTPUT_FILE"
echo "============================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Step 1: Login
echo "[1/3] Iniciando sesión..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "test1234"}')

echo "=== LOGIN ===" >> "$OUTPUT_FILE"
echo "Response: $LOGIN_RESPONSE" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: No se pudo obtener el token" | tee -a "$OUTPUT_FILE"
  exit 1
fi

echo "Token obtenido exitosamente." 
echo "Token: ${TOKEN:0:50}..." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Step 2: Test each image
echo "[2/3] Probando imágenes con endpoint detect-base64..."
echo "=== PRUEBAS DE RECONOCIMIENTO ===" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for img in "$IMAGES_DIR"/*.jpg; do
  filename=$(basename "$img")
  filesize=$(stat -c%s "$img")
  
  echo "  Procesando: $filename ($filesize bytes)..."
  
  # Convert to base64
  IMG_B64=$(base64 -w0 "$img")
  printf '{"image":"%s"}' "$IMG_B64" > /tmp/req_body.json
  
  # Send request
  RESPONSE=$(curl -s -X POST "$BASE_URL/recognition/detect-base64" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @/tmp/req_body.json)
  
  echo "--- Imagen: $filename ($filesize bytes) ---" >> "$OUTPUT_FILE"
  echo "Response: $RESPONSE" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  
  echo "    -> $RESPONSE"
done

# Step 3: Summary
echo "" >> "$OUTPUT_FILE"
echo "============================================" >> "$OUTPUT_FILE"
echo "  PRUEBAS FINALIZADAS: $(date)" >> "$OUTPUT_FILE"
echo "============================================" >> "$OUTPUT_FILE"

echo ""
echo "[3/3] Pruebas finalizadas. Resultados guardados en:"
echo "  $OUTPUT_FILE"
