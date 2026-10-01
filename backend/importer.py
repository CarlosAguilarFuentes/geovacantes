import csv
import io
import openpyxl
from backend.database import get_db_connection

def normalize_header(name: str) -> str:
    """Limpia y estandariza los nombres de columnas para detección automática."""
    if not name:
        return ""
    clean = str(name).strip().lower()
    for char in [".", "_", "-", "/", "\\", ":", ";"]:
        clean = clean.replace(char, " ")
    return " ".join(clean.split())

def match_column(headers: list, target_aliases: list) -> str:
    """Busca en una lista de encabezados cuál coincide con alguno de los alias."""
    for raw_header in headers:
        normalized = normalize_header(raw_header)
        for alias in target_aliases:
            if normalized == alias or alias in normalized:
                return raw_header
    return None

def parse_file_to_rows(file_bytes: bytes, filename: str) -> list:
    """Extrae una lista de diccionarios desde un archivo CSV o Excel (.xlsx)."""
    rows = []
    fname = filename.lower()

    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        all_lines = list(sheet.iter_rows(values_only=True))
        if not all_lines:
            return []
        
        # Encontrar la primera fila no vacía como encabezados
        header_idx = 0
        for i, line in enumerate(all_lines):
            if any(cell is not None and str(cell).strip() != "" for cell in line):
                header_idx = i
                break
        
        headers = [str(c).strip() if c is not None else f"col_{idx}" for idx, c in enumerate(all_lines[header_idx])]
        for line in all_lines[header_idx + 1:]:
            if not any(c is not None and str(c).strip() != "" for c in line):
                continue
            row_dict = {}
            for idx, h in enumerate(headers):
                val = line[idx] if idx < len(line) else None
                row_dict[h] = str(val).strip() if val is not None else ""
            rows.append(row_dict)

    else:
        # Intentar decodificar como UTF-8 o fallback Latin-1
        text = ""
        for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
            try:
                text = file_bytes.decode(encoding)
                break
            except Exception:
                continue

        # Detectar delimitador (, o ;)
        delimiter = ";" if text.count(";") > text.count(",") else ","
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        for r in reader:
            if any(v and str(v).strip() for v in r.values()):
                clean_row = {k.strip(): (str(v).strip() if v is not None else "") for k, v in r.items() if k}
                rows.append(clean_row)

    return rows

def import_schools_from_file(file_bytes: bytes, filename: str) -> dict:
    """Importa o actualiza el catálogo de escuelas desde CSV o Excel."""
    rows = parse_file_to_rows(file_bytes, filename)
    if not rows:
        return {"success": False, "message": "El archivo está vacío o no tiene formato tabular válido."}

    headers = list(rows[0].keys())

    # Mapeo inteligente de columnas
    col_cct = match_column(headers, ["cct", "clave ct", "clave de centro de trabajo", "clave", "c c t"])
    col_nombre = match_column(headers, ["nombre", "escuela", "nombre de la escuela", "plantel", "centro de trabajo"])
    col_nivel = match_column(headers, ["nivel", "nivel educativo", "servicio", "modalidad"])
    col_turno = match_column(headers, ["turno", "jornada"])
    col_grupos = match_column(headers, ["numero grupos", "grupos", "num grupos", "no grupos"])
    col_lugar = match_column(headers, ["lugar", "localidad", "domicilio", "colonia", "direccion"])
    col_municipio = match_column(headers, ["municipio", "alcaldia", "mpio"])
    col_estado = match_column(headers, ["estado", "entidad", "entidad federativa"])
    col_lat = match_column(headers, ["latitud", "lat", "coord y", "y"])
    col_lon = match_column(headers, ["longitud", "lon", "lng", "coord x", "x"])
    col_zona = match_column(headers, ["zona escolar", "zona"])
    col_sector = match_column(headers, ["sector escolar", "sector"])
    col_zona_economica = match_column(headers, ["zona economica", "zona económica", "porcentaje", "porcentaje zona", "zona eco", "ze"])

    if not col_cct or not col_lat or not col_lon:
        return {
            "success": False,
            "message": f"Faltan columnas obligatorias detectadas. Se requiere CCT, Latitud y Longitud. Columnas encontradas: {', '.join(headers[:8])}"
        }

    conn = get_db_connection()
    inserted_or_updated = 0
    errors = []

    try:
        with conn.cursor() as cursor:
            for idx, r in enumerate(rows, start=1):
                cct_val = r.get(col_cct, "").strip().upper()
                if not cct_val:
                    continue

                nombre_val = r.get(col_nombre, f"Escuela {cct_val}").strip() if col_nombre else f"Escuela {cct_val}"
                nivel_val = r.get(col_nivel, "Primaria").strip() if col_nivel else "Primaria"
                turno_val = r.get(col_turno, "Matutino").strip() if col_turno else "Matutino"
                
                try:
                    grupos_val = int(r.get(col_grupos, 6)) if col_grupos and r.get(col_grupos) else 6
                except Exception:
                    grupos_val = 6

                lugar_val = r.get(col_lugar, "").strip() if col_lugar else ""
                municipio_val = r.get(col_municipio, "Chiapas").strip() if col_municipio else "Chiapas"
                estado_val = r.get(col_estado, "Chiapas").strip() if col_estado else "Chiapas"
                zona_val = r.get(col_zona, "").strip() if col_zona else ""
                sector_val = r.get(col_sector, "").strip() if col_sector else ""
                
                # Formateo de zona económica (ej. '60%', '100%')
                ze_val = "60%"
                if col_zona_economica and r.get(col_zona_economica):
                    raw_ze = str(r.get(col_zona_economica)).strip()
                    if raw_ze.isdigit() or raw_ze.replace(".", "").isdigit():
                        num = float(raw_ze)
                        ze_val = f"{int(num)}%" if num > 1 else f"{int(num * 100)}%"
                    elif "%" in raw_ze:
                        ze_val = raw_ze
                    else:
                        ze_val = raw_ze

                try:
                    lat_str = r.get(col_lat, "").replace(",", ".").strip()
                    lon_str = r.get(col_lon, "").replace(",", ".").strip()
                    lat_val = float(lat_str)
                    lon_val = float(lon_str)
                except Exception:
                    errors.append(f"Fila {idx} ({cct_val}): Coordenadas inválidas lat={r.get(col_lat)}, lon={r.get(col_lon)}")
                    continue

                cursor.execute("""
                    INSERT INTO schools (
                        cct, nombre, nivel, turno, numero_grupos, lugar, municipio, estado,
                        latitud, longitud, zona_escolar, sector, zona_economica
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        nombre = VALUES(nombre),
                        nivel = VALUES(nivel),
                        turno = VALUES(turno),
                        numero_grupos = VALUES(numero_grupos),
                        lugar = VALUES(lugar),
                        municipio = VALUES(municipio),
                        estado = VALUES(estado),
                        latitud = VALUES(latitud),
                        longitud = VALUES(longitud),
                        zona_escolar = VALUES(zona_escolar),
                        sector = VALUES(sector),
                        zona_economica = VALUES(zona_economica);
                """, (
                    cct_val, nombre_val, nivel_val, turno_val, grupos_val, lugar_val,
                    municipio_val, estado_val, lat_val, lon_val, zona_val, sector_val, ze_val
                ))
                inserted_or_updated += 1

    finally:
        conn.close()

    return {
        "success": True,
        "total_rows": len(rows),
        "imported": inserted_or_updated,
        "errors_count": len(errors),
        "sample_errors": errors[:5],
        "message": f"Se procesaron {inserted_or_updated} escuelas correctamente."
    }

