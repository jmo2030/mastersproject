(() => {
  "use strict";

  const STORE_KEY = "thread-sole-store-v1";
  const SESSION_KEY = "thread-sole-session";
  const BACKUP_DB_NAME = "menengai-jmo-pos-backups";
  const BACKUP_STORE_NAME = "snapshots";
  const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
  const MAX_BACKUPS = 5;
  const defaultUsers = [
    { id: "admin", name: "Store Admin", username: "admin", password: "admin123", role: "Admin", active: true },
    { id: "cashier", name: "Store Cashier", username: "cashier", password: "cashier123", role: "Cashier", active: true },
    { id: "manager", name: "Store Manager", username: "manager", password: "manager123", role: "Manager", active: true },
  ];
  const rolePages = {
    Admin: ["Dashboard", "Point of sale", "Inventory", "Orders", "Sales", "Reports", "Store settings"],
    Manager: ["Dashboard", "Point of sale", "Inventory", "Orders", "Sales", "Reports", "Store settings"],
    Cashier: ["Dashboard", "Point of sale", "Orders", "Sales"],
  };
  const today = new Date();
  const dateText = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(today);
  const money = (amount) => `KSh ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  const productTemplateHeaders = ["SKU", "Product Name", "Category", "Size", "Price (KES)", "Stock"];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const initialProducts = [
    { id: "TS-1001", name: "Classic White Sneakers", category: "Shoes", size: "38–44", price: 6499, stock: 18, icon: "👟", tone: "lavender" },
    { id: "TS-1002", name: "Everyday Canvas Tote", category: "Accessories", size: "One size", price: 2400, stock: 32, icon: "👜", tone: "peach" },
    { id: "TS-1003", name: "Relaxed Linen Shirt", category: "Clothing", size: "S–XL", price: 4950, stock: 14, icon: "👕", tone: "blue" },
    { id: "TS-1004", name: "Leather Chelsea Boots", category: "Shoes", size: "39–44", price: 11900, stock: 7, icon: "👢", tone: "sand" },
    { id: "TS-1005", name: "Ribbed Knit Sweater", category: "Clothing", size: "S–XL", price: 7200, stock: 11, icon: "🧶", tone: "rose" },
    { id: "TS-1006", name: "Everyday Crossbody", category: "Accessories", size: "One size", price: 3800, stock: 21, icon: "👛", tone: "mint" },
    { id: "TS-1007", name: "Classic Denim Jacket", category: "Clothing", size: "S–XL", price: 8900, stock: 9, icon: "🧥", tone: "blue" },
    { id: "TS-1008", name: "Minimal Leather Loafers", category: "Shoes", size: "38–44", price: 9450, stock: 4, icon: "👞", tone: "sand" },
    { id: "TS-1009", name: "Soft Cotton Tee", category: "Clothing", size: "S–XL", price: 2800, stock: 27, icon: "👚", tone: "rose" },
    { id: "TS-1010", name: "Weekend Bucket Hat", category: "Accessories", size: "One size", price: 2200, stock: 0, icon: "🧢", tone: "mint" },
    { id: "TS-1011", name: "Sport Runner Trainers", category: "Shoes", size: "38–44", price: 7800, stock: 16, icon: "👟", tone: "blue" },
    { id: "TS-1012", name: "Soft Knit Cardigan", category: "Clothing", size: "S–XL", price: 6800, stock: 6, icon: "🧶", tone: "lavender" },
  ];
  const demoSaleIds = new Set(["S-1042", "S-1041", "S-1040", "S-1039", "S-1038"]);

  function loadStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.products) && Array.isArray(saved.sales)) {
        if (saved.currency !== "KES") {
          saved.products.forEach((product) => { product.price = Math.round(product.price * 100); });
          saved.sales.forEach((sale) => {
            sale.total = Math.round(sale.total * 100);
            if (Array.isArray(sale.lines)) sale.lines.forEach((line) => { line.price = Math.round(line.price * 100); });
          });
          saved.currency = "KES";
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(saved));
          } catch (error) {
            console.warn("Converted legacy prices to KSh in memory, but could not save the currency migration.", error);
          }
        }
        const remainingSales = saved.sales.filter((sale) => !demoSaleIds.has(sale.id));
        const removedDemoSales = remainingSales.length !== saved.sales.length;
        const resetEmptyDemoSequence = remainingSales.length === 0 && saved.nextSale === 1043;
        const migratedPaymentMethods = saved.sales.some((sale) => sale.method === "Mobile pay");
        saved.sales.forEach((sale) => { if (sale.method === "Mobile pay") sale.method = "M-Pesa"; });
        const validUsers = Array.isArray(saved.users) ? saved.users.filter((user) =>
          user && typeof user.id === "string" && typeof user.name === "string" &&
          typeof user.username === "string" && typeof user.password === "string" &&
          ["Admin", "Manager", "Cashier"].includes(user.role) && typeof user.active === "boolean") : [];
        saved.users = validUsers.length ? validUsers : defaultUsers.map((user) => ({ ...user }));
        saved.orders = Array.isArray(saved.orders) ? saved.orders : [];
        saved.quotations = Array.isArray(saved.quotations) ? saved.quotations : [];
        const orderSequence = saved.orders.reduce((max, order) => Math.max(max, Number(String(order.id).match(/^O-(\d+)$/)?.[1]) || 0), 0) + 1;
        const quotationSequence = saved.quotations.reduce((max, quote) => Math.max(max, Number(String(quote.id).match(/^Q-(\d+)$/)?.[1]) || 0), 0) + 1;
        saved.nextOrder = Number.isInteger(saved.nextOrder) && saved.nextOrder >= orderSequence ? saved.nextOrder : orderSequence;
        saved.nextQuotation = Number.isInteger(saved.nextQuotation) && saved.nextQuotation >= quotationSequence ? saved.nextQuotation : quotationSequence;
        if (removedDemoSales || resetEmptyDemoSequence || migratedPaymentMethods) {
          saved.sales = remainingSales;
          if (resetEmptyDemoSequence) saved.nextSale = 1;
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(saved));
          } catch (error) {
            console.warn("Removed sample transactions in memory, but could not save the cleanup.", error);
          }
        }
        return saved;
      }
    } catch (error) {
      console.warn("Saved shop data could not be read; loading the sample inventory.", error);
    }
    return { products: initialProducts, sales: [], orders: [], quotations: [], nextOrder: 1, nextQuotation: 1, users: defaultUsers.map((user) => ({ ...user })), nextSale: 1, currency: "KES" };
  }

  const state = { ...loadStore(), page: "Dashboard", category: "All items", search: "", cart: [], payment: "Card", taxEnabled: false, reportTab: "Sales", reportPeriod: "7", settingsTab: "Company profile", ordersTab: "Orders", backupStatus: "Checking browser backup storage...", backupRecords: [], backupError: "" };
  state.companyProfile = {
    email: typeof state.companyProfile?.email === "string" ? state.companyProfile.email : "",
    phone: typeof state.companyProfile?.phone === "string" ? state.companyProfile.phone : "",
    website: typeof state.companyProfile?.website === "string" ? state.companyProfile.website : "",
  };
  if (typeof state.logoDataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,/.test(state.logoDataUrl)) state.logoDataUrl = "";
  state.reportTab = "Sales";
  state.reportPeriod = "7";
  const app = document.getElementById("app");
  const productDialog = document.getElementById("product-dialog");
  const receiptDialog = document.getElementById("receipt-dialog");
  const documentDialog = document.getElementById("document-dialog");
  let toastTimer;
  let backupInProgress = false;
  let deferredInstallPrompt = null;

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ products: state.products, sales: state.sales, orders: state.orders, quotations: state.quotations, nextOrder: state.nextOrder, nextQuotation: state.nextQuotation, users: state.users, nextSale: state.nextSale, currency: "KES", logoDataUrl: state.logoDataUrl, companyProfile: state.companyProfile }));
      return true;
    } catch (error) {
      showToast("Could not save your changes in this browser.");
      console.error("Shop data could not be saved.", error);
      return false;
    }
  }

  function openBackupDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("This browser does not support local automatic backups."));
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(BACKUP_DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open backup storage."));
    });
  }

  async function getBackupRecords() {
    const database = await openBackupDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(BACKUP_STORE_NAME, "readonly");
      const request = transaction.objectStore(BACKUP_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error || new Error("Could not read saved backups."));
      transaction.onerror = () => reject(transaction.error || new Error("Could not read saved backups."));
      transaction.oncomplete = () => database.close();
      transaction.onabort = () => database.close();
    });
  }

  function backupData() {
    return {
      products: state.products,
      sales: state.sales,
      users: state.users,
      orders: state.orders,
      quotations: state.quotations,
      nextOrder: state.nextOrder,
      nextQuotation: state.nextQuotation,
      nextSale: state.nextSale,
      currency: "KES",
      logoDataUrl: state.logoDataUrl,
      companyProfile: state.companyProfile,
    };
  }

  async function createBackup(force = false) {
    if (backupInProgress) return;
    backupInProgress = true;
    let database;
    try {
      database = await openBackupDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(BACKUP_STORE_NAME, "readwrite");
        const store = transaction.objectStore(BACKUP_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const records = request.result.sort((a, b) => b.createdAt - a.createdAt);
          const now = Date.now();
          if (!force && records.length && now - records[0].createdAt < BACKUP_INTERVAL_MS) return;
          store.put({ id: String(now), createdAt: now, format: "menengai-jmo-pos-backup", version: 1, data: backupData() });
          records.slice(MAX_BACKUPS - 1).forEach((record) => store.delete(record.id));
        };
        request.onerror = () => reject(request.error || new Error("Could not read existing backups."));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("Could not save an automatic backup."));
        transaction.onabort = () => reject(transaction.error || new Error("Automatic backup was cancelled."));
      });
      state.backupRecords = await getBackupRecords();
      state.backupError = "";
      state.backupStatus = state.backupRecords.length ? `Last backup: ${new Date(state.backupRecords[0].createdAt).toLocaleString()}` : "Automatic backup is ready.";
      if (state.page === "Store settings" && state.settingsTab === "Backups") renderApp();
    } catch (error) {
      state.backupError = error.message || "Automatic backup could not be saved.";
      state.backupStatus = state.backupError;
      console.error("Automatic shop backup failed.", error);
      if (state.page === "Store settings" && state.settingsTab === "Backups") renderApp();
    } finally {
      if (database) database.close();
      backupInProgress = false;
    }
  }

  function initializeBackupScheduler() {
    getBackupRecords().then((records) => {
      state.backupRecords = records;
      if (!records.length || Date.now() - records[0].createdAt >= BACKUP_INTERVAL_MS) {
        createBackup();
      } else {
        state.backupStatus = `Last backup: ${new Date(records[0].createdAt).toLocaleString()}`;
        if (state.page === "Store settings" && state.settingsTab === "Backups") renderApp();
      }
    }).catch((error) => {
      state.backupError = error.message || "Automatic backup storage could not be opened.";
      state.backupStatus = state.backupError;
      console.error("Automatic shop backup storage could not be opened.", error);
      if (state.page === "Store settings" && state.settingsTab === "Backups") renderApp();
    });
    window.setInterval(() => {
      if (!state.backupError && (!state.backupRecords.length || Date.now() - state.backupRecords[0].createdAt >= BACKUP_INTERVAL_MS)) createBackup();
    }, 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !state.backupError && (!state.backupRecords.length || Date.now() - state.backupRecords[0].createdAt >= BACKUP_INTERVAL_MS)) createBackup();
    });
  }

  function downloadBackup(record) {
    const file = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `menengai-jmo-backup-${new Date(record.createdAt).toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function validateBackup(record) {
    const validDocument = (entry, statuses) => entry && typeof entry.id === "string" &&
      typeof entry.customer === "string" && Array.isArray(entry.lines) &&
      entry.lines.every((line) => line && typeof line.productId === "string" && typeof line.name === "string" &&
        Number.isInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.price) && Number.isFinite(line.total)) &&
      Number.isFinite(entry.total) && statuses.includes(entry.status);
    if (!record || record.format !== "menengai-jmo-pos-backup" || record.version !== 1 || !record.data ||
        !Array.isArray(record.data.products) || !Array.isArray(record.data.sales) || !Array.isArray(record.data.users) ||
        (record.data.orders !== undefined && (!Array.isArray(record.data.orders) || !record.data.orders.every((entry) => validDocument(entry, ["Pending", "Fulfilled", "Cancelled"])))) ||
        (record.data.quotations !== undefined && (!Array.isArray(record.data.quotations) || !record.data.quotations.every((entry) => validDocument(entry, ["Open", "Converted"])))) ||
        !record.data.products.every((product) => product && typeof product.id === "string" && typeof product.name === "string" && Number.isFinite(product.price) && Number.isFinite(product.stock)) ||
        !record.data.sales.every((sale) => sale && typeof sale.id === "string" && Number.isFinite(sale.total)) ||
        !record.data.users.length ||
        !record.data.users.every((user) => user && typeof user.id === "string" && typeof user.name === "string" && typeof user.username === "string" && typeof user.password === "string" && typeof user.active === "boolean" && ["Admin", "Manager", "Cashier"].includes(user.role)) ||
        !record.data.users.some((user) => user.role === "Admin" && user.active)) {
      throw new Error("This file is not a valid MENENGAI JMO POS backup.");
    }
    return record.data;
  }

  async function restoreBackup(file) {
    try {
      const data = validateBackup(JSON.parse(await file.text()));
      if (!window.confirm("Restore this backup? It will replace the products, sales, staff accounts, and logo currently saved in this browser.")) return;
      await createBackup(true);
      if (state.backupError) throw new Error("Could not preserve the current data, so the restore was cancelled.");
      const previous = {
        products: state.products, sales: state.sales, users: state.users,
        nextSale: state.nextSale, nextOrder: state.nextOrder, nextQuotation: state.nextQuotation,
        orders: state.orders, quotations: state.quotations,
        currency: state.currency, logoDataUrl: state.logoDataUrl, companyProfile: state.companyProfile,
      };
      Object.assign(state, {
        products: data.products,
        sales: data.sales,
        users: data.users,
        orders: Array.isArray(data.orders) ? data.orders : [],
        quotations: Array.isArray(data.quotations) ? data.quotations : [],
        nextSale: Number.isInteger(data.nextSale) && data.nextSale > 0 ? data.nextSale : 1,
        nextOrder: Number.isInteger(data.nextOrder) && data.nextOrder > 0 ? data.nextOrder : 1,
        nextQuotation: Number.isInteger(data.nextQuotation) && data.nextQuotation > 0 ? data.nextQuotation : 1,
        currency: "KES",
        logoDataUrl: typeof data.logoDataUrl === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(data.logoDataUrl) ? data.logoDataUrl : "",
        companyProfile: {
          email: typeof data.companyProfile?.email === "string" ? data.companyProfile.email : "",
          phone: typeof data.companyProfile?.phone === "string" ? data.companyProfile.phone : "",
          website: typeof data.companyProfile?.website === "string" ? data.companyProfile.website : "",
        },
      });
      if (!saveStore()) {
        Object.assign(state, previous);
        return;
      }
      await createBackup(true);
      renderApp();
      showToast("Backup restored successfully.");
    } catch (error) {
      const message = document.getElementById("backup-message");
      if (message) message.textContent = error.message || "Could not read this backup file.";
      else showToast(error.message || "Could not read this backup file.");
    }
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      showToast("Use your browser menu to install or add this app to your home screen.");
      return;
    }
    try {
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") showToast("App installation started.");
      document.querySelectorAll("[data-install-app]").forEach((button) => { button.hidden = true; });
    } catch (error) {
      console.error("The app install prompt could not be opened.", error);
      showToast("Could not open the install prompt. Try your browser menu.");
    }
  }

  app.addEventListener("click", (event) => {
    if (event.target.closest("[data-install-app]")) installApp();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.querySelectorAll("[data-install-app]").forEach((button) => { button.hidden = false; });
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.querySelectorAll("[data-install-app]").forEach((button) => { button.hidden = true; });
    showToast("MENENGAI JMO POS installed.");
  });

  const navItems = [
    ["Dashboard", "▦"], ["Point of sale", "▣"], ["Inventory", "▤"], ["Orders", "▣"], ["Sales", "↗"], ["Reports", "▧"], ["Store settings", "⚙"],
  ];

  function signedInUser() {
    return state.users.find((user) => user.id === sessionStorage.getItem(SESSION_KEY) && user.active);
  }

  function brandMark() {
    return state.logoDataUrl
      ? `<img class="brand-logo" src="${state.logoDataUrl}" alt="MENENGAI JMO ENTERPRISES logo" />`
      : "M";
  }

  function companyContactMarkup() {
    const contacts = [
      state.companyProfile.email && `Email: ${escapeHtml(state.companyProfile.email)}`,
      state.companyProfile.phone && `Phone: ${escapeHtml(state.companyProfile.phone)}`,
      state.companyProfile.website && escapeHtml(state.companyProfile.website),
    ].filter(Boolean);
    return contacts.length ? `<div class="company-contact-lines">${contacts.map((contact) => `<span>${contact}</span>`).join("")}</div>` : "";
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="login-screen">
        <section class="login-brand-panel">
          <div class="brand"><div class="brand-mark">${brandMark()}</div><div><div class="brand-name">MENENGAI JMO ENTERPRISES</div><div class="brand-sub">KIAMUNYI · RETAIL POS</div></div></div>
          <div class="login-pitch"><h1>Your store,<br>in good hands.</h1><p>A simpler way to sell, keep track of every size, and see how your shop is doing.</p>
            <div class="login-highlight"><span class="login-highlight-icon">✦</span><span>One place for your sales, stock, and store insights</span></div>
          </div>
          <div class="login-footer">© ${today.getFullYear()} MENENGAI JMO ENTERPRISES · Kiamunyi</div>
        </section>
        <section class="login-form-panel"><form class="login-form" id="login-form">
          <h2>Welcome back</h2><p>Sign in to your store dashboard.</p>
          <label class="field">Username<input name="username" autocomplete="username" placeholder="Enter your username" required /></label>
          <label class="field">Password<input name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required /></label>
          <div class="login-error" id="login-error" aria-live="polite"></div>
          <button class="primary-button" type="submit">Sign in <span>→</span></button>
          <button class="secondary-button install-app-button" type="button" data-install-app hidden>Install app</button>
          <div class="login-hint">Demo accounts · admin / admin123 · manager / manager123 · cashier / cashier123</div>
        </form></section>
      </main>`;
    document.getElementById("login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const username = String(data.get("username")).trim().toLowerCase();
      const user = state.users.find((entry) => entry.username.toLowerCase() === username && entry.password === data.get("password") && entry.active);
      if (user) {
        sessionStorage.setItem(SESSION_KEY, user.id);
        renderApp();
      } else {
        document.getElementById("login-error").textContent = "Check your username and password, or contact the store admin.";
      }
    });
  }

  function shell(content) {
    return `<div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><div class="brand-mark">${brandMark()}</div><div><div class="brand-name">MENENGAI JMO ENTERPRISES</div><div class="brand-sub">KIAMUNYI · RETAIL POS</div></div></div>
        <div class="nav-label">WORKSPACE</div>
        <nav class="nav-list" aria-label="Main navigation">${navItems.filter(([name]) => rolePages[signedInUser().role]?.includes(name)).map(([name, icon]) => `<button class="nav-button ${state.page === name ? "active" : ""}" data-page="${name}"><span class="nav-icon">${icon}</span>${name}</button>`).join("")}</nav>
        <div class="sidebar-spacer"></div>
        <div class="help-card"><div class="help-icon">✦</div><div class="help-title">Need a hand?</div><div class="help-copy">Your shop data is saved in this browser. Export or back it up regularly.</div></div>
        <div class="user-card"><div class="avatar">${escapeHtml(signedInUser().name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</div><div><div class="user-name">${escapeHtml(signedInUser().name)}</div><div class="user-role">${escapeHtml(signedInUser().role)}</div></div><button class="logout" id="logout" title="Sign out" aria-label="Sign out">↪</button></div>
      </aside>
      <main class="main">
        <header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="icon-button mobile-menu" id="menu-button" aria-label="Open menu">☰</button><div class="breadcrumb">Workspace <span style="padding:0 6px;color:#c5c5ce">/</span> <strong>${escapeHtml(state.page)}</strong></div></div>
          <div class="topbar-right"><span class="date-label">${dateText}</span><button class="secondary-button install-app-button" type="button" data-install-app hidden>Install app</button><button class="icon-button" aria-label="Notifications">♧<span class="notification-dot"></span></button></div>
        </header>${content}
      </main>
    </div>`;
  }

  function statCard(label, value, icon, tone, foot) {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tone}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }

  function salesForToday() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return state.sales.filter((sale) => new Date(sale.date) >= start);
  }

  function roundMoney(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function cartLineDiscount(item) {
    return roundMoney(item.price * item.quantity * (item.discountPercent || 0) / 100);
  }

  function cartTotals(items, taxEnabled = false) {
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const discount = roundMoney(items.reduce((sum, item) => sum + cartLineDiscount(item), 0));
    const taxableSubtotal = roundMoney(subtotal - discount);
    const tax = taxEnabled ? roundMoney(taxableSubtotal * .08) : 0;
    return { subtotal, discount, tax, taxEnabled, total: roundMoney(taxableSubtotal + tax) };
  }

  function salesRows(sales, limit) {
    return [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit).map((sale) => `
      <tr><td><strong style="color:#565763">${escapeHtml(sale.id)}</strong></td><td>${escapeHtml(sale.customer)}</td><td>${sale.items} item${sale.items === 1 ? "" : "s"}</td><td>${money(sale.discount || 0)}</td><td>${money(sale.tax || 0)}</td><td>${money(sale.total)}</td><td>${escapeHtml(sale.method)}</td><td><span class="badge paid">Completed</span></td></tr>`).join("");
  }

  function salesTable(sales, heading, showAllLink) {
    return `<section class="panel table-panel"><div class="panel-heading"><div><div class="panel-title">${heading}</div><div class="panel-subtitle">A quick look at your latest transactions</div></div>${showAllLink ? `<button class="text-button" data-page="Sales">View all →</button>` : ""}</div>
      <div class="table-wrap"><table><thead><tr><th>Sale ID</th><th>Customer</th><th>Items</th><th>Discount</th><th>Tax</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${salesRows(sales, showAllLink ? 5 : 100) || `<tr><td colspan="8" class="empty-state">No completed sales yet.</td></tr>`}</tbody></table></div></section>`;
  }

  function dashboard() {
    const todaySales = salesForToday();
    const revenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const lowStock = state.products.filter((product) => product.stock > 0 && product.stock <= 7).length;
    const topProducts = [...state.products].sort((a, b) => b.stock - a.stock).slice(0, 4);
    const chartPoints = [33, 48, 41, 66, 54, 72, 59, 83, 66, 96, 78, 111];
    const coords = chartPoints.map((y, index) => `${50 + index * 56},${153 - y}`).join(" ");
    const area = `50,153 ${coords} 666,153`;
    return `<div class="content">
      <div class="page-heading"><div><h1>Good ${today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, Admin <span style="font-size:21px">✦</span></h1><p>Here's what's happening at your store today.</p></div><button class="primary-button" data-page="Point of sale">＋ &nbsp;New sale</button></div>
      <div class="stats-grid">
        ${statCard("Today's revenue", money(revenue), "↗", "purple", `<span class="trend">● Today</span><span>from ${todaySales.length} sale${todaySales.length === 1 ? "" : "s"}</span>`)}
        ${statCard("Completed sales", String(todaySales.length), "▤", "green", `<span class="trend">● Today</span><span>completed transactions</span>`)}
        ${statCard("Products in stock", String(state.products.reduce((sum, product) => sum + product.stock, 0)), "▣", "orange", `<span>${state.products.length} product styles</span>`)}
        ${statCard("Low stock alerts", String(lowStock), "⚑", "pink", `<span>${state.products.filter((product) => product.stock === 0).length} products out of stock</span>`)}
      </div>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-heading"><div><div class="panel-title">Sales overview</div><div class="panel-subtitle">A snapshot of your store's performance</div></div><select class="select-small" aria-label="Sales period"><option>This week</option><option>This month</option></select></div>
          <div class="chart"><svg viewBox="0 0 700 180" role="img" aria-label="Illustrative weekly sales trend"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#58a7d6" stop-opacity=".22"/><stop offset="100%" stop-color="#58a7d6" stop-opacity="0"/></linearGradient></defs>
            <line class="chart-grid" x1="42" y1="30" x2="685" y2="30"/><line class="chart-grid" x1="42" y1="72" x2="685" y2="72"/><line class="chart-grid" x1="42" y1="113" x2="685" y2="113"/><line class="chart-grid" x1="42" y1="153" x2="685" y2="153"/>
            <text class="chart-label" x="0" y="33">KSh 40k</text><text class="chart-label" x="0" y="75">KSh 30k</text><text class="chart-label" x="0" y="116">KSh 20k</text><text class="chart-label" x="0" y="156">KSh 10k</text>
            <polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${coords}"/>
            ${chartPoints.map((y, index) => `<circle class="chart-point" cx="${50 + index * 56}" cy="${153 - y}" r="3"/>`).join("")}
            ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, index) => `<text class="chart-label" x="${50 + index * 93}" y="174">${day}</text>`).join("")}
          </svg></div><div class="chart-legend"><span class="legend-dot"></span>Sales revenue</div>
        </section>
        <section class="panel"><div class="panel-heading"><div><div class="panel-title">Stock on hand</div><div class="panel-subtitle">Products with the most units</div></div><button class="text-button" data-page="Inventory">Inventory →</button></div>
          <div class="best-list">${topProducts.map((product) => `<div class="best-item"><div class="mini-product tone-${product.tone}">${product.icon}</div><div class="mini-info"><div class="mini-name">${escapeHtml(product.name)}</div><div class="mini-category">${escapeHtml(product.category)}</div></div><div class="mini-sales">${product.stock} units</div></div>`).join("")}</div>
        </section>
      </div>${salesTable(state.sales, "Recent sales", true)}
    </div>`;
  }

  function stockBadge(product) {
    if (product.stock === 0) return `<span class="badge out">Out of stock</span>`;
    if (product.stock <= 7) return `<span class="badge low">Low stock</span>`;
    return `<span class="badge good">In stock</span>`;
  }

  function productTable(products, editable = true) {
    return `<div class="table-wrap"><table class="inventory-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Size range</th><th>Price</th><th>In stock</th><th>Status</th>${editable ? "<th>Actions</th>" : ""}</tr></thead><tbody>${products.map((product) => `
      <tr><td><div class="table-product"><span class="table-emoji tone-${product.tone}">${product.icon}</span>${escapeHtml(product.name)}</div></td><td>${escapeHtml(product.id)}</td><td>${escapeHtml(product.category)}</td><td>${escapeHtml(product.size)}</td><td><strong>${money(product.price)}</strong></td><td>${product.stock}</td><td>${stockBadge(product)}</td>${editable ? `<td><div class="inventory-actions"><button class="small-action" data-edit="${escapeHtml(product.id)}" aria-label="Edit ${escapeHtml(product.name)}" title="Edit product">✎</button><button class="small-action" data-delete="${escapeHtml(product.id)}" aria-label="Delete ${escapeHtml(product.name)}" title="Delete product">⌫</button></div></td>` : ""}</tr>`).join("") || `<tr><td colspan="${editable ? 8 : 7}" class="empty-state">No products match your search.</td></tr>`}</tbody></table></div>`;
  }

  function inventory() {
    const query = state.search.toLowerCase();
    const products = state.products.filter((product) => `${product.name} ${product.id} ${product.category}`.toLowerCase().includes(query) && (state.category === "All items" || product.category === state.category));
    const units = state.products.reduce((sum, product) => sum + product.stock, 0);
    return `<div class="content"><div class="page-heading"><div><h1>Inventory</h1><p>Manage your clothing, shoes, and accessories.</p></div><button class="primary-button" id="add-product">＋ &nbsp;Add product</button></div>
      <div class="toolbar"><label class="search-box"><span>⌕</span><input id="inventory-search" value="${escapeHtml(state.search)}" placeholder="Search products or SKU..." aria-label="Search products" /></label>
        <select class="filter-select" id="inventory-category" aria-label="Filter by category"><option ${state.category === "All items" ? "selected" : ""}>All items</option><option ${state.category === "Clothing" ? "selected" : ""}>Clothing</option><option ${state.category === "Shoes" ? "selected" : ""}>Shoes</option><option ${state.category === "Accessories" ? "selected" : ""}>Accessories</option></select>
        <button class="secondary-button" id="download-template">↓ &nbsp;Download template</button>
        <button class="secondary-button" id="upload-products">↑ &nbsp;Upload products</button>
        <button class="secondary-button" id="export-inventory">↧ &nbsp;Export CSV</button></div>
      <p class="import-hint">Upload a CSV using the template columns: SKU, Product Name, Category, Size, Price (KES), and Stock. Existing SKUs are rejected; duplicate rows are never overwritten.</p>
      <div class="inventory-summary"><span><strong>${state.products.length}</strong> product styles</span><span><strong>${units}</strong> total units</span><span><strong>${state.products.filter((p) => p.stock <= 7).length}</strong> low/out of stock</span></div>
      <section class="panel table-panel" style="padding-top:0">${productTable(products)}</section>
    </div>`;
  }

  function pos() {
    const categories = ["All items", "Clothing", "Shoes", "Accessories"];
    const products = state.products.filter((product) => (state.category === "All items" || product.category === state.category) && `${product.name} ${product.id}`.toLowerCase().includes(state.search.toLowerCase()));
    const totals = cartTotals(state.cart, state.taxEnabled);
    return `<div class="content"><div class="page-heading"><div><h1>Point of sale</h1><p>Pick an item to add it to the current sale.</p></div><span class="badge good">Register open</span></div>
      <div class="pos-layout"><div class="pos-main">
        <label class="search-box" style="display:block;max-width:none;margin-bottom:12px"><span>⌕</span><input id="pos-search" value="${escapeHtml(state.search)}" placeholder="Search products by name or SKU..." aria-label="Search products" /></label>
        <div class="category-tabs">${categories.map((category) => `<button class="category-tab ${state.category === category ? "active" : ""}" data-category="${category}">${category}</button>`).join("")}</div>
        <div class="product-grid">${products.map((product) => `<article class="product-card" data-add-cart="${escapeHtml(product.id)}" role="button" tabindex="${product.stock ? "0" : "-1"}" aria-label="${escapeHtml(product.name)}, ${money(product.price)}${product.stock ? ", add to sale" : ", out of stock"}"><div class="product-art tone-${product.tone}">${product.icon}</div><div class="product-name">${escapeHtml(product.name)}</div><div class="product-meta"><span>${escapeHtml(product.category)} · ${escapeHtml(product.size)}</span><span>${product.stock} left</span></div><div style="display:flex;align-items:baseline;justify-content:space-between"><div class="product-price">${money(product.price)}</div>${product.stock === 0 ? `<span class="product-stock">Sold out</span>` : ""}</div></article>`).join("") || `<div class="empty-state">No matching products found.</div>`}</div>
      </div><aside class="panel cart-panel"><div class="cart-header"><h2>Current sale</h2><span class="cart-count">${state.cart.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
        <div class="cart-list">${state.cart.length ? state.cart.map((item) => {
          const discount = cartLineDiscount(item);
          const lineTotal = roundMoney(item.price * item.quantity - discount);
          return `<div class="cart-item"><div class="cart-item-art tone-${item.tone}">${item.icon}</div><div class="cart-item-details"><div class="cart-item-name">${escapeHtml(item.name)}</div><div class="cart-item-price">${money(item.price)} each</div><label class="discount-control">Bargain discount<input type="number" min="0" max="100" step="1" inputmode="numeric" value="${item.discountPercent || 0}" data-discount="${escapeHtml(item.id)}" aria-label="Discount percentage for ${escapeHtml(item.name)}" /><span>%</span></label><div class="qty-controls"><button class="qty-button" data-qty="${escapeHtml(item.id)}" data-change="-1" aria-label="Remove one">−</button><span class="qty-number">${item.quantity}</span><button class="qty-button" data-qty="${escapeHtml(item.id)}" data-change="1" aria-label="Add one">+</button></div></div><div class="cart-line-total">${discount ? `<span class="discounted-from">${money(item.price * item.quantity)}</span>` : ""}${money(lineTotal)}</div></div>`;
        }).join("") : `<div class="cart-empty">Your sale is empty.<br>Choose a product to get started.</div>`}</div>
        <div class="cart-summary"><div class="summary-row"><span>Subtotal</span><span data-cart-subtotal>${money(totals.subtotal)}</span></div><div class="summary-row discount-row"><span>Discount</span><span data-cart-discount>− ${money(totals.discount)}</span></div><label class="tax-toggle"><span class="tax-toggle-copy"><strong>Add tax</strong><small>8% calculated after discounts</small></span><input id="tax-enabled" type="checkbox" ${state.taxEnabled ? "checked" : ""} aria-label="Add 8% tax to this sale" /><span class="tax-switch" aria-hidden="true"></span></label><div class="summary-row ${state.taxEnabled ? "" : "tax-not-applied"}" data-tax-row><span>Tax ${state.taxEnabled ? "(8%)" : "(not applied)"}</span><span data-cart-tax>${money(totals.tax)}</span></div><div class="summary-row total"><span>Total</span><span data-cart-total>${money(totals.total)}</span></div></div>
        <div class="checkout-area"><select class="payment-select" id="payment-method" aria-label="Payment method"><option>Cash</option><option>M-Pesa</option><option>Card</option></select><button class="primary-button" id="checkout" ${state.cart.length ? "" : "disabled"}>Complete sale &nbsp;·&nbsp; ${money(totals.total)}</button></div>
      </aside></div></div>`;
  }

  function salesPage() {
    const revenue = state.sales.reduce((sum, sale) => sum + sale.total, 0);
    const discounts = state.sales.reduce((sum, sale) => sum + (sale.discount || 0), 0);
    const taxes = state.sales.reduce((sum, sale) => sum + (sale.tax || 0), 0);
    return `<div class="content"><div class="page-heading"><div><h1>Sales</h1><p>Review completed transactions from your register.</p></div><button class="secondary-button" id="export-sales">↧ &nbsp;Export CSV</button></div>
      <div class="stats-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${statCard("Total revenue", money(revenue), "↗", "purple", `<span>${state.sales.length} recorded transactions</span>`)}${statCard("Discounts given", money(discounts), "％", "pink", `<span>Bargain savings for customers</span>`)}${statCard("Tax collected", money(taxes), "▤", "green", `<span>Tax added at checkout</span>`)}${statCard("Average sale", money(state.sales.length ? revenue / state.sales.length : 0), "◈", "orange", `<span>Per transaction</span>`)}</div>
      ${salesTable(state.sales, "All transactions", false)}
    </div>`;
  }

  function orderStatusBadge(status) {
    const tone = status === "Fulfilled" || status === "Open" ? "good" : status === "Cancelled" || status === "Expired" ? "out" : "low";
    return `<span class="badge ${tone}">${escapeHtml(status)}</span>`;
  }

  function quotationStatus(quote) {
    if (quote.status !== "Open") return quote.status;
    return new Date(quote.validUntil) < new Date() ? "Expired" : "Open";
  }

  function ordersPage() {
    const orders = [...state.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
    const quotations = [...state.quotations].sort((a, b) => new Date(b.date) - new Date(a.date));
    const content = state.ordersTab === "Orders"
      ? `<section class="panel table-panel order-table"><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th><th>Actions</th></tr></thead><tbody>${orders.map((order) => `<tr><td><strong>${escapeHtml(order.id)}</strong></td><td>${escapeHtml(order.customer)}</td><td>${order.itemCount}</td><td><strong>${money(order.total)}</strong></td><td>${orderStatusBadge(order.status)}</td><td>${new Date(order.date).toLocaleDateString()}</td><td><div class="inventory-actions"><button class="small-action" data-print-order="${escapeHtml(order.id)}">Print</button>${order.status === "Pending" ? `<button class="small-action" data-fulfill-order="${escapeHtml(order.id)}">Fulfill</button><button class="small-action" data-cancel-order="${escapeHtml(order.id)}">Cancel</button>` : ""}</div></td></tr>`).join("") || `<tr><td colspan="7" class="empty-state">No orders yet. Create an order to reserve available stock.</td></tr>`}</tbody></table></div></section>`
      : `<section class="panel table-panel order-table"><div class="table-wrap"><table><thead><tr><th>Quotation</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Valid until</th><th>Actions</th></tr></thead><tbody>${quotations.map((quote) => {
        const status = quotationStatus(quote);
        return `<tr><td><strong>${escapeHtml(quote.id)}</strong></td><td>${escapeHtml(quote.customer)}</td><td>${quote.itemCount}</td><td><strong>${money(quote.total)}</strong></td><td>${orderStatusBadge(status)}</td><td>${new Date(quote.validUntil).toLocaleDateString()}</td><td><div class="inventory-actions"><button class="small-action" data-print-quote="${escapeHtml(quote.id)}">Print</button>${status === "Open" ? `<button class="small-action" data-convert-quote="${escapeHtml(quote.id)}">Create order</button>` : ""}</div></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="empty-state">No quotations yet. Create a quotation for items currently in stock.</td></tr>`}</tbody></table></div></section>`;
    return `<div class="content">
      <div class="page-heading"><div><h1>Orders & quotations</h1><p>Manage stock-reserved customer orders and prepare quotations for available items.</p></div><div class="order-heading-actions"><button class="secondary-button" id="new-quotation">Create quotation</button><button class="primary-button" id="new-order">＋ &nbsp;New order</button></div></div>
      <div class="report-tabs order-tabs" role="tablist" aria-label="Orders and quotations"><button class="report-tab ${state.ordersTab === "Orders" ? "active" : ""}" role="tab" aria-selected="${state.ordersTab === "Orders"}" data-orders-tab="Orders">Orders (${orders.length})</button><button class="report-tab ${state.ordersTab === "Quotations" ? "active" : ""}" role="tab" aria-selected="${state.ordersTab === "Quotations"}" data-orders-tab="Quotations">Quotations (${quotations.length})</button></div>
      ${content}
      <p class="user-management-note order-stock-note">Pending orders reserve stock immediately. Fulfilled orders keep the stock deduction; cancelling a pending order returns its reserved items. Quotations do not reserve stock and are valid for 14 days.</p>
    </div>`;
  }

  function documentLineMarkup(index, selectedId = "", quantity = 1) {
    const available = state.products.filter((product) => product.stock > 0);
    const selected = available.find((product) => product.id === selectedId) || available[0];
    return `<div class="document-item-row" data-document-line="${index}">
      <label class="field">In-stock item<select data-document-product="${index}" required>${available.map((product) => `<option value="${escapeHtml(product.id)}" ${selected?.id === product.id ? "selected" : ""}>${escapeHtml(product.name)} · ${product.stock} in stock · ${money(product.price)}</option>`).join("")}</select></label>
      <label class="field">Quantity<input data-document-quantity="${index}" type="number" min="1" max="${selected?.stock || 1}" step="1" value="${Math.min(quantity, selected?.stock || 1)}" required /></label>
      <button class="small-action document-remove-line" type="button" data-remove-document-line="${index}" aria-label="Remove item" ${index === 0 ? "disabled" : ""}>Remove</button>
    </div>`;
  }

  function openDocumentForm(kind, draft = null) {
    const isQuote = kind === "quotation";
    const available = state.products.some((product) => product.stock > 0);
    if (!available) { showToast("There are no in-stock products to add."); return; }
    const lines = draft?.lines || [{ id: "", quantity: 1 }];
    documentDialog.innerHTML = `<form id="document-form" class="document-form"><div class="modal-head"><h2>${isQuote ? "Create quotation" : "Create customer order"}</h2><button class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field">Customer name<input name="customer" required maxlength="80" value="${escapeHtml(draft?.customer || "")}" placeholder="Customer or business name" /></label>
          <label class="field">Phone or email<input name="contact" maxlength="120" value="${escapeHtml(draft?.contact || "")}" placeholder="Optional contact details" /></label>
        </div>
        <div class="document-lines-heading"><strong>Items from current stock</strong><button class="secondary-button" type="button" id="add-document-line">＋ Add item</button></div>
        <div id="document-lines">${lines.map((line, index) => documentLineMarkup(index, line.id, line.quantity)).join("")}</div>
        <label class="document-tax-option"><input name="taxApplied" type="checkbox" ${draft?.taxApplied ? "checked" : ""} /> Include 8% tax</label>
        <div class="document-total-preview"><span>Estimated ${isQuote ? "quotation" : "order"} total</span><strong id="document-total">${money(documentDraftTotals(lines, Boolean(draft?.taxApplied)).total)}</strong></div>
        <div class="document-error" id="document-error" role="alert" aria-live="polite"></div>
      </div>
      <div class="modal-actions"><button class="secondary-button" type="button" id="cancel-document">Cancel</button><button class="primary-button" type="submit">${isQuote ? "Save & print quotation" : "Place order"}</button></div></form>`;
    if (!documentDialog.open) documentDialog.showModal();
    documentDialog.querySelector(".modal-close").addEventListener("click", () => documentDialog.close());
    document.getElementById("cancel-document").addEventListener("click", () => documentDialog.close());
    document.getElementById("add-document-line").addEventListener("click", () => {
      const current = readDocumentDraft();
      current.lines.push({ id: "", quantity: 1 });
      openDocumentForm(kind, current);
    });
    documentDialog.querySelectorAll("[data-remove-document-line]").forEach((button) => button.addEventListener("click", () => {
      const current = readDocumentDraft();
      current.lines.splice(Number(button.dataset.removeDocumentLine), 1);
      openDocumentForm(kind, current);
    }));
    documentDialog.querySelectorAll("[data-document-product]").forEach((select) => select.addEventListener("change", () => {
      const input = document.querySelector(`[data-document-quantity="${select.dataset.documentProduct}"]`);
      const product = state.products.find((entry) => entry.id === select.value);
      if (product && input) { input.max = product.stock; input.value = Math.min(Number(input.value) || 1, product.stock); }
      updateDocumentTotal();
    }));
    documentDialog.querySelectorAll("[data-document-quantity]").forEach((input) => input.addEventListener("input", updateDocumentTotal));
    documentDialog.querySelector('[name="taxApplied"]').addEventListener("change", updateDocumentTotal);
    document.getElementById("document-form").addEventListener("submit", (event) => {
      event.preventDefault();
      saveBusinessDocument(kind);
    });
  }

  function readDocumentDraft() {
    const form = document.getElementById("document-form");
    return {
      customer: form.elements.customer.value,
      contact: form.elements.contact.value,
      taxApplied: form.elements.taxApplied.checked,
      lines: [...form.querySelectorAll("[data-document-line]")].map((row) => ({
        id: row.querySelector("[data-document-product]").value,
        quantity: Number(row.querySelector("[data-document-quantity]").value) || 1,
      })),
    };
  }

  function documentDraftTotals(lines, taxEnabled) {
    const subtotal = roundMoney(lines.reduce((sum, line) => {
      const product = state.products.find((entry) => entry.id === line.id) || state.products.find((entry) => entry.stock > 0);
      return sum + (product ? product.price * (Number(line.quantity) || 1) : 0);
    }, 0));
    const tax = taxEnabled ? roundMoney(subtotal * .08) : 0;
    return { subtotal, tax, total: roundMoney(subtotal + tax) };
  }

  function updateDocumentTotal() {
    const form = document.getElementById("document-form");
    if (!form) return;
    const draft = readDocumentDraft();
    document.getElementById("document-total").textContent = money(documentDraftTotals(draft.lines, draft.taxApplied).total);
  }

  function saveBusinessDocument(kind) {
    const form = document.getElementById("document-form");
    const draft = readDocumentDraft();
    const error = document.getElementById("document-error");
    const customer = draft.customer.trim();
    if (!customer) { error.textContent = "Enter the customer name."; return; }
    const quantities = new Map();
    const lines = [];
    for (const line of draft.lines) {
      const product = state.products.find((entry) => entry.id === line.id);
      if (!product || product.stock <= 0) { error.textContent = "One of the selected items is no longer in stock."; return; }
      if (!Number.isInteger(line.quantity) || line.quantity < 1) { error.textContent = "Item quantities must be whole numbers greater than zero."; return; }
      const requested = (quantities.get(product.id) || 0) + line.quantity;
      if (requested > product.stock) { error.textContent = `${product.name} has only ${product.stock} available.`; return; }
      quantities.set(product.id, requested);
      lines.push({ productId: product.id, name: product.name, size: product.size, quantity: line.quantity, price: product.price, total: roundMoney(line.quantity * product.price) });
    }
    if (!lines.length) { error.textContent = "Add at least one in-stock item."; return; }
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
    const tax = draft.taxApplied ? roundMoney(subtotal * .08) : 0;
    const record = {
      id: kind === "order" ? `O-${state.nextOrder}` : `Q-${state.nextQuotation}`,
      customer,
      contact: draft.contact.trim(),
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      tax,
      taxApplied: draft.taxApplied,
      total: roundMoney(subtotal + tax),
      date: new Date().toISOString(),
    };
    if (kind === "order") {
      record.status = "Pending";
      record.createdBy = signedInUser().name;
      quantities.forEach((quantity, id) => { state.products.find((entry) => entry.id === id).stock -= quantity; });
      state.orders.unshift(record);
      state.nextOrder += 1;
    } else {
      record.status = "Open";
      record.validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      record.createdBy = signedInUser().name;
      state.quotations.unshift(record);
      state.nextQuotation += 1;
    }
    if (!saveStore()) {
      if (kind === "order") {
        quantities.forEach((quantity, id) => { state.products.find((entry) => entry.id === id).stock += quantity; });
        state.orders.shift();
        state.nextOrder -= 1;
      } else {
        state.quotations.shift();
        state.nextQuotation -= 1;
      }
      return;
    }
    documentDialog.close();
    state.ordersTab = kind === "order" ? "Orders" : "Quotations";
    renderApp();
    if (kind === "quotation") renderBusinessDocument("quotation", record);
    else showToast(`${record.id} placed; stock reserved.`);
  }

  function updateOrderStatus(id, status) {
    const order = state.orders.find((entry) => entry.id === id);
    if (!order || order.status !== "Pending") return;
    const previousStatus = order.status;
    if (status === "Cancelled") {
      order.lines.forEach((line) => {
        const product = state.products.find((entry) => entry.id === line.productId);
        if (product) product.stock += line.quantity;
      });
    }
    order.status = status;
    if (!saveStore()) {
      order.status = previousStatus;
      if (status === "Cancelled") order.lines.forEach((line) => {
        const product = state.products.find((entry) => entry.id === line.productId);
        if (product) product.stock -= line.quantity;
      });
      return;
    }
    renderApp();
    showToast(status === "Cancelled" ? "Order cancelled; reserved stock returned." : "Order marked fulfilled.");
  }

  function convertQuotationToOrder(id) {
    const quote = state.quotations.find((entry) => entry.id === id);
    if (!quote || quotationStatus(quote) !== "Open") return;
    const quantities = new Map();
    for (const line of quote.lines) {
      const product = state.products.find((entry) => entry.id === line.productId);
      const requested = (quantities.get(line.productId) || 0) + line.quantity;
      if (!product || product.stock < requested) {
        showToast(`${line.name} no longer has enough stock for this quotation.`);
        return;
      }
      quantities.set(line.productId, requested);
    }
    const order = {
      ...quote,
      id: `O-${state.nextOrder}`,
      quoteId: quote.id,
      date: new Date().toISOString(),
      status: "Pending",
      createdBy: signedInUser().name,
      lines: quote.lines.map((line) => ({ ...line })),
    };
    quantities.forEach((quantity, productId) => { state.products.find((entry) => entry.id === productId).stock -= quantity; });
    state.orders.unshift(order);
    state.nextOrder += 1;
    quote.status = "Converted";
    quote.orderId = order.id;
    if (!saveStore()) {
      quantities.forEach((quantity, productId) => { state.products.find((entry) => entry.id === productId).stock += quantity; });
      state.orders.shift();
      state.nextOrder -= 1;
      quote.status = "Open";
      delete quote.orderId;
      return;
    }
    state.ordersTab = "Orders";
    renderApp();
    showToast(`${quote.id} converted to ${order.id}; stock reserved.`);
  }

  function renderBusinessDocument(kind, record) {
    const isQuote = kind === "quotation";
    const lines = record.lines.map((line) => `<tr><td>${escapeHtml(line.name)}<small>${escapeHtml(line.size || "")}</small></td><td>${line.quantity}</td><td>${money(line.price)}</td><td>${money(line.total)}</td></tr>`).join("");
    const contacts = companyContactMarkup();
    documentDialog.innerHTML = `<div class="business-document">
      <div class="document-brand">${state.logoDataUrl ? `<img src="${state.logoDataUrl}" alt="" />` : ""}<div><strong>MENENGAI JMO ENTERPRISES</strong><span>KIAMUNYI</span>${contacts}</div></div>
      <h2>${isQuote ? "QUOTATION" : "CUSTOMER ORDER"}</h2>
      <div class="document-meta"><span><strong>${isQuote ? "Quotation" : "Order"}:</strong> ${escapeHtml(record.id)}</span><span><strong>Date:</strong> ${new Date(record.date).toLocaleDateString()}</span>${isQuote ? `<span><strong>Valid until:</strong> ${new Date(record.validUntil).toLocaleDateString()}</span>` : `<span><strong>Status:</strong> ${escapeHtml(record.status)}</span>`}</div>
      <div class="document-customer"><strong>Prepared for</strong><span>${escapeHtml(record.customer)}</span>${record.contact ? `<span>${escapeHtml(record.contact)}</span>` : ""}</div>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table></div>
      <div class="document-totals"><div><span>Subtotal</span><span>${money(record.subtotal)}</span></div><div><span>Tax ${record.taxApplied ? "(8%)" : "(not applied)"}</span><span>${money(record.tax)}</span></div><strong><span>Total</span><span>${money(record.total)}</span></strong></div>
      ${isQuote ? `<p class="document-terms">This quotation is valid for 14 days and does not reserve stock. Availability is confirmed when an order is placed.</p>` : `<p class="document-terms">Order items are reserved from available stock until fulfilled or cancelled.</p>`}
      <p class="document-thanks">Thank you for choosing MENENGAI JMO ENTERPRISES.</p>
    </div><div class="modal-actions document-modal-actions"><button class="secondary-button" id="close-business-document">Close</button><button class="primary-button" id="print-business-document">Print ${isQuote ? "quotation" : "order"}</button></div>`;
    documentDialog.showModal();
    document.getElementById("close-business-document").addEventListener("click", () => documentDialog.close());
    document.getElementById("print-business-document").addEventListener("click", () => window.print());
  }

  function reportSalesForPeriod() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (state.reportPeriod === "7") start.setDate(start.getDate() - 6);
    else if (state.reportPeriod === "30") start.setDate(start.getDate() - 29);
    else if (state.reportPeriod === "all") return [...state.sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    return state.sales.filter((sale) => new Date(sale.date) >= start && new Date(sale.date) <= now)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function reportRangeLabel() {
    return { today: "Today", "7": "Last 7 days", "30": "Last 30 days", all: "All time" }[state.reportPeriod];
  }

  function salesReport() {
    const sales = reportSalesForPeriod();
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const discounts = sales.reduce((sum, sale) => sum + (sale.discount || 0), 0);
    const itemCount = sales.reduce((sum, sale) => sum + sale.items, 0);
    const byDay = new Map();
    sales.forEach((sale) => {
      const key = new Date(sale.date).toLocaleDateString("en-CA");
      const entry = byDay.get(key) || { date: new Date(sale.date), orders: 0, revenue: 0, discounts: 0, tax: 0 };
      entry.orders += 1;
      entry.revenue += sale.total;
      entry.discounts += sale.discount || 0;
      entry.tax += sale.tax || 0;
      byDay.set(key, entry);
    });
    const taxCollected = sales.reduce((sum, sale) => sum + (sale.tax || 0), 0);
    const dailyRows = [...byDay.values()].sort((a, b) => b.date - a.date).map((entry) => `
      <tr><td>${entry.date.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td><td>${entry.orders}</td><td>${money(entry.discounts)}</td><td>${money(entry.tax)}</td><td>${money(entry.revenue / entry.orders)}</td><td><strong>${money(entry.revenue)}</strong></td></tr>`).join("");
    const lineProducts = new Map();
    sales.forEach((sale) => (sale.lines || []).forEach((line) => {
      const entry = lineProducts.get(line.name) || { units: 0, revenue: 0 };
      entry.units += line.quantity;
      entry.revenue += line.price * line.quantity - (line.discountAmount || 0);
      lineProducts.set(line.name, entry);
    }));
    const topProducts = [...lineProducts.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 5);
    return `<div class="report-columns">
      <section class="panel report-panel"><div class="panel-heading"><div><div class="panel-title">Sales summary</div><div class="panel-subtitle">Revenue and order activity · ${reportRangeLabel()}</div></div></div>
        <div class="report-kpis"><div class="report-kpi"><span>Sales collected</span><strong>${money(revenue)}</strong></div><div class="report-kpi"><span>Discounts given</span><strong>${money(discounts)}</strong></div><div class="report-kpi"><span>Tax collected</span><strong>${money(taxCollected)}</strong></div><div class="report-kpi"><span>Transactions</span><strong>${sales.length}</strong></div><div class="report-kpi"><span>Units sold</span><strong>${itemCount}</strong></div><div class="report-kpi"><span>Average order</span><strong>${money(sales.length ? revenue / sales.length : 0)}</strong></div></div>
      </section>
      <section class="panel report-panel"><div class="panel-heading"><div><div class="panel-title">Top-selling products</div><div class="panel-subtitle">Units and sales from recorded item details</div></div></div>
        ${topProducts.length ? `<div class="report-ranking">${topProducts.map(([name, data], index) => `<div class="ranking-row"><span class="ranking-number">${index + 1}</span><span class="ranking-name">${escapeHtml(name)}</span><strong>${data.units} units</strong><span>${money(data.revenue)}</span></div>`).join("")}</div>` : `<div class="report-empty">Product-level breakdown becomes available for sales recorded at checkout. Older demo sales only include order totals.</div>`}
      </section>
    </div>
    <section class="panel table-panel report-table"><div class="panel-heading"><div><div class="panel-title">Sales by day</div><div class="panel-subtitle">${dailyRows ? "Daily transaction totals for the selected period" : "No sales in this period"}</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Transactions</th><th>Discounts</th><th>Tax</th><th>Average order</th><th>Collected</th></tr></thead><tbody>${dailyRows || `<tr><td colspan="6" class="empty-state">Try a longer date range to view sales.</td></tr>`}</tbody></table></div></section>`;
  }

  function inventoryReport() {
    const categories = ["Clothing", "Shoes", "Accessories"];
    const units = state.products.reduce((sum, product) => sum + product.stock, 0);
    const value = state.products.reduce((sum, product) => sum + product.stock * product.price, 0);
    const lowStock = state.products.filter((product) => product.stock <= 7).sort((a, b) => a.stock - b.stock);
    const rows = categories.map((category) => {
      const products = state.products.filter((product) => product.category === category);
      const categoryUnits = products.reduce((sum, product) => sum + product.stock, 0);
      const categoryValue = products.reduce((sum, product) => sum + product.stock * product.price, 0);
      return `<tr><td><strong>${category}</strong></td><td>${products.length}</td><td>${categoryUnits}</td><td>${money(categoryValue)}</td><td>${products.filter((product) => product.stock <= 7).length}</td></tr>`;
    }).join("");
    return `<div class="report-kpis report-kpis-three">
      <div class="report-kpi"><span>Inventory retail value</span><strong>${money(value)}</strong></div>
      <div class="report-kpi"><span>Units on hand</span><strong>${units}</strong></div>
      <div class="report-kpi"><span>Low or out of stock</span><strong>${lowStock.length}</strong></div>
    </div>
    <section class="panel table-panel report-table"><div class="panel-heading"><div><div class="panel-title">Stock by category</div><div class="panel-subtitle">Current quantities and retail value at listed prices</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Category</th><th>Product styles</th><th>Units on hand</th><th>Retail value</th><th>Low/out</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="panel table-panel report-table"><div class="panel-heading"><div><div class="panel-title">Reorder watchlist</div><div class="panel-subtitle">Products with 7 or fewer units</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Size</th><th>Units left</th><th>Suggested reorder</th></tr></thead><tbody>${lowStock.map((product) => `<tr><td><div class="table-product"><span class="table-emoji tone-${product.tone}">${product.icon}</span>${escapeHtml(product.name)}</div></td><td>${escapeHtml(product.id)}</td><td>${product.category}</td><td>${escapeHtml(product.size)}</td><td>${product.stock === 0 ? `<span class="badge out">Out</span>` : `<span class="badge low">${product.stock}</span>`}</td><td>${Math.max(0, 10 - product.stock)} units</td></tr>`).join("") || `<tr><td colspan="6" class="empty-state">All products have more than 7 units in stock.</td></tr>`}</tbody></table></div></section>`;
  }

  function paymentReport() {
    const sales = reportSalesForPeriod();
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const taxCollected = sales.reduce((sum, sale) => sum + (sale.tax || 0), 0);
    const methods = new Map();
    sales.forEach((sale) => {
      const method = sale.method || "Unspecified";
      const entry = methods.get(method) || { transactions: 0, revenue: 0 };
      entry.transactions += 1;
      entry.revenue += sale.total;
      methods.set(method, entry);
    });
    const rows = [...methods.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([method, data]) => {
      const percentage = revenue ? data.revenue / revenue * 100 : 0;
      return `<tr><td><strong>${escapeHtml(method)}</strong></td><td>${data.transactions}</td><td>${percentage.toFixed(1)}%</td><td><strong>${money(data.revenue)}</strong></td><td><div class="report-bar-track"><span style="width:${percentage.toFixed(2)}%"></span></div></td></tr>`;
    }).join("");
    return `<div class="report-kpis report-kpis-four">
      <div class="report-kpi"><span>Payments received</span><strong>${money(revenue)}</strong></div>
      <div class="report-kpi"><span>Tax included</span><strong>${money(taxCollected)}</strong></div>
      <div class="report-kpi"><span>Transactions</span><strong>${sales.length}</strong></div>
      <div class="report-kpi"><span>Payment methods used</span><strong>${methods.size}</strong></div>
    </div>
    <section class="panel table-panel report-table"><div class="panel-heading"><div><div class="panel-title">Payment method breakdown</div><div class="panel-subtitle">${reportRangeLabel()} · share is based on sales value</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Payment method</th><th>Transactions</th><th>Share of revenue</th><th>Revenue</th><th>Share</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="empty-state">No payments in this period.</td></tr>`}</tbody></table></div></section>
    <section class="panel report-note"><strong>Payment reconciliation</strong><span>Compare these recorded totals with your cash drawer, card terminal, and M-Pesa statements for the same period.</span></section>`;
  }

  function reportsPage() {
    const tabs = ["Sales", "Inventory", "Payments"];
    const content = state.reportTab === "Inventory" ? inventoryReport() : state.reportTab === "Payments" ? paymentReport() : salesReport();
    return `<div class="content reports-content">
      <div class="reports-print-heading"><div class="reports-print-brand">${state.logoDataUrl ? `<img src="${state.logoDataUrl}" alt="" />` : ""}<div><strong>MENENGAI JMO ENTERPRISES</strong><span>KIAMUNYI</span>${companyContactMarkup()}</div></div><h1>${state.reportTab} Report</h1><p>${reportRangeLabel()} · Generated ${new Date().toLocaleString()}</p></div>
      <div class="page-heading"><div><h1>Reports</h1><p>Explore sales performance, stock health, and payment collections.</p></div><button class="secondary-button" id="export-report">↧ &nbsp;Export PDF</button></div>
      <div class="report-toolbar"><div class="report-tabs" role="tablist" aria-label="Report type">${tabs.map((tab) => `<button class="report-tab ${state.reportTab === tab ? "active" : ""}" role="tab" aria-selected="${state.reportTab === tab}" data-report-tab="${tab}">${tab}</button>`).join("")}</div>
        ${state.reportTab !== "Inventory" ? `<label class="report-period-label">Period<select class="filter-select" id="report-period" aria-label="Report date range"><option value="today" ${state.reportPeriod === "today" ? "selected" : ""}>Today</option><option value="7" ${state.reportPeriod === "7" ? "selected" : ""}>Last 7 days</option><option value="30" ${state.reportPeriod === "30" ? "selected" : ""}>Last 30 days</option><option value="all" ${state.reportPeriod === "all" ? "selected" : ""}>All time</option></select></label>` : ""}
      </div>${content}</div>`;
  }

  function storeSettingsPage() {
    const tabs = signedInUser().role === "Admin" ? ["Company profile", "User management", "Backups"] : ["Company profile"];
    const tabsMarkup = `<div class="report-tabs settings-tabs" role="tablist" aria-label="Settings">${tabs.map((tab) => `<button class="report-tab ${state.settingsTab === tab ? "active" : ""}" role="tab" aria-selected="${state.settingsTab === tab}" data-settings-tab="${tab}">${tab}</button>`).join("")}</div>`;
    const companyProfile = `<section class="panel settings-panel"><div class="settings-logo-preview"><div class="brand-mark">${brandMark()}</div><div><div class="brand-name">MENENGAI JMO ENTERPRISES</div><div class="brand-sub">KIAMUNYI · RETAIL POS</div></div></div>
        <div class="settings-copy"><h2>Company logo</h2><p>Upload a PNG, JPG, or WebP logo up to 5 MB. It will appear in the sidebar, sign-in screen, receipts, and PDF reports. Your logo is saved in this browser.</p></div>
        <div class="settings-actions"><label class="primary-button upload-logo-button" for="company-logo-upload">↑ &nbsp;Upload company logo</label><input id="company-logo-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden />${state.logoDataUrl ? `<button class="secondary-button" id="remove-company-logo">Remove logo</button>` : ""}</div>
        <div class="settings-message" id="logo-message" role="status" aria-live="polite"></div>
      </section>
      <form class="panel company-contact-panel" id="company-contact-form">
        <div class="settings-copy"><h2>Receipt contact details</h2><p>These details appear on new printed receipts. Leave a field blank to omit it.</p></div>
        <div class="company-contact-fields">
          <label class="field">Email address<input name="email" type="email" maxlength="120" value="${escapeHtml(state.companyProfile.email)}" placeholder="info@yourcompany.co.ke" /></label>
          <label class="field">Phone contact<input name="phone" type="tel" maxlength="40" value="${escapeHtml(state.companyProfile.phone)}" placeholder="+254 7XX XXX XXX" /></label>
          <label class="field full">Company website<input name="website" type="url" maxlength="200" value="${escapeHtml(state.companyProfile.website)}" placeholder="https://www.example.co.ke" /></label>
        </div>
        <div class="settings-actions"><button class="primary-button" type="submit">Save receipt details</button></div>
        <div class="settings-message" id="company-contact-message" role="status" aria-live="polite"></div>
      </form>`;
    const userManagement = `<section class="panel table-panel user-management-panel">
      <div class="panel-heading"><div><div class="panel-title">Staff profiles</div><div class="panel-subtitle">Create and manage administrator, manager, and cashier accounts.</div></div><button class="primary-button" id="add-user">＋ &nbsp;Add user</button></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.users.map((user) => `<tr><td><strong>${escapeHtml(user.name)}</strong></td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.role)}</td><td><span class="badge ${user.active ? "good" : "low"}">${user.active ? "Active" : "Inactive"}</span></td><td><div class="inventory-actions"><button class="small-action" data-edit-user="${escapeHtml(user.id)}">Edit</button>${user.id !== signedInUser().id ? `<button class="small-action" data-toggle-user="${escapeHtml(user.id)}">${user.active ? "Deactivate" : "Activate"}</button><button class="small-action" data-delete-user="${escapeHtml(user.id)}">Delete</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>
      <div class="user-role-guide"><div><strong>Admin</strong><span>All pages, settings, and user accounts</span></div><div><strong>Manager</strong><span>Inventory, orders, sales, reports, and company profile</span></div><div><strong>Cashier</strong><span>Dashboard, checkout, orders, and sales history</span></div></div>
      <p class="user-management-note">Roles help identify staff profiles. Cashier accounts can use the dashboard, register, orders, and sales history; managers can also manage inventory and reports. Admins can manage all areas and user accounts. This browser-only demo is not secure for production use.</p>
    </section>`;
    const latestBackup = state.backupRecords[0];
    const backupPanel = `<section class="panel backup-panel">
      <div class="backup-copy"><h2>Automatic backups</h2><p>A backup is saved in this browser every 12 hours while the POS is open. If the browser is closed, the next backup runs when you reopen the app. Download a copy to keep it outside this browser.</p></div>
      <div class="backup-status ${state.backupError ? "backup-error" : ""}" role="status" aria-live="polite"><strong>${escapeHtml(state.backupStatus)}</strong><span>${latestBackup ? `Next automatic backup: ${new Date(latestBackup.createdAt + BACKUP_INTERVAL_MS).toLocaleString()}. ${state.backupRecords.length} of ${MAX_BACKUPS} recent backups kept in this browser.` : "No backup has been saved yet."}</span></div>
      <div class="backup-actions"><button class="primary-button" id="backup-now">Create backup now</button><button class="secondary-button" id="download-backup" ${latestBackup ? "" : "disabled"}>Download latest backup</button><label class="secondary-button restore-backup-button" for="restore-backup-file">Restore from file</label><input id="restore-backup-file" type="file" accept=".json,application/json" hidden /></div>
      <div id="backup-message" class="settings-message" role="status" aria-live="polite"></div>
      <p class="user-management-note">Automatic backups stay in this browser and may be lost if its site data is cleared. Download backup files regularly to keep an independent copy. Backup files include staff account credentials; store them securely.</p>
    </section>`;
    const selectedContent = state.settingsTab === "User management" && signedInUser().role === "Admin" ? userManagement
      : state.settingsTab === "Backups" && signedInUser().role === "Admin" ? backupPanel : companyProfile;
    return `<div class="content"><div class="page-heading"><div><h1>Store settings</h1><p>Manage your business identity, staff profiles, and backups.</p></div></div>${tabsMarkup}${selectedContent}</div>`;
  }

  function renderApp() {
    const user = signedInUser();
    if (!user) { sessionStorage.removeItem(SESSION_KEY); renderLogin(); return; }
    if (!rolePages[user.role]?.includes(state.page)) state.page = "Dashboard";
    if (state.page === "Store settings" && user.role !== "Admin") state.settingsTab = "Company profile";
    const content = state.page === "Dashboard" ? dashboard() : state.page === "Inventory" ? inventory() : state.page === "Point of sale" ? pos() : state.page === "Orders" ? ordersPage() : state.page === "Reports" ? reportsPage() : state.page === "Store settings" ? storeSettingsPage() : salesPage();
    app.innerHTML = shell(content);
    bindAppEvents();
  }

  function bindAppEvents() {
    app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
      state.page = button.dataset.page;
      state.search = "";
      state.category = "All items";
      renderApp();
    }));
    app.querySelectorAll("[data-report-tab]").forEach((button) => button.addEventListener("click", () => {
      state.reportTab = button.dataset.reportTab;
      renderApp();
    }));
    app.querySelectorAll("[data-settings-tab]").forEach((button) => button.addEventListener("click", () => {
      state.settingsTab = button.dataset.settingsTab;
      renderApp();
    }));
    app.querySelectorAll("[data-orders-tab]").forEach((button) => button.addEventListener("click", () => {
      state.ordersTab = button.dataset.ordersTab;
      renderApp();
    }));
    document.getElementById("logout").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      state.cart = [];
      renderLogin();
    });
    document.getElementById("menu-button").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
    const addButton = document.getElementById("add-product");
    if (addButton) addButton.addEventListener("click", () => openProductForm());
    const search = document.getElementById("inventory-search");
    if (search) search.addEventListener("input", () => { const position = search.selectionStart; state.search = search.value; renderApp(); const next = document.getElementById("inventory-search"); next.focus(); next.setSelectionRange(position, position); });
    const category = document.getElementById("inventory-category");
    if (category) category.addEventListener("change", () => { state.category = category.value; renderApp(); });
    const posSearch = document.getElementById("pos-search");
    if (posSearch) posSearch.addEventListener("input", () => { const position = posSearch.selectionStart; state.search = posSearch.value; renderApp(); const next = document.getElementById("pos-search"); next.focus(); next.setSelectionRange(position, position); });
    app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; renderApp(); }));
    app.querySelectorAll("[data-add-cart]").forEach((card) => {
      const add = () => addToCart(card.dataset.addCart);
      card.addEventListener("click", add);
      card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); add(); } });
    });
    app.querySelectorAll("[data-qty]").forEach((button) => button.addEventListener("click", () => updateCart(button.dataset.qty, Number(button.dataset.change))));
    app.querySelectorAll("[data-discount]").forEach((input) => input.addEventListener("change", () => {
      const item = state.cart.find((entry) => entry.id === input.dataset.discount);
      if (!item) return;
      const percentage = Number(input.value);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        showToast("Discount must be between 0% and 100%.");
        input.value = item.discountPercent || 0;
        return;
      }
      item.discountPercent = percentage;
      input.value = percentage;
      const lineDiscount = cartLineDiscount(item);
      input.closest(".cart-item").querySelector(".cart-line-total").innerHTML = `${lineDiscount ? `<span class="discounted-from">${money(item.price * item.quantity)}</span>` : ""}${money(roundMoney(item.price * item.quantity - lineDiscount))}`;
      const totals = cartTotals(state.cart, state.taxEnabled);
      document.querySelector("[data-cart-subtotal]").textContent = money(totals.subtotal);
      document.querySelector("[data-cart-discount]").textContent = `− ${money(totals.discount)}`;
      document.querySelector("[data-cart-tax]").textContent = money(totals.tax);
      document.querySelector("[data-cart-total]").textContent = money(totals.total);
      document.getElementById("checkout").innerHTML = `Complete sale &nbsp;·&nbsp; ${money(totals.total)}`;
    }));
    app.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openProductForm(button.dataset.edit)));
    app.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteProduct(button.dataset.delete)));
    const payment = document.getElementById("payment-method");
    if (payment) { payment.value = state.payment; payment.addEventListener("change", () => { state.payment = payment.value; }); }
    const checkout = document.getElementById("checkout");
    if (checkout) checkout.addEventListener("click", completeSale);
    const newOrder = document.getElementById("new-order");
    if (newOrder) newOrder.addEventListener("click", () => openDocumentForm("order"));
    const newQuotation = document.getElementById("new-quotation");
    if (newQuotation) newQuotation.addEventListener("click", () => openDocumentForm("quotation"));
    app.querySelectorAll("[data-fulfill-order]").forEach((button) => button.addEventListener("click", () => updateOrderStatus(button.dataset.fulfillOrder, "Fulfilled")));
    app.querySelectorAll("[data-cancel-order]").forEach((button) => button.addEventListener("click", () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.cancelOrder);
      if (order && window.confirm(`Cancel ${order.id} and return its reserved items to stock?`)) updateOrderStatus(order.id, "Cancelled");
    }));
    app.querySelectorAll("[data-print-order]").forEach((button) => button.addEventListener("click", () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.printOrder);
      if (order) renderBusinessDocument("order", order);
    }));
    app.querySelectorAll("[data-print-quote]").forEach((button) => button.addEventListener("click", () => {
      const quote = state.quotations.find((entry) => entry.id === button.dataset.printQuote);
      if (quote) renderBusinessDocument("quotation", quote);
    }));
    app.querySelectorAll("[data-convert-quote]").forEach((button) => button.addEventListener("click", () => convertQuotationToOrder(button.dataset.convertQuote)));
    const exportInventory = document.getElementById("export-inventory");
    if (exportInventory) exportInventory.addEventListener("click", () => downloadCsv("menengai-jmo-inventory.csv", productTemplateHeaders, state.products.map((p) => [p.id, p.name, p.category, p.size, p.price.toFixed(2), p.stock])));
    const downloadTemplateButton = document.getElementById("download-template");
    if (downloadTemplateButton) downloadTemplateButton.addEventListener("click", () => downloadCsv("menengai-jmo-product-template.csv", productTemplateHeaders, []));
    const uploadButton = document.getElementById("upload-products");
    if (uploadButton) uploadButton.addEventListener("click", openImportDialog);
    const exportSales = document.getElementById("export-sales");
    if (exportSales) exportSales.addEventListener("click", () => downloadCsv("menengai-jmo-sales.csv", ["Sale ID", "Customer", "Items", "Discount (KES)", "Tax (KES)", "Tax applied", "Total (KES)", "Payment", "Date"], state.sales.map((s) => [s.id, s.customer, s.items, (s.discount || 0).toFixed(2), (s.tax || 0).toFixed(2), s.taxApplied ? "Yes" : "No", s.total.toFixed(2), s.method, new Date(s.date).toLocaleString()])));
    const reportPeriod = document.getElementById("report-period");
    if (reportPeriod) reportPeriod.addEventListener("change", () => { state.reportPeriod = reportPeriod.value; renderApp(); });
    const taxEnabled = document.getElementById("tax-enabled");
    if (taxEnabled) taxEnabled.addEventListener("change", () => {
      state.taxEnabled = taxEnabled.checked;
      const totals = cartTotals(state.cart, state.taxEnabled);
      document.querySelector("[data-cart-tax]").textContent = money(totals.tax);
      document.querySelector("[data-cart-total]").textContent = money(totals.total);
      taxEnabled.closest(".cart-summary").querySelector("[data-tax-row]").classList.toggle("tax-not-applied", !state.taxEnabled);
      const taxLabel = taxEnabled.closest(".cart-summary").querySelector("[data-cart-tax]").previousElementSibling;
      taxLabel.textContent = state.taxEnabled ? "Tax (8%)" : "Tax (not applied)";
      document.getElementById("checkout").innerHTML = `Complete sale &nbsp;·&nbsp; ${money(totals.total)}`;
    });
    const exportReport = document.getElementById("export-report");
    if (exportReport) exportReport.addEventListener("click", () => {
      const previousTitle = document.title;
      document.title = `MENENGAI JMO ENTERPRISES - ${state.reportTab} Report - ${reportRangeLabel()}`;
      window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
      showToast("In the print window, choose Save as PDF.");
      window.print();
    });
    const logoUpload = document.getElementById("company-logo-upload");
    if (logoUpload) logoUpload.addEventListener("change", uploadCompanyLogo);
    const contactForm = document.getElementById("company-contact-form");
    if (contactForm) contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(contactForm);
      const previousProfile = state.companyProfile;
      state.companyProfile = {
        email: String(data.get("email")).trim(),
        phone: String(data.get("phone")).trim(),
        website: String(data.get("website")).trim(),
      };
      if (!saveStore()) {
        state.companyProfile = previousProfile;
        return;
      }
      renderApp();
      showToast("Receipt contact details saved.");
    });
    const addUser = document.getElementById("add-user");
    if (addUser) addUser.addEventListener("click", () => openUserForm());
    app.querySelectorAll("[data-edit-user]").forEach((button) => button.addEventListener("click", () => openUserForm(button.dataset.editUser)));
    app.querySelectorAll("[data-toggle-user]").forEach((button) => button.addEventListener("click", () => toggleUser(button.dataset.toggleUser)));
    app.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", () => deleteUser(button.dataset.deleteUser)));
    const removeLogo = document.getElementById("remove-company-logo");
    if (removeLogo) removeLogo.addEventListener("click", () => {
      const previousLogo = state.logoDataUrl;
      state.logoDataUrl = "";
      if (!saveStore()) state.logoDataUrl = previousLogo;
      renderApp();
      if (!state.logoDataUrl) showToast("Company logo removed.");
    });
    const backupNow = document.getElementById("backup-now");
    if (backupNow) backupNow.addEventListener("click", () => { state.backupError = ""; createBackup(true); });
    const downloadLatestBackup = document.getElementById("download-backup");
    if (downloadLatestBackup) downloadLatestBackup.addEventListener("click", () => {
      if (state.backupRecords[0]) downloadBackup(state.backupRecords[0]);
    });
    const restoreInput = document.getElementById("restore-backup-file");
    if (restoreInput) restoreInput.addEventListener("change", async () => {
      const file = restoreInput.files[0];
      if (file) await restoreBackup(file);
      restoreInput.value = "";
    });
  }

  function uploadCompanyLogo(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    if (!file) return;
    const message = document.getElementById("logo-message");
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      message.textContent = "Choose a PNG, JPG, or WebP image.";
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.textContent = "The logo file must be 5 MB or smaller.";
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => { message.textContent = "The selected logo could not be read."; input.value = ""; };
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => { message.textContent = "The selected file is not a valid image."; input.value = ""; };
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) { message.textContent = "Could not process this image in the browser."; input.value = ""; return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const logoDataUrl = canvas.toDataURL("image/webp", 0.88);
        if (logoDataUrl.length > 700000) {
          message.textContent = "This logo is too detailed to save in browser storage. Try a smaller image.";
          input.value = "";
          return;
        }
        const previousLogo = state.logoDataUrl;
        state.logoDataUrl = logoDataUrl;
        if (!saveStore()) {
          state.logoDataUrl = previousLogo;
          message.textContent = "Could not save the logo in this browser. Free up storage and try again.";
          input.value = "";
          return;
        }
        renderApp();
        showToast("Company logo uploaded.");
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function addToCart(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product || product.stock === 0) { showToast("This product is out of stock."); return; }
    const cartItem = state.cart.find((item) => item.id === id);
    if (cartItem && cartItem.quantity >= product.stock) { showToast("There aren't enough units left in stock."); return; }
    if (cartItem) cartItem.quantity += 1;
    else state.cart.push({ ...product, quantity: 1, discountPercent: 0 });
    renderApp();
  }

  function updateCart(id, amount) {
    const item = state.cart.find((entry) => entry.id === id);
    if (!item) return;
    const product = state.products.find((entry) => entry.id === id);
    const quantity = item.quantity + amount;
    if (quantity > (product?.stock ?? 0)) { showToast("There aren't enough units left in stock."); return; }
    if (quantity <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
    else item.quantity = quantity;
    renderApp();
  }

  function completeSale() {
    if (!state.cart.length) return;
    for (const item of state.cart) {
      const product = state.products.find((entry) => entry.id === item.id);
      if (!product || product.stock < item.quantity) { showToast(`Not enough stock for ${item.name}.`); state.cart = []; renderApp(); return; }
    }
    const totals = cartTotals(state.cart, state.taxEnabled);
    const sale = {
      id: `S-${state.nextSale++}`,
      customer: "Walk-in customer",
      items: state.cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      taxApplied: totals.taxEnabled,
      total: totals.total,
      method: state.payment,
      date: new Date().toISOString(),
      lines: state.cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        discountPercent: item.discountPercent || 0,
        discountAmount: cartLineDiscount(item),
        total: roundMoney(item.price * item.quantity - cartLineDiscount(item)),
      })),
    };
    state.cart.forEach((item) => { state.products.find((product) => product.id === item.id).stock -= item.quantity; });
    state.sales.unshift(sale);
    state.cart = [];
    saveStore();
    renderReceipt(sale);
    renderApp();
  }

  function renderReceipt(sale) {
    receiptDialog.innerHTML = `<div class="receipt"><div class="receipt-brand">${state.logoDataUrl ? `<img src="${state.logoDataUrl}" alt="Company logo" />` : ""}<strong>MENENGAI JMO ENTERPRISES</strong></div><div class="receipt-sub">KIAMUNYI · Thank you for shopping with us</div>${companyContactMarkup()}
      <div class="receipt-meta"><span>Receipt</span><strong>${escapeHtml(sale.id)}</strong></div><div class="receipt-meta" style="border-top:0;padding-top:0"><span>Date</span><span>${new Date(sale.date).toLocaleString()}</span></div>
      <div class="receipt-lines">${sale.lines.map((line) => `<div class="receipt-line"><span>${escapeHtml(line.name)} × ${line.quantity}${line.discountPercent ? `<small class="receipt-discount">${line.discountPercent}% bargain discount (−${money(line.discountAmount)})</small>` : ""}</span><span>${money(line.total ?? line.price * line.quantity)}</span></div>`).join("")}</div>
      <div class="receipt-breakdown"><div class="receipt-line"><span>Subtotal</span><span>${money(sale.subtotal ?? sale.total)}</span></div><div class="receipt-line"><span>Discount</span><span>− ${money(sale.discount || 0)}</span></div><div class="receipt-line"><span>Tax ${sale.taxApplied ? "(8%)" : "(not applied)"}</span><span>${money(sale.tax || 0)}</span></div></div>
      <div class="receipt-total"><span>Total paid · ${escapeHtml(sale.method)}</span><span>${money(sale.total)}</span></div>
      <div class="receipt-thanks">We hope to see you again soon!</div></div>
      <div class="modal-actions"><button class="secondary-button" id="close-receipt">Close</button><button class="primary-button" id="print-receipt">Print receipt</button></div>`;
    receiptDialog.showModal();
    document.getElementById("close-receipt").addEventListener("click", () => receiptDialog.close());
    document.getElementById("print-receipt").addEventListener("click", () => window.print());
  }

  function openProductForm(id = "") {
    const existing = state.products.find((product) => product.id === id);
    const product = existing || { id: "", name: "", category: "Clothing", size: "", price: "", stock: "", icon: "👕", tone: "lavender" };
    const reservedQuantity = existing ? state.orders.filter((order) => order.status === "Pending")
      .flatMap((order) => order.lines)
      .filter((line) => line.productId === id)
      .reduce((sum, line) => sum + line.quantity, 0) : 0;
    productDialog.innerHTML = `<form id="product-form"><div class="modal-head"><h2>${existing ? "Edit product" : "Add a product"}</h2><button class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="modal-body"><div class="form-grid">
        <label class="field full">Product name<input name="name" required maxlength="70" value="${escapeHtml(product.name)}" placeholder="e.g. Cotton crew-neck tee" /></label>
        <label class="field">Category<select name="category"><option ${product.category === "Clothing" ? "selected" : ""}>Clothing</option><option ${product.category === "Shoes" ? "selected" : ""}>Shoes</option><option ${product.category === "Accessories" ? "selected" : ""}>Accessories</option></select></label>
        <label class="field">Size / range<input name="size" required maxlength="30" value="${escapeHtml(product.size)}" placeholder="e.g. S–XL or 38–44" /></label>
        <label class="field">Price (KSh)<input name="price" type="number" min="0.01" step="0.01" required value="${product.price}" /></label>
        <label class="field">Stock quantity${reservedQuantity ? ` (${reservedQuantity} reserved)` : ""}<input name="stock" type="number" min="${reservedQuantity}" step="1" required value="${product.stock}" /></label>
      </div></div><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-product">Cancel</button><button class="primary-button" type="submit">${existing ? "Save changes" : "Add product"}</button></div></form>`;
    productDialog.showModal();
    productDialog.querySelector(".modal-close").addEventListener("click", () => productDialog.close());
    document.getElementById("cancel-product").addEventListener("click", () => productDialog.close());
    document.getElementById("product-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      if (existing) {
        if (Number(data.get("stock")) < reservedQuantity) {
          showToast(`At least ${reservedQuantity} units are reserved for pending orders.`);
          return;
        }
        Object.assign(existing, { name: data.get("name").trim(), category: data.get("category"), size: data.get("size").trim(), price: Number(data.get("price")), stock: Number(data.get("stock")) });
      } else {
        const number = state.products.reduce((max, entry) => Math.max(max, Number(entry.id.replace(/\D/g, "")) || 1000), 1000) + 1;
        const category = data.get("category");
        const appearance = { Clothing: ["👕", "blue"], Shoes: ["👟", "sand"], Accessories: ["👜", "peach"] }[category];
        state.products.push({ id: `TS-${number}`, name: data.get("name").trim(), category, size: data.get("size").trim(), price: Number(data.get("price")), stock: Number(data.get("stock")), icon: appearance[0], tone: appearance[1] });
      }

      saveStore(); productDialog.close(); renderApp(); showToast(existing ? "Product updated." : "Product added to inventory.");
    });
  }

  function openUserForm(id = "") {
    const user = state.users.find((entry) => entry.id === id);
    const userDialog = document.getElementById("user-dialog");
    userDialog.innerHTML = `<form id="user-form"><div class="modal-head"><h2>${user ? "Edit staff profile" : "Add staff profile"}</h2><button class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="modal-body"><div class="form-grid">
        <label class="field full">Full name<input name="name" required maxlength="70" value="${escapeHtml(user?.name || "")}" placeholder="e.g. Jane Wanjiku" /></label>
        <label class="field">Username<input name="username" required maxlength="32" autocomplete="username" value="${escapeHtml(user?.username || "")}" placeholder="e.g. jane" /></label>
        <label class="field">Role<select name="role"><option ${user?.role === "Cashier" ? "selected" : ""}>Cashier</option><option ${user?.role === "Manager" ? "selected" : ""}>Manager</option><option ${user?.role === "Admin" ? "selected" : ""}>Admin</option></select></label>
        <label class="field full">${user ? "New password (leave blank to keep current)" : "Password"}<input name="password" type="password" minlength="8" autocomplete="new-password" ${user ? "" : "required"} placeholder="At least 8 characters" /></label>
      </div></div><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-user">Cancel</button><button class="primary-button" type="submit">${user ? "Save changes" : "Add user"}</button></div></form>`;
    userDialog.showModal();
    userDialog.querySelector(".modal-close").addEventListener("click", () => userDialog.close());
    document.getElementById("cancel-user").addEventListener("click", () => userDialog.close());
    document.getElementById("user-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name")).trim();
      const username = String(data.get("username")).trim();
      const password = String(data.get("password"));
      if (!name || !username) { showToast("Enter a name and username."); return; }
      if (state.users.some((entry) => entry.id !== id && entry.username.toLowerCase() === username.toLowerCase())) {
        showToast("That username is already in use.");
        return;
      }
      if (!user && password.length < 8) { showToast("Password must be at least 8 characters."); return; }
      if (user && password && password.length < 8) { showToast("Password must be at least 8 characters."); return; }
      const previous = user ? { ...user } : null;
      if (user) {
        user.name = name;
        user.username = username;
        user.role = data.get("role");
        if (password) user.password = password;
      } else {
        let id = `user-${Date.now()}`;
        while (state.users.some((entry) => entry.id === id)) id = `user-${Number(id.slice(5)) + 1}`;
        state.users.push({ id, name, username, password, role: data.get("role"), active: true });
      }
      if (user && previous.role === "Admin" && user.role !== "Admin" && state.users.filter((entry) => entry.active && entry.role === "Admin").length === 0) {
        Object.assign(user, previous);
        showToast("At least one active admin account is required.");
        return;
      }
      if (!saveStore()) {
        if (user) Object.assign(user, previous);
        else state.users.pop();
        return;
      }
      userDialog.close();
      renderApp();
      showToast(user ? "Staff profile updated." : "Staff profile added.");
    });
  }

  function toggleUser(id) {
    const user = state.users.find((entry) => entry.id === id);
    if (!user) return;
    if (user.id === signedInUser().id) { showToast("You cannot deactivate your own account."); return; }
    if (user.active && user.role === "Admin" && state.users.filter((entry) => entry.active && entry.role === "Admin").length <= 1) {
      showToast("At least one active admin account is required.");
      return;
    }
    user.active = !user.active;
    if (!saveStore()) user.active = !user.active;
    else { renderApp(); showToast(user.active ? "Account activated." : "Account deactivated."); }
  }

  function deleteUser(id) {
    const index = state.users.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const user = state.users[index];
    if (user.id === signedInUser().id) { showToast("You cannot delete your own account."); return; }
    if (user.active && user.role === "Admin" && state.users.filter((entry) => entry.active && entry.role === "Admin").length <= 1) {
      showToast("At least one active admin account is required.");
      return;
    }
    if (!window.confirm(`Delete the ${user.role.toLowerCase()} account for ${user.name}?`)) return;
    state.users.splice(index, 1);
    if (!saveStore()) state.users.splice(index, 0, user);
    else { renderApp(); showToast("Staff profile deleted."); }
  }

  function deleteProduct(id) {
    const product = state.products.find((entry) => entry.id === id);
    if (!product) return;
    const reservedQuantity = state.orders.filter((order) => order.status === "Pending")
      .flatMap((order) => order.lines)
      .filter((line) => line.productId === id)
      .reduce((sum, line) => sum + line.quantity, 0);
    if (reservedQuantity) { showToast(`Cannot remove ${product.name}; ${reservedQuantity} unit${reservedQuantity === 1 ? " is" : "s are"} reserved for pending orders.`); return; }
    if (!product || !window.confirm(`Remove "${product.name}" from your inventory?`)) return;
    state.products = state.products.filter((entry) => entry.id !== id);
    state.cart = state.cart.filter((entry) => entry.id !== id);
    saveStore(); renderApp(); showToast("Product removed.");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let afterQuote = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
          afterQuote = true;
        } else {
          field += character;
        }
      } else if (afterQuote) {
        if (character === ",") {
          row.push(field);
          field = "";
          afterQuote = false;
        } else if (character === "\n" || character === "\r") {
          row.push(field);
          if (row.some((cell) => cell.trim())) rows.push(row);
          row = [];
          field = "";
          afterQuote = false;
          if (character === "\r" && text[index + 1] === "\n") index += 1;
        } else if (character !== " " && character !== "\t") {
          throw new Error("CSV contains unexpected text after a quoted field.");
        }
      } else if (character === '"') {
        if (field.length) throw new Error("CSV contains a quote in an unquoted field.");
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        field = "";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else {
        field += character;
      }
    }
    if (quoted) throw new Error("CSV has an unclosed quoted field.");
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
    return rows;
  }

  function importProducts(csvText) {
    let rows;
    try {
      rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
    } catch (error) {
      return { errors: [error.message] };
    }
    if (!rows.length) return { errors: ["The CSV file is empty. Download the template and add product rows."] };
    const expectedHeaders = productTemplateHeaders.map((header) => header.toLowerCase());
    const actualHeaders = rows[0].map((header) => header.trim().toLowerCase());
    if (actualHeaders.length !== expectedHeaders.length || expectedHeaders.some((header, index) => actualHeaders[index] !== header)) {
      return { errors: [`The header row must match the template exactly: ${productTemplateHeaders.join(", ")}.`] };
    }
    if (rows.length === 1) return { errors: ["The template has no product rows yet. Add at least one product before uploading."] };
    if (rows.length - 1 > 5000) return { errors: ["A single upload can contain at most 5,000 products."] };

    const categories = new Map(["Clothing", "Shoes", "Accessories"].map((category) => [category.toLowerCase(), category]));
    const knownSkus = new Set(state.products.map((product) => product.id.trim().toLowerCase()));
    const importedSkus = new Set();
    const additions = [];
    const errors = [];
    rows.slice(1).forEach((cells, index) => {
      const rowNumber = index + 2;
      if (cells.length !== productTemplateHeaders.length) {
        errors.push(`Row ${rowNumber}: expected ${productTemplateHeaders.length} columns, found ${cells.length}.`);
        return;
      }
      const [rawSku, rawName, rawCategory, rawSize, rawPrice, rawStock] = cells.map((cell) => cell.trim());
      const sku = rawSku;
      const normalizedSku = sku.toLowerCase();
      const category = categories.get(rawCategory.toLowerCase());
      const price = Number(rawPrice);
      const stock = Number(rawStock);
      const rowErrors = [];
      if (!sku || sku.length > 40) rowErrors.push("SKU is required and must be 40 characters or fewer");
      else if (knownSkus.has(normalizedSku) || importedSkus.has(normalizedSku)) rowErrors.push(`SKU "${sku}" already exists or is duplicated in this file`);
      if (!rawName || rawName.length > 70) rowErrors.push("Product Name is required and must be 70 characters or fewer");
      if (!category) rowErrors.push("Category must be Clothing, Shoes, or Accessories");
      if (!rawSize || rawSize.length > 30) rowErrors.push("Size is required and must be 30 characters or fewer");
      if (!rawPrice || !Number.isFinite(price) || price <= 0) rowErrors.push("Price (KES) must be a number greater than zero");
      if (!rawStock || !Number.isSafeInteger(stock) || stock < 0) rowErrors.push("Stock must be a whole number zero or greater");
      if (rowErrors.length) {
        errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}.`);
        return;
      }
      importedSkus.add(normalizedSku);
      const appearance = { Clothing: ["👕", "blue"], Shoes: ["👟", "sand"], Accessories: ["👜", "peach"] }[category];
      additions.push({ id: sku, name: rawName, category, size: rawSize, price, stock, icon: appearance[0], tone: appearance[1] });
    });

    if (errors.length) return { errors };
    const previousProducts = state.products;
    state.products = [...state.products, ...additions];
    if (!saveStore()) {
      state.products = previousProducts;
      return { errors: ["The imported products could not be saved in this browser. Free up local storage and try again."] };
    }
    return { imported: additions.length };
  }

  function openImportDialog() {
    productDialog.innerHTML = `<form id="import-form"><div class="modal-head"><h2>Upload products</h2><button class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="modal-body"><p class="import-help">Choose a completed CSV template. Categories must be Clothing, Shoes, or Accessories; prices are in Kenyan shillings. Every row is checked before anything is added. Existing or duplicate SKUs will be rejected, and an invalid file will not be partially imported.</p>
        <label class="field">Product CSV file<input id="import-file" type="file" accept=".csv,text/csv" required /></label>
        <div class="import-result" id="import-result" role="alert" aria-live="polite"></div></div>
      <div class="modal-actions"><button class="secondary-button" type="button" id="cancel-import">Cancel</button><button class="primary-button" type="submit">Import products</button></div></form>`;
    productDialog.showModal();
    productDialog.querySelector(".modal-close").addEventListener("click", () => productDialog.close());
    document.getElementById("cancel-import").addEventListener("click", () => productDialog.close());
    document.getElementById("import-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = document.getElementById("import-file").files[0];
      const result = document.getElementById("import-result");
      if (!file) { result.textContent = "Choose a CSV file to continue."; return; }
      if (!file.name.toLowerCase().endsWith(".csv")) { result.textContent = "Please select a .csv file."; return; }
      if (file.size > 5 * 1024 * 1024) { result.textContent = "The file is larger than 5 MB. Split it into smaller CSV files and try again."; return; }
      try {
        const outcome = importProducts(await file.text());
        if (outcome.errors) {
          result.innerHTML = `<strong>${outcome.errors.length} issue${outcome.errors.length === 1 ? "" : "s"} found — no products were imported.</strong><ul class="import-errors">${outcome.errors.slice(0, 12).map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>${outcome.errors.length > 12 ? `<span>and ${outcome.errors.length - 12} more issue(s).</span>` : ""}`;
          return;
        }
        productDialog.close();
        renderApp();
        showToast(`${outcome.imported} product${outcome.imported === 1 ? "" : "s"} imported successfully.`);
      } catch (error) {
        result.textContent = `Could not read the selected file: ${error.message}`;
      }
    });
  }

  function downloadCsv(filename, headers, rows) {
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (sessionStorage.getItem(SESSION_KEY)) renderApp();
  else renderLogin();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("The offline app service worker could not be registered.", error);
    });
  }
  initializeBackupScheduler();
})();
