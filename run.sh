#!/bin/bash
set -e

# Asegurar rutas de Python, Homebrew y XAMPP
export PATH="/Applications/XAMPP/xamppfiles/bin:/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "    Iniciando GeoVacantes - Movilidad Docente             "
echo "=========================================================="

if [ ! -d "venv" ]; then
    echo "Creando entorno virtual Python..."
    python3 -m venv venv
    venv/bin/pip install -r backend/requirements.txt
fi

# Cargar variables de entorno locales desde .env si existe
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "Verificando base de datos MySQL..."
venv/bin/python3 -c "import sys; sys.path.insert(0, '.'); from backend.database import init_db; init_db()"

echo ""
echo "🚀 Servidor iniciado en http://localhost:${PORT}"
echo "👉 Abre http://localhost:${PORT} en tu navegador"
echo "=========================================================="

exec venv/bin/uvicorn backend.app:app --host "$HOST" --port "$PORT" --reload