def import_vacancies_from_file(file_bytes: bytes, filename: str, event_id: int) -> dict:
    """Importa la lista de vacantes para un evento específico."""
    rows = parse_file_to_rows(file_bytes, filename)
    if not rows:
        return {"success": False, "message": "El archivo está vacío o no tiene formato tabular válido."}

    headers = list(rows[0].keys())

    col_cct = match_column(headers, ["cct", "clave ct", "clave", "c c t", "clave centro"])
    col_tipo = match_column(headers, ["tipo vacante", "tipo de vacante", "tipo", "tipo plaza", "plaza"])
    col_funcion = match_column(headers, ["categoria", "funcion", "puesto", "cargo"])
    col_asig = match_column(headers, ["asignatura", "materia", "especialidad", "disciplina"])
    col_horas = match_column(headers, ["horas", "hrs", "numero horas"])
    col_motivo = match_column(headers, ["motivo", "causa", "origen"])
    col_obs = match_column(headers, ["observaciones", "notas", "comentarios"])

    if not col_cct:
        return {
            "success": False,
            "message": f"No se encontró la columna CCT en el archivo. Columnas detectadas: {', '.join(headers[:8])}"
        }

    conn = get_db_connection()
    inserted = 0
    warnings = []

    try:
        with conn.cursor() as cursor:
            # Obtener lista de CCTs existentes para validación
            cursor.execute("SELECT cct FROM schools;")
            existing_ccts = set(r["cct"] for r in cursor.fetchall())

            for idx, r in enumerate(rows, start=1):
                cct_val = r.get(col_cct, "").strip().upper()
                if not cct_val:
                    continue

                if cct_val not in existing_ccts:
                    warnings.append(f"Fila {idx}: CCT {cct_val} no existe en el catálogo de escuelas previo.")

                tipo_val = r.get(col_tipo, "Definitiva").strip() if col_tipo and r.get(col_tipo) else "Definitiva"
                funcion_val = r.get(col_funcion, "Docente Frente a Grupo").strip() if col_funcion and r.get(col_funcion) else "Docente Frente a Grupo"
                asig_val = r.get(col_asig, "General").strip() if col_asig and r.get(col_asig) else "General"
                
                try:
                    horas_val = int(r.get(col_horas, 0)) if col_horas and r.get(col_horas) else 0
                except Exception:
                    horas_val = 0

                motivo_val = r.get(col_motivo, "Jubilación").strip() if col_motivo and r.get(col_motivo) else "Jubilación"
                obs_val = r.get(col_obs, "").strip() if col_obs else ""

                cursor.execute("""
                    INSERT INTO vacancies (
                        event_id, cct, tipo_vacante, categoria_funcion, asignatura, horas, motivo, observaciones
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    event_id, cct_val, tipo_val, funcion_val, asig_val, horas_val, motivo_val, obs_val
                ))
                inserted += 1

    finally:
        conn.close()

    return {
        "success": True,
        "total_rows": len(rows),
        "imported": inserted,
        "warnings_count": len(warnings),
        "sample_warnings": warnings[:5],
        "message": f"Se registraron {inserted} vacantes para el evento seleccionado."
    }
