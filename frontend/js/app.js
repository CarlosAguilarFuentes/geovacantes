import { VacantesMap } from './map.js';
import { RoutingService } from './routing-service.js';
import { PreferenceList } from './preference-list.js';
import { Comparator } from './comparator.js';
import { AdminModule } from './admin.js';
import { DiscardedVacancies } from './discarded-service.js';
import { CatalogPrint } from './catalog-print.js';

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
  const totalMin = Math.round(Number(minutes));
  if (totalMin < 60) {
    return `${totalMin} min`;
  }
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

class GeoVacantesApp {
  constructor() {
    this.routingService = new RoutingService();
    this.preferenceList = new PreferenceList();
    this.discardedVacancies = new DiscardedVacancies();
    this.comparator = new Comparator({
      onSelectRoute: (cct) => this.selectSchoolAndRoute(cct)
    });

    this.map = null;
    this.admin = null;
    this.catalogPrint = new CatalogPrint({
      routingService: this.routingService,
      getActiveEvent: () => this.activeEvent,
      getCurrentMainFilters: () => ({
        search: this.filters.search,
        nivel: this.filters.nivel,
        turno: this.filters.turno,
        municipio: this.filters.municipio,
        zona_economica: this.filters.zona_economica,
        tipo_vacante: this.filters.tipo_vacante
      })
    });

    this.currentVacancies = [];
    this.activeEvent = null;
    this.selectedCct = null;

    this.filters = {
      search: "",
      nivel: "",
      turno: "",
      municipio: "",
      zona_economica: "",
      tipo_vacante: "",
      max_time_min: null,
      sort_by: "distance"
    };

    this.progressiveEnrichAbortId = 0;

    this.init();
  }

  async init() {
    this.initMap();
    this.initAdmin();
    this.initEventListeners();
    this.initMobileView();
    this.subscribeState();
    this.checkDisclaimerNotice();

    await this.loadActiveEvent();
    await this.loadFilterOptions();
    await this.refreshVacancies();
  }

  initMap() {
    this.map = new VacantesMap("leaflet-map", {
      onOriginChange: (origin) => {
        this.updateOriginUI(origin);
        this.refreshVacancies();
      },
      onSchoolSelect: (cct) => {
        this.selectSchoolAndRoute(cct);
      }
    });

    this.updateOriginUI(this.map.origin);
  }

  initAdmin() {
    this.admin = new AdminModule({
      onDataChanged: async () => {
        await this.loadActiveEvent();
        await this.loadFilterOptions();
        await this.refreshVacancies();
      }
    });
  }

  subscribeState() {
    // Escuchar cambios en Mi Lista de Opciones
    this.preferenceList.subscribe((items) => {
      const favCount = document.getElementById("fav-count");
      if (favCount) favCount.textContent = items.length;
      this.renderDrawerList();
      this.updateCardStarStates();
    });

    // Escuchar cambios en Vacantes Descartadas
    this.discardedVacancies.subscribe((state) => {
      this.updateDiscardedUIState(state);
      this.renderVacanciesList();
      this.renderDrawerList();
      if (this.map) {
        this.map.renderSchools(this.currentVacancies, (id) => this.discardedVacancies.isDiscarded(id));
      }
    });

    // Escuchar cambios en Comparador
    this.comparator.subscribe((selected) => {
      const cmpCount = document.getElementById("compare-count");
      if (cmpCount) cmpCount.textContent = selected.length;
      this.comparator.renderModal("comparator-matrix-content");
      this.updateCardCompareStates();
    });
  }

  updateDiscardedUIState(state) {
    const summaryBar = document.getElementById("discarded-summary-bar");
    const countText = document.getElementById("discarded-count-text");
    const btnToggleHide = document.getElementById("btn-toggle-hide-discarded");
    const toggleIcon = document.getElementById("toggle-hide-icon");
    const toggleLabel = document.getElementById("toggle-hide-label");

    if (summaryBar) {
      summaryBar.style.display = state.discardedCount > 0 ? "inline-flex" : "none";
    }
    if (countText) {
      countText.textContent = state.discardedCount;
    }
    if (btnToggleHide) {
      btnToggleHide.classList.toggle("active", state.hideDiscarded);
      if (toggleIcon) toggleIcon.textContent = state.hideDiscarded ? "👁️‍🗨️" : "👁️";
      if (toggleLabel) toggleLabel.textContent = state.hideDiscarded ? "Mostrar descartadas" : "Ocultar descartadas";
    }

    // Actualizar barra de descartadas en el Drawer
    const drawerDiscardBar = document.getElementById("drawer-discard-bar");
    const drawerDiscardCount = document.getElementById("drawer-discarded-count");
    if (drawerDiscardBar && drawerDiscardCount) {
      const favItems = this.preferenceList.getItems();
      const favDiscardedCount = favItems.filter(item => this.discardedVacancies.isDiscarded(item.vacancy_id)).length;
      drawerDiscardBar.style.display = favDiscardedCount > 0 ? "flex" : "none";
      drawerDiscardCount.textContent = favDiscardedCount;
    }
  }

  updateOriginUI(origin) {
    const coordsEl = document.getElementById("origin-coords-display");
    const nameEl = document.getElementById("origin-name-display");
    if (coordsEl) coordsEl.textContent = `${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`;
    if (nameEl) nameEl.textContent = `📍 ${origin.name}`;
  }

  async loadActiveEvent() {
    this.activeEvent = await this.routingService.fetchActiveEvent();
    const eventNameDisplay = document.getElementById("event-name-display");
    if (eventNameDisplay) {
      if (this.activeEvent && this.activeEvent.nombre) {
        eventNameDisplay.textContent = `${this.activeEvent.nombre} (${this.activeEvent.total_vacancies || 0} plazas)`;
      } else {
        eventNameDisplay.textContent = "Sin evento activo seleccionado";
      }
    }
  }

