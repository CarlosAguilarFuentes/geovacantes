from backend.database import get_db_connection

SAMPLE_SCHOOLS = [
    # Tuxtla Gutiérrez
    {
        "cct": "07DPR0521Z",
        "nombre": "Escuela Primaria Camilo Pintado",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 12,
        "lugar": "Col. Moctezuma, 5a Poniente Norte",
        "municipio": "Tuxtla Gutiérrez",
        "estado": "Chiapas",
        "latitud": 16.757820,
        "longitud": -93.123540,
        "zona_escolar": "012",
        "sector": "01",
        "zona_economica": "60%"
    },
    {
        "cct": "07DPR1042K",
        "nombre": "Escuela Primaria Lic. Benito Juárez García",
        "nivel": "Primaria",
        "turno": "Vespertino",
        "numero_grupos": 8,
        "lugar": "Barrio San Roque, Av. 4a Sur Oriente",
        "municipio": "Tuxtla Gutiérrez",
        "estado": "Chiapas",
        "latitud": 16.748210,
        "longitud": -93.111450,
        "zona_escolar": "014",
        "sector": "01",
        "zona_economica": "60%"
    },
    {
        "cct": "07DST0012P",
        "nombre": "Escuela Secundaria Técnica Núm. 2 (Prevo)",
        "nivel": "Secundaria Técnica",
        "turno": "Matutino",
        "numero_grupos": 18,
        "lugar": "Col. Magisterial, Libramiento Norte Pte",
        "municipio": "Tuxtla Gutiérrez",
        "estado": "Chiapas",
        "latitud": 16.764510,
        "longitud": -93.136200,
        "zona_escolar": "002",
        "sector": "02",
        "zona_economica": "60%"
    },
    {
        "cct": "07DJN0145M",
        "nombre": "Jardín de Niños Juan Enrique Pestalozzi",
        "nivel": "Preescolar",
        "turno": "Matutino",
        "numero_grupos": 6,
        "lugar": "Col. Terán, 2a Poniente Sur",
        "municipio": "Tuxtla Gutiérrez",
        "estado": "Chiapas",
        "latitud": 16.741290,
        "longitud": -93.159840,
        "zona_escolar": "008",
        "sector": "01",
        "zona_economica": "60%"
    },
    {
        "cct": "07ETV0105X",
        "nombre": "Escuela Telesecundaria Núm. 105 Sor Juana Inés",
        "nivel": "Telesecundaria",
        "turno": "Matutino",
        "numero_grupos": 6,
        "lugar": "Copoya, Calle Central",
        "municipio": "Tuxtla Gutiérrez",
        "estado": "Chiapas",
        "latitud": 16.711800,
        "longitud": -93.120500,
        "zona_escolar": "021",
        "sector": "03",
        "zona_economica": "100%"
    },

    # Chiapa de Corzo
    {
        "cct": "07DPR1432A",
        "nombre": "Escuela Primaria Dr. Ángel Albino Corzo",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 12,
        "lugar": "Barrio San Miguel, Calle Capitán Vicente López",
        "municipio": "Chiapa de Corzo",
        "estado": "Chiapas",
        "latitud": 16.708450,
        "longitud": -93.013580,
        "zona_escolar": "033",
        "sector": "04",
        "zona_economica": "60%"
    },
    {
        "cct": "07DST0044B",
        "nombre": "Escuela Secundaria Técnica Núm. 44",
        "nivel": "Secundaria Técnica",
        "turno": "Matutino",
        "numero_grupos": 10,
        "lugar": "Carretera a La Angostura Km 2.5",
        "municipio": "Chiapa de Corzo",
        "estado": "Chiapas",
        "latitud": 16.698120,
        "longitud": -93.004210,
        "zona_escolar": "006",
        "sector": "02",
        "zona_economica": "60%"
    },
    {
        "cct": "07ETV0312R",
        "nombre": "Escuela Telesecundaria Núm. 312 Miguel Hidalgo",
        "nivel": "Telesecundaria",
        "turno": "Matutino",
        "numero_grupos": 4,
        "lugar": "Ribera Cahuaré",
        "municipio": "Chiapa de Corzo",
        "estado": "Chiapas",
        "latitud": 16.726500,
        "longitud": -93.029800,
        "zona_escolar": "021",
        "sector": "03",
        "zona_economica": "100%"
    },

    # Berriozábal
    {
        "cct": "07DPR1894W",
        "nombre": "Escuela Primaria Ignacio Manuel Altamirano",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 10,
        "lugar": "Barrio San Sebastián, 2a Norte Oriente",
        "municipio": "Berriozábal",
        "estado": "Chiapas",
        "latitud": 16.797230,
        "longitud": -93.272180,
        "zona_escolar": "045",
        "sector": "05",
        "zona_economica": "60%"
    },
    {
        "cct": "07DES0015G",
        "nombre": "Escuela Secundaria General Felipe Berriozábal",
        "nivel": "Secundaria General",
        "turno": "Vespertino",
        "numero_grupos": 8,
        "lugar": "Barrio Linda Vista",
        "municipio": "Berriozábal",
        "estado": "Chiapas",
        "latitud": 16.804110,
        "longitud": -93.268450,
        "zona_escolar": "009",
        "sector": "02",
        "zona_economica": "60%"
    },

    # San Cristóbal de Las Casas
    {
        "cct": "07DPR0215F",
        "nombre": "Escuela Primaria Manuel Larrainzar",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 14,
        "lugar": "Barrio San Diego, Calle Real de Guadalupe",
        "municipio": "San Cristóbal de Las Casas",
        "estado": "Chiapas",
        "latitud": 16.738120,
        "longitud": -92.634120,
        "zona_escolar": "050",
        "sector": "06",
        "zona_economica": "60%"
    },
    {
        "cct": "07DST0001Z",
        "nombre": "Escuela Secundaria Técnica Núm. 1",
        "nivel": "Secundaria Técnica",
        "turno": "Matutino",
        "numero_grupos": 16,
        "lugar": "Col. Maya, Diagonal Hermanos Paniagua",
        "municipio": "San Cristóbal de Las Casas",
        "estado": "Chiapas",
        "latitud": 16.732890,
        "longitud": -92.651400,
        "zona_escolar": "001",
        "sector": "01",
        "zona_economica": "60%"
    },

    # Ocozocoautla de Espinosa (Coita)
    {
        "cct": "07DPR0892M",
        "nombre": "Escuela Primaria Emilio Rabasa Estebanell",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 9,
        "lugar": "Barrio San Antonio, 3a Sur Poniente",
        "municipio": "Ocozocoautla de Espinosa",
        "estado": "Chiapas",
        "latitud": 16.762100,
        "longitud": -93.374500,
        "zona_escolar": "041",
        "sector": "05",
        "zona_economica": "60%"
    },

    # Suchiapa
    {
        "cct": "07DPR1511L",
        "nombre": "Escuela Primaria Coronel Luis Espinosa",
        "nivel": "Primaria",
        "turno": "Matutino",
        "numero_grupos": 8,
        "lugar": "Centro, Calle Central Norte",
        "municipio": "Suchiapa",
        "estado": "Chiapas",
        "latitud": 16.625340,
        "longitud": -93.101200,
        "zona_escolar": "038",
        "sector": "04",
        "zona_economica": "60%"
    },
    {
        "cct": "07ETV0442T",
        "nombre": "Escuela Telesecundaria Núm. 442 Tierra y Libertad",
        "nivel": "Telesecundaria",
        "turno": "Matutino",
        "numero_grupos": 3,
        "lugar": "Ejido Plan de Ayala / Suchiapa",
        "municipio": "Suchiapa",
        "estado": "Chiapas",
        "latitud": 16.602100,
        "longitud": -93.118900,
        "zona_escolar": "022",
        "sector": "03",
        "zona_economica": "100%"
    }
]

