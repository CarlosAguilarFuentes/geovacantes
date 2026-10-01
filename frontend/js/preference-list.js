/**
 * Gestor de la Lista de Prelación y Preferencias Personales del Docente
 * Persistido en localStorage (no requiere login para los docentes)
 */
import { formatDuration } from './app.js';

export class PreferenceList {
  constructor(storageKey = "geovacantes_preferences") {
    this.storageKey = storageKey;
    this.items = this.load();
    this.listeners = [];
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (e) {
      console.error("Error guardando preferencias en localStorage:", e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.items);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.items);
    }
  }

  isSaved(vacancyId) {
    return this.items.some(item => item.vacancy_id === vacancyId);
  }

  toggle(vacancy, sortBy = null) {
    const idx = this.items.findIndex(item => item.vacancy_id === vacancy.vacancy_id);
    if (idx >= 0) {
      this.items.splice(idx, 1);
    } else {
      this.items.push(vacancy);
      if (sortBy) {
        this.sortByCriteria(sortBy, false);
      }
    }
    this.save();
    return this.isSaved(vacancy.vacancy_id);
  }

  sortByCriteria(sortBy = "distance", triggerSave = true) {
    if (!this.items || this.items.length <= 1) return;

    this.items.sort((a, b) => {
      if (sortBy === "distance") {
        const distA = a.distance_km === null || a.distance_km === undefined ? Infinity : Number(a.distance_km);
        const distB = b.distance_km === null || b.distance_km === undefined ? Infinity : Number(b.distance_km);
        return distA - distB;
      }
      if (sortBy === "time") {
        const timeA = a.duration_min === null || a.duration_min === undefined ? Infinity : Number(a.duration_min);
        const timeB = b.duration_min === null || b.duration_min === undefined ? Infinity : Number(b.duration_min);
        return timeA - timeB;
      }
      if (sortBy === "groups") {
        const grpA = Number(a.numero_grupos) || 0;
        const grpB = Number(b.numero_grupos) || 0;
        return grpB - grpA; // Más grupos primero
      }
      if (sortBy === "name") {
        return (a.escuela_nombre || "").localeCompare(b.escuela_nombre || "", "es", { sensitivity: 'base' });
      }
      if (sortBy === "municipio") {
        const mpioComp = (a.municipio || "").localeCompare(b.municipio || "", "es", { sensitivity: 'base' });
        if (mpioComp !== 0) return mpioComp;
        return (a.escuela_nombre || "").localeCompare(b.escuela_nombre || "", "es", { sensitivity: 'base' });
      }
      return 0;
    });

    if (triggerSave) {
      this.save();
    }
  }

  remove(vacancyId) {
    this.items = this.items.filter(item => item.vacancy_id !== vacancyId);
    this.save();
  }

  move(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= this.items.length) return;
    const [moved] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, moved);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  getItems() {
    return [...this.items];
  }

  count() {
    return this.items.length;
  }

  exportCSV(eventName = "Vacantes_2026", discardedIds = new Set()) {
    if (this.items.length === 0) return;

    const headers = [
      "Prioridad", "Estado_Evento", "CCT", "Nombre Escuela", "Nivel", "Turno", "Grupos",
      "Lugar", "Municipio", "Distancia_km", "Tiempo_min", "Tipo_Vacante",
      "Funcion", "Asignatura", "Horas", "Motivo"
    ];

    const rows = this.items.map((item, idx) => {
      const isDisc = discardedIds.has(item.vacancy_id);
      return [
        idx + 1,
        isDisc ? '"DES渡し/DESCAR TADA (Tomada)"' : '"DISPONIBLE"',
        `"${item.cct}"`,
        `"${item.escuela_nombre || ''}"`,
        `"${item.nivel || ''}"`,
        `"${item.turno || ''}"`,
        item.numero_grupos || 0,
        `"${item.lugar || ''}"`,
        `"${item.municipio || ''}"`,
        item.distance_km || '',
        item.duration_min || '',
        `"${item.tipo_vacante || ''}"`,
        `"${item.categoria_funcion || ''}"`,
        `"${item.asignatura || ''}"`,
        item.horas || 0,
        `"${item.motivo || ''}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mi_Lista_Prelacion_${eventName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printSheet(eventName, originName, discardedIds = new Set()) {
    if (this.items.length === 0) return;

    const printEventTitle = document.getElementById("print-event-title");
    const printOriginName = document.getElementById("print-origin-name");
    const printDate = document.getElementById("print-date");
    const printTableBody = document.getElementById("print-table-body");

    if (printEventTitle) printEventTitle.textContent = eventName || "HOJA DE PRELACIÓN PERSONAL DE VACANTES";
    if (printOriginName) printOriginName.textContent = originName || "Origen del docente";
    if (printDate) printDate.textContent = new Date().toLocaleDateString("es-MX", { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (printTableBody) {
      printTableBody.innerHTML = this.items.map((item, idx) => {
        const isDisc = discardedIds.has(item.vacancy_id);
        return `
        <tr style="${isDisc ? 'opacity: 0.55; text-decoration: line-through; background: #fef2f2;' : ''}">
          <td style="text-align: center; font-weight: bold; background: #fafafa;">${idx + 1}º ${isDisc ? '❌' : ''}</td>
          <td style="font-family: monospace; font-weight: bold;">${item.cct}</td>
          <td>
            <strong>${item.escuela_nombre}</strong><br>
            <span style="font-size: 8pt; color: #555;">${item.asignatura} (${item.categoria_funcion})</span>
          </td>
          <td>${item.nivel}</td>
          <td>${item.turno}</td>
          <td>${item.lugar ? `${item.lugar}, ` : ''}${item.municipio}</td>
          <td style="text-align: right; font-weight: bold;">${item.distance_km ? `${item.distance_km} km` : '-'}</td>
          <td style="text-align: right; font-weight: bold;">${item.duration_min ? formatDuration(item.duration_min) : '-'}</td>
          <td>${item.tipo_vacante} ${isDisc ? '<br><strong style="color: #b91c1c; font-size: 7.5pt;">[DESCAR TADA]</strong>' : ''}</td>
        </tr>
      `;
      }).join("");
    }

    window.print();
  }
}