  async loadFilterOptions() {
    const opts = await this.routingService.fetchFilterOptions();

    const selNivel = document.getElementById("filter-nivel");
    const selTurno = document.getElementById("filter-turno");
    const selMpio = document.getElementById("filter-municipio");
    const selZE = document.getElementById("filter-zona-economica");

    if (selNivel) {
      selNivel.innerHTML = '<option value="">Todos los niveles</option>' +
        opts.niveles.map(n => `<option value="${n}">${n}</option>`).join("");
    }
    if (selTurno) {
      selTurno.innerHTML = '<option value="">Todos los turnos</option>' +
        opts.turnos.map(t => `<option value="${t}">${t}</option>`).join("");
    }
    if (selMpio) {
      selMpio.innerHTML = '<option value="">Todos los municipios</option>' +
        opts.municipios.map(m => `<option value="${m}">${m}</option>`).join("");
    }
    if (selZE && opts.zonas_economicas) {
      selZE.innerHTML = '<option value="">Todas las Z.E.</option>' +
        opts.zonas_economicas.map(z => `<option value="${z}">Z.E. ${z}</option>`).join("");
    }
  }

  async refreshVacancies() {
    const vacanciesContainer = document.getElementById("vacancies-container");
    if (vacanciesContainer) {
      vacanciesContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; animation: spin 1s linear infinite;">⏳</div>
          Buscando y calculando distancias...
        </div>
      `;
    }

    const params = {
      search: this.filters.search,
      nivel: this.filters.nivel,
      turno: this.filters.turno,
      municipio: this.filters.municipio,
      zona_economica: this.filters.zona_economica,
      tipo_vacante: this.filters.tipo_vacante,
      origin_lat: this.map.origin.lat,
      origin_lon: this.map.origin.lon,
      max_time_min: this.filters.max_time_min,
      sort_by: this.filters.sort_by,
      limit: 150
    };

    const res = await this.routingService.fetchVacancies(params);
    this.currentVacancies = res.vacancies || [];

    // Actualizar conteo
    const countEl = document.getElementById("results-count-text");
    if (countEl) {
      countEl.textContent = `Mostrando ${this.currentVacancies.length} vacantes`;
    }

    const mobileListCount = document.getElementById("mobile-list-count");
    if (mobileListCount) {
      mobileListCount.textContent = this.currentVacancies.length;
    }

    const mobileFilterBadge = document.getElementById("mobile-filter-badge");
    if (mobileFilterBadge) {
      let activeCount = 0;
      if (this.filters.search) activeCount++;
      if (this.filters.nivel) activeCount++;
      if (this.filters.turno) activeCount++;
      if (this.filters.municipio) activeCount++;
      if (this.filters.zona_economica) activeCount++;
      if (this.filters.tipo_vacante) activeCount++;
      if (this.filters.max_time_min) activeCount++;
      mobileFilterBadge.textContent = activeCount > 0 ? `${activeCount} activos` : "Todos";
    }

    // Renderizar tarjetas
    this.renderVacanciesList();

    // Actualizar marcadores en mapa
    this.map.renderSchools(this.currentVacancies, (id) => this.discardedVacancies.isDiscarded(id));

    // Iniciar cálculo progresivo en segundo plano para obtener rutas viales exactas
    this.startProgressiveRouteCalculation();
  }

  async startProgressiveRouteCalculation() {
    const currentRunId = ++this.progressiveEnrichAbortId;
    const originLat = this.map.origin.lat;
    const originLon = this.map.origin.lon;

    // Obtener los CCTs que aún no tienen ruta exacta
    const pendingVacancies = this.currentVacancies.filter(v => !v.is_road_exact);
    if (pendingVacancies.length === 0) return;

    // CCTs únicos para consultar
    const pendingCcts = [...new Set(pendingVacancies.map(v => v.cct))];

    // Consultar progresivamente en lotes pequeños de 3 escuelas
    const batchSize = 3;
    for (let i = 0; i < pendingCcts.length; i += batchSize) {
      if (this.progressiveEnrichAbortId !== currentRunId) break;

      const chunk = pendingCcts.slice(i, i + batchSize);
      const routesResult = await this.routingService.fetchBatchRoutes(originLat, originLon, chunk);

      if (this.progressiveEnrichAbortId !== currentRunId) break;

      // Actualizar datos en memoria y en las tarjetas visibles
      for (const [cct, routeData] of Object.entries(routesResult)) {
        if (!routeData) continue;

        for (const v of this.currentVacancies) {
          if (v.cct === cct) {
            v.distance_km = routeData.distance_km;
            v.duration_min = routeData.duration_min;
            v.is_road_exact = true;

            this.updateCardRouteInfo(v);

            // Sincronizar también con Mi Lista si la vacante está guardada
            const favItem = this.preferenceList.items.find(item => item.vacancy_id === v.vacancy_id);
            if (favItem) {
              favItem.distance_km = routeData.distance_km;
              favItem.duration_min = routeData.duration_min;
            }
          }
        }
      }

      // Pequeña pausa para no saturar y mantener interfaz fluida
      await new Promise(r => setTimeout(r, 120));
    }

    if (this.progressiveEnrichAbortId === currentRunId) {
      this.preferenceList.save();
      this.map.renderSchools(this.currentVacancies, (id) => this.discardedVacancies.isDiscarded(id));
    }
  }

  updateCardRouteInfo(v) {
    const card = document.getElementById(`card-vac-${v.vacancy_id}`);
    if (!card) return;

    const metricBadge = card.querySelector(".travel-metrics-badge");
    if (!metricBadge) return;

    let commuteTag = "";
    if (v.duration_min !== null) {
      if (v.duration_min <= 45) {
        commuteTag = `<span class="commute-tag commute-easy">🚗 Diario Fácil (&le;45 min)</span>`;
      } else if (v.duration_min <= 75) {
        commuteTag = `<span class="commute-tag commute-moderate">⏳ Diario Moderado (45-75 min)</span>`;
      } else {
        commuteTag = `<span class="commute-tag commute-hard">🏔️ Foráneo / Semanal (&gt;75 min)</span>`;
      }
    }

    metricBadge.innerHTML = `
      <div class="metric-left">
        <div class="metric-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          <span>${v.distance_km} km</span>
        </div>
        <div class="metric-group" style="color: var(--accent-indigo);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${formatDuration(v.duration_min)}</span>
        </div>
      </div>
      ${commuteTag}
    `;
  }

  renderVacanciesList() {
    const container = document.getElementById("vacancies-container");
    if (!container) return;

    // Filtrar vacantes si el docente activó "Ocultar descartadas"
    let visibleVacancies = this.currentVacancies;
    if (this.discardedVacancies.hideDiscarded) {
      visibleVacancies = visibleVacancies.filter(v => !this.discardedVacancies.isDiscarded(v.vacancy_id));
    }

    if (visibleVacancies.length === 0) {
      const isFilteredByDiscarded = this.currentVacancies.length > 0 && this.discardedVacancies.hideDiscarded;
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">${isFilteredByDiscarded ? '📋' : '🔍'}</div>
          <h4>${isFilteredByDiscarded ? 'Todas las vacantes coincidentes han sido descartadas' : 'No se encontraron vacantes con los filtros seleccionados'}</h4>
          <p style="font-size: 0.82rem; margin-top: 0.4rem;">
            ${isFilteredByDiscarded ? 'Haz clic en "Mostrar descartadas" o "Restablecer" para volver a verlas.' : 'Prueba ampliando el tiempo de traslado o borrando la búsqueda.'}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = visibleVacancies.map((v) => {
      const isFav = this.preferenceList.isSaved(v.vacancy_id);
      const isCmp = this.comparator.isSelected(v.vacancy_id);
      const isDiscarded = this.discardedVacancies.isDiscarded(v.vacancy_id);
      const isSelectedRoute = this.selectedCct === v.cct;

      // Tag de viabilidad de viaje
      let commuteTag = "";
      if (v.duration_min !== null) {
        if (v.duration_min <= 45) {
          commuteTag = `<span class="commute-tag commute-easy">🚗 Diario Fácil (&le;45 min)</span>`;
        } else if (v.duration_min <= 75) {
          commuteTag = `<span class="commute-tag commute-moderate">⏳ Diario Moderado (45-75 min)</span>`;
        } else {
          commuteTag = `<span class="commute-tag commute-hard">🏔️ Foráneo / Semanal (&gt;75 min)</span>`;
        }
      }

      // Estilo de Zona Económica
      const zeVal = v.zona_economica || "60%";
      const zeClass = zeVal === "100%" ? "badge-ze-100" : (zeVal === "60%" ? "badge-ze-60" : "badge-ze-other");

      return `
        <div class="vacancy-card ${isSelectedRoute ? 'selected-route' : ''} ${isDiscarded ? 'discarded' : ''}" id="card-vac-${v.vacancy_id}" data-cct="${v.cct}">
          <div class="card-top-row">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="cct-tag">${v.cct}</span>
              <span class="badge-ze ${zeClass}" title="Zona Económica">💰 ${zeVal}</span>
              ${isDiscarded ? `<span class="badge-discarded-tag">❌ Descartada / Tomada</span>` : ''}
            </div>
            <span class="vacancy-badge ${v.tipo_vacante.toLowerCase().includes('temporal') ? 'badge-temporal' : 'badge-definitiva'}">
              ${v.tipo_vacante}
            </span>
          </div>

          <h3 class="school-title">${v.escuela_nombre}</h3>

          <div class="vacancy-details-grid">
            <div class="detail-item"><strong>Nivel:</strong> ${v.nivel}</div>
            <div class="detail-item"><strong>Turno:</strong> ${v.turno}</div>
            <div class="detail-item"><strong>Grupos:</strong> ${v.numero_grupos}</div>
            <div class="detail-item"><strong>Municipio:</strong> ${v.municipio}</div>
            <div class="detail-item"><strong>Zona Eco:</strong> ${zeVal}</div>
            <div class="detail-item"><strong>Z. Escolar:</strong> ${v.zona_escolar || 'N/A'}</div>
            <div class="detail-item" style="grid-column: span 2;">
              <strong>Función:</strong> ${v.asignatura} (${v.categoria_funcion})
            </div>
            ${v.lugar ? `<div class="detail-item" style="grid-column: span 2;"><strong>Lugar:</strong> ${v.lugar}</div>` : ''}
          </div>

          ${v.distance_km !== null ? `
            <div class="travel-metrics-badge">
              <div class="metric-left">
                <div class="metric-group">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                  <span>${v.distance_km} km</span>
                </div>
                <div class="metric-group" style="color: var(--accent-indigo);">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${formatDuration(v.duration_min)}</span>
                </div>
              </div>
              ${commuteTag}
            </div>
          ` : ''}

          <div class="card-actions-row">
            <button class="btn btn-secondary btn-sm btn-draw-route" data-cct="${v.cct}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              <span>Ver Ruta</span>
            </button>

            <button class="btn btn-secondary btn-sm btn-toggle-compare ${isCmp ? 'active' : ''}" data-vacid="${v.vacancy_id}" title="Agregar al comparador">
              <span>${isCmp ? '✓ Comparando' : '⚖️ Comparar'}</span>
            </button>

            <button class="btn-star ${isFav ? 'active' : ''}" data-vacid="${v.vacancy_id}" title="${isFav ? 'Quitar de mi lista' : 'Guardar en mi lista de opciones'}">
              ★
            </button>

            <button class="btn-discard ${isDiscarded ? 'active' : ''}" data-vacid="${v.vacancy_id}" title="${isDiscarded ? 'Vacante tachada/tomada (Haz clic para reactivar)' : 'Tachar o descartar vacante (ya fue tomada en el evento)'}">
              ${isDiscarded ? '❌' : '✕'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.bindCardActions();
  }

  bindCardActions() {
    const container = document.getElementById("vacancies-container");
    if (!container) return;

    // Ver ruta
    container.querySelectorAll(".btn-draw-route").forEach(btn => {
      btn.addEventListener("click", () => {
        const cct = btn.dataset.cct;
        this.selectSchoolAndRoute(cct);
      });
    });

    // Favorito / Mi lista
    container.querySelectorAll(".btn-star").forEach(btn => {
      btn.addEventListener("click", () => {
        const vacId = parseInt(btn.dataset.vacid);
        const vacancy = this.currentVacancies.find(v => v.vacancy_id === vacId);
        if (vacancy) {
          const isNowSaved = this.preferenceList.toggle(vacancy, this.filters.sort_by);
          btn.classList.toggle("active", isNowSaved);
          this.showToast(isNowSaved ? `★ Guardada en tu lista de opciones: ${vacancy.escuela_nombre}` : `Eliminada de tu lista`);
        }
      });
    });

    // Descartar / Tachar vacante localmente
    container.querySelectorAll(".btn-discard").forEach(btn => {
      btn.addEventListener("click", () => {
        const vacId = parseInt(btn.dataset.vacid);
        const vacancy = this.currentVacancies.find(v => v.vacancy_id === vacId);
        const isNowDiscarded = this.discardedVacancies.toggle(vacId);
        if (vacancy) {
          this.showToast(isNowDiscarded 
            ? `❌ Descartada localmente: ${vacancy.escuela_nombre} (${vacancy.cct})` 
            : `↺ Reactivada: ${vacancy.escuela_nombre} (${vacancy.cct})`
          );
        }
      });
    });

    // Comparar
    container.querySelectorAll(".btn-toggle-compare").forEach(btn => {
      btn.addEventListener("click", () => {
        const vacId = parseInt(btn.dataset.vacid);
        const vacancy = this.currentVacancies.find(v => v.vacancy_id === vacId);
        if (vacancy) {
          const isNowCmp = this.comparator.toggle(vacancy);
          btn.classList.toggle("active", isNowCmp);
          btn.querySelector("span").textContent = isNowCmp ? "✓ Comparando" : "⚖️ Comparar";
        }
      });
    });
  }

  async selectSchoolAndRoute(cct) {
    this.selectedCct = cct;

    // Resaltar tarjeta seleccionada
    document.querySelectorAll(".vacancy-card").forEach(c => {
      if (c.dataset.cct === cct) {
        c.classList.add("selected-route");
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove("selected-route");
      }
    });

    // Calcular y dibujar ruta
    const route = await this.routingService.getRoute(
      this.map.origin.lat,
      this.map.origin.lon,
      cct
    );

    if (route) {
      this.map.drawRoute(
        route.geometry,
        route.distance_meters,
        route.duration_seconds,
        route.school_name
      );

      const km = (route.distance_meters / 1000).toFixed(1);
      const formattedTime = formatDuration(route.duration_seconds / 60);
      const srcText = route.is_simulated ? "(Estimación aproximada)" : "(API Ruteo Carretero Carlos Aguilar)";
      this.showToast(`🚗 Ruta a ${route.school_name}: ${km} km • ${formattedTime} ${srcText}`);

      // Si está en pantalla móvil, cambiar automáticamente al mapa y mostrar la ficha flotante
      if (window.innerWidth <= 900) {
        if (this.setMobileViewMode) {
          this.setMobileViewMode("map");
        }
        const routeCard = document.getElementById("mobile-map-route-card");
        const nameEl = document.getElementById("mobile-route-school-name");
        const metaEl = document.getElementById("mobile-route-school-meta");
        if (routeCard && nameEl && metaEl) {
          nameEl.textContent = route.school_name || cct;
          metaEl.textContent = `⏱️ ${formattedTime} • 🚗 ${km} km`;
          routeCard.style.display = "flex";
        }
      }
    }
  }

  renderDrawerList() {
    const listContainer = document.getElementById("drawer-items-list");
    if (!listContainer) return;

    const items = this.preferenceList.getItems();
    if (items.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⭐</div>
          <h4>Tu lista de opciones está vacía</h4>
          <p style="font-size: 0.85rem; margin-top: 0.4rem;">
            Presiona la estrella ★ en las vacantes que te interesen para armar tu lista de prelación antes del evento.
          </p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = items.map((item, idx) => {
      const isDisc = this.discardedVacancies.isDiscarded(item.vacancy_id);
      return `
        <div class="drawer-item ${isDisc ? 'discarded' : ''}" data-index="${idx}">
          <div class="priority-number">${idx + 1}º</div>
          <div class="drawer-item-content">
            <div class="drawer-item-title">
              ${item.escuela_nombre}
              ${isDisc ? '<span style="font-size: 0.7rem; color: #ff6b81; font-weight: 700; margin-left: 6px;">[DESCARTADA]</span>' : ''}
            </div>
            <div class="drawer-item-sub">
              <span style="font-family: monospace; font-weight: 600;">${item.cct}</span>
              <span>• ${item.turno}</span>
              <span>• ${item.municipio}</span>
              <span style="color: ${item.zona_economica === '100%' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'}; font-weight: 700;">• ZE: ${item.zona_economica || '60%'}</span>
            </div>
            ${item.distance_km ? `
              <div style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600; margin-top: 2px;">
                🚗 ${item.distance_km} km • ⏱️ ${formatDuration(item.duration_min)}
              </div>
            ` : ''}
          </div>
          <div class="drawer-item-actions">
            <button class="btn-icon-move btn-move-up" data-index="${idx}" title="Subir prioridad" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-icon-move btn-move-down" data-index="${idx}" title="Bajar prioridad" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn-icon-move btn-toggle-discard-fav" data-id="${item.vacancy_id}" title="${isDisc ? 'Reactivar opción (quitar tacha)' : 'Tachar opción (alguien ya la eligió)'}" style="color: ${isDisc ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-size: 11px;">
              ${isDisc ? '↺' : '❌'}
            </button>
            <button class="btn-icon-move btn-remove-fav" data-id="${item.vacancy_id}" title="Eliminar de mi lista" style="color: var(--text-dim); font-size: 11px;">✕</button>
          </div>
        </div>
      `;
    }).join("");

    // Eventos mover
    listContainer.querySelectorAll(".btn-move-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index);
        this.preferenceList.move(i, i - 1);
      });
    });

    listContainer.querySelectorAll(".btn-move-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index);
        this.preferenceList.move(i, i + 1);
      });
    });

    // Descartar/Tachar dentro de Mi Lista
    listContainer.querySelectorAll(".btn-toggle-discard-fav").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        const isDisc = this.discardedVacancies.toggle(id);
        const item = items.find(it => it.vacancy_id === id);
        if (item) {
          this.showToast(isDisc ? `❌ Opción tachada: ${item.escuela_nombre}` : `↺ Opción reactivada: ${item.escuela_nombre}`);
        }
      });
    });

    listContainer.querySelectorAll(".btn-remove-fav").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        this.preferenceList.remove(id);
      });
    });
  }

  updateCardStarStates() {
    document.querySelectorAll(".btn-star").forEach(btn => {
      const vacId = parseInt(btn.dataset.vacid);
      btn.classList.toggle("active", this.preferenceList.isSaved(vacId));
    });
  }

  updateCardCompareStates() {
    document.querySelectorAll(".btn-toggle-compare").forEach(btn => {
      const vacId = parseInt(btn.dataset.vacid);
      const isCmp = this.comparator.isSelected(vacId);
      btn.classList.toggle("active", isCmp);
      const label = btn.querySelector("span");
      if (label) label.textContent = isCmp ? "✓ Comparando" : "⚖️ Comparar";
    });
  }

  initEventListeners() {
    // Búsqueda con debounce
    const searchInput = document.getElementById("search-input");
    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filters.search = e.target.value;
          this.refreshVacancies();
        }, 350);
      });
    }

    // Filtros dropdown
    const filterNivel = document.getElementById("filter-nivel");
    const filterTurno = document.getElementById("filter-turno");
    const filterMpio = document.getElementById("filter-municipio");
    const filterZE = document.getElementById("filter-zona-economica");
    const filterTipo = document.getElementById("filter-tipo");

    if (filterNivel) filterNivel.addEventListener("change", (e) => { this.filters.nivel = e.target.value; this.refreshVacancies(); });
    if (filterTurno) filterTurno.addEventListener("change", (e) => { this.filters.turno = e.target.value; this.refreshVacancies(); });
    if (filterMpio) filterMpio.addEventListener("change", (e) => { this.filters.municipio = e.target.value; this.refreshVacancies(); });
    if (filterZE) filterZE.addEventListener("change", (e) => { this.filters.zona_economica = e.target.value; this.refreshVacancies(); });
    if (filterTipo) filterTipo.addEventListener("change", (e) => { this.filters.tipo_vacante = e.target.value; this.refreshVacancies(); });

    // Slider de tiempo máximo
    const timeSlider = document.getElementById("time-filter-slider");
    const timeLabel = document.getElementById("time-filter-label");
    const btnResetTime = document.getElementById("btn-reset-time-filter");

    if (timeSlider && timeLabel) {
      timeSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (val >= 180) {
          timeLabel.textContent = "Sin límite";
          this.filters.max_time_min = null;
        } else {
          timeLabel.textContent = `≤ ${val} min`;
          this.filters.max_time_min = val;
        }
        this.refreshVacancies();
      });
    }

    if (btnResetTime && timeSlider && timeLabel) {
      btnResetTime.addEventListener("click", () => {
        timeSlider.value = 180;
        timeLabel.textContent = "Sin límite";
        this.filters.max_time_min = null;
        this.refreshVacancies();
      });
    }

    // Ordenamiento general
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        const newSort = e.target.value;
        this.filters.sort_by = newSort;
        
        // Reordenar automáticamente Mi Lista según el criterio del filtro activo
        this.preferenceList.sortByCriteria(newSort, true);

        // Reflejar en el selector del drawer si está abierto
        const drawerSortSelect = document.getElementById("drawer-sort-select");
        if (drawerSortSelect) {
          drawerSortSelect.value = newSort;
        }

        this.refreshVacancies();
      });
    }

    // Botones de Origen
    const btnGps = document.getElementById("btn-gps-origin");
    if (btnGps) {
      btnGps.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Tu navegador no soporta geolocalización");
          return;
        }
        btnGps.textContent = "Obteniendo...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btnGps.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2"/><path d="M12 20v2"/><circle cx="12" cy="12" r="7"/></svg>
              Mi Ubicación
            `;
            this.map.setOrigin(pos.coords.latitude, pos.coords.longitude, "Mi Ubicación Actual (GPS)");
            this.showToast("📍 Origen fijado con tu ubicación actual.");
          },
          (err) => {
            btnGps.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2"/><path d="M12 20v2"/><circle cx="12" cy="12" r="7"/></svg>
              Mi Ubicación
            `;
            alert("No se pudo obtener tu ubicación: " + err.message);
          }
        );
      });
    }

    const btnChangeMap = document.getElementById("btn-change-origin-map");
    if (btnChangeMap) {
      btnChangeMap.addEventListener("click", () => {
        this.map.enableOriginPicker();
        this.showToast("🎯 Modo activo: Haz clic en el mapa para ubicar tu nuevo origen");
      });
    }

    const btnSearchCity = document.getElementById("btn-search-city");
    const cityModal = document.getElementById("city-origin-modal");
    const btnCloseCity = document.getElementById("btn-close-city-modal");
    const citySearchInput = document.getElementById("city-search-input");
    const citySearchLoading = document.getElementById("city-search-loading");
    const citySearchResults = document.getElementById("city-search-results");

    if (btnSearchCity && cityModal) {
      btnSearchCity.addEventListener("click", () => {
        cityModal.classList.add("open");
        if (citySearchInput) {
          setTimeout(() => citySearchInput.focus(), 150);
        }
      });
    }

    if (btnCloseCity && cityModal) {
      btnCloseCity.addEventListener("click", () => cityModal.classList.remove("open"));
    }

    // Búsqueda en vivo de colonia/calle/localidad con geo.carlosaguilar.mx
    let citySearchDebounce;
    if (citySearchInput) {
      citySearchInput.addEventListener("input", (e) => {
        clearTimeout(citySearchDebounce);
        const query = e.target.value.trim();

        if (query.length < 2) {
          if (citySearchResults) {
            citySearchResults.style.display = "none";
            citySearchResults.innerHTML = "";
          }
          if (citySearchLoading) citySearchLoading.style.display = "none";
          return;
        }

        if (citySearchLoading) citySearchLoading.style.display = "block";

        citySearchDebounce = setTimeout(async () => {
          const results = await this.routingService.searchGeocoding(query);
          if (citySearchLoading) citySearchLoading.style.display = "none";

          if (!citySearchResults) return;

          if (results.length === 0) {
            citySearchResults.style.display = "flex";
            citySearchResults.innerHTML = `
              <div style="font-size: 0.8rem; color: var(--text-dim); padding: 0.5rem; text-align: center;">
                No se encontraron coincidencias para "${query}". Intenta con otra referencia o selecciona un punto directo abajo.
              </div>
            `;
            return;
          }

          citySearchResults.style.display = "flex";
          citySearchResults.innerHTML = results.map(item => `
            <div class="geocode-result-item" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.display_name.replace(/"/g, '&quot;')}" style="padding: 0.55rem 0.75rem; border-radius: 6px; background: rgba(255,255,255,0.04); cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: background 0.15s ease;">
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); display: flex; align-items: center; justify-content: space-between;">
                <span>📍 ${item.display_name.split(',')[0]}</span>
                <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; background: rgba(6,182,212,0.15); color: var(--accent-cyan); text-transform: uppercase;">${item.type || 'lugar'}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${item.display_name}
              </div>
            </div>
          `).join("");

          // Asignar clic a cada resultado de geocodificación
          citySearchResults.querySelectorAll(".geocode-result-item").forEach(itemEl => {
            itemEl.addEventListener("mouseenter", () => {
              itemEl.style.background = "rgba(6,182,212,0.15)";
            });
            itemEl.addEventListener("mouseleave", () => {
              itemEl.style.background = "rgba(255,255,255,0.04)";
            });
            itemEl.addEventListener("click", () => {
              const lat = parseFloat(itemEl.dataset.lat);
              const lon = parseFloat(itemEl.dataset.lon);
              const name = itemEl.dataset.name;

              this.map.setOrigin(lat, lon, name);
              this.map.recenterOrigin();
              if (cityModal) cityModal.classList.remove("open");
              this.showToast(`📍 Origen fijado: ${name.split(',')[0]}`);
            });
          });
        }, 320);
      });
    }

    // Botones preconfigurados rápidos
    document.querySelectorAll(".city-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const name = btn.dataset.name;
        this.map.setOrigin(lat, lon, name);
        this.map.recenterOrigin();
        if (cityModal) cityModal.classList.remove("open");
        this.showToast(`📍 Origen cambiado a ${name}`);
      });
    });

    // Botones de Mapa Flotantes
    const btnRecenter = document.getElementById("btn-recenter-origin");
    if (btnRecenter) btnRecenter.addEventListener("click", () => this.map.recenterOrigin());

    const btnFitAll = document.getElementById("btn-fit-all-schools");
    if (btnFitAll) btnFitAll.addEventListener("click", () => this.map.fitAll());

    const btnToggleTiles = document.getElementById("btn-toggle-tiles");
    if (btnToggleTiles) {
      btnToggleTiles.addEventListener("click", () => {
        const theme = this.map.toggleTileTheme();
        this.showToast(`Capa de mapa: ${theme === 'topo' ? 'Relieve Topográfico' : 'OpenStreetMap Estándar'}`);
      });
    }

    // Modal Comparador
    const btnOpenCmp = document.getElementById("btn-open-comparator");
    const cmpModal = document.getElementById("comparator-modal");
    const btnCloseCmp = document.getElementById("btn-close-comparator");
    const btnCloseCmp2 = document.getElementById("btn-close-comparator-btn");
    const btnClearCmp = document.getElementById("btn-clear-comparator");

    if (btnOpenCmp && cmpModal) {
      btnOpenCmp.addEventListener("click", () => {
        this.comparator.renderModal("comparator-matrix-content");
        cmpModal.classList.add("open");
      });
    }
    if (btnCloseCmp && cmpModal) btnCloseCmp.addEventListener("click", () => cmpModal.classList.remove("open"));
    if (btnCloseCmp2 && cmpModal) btnCloseCmp2.addEventListener("click", () => cmpModal.classList.remove("open"));
    if (btnClearCmp) {
      btnClearCmp.addEventListener("click", () => {
        this.comparator.clear();
        this.comparator.renderModal("comparator-matrix-content");
      });
    }

    // Drawer Mi Lista
    const btnOpenDrawer = document.getElementById("btn-open-preference-list");
    const drawer = document.getElementById("preference-drawer");
    const btnCloseDrawer = document.getElementById("btn-close-drawer");
    const btnClearFav = document.getElementById("btn-clear-favorites");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnPrintList = document.getElementById("btn-print-preference-list");

    if (btnOpenDrawer && drawer) {
      btnOpenDrawer.addEventListener("click", () => {
        // Al abrir el drawer, sincronizar el selector del drawer con el filtro de orden activo
        const drawerSortSelect = document.getElementById("drawer-sort-select");
        if (drawerSortSelect) {
          drawerSortSelect.value = this.filters.sort_by || "distance";
        }
        drawer.classList.add("open");
      });
    }
    if (btnCloseDrawer && drawer) btnCloseDrawer.addEventListener("click", () => drawer.classList.remove("open"));

    // Controles de Ordenamiento dentro de Mi Lista
    const drawerSortSelect = document.getElementById("drawer-sort-select");
    const btnSyncDrawerSort = document.getElementById("btn-sync-drawer-sort");

    if (drawerSortSelect) {
      drawerSortSelect.addEventListener("change", (e) => {
        const crit = e.target.value;
        this.preferenceList.sortByCriteria(crit, true);
        this.showToast(`📊 Mi Lista ordenada por: ${drawerSortSelect.options[drawerSortSelect.selectedIndex].text}`);
      });
    }

    if (btnSyncDrawerSort) {
      btnSyncDrawerSort.addEventListener("click", () => {
        const crit = drawerSortSelect ? drawerSortSelect.value : (this.filters.sort_by || "distance");
        this.preferenceList.sortByCriteria(crit, true);
        this.showToast(`⚡ Mi Lista reordenada según: ${crit}`);
      });
    }

    if (btnClearFav) {
      btnClearFav.addEventListener("click", () => {
        if (confirm("¿Seguro que deseas vaciar tu lista de opciones?")) {
          this.preferenceList.clear();
        }
      });
    }
    // Botones de Vacantes Descartadas en Vivo
    const btnToggleHideDiscarded = document.getElementById("btn-toggle-hide-discarded");
    if (btnToggleHideDiscarded) {
      btnToggleHideDiscarded.addEventListener("click", () => {
        const isHidden = this.discardedVacancies.toggleHideDiscarded();
        this.showToast(isHidden ? "🙈 Ocultando vacantes descartadas" : "👁️ Mostrando todas las vacantes (con tachadas)");
      });
    }

    const btnRestoreAllDiscarded = document.getElementById("btn-restore-all-discarded");
    if (btnRestoreAllDiscarded) {
      btnRestoreAllDiscarded.addEventListener("click", () => {
        if (confirm("¿Deseas restablecer todas las vacantes descartadas localmente y volverlas a marcar como disponibles?")) {
          this.discardedVacancies.restoreAll();
          this.showToast("↺ Todas las vacantes han sido restablecidas localmente");
        }
      });
    }

    const btnDrawerRestoreDiscarded = document.getElementById("btn-drawer-restore-discarded");
    if (btnDrawerRestoreDiscarded) {
      btnDrawerRestoreDiscarded.addEventListener("click", () => {
        const favItems = this.preferenceList.getItems();
        favItems.forEach(item => this.discardedVacancies.restore(item.vacancy_id));
        this.showToast("↺ Opciones de tu lista restablecidas");
      });
    }

    if (btnExportCsv) {
      btnExportCsv.addEventListener("click", () => {
        const eventName = this.activeEvent ? this.activeEvent.nombre : "Vacantes_2026";
        const discIds = new Set(this.discardedVacancies.getState().discardedIds);
        this.preferenceList.exportCSV(eventName, discIds);
      });
    }
    if (btnPrintList) {
      btnPrintList.addEventListener("click", () => {
        const eventName = this.activeEvent ? this.activeEvent.nombre : "Proceso de Asignación Docente 2026";
        const discIds = new Set(this.discardedVacancies.getState().discardedIds);
        this.preferenceList.printSheet(eventName, this.map.origin.name, discIds);
      });
    }

    // Modal de Advertencia y Deslinde de Responsabilidad
    const disclaimerModal = document.getElementById("disclaimer-modal");
    const checkboxAgree = document.getElementById("checkbox-disclaimer-agree");
    const btnAcceptDisclaimer = document.getElementById("btn-accept-disclaimer");
    const disclaimerHintText = document.getElementById("disclaimer-hint-text");
    const btnOpenDisclaimer = document.getElementById("btn-open-disclaimer");

    if (checkboxAgree && btnAcceptDisclaimer) {
      checkboxAgree.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        btnAcceptDisclaimer.disabled = !isChecked;
        btnAcceptDisclaimer.style.opacity = isChecked ? "1" : "0.5";
        btnAcceptDisclaimer.style.cursor = isChecked ? "pointer" : "not-allowed";
        if (disclaimerHintText) {
          disclaimerHintText.textContent = isChecked ? "✓ Listo para acceder al sistema" : "Marca la casilla para continuar";
        }
      });

      btnAcceptDisclaimer.addEventListener("click", () => {
        try {
          localStorage.setItem("geovacantes_disclaimer_accepted", "true");
          localStorage.setItem("geovacantes_disclaimer_date", new Date().toISOString());
        } catch (err) {
          console.warn("No se pudo guardar aceptación en localStorage:", err);
        }
        if (disclaimerModal) disclaimerModal.classList.remove("open");
        this.showToast("✅ Bienvenido. Consulta vacantes y traza tus rutas de traslado.");
      });
    }

    if (btnOpenDisclaimer && disclaimerModal) {
      btnOpenDisclaimer.addEventListener("click", () => {
        // Al abrirlo voluntariamente, marcar casilla y permitir cerrar directo
        if (checkboxAgree) checkboxAgree.checked = true;
        if (btnAcceptDisclaimer) {
          btnAcceptDisclaimer.disabled = false;
          btnAcceptDisclaimer.style.opacity = "1";
          btnAcceptDisclaimer.style.cursor = "pointer";
        }
        if (disclaimerHintText) {
          disclaimerHintText.textContent = "Puedes volver a leer las consideraciones cuando lo necesites";
        }
        disclaimerModal.classList.add("open");
      });
    }

    // Modal Admin
    const btnOpenAdmin = document.getElementById("btn-open-admin");
    const adminModal = document.getElementById("admin-modal");
    const btnCloseAdmin = document.getElementById("btn-close-admin");

    if (btnOpenAdmin && adminModal) btnOpenAdmin.addEventListener("click", () => adminModal.classList.add("open"));
    if (btnCloseAdmin && adminModal) btnCloseAdmin.addEventListener("click", () => adminModal.classList.remove("open"));
  }

  checkDisclaimerNotice() {
    const isAccepted = localStorage.getItem("geovacantes_disclaimer_accepted");
    const disclaimerModal = document.getElementById("disclaimer-modal");
    if (!isAccepted && disclaimerModal) {
      setTimeout(() => {
        disclaimerModal.classList.add("open");
      }, 200);
    }
  }

  initMobileView() {
    this.mobileViewMode = "list"; // "list" | "map"
    const workspace = document.querySelector(".main-workspace");
    const btnList = document.getElementById("btn-mobile-show-list");
    const btnMap = document.getElementById("btn-mobile-show-map");
    const btnToggleFilters = document.getElementById("btn-toggle-filters-mobile");
    const filtersWrapper = document.getElementById("filters-collapsible-wrapper");
    const btnReturnList = document.getElementById("btn-mobile-return-list");
    const btnCloseRouteCard = document.getElementById("btn-close-mobile-route-card");
    const routeCard = document.getElementById("mobile-map-route-card");

    const updateView = (mode) => {
      this.mobileViewMode = mode;
      if (workspace) {
        workspace.classList.remove("mobile-mode-list", "mobile-mode-map");
        workspace.classList.add(mode === "map" ? "mobile-mode-map" : "mobile-mode-list");
      }
      if (btnList) btnList.classList.toggle("active", mode === "list");
      if (btnMap) btnMap.classList.toggle("active", mode === "map");

      if (mode === "map") {
        if (this.map && this.map.map) {
          const resizeMap = () => {
            if (this.map && this.map.map) {
              this.map.map.invalidateSize();
              if (this.selectedCct) {
                const school = this.currentVacancies.find(v => v.cct === this.selectedCct);
                if (school && school.latitud && school.longitud) {
                  this.map.map.panTo([school.latitud, school.longitud]);
                }
              }
            }
          };
          setTimeout(resizeMap, 60);
          setTimeout(resizeMap, 250);
        }
      }
    };

    if (btnList) btnList.addEventListener("click", () => updateView("list"));
    if (btnMap) btnMap.addEventListener("click", () => updateView("map"));

    if (btnReturnList) {
      btnReturnList.addEventListener("click", () => {
        updateView("list");
        if (this.selectedCct) {
          const card = document.querySelector(`.vacancy-card[data-cct="${this.selectedCct}"]`);
          if (card) {
            setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
          }
        }
      });
    }

    if (btnCloseRouteCard && routeCard) {
      btnCloseRouteCard.addEventListener("click", () => {
        routeCard.style.display = "none";
      });
    }

    if (btnToggleFilters && filtersWrapper) {
      btnToggleFilters.addEventListener("click", () => {
        const isOpen = filtersWrapper.classList.toggle("open");
        btnToggleFilters.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const chevron = document.getElementById("filter-chevron-icon");
        if (chevron) chevron.textContent = isOpen ? "▲" : "▼";
      });
    }

    // Configuración inicial en pantallas móviles
    if (workspace && window.innerWidth <= 900) {
      workspace.classList.add("mobile-mode-list");
    }

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) {
        if (workspace) workspace.classList.remove("mobile-mode-list", "mobile-mode-map");
        if (this.map && this.map.map) this.map.map.invalidateSize();
      } else {
        if (workspace && !workspace.classList.contains("mobile-mode-list") && !workspace.classList.contains("mobile-mode-map")) {
          workspace.classList.add(this.mobileViewMode === "map" ? "mobile-mode-map" : "mobile-mode-list");
        }
      }
    });

    this.setMobileViewMode = updateView;
  }

  showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Iniciar aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  window.app = new GeoVacantesApp();
});
