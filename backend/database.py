import pymysql
import pymysql.cursors
from math import radians, cos, sin, asin, sqrt
from backend.config import (
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
    ROUTING_API_KEY, ROUTING_API_URL
)

def get_root_connection():
    """Conexión al servidor MySQL sin especificar base de datos para crear la DB si no existe."""
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def get_db_connection():
    """Conexión a la base de datos de movilidad docente."""
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def init_db():
    """Inicializa la base de datos y todas las tablas necesarias."""
    # 1. Asegurar base de datos
    root_conn = get_root_connection()
    try:
        with root_conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    finally:
        root_conn.close()

    # 2. Crear tablas
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Tabla de Escuelas
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS schools (
                cct VARCHAR(20) PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                nivel VARCHAR(100) DEFAULT 'Primaria',
                turno VARCHAR(50) DEFAULT 'Matutino',
                numero_grupos INT DEFAULT 6,
                lugar VARCHAR(255) DEFAULT '',
                municipio VARCHAR(150) NOT NULL,
                estado VARCHAR(100) DEFAULT 'Chiapas',
                latitud DECIMAL(11, 7) NOT NULL,
                longitud DECIMAL(11, 7) NOT NULL,
                zona_escolar VARCHAR(50) DEFAULT '',
                sector VARCHAR(50) DEFAULT '',
                zona_economica VARCHAR(20) DEFAULT '60%',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_municipio (municipio),
                INDEX idx_nivel (nivel),
                INDEX idx_turno (turno),
                INDEX idx_coords (latitud, longitud),
                INDEX idx_zona_economica (zona_economica)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Migración: asegurar que la columna zona_economica exista si la tabla ya había sido creada
            cursor.execute("""
                SELECT COUNT(*) as col_exists 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'zona_economica';
            """, (DB_NAME,))
            check_col = cursor.fetchone()
            if check_col and check_col["col_exists"] == 0:
                cursor.execute("ALTER TABLE schools ADD COLUMN zona_economica VARCHAR(20) DEFAULT '60%' AFTER sector;")


            # Tabla de Eventos de asignación / movilidad
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                tipo VARCHAR(100) DEFAULT 'Cambios de Adscripción',
                fecha_evento VARCHAR(100) DEFAULT '',
                activo TINYINT(1) DEFAULT 1,
                descripcion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Tabla de Vacantes por evento
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS vacancies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                cct VARCHAR(20) NOT NULL,
                tipo_vacante VARCHAR(50) DEFAULT 'Definitiva',
                categoria_funcion VARCHAR(150) DEFAULT 'Docente Frente a Grupo',
                asignatura VARCHAR(150) DEFAULT 'Todas / General',
                horas INT DEFAULT 0,
                motivo VARCHAR(150) DEFAULT 'Jubilación',
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (cct) REFERENCES schools(cct) ON DELETE CASCADE,
                INDEX idx_event (event_id),
                INDEX idx_cct (cct),
                INDEX idx_tipo_vacante (tipo_vacante)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Tabla de Caché de Rutas calculadas
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS routes_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                origin_lat_round DECIMAL(8, 4) NOT NULL,
                origin_lon_round DECIMAL(8, 4) NOT NULL,
                destination_cct VARCHAR(20) NOT NULL,
                distance_meters DECIMAL(12, 2) NOT NULL,
                duration_seconds DECIMAL(12, 2) NOT NULL,
                geometry_geojson MEDIUMTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_route (origin_lat_round, origin_lon_round, destination_cct),
                INDEX idx_lookup (origin_lat_round, origin_lon_round)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Tabla de Ajustes del Sistema
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key_name VARCHAR(100) PRIMARY KEY,
                key_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Inserción de valores iniciales de configuración si no existen
            cursor.execute("""
            INSERT IGNORE INTO settings (key_name, key_value) VALUES 
            ('routing_api_url', %s),
            ('routing_api_key', %s);
            """, (ROUTING_API_URL, ROUTING_API_KEY))

    finally:
        conn.close()

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia geodésica en kilómetros entre dos puntos en la tierra (fórmula de Haversine).
    """
    R = 6371.0  # Radio medio de la Tierra en kilómetros
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    c = 2 * asin(sqrt(a))
    return R * c

def get_setting(key_name, default=""):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT key_value FROM settings WHERE key_name = %s", (key_name,))
            row = cursor.fetchone()
            if row and row.get("key_value") is not None:
                return row["key_value"]
            return default
    finally:
        conn.close()

def set_setting(key_name, key_value):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
            INSERT INTO settings (key_name, key_value)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE key_value = VALUES(key_value);
            """, (key_name, key_value))
    finally:
        conn.close()
