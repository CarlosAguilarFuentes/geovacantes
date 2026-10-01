/**
 * Módulo de Gestión del Mapa Interactivo (Leaflet)
 */
import { formatDuration } from './app.js';

export class VacantesMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.onOriginChange = options.onOriginChange || (() => {});
    this.onSchoolSelect = options.onSchoolSelect || (() => {});

    // Origen predeterminado (Tuxtla Gutiérrez Centro)
    this.origin = {
      lat: 16.7530,
      lon: -93.1150,
      name: "Tuxtla Gutiérrez (Centro)"
    };

    this.map = null;
    this.originMarker = null;
    this.radiusCircle = null;
    this.schoolsLayer = L.layerGroup();
    this.routeLayer = L.layerGroup();
    this.tileLayer = null;
    this.currentTileTheme = "dark";
    
    this.isPickingOrigin = false;
    this.pickerIndicatorEl = null;

    this.init();
  }

  init() {
    this.map = L.map(this.containerId, {
      center: [this.origin.lat, this.origin.lon],
      zoom: 12,
      zoomControl: true
    });

    // Capa base estándar de OpenStreetMap
    this.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores',
      maxZoom: 19
    }).addTo(this.map);

    this.schoolsLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);

    // Crear marcador de origen
    this.updateOriginMarker();

    // Evento de clic en el mapa: SOLO si el usuario activó "Fijar en Mapa"
    this.map.on("click", (e) => {
      if (this.isPickingOrigin) {
        this.setOrigin(e.latlng.lat, e.latlng.lng, `Punto en mapa (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
        this.disableOriginPicker();
      }
    });
  }

  enableOriginPicker(onPick) {
    this.isPickingOrigin = true;
    const mapEl = document.getElementById(this.containerId);
    if (mapEl) mapEl.style.cursor = "crosshair";
    this.showPickerIndicator();
  }

  disableOriginPicker() {
    this.isPickingOrigin = false;
    const mapEl = document.getElementById(this.containerId);
    if (mapEl) mapEl.style.cursor = "";
    this.hidePickerIndicator();
  }

  showPickerIndicator() {
    if (!this.pickerIndicatorEl) {
      this.pickerIndicatorEl = document.createElement("div");
      this.pickerIndicatorEl.className = "map-picker-banner";
      this.pickerIndicatorEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem;">🎯</span>
          <span><strong>Modo selección activo:</strong> Haz clic en el mapa para ubicar tu nuevo origen</span>
          <button id="btn-cancel-origin-pick" class="btn btn-secondary btn-sm" style="background: rgba(0,0,0,0.5); color: #fff; padding: 2px 8px; border-radius: 4px;">✕ Cancelar</button>
        </div>
      `;
      const mapPanel = document.querySelector(".map-panel");
      if (mapPanel) mapPanel.appendChild(this.pickerIndicatorEl);

      const cancelBtn = this.pickerIndicatorEl.querySelector("#btn-cancel-origin-pick");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.disableOriginPicker();
        });
      }
    }
    this.pickerIndicatorEl.style.display = "block";
  }

  hidePickerIndicator() {
    if (this.pickerIndicatorEl) {
      this.pickerIndicatorEl.style.display = "none";
    }
  }

  setTileTheme(theme = "osm") {
    // Mantener OpenStreetMap estándar directo y nítido
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    const url = theme === "topo"
      ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attr = theme === "topo"
      ? '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores';

    this.tileLayer = L.tileLayer(url, {
      attribution: attr,
      maxZoom: 19
    }).addTo(this.map);
  }

  toggleTileTheme() {
    this.currentTileTheme = this.currentTileTheme === "topo" ? "osm" : "topo";
    this.setTileTheme(this.currentTileTheme);
    return this.currentTileTheme;
  }

  updateOriginMarker() {
    const latlng = [this.origin.lat, this.origin.lon];

    if (!this.originMarker) {
      const originIcon = L.divIcon({
        className: 'origin-map-pin',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(6, 182, 212, 0.4); animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;"></div>
            <div style="width: 16px; height: 16px; border-radius: 50%; background: #06b6d4; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      this.originMarker = L.marker(latlng, {
        draggable: true,
        icon: originIcon,
        zIndexOffset: 1000
      }).addTo(this.map);

      this.originMarker.bindTooltip("📍 Tu Origen (Arrastra para mover)", {
        direction: 'top',
        offset: [0, -14],
        permanent: false
      });

      this.originMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        this.setOrigin(pos.lat, pos.lng, `Punto personalizado (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`);
      });
    } else {
      this.originMarker.setLatLng(latlng);
    }
  }

  setOrigin(lat, lon, name = "Origen seleccionado") {
    this.origin = { lat, lon, name };
    this.updateOriginMarker();
    this.onOriginChange(this.origin);
  }

  recenterOrigin() {
    this.map.flyTo([this.origin.lat, this.origin.lon], 13, { duration: 1 });
  }

  renderSchools(vacanciesList, isVacancyDiscardedFn = null) {
    this.schoolsLayer.clearLayers();

    // Agrupar por escuela para no encimar múltiples vacantes de un mismo CCT
    const schoolsMap = new Map();
    for (const v of vacanciesList) {
      if (!schoolsMap.has(v.cct)) {
        schoolsMap.set(v.cct, {
          cct: v.cct,
          nombre: v.escuela_nombre,
          nivel: v.nivel,
          turno: v.turno,
          municipio: v.municipio,
          lugar: v.lugar,
          latitud: v.latitud,
          longitud: v.longitud,
          numero_grupos: v.numero_grupos,
          zona_economica: v.zona_economica || '60%',
          distance_km: v.distance_km,
          duration_min: v.duration_min,
          vacancies: []
        });
      }
      schoolsMap.get(v.cct).vacancies.push(v);
    }

    schoolsMap.forEach((school) => {
      const allDiscarded = isVacancyDiscardedFn 
        ? school.vacancies.every(v => isVacancyDiscardedFn(v.vacancy_id))
        : false;

      // Color según turno o nivel
      let markerColor = "#06b6d4";
      if (allDiscarded) {
        markerColor = "#64748b"; // Marcador apagado / descartado
      } else if (school.turno.toLowerCase().includes("vespertino")) {
        markerColor = "#f59e0b";
      } else if (school.nivel.toLowerCase().includes("secundaria") || school.nivel.toLowerCase().includes("tecnica")) {
        markerColor = "#8b5cf6";
      } else if (school.nivel.toLowerCase().includes("telesecundaria")) {
        markerColor = "#ec4899";
      }

      const schoolIcon = L.divIcon({
        className: 'school-map-pin',
        html: `
          <div style="background-color: ${markerColor}; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; ${allDiscarded ? 'opacity: 0.55;' : ''}">
            <div style="width: 6px; height: 6px; background-color: ${allDiscarded ? '#f43f5e' : '#ffffff'}; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 22]
      });

      const marker = L.marker([school.latitud, school.longitud], { icon: schoolIcon });

      const distInfo = school.distance_km !== null
        ? `<div style="margin-top: 4px; font-weight: 700; color: #0284c7;">🚗 ${school.distance_km} km • ⏱️ ${formatDuration(school.duration_min)}</div>`
        : '';

      const popupHtml = `
        <div style="font-family: var(--font-sans); min-width: 220px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">${school.cct} • ${school.turno}</span>
            <span style="font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 9999px; background: ${school.zona_economica === '100%' ? 'rgba(16,185,129,0.2)' : 'rgba(6,182,212,0.2)'}; color: ${school.zona_economica === '100%' ? '#059669' : '#0284c7'};">💰 ${school.zona_economica}</span>
          </div>
          <div style="font-size: 14px; font-weight: 700; margin: 2px 0 4px; color: #0f172a;">${school.nombre}</div>
          <div style="color: #475569; font-size: 12px;">📍 ${school.lugar || school.municipio}, ${school.municipio}</div>
          <div style="font-size: 12px; margin-top: 4px;">👥 ${school.numero_grupos} grupos • ${school.vacancies.length} vacante(s)</div>
          ${distInfo}
          <button id="btn-popup-route-${school.cct}" style="margin-top: 8px; width: 100%; padding: 6px; background: #06b6d4; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            Trazar Ruta por Carretera
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on("popupopen", () => {
        const btn = document.getElementById(`btn-popup-route-${school.cct}`);
        if (btn) {
          btn.addEventListener("click", () => {
            this.onSchoolSelect(school.cct);
          });
        }
      });

      marker.on("click", () => {
        this.onSchoolSelect(school.cct);
      });

      this.schoolsLayer.addLayer(marker);
    });
  }

  drawRoute(geometry, distanceMeters, durationSeconds, schoolName) {
    this.routeLayer.clearLayers();

    if (!geometry || !geometry.coordinates) return;

    // Convertir de [lon, lat] a [lat, lon] de Leaflet
    const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);

    // Polilínea de resplandor exterior
    const glowLine = L.polyline(latLngs, {
      color: "#06b6d4",
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    });

    // Polilínea principal
    const mainLine = L.polyline(latLngs, {
      color: "#38bdf8",
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    });

    this.routeLayer.addLayer(glowLine);
    this.routeLayer.addLayer(mainLine);

    // Ajustar vista del mapa para englobar toda la ruta
    const bounds = L.latLngBounds(latLngs);
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }

  clearRoute() {
    this.routeLayer.clearLayers();
  }

  fitAll() {
    const allLayers = [];
    this.schoolsLayer.eachLayer(layer => allLayers.push(layer.getLatLng()));
    if (this.originMarker) allLayers.push(this.originMarker.getLatLng());

    if (allLayers.length > 0) {
      const bounds = L.latLngBounds(allLayers);
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }
}
