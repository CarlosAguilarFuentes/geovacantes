# GeoVacantes - Plataforma de Consulta Geográfica para Movilidad Docente

Plataforma web diseñada para que los docentes participantes en eventos de asignación de plazas, cambios de adscripción y movilidad exploren las vacantes oficiales sobre un mapa interactivo, conozcan las distancias y tiempos reales de traslado por carretera desde su lugar de origen, y preparen su lista de prelación personal antes del evento presencial o virtual.

---

## 🚀 Características Principales

1. **Consulta Pública sin Login para Docentes**:
   - Los docentes pueden explorar todas las opciones sin necesidad de cuenta ni registro.
   - Selección de punto de partida/origen: mediante clic directo en el mapa, GPS del dispositivo o selección rápida de municipios comunes (Tuxtla, Chiapa de Corzo, San Cristóbal, etc.).
   - Radio dinámico y filtro por tiempo máximo de traslado en automóvil (ej. `< 45 min`, `< 60 min`, etc.).

2. **Ruteo Vial con API OSRM de Carlos Aguilar**:
   - Integración con el servicio `https://rutas.carlosaguilar.mx/route/v1/driving/...`.
   - Soporte para cabecera de autenticación `X-API-Key`.
   - Caché de rutas en MySQL para evitar saturación de peticiones y ofrecer respuesta ultrarrápida.
   - Trazado de ruta vectorial en el mapa al hacer clic en cualquier vacante ("Ver Ruta").
   - Modo de estimación inteligente (fallback) en caso de no contar aún con la llave privada.

3. **Herramienta "Mi Lista de Opciones" (Organizador Pre-Evento)**:
   - Marcado de vacantes de interés (estrella ★).
   - Reordenamiento por orden de prioridad (1ª opción, 2ª opción...).
   - Guardado automático en `localStorage` del navegador.
   - **Impresión / Exportación a PDF**: Generación de una hoja formal lista para llevar el día de la asignación.
   - **Exportación a CSV**: Para abrir en Excel.

4. **Comparador Cara a Cara**:
   - Compara hasta 4 escuelas simultáneamente en una matriz visual.
   - Destaca la escuela más cercana, el trayecto más rápido y el tamaño escolar (número de grupos).

5. **Panel Administrativo Protegido**:
   - Acceso con autenticación formal de dos campos (Usuario / Correo y Contraseña).
   - Credenciales predeterminadas:
     - **Usuario**: `----`
     - **Contraseña**: `----`
   - Configurable mediante variables de entorno para despliegue en servidor (`ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`).
   - Carga masiva de catálogos de escuelas en formato CSV o Excel (.xlsx).
   - Carga de listas de vacantes para eventos próximos.
   - Configuración y prueba de conexión en vivo con la API de rutas.
   - Restablecimiento de datos de demostración de Chiapas.

---

## 🛠️ Requisitos e Instalación

### Requisitos Previos:
- **macOS**
- **XAMPP con MySQL en ejecución** (puerto 3306, usuario `root`).
- **Python 3.10+** (detectado en el sistema).

### Puesta en Marcha:
1. Asegúrate de que MySQL esté activo en tu panel de control de XAMPP.
2. Abre la terminal en esta carpeta y ejecuta:
```bash
./run.sh
```
3. Ingresa en tu navegador a:
```
http://localhost:8000
```

---

## 📂 Formato de Archivos para Carga Masiva (Admin)

### Catálogo de Escuelas (CSV o Excel):
Columnas aceptadas (con detección inteligente de nombres):
- `CCT` (Obligatorio, ej. `07DPR0521Z`)
- `Nombre` (Nombre oficial del plantel)
- `Nivel` (Primaria, Secundaria General, Técnica, Telesecundaria, Preescolar)
- `Turno` (Matutino, Vespertino, etc.)
- `Numero_Grupos` (Cantidad de grupos)
- `Municipio` (Tuxtla Gutiérrez, Chiapa de Corzo, etc.)
- `Lugar` (Colonia, localidad o domicilio)
- `Latitud` (Decimal, ej. `16.75782`)
- `Longitud` (Decimal, ej. `-93.12354`)

### Lista de Vacantes (CSV o Excel):
- `CCT` (Debe coincidir con una escuela cargada)
- `Tipo_Vacante` (Definitiva o Temporal)
- `Funcion` (Docente frente a grupo, Asignatura, Director, etc.)
- `Asignatura` (Matemáticas, Español, Primaria General, etc.)
- `Horas` (Opcional, número de horas para secundaria)
- `Motivo` (Jubilación, Renuncia, Cambio, etc.)
- `Observaciones` (Notas adicionales de la plaza)

---

## 🔑 Configuración de la API de Rutas

Puedes configurar tu llave privada de dos formas:
1. Desde el panel web: Haz clic en el botón **Admin** (arriba a la derecha), inicia sesión con tu usuario `-------` y contraseña `------`, ve a la pestaña **API de Rutas OSRM**, ingresa tu clave y haz clic en **Probar Conexión OSRM**.
2. Mediante variable de entorno en tu terminal:
```bash
export ROUTING_API_KEY="tu-llave-privada-aqui"
```
