#!/usr/bin/env bash
# Verifica un despliegue de api-conciliacion con una sesión real, SOLO LECTURA (no modifica nada).
#
#   bash scripts/verificar-despliegue.sh [URL]      # por defecto https://app.jteanalytics.cl/conciliacion
#
# Pide email y contraseña por consola (la contraseña no se muestra ni queda en el historial).
set -uo pipefail

BASE="${1:-https://app.jteanalytics.cl/conciliacion}"
read -rp "Email: " EMAIL
read -rsp "Contraseña: " PASS
echo

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=new Function("r","return "+process.argv[1])(JSON.parse(s));console.log(v??"")}catch{console.log("")}})' "$1"; }

LOGIN=$(curl -s --max-time 15 "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "$(EMAIL="$EMAIL" PASS="$PASS" node -e 'console.log(JSON.stringify({email:process.env.EMAIL,password:process.env.PASS}))')")
unset PASS
TOKEN=$(echo "$LOGIN" | json 'r.access_token')
if [ -z "$TOKEN" ]; then
  echo "✗ Login falló: $(echo "$LOGIN" | json 'JSON.stringify(r.message)')"
  exit 1
fi
echo "✓ Login como $(echo "$LOGIN" | json 'r.usuario.nombre')"

H="Authorization: Bearer $TOKEN"
fallas=0
probar() { # probar <ruta> <descripción>
  local cuerpo codigo
  cuerpo=$(curl -s --max-time 30 -w $'\n%{http_code}' "$BASE$1" -H "$H")
  codigo=${cuerpo##*$'\n'}
  cuerpo=${cuerpo%$'\n'*}
  if [ "$codigo" = "200" ]; then printf "✓ %-3s %-45s %s\n" "$codigo" "$1" "$2"; else printf "✗ %-3s %-45s %s\n" "$codigo" "$1" "$cuerpo"; fallas=$((fallas+1)); fi
  ULTIMO="$cuerpo"
}

probar /empresas "empresas visibles"
EMPRESA=$(echo "$ULTIMO" | json 'r[0]?.id')
if [ -z "$EMPRESA" ]; then echo "  (sin empresas: créela desde el front)"; exit $fallas; fi
E="/empresas/$EMPRESA"
probar "$E/resumen" "$(echo "$ULTIMO" | json 'r[0].razonSocial')"
probar "$E/cuentas" ""
probar "$E/categorias" ""
probar "$E/contrapartes" ""
probar "$E/importaciones" ""
probar "$E/reglas" ""
probar "$E/sugerencias?porPagina=1" ""
probar "$E/documentos?porPagina=1&conSaldo=true" ""
probar "$E/movimientos?porPagina=1&porConciliar=true" ""
MOV=$(echo "$ULTIMO" | json 'r.items[0]?.id')
if [ -n "$MOV" ]; then
  probar "$E/movimientos/$MOV" "detalle"
  probar "$E/movimientos/$MOV/candidatos" "candidatos para conciliar a mano"
fi
probar "$E/usuarios" "(requiere rol admin en la empresa)"

echo
[ $fallas -eq 0 ] && echo "Todo OK." || echo "$fallas endpoint(s) con problemas."
exit $fallas
