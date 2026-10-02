import os
import hmac
import asyncio
import httpx
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.config import BASE_DIR, ADMIN_USER, ADMIN_PASSWORD, ADMIN_TOKEN_SECRET
from backend.database import (
    init_db, get_db_connection, haversine_distance, get_setting, set_setting
)
from backend.routing import get_route, test_routing_api
from backend.importer import import_schools_from_file, import_vacancies_from_file
from backend.sample_data import seed_sample_data

app = FastAPI(
    title="Plataforma de Consulta Geográfica para Movilidad Docente",
    description="Herramienta de exploración y comparación de vacantes docentes con ruteo vial",
    version="1.0.0"
)

# CORS habilitado
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Base de Datos al arrancar
@app.on_event("startup")
def startup_event():
    init_db()
    # Solo sembramos datos de muestra si está explícitamente habilitado en el entorno
    if os.getenv("AUTO_SEED_SAMPLE_DATA", "false").lower() in ("true", "1", "yes"):
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS total FROM schools;")
                res = cursor.fetchone()
                if res and res["total"] == 0:
                    seed_sample_data()
        finally:
            conn.close()

def format_duration(minutes: Optional[float]) -> str:
    if minutes is None:
        return ""
    total_min = int(round(minutes))
    if total_min < 60:
        return f"{total_min} min"
    hrs = total_min // 60
    mins = total_min % 60
    return f"{hrs}h {mins:02d}m"

# Dependencia de autenticación de admin con protección contra timing attacks
def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token de administración requerido")
    token = authorization.replace("Bearer ", "").strip()
    if not hmac.compare_digest(token, ADMIN_TOKEN_SECRET):
        raise HTTPException(status_code=403, detail="Token inválido o expirado")
    return True

# --- Modelos de Petición ---
class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_cct: str

class BatchRoutesRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    ccts: List[str]

class SettingsUpdateRequest(BaseModel):
    routing_api_url: Optional[str] = None
    routing_api_key: Optional[str] = None

class AdminLoginRequest(BaseModel):
    user: str
    password: str

class ClearDataRequest(BaseModel):
    target: str = "all"  # "all", "vacancies", "schools", "routes"

class EventCreateRequest(BaseModel):
    nombre: str
    tipo: str = "Cambios de Adscripción"
    fecha_evento: str = ""
    descripcion: str = ""
    activo: bool = True

class EventUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    fecha_evento: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

# --- Endpoints Públicos de Consulta (Sin Login) ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "movilidad-docente-api"}

@app.get("/api/events/active")
def get_active_event():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM events WHERE activo = 1 ORDER BY id DESC LIMIT 1;")
            event = cursor.fetchone()
            if not event:
                cursor.execute("SELECT * FROM events ORDER BY id DESC LIMIT 1;")
                event = cursor.fetchone()
            
            if event:
                cursor.execute("SELECT COUNT(*) as count FROM vacancies WHERE event_id = %s;", (event["id"],))
                vac_count = cursor.fetchone()
                event["total_vacancies"] = vac_count["count"] if vac_count else 0
            return event or {}
    finally:
        conn.close()

