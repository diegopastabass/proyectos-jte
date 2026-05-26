#!/usr/bin/env bash

# Exit on error
set -e

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}=== Git Release Notes Auto-Commit ===${NC}\n"

# Verify that we are in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}Error: Este directorio no es un repositorio de Git.${NC}"
    exit 1
fi

RELEASENOTES="RELEASENOTES.md"

if [ ! -f "$RELEASENOTES" ]; then
    echo -e "${RED}Error: No se encontró el archivo $RELEASENOTES en el directorio actual.${NC}"
    exit 1
fi

# Extract added lines from RELEASENOTES.md relative to HEAD
echo -e "${BLUE}Analizando cambios en $RELEASENOTES...${NC}"

# Extract added lines, strip leading '+', and clean up whitespace/newlines using python3
COMMIT_MSG=$(git diff HEAD -- "$RELEASENOTES" | grep -E '^\+' | grep -v '^+++' | cut -c 2- | python3 -c "import sys; print(sys.stdin.read().strip())" 2>/dev/null || true)

if [ -z "$COMMIT_MSG" ]; then
    echo -e "${YELLOW}Advertencia: No se encontraron nuevas entradas en $RELEASENOTES.${NC}"
    read -p "Deseas ingresar un mensaje de commit manual? (s/N): " MANUAL_INPUT
    if [[ "$MANUAL_INPUT" =~ ^[sS]$ ]]; then
        read -p "Mensaje de commit: " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            echo -e "${RED}Commit cancelado. Mensaje vacío.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Cancelado por el usuario.${NC}"
        exit 0
    fi
fi

echo -e "\n${GREEN}${BOLD}Mensaje de commit detectado:${NC}"
echo -e "----------------------------------------"
echo -e "$COMMIT_MSG"
echo -e "----------------------------------------"

# Show modified files
echo -e "\n${BLUE}${BOLD}Archivos modificados detectados:${NC}"
git status -s

echo -e ""
read -p "Confirmas realizar el commit con este mensaje? (S/n): " CONFIRM
CONFIRM=${CONFIRM:-S}

if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo -e "${RED}Commit cancelado por el usuario.${NC}"
    exit 0
fi

# Stage changes
echo -e "\n${BLUE}Agregando cambios al commit...${NC}"
git add -A

# Commit
echo -e "${BLUE}Realizando commit...${NC}"
git commit -m "$COMMIT_MSG"
echo -e "${GREEN}¡Commit realizado con éxito!${NC}"

# Ask for push
read -p "Deseas subir los cambios a GitHub (git push)? (S/n): " PUSH_CONFIRM
PUSH_CONFIRM=${PUSH_CONFIRM:-S}

if [[ "$PUSH_CONFIRM" =~ ^[sS]$ ]]; then
    echo -e "${BLUE}Subiendo cambios (git push)...${NC}"
    git push
    echo -e "${GREEN}¡Cambios subidos a GitHub con éxito!${NC}"
else
    echo -e "${YELLOW}Push omitido.${NC}"
fi
