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

echo "Verificando base de datos MySQL (XAMPP)..."
venv/bin/python3 -c "import sys; sys.path.insert(0, '.'); from backend.database import init_db; init_db()"

echo ""
echo "🚀 Servidor iniciado en http://localhost:8000"
echo "👉 Abre http://localhost:8000 en tu navegador"
echo "=========================================================="

exec venv/bin/uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
