/**
 * Gestor de Vacantes Descartadas / Pasadas en Vivo (Local)
 * Permite que los docentes tachen o descarten vacantes durante el evento
 * sin alterar la base de datos central, persistido en localStorage.
 */
export class DiscardedVacancies {
  constructor(storageKey = "geovacantes_discarded") {
    this.storageKey = storageKey;
    this.discardedMap = this.load(); // Map o Set de vacancy_id -> timestamp / boolean
    this.hideDiscarded = false; // Estado de filtro: ocultar o mostrar tachadas
    this.listeners = [];
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (e) {
      console.error("Error al cargar vacantes descartadas:", e);
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.discardedMap));
    } catch (e) {
      console.error("Error guardando descartes en localStorage:", e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
  }

  notify() {
    const state = this.getState();
    for (const cb of this.listeners) {
      cb(state);
    }
  }

  getState() {
    return {
      discardedCount: this.count(),
      discardedIds: Object.keys(this.discardedMap).map(Number),
      hideDiscarded: this.hideDiscarded
    };
  }

  isDiscarded(vacancyId) {
    return !!this.discardedMap[vacancyId];
  }

  toggle(vacancyId) {
    const id = Number(vacancyId);
    if (this.discardedMap[id]) {
      delete this.discardedMap[id];
    } else {
      this.discardedMap[id] = {
        timestamp: Date.now()
      };
    }
    this.save();
    return this.isDiscarded(id);
  }

  discard(vacancyId) {
    const id = Number(vacancyId);
    if (!this.discardedMap[id]) {
      this.discardedMap[id] = { timestamp: Date.now() };
      this.save();
    }
  }

  restore(vacancyId) {
    const id = Number(vacancyId);
    if (this.discardedMap[id]) {
      delete this.discardedMap[id];
      this.save();
    }
  }

  restoreAll() {
    this.discardedMap = {};
    this.save();
  }

  toggleHideDiscarded() {
    this.hideDiscarded = !this.hideDiscarded;
    this.notify();
    return this.hideDiscarded;
  }

  setHideDiscarded(hide) {
    this.hideDiscarded = Boolean(hide);
    this.notify();
  }

  count() {
    return Object.keys(this.discardedMap).length;
  }
}
