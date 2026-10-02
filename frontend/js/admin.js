/**
 * Módulo de Administración: Carga de Catálogos, Vacantes y Configuración de API
 */
export class AdminModule {
  constructor(options = {}) {
    this.token = sessionStorage.getItem("geovacantes_admin_token") || "";
    this.adminUser = sessionStorage.getItem("geovacantes_admin_user") || "";
    this.onDataChanged = options.onDataChanged || (() => {});
    this.init();
  }

  async init() {
    this.bindEvents();
    if (this.token) {
      await this.verifySession();
    } else {
      this.showLoginView();
    }
  }

  bindEvents() {
    // Login con usuario y contraseña
    const btnLogin = document.getElementById("btn-admin-login-submit");
    const userInput = document.getElementById("admin-user-input");
    const pwdInput = document.getElementById("admin-password-input");
    const loginForm = document.getElementById("admin-login-form");

    const doSubmit = () => {
      const u = userInput ? userInput.value.trim() : "";
      const p = pwdInput ? pwdInput.value : "";
      this.handleLogin(u, p);
    };

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        doSubmit();
      });
    }

    if (btnLogin) {
      btnLogin.addEventListener("click", (e) => {
        e.preventDefault();
        doSubmit();
      });
    }

    if (userInput) {
      userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (pwdInput && !pwdInput.value) {
            pwdInput.focus();
          } else {
            doSubmit();
          }
        }
      });
    }

    if (pwdInput) {
      pwdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSubmit();
        }
      });
    }

    // Toggle para ver contraseña
    const btnTogglePwd = document.getElementById("btn-toggle-pwd");
    if (btnTogglePwd && pwdInput) {
      btnTogglePwd.addEventListener("click", () => {
        const isPwd = pwdInput.type === "password";
        pwdInput.type = isPwd ? "text" : "password";
        btnTogglePwd.textContent = isPwd ? "🙈" : "👁️";
        btnTogglePwd.title = isPwd ? "Ocultar contraseña" : "Mostrar contraseña";
      });
    }

    // Botón de Cerrar Sesión
    const btnLogout = document.getElementById("btn-admin-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => this.handleLogout());
    }

    // Tabs del dashboard
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".admin-tab-pane").forEach(p => p.style.display = "none");

        btn.classList.add("active");
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.style.display = "block";

        if (btn.dataset.tab === "tab-events") this.loadEvents();
        if (btn.dataset.tab === "tab-vacancies") this.populateEventSelect();
        if (btn.dataset.tab === "tab-stats") this.loadStats();
        if (btn.dataset.tab === "tab-routing") this.loadRoutingSettings();
      });
    });

    // Carga de Escuelas
    const schoolsDropzone = document.getElementById("schools-dropzone");
    const schoolsFileInput = document.getElementById("schools-file-input");
    if (schoolsDropzone && schoolsFileInput) {
      schoolsDropzone.addEventListener("click", () => schoolsFileInput.click());
      schoolsFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) this.uploadSchools(e.target.files[0]);
      });
    }

    // Carga de Vacantes
    const vacanciesDropzone = document.getElementById("vacancies-dropzone");
    const vacanciesFileInput = document.getElementById("vacancies-file-input");
    if (vacanciesDropzone && vacanciesFileInput) {
      vacanciesDropzone.addEventListener("click", () => vacanciesFileInput.click());
      vacanciesFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) this.uploadVacancies(e.target.files[0]);
      });
    }

    // Configuración de Rutas
    const btnSaveRouting = document.getElementById("btn-save-routing-config");
    const btnTestRouting = document.getElementById("btn-test-routing-conn");
    if (btnSaveRouting) btnSaveRouting.addEventListener("click", () => this.saveRoutingSettings());
    if (btnTestRouting) btnTestRouting.addEventListener("click", () => this.testRoutingConnection());

    // Restablecer Datos de Muestra
    const btnReseed = document.getElementById("btn-reseed-data");
    if (btnReseed) btnReseed.addEventListener("click", () => this.reseedSampleData());

    // Limpieza de datos (Preparación para Producción / Datos Reales)
    const btnClearAll = document.getElementById("btn-clear-all-data");
    const btnClearVacancies = document.getElementById("btn-clear-vacancies");
    const btnClearRoutes = document.getElementById("btn-clear-routes");
    const btnQuickClearSchools = document.getElementById("btn-quick-clear-schools");
    const btnQuickClearVacancies = document.getElementById("btn-quick-clear-vacancies");

    if (btnClearAll) btnClearAll.addEventListener("click", () => this.clearData("all"));
    if (btnClearVacancies) btnClearVacancies.addEventListener("click", () => this.clearData("vacancies"));
    if (btnClearRoutes) btnClearRoutes.addEventListener("click", () => this.clearData("routes"));
    if (btnQuickClearSchools) btnQuickClearSchools.addEventListener("click", () => this.clearData("schools"));
    if (btnQuickClearVacancies) btnQuickClearVacancies.addEventListener("click", () => this.clearData("vacancies"));

    // Gestión de Eventos
    const btnOpenCreate = document.getElementById("btn-open-create-event");
    const btnCancelForm = document.getElementById("btn-cancel-event-form");
    const btnCancelFormBottom = document.getElementById("btn-cancel-event-form-bottom");
    const eventForm = document.getElementById("event-form");

    if (btnOpenCreate) {
      btnOpenCreate.addEventListener("click", () => this.openEventForm());
    }
    if (btnCancelForm) {
      btnCancelForm.addEventListener("click", () => this.closeEventForm());
    }
    if (btnCancelFormBottom) {
      btnCancelFormBottom.addEventListener("click", () => this.closeEventForm());
    }
    if (eventForm) {
      eventForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEvent();
      });
    }
  }

  async verifySession() {
    try {
      const res = await fetch("/api/admin/verify", {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.adminUser = data.user || this.adminUser;
        sessionStorage.setItem("geovacantes_admin_user", this.adminUser);
        this.showDashboard();
      } else {
        this.handleLogout(false);
      }
    } catch (e) {
      console.warn("No se pudo verificar la sesión previa:", e);
      this.handleLogout(false);
    }
  }

  async handleLogin(user, password) {
    const errorEl = document.getElementById("admin-login-error");
    const btnLogin = document.getElementById("btn-admin-login-submit");
    if (errorEl) errorEl.style.display = "none";

    if (!user) {
      if (errorEl) {
        errorEl.textContent = "Por favor ingresa tu correo o usuario de administrador.";
        errorEl.style.display = "block";
      }
      return;
    }

    if (!password) {
      if (errorEl) {
        errorEl.textContent = "Por favor ingresa tu contraseña de administrador.";
        errorEl.style.display = "block";
      }
      return;
    }

    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.innerHTML = `<span>Verificando credenciales...</span>`;
    }

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Usuario o contraseña incorrectos");
      }

      const data = await res.json();
      this.token = data.token;
      this.adminUser = data.user || user;
      sessionStorage.setItem("geovacantes_admin_token", this.token);
      sessionStorage.setItem("geovacantes_admin_user", this.adminUser);
      
      const pwdInput = document.getElementById("admin-password-input");
      if (pwdInput) pwdInput.value = "";

      this.showDashboard();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `❌ ${err.message || "Error al autenticar"}`;
        errorEl.style.display = "block";
      }
    } finally {
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.innerHTML = `<span>Ingresar al Sistema</span> →`;
      }
    }
  }

  handleLogout(clearInputs = true) {
    this.token = "";
    this.adminUser = "";
    sessionStorage.removeItem("geovacantes_admin_token");
    sessionStorage.removeItem("geovacantes_admin_user");
    
    if (clearInputs) {
      const pwdInput = document.getElementById("admin-password-input");
      if (pwdInput) pwdInput.value = "";
    }
    this.showLoginView();
  }

  showLoginView() {
    const loginView = document.getElementById("admin-login-view");
    const dashView = document.getElementById("admin-dashboard-view");
    const userBadge = document.getElementById("admin-user-badge");
    const errorEl = document.getElementById("admin-login-error");

    if (loginView) loginView.style.display = "block";
    if (dashView) dashView.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    if (errorEl) errorEl.style.display = "none";
  }

  showDashboard() {
    const loginView = document.getElementById("admin-login-view");
    const dashView = document.getElementById("admin-dashboard-view");
    const userBadge = document.getElementById("admin-user-badge");
    const currentUserEl = document.getElementById("admin-current-user");

    if (loginView) loginView.style.display = "none";
    if (dashView) dashView.style.display = "block";
    
    if (userBadge) {
      userBadge.style.display = "flex";
      if (currentUserEl) currentUserEl.textContent = this.adminUser || "Administrador";
    }

    this.loadEvents();
    this.populateEventSelect();
    this.loadStats();
    this.loadRoutingSettings();
  }

  checkAuthResponse(res) {
    if (res.status === 401 || res.status === 403) {
      this.handleLogout(false);
      const errorEl = document.getElementById("admin-login-error");
      if (errorEl) {
        errorEl.textContent = "❌ La sesión ha expirado o las credenciales no son válidas. Por favor inicia sesión nuevamente.";
        errorEl.style.display = "block";
      }
      return false;
    }
    return true;
  }

  async uploadSchools(file) {
    const statusEl = document.getElementById("schools-upload-status");
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--accent-cyan);">Subiendo y analizando ${file.name}...</span>`;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload/schools", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.token}` },
        body: formData
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (data.success) {
        if (statusEl) {
          statusEl.innerHTML = `
            <div style="color: var(--accent-emerald); font-weight: 600;">
              ✓ ${data.message}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">
              Total filas: ${data.total_rows} | Procesadas: ${data.imported} | Errores: ${data.errors_count}
            </div>
          `;
        }
        this.onDataChanged();
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<div style="color: var(--accent-rose);">❌ ${data.message}</div>`;
        }
      }
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<div style="color: var(--accent-rose);">Error de red: ${err.message}</div>`;
    }
  }

  async uploadVacancies(file) {
    const statusEl = document.getElementById("vacancies-upload-status");
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--accent-amber);">Subiendo vacantes de ${file.name}...</span>`;
    }

    const formData = new FormData();
    formData.append("file", file);
    const eventSelect = document.getElementById("vacancies-event-select");
    const selectedEventId = eventSelect && eventSelect.value ? eventSelect.value : (this.activeEventId || 1);
    formData.append("event_id", selectedEventId);

    try {
      const res = await fetch("/api/admin/upload/vacancies", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.token}` },
        body: formData
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (data.success) {
        if (statusEl) {
          statusEl.innerHTML = `
            <div style="color: var(--accent-emerald); font-weight: 600;">
              ✓ ${data.message}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">
              Total vacantes: ${data.imported} | Avisos: ${data.warnings_count}
            </div>
          `;
        }
        this.onDataChanged();
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<div style="color: var(--accent-rose);">❌ ${data.message}</div>`;
        }
      }
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<div style="color: var(--accent-rose);">Error de red: ${err.message}</div>`;
    }
  }

  async loadRoutingSettings() {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (!this.checkAuthResponse(res)) return;
      if (!res.ok) return;
      const data = await res.json();

      const urlInput = document.getElementById("cfg-routing-url");
      const keyInput = document.getElementById("cfg-routing-key");

      if (urlInput && data.routing_api_url) urlInput.value = data.routing_api_url;
      if (keyInput && data.has_api_key) {
        keyInput.placeholder = `Llave actual configurada (${data.api_key_masked}). Deja en blanco para conservar.`;
      }
    } catch (err) {
      console.error(err);
    }
  }

  async saveRoutingSettings() {
    const urlInput = document.getElementById("cfg-routing-url");
    const keyInput = document.getElementById("cfg-routing-key");
    const resBox = document.getElementById("routing-test-result");

    const payload = {};
    if (urlInput) payload.routing_api_url = urlInput.value.trim();
    if (keyInput && keyInput.value.trim()) payload.routing_api_key = keyInput.value.trim();

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (resBox) {
        resBox.style.display = "block";
        resBox.style.background = "rgba(16, 185, 129, 0.15)";
        resBox.style.color = "var(--accent-emerald)";
        resBox.textContent = "✓ Configuración guardada correctamente.";
      }
    } catch (err) {
      alert("Error guardando ajustes: " + err.message);
    }
  }

  async testRoutingConnection() {
    const resBox = document.getElementById("routing-test-result");
    if (resBox) {
      resBox.style.display = "block";
      resBox.style.background = "rgba(6, 182, 212, 0.15)";
      resBox.style.color = "var(--accent-cyan)";
      resBox.textContent = "Probando conexión con el servidor de rutas...";
    }

    try {
      const res = await fetch("/api/admin/test-routing", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();

      if (resBox) {
        if (data.success) {
          resBox.style.background = "rgba(16, 185, 129, 0.15)";
          resBox.style.color = "var(--accent-emerald)";
          resBox.textContent = `✓ ${data.message}`;
        } else {
          resBox.style.background = "rgba(244, 63, 94, 0.15)";
          resBox.style.color = "var(--accent-rose)";
          resBox.textContent = `❌ ${data.message}`;
        }
      }
    } catch (err) {
      if (resBox) {
        resBox.style.background = "rgba(244, 63, 94, 0.15)";
        resBox.style.color = "var(--accent-rose)";
        resBox.textContent = `Error: ${err.message}`;
      }
    }
  }

  async loadStats() {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (!this.checkAuthResponse(res)) return;
      if (!res.ok) return;
      const data = await res.json();

      const elSchools = document.getElementById("stat-total-schools");
      const elVacancies = document.getElementById("stat-total-vacancies");
      const elRoutes = document.getElementById("stat-total-routes");

      if (elSchools) elSchools.textContent = data.total_schools;
      if (elVacancies) elVacancies.textContent = data.total_vacancies;
      if (elRoutes) elRoutes.textContent = data.total_routes_cached;
    } catch (err) {
      console.error(err);
    }
  }

  async reseedSampleData() {
    if (!confirm("¿Deseas restablecer los datos de demostración de Chiapas? Esto actualizará las escuelas y vacantes base.")) return;
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (!this.checkAuthResponse(res)) return;
      const data = await res.json();
      alert(data.message);
      this.loadStats();
      this.onDataChanged();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async clearData(target) {
    let confirmMsg = "";
    if (target === "all") {
      confirmMsg = "⚠️ ¿ESTÁS SEGURO DE ELIMINAR TODOS LOS DATOS DE PRUEBA?\n\nEsta acción borrará todas las escuelas, todas las vacantes y la caché de rutas para que puedas comenzar desde cero con datos reales.\n\n¿Deseas continuar?";
    } else if (target === "schools") {
      confirmMsg = "⚠️ ¿Deseas eliminar todo el catálogo de escuelas?\n\nNota: Esto también eliminará las vacantes asociadas y rutas en caché.";
    } else if (target === "vacancies") {
      confirmMsg = "¿Deseas eliminar únicamente todas las vacantes registradas?\n\nEl catálogo de escuelas se conservará intacto.";
    } else if (target === "routes") {
      confirmMsg = "¿Deseas vaciar la memoria caché de rutas calculadas?";
    }

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/clear-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify({ target })
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (data.success) {
        alert("✓ " + data.message);
        this.loadStats();
        this.loadEvents();
        this.populateEventSelect();
        this.onDataChanged();
      } else {
        alert("❌ Error: " + (data.message || data.detail || "No se pudo completar la acción"));
      }
    } catch (err) {
      alert("Error de conexión al limpiar datos: " + err.message);
    }
  }

  // ==========================================
  // GESTIÓN DE EVENTOS DE ASIGNACIÓN / CONVOCATORIA
  // ==========================================

  async loadEvents() {
    const loadingEl = document.getElementById("events-list-loading");
    const containerEl = document.getElementById("events-list-container");

    if (loadingEl) {
      loadingEl.style.display = "block";
      loadingEl.textContent = "Cargando eventos...";
    }
    if (containerEl) {
      containerEl.innerHTML = "";
    }

    try {
      const res = await fetch("/api/admin/events", {
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!this.checkAuthResponse(res)) return;
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (loadingEl) loadingEl.textContent = `❌ Error al cargar eventos: ${errJson.detail || res.statusText}`;
        return;
      }

      const data = await res.json();
      this.events = data.events || [];

      if (loadingEl) loadingEl.style.display = "none";
      if (containerEl) {
        containerEl.style.display = "flex";
        this.renderEventsList(this.events);
      }

      this.populateEventSelect();
    } catch (err) {
      console.error("Error al cargar eventos:", err);
      if (loadingEl) loadingEl.textContent = `❌ Error de red: ${err.message}`;
    }
  }

  renderEventsList(events) {
    const containerEl = document.getElementById("events-list-container");
    if (!containerEl) return;

    if (!events || events.length === 0) {
      containerEl.innerHTML = `
        <div style="padding: 2rem; text-align: center; background: rgba(0,0,0,0.15); border-radius: var(--radius-md); border: 1px dashed var(--border-medium); color: var(--text-muted); font-size: 0.85rem;">
          No hay eventos registrados actualmente. Crea el primer evento haciendo clic en <strong>➕ Nuevo Evento</strong>.
        </div>
      `;
      return;
    }

    containerEl.innerHTML = events.map(ev => {
      const isActive = Boolean(ev.activo);
      return `
        <div class="event-card-admin" style="display: flex; justify-content: space-between; align-items: center; background: ${isActive ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-glass-card)'}; border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 1rem 1.25rem; transition: all var(--transition-fast);">
          <div style="flex: 1; min-width: 0; padding-right: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); word-break: break-word;">${ev.nombre}</span>
              ${isActive ? '<span style="font-size: 0.72rem; font-weight: 700; background: var(--accent-cyan); color: #041018; padding: 2px 7px; border-radius: var(--radius-full); text-transform: uppercase;">Activo en Mapa</span>' : ''}
              ${ev.tipo ? `<span style="font-size: 0.72rem; background: rgba(255,255,255,0.08); color: var(--text-dim); padding: 2px 7px; border-radius: var(--radius-sm);">${ev.tipo}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap;">
              ${ev.fecha_evento ? `<span>🗓️ <strong>${ev.fecha_evento}</strong></span>` : ''}
              <span>📋 <strong>${ev.total_vacancies || 0}</strong> vacantes registradas</span>
              <span>🆔 #${ev.id}</span>
            </div>
            ${ev.descripcion ? `<p style="font-size: 0.76rem; color: var(--text-dim); margin: 0.4rem 0 0 0; line-height: 1.4;">${ev.descripcion}</p>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            ${!isActive ? `
              <button class="btn btn-secondary btn-sm btn-activate-event" data-id="${ev.id}" title="Marcar como evento público activo en el mapa" style="font-size: 0.75rem; color: var(--accent-cyan); border-color: rgba(6,182,212,0.3);">
                ⚡ Activar
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm btn-edit-event" data-id="${ev.id}" title="Editar evento" style="font-size: 0.75rem;">
              ✏️ Editar
            </button>
            <button class="btn btn-secondary btn-sm btn-delete-event" data-id="${ev.id}" data-name="${ev.nombre}" title="Eliminar evento y sus vacantes" style="font-size: 0.75rem; color: var(--accent-rose); border-color: rgba(244,63,94,0.3);">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Conectar botones de cada fila
    containerEl.querySelectorAll(".btn-activate-event").forEach(btn => {
      btn.addEventListener("click", () => this.activateEvent(btn.dataset.id));
    });
    containerEl.querySelectorAll(".btn-edit-event").forEach(btn => {
      btn.addEventListener("click", () => this.openEditEvent(btn.dataset.id));
    });
    containerEl.querySelectorAll(".btn-delete-event").forEach(btn => {
      btn.addEventListener("click", () => this.deleteEvent(btn.dataset.id, btn.dataset.name));
    });
  }

  openEventForm(eventData = null) {
    const formContainer = document.getElementById("event-form-container");
    const formTitle = document.getElementById("event-form-title");
    const editIdInput = document.getElementById("event-edit-id");
    const nombreInput = document.getElementById("event-input-nombre");
    const tipoInput = document.getElementById("event-input-tipo");
    const fechaInput = document.getElementById("event-input-fecha");
    const descInput = document.getElementById("event-input-descripcion");
    const activoInput = document.getElementById("event-input-activo");

    if (!formContainer) return;

    if (eventData) {
      if (formTitle) formTitle.textContent = `✏️ Editar Evento #${eventData.id}`;
      if (editIdInput) editIdInput.value = eventData.id;
      if (nombreInput) nombreInput.value = eventData.nombre || "";
      if (tipoInput) tipoInput.value = eventData.tipo || "";
      if (fechaInput) fechaInput.value = eventData.fecha_evento || "";
      if (descInput) descInput.value = eventData.descripcion || "";
      if (activoInput) activoInput.checked = Boolean(eventData.activo);
    } else {
      if (formTitle) formTitle.textContent = "➕ Crear Nuevo Evento";
      if (editIdInput) editIdInput.value = "";
      if (nombreInput) nombreInput.value = "";
      if (tipoInput) tipoInput.value = "Cambios de Adscripción";
      if (fechaInput) fechaInput.value = "";
      if (descInput) descInput.value = "";
      if (activoInput) activoInput.checked = true;
    }

    formContainer.style.display = "block";
    formContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (nombreInput) nombreInput.focus();
  }

  closeEventForm() {
    const formContainer = document.getElementById("event-form-container");
    const editIdInput = document.getElementById("event-edit-id");
    if (editIdInput) editIdInput.value = "";
    if (formContainer) formContainer.style.display = "none";
  }

  openEditEvent(eventId) {
    const ev = (this.events || []).find(e => String(e.id) === String(eventId));
    if (ev) {
      this.openEventForm(ev);
    }
  }

  async saveEvent() {
    const editIdInput = document.getElementById("event-edit-id");
    const nombreInput = document.getElementById("event-input-nombre");
    const tipoInput = document.getElementById("event-input-tipo");
    const fechaInput = document.getElementById("event-input-fecha");
    const descInput = document.getElementById("event-input-descripcion");
    const activoInput = document.getElementById("event-input-activo");
    const submitBtn = document.getElementById("btn-save-event-submit");

    const eventId = editIdInput ? editIdInput.value.trim() : "";
    const isEdit = Boolean(eventId);

    const payload = {
      nombre: nombreInput ? nombreInput.value.trim() : "",
      tipo: tipoInput ? tipoInput.value.trim() : "Cambios de Adscripción",
      fecha_evento: fechaInput ? fechaInput.value.trim() : "",
      descripcion: descInput ? descInput.value.trim() : "",
      activo: activoInput ? activoInput.checked : true
    };

    if (!payload.nombre) {
      alert("Por favor ingresa un nombre para el evento.");
      if (nombreInput) nombreInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando...";
    }

    try {
      const url = isEdit ? `/api/admin/events/${eventId}` : "/api/admin/events";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        this.closeEventForm();
        await this.loadEvents();
        this.onDataChanged();
      } else {
        alert("❌ Error: " + (data.detail || data.message || "No se pudo guardar el evento."));
      }
    } catch (err) {
      alert("Error de red al guardar evento: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Guardar Evento";
      }
    }
  }

  async activateEvent(eventId) {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/activate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        await this.loadEvents();
        this.onDataChanged();
      } else {
        alert("❌ Error: " + (data.detail || data.message || "No se pudo activar el evento."));
      }
    } catch (err) {
      alert("Error de red: " + err.message);
    }
  }

  async deleteEvent(eventId, eventName) {
    const confirmMsg = `⚠️ ¿Estás seguro de eliminar el evento "${eventName || '#' + eventId}"?\n\nEsta acción eliminará el evento y TODAS las vacantes asociadas al mismo.\n\n¿Deseas continuar?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!this.checkAuthResponse(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        await this.loadEvents();
        this.onDataChanged();
      } else {
        alert("❌ Error: " + (data.detail || data.message || "No se pudo eliminar el evento."));
      }
    } catch (err) {
      alert("Error de red: " + err.message);
    }
  }

  populateEventSelect() {
    const select = document.getElementById("vacancies-event-select");
    if (!select) return;

    if (!this.events || this.events.length === 0) {
      select.innerHTML = `<option value="1">Evento Principal (ID: 1)</option>`;
      return;
    }

    select.innerHTML = this.events.map(ev => {
      const isAct = ev.activo ? " ⭐ (Activo)" : "";
      return `<option value="${ev.id}" ${ev.activo ? 'selected' : ''}>[ID ${ev.id}] ${ev.nombre}${isAct}</option>`;
    }).join("");
  }
}
