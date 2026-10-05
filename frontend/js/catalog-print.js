/**
 * Módulo de Impresión y Exportación del Catálogo General de Vacantes
 * Permite imprimir todas las vacantes con su información general institucional,
 * sin cálculo de origen, sin distancias en kilómetros ni tiempos de traslado.
 */

export class CatalogPrint {
  constructor({ routingService, getActiveEvent, getCurrentMainFilters }) {
    this.routingService = routingService;
    this.getActiveEvent = getActiveEvent || (() => null);
    this.getCurrentMainFilters = getCurrentMainFilters || (() => ({}));

    this.rawCatalog = [];
    this.filteredCatalog = [];
    this.eventData = null;
    this.filterOptionsLoaded = false;

    this.state = {
      scope: "all", // "all" | "current"
      search: "",
      municipio: "",
      nivel: "",
      turno: "",
      tipo_vacante: "",
      sort_by: "cct",
      orientation: "landscape", // "landscape" | "portrait"
      compactView: false
    };

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Botones de apertura del modal
    const btnOpenNavbar = document.getElementById("btn-open-catalog-print");
    if (btnOpenNavbar) {
      btnOpenNavbar.addEventListener("click", () => this.openModal());
    }

    const btnQuickPrint = document.getElementById("btn-quick-print-catalog");
    if (btnQuickPrint) {
      btnQuickPrint.addEventListener("click", () => this.openModal());
    }

    // Botones de cierre
    const btnCloseModal = document.getElementById("btn-close-catalog-print");
    if (btnCloseModal) {
      btnCloseModal.addEventListener("click", () => this.closeModal());
    }

    const btnCancelModal = document.getElementById("btn-cancel-catalog-print");
    if (btnCancelModal) {
      btnCancelModal.addEventListener("click", () => this.closeModal());
    }

    const backdrop = document.getElementById("catalog-print-modal");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeModal();
      });
    }

    // Selector de alcance (Todas vs Filtros actuales)
    const scopeRadios = document.querySelectorAll("input[name='catalog-print-scope']");
    scopeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.state.scope = e.target.value;
        this.onScopeChange();
      });
    });

    // Filtros rápidos del modal
    const searchInput = document.getElementById("catalog-print-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.search = e.target.value.trim().toLowerCase();
        this.applyFilters();
      });
    }

    const selectMunicipio = document.getElementById("catalog-print-filter-municipio");
    if (selectMunicipio) {
      selectMunicipio.addEventListener("change", (e) => {
        this.state.municipio = e.target.value;
        this.applyFilters();
      });
    }

    const selectNivel = document.getElementById("catalog-print-filter-nivel");
    if (selectNivel) {
      selectNivel.addEventListener("change", (e) => {
        this.state.nivel = e.target.value;
        this.applyFilters();
      });
    }

    const selectTurno = document.getElementById("catalog-print-filter-turno");
    if (selectTurno) {
      selectTurno.addEventListener("change", (e) => {
        this.state.turno = e.target.value;
        this.applyFilters();
      });
    }

    const selectTipo = document.getElementById("catalog-print-filter-tipo");
    if (selectTipo) {
      selectTipo.addEventListener("change", (e) => {
        this.state.tipo_vacante = e.target.value;
        this.applyFilters();
      });
    }

    const selectSort = document.getElementById("catalog-print-sort");
    if (selectSort) {
      selectSort.addEventListener("change", (e) => {
        this.state.sort_by = e.target.value;
        this.applyFilters();
      });
    }

    const selectOrientation = document.getElementById("catalog-print-orientation");
    if (selectOrientation) {
      selectOrientation.addEventListener("change", (e) => {
        this.state.orientation = e.target.value;
      });
    }

    const checkCompact = document.getElementById("catalog-print-compact");
    if (checkCompact) {
      checkCompact.addEventListener("change", (e) => {
        this.state.compactView = e.target.checked;
        this.renderPreviewTable();
      });
    }

    // Botón de restablecer filtros
    const btnReset = document.getElementById("btn-reset-catalog-print-filters");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.resetFilters());
    }

    // Botones de acción principales: Imprimir y Exportar CSV
    const btnPrint = document.getElementById("btn-execute-catalog-print");
    if (btnPrint) {
      btnPrint.addEventListener("click", () => this.printDocument());
    }

    const btnCsv = document.getElementById("btn-execute-catalog-csv");
    if (btnCsv) {
      btnCsv.addEventListener("click", () => this.exportCsv());
    }
  }

  async openModal() {
    const modal = document.getElementById("catalog-print-modal");
    if (!modal) return;

    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Cargar opciones en los selectores si aún no se han poblado
    await this.populateFilterOptions();

    // Actualizar nombre del evento
    this.eventData = this.getActiveEvent();
    const eventNameEl = document.getElementById("catalog-print-event-name");
    if (eventNameEl) {
      eventNameEl.textContent = this.eventData?.nombre || "Convocatoria General de Plazas";
    }

    // Cargar datos
    await this.loadData();
  }

  closeModal() {
    const modal = document.getElementById("catalog-print-modal");
    if (modal) {
      modal.classList.remove("open");
    }
    document.body.style.overflow = "";
  }

  async populateFilterOptions() {
    if (this.filterOptionsLoaded) return;

    try {
      const opts = await this.routingService.fetchFilterOptions();
      const selMpio = document.getElementById("catalog-print-filter-municipio");
      const selNivel = document.getElementById("catalog-print-filter-nivel");
      const selTurno = document.getElementById("catalog-print-filter-turno");
      const selTipo = document.getElementById("catalog-print-filter-tipo");

      if (selMpio && opts.municipios) {
        selMpio.innerHTML = '<option value="">Todos los municipios</option>' +
          opts.municipios.map(m => `<option value="${this.escapeHtml(m)}">${this.escapeHtml(m)}</option>`).join("");
      }

      if (selNivel && opts.niveles) {
        selNivel.innerHTML = '<option value="">Todos los niveles</option>' +
          opts.niveles.map(n => `<option value="${this.escapeHtml(n)}">${this.escapeHtml(n)}</option>`).join("");
      }

      if (selTurno && opts.turnos) {
        selTurno.innerHTML = '<option value="">Todos los turnos</option>' +
          opts.turnos.map(t => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`).join("");
      }

      if (selTipo && opts.tipos_vacante) {
        selTipo.innerHTML = '<option value="">Definitivas y Temporales</option>' +
          opts.tipos_vacante.map(t => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`).join("");
      }

      this.filterOptionsLoaded = true;
    } catch (err) {
      console.error("Error al cargar opciones de filtro para el catálogo:", err);
    }
  }

  async onScopeChange() {
    if (this.state.scope === "current") {
      // Tomar los filtros activos de la búsqueda principal
      const mainFilters = this.getCurrentMainFilters();
      this.state.search = (mainFilters.search || "").toLowerCase();
      this.state.municipio = mainFilters.municipio || "";
      this.state.nivel = mainFilters.nivel || "";
      this.state.turno = mainFilters.turno || "";
      this.state.tipo_vacante = mainFilters.tipo_vacante || "";

      // Reflejar en inputs del modal
      this.syncInputsWithState();
    }
    await this.loadData();
  }

  syncInputsWithState() {
    const searchInput = document.getElementById("catalog-print-search");
    if (searchInput) searchInput.value = this.state.search;

    const selMpio = document.getElementById("catalog-print-filter-municipio");
    if (selMpio) selMpio.value = this.state.municipio;

    const selNivel = document.getElementById("catalog-print-filter-nivel");
    if (selNivel) selNivel.value = this.state.nivel;

    const selTurno = document.getElementById("catalog-print-filter-turno");
    if (selTurno) selTurno.value = this.state.turno;

    const selTipo = document.getElementById("catalog-print-filter-tipo");
    if (selTipo) selTipo.value = this.state.tipo_vacante;
  }

  resetFilters() {
    this.state.search = "";
    this.state.municipio = "";
    this.state.nivel = "";
    this.state.turno = "";
    this.state.tipo_vacante = "";
    this.state.sort_by = "cct";
    this.syncInputsWithState();

    const selectSort = document.getElementById("catalog-print-sort");
    if (selectSort) selectSort.value = "cct";

    this.applyFilters();
  }

  async loadData() {
    const previewContainer = document.getElementById("catalog-print-preview-body");
    const countBadge = document.getElementById("catalog-print-count-badge");

    if (previewContainer) {
      previewContainer.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            <div style="font-size: 1.6rem; margin-bottom: 0.5rem; animation: spin 1s linear infinite;">⏳</div>
            Cargando catálogo institucional de vacantes...
          </td>
        </tr>
      `;
    }

    try {
      const res = await this.routingService.fetchVacanciesCatalog({
        sort_by: this.state.sort_by
      });

      this.rawCatalog = res.vacancies || [];
      if (res.event_name) {
        const eventNameEl = document.getElementById("catalog-print-event-name");
        if (eventNameEl) eventNameEl.textContent = res.event_name;
      }

      this.applyFilters();
    } catch (err) {
      console.error("Error al cargar vacantes para impresión:", err);
      if (previewContainer) {
        previewContainer.innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: 2rem; color: var(--accent-rose);">
              ⚠️ Error al cargar el catálogo de vacantes. Por favor intenta de nuevo.
            </td>
          </tr>
        `;
      }
    }
  }

  applyFilters() {
    let list = [...this.rawCatalog];

    // Filtro por texto libre (CCT, Escuela, Localidad, Asignatura, Función)
    if (this.state.search) {
      const q = this.state.search;
      list = list.filter((item) => {
        return (
          (item.cct && item.cct.toLowerCase().includes(q)) ||
          (item.escuela_nombre && item.escuela_nombre.toLowerCase().includes(q)) ||
          (item.municipio && item.municipio.toLowerCase().includes(q)) ||
          (item.lugar && item.lugar.toLowerCase().includes(q)) ||
          (item.asignatura && item.asignatura.toLowerCase().includes(q)) ||
          (item.categoria_funcion && item.categoria_funcion.toLowerCase().includes(q))
        );
      });
    }

    // Filtro por Municipio
    if (this.state.municipio) {
      list = list.filter((item) => item.municipio === this.state.municipio);
    }

    // Filtro por Nivel
    if (this.state.nivel) {
      list = list.filter((item) => item.nivel === this.state.nivel);
    }

    // Filtro por Turno
    if (this.state.turno) {
      list = list.filter((item) => item.turno === this.state.turno);
    }

    // Filtro por Tipo de vacante
    if (this.state.tipo_vacante) {
      list = list.filter((item) => item.tipo_vacante === this.state.tipo_vacante);
    }

    // Ordenamiento
    const sortBy = this.state.sort_by;
    list.sort((a, b) => {
      if (sortBy === "name") {
        return (a.escuela_nombre || "").localeCompare(b.escuela_nombre || "");
      } else if (sortBy === "municipio") {
        const m = (a.municipio || "").localeCompare(b.municipio || "");
        if (m !== 0) return m;
        return (a.escuela_nombre || "").localeCompare(b.escuela_nombre || "");
      } else if (sortBy === "nivel") {
        const n = (a.nivel || "").localeCompare(b.nivel || "");
        if (n !== 0) return n;
        return (a.municipio || "").localeCompare(b.municipio || "");
      } else if (sortBy === "asignatura") {
        return (a.asignatura || "").localeCompare(b.asignatura || "");
      } else if (sortBy === "tipo") {
        return (a.tipo_vacante || "").localeCompare(b.tipo_vacante || "");
      } else {
        // Por CCT
        return (a.cct || "").localeCompare(b.cct || "");
      }
    });

    this.filteredCatalog = list;

    // Actualizar badges e indicadores
    const countBadge = document.getElementById("catalog-print-count-badge");
    if (countBadge) {
      countBadge.textContent = `${this.filteredCatalog.length} vacantes a imprimir`;
    }

    const totalRawBadge = document.getElementById("catalog-print-total-raw");
    if (totalRawBadge) {
      totalRawBadge.textContent = `(de ${this.rawCatalog.length} totales en catálogo)`;
    }

    this.renderPreviewTable();
  }

  renderPreviewTable() {
    const tbody = document.getElementById("catalog-print-preview-body");
    if (!tbody) return;

    if (this.filteredCatalog.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No hay vacantes que coincidan con los criterios seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    const isCompact = this.state.compactView;

    tbody.innerHTML = this.filteredCatalog.map((item, idx) => {
      const isDefinitiva = (item.tipo_vacante || "").toLowerCase().includes("definitiv");
      const tipoBadgeClass = isDefinitiva ? "badge-definitiva" : "badge-temporal";

      return `
        <tr>
          <td style="text-align: center; font-weight: 700; color: var(--text-dim); font-size: 0.78rem;">${idx + 1}</td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.82rem;">${this.escapeHtml(item.cct)}</td>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.85rem;">${this.escapeHtml(item.escuela_nombre)}</div>
            ${!isCompact && item.numero_grupos ? `<span style="font-size: 0.72rem; color: var(--text-dim);">${item.numero_grupos} grupos</span>` : ""}
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHtml(item.nivel || "-")}</td>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(item.turno || "-")}</td>
          <td style="font-size: 0.82rem;">
            <div style="font-weight: 500; color: var(--text-main);">${this.escapeHtml(item.municipio || "-")}</div>
            ${!isCompact && item.lugar ? `<div style="font-size: 0.73rem; color: var(--text-dim);">${this.escapeHtml(item.lugar)}</div>` : ""}
          </td>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(item.zona_economica || item.zona_escolar || "-")}</td>
          <td>
            <div style="font-weight: 500; font-size: 0.82rem; color: var(--text-main);">${this.escapeHtml(item.asignatura || item.categoria_funcion || "General")}</div>
            ${!isCompact && item.categoria_funcion && item.categoria_funcion !== item.asignatura ? `<div style="font-size: 0.73rem; color: var(--text-dim);">${this.escapeHtml(item.categoria_funcion)}</div>` : ""}
          </td>
          <td style="text-align: center; font-weight: 600; font-size: 0.82rem;">${item.horas ? item.horas : "-"}</td>
          <td>
            <span class="catalog-tipo-badge ${tipoBadgeClass}">${this.escapeHtml(item.tipo_vacante || "Definitiva")}</span>
          </td>
          <td style="font-size: 0.76rem; color: var(--text-dim); max-width: 180px;">
            ${item.observaciones ? `<span style="font-size: 0.73rem; color: var(--text-muted);">${this.escapeHtml(item.observaciones)}</span>` : "-"}
          </td>
        </tr>
      `;
    }).join("");
  }

  printDocument() {
    if (this.filteredCatalog.length === 0) {
      alert("No hay vacantes para imprimir con los filtros seleccionados.");
      return;
    }

    const eventName = this.eventData?.nombre || "PROCESO OFICIAL DE ASIGNACIÓN Y MOVILIDAD DOCENTE";
    const eventDate = this.eventData?.fecha_evento || "";
    const printContainer = document.getElementById("print-catalog-area");
    if (!printContainer) return;

    const isLandscape = this.state.orientation === "landscape";

    // Generar resumen de filtros para el encabezado impreso
    const appliedFilters = [];
    if (this.state.municipio) appliedFilters.push(`Municipio: ${this.state.municipio}`);
    if (this.state.nivel) appliedFilters.push(`Nivel: ${this.state.nivel}`);
    if (this.state.turno) appliedFilters.push(`Turno: ${this.state.turno}`);
    if (this.state.tipo_vacante) appliedFilters.push(`Tipo: ${this.state.tipo_vacante}`);
    if (this.state.search) appliedFilters.push(`Búsqueda: "${this.state.search}"`);
    const filterSummaryText = appliedFilters.length > 0 ? appliedFilters.join(" | ") : "Todas las plazas (sin filtros restrictivos)";

    const currentDateText = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Inyectar contenido en el área de impresión del catálogo
    printContainer.innerHTML = `
      <div class="print-official-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
          <div>
            <h1 style="font-size: 14pt; margin: 0 0 3px 0; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
              CATÁLOGO OFICIAL DE VACANTES DISPONIBLES
            </h1>
            <h2 style="font-size: 10.5pt; margin: 0; color: #334155; font-weight: 600;">
              ${this.escapeHtml(eventName)}
            </h2>
          </div>
          <div style="text-align: right; font-size: 8pt; color: #475569;">
            <div><strong>Emisión:</strong> ${currentDateText}</div>
            <div><strong>Total reportado:</strong> ${this.filteredCatalog.length} vacantes</div>
            ${eventDate ? `<div><strong>Fecha del Evento:</strong> ${this.escapeHtml(eventDate)}</div>` : ""}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 10px; margin-bottom: 12px; font-size: 8pt; color: #334155;">
          <div><strong>Criterio de orden:</strong> Por ${this.getSortByLabel(this.state.sort_by)} | <strong>Filtros:</strong> ${this.escapeHtml(filterSummaryText)}</div>
          <div style="font-weight: 700; color: #0f172a;">INFORMACIÓN GENERAL SIN CÁLCULO DE ORIGEN</div>
        </div>
      </div>

      <table class="print-catalog-table">
        <thead>
          <tr>
            <th style="width: 28px; text-align: center;">#</th>
            <th style="width: 82px;">CCT</th>
            <th>Plantel / Escuela</th>
            <th style="width: 80px;">Nivel</th>
            <th style="width: 68px;">Turno</th>
            <th style="width: 125px;">Municipio / Localidad</th>
            <th style="width: 52px; text-align: center;">Z.E.</th>
            <th>Función / Asignatura</th>
            <th style="width: 40px; text-align: center;">Horas</th>
            <th style="width: 76px; text-align: center;">Tipo</th>
            <th style="width: 130px;">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${this.filteredCatalog.map((item, idx) => {
            const isDef = (item.tipo_vacante || "").toLowerCase().includes("definitiv");
            return `
              <tr>
                <td style="text-align: center; font-weight: bold; background: #fcfcfc;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold;">${this.escapeHtml(item.cct)}</td>
                <td>
                  <strong>${this.escapeHtml(item.escuela_nombre)}</strong>
                  ${item.numero_grupos ? `<span style="font-size: 7.2pt; color: #64748b;"> (${item.numero_grupos} grps)</span>` : ""}
                </td>
                <td>${this.escapeHtml(item.nivel || "-")}</td>
                <td>${this.escapeHtml(item.turno || "-")}</td>
                <td>
                  <strong>${this.escapeHtml(item.municipio || "-")}</strong>
                  ${item.lugar && item.lugar !== item.municipio ? `<br><span style="font-size: 7.2pt; color: #475569;">${this.escapeHtml(item.lugar)}</span>` : ""}
                </td>
                <td style="text-align: center; font-size: 7.5pt;">${this.escapeHtml(item.zona_economica || "-")}</td>
                <td>
                  <strong>${this.escapeHtml(item.asignatura || item.categoria_funcion || "General")}</strong>
                  ${item.categoria_funcion && item.categoria_funcion !== item.asignatura ? `<br><span style="font-size: 7.2pt; color: #64748b;">${this.escapeHtml(item.categoria_funcion)}</span>` : ""}
                </td>
                <td style="text-align: center; font-weight: bold;">${item.horas ? item.horas : "-"}</td>
                <td style="text-align: center; font-weight: 600; font-size: 7.5pt;">
                  <span style="${isDef ? 'color: #047857;' : 'color: #b45309;'}">${this.escapeHtml(item.tipo_vacante || "Definitiva")}</span>
                </td>
                <td style="font-size: 7.2pt; color: #334155;">
                  ${item.observaciones ? `<span>${this.escapeHtml(item.observaciones)}</span>` : "-"}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <div class="print-official-footer" style="margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #64748b;">
        <span>Documento oficial de consulta generado por la Plataforma GeoVacantes. Información general de vacantes sin cálculo de tiempos ni distancias de origen.</span>
        <span>Página generada el ${currentDateText}</span>
      </div>
    `;

    // Inyectar regla dinámica @page para orientación seleccionada
    let styleTag = document.getElementById("catalog-print-dynamic-style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "catalog-print-dynamic-style";
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
      @page {
        size: letter ${isLandscape ? 'landscape' : 'portrait'};
        margin: ${isLandscape ? '8mm 7mm' : '10mm 8mm'};
      }
    `;

    // Activar modo de impresión de catálogo
    document.body.classList.add("print-mode-catalog");

    // Limpieza tras imprimir
    const cleanUp = () => {
      document.body.classList.remove("print-mode-catalog");
      if (styleTag && styleTag.parentNode) {
        styleTag.parentNode.removeChild(styleTag);
      }
      window.removeEventListener("afterprint", cleanUp);
    };

    window.addEventListener("afterprint", cleanUp);

    // Lanzar diálogo de impresión del navegador
    setTimeout(() => {
      window.print();
    }, 120);
  }

  exportCsv() {
    if (this.filteredCatalog.length === 0) {
      alert("No hay vacantes para exportar con los filtros seleccionados.");
      return;
    }

    const headers = [
      "No",
      "CCT",
      "Escuela / Plantel",
      "Nivel",
      "Turno",
      "Numero de Grupos",
      "Municipio",
      "Localidad / Domicilio",
      "Zona Economica",
      "Zona Escolar",
      "Sector",
      "Categoria / Funcion",
      "Asignatura",
      "Horas",
      "Tipo de Vacante",
      "Motivo",
      "Observaciones"
    ];

    const rows = this.filteredCatalog.map((item, idx) => [
      idx + 1,
      `"${(item.cct || '').replace(/"/g, '""')}"`,
      `"${(item.escuela_nombre || '').replace(/"/g, '""')}"`,
      `"${(item.nivel || '').replace(/"/g, '""')}"`,
      `"${(item.turno || '').replace(/"/g, '""')}"`,
      item.numero_grupos || 0,
      `"${(item.municipio || '').replace(/"/g, '""')}"`,
      `"${(item.lugar || '').replace(/"/g, '""')}"`,
      `"${(item.zona_economica || '').replace(/"/g, '""')}"`,
      `"${(item.zona_escolar || '').replace(/"/g, '""')}"`,
      `"${(item.sector || '').replace(/"/g, '""')}"`,
      `"${(item.categoria_funcion || '').replace(/"/g, '""')}"`,
      `"${(item.asignatura || '').replace(/"/g, '""')}"`,
      item.horas || 0,
      `"${(item.tipo_vacante || '').replace(/"/g, '""')}"`,
      `"${(item.motivo || '').replace(/"/g, '""')}"`,
      `"${(item.observaciones || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const eventSlug = (this.eventData?.nombre || "General").replace(/[^\w\d-_]/g, "_");

    link.setAttribute("href", url);
    link.setAttribute("download", `Catalogo_General_Vacantes_${eventSlug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getSortByLabel(sortBy) {
    switch (sortBy) {
      case "name": return "Nombre de escuela";
      case "municipio": return "Municipio y escuela";
      case "nivel": return "Nivel educativo";
      case "asignatura": return "Asignatura";
      case "tipo": return "Tipo de vacante";
      case "cct":
      default: return "CCT";
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