@app.get("/api/filter-options")
def get_filter_options():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT DISTINCT municipio FROM schools WHERE municipio != '' ORDER BY municipio;")
            municipios = [r["municipio"] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT nivel FROM schools WHERE nivel != '' ORDER BY nivel;")
            niveles = [r["nivel"] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT turno FROM schools WHERE turno != '' ORDER BY turno;")
            turnos = [r["turno"] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT zona_economica FROM schools WHERE zona_economica != '' ORDER BY zona_economica;")
            zonas_economicas = [r["zona_economica"] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT tipo_vacante FROM vacancies WHERE tipo_vacante != '' ORDER BY tipo_vacante;")
            tipos_vacante = [r["tipo_vacante"] for r in cursor.fetchall()]

            return {
                "municipios": municipios,
                "niveles": niveles,
                "turnos": turnos,
                "zonas_economicas": zonas_economicas,
                "tipos_vacante": tipos_vacante
            }
    finally:
        conn.close()

@app.get("/api/vacancies")
def get_vacancies(
    event_id: Optional[int] = None,
    nivel: Optional[str] = None,
    turno: Optional[str] = None,
    municipio: Optional[str] = None,
    zona_economica: Optional[str] = None,
    tipo_vacante: Optional[str] = None,
    search: Optional[str] = None,
    origin_lat: Optional[float] = None,
    origin_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    max_time_min: Optional[float] = None,
    sort_by: str = "distance", # distance, time, groups, name, cct
    limit: int = 150,
    offset: int = 0
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Si no se pasó event_id, usar el activo
            if not event_id:
                cursor.execute("SELECT id FROM events WHERE activo = 1 ORDER BY id DESC LIMIT 1;")
                active = cursor.fetchone()
                if active:
                    event_id = active["id"]

            where_clauses = []
            params = []

            if event_id:
                where_clauses.append("v.event_id = %s")
                params.append(event_id)

            if nivel:
                where_clauses.append("s.nivel = %s")
                params.append(nivel)

            if turno:
                where_clauses.append("s.turno = %s")
                params.append(turno)

            if municipio:
                where_clauses.append("s.municipio = %s")
                params.append(municipio)

            if zona_economica:
                where_clauses.append("s.zona_economica = %s")
                params.append(zona_economica)

            if tipo_vacante:
                where_clauses.append("v.tipo_vacante = %s")
                params.append(tipo_vacante)

            if search:
                pattern = f"%{search.strip()}%"
                where_clauses.append("(s.cct LIKE %s OR s.nombre LIKE %s OR s.lugar LIKE %s OR v.asignatura LIKE %s)")
                params.extend([pattern, pattern, pattern, pattern])

            where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            query = f"""
                SELECT 
                    v.id AS vacancy_id,
                    v.event_id,
                    v.tipo_vacante,
                    v.categoria_funcion,
                    v.asignatura,
                    v.horas,
                    v.motivo,
                    v.observaciones,
                    s.cct,
                    s.nombre AS escuela_nombre,
                    s.nivel,
                    s.turno,
                    s.numero_grupos,
                    s.lugar,
                    s.municipio,
                    s.estado,
                    s.latitud,
                    s.longitud,
                    s.zona_escolar,
                    s.sector,
                    s.zona_economica
                FROM vacancies v
                JOIN schools s ON v.cct = s.cct
                {where_sql}
            """
            cursor.execute(query, tuple(params))
            results = cursor.fetchall()

            # Enriquecimiento geodésico y de ruteo si hay origen definido
            processed = []
            origin_valid = origin_lat is not None and origin_lon is not None

            # Recuperar rutas en caché para este origen redondeado
            cached_routes = {}
            if origin_valid:
                olat_r = round(origin_lat, 4)
                olon_r = round(origin_lon, 4)
                cursor.execute("""
                    SELECT destination_cct, distance_meters, duration_seconds
                    FROM routes_cache
                    WHERE origin_lat_round = %s AND origin_lon_round = %s;
                """, (olat_r, olon_r))
                for rc in cursor.fetchall():
                    cached_routes[rc["destination_cct"]] = {
                        "distance_km": round(float(rc["distance_meters"]) / 1000.0, 1),
                        "duration_min": round(float(rc["duration_seconds"]) / 60.0, 1)
                    }

            for row in results:
                s_lat = float(row["latitud"])
                s_lon = float(row["longitud"])
                cct = row["cct"]

                item = dict(row)
                item["latitud"] = s_lat
                item["longitud"] = s_lon

                if origin_valid:
                    direct_km = haversine_distance(origin_lat, origin_lon, s_lat, s_lon)
                    item["direct_distance_km"] = round(direct_km, 2)

                    if cct in cached_routes:
                        item["distance_km"] = cached_routes[cct]["distance_km"]
                        item["duration_min"] = cached_routes[cct]["duration_min"]
                        item["is_road_exact"] = True
                    else:
                        # Estimación vial previa mientras se solicita la ruta exacta
                        est_road_km = direct_km * 1.28
                        est_speed = 35.0 if direct_km < 10 else 55.0
                        est_min = (est_road_km / est_speed) * 60.0
                        item["distance_km"] = round(est_road_km, 1)
                        item["duration_min"] = round(est_min, 1)
                        item["is_road_exact"] = False

                    item["duration_formatted"] = format_duration(item["duration_min"])

                    # Filtro de distancia máxima
                    if max_distance_km is not None and item["distance_km"] > max_distance_km:
                        continue
                    # Filtro de tiempo máximo
                    if max_time_min is not None and item["duration_min"] > max_time_min:
                        continue
                else:
                    item["distance_km"] = None
                    item["duration_min"] = None
                    item["duration_formatted"] = ""
                    item["direct_distance_km"] = None
                    item["is_road_exact"] = False

                processed.append(item)

            # Ordenamiento
            if origin_valid and sort_by == "distance":
                processed.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"]))
            elif origin_valid and sort_by == "time":
                processed.sort(key=lambda x: (x["duration_min"] is None, x["duration_min"]))
            elif sort_by == "groups":
                processed.sort(key=lambda x: x["numero_grupos"], reverse=True)
            elif sort_by == "name":
                processed.sort(key=lambda x: x["escuela_nombre"])
            elif sort_by == "municipio":
                processed.sort(key=lambda x: (x["municipio"], x["escuela_nombre"]))

            total_items = len(processed)
            paged_items = processed[offset : offset + limit]

            return {
                "total": total_items,
                "limit": limit,
                "offset": offset,
                "vacancies": paged_items
            }
    finally:
        conn.close()

@app.get("/api/schools/{cct}")
def get_school_details(cct: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM schools WHERE cct = %s;", (cct.upper(),))
            school = cursor.fetchone()
            if not school:
                raise HTTPException(status_code=404, detail="Escuela no encontrada")
            school["latitud"] = float(school["latitud"])
            school["longitud"] = float(school["longitud"])

            cursor.execute("""
                SELECT v.*, e.nombre as evento_nombre
                FROM vacancies v
                JOIN events e ON v.event_id = e.id
                WHERE v.cct = %s;
            """, (cct.upper(),))
            school["vacancies"] = cursor.fetchall()
            return school
    finally:
        conn.close()

@app.post("/api/route")
async def calculate_route(req: RouteRequest):
    """Calcula la ruta vial exacta desde el origen hasta una escuela (CCT)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT latitud, longitud, nombre FROM schools WHERE cct = %s;", (req.dest_cct.upper(),))
            school = cursor.fetchone()
            if not school:
                raise HTTPException(status_code=404, detail="Escuela destino no encontrada")
            dest_lat = float(school["latitud"])
            dest_lon = float(school["longitud"])
    finally:
        conn.close()

    result = await get_route(
        origin_lat=req.origin_lat,
        origin_lon=req.origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        dest_cct=req.dest_cct.upper()
    )
    result["school_name"] = school["nombre"]
    result["dest_lat"] = dest_lat
    result["dest_lon"] = dest_lon
    dur_min = round(result["duration_seconds"] / 60.0, 1)
    result["duration_min"] = dur_min
    result["duration_formatted"] = format_duration(dur_min)
    return result

@app.post("/api/routes/batch")
async def calculate_routes_batch(req: BatchRoutesRequest):
    """Calcula de forma rápida y concurrente las rutas viales para una lista de CCTs."""
    if not req.ccts:
        return {"routes": {}}
    
    conn = get_db_connection()
    schools_dict = {}
    try:
        with conn.cursor() as cursor:
            unique_ccts = list(set([c.upper() for c in req.ccts if c]))
            if not unique_ccts:
                return {"routes": {}}
            format_strings = ','.join(['%s'] * len(unique_ccts))
            cursor.execute(f"SELECT cct, latitud, longitud, nombre FROM schools WHERE cct IN ({format_strings});", tuple(unique_ccts))
            for row in cursor.fetchall():
                schools_dict[row["cct"]] = {
                    "lat": float(row["latitud"]),
                    "lon": float(row["longitud"]),
                    "nombre": row["nombre"]
                }
    finally:
        conn.close()

    sem = asyncio.Semaphore(5)

    async def fetch_single_cct(cct):
        if cct not in schools_dict:
            return cct, None
        s = schools_dict[cct]
        async with sem:
            res = await get_route(req.origin_lat, req.origin_lon, s["lat"], s["lon"], cct)
            dur_min = round(res["duration_seconds"] / 60.0, 1)
            return cct, {
                "distance_km": round(res["distance_meters"] / 1000.0, 1),
                "duration_min": dur_min,
                "duration_formatted": format_duration(dur_min),
                "is_simulated": res.get("is_simulated", False),
                "source": res.get("source", "")
            }

    tasks = [fetch_single_cct(cct) for cct in unique_ccts]
    results = await asyncio.gather(*tasks)
    return {"routes": {cct: data for cct, data in results if data is not None}}

@app.get("/api/geocode")
async def geocode_query(q: str = Query(..., min_length=2)):
    """
    Busca lugares y coordenadas utilizando la API de geocodificación de Carlos Aguilar (geo.carlosaguilar.mx).
    Utiliza la misma X-API-Key configurada para el ruteo.
    """
    api_key = get_setting("routing_api_key", "").strip()
    clean_q = q.strip()

    # Formatear la consulta: '${query.trim()} Tuxtla Gutierrez, Chiapas'
    if "chiapas" in clean_q.lower():
        formatted_q = clean_q
    else:
        formatted_q = f"{clean_q}, Chiapas"

    params = {
        "q": formatted_q,
        "format": "json",
        "countrycodes": "mx",
        "limit": "10"
    }

    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get("https://geo.carlosaguilar.mx/search", params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) == 0 and formatted_q != clean_q:
                    # Intento alternativo sin forzar Tuxtla Gutiérrez (por ejemplo si busca San Cristóbal o Berriozábal)
                    resp2 = await client.get(
                        "https://geo.carlosaguilar.mx/search",
                        params={"q": f"{clean_q}, Chiapas", "format": "json", "countrycodes": "mx", "limit": "10"},
                        headers=headers
                    )
                    if resp2.status_code == 200 and isinstance(resp2.json(), list) and len(resp2.json()) > 0:
                        return resp2.json()
                return data
            else:
                return []
    except Exception as e:
        print("Error en geocodificación geo.carlosaguilar.mx:", e)
        return []

# --- Endpoints de Administración (Protegidos) ---

@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest):
    req_user = req.user.strip().lower()
    expected_user = ADMIN_USER.strip().lower()
    if hmac.compare_digest(req_user, expected_user) and hmac.compare_digest(req.password, ADMIN_PASSWORD):
        return {"authenticated": True, "token": ADMIN_TOKEN_SECRET, "user": ADMIN_USER}
    raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

@app.get("/api/admin/verify", dependencies=[Depends(verify_admin_token)])
def verify_admin():
    return {"valid": True, "user": ADMIN_USER}

@app.get("/api/admin/settings", dependencies=[Depends(verify_admin_token)])
def get_admin_settings():
    api_url = get_setting("routing_api_url", "https://rutas.carlosaguilar.mx")
    api_key = get_setting("routing_api_key", "")
    return {
        "routing_api_url": api_url,
        "has_api_key": bool(api_key),
        "api_key_masked": f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else ("***" if api_key else "")
    }

@app.post("/api/admin/settings", dependencies=[Depends(verify_admin_token)])
def update_admin_settings(req: SettingsUpdateRequest):
    if req.routing_api_url is not None:
        set_setting("routing_api_url", req.routing_api_url.strip())
    if req.routing_api_key is not None:
        set_setting("routing_api_key", req.routing_api_key.strip())
    return {"success": True, "message": "Configuración guardada correctamente."}

@app.post("/api/admin/test-routing", dependencies=[Depends(verify_admin_token)])
async def test_routing_connection():
    api_url = get_setting("routing_api_url", "https://rutas.carlosaguilar.mx")
    api_key = get_setting("routing_api_key", "")
    return await test_routing_api(api_url, api_key)

@app.post("/api/admin/upload/schools", dependencies=[Depends(verify_admin_token)])
async def upload_schools(file: UploadFile = File(...)):
    content = await file.read()
    result = import_schools_from_file(content, file.filename)
    return result

@app.post("/api/admin/upload/vacancies", dependencies=[Depends(verify_admin_token)])
async def upload_vacancies(file: UploadFile = File(...), event_id: int = Form(...)):
    content = await file.read()
    result = import_vacancies_from_file(content, file.filename, event_id)
    return result

@app.get("/api/admin/stats", dependencies=[Depends(verify_admin_token)])
def get_admin_stats():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS total FROM schools;")
            total_schools = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) AS total FROM vacancies;")
            total_vacancies = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) AS total FROM routes_cache;")
            total_routes_cached = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT e.*, COUNT(v.id) AS total_vacancies 
                FROM events e 
                LEFT JOIN vacancies v ON e.id = v.event_id 
                GROUP BY e.id 
                ORDER BY e.id DESC;
            """)
            events = cursor.fetchall()

            return {
                "total_schools": total_schools,
                "total_vacancies": total_vacancies,
                "total_routes_cached": total_routes_cached,
                "events": events
            }
    finally:
        conn.close()

# --- Gestión de Eventos (Admin) ---

@app.get("/api/admin/events", dependencies=[Depends(verify_admin_token)])
def list_admin_events():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT e.*, COUNT(v.id) AS total_vacancies 
                FROM events e 
                LEFT JOIN vacancies v ON e.id = v.event_id 
                GROUP BY e.id 
                ORDER BY e.id DESC;
            """)
            return {"events": cursor.fetchall()}
    finally:
        conn.close()

@app.post("/api/admin/events", dependencies=[Depends(verify_admin_token)])
def create_admin_event(req: EventCreateRequest):
    if not req.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre del evento es obligatorio.")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if req.activo:
                cursor.execute("UPDATE events SET activo = 0;")
            cursor.execute("""
                INSERT INTO events (nombre, tipo, fecha_evento, activo, descripcion)
                VALUES (%s, %s, %s, %s, %s);
            """, (
                req.nombre.strip(),
                req.tipo.strip() if req.tipo else "Cambios de Adscripción",
                req.fecha_evento.strip() if req.fecha_evento else "",
                1 if req.activo else 0,
                req.descripcion.strip() if req.descripcion else ""
            ))
            conn.commit()
            new_id = cursor.lastrowid
            return {"success": True, "message": "Evento creado exitosamente.", "id": new_id}
    finally:
        conn.close()

@app.put("/api/admin/events/{event_id}", dependencies=[Depends(verify_admin_token)])
def update_admin_event(event_id: int, req: EventUpdateRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM events WHERE id = %s;", (event_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Evento no encontrado.")

            if req.activo is True:
                cursor.execute("UPDATE events SET activo = 0 WHERE id != %s;", (event_id,))

            updates = []
            params = []
            if req.nombre is not None:
                if not req.nombre.strip():
                    raise HTTPException(status_code=400, detail="El nombre del evento no puede estar vacío.")
                updates.append("nombre = %s")
                params.append(req.nombre.strip())
            if req.tipo is not None:
                updates.append("tipo = %s")
                params.append(req.tipo.strip())
            if req.fecha_evento is not None:
                updates.append("fecha_evento = %s")
                params.append(req.fecha_evento.strip())
            if req.descripcion is not None:
                updates.append("descripcion = %s")
                params.append(req.descripcion.strip())
            if req.activo is not None:
                updates.append("activo = %s")
                params.append(1 if req.activo else 0)

            if updates:
                params.append(event_id)
                cursor.execute(f"UPDATE events SET {', '.join(updates)} WHERE id = %s;", tuple(params))
                conn.commit()

            return {"success": True, "message": "Evento actualizado correctamente."}
    finally:
        conn.close()

@app.delete("/api/admin/events/{event_id}", dependencies=[Depends(verify_admin_token)])
def delete_admin_event(event_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, activo FROM events WHERE id = %s;", (event_id,))
            ev = cursor.fetchone()
            if not ev:
                raise HTTPException(status_code=404, detail="Evento no encontrado.")

            # Eliminar vacantes asociadas y evento (la foreign key cascade también lo hace)
            cursor.execute("DELETE FROM vacancies WHERE event_id = %s;", (event_id,))
            cursor.execute("DELETE FROM events WHERE id = %s;", (event_id,))
            conn.commit()

            # Si el evento eliminado era el activo, marcar el más reciente como activo si existe
            if ev["activo"]:
                cursor.execute("SELECT id FROM events ORDER BY id DESC LIMIT 1;")
                latest = cursor.fetchone()
                if latest:
                    cursor.execute("UPDATE events SET activo = 1 WHERE id = %s;", (latest["id"],))
                    conn.commit()

            return {"success": True, "message": "Evento y sus vacantes eliminados exitosamente."}
    finally:
        conn.close()

@app.post("/api/admin/events/{event_id}/activate", dependencies=[Depends(verify_admin_token)])
def activate_admin_event(event_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM events WHERE id = %s;", (event_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Evento no encontrado.")

            cursor.execute("UPDATE events SET activo = 0;")
            cursor.execute("UPDATE events SET activo = 1 WHERE id = %s;", (event_id,))
            conn.commit()
            return {"success": True, "message": "Evento activado correctamente para consulta pública."}
    finally:
        conn.close()

@app.post("/api/admin/seed", dependencies=[Depends(verify_admin_token)])
def reseed_sample_data():
    seed_sample_data()
    return {"success": True, "message": "Datos de muestra para Chiapas restablecidos con éxito."}

@app.post("/api/admin/clear-data", dependencies=[Depends(verify_admin_token)])
def clear_admin_data(req: ClearDataRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if req.target == "vacancies":
                cursor.execute("DELETE FROM vacancies;")
                conn.commit()
                return {"success": True, "message": "Todas las vacantes han sido eliminadas correctamente."}
            elif req.target == "schools":
                cursor.execute("DELETE FROM vacancies;")
                cursor.execute("DELETE FROM schools;")
                cursor.execute("DELETE FROM routes_cache;")
                conn.commit()
                return {"success": True, "message": "Catálogo de escuelas, vacantes asociadas y rutas en caché eliminadas."}
            elif req.target == "routes":
                cursor.execute("DELETE FROM routes_cache;")
                conn.commit()
                return {"success": True, "message": "Caché de rutas viales vaciado correctamente."}
            elif req.target == "all":
                cursor.execute("DELETE FROM vacancies;")
                cursor.execute("DELETE FROM schools;")
                cursor.execute("DELETE FROM routes_cache;")
                conn.commit()
                return {
                    "success": True, 
                    "message": "Se han eliminado todos los datos de prueba (escuelas, vacantes y rutas calculadas). La base de datos ha quedado limpia para tus datos reales."
                }
            else:
                raise HTTPException(status_code=400, detail="Objetivo de eliminación no válido.")
    finally:
        conn.close()

# --- Servir Frontend ---
FRONTEND_DIR = BASE_DIR / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Frontend en construcción"}