SAMPLE_VACANCIES = [
    {
        "cct": "07DPR0521Z",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria General",
        "horas": 0,
        "motivo": "Jubilación",
        "observaciones": "Plaza federalizada disponible en 3er grado matutino."
    },
    {
        "cct": "07DPR1042K",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria General",
        "horas": 0,
        "motivo": "Cambio de Adscripción Saliente",
        "observaciones": "Turno vespertino. Se requiere disponibilidad de horario."
    },
    {
        "cct": "07DST0012P",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Profesor de Asignatura",
        "asignatura": "Matemáticas",
        "horas": 19,
        "motivo": "Jubilación",
        "observaciones": "Secundaria Técnica 2. Paquete de 19 horas frente a grupo."
    },
    {
        "cct": "07DJN0145M",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Educadora / Docente",
        "asignatura": "Preescolar",
        "horas": 0,
        "motivo": "Defunción",
        "observaciones": "Excelente ubicación en Terán. Jardín de niños de organización completa."
    },
    {
        "cct": "07ETV0105X",
        "tipo_vacante": "Temporal",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Telesecundaria Todas las Asignaturas",
        "horas": 0,
        "motivo": "Licencia por Gravidez",
        "observaciones": "Vigencia de 6 meses con opción a prórroga. Copoya."
    },
    {
        "cct": "07DPR1432A",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria",
        "horas": 0,
        "motivo": "Renuncia Voluntaria",
        "observaciones": "Escuela de alta demanda en Chiapa de Corzo centro."
    },
    {
        "cct": "07DST0044B",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Profesor de Asignatura",
        "asignatura": "Tecnología / Ofimática",
        "horas": 16,
        "motivo": "Jubilación",
        "observaciones": "Taller tecnológico con laboratorio equipado."
    },
    {
        "cct": "07ETV0312R",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Telesecundaria General",
        "horas": 0,
        "motivo": "Nueva Creación",
        "observaciones": "Ribera Cahuaré a 10 min del malecón de Chiapa de Corzo."
    },
    {
        "cct": "07DPR1894W",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente de Educación Física",
        "asignatura": "Educación Física",
        "horas": 22,
        "motivo": "Ascenso a Supervisión",
        "observaciones": "Cobertura en primaria matutina de Berriozábal."
    },
    {
        "cct": "07DES0015G",
        "tipo_vacante": "Temporal",
        "categoria_funcion": "Profesor de Asignatura",
        "asignatura": "Español / Lenguaje",
        "horas": 15,
        "motivo": "Beca Comisión",
        "observaciones": "Secundaria General en Berriozábal, turno vespertino."
    },
    {
        "cct": "07DPR0215F",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria",
        "horas": 0,
        "motivo": "Jubilación",
        "observaciones": "Escuela histórica en el centro de San Cristóbal de Las Casas."
    },
    {
        "cct": "07DST0001Z",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Profesor de Asignatura",
        "asignatura": "Ciencias (Física / Química)",
        "horas": 18,
        "motivo": "Jubilación",
        "observaciones": "Técnica Núm. 1, San Cristóbal de Las Casas."
    },
    {
        "cct": "07DPR0892M",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria",
        "horas": 0,
        "motivo": "Cambio de Adscripción Saliente",
        "observaciones": "Ocozocoautla centro, muy accesible por autopista."
    },
    {
        "cct": "07DPR1511L",
        "tipo_vacante": "Definitiva",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Educación Primaria",
        "horas": 0,
        "motivo": "Jubilación",
        "observaciones": "Suchiapa cabecera municipal, a 20 min de Tuxtla Sur."
    },
    {
        "cct": "07ETV0442T",
        "tipo_vacante": "Temporal",
        "categoria_funcion": "Docente Frente a Grupo",
        "asignatura": "Telesecundaria General",
        "horas": 0,
        "motivo": "Incapacidad Médica",
        "observaciones": "Comunidad tranquila en Suchiapa, horario 8:00 a 14:00."
    }
]

