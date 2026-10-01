import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# MySQL / MariaDB (XAMPP default configuration)
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "movilidad_docente")

# Routing API Defaults (Carlos Aguilar OSRM endpoint)
ROUTING_API_URL = os.getenv("ROUTING_API_URL", "https://rutas.carlosaguilar.mx")
ROUTING_API_KEY = os.getenv("ROUTING_API_KEY", "")

# Admin credentials
ADMIN_USER = os.getenv("ADMIN_USER", "ing.caf.23@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "SubCharly2026")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "super-secret-docente-token-2026")

