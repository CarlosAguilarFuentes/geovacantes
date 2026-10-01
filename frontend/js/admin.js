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
      this.showDashboard();
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
    formData.append("event_id", 1); // Asignar al evento activo por defecto

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
}
