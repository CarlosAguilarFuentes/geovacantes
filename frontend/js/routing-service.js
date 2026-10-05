/**
 * Servicio de Comunicación con la API REST y Gestión de Rutas
 */
export class RoutingService {
  constructor() {
    this.baseUrl = "/api";
    this.routeCache = new Map(); // Llave: `${origin_lat}_${origin_lon}_${cct}`
  }

  async fetchActiveEvent() {
    try {
      const res = await fetch(`${this.baseUrl}/events/active`);
      if (!res.ok) throw new Error("Error al obtener evento");
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async fetchFilterOptions() {
    try {
      const res = await fetch(`${this.baseUrl}/filter-options`);
      if (!res.ok) throw new Error("Error al obtener opciones de filtro");
      return await res.json();
    } catch (err) {
      console.error(err);
      return { municipios: [], niveles: [], turnos: [], tipos_vacante: [] };
    }
  }

  async fetchVacancies(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        query.append(key, value);
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/vacancies?${query.toString()}`);
      if (!res.ok) throw new Error("Error al cargar vacantes");
      return await res.json();
    } catch (err) {
      console.error(err);
      return { total: 0, vacancies: [] };
    }
  }

  async fetchVacanciesCatalog(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        query.append(key, value);
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/vacancies/catalog?${query.toString()}`);
      if (!res.ok) throw new Error("Error al cargar catálogo de vacantes");
      return await res.json();
    } catch (err) {
      console.error(err);
      return { total: 0, vacancies: [] };
    }
  }

  async getRoute(originLat, originLon, destCct) {
    const cacheKey = `${originLat.toFixed(4)}_${originLon.toFixed(4)}_${destCct}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }

    try {
      const res = await fetch(`${this.baseUrl}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_lat: originLat,
          origin_lon: originLon,
          dest_cct: destCct
        })
      });

      if (!res.ok) throw new Error("Error al calcular ruta");
      const data = await res.json();
      this.routeCache.set(cacheKey, data);
      return data;
    } catch (err) {
      console.error("Error obteniendo ruta:", err);
      return null;
    }
  }

  async fetchBatchRoutes(originLat, originLon, ccts) {
    if (!ccts || ccts.length === 0) return {};
    try {
      const res = await fetch(`${this.baseUrl}/routes/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_lat: originLat,
          origin_lon: originLon,
          ccts: ccts
        })
      });
      if (!res.ok) throw new Error("Error en batch routes");
      const data = await res.json();
      return data.routes || {};
    } catch (err) {
      console.error("Error en fetchBatchRoutes:", err);
      return {};
    }
  }

  async searchGeocoding(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await fetch(`${this.baseUrl}/geocode?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error("Error consultando geocodificación");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Error en searchGeocoding:", err);
      return [];
    }
  }
}
