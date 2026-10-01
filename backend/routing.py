import json
import asyncio
import httpx
from backend.database import get_db_connection, get_setting, haversine_distance

async def get_route(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, dest_cct: str = ""):
    """
    Obtiene la ruta en auto entre el origen y destino.
    Utiliza el caché de MySQL y la API OSRM de Carlos Aguilar.
    """
    origin_lat_round = round(origin_lat, 4)
    origin_lon_round = round(origin_lon, 4)

    # 1. Verificar en caché
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if dest_cct:
                cursor.execute("""
                    SELECT distance_meters, duration_seconds, geometry_geojson
                    FROM routes_cache
                    WHERE origin_lat_round = %s AND origin_lon_round = %s AND destination_cct = %s
                """, (origin_lat_round, origin_lon_round, dest_cct))
                row = cursor.fetchone()
                if row:
                    geom = row["geometry_geojson"]
                    if isinstance(geom, str):
                        try:
                            geom = json.loads(geom)
                        except Exception:
                            pass
                    return {
                        "distance_meters": float(row["distance_meters"]),
                        "duration_seconds": float(row["duration_seconds"]),
                        "geometry": geom,
                        "source": "cache",
                        "is_simulated": False
                    }
    finally:
        conn.close()

    # 2. Consultar la API de Carlos Aguilar
    api_url = get_setting("routing_api_url", "https://rutas.carlosaguilar.mx").rstrip("/")
    api_key = get_setting("routing_api_key", "").strip()

    # La API OSRM espera: lon1,lat1;lon2,lat2
    coords_param = f"{origin_lon:.6f},{origin_lat:.6f};{dest_lon:.6f},{dest_lat:.6f}"
    request_url = f"{api_url}/route/v1/driving/{coords_param}?overview=full&geometries=geojson"

    if api_key:
        try:
            headers = {"X-API-Key": api_key}
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(request_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if routes:
                        primary_route = routes[0]
                        distance_meters = float(primary_route.get("distance", 0.0))
                        duration_seconds = float(primary_route.get("duration", 0.0))
                        geometry = primary_route.get("geometry", {})

                        # Guardar en caché si tenemos CCT
                        if dest_cct:
                            save_route_to_cache(
                                origin_lat_round, origin_lon_round, dest_cct,
                                distance_meters, duration_seconds, geometry
                            )

                        return {
                            "distance_meters": distance_meters,
                            "duration_seconds": duration_seconds,
                            "geometry": geometry,
                            "source": "osrm_api",
                            "is_simulated": False
                        }
        except Exception as e:
            # Continuar a fallback simulado en caso de error de red o timeout
            pass

    # 3. Fallback inteligente (estimación geométrica vial)
    direct_km = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    # Factor de tortuosidad vial promedio en México/Chiapas: ~1.28
    road_km = direct_km * 1.28
    distance_meters = road_km * 1000.0
    
    # Velocidad promedio estimada según distancia (urbana vs carretera)
    avg_speed_kmh = 35.0 if direct_km < 10 else 55.0
    duration_hours = road_km / avg_speed_kmh
    duration_seconds = duration_hours * 3600.0

    geometry = {
        "type": "LineString",
        "coordinates": [
            [origin_lon, origin_lat],
            [(origin_lon + dest_lon) / 2 + 0.002, (origin_lat + dest_lat) / 2 + 0.001],
            [dest_lon, dest_lat]
        ]
    }

    return {
        "distance_meters": round(distance_meters, 1),
        "duration_seconds": round(duration_seconds, 1),
        "geometry": geometry,
        "source": "simulation_fallback",
        "is_simulated": True
    }

def save_route_to_cache(origin_lat_round, origin_lon_round, dest_cct, distance_m, duration_s, geometry):
    conn = get_db_connection()
    try:
        geom_json = json.dumps(geometry) if not isinstance(geometry, str) else geometry
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO routes_cache (origin_lat_round, origin_lon_round, destination_cct, distance_meters, duration_seconds, geometry_geojson)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    distance_meters = VALUES(distance_meters),
                    duration_seconds = VALUES(duration_seconds),
                    geometry_geojson = VALUES(geometry_geojson);
            """, (origin_lat_round, origin_lon_round, dest_cct, distance_m, duration_s, geom_json))
    except Exception:
        pass
    finally:
        conn.close()

async def test_routing_api(api_url: str, api_key: str):
    """
    Prueba la conexión al endpoint OSRM de Carlos Aguilar con un par de coordenadas de prueba en Tuxtla.
    """
    url = api_url.rstrip("/")
    # Tuxtla centro -> Libramiento norte
    coords = "-93.115000,16.753000;-93.089618,16.782694"
    test_endpoint = f"{url}/route/v1/driving/{coords}?overview=false"

    try:
        headers = {"X-API-Key": api_key.strip()}
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(test_endpoint, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "routes" in data and len(data["routes"]) > 0:
                    distance = data["routes"][0].get("distance", 0)
                    duration = data["routes"][0].get("duration", 0)
                    return {
                        "success": True,
                        "message": f"Conexión exitosa a la API de rutas. Distancia prueba: {distance/1000:.1f} km, Tiempo: {duration/60:.0f} min.",
                        "status_code": 200
                    }
                return {"success": False, "message": "Respuesta 200 pero sin rutas válidas en el JSON.", "status_code": 200}
            elif resp.status_code == 401:
                return {"success": False, "message": "Acceso denegado: API Key inválida o no autorizada.", "status_code": 401}
            else:
                return {"success": False, "message": f"Error del servidor de rutas: Código {resp.status_code}", "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "message": f"Error de conexión: {str(e)}", "status_code": 500}