def seed_sample_data():
    """Inserta las escuelas y vacantes de muestra de Chiapas si no existen."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Insertar Escuelas
            for s in SAMPLE_SCHOOLS:
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
                        latitud = VALUES(latitud),
                        longitud = VALUES(longitud),
                        zona_escolar = VALUES(zona_escolar),
                        sector = VALUES(sector),
                        zona_economica = VALUES(zona_economica);
                """, (
                    s["cct"], s["nombre"], s["nivel"], s["turno"], s["numero_grupos"],
                    s["lugar"], s["municipio"], s["estado"], s["latitud"], s["longitud"],
                    s["zona_escolar"], s["sector"], s.get("zona_economica", "60%")
                ))

            # 2. Asegurar Evento Activo de Muestra
            cursor.execute("SELECT id FROM events WHERE activo = 1 LIMIT 1;")
            active_event = cursor.fetchone()
            if not active_event:
                cursor.execute("""
                    INSERT INTO events (nombre, tipo, fecha_evento, activo, descripcion)
                    VALUES (%s, %s, %s, %s, %s);
                """, (
                    "Proceso de Asignación y Cambios de Adscripción 2026",
                    "Cambios y Asignación de Plazas",
                    "Octubre 2026",
                    1,
                    "Catálogo oficial de vacantes preliminares para consulta y selección previa de docentes."
                ))
                event_id = cursor.lastrowid
            else:
                event_id = active_event["id"]

            # 3. Insertar Vacantes
            cursor.execute("DELETE FROM vacancies WHERE event_id = %s;", (event_id,))
            for v in SAMPLE_VACANCIES:
                cursor.execute("""
                    INSERT INTO vacancies (
                        event_id, cct, tipo_vacante, categoria_funcion, asignatura, horas, motivo, observaciones
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    event_id, v["cct"], v["tipo_vacante"], v["categoria_funcion"],
                    v["asignatura"], v["horas"], v["motivo"], v["observaciones"]
                ))
    finally:
        conn.close()
