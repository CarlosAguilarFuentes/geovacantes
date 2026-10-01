/**
 * Módulo de Comparación Cara a Cara de Escuelas y Vacantes
 */
import { formatDuration } from './app.js';

export class Comparator {
  constructor(options = {}) {
    this.selectedVacancies = [];
    this.onSelectRoute = options.onSelectRoute || (() => {});
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.selectedVacancies);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.selectedVacancies);
    }
  }

  isSelected(vacancyId) {
    return this.selectedVacancies.some(v => v.vacancy_id === vacancyId);
  }

  toggle(vacancy) {
    const idx = this.selectedVacancies.findIndex(v => v.vacancy_id === vacancy.vacancy_id);
    if (idx >= 0) {
      this.selectedVacancies.splice(idx, 1);
    } else {
      if (this.selectedVacancies.length >= 4) {
        alert("Puedes comparar hasta 4 escuelas simultáneamente. Deselecciona una para agregar otra.");
        return false;
      }
      this.selectedVacancies.push(vacancy);
    }
    this.notify();
    return this.isSelected(vacancy.vacancy_id);
  }

  clear() {
    this.selectedVacancies = [];
    this.notify();
  }

  count() {
    return this.selectedVacancies.length;
  }

  renderModal(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.selectedVacancies.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem;"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
          <h3>No hay escuelas seleccionadas para comparar</h3>
          <p style="font-size: 0.85rem; margin-top: 0.4rem;">Haz clic en el botón <strong>"Comparar ⚖️"</strong> en cualquier tarjeta de vacante para contrastar sus distancias y características.</p>
        </div>
      `;
      return;
    }

    // Calcular mejores métricas (mínima distancia y tiempo)
    const validDists = this.selectedVacancies.map(v => v.distance_km).filter(d => d !== null);
    const minDistance = validDists.length > 0 ? Math.min(...validDists) : null;

    const validTimes = this.selectedVacancies.map(v => v.duration_min).filter(t => t !== null);
    const minTime = validTimes.length > 0 ? Math.min(...validTimes) : null;

    container.innerHTML = this.selectedVacancies.map((v) => {
      const isShortest = v.distance_km !== null && v.distance_km === minDistance;
      const isFastest = v.duration_min !== null && v.duration_min === minTime;

      return `
        <div class="comparator-col ${isFastest ? 'highlight-best' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <span class="cct-tag">${v.cct}</span>
            <button class="btn btn-secondary btn-sm btn-remove-compare" data-id="${v.vacancy_id}" style="padding: 2px 6px;">✕</button>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 2px;">${v.escuela_nombre}</h4>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${v.nivel} • ${v.turno}</span>
          </div>

          <div style="background: rgba(0,0,0,0.25); border-radius: var(--radius-md); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Distancia:</span>
              <strong style="color: ${isShortest ? 'var(--accent-emerald)' : 'var(--text-main)'};">
                ${v.distance_km ? `${v.distance_km} km ${isShortest ? '★' : ''}` : 'Sin calcular'}
              </strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Tiempo estimado:</span>
              <strong style="color: ${isFastest ? 'var(--accent-cyan)' : 'var(--text-main)'};">
                ${v.duration_min ? `${formatDuration(v.duration_min)} ${isFastest ? '★' : ''}` : 'Sin calcular'}
              </strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Tamaño escolar:</span>
              <strong>${v.numero_grupos} grupos</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Municipio:</span>
              <strong>${v.municipio}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Zona Económica:</span>
              <strong style="color: ${v.zona_economica === '100%' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'};">💰 ${v.zona_economica || '60%'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-dim);">Localidad:</span>
              <span style="text-align: right; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.lugar || 'Cabecera'}</span>
            </div>
          </div>

          <div style="font-size: 0.8rem; border-top: 1px dashed var(--border-subtle); padding-top: 0.5rem;">
            <div style="font-weight: 600; color: var(--accent-amber);">${v.tipo_vacante}</div>
            <div style="color: var(--text-muted); font-size: 0.75rem;">${v.asignatura} (${v.categoria_funcion})</div>
            ${v.observaciones ? `<div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px; font-style: italic;">"${v.observaciones}"</div>` : ''}
          </div>

          <button class="btn btn-primary btn-sm btn-compare-route" data-cct="${v.cct}" style="margin-top: auto;">
            Ver Ruta en Mapa
          </button>
        </div>
      `;
    }).join("");

    // Asignar eventos de eliminación de columna
    container.querySelectorAll(".btn-remove-compare").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        this.selectedVacancies = this.selectedVacancies.filter(v => v.vacancy_id !== id);
        this.notify();
        this.renderModal(containerId);
      });
    });

    // Asignar evento de trazar ruta
    container.querySelectorAll(".btn-compare-route").forEach(btn => {
      btn.addEventListener("click", () => {
        const cct = btn.dataset.cct;
        this.onSelectRoute(cct);
        const modal = document.getElementById("comparator-modal");
        if (modal) modal.classList.remove("open");
      });
    });
  }
}
