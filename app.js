const $ = (s) => document.querySelector(s);

const els = {
  btnOpenFolder: $("#btnOpenFolder"),
  folderStatus: $("#folderStatus"),

  btnLoad: $("#btnLoad"),
  btnSave: $("#btnSave"),
  fileNote: $("#fileNote"),
  filePicker: $("#filePicker"),

  search: $("#search"),
  btnAddProduct: $("#btnAddProduct"),
  btnAddCategory: $("#btnAddCategory"),
  btnShipments: $("#btnShipments"),
  btnExportExcel: $("#btnExportExcel"),

  catSearch: $("#catSearch"),
  categoryList: $("#categoryList"),
  filterLine: $("#filterLine"),
  productGrid: $("#productGrid"),
  empty: $("#empty"),

  catDlg: $("#catDlg"),
  catForm: $("#catForm"),
  catTitle: $("#catTitle"),
  catName: $("#catName"),

  prodDlg: $("#prodDlg"),
  prodForm: $("#prodForm"),
  prodTitle: $("#prodTitle"),
  prodName: $("#prodName"),
  prodCtSize: $("#prodCtSize"),
  prodCustomsCode: $("#prodCustomsCode"),
  prodUnitWeightKg: $("#prodUnitWeightKg"),
  prodCategory: $("#prodCategory"),
  prodCategoriesBox: $("#prodCategoriesBox"),
  prodWordings: $("#prodWordings"),
  prodCodes: $("#prodCodes"),
  prodNotes: $("#prodNotes"),
  prodImageFileName: $("#prodImageFileName"),
  imgPreview: $("#imgPreview"),
  btnPickImage: $("#btnPickImage"),
  btnClearImage: $("#btnClearImage"),
  imgFilePicker: $("#imgFilePicker"),
  imgHint: $("#imgHint"),

  stockDlg: $("#stockDlg"),
  stockHeader: $("#stockHeader"),
  lotList: $("#lotList"),
  stockExpiry: $("#stockExpiry"),
stockUnknownExpiry: $("#stockUnknownExpiry"),
  stockQty: $("#stockQty"),
  btnStockAdd: $("#btnStockAdd"),
  btnStockWithdraw: $("#btnStockWithdraw"),
  btnStockOrder: $("#btnStockOrder"),
  stockMsg: $("#stockMsg"),

  infoDlg: $("#infoDlg"),
  infoTitle: $("#infoTitle"),
  infoSub: $("#infoSub"),
  infoWordings: $("#infoWordings"),
  infoCodes: $("#infoCodes"),
  infoLots: $("#infoLots"),
  
  btnCatCancel: $("#btnCatCancel"),
  btnProdCancel: $("#btnProdCancel"), 
  btnProdDuplicate: $("#btnProdDuplicate"),

  shipDlg: $("#shipDlg"),
  shipForm: $("#shipForm"),
  shipTitle: $("#shipTitle"),
  shipProductName: $("#shipProductName"),
  shipDate: $("#shipDate"),
  shipQty: $("#shipQty"),
  shipDestination: $("#shipDestination"),
  shipRecipient: $("#shipRecipient"),
  shipReference: $("#shipReference"),
  shipNotes: $("#shipNotes"),
  shipAvailableNote: $("#shipAvailableNote"),
  btnShipCancel: $("#btnShipCancel"),
  shipHistDlg: $("#shipHistDlg"),
  shipHistBody: $("#shipHistBody"),
  shipHistSearch: $("#shipHistSearch"),
  shipHistCount: $("#shipHistCount"),
  btnShipHistClose: $("#btnShipHistClose"),
  btnShipExport: $("#btnShipExport"),

  cardTpl: $("#cardTpl"),
};

Object.assign(els, {
  shipmentCartPanel: $("#shipmentCartPanel"),
  shipmentCartList: $("#shipmentCartList"),
  shipmentCartSummary: $("#shipmentCartSummary"),
  btnClearCart: $("#btnClearCart"),
  cartShipDate: $("#cartShipDate"),
  cartDestination: $("#cartDestination"),
  cartRecipient: $("#cartRecipient"),
  cartReference: $("#cartReference"),
  cartNotes: $("#cartNotes"),
  cartExtraUE: $("#cartExtraUE"),
  btnCreateShipment: $("#btnCreateShipment"),
  btnCartPdf: $("#btnCartPdf"),
  btnCartExcel: $("#btnCartExcel"),
  btnCartDhl: $("#btnCartDhl"),
});


// Stock unit selector (Units vs CTs)
const stockUnitSelector = document.getElementById("stockUnitSelector");
if (stockUnitSelector && !stockUnitSelector.options.length) {
  stockUnitSelector.innerHTML = `
    <option value="units">Units</option>
    <option value="ct">Cartons (CT)</option>
  `;
}


/* -------------------- Supabase + Portal Auth (username/password) -------------------- */
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const SUPABASE_FN_NAME = window.SUPABASE_FN_NAME || "hyper-worker";
const CATALOGUE_ROW_ID = "main";

let supabaseClient = null;

const PORTAL_SESSION_KEY = "portal_session_v1";
let portalSession = null; // { token, role, username, exp }

function loadPortalSession() {
  try {
    const raw = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token) return null;
    if (s.exp && Date.now() > (s.exp * 1000)) {
      localStorage.removeItem(PORTAL_SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}
function savePortalSession(s) {
  portalSession = s;
  localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(s));
  refreshAuthUI();
}
function clearPortalSession() {
  portalSession = null;
  localStorage.removeItem(PORTAL_SESSION_KEY);
  refreshAuthUI();
}
function isAdmin() { return portalSession?.role === "admin"; }

function refreshAuthUI() {
  const st = document.getElementById("authStatus");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const u = document.getElementById("authUser");
  const p = document.getElementById("authPass");

  if (portalSession?.token) {
    if (st) st.textContent = `Logged as ${portalSession.username} (${portalSession.role})`;
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "";
    if (u) u.style.display = "none";
    if (p) p.style.display = "none";
  } else {
    if (st) st.textContent = "Viewer mode";
    if (btnLogin) btnLogin.style.display = "";
    if (btnLogout) btnLogout.style.display = "none";
    if (u) u.style.display = "";
    if (p) p.style.display = "";
  }

  const editable = isAdmin();
  if (els?.btnSave) {
    els.btnSave.disabled = !editable;
    els.btnSave.title = editable ? "" : "Login as admin to save changes";
  }
  if (els?.btnAddProduct) els.btnAddProduct.style.display = editable ? "" : "none";
  if (els?.btnAddCategory) els.btnAddCategory.style.display = editable ? "" : "none";
  if (els?.btnShipments) els.btnShipments.disabled = !state;
  if (els?.btnExportExcel) els.btnExportExcel.disabled = !state;
}

async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || String(SUPABASE_URL).includes("PASTE_")) {
    console.warn("Supabase not configured yet.");
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function loadCatalogueOnline() {
  if (!supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from("catalogue")
    .select("data, updated_at")
    .eq("id", CATALOGUE_ROW_ID)
    .single();

  if (error) {
    console.warn("Supabase load failed:", error.message);
    return false;
  }

  const obj = data?.data || {};
  validateAndNormalize(obj);
  state = obj;
  loadedFileName = "online:supabase/catalogue/main";
  setEnabled(true);
  setDirty(false);
  render();
  return true;
}

async function portalLogin(username, password) {
  if (!supabaseClient) {
    alert("Supabase not configured (URL/ANON key missing).");
    return;
  }
  const adminEmail = window.ADMIN_EMAIL || `${username}@campionature.local`;
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: adminEmail,
    password
  });
  if (error) { alert("Login failed: " + error.message); return; }
  const session = data?.session;
  if (!session?.access_token) { alert("Login failed"); return; }
  savePortalSession({
    token: session.access_token,
    role: "admin",
    username,
    exp: Math.floor(new Date(session.expires_at || 0).getTime() / 1000) || Math.floor(Date.now()/1000)+3600
  });
}

async function portalSaveCatalogue() {
  if (!isAdmin()) { alert("Admin login required to save."); return; }
  if (!supabaseClient) { alert("Supabase not configured yet."); return; }
  const { error } = await supabaseClient
    .from("catalogue")
    .upsert({ id: CATALOGUE_ROW_ID, data: state, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) { alert("Save failed: " + error.message); return; }
  setDirty(false);
  alert("Saved online ✅");
}
/* ------------------------------------------------------------------------------- */

let state = null;
let loadedFileName = "";

let shipmentCart = [];

let ui = {
  selectedCategoryId: "__all__",
  search: "",
  catSearch: "",
  editingCategoryId: null,
  editingProductId: null,
  stockProductId: null,
};

const fs = {
  folderHandle: null,
  jsonFileName: "catalogue.json",
};

// Autosave debounce (folder mode only)
let autosaveTimer = null;
let autosaveInFlight = false;
let autosaveQueued = false;

function requestAutosave() {
  if (!fs.folderHandle) return;
  if (!state) return;

  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    doAutosave();
  }, 600);
}

async function doAutosave() {
  if (!fs.folderHandle || !state) return;

  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }
  autosaveInFlight = true;
  autosaveQueued = false;

  try {
    await saveJsonToFolder();
    setDirty(false);
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saved)";
  } catch (e) {
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (save failed)";
    console.error(e);
  } finally {
    autosaveInFlight = false;
    if (autosaveQueued) {
      autosaveQueued = false;
      doAutosave();
    }
  }
}

function wire() {
	  // Auth buttons
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const authUser = document.getElementById("authUser");
  const authPass = document.getElementById("authPass");

  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      const username = (authUser?.value || "omaggi").trim();
      const password = (authPass?.value || "").trim();

      if (!password) {
        alert("Inserisci la password");
        return;
      }

      await portalLogin(username, password);
      refreshAuthUI();
      render();
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        if (window.sb?.auth) await window.sb.auth.signOut();
      } catch (e) {
        console.warn(e);
      }
      clearPortalSession();
      refreshAuthUI();
      render();
    });
  }

  if (authPass) {
    authPass.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnLogin?.click();
      }
    });
  }
  // Folder mode
  if (els.btnOpenFolder) {
    els.btnOpenFolder.addEventListener("click", openCatalogueFolder);
  }

els.stockUnknownExpiry.addEventListener("change", () => {
  if (els.stockUnknownExpiry.checked) {
    els.stockExpiry.value = "";
    els.stockExpiry.disabled = true;
  } else {
    els.stockExpiry.disabled = false;
  }
});

  // Manual load
  els.btnLoad.addEventListener("click", () => els.filePicker.click());
  els.filePicker.addEventListener("change", loadJsonFromPicker);
  
  // Dialog cancel buttons
  els.btnCatCancel.addEventListener("click", () => {
    ui.editingCategoryId = null;
    els.catDlg.close();
  });

  els.btnProdCancel.addEventListener("click", () => {
    ui.editingProductId = null;
    els.prodDlg.close();
  });

  // Save button
  els.btnSave.addEventListener("click", async () => {
    if (supabaseClient) { await portalSaveCatalogue(); return; }

    if (!state) return;

    if (fs.folderHandle) {
      await saveJsonToFolder();
      setDirty(false);
      if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saved)";
      alert("Saved to data/catalogue.json");
    } else {
      downloadJSON(state, "catalogue.json");
    }
  });

  // Search
  els.search.addEventListener("input", () => {
    ui.search = els.search.value.trim();
    render();
  });

  els.btnAddCategory.addEventListener("click", () => openCategoryDlg(null));
  els.btnAddProduct.addEventListener("click", () => openProductDlg(null));
  
  els.catSearch.addEventListener("input", () => {
    ui.catSearch = els.catSearch.value.toLowerCase();
    renderCategories(); // Re-render the list as you type
  });

  // Category submit
  els.catForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (els.catName.value || "").trim();
  if (!name) return;

  if (ui.editingCategoryId) {
    const c = state.categories.find(x => x.id === ui.editingCategoryId);
    if (!c) return;
    c.name = name;
  } else {
    state.categories.push({ id: uid("cat"), name });
  }

  ui.editingCategoryId = null;
  els.catDlg.close();
  setDirty(true);
  render();
});

  // Product submit
  els.prodForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (els.prodName.value || "").trim();
  if (!name) return;

  const ctSize = parseInt($("#prodCtSize").value) || null;
  const customsCode = (els.prodCustomsCode?.value || "").trim();
  const unitWeightKg = Number(els.prodUnitWeightKg?.value || 0) || null;
  const selectedCategoryIds = Array
    .from(els.prodCategoriesBox.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value);
  const wordings = splitLines(els.prodWordings.value);
  const codes = splitLines(els.prodCodes.value);
  const notes = (els.prodNotes.value || "").trim();
  const imageFileName = (els.prodImageFileName.value || "").trim();

  if (ui.editingProductId) {
    const p = state.products.find(x => x.id === ui.editingProductId);
    if (!p) return;
    p.name = name;
    p.ctSize = ctSize;
    p.customsCode = customsCode;
    p.unitWeightKg = unitWeightKg;
    p.categoryIds = selectedCategoryIds;
    delete p.categoryId;
    p.wordings = wordings;
    p.codes = codes;
    p.notes = notes;
    p.imageFileName = imageFileName;
    p.lots = normalizeLots(p.lots);
  } else {
    state.products.push({
      id: uid("prod"),
      name,
      ctSize,
      customsCode,
      unitWeightKg,
      categoryIds: selectedCategoryIds,
      wordings,
      codes,
      notes,
      imageFileName,
      lots: [],
    });
  }

  ui.editingProductId = null;
  els.prodDlg.close();
  setDirty(true);
  render();
});

  els.btnProdDuplicate.addEventListener("click", () => {
    duplicateProductFromDialog();
  });

  // Stock controls
  els.btnStockAdd.addEventListener("click", () => adjustStock(+1));
  els.btnStockWithdraw.addEventListener("click", () => adjustStock(-1));
  els.btnStockOrder.addEventListener("click", () => createOrder());
  attachDMYMask(els.stockExpiry);

  // Shipment cart
  if (els.cartShipDate) {
    els.cartShipDate.value = formatDateDMY(todayISO());
    attachDMYMask(els.cartShipDate);
  }
  els.btnClearCart?.addEventListener("click", clearShipmentCart);
  els.btnCreateShipment?.addEventListener("click", createShipmentFromCart);
  els.btnCartPdf?.addEventListener("click", () => exportShipmentDraftPDF(buildShipmentDraftFromCart(false)));
  els.btnCartExcel?.addEventListener("click", () => exportShipmentDraftExcel(buildShipmentDraftFromCart(false)));
  els.btnCartDhl?.addEventListener("click", () => exportDHLList(buildShipmentDraftFromCart(false)));

  // Image picker controls
  els.btnPickImage.addEventListener("click", () => els.imgFilePicker.click());
  els.btnClearImage.addEventListener("click", () => {
    els.prodImageFileName.value = "";
    els.imgHint.textContent = "Image cleared.";
    renderProductPreview(null);
    setDirty(true);
  });

  els.imgFilePicker.addEventListener("change", async () => {
    const file = els.imgFilePicker.files && els.imgFilePicker.files[0];
    els.imgFilePicker.value = "";
    if (!file) return;

    try {
      if (fs.folderHandle) {
        const storedName = await copyPickedImageToMedia(file);
        els.prodImageFileName.value = storedName;
        els.imgHint.textContent = `Copied to media/${storedName}`;
      } else {
        els.prodImageFileName.value = file.name;
        els.imgHint.textContent = `Now copy that file into media/ as: ${file.name}`;
      }
      renderProductPreview({ imageFileName: els.prodImageFileName.value });
      setDirty(true);
    } catch (e) {
      alert("Could not set image: " + (e?.message || e));
    }
  });

  if (els.btnShipments) els.btnShipments.addEventListener("click", openShipmentHistoryDlg);
  if (els.btnExportExcel) els.btnExportExcel.addEventListener("click", exportCatalogueExcel);
  if (els.btnShipExport) els.btnShipExport.addEventListener("click", exportCatalogueExcel);
  if (els.btnShipCancel) els.btnShipCancel.addEventListener("click", () => els.shipDlg.close());
  if (els.btnShipHistClose) els.btnShipHistClose.addEventListener("click", () => els.shipHistDlg.close());
  if (els.shipHistSearch) els.shipHistSearch.addEventListener("input", renderShipmentHistory);
  if (els.shipForm) els.shipForm.addEventListener("submit", onShipSubmit);
  if (els.shipDate) attachDMYMask(els.shipDate);

  // locked until loaded
  setEnabled(false);
  els.filterLine.textContent = "Tip: Chrome/Edge: use “Use catalogue folder…” for auto-load & auto-save. Firefox: use “Load JSON”.";

  if (els.folderStatus) {
    els.folderStatus.textContent = window.showDirectoryPicker
      ? "Folder mode: OFF"
      : "Folder mode: Not supported (use Chrome/Edge)";
  }
}

/* Folder mode (Chrome/Edge) */
async function openCatalogueFolder() {
  if (!window.showDirectoryPicker) {
    alert("Folder mode is not supported in this browser. Use Chrome or Edge.");
    return;
  }
  try {
    const dir = await window.showDirectoryPicker({
      id: "catalogueFolder",
      mode: "readwrite",
      startIn: "documents",
    });

    fs.folderHandle = dir;
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (loading…)";

    await loadJsonFromFolder();

    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (ready)";
  } catch {
    // cancelled
  }
}

async function loadJsonFromFolder() {
  if (!fs.folderHandle) return;

  const dataDir = await fs.folderHandle.getDirectoryHandle("data", { create: false });
  const fileHandle = await dataDir.getFileHandle(fs.jsonFileName, { create: false });
  const file = await fileHandle.getFile();
  const text = await file.text();
  const obj = JSON.parse(text);

  validateAndNormalize(obj);

  state = obj;
  loadedFileName = "data/catalogue.json (folder mode)";
  ui.selectedCategoryId = "__all__";
  ui.search = "";
  els.search.value = "";

  setEnabled(true);
  setDirty(false);
  render();

  els.fileNote.textContent = "Using folder: data/catalogue.json";
}

async function saveJsonToFolder() {
  if (!fs.folderHandle || !state) return;

  const dataDir = await fs.folderHandle.getDirectoryHandle("data", { create: true });
  const fileHandle = await dataDir.getFileHandle(fs.jsonFileName, { create: true });
  const writable = await fileHandle.createWritable();

  const clean = JSON.parse(JSON.stringify(state));
  delete clean._dirty;

  await writable.write(JSON.stringify(clean, null, 2));
  await writable.close();
}

/* Load JSON manually */
async function loadJsonFromPicker() {
  const file = els.filePicker.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    validateAndNormalize(obj);

    state = obj;
    loadedFileName = file.name;
    ui.selectedCategoryId = "__all__";
    ui.search = "";
    els.search.value = "";

    setEnabled(true);
    setDirty(false);
    render();
  } catch (e) {
    alert("Failed to load JSON: " + (e?.message || "Unknown error"));
  } finally {
    els.filePicker.value = "";
  }
}

/* State + UI */
function setEnabled(on) {
  els.btnSave.disabled = !on;
  els.search.disabled = !on;
  els.btnAddCategory.disabled = !on;
  els.btnAddProduct.disabled = !on;
  if (els.btnShipments) els.btnShipments.disabled = !on;
  if (els.btnExportExcel) els.btnExportExcel.disabled = !on;
}

function setDirty(isDirty) {
  if (!state) return;
  state._dirty = !!isDirty;

  els.fileNote.textContent =
    (loadedFileName ? `Loaded: ${loadedFileName}` : "Loaded.")
    + (isDirty ? "  •  Unsaved changes" : "");

  // autosave in folder mode
  if (isDirty && fs.folderHandle) {
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saving…)";
    requestAutosave();
  }
}

function validateAndNormalize(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Invalid JSON format");

  obj.version = 1;
  obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
  obj.products  = Array.isArray(obj.products)  ? obj.products  : [];
  obj.shipments = Array.isArray(obj.shipments) ? obj.shipments : [];

  for (const c of obj.categories) {
    if (!c.id) c.id = uid("cat");
    if (!c.name) c.name = "Unnamed";
  }

  obj.shipments = normalizeShipmentRecords(obj.shipments);

  for (const p of obj.products) {
    if (!p.id) p.id = uid("prod");
    if (!p.name) p.name = "Unnamed product";

    // categories (multi)
    if (Array.isArray(p.categoryIds)) {
      p.categoryIds = p.categoryIds.filter(Boolean);
    } else if (typeof p.categoryId === "string" && p.categoryId.trim()) {
      p.categoryIds = [p.categoryId.trim()];
    } else {
      p.categoryIds = [];
    }
    delete p.categoryId;

    // misc fields
    p.wordings = Array.isArray(p.wordings) ? p.wordings : [];
    p.codes    = Array.isArray(p.codes)    ? p.codes    : [];
    p.notes = p.notes || "";
    p.customsCode = p.customsCode || inferCustomsCodeForProduct(p, obj.categories);
    p.unitWeightKg = Number(p.unitWeightKg || 0) || "";
    p.imageFileName = p.imageFileName || "";

    // CT size normalization
    p.ctSize = (p.ctSize !== undefined && p.ctSize !== null && p.ctSize > 0) ? Number(p.ctSize) : null;

    // Lots normalization (ordered-aware; see Fix 4)
    p.lots = normalizeLots(Array.isArray(p.lots) ? p.lots : []);
  }
}

function render() {
  renderCategories();
  renderFilterLine();
  renderProducts();
  renderShipmentCart();
}

function renderCategories() {
  els.categoryList.innerHTML = "";

  // 1. System filters (Always shown)
  const specials = [
    { id: "__all__", name: "All products" },
    { id: "__in__", name: "✅ In stock (Usable)" },
    { id: "__low__", name: "⚠ Low stock (<10)" },
    { id: "__out__", name: "❌ Out of stock (0)" },
    { id: "__exp__", name: "⏳ Expiring / Expired" }
  ];

  for (const s of specials) {
    els.categoryList.appendChild(catRow(s, true));
  }

  // 2. Filter user categories
  const cats = (state.categories || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(c => c.name.toLowerCase().includes(ui.catSearch));

  // --- POINT 3 START ---
  // Only add the line if we aren't searching OR if there are matching categories
  if (cats.length > 0) {
    const hr = document.createElement("div");
    hr.className = "catSeparator";
    els.categoryList.appendChild(hr);
  }
  // --- POINT 3 END ---

  // 3. Render the categories
  for (const c of cats) {
    els.categoryList.appendChild(catRow(c, false));
  }
  
  if (ui.catSearch && cats.length === 0) {
    const note = document.createElement("div");
    note.className = "smallNote";
    note.style.textAlign = "center";
    note.textContent = "No matches found";
    els.categoryList.appendChild(note);
  }
}

function catRow(cat, pseudo) {
  const row = document.createElement("div");
  row.className = "cat" + (ui.selectedCategoryId === cat.id ? " active" : "");

  const name = document.createElement("div");
  name.className = "catName";
  name.textContent = cat.name;

  const btns = document.createElement("div");
  btns.className = "catBtns";

  if (!pseudo) {
    const edit = document.createElement("button");
    edit.className = "btn small ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      openCategoryDlg(cat.id);
    });

    const del = document.createElement("button");
    del.className = "btn small ghost danger";
    del.textContent = "Del";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCategory(cat.id);
    });

    btns.append(edit, del);
  }

  row.append(name, btns);
  row.addEventListener("click", () => {
    ui.selectedCategoryId = cat.id;
    render();
  });

  return row;
}

function renderFilterLine() {
  let label = "";
  if (ui.selectedCategoryId === "__all__") label = "All products";
  else if (ui.selectedCategoryId === "__in__") label = "In stock (Usable)";
  else if (ui.selectedCategoryId === "__low__") label = "Low stock (1-10)";
  else if (ui.selectedCategoryId === "__out__") label = "Out of stock";
  else if (ui.selectedCategoryId === "__exp__") label = "Expiring / Expired";
  else label = state.categories.find(c => c.id === ui.selectedCategoryId)?.name || "Uncategorized";

  els.filterLine.textContent =
    `Filter: ${label}` + (ui.search ? `  •  Search: "${ui.search}"` : "");
}

function renderProducts() {
  const list = filteredProducts();
  els.productGrid.innerHTML = "";
  els.empty.hidden = list.length !== 0;

  for (const p of list) els.productGrid.appendChild(productCard(p));
}

function filteredProducts() {
  const q = ui.search.toLowerCase();

  return state.products
    .filter(p => {
      if (ui.selectedCategoryId === "__all__") return true;

      const t = totalStock(p);
      
      if (ui.selectedCategoryId === "__in__") {
        const total = totalStock(p);
        if (total <= 0) return false;

        // Check if there are any valid lots (not expired and not expiring)
        const validLots = normalizeLots(p.lots).filter(l => {
          if (l.qty <= 0) return false;
          const s = lotStatus(l.expiry);
          return s !== "expired" && s !== "expiring";
        });

        return validLots.length > 0;
      }

      if (ui.selectedCategoryId === "__low__") {
        return t > 0 && t < 10; // strictly between 1 and 9
      }

      if (ui.selectedCategoryId === "__out__") {
        return t === 0; // strictly 0
      }

      if (ui.selectedCategoryId === "__exp__") {
        const lots = normalizeLots(p.lots).filter(l => l.qty > 0);
        return lots.some(l => {
          const s = lotStatus(l.expiry);
          return s === "expiring" || s === "expired" || s === "risky";
        });
      }

      if (state.categories.some(c => c.id === ui.selectedCategoryId)) {
        return (p.categoryIds || []).includes(ui.selectedCategoryId);
      }

      return true;
    })
    .filter(p => {
      if (!q) return true;
      const hay = [p.name, ...(p.wordings || []), ...(p.codes || [])].join(" ").toLowerCase();
      // return fuzzyMatch(q, hay);   // <‑‑ fuzzy search (disabilitata, riattivabile)
	return hay.includes(q);         // <‑‑ ricerca normale
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function productCard(p) {
  const node = els.cardTpl.content.cloneNode(true);
  const cardEl = node.querySelector(".card");

  const img = node.querySelector(".thumbImg");
  const empty = node.querySelector(".thumbEmpty");
  const imgPath = p.imageFileName ? `media/${p.imageFileName}` : "";

  if (imgPath) {
    img.src = imgPath;
    img.alt = p.name;
    img.style.display = "block";
    empty.style.display = "none";
    img.onerror = () => {
      img.style.display = "none";
      empty.style.display = "block";
      empty.textContent = "Image missing";
    };
  } else {
    img.style.display = "none";
    empty.style.display = "block";
    empty.textContent = "No image";
  }

  node.querySelector(".pName").textContent = p.name;

  // ✅ show multiple categories
  const names = (p.categoryIds || [])
    .map(id => state.categories.find(c => c.id === id)?.name)
    .filter(Boolean);

  node.querySelector(".pCat").textContent = names.length ? names.join(", ") : "Uncategorized";

  // --- Stock line (safe, hoisted dotsContainer; no early dots) ---
const total = totalStock(p);
const stockLine = node.querySelector(".stockLine");
const stockTotalEl = node.querySelector(".stockTotal");

// Hoist so later code (card-coloring/dots rules) can reuse it safely
let dotsContainer = null;

if (stockTotalEl) {
  stockTotalEl.textContent = `Stock: ${total}`;

  // Create the (empty) dot container, but DO NOT populate it here.
  dotsContainer = document.createElement("div");
  dotsContainer.className = "statusDots";

  // Append dots right next to the stock text
  stockTotalEl.style.display = "flex";
  stockTotalEl.style.alignItems = "center";
  stockTotalEl.appendChild(dotsContainer);
}

  const ctContainer = node.querySelector("#ctPillContainer");
  if (ctContainer) {
    ctContainer.innerHTML = ""; // Clear previous pills
    // Only show pills if there is stock AND a valid CT size
    if (total > 0 && p.ctSize && p.ctSize > 0) {
      const cts = calculateCTs(p);
      if (cts.full > 0) ctContainer.appendChild(createCtPill(cts.full, "full"));
      if (cts.partial > 0) ctContainer.appendChild(createCtPill(cts.partial, "partial"));
    }
  }

  // --- Card coloring logic ---
cardEl.classList.remove(
  "cardLow",
  "cardExpiring",
  "cardExpired",
  "cardRisky",
  "cardOut",
  "cardOrdered"
);

const realLots = (p.lots || []).filter(l => !l.ordered && l.qty > 0);
const orderedLotsOnly = (p.lots || []).filter(l => l.ordered && l.qty > 0);
const statusesReal = realLots.map(l => lotStatus(l.expiry));
const totalReal = realLots.reduce((s, l) => s + l.qty, 0);
const totalOrdered = orderedLotsOnly.reduce((s, l) => s + l.qty, 0);

const hasOrdered = totalOrdered > 0;

// CASE 1: ONLY ordered lots → FULL GREEN CARD
if (hasOrdered && totalReal === 0) {
  cardEl.classList.add("cardOrdered");
}

// CASE 2: Real stock exists → evaluate like normal
else if (totalReal > 0) {
  const hasExpired = statusesReal.includes("expired");
  const hasExpiring = statusesReal.includes("expiring");
  const hasRisky = statusesReal.includes("risky");
  const hasOk = statusesReal.includes("ok");

  if (hasOk) {
    if (totalReal < 10) cardEl.classList.add("cardLow");
  } else {
    if (hasExpired) cardEl.classList.add("cardExpired");
    else if (hasExpiring) cardEl.classList.add("cardExpiring");
    else if (hasRisky) cardEl.classList.add("cardRisky");
    else if (totalReal < 10) cardEl.classList.add("cardLow");
  }
}

// CASE 3: No stock at all (rare now)
else {
  cardEl.classList.add("cardOut");
}

// --- Status dots ---
dotsContainer.innerHTML = "";

// Read back card state
const isOut       = cardEl.classList.contains("cardOut");
const isExpired   = cardEl.classList.contains("cardExpired");
const isExpiring  = cardEl.classList.contains("cardExpiring");
const isRiskyCard = cardEl.classList.contains("cardRisky");
const isOrderedOnly = cardEl.classList.contains("cardOrdered");

// Real-stock statuses again (already calculated)
const hasExpiredReal   = statusesReal.includes("expired");
const hasExpiringReal  = statusesReal.includes("expiring");
const hasRiskyReal     = statusesReal.includes("risky");
const hasOkReal        = statusesReal.includes("ok");

let showExpired = false;
let showExpiring = false;
let showRisky = false;
let showOrderedDot = false;

// Dots rules:
// ❌ Out / Expired / Expiring / Ordered-only → NO dots
if (!isOut && !isExpired && !isExpiring && !isOrderedOnly) {

  if (isRiskyCard) {
    // Risky card → ONLY expiring dot
    if (hasExpiringReal) showExpiring = true;
  } 
  else {
    // Neutral card → all dots from real-stock lots
    if (hasExpiredReal)  showExpired = true;
    if (hasExpiringReal) showExpiring = true;
    if (hasRiskyReal)    showRisky = true;
  }

  // Ordered dot → only when:
  // real stock > 0 AND ordered lots exist
  if (totalReal > 0 && hasOrdered) {
    showOrderedDot = true;
  }
}

// Render dots
if (showExpired) {
  const d = document.createElement("span");
  d.className = "dot expired";
  d.title = "Has expired lots";
  dotsContainer.appendChild(d);
}
if (showExpiring) {
  const d = document.createElement("span");
  d.className = "dot expiring";
  d.title = "Has expiring lots";
  dotsContainer.appendChild(d);
}
if (showRisky) {
  const d = document.createElement("span");
  d.className = "dot risky";
  d.title = "Has risky lots";
  dotsContainer.appendChild(d);
}
if (showOrderedDot) {
  const d = document.createElement("span");
  d.className = "dot ordered";
  d.title = "Ordered stock pending";
  dotsContainer.appendChild(d);
}

  node.querySelector('[data-act="info"]').addEventListener("click", () => openInfoDlg(p.id));
  node.querySelector('[data-act="stock"]').addEventListener("click", () => openStockDlg(p.id));
  node.querySelector('[data-act="ship"]').addEventListener("click", () => addProductToShipmentCart(p.id));
  node.querySelector('[data-act="edit"]').addEventListener("click", () => openProductDlg(p.id));
  if (!isAdmin()) {
    node.querySelector('[data-act="edit"]').style.display = "none";
    node.querySelector('[data-act="del"]').style.display = "none";
  }
  node.querySelector('[data-act="del"]').addEventListener("click", () => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    state.products = state.products.filter(x => x.id !== p.id);
    setDirty(true);
    render();
  });

  return node;
}

/* Dialogs */
function openCategoryDlg(id) {
  ui.editingCategoryId = id;

  if (id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    els.catTitle.textContent = "Edit category";
    els.catName.value = c.name;
  } else {
    els.catTitle.textContent = "Add category";
    els.catName.value = "";
  }

  els.catDlg.showModal();
  setTimeout(() => els.catName.focus(), 50);
}

function deleteCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;

  const used = state.products.some(p =>
    (p.categoryIds || []).includes(id)
  );

  const msg = used
    ? `Delete category "${c.name}"? Products in it will become Uncategorized.`
    : `Delete category "${c.name}"?`;

  if (!confirm(msg)) return;

  // Remove category from list
  state.categories = state.categories.filter(x => x.id !== id);

  // Remove category reference from all products
  for (const p of state.products) {
    p.categoryIds = (p.categoryIds || []).filter(cid => cid !== id);
  }

  // Reset filter if needed
  if (ui.selectedCategoryId === id) {
    ui.selectedCategoryId = "__all__";
  }

  setDirty(true);
  render();
}

function openProductDlg(id) {
  ui.editingProductId = id;

  // Build checkbox list
  els.prodCategoriesBox.innerHTML = "";
  const cats = state.categories.slice().sort((a,b)=>a.name.localeCompare(b.name));

  for (const c of cats) {
    const label = document.createElement("label");
    label.className = "checkItem";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c.id;

    const text = document.createElement("span");
    text.textContent = c.name;

    label.append(cb, text);
    els.prodCategoriesBox.appendChild(label);
  }

  if (id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    els.prodTitle.textContent = "Edit product";
    els.prodName.value = p.name;
    $("#prodCtSize").value = p.ctSize || "";
    if (els.prodCustomsCode) els.prodCustomsCode.value = p.customsCode || "";
    if (els.prodUnitWeightKg) els.prodUnitWeightKg.value = p.unitWeightKg || "";

    // Back-compat: support older single categoryId
    const selectedIds = Array.isArray(p.categoryIds)
      ? p.categoryIds
      : (p.categoryId ? [p.categoryId] : []);

    // check relevant boxes
    for (const cb of els.prodCategoriesBox.querySelectorAll('input[type="checkbox"]')) {
      cb.checked = selectedIds.includes(cb.value);
    }

    els.prodWordings.value = (p.wordings || []).join("\n");
    els.prodCodes.value = (p.codes || []).join("\n");
    els.prodNotes.value = p.notes || "";
    els.prodImageFileName.value = p.imageFileName || "";
    renderProductPreview(p);

  } else {
    els.prodTitle.textContent = "Add product";
    els.prodName.value = "";
    $("#prodCtSize").value = "";
    if (els.prodCustomsCode) els.prodCustomsCode.value = "";
    if (els.prodUnitWeightKg) els.prodUnitWeightKg.value = "";

    // optionally default-check current real category filter
    if (state.categories.some(c => c.id === ui.selectedCategoryId)) {
      const cb = els.prodCategoriesBox.querySelector(`input[value="${ui.selectedCategoryId}"]`);
      if (cb) cb.checked = true;
    }

    els.prodWordings.value = "";
    els.prodCodes.value = "";
    els.prodNotes.value = "";
    els.prodImageFileName.value = "";
    renderProductPreview(null);
  }

  els.prodDlg.showModal();
  setTimeout(() => els.prodName.focus(), 50);
}

function renderProductPreview(p) {
  els.imgPreview.innerHTML = "";
  const fileName = (p?.imageFileName || "").trim();

  if (!fileName) {
    els.imgPreview.textContent = "No image";
    return;
  }

  const img = document.createElement("img");
  img.src = `media/${fileName}`;
  img.alt = "Image";
  img.onerror = () => {
    els.imgPreview.textContent = "Image missing (check media/ + filename)";
  };

  els.imgPreview.appendChild(img);
}

function renderLotList(p) {
  const lotList = document.getElementById("lotList");
  lotList.innerHTML = "";

  const lots = (p.lots || []).slice();

  if (!lots.length) {
    lotList.innerHTML = `<div class="smallNote">No lots.</div>`;
    return;
  }

  for (const l of lots) {
    const row = document.createElement("div");
    row.className = "lotRow";

    const isOrdered = !!l.ordered;

    row.innerHTML = `
      <div class="lotMeta">
        <div class="lotExp">${formatDateDMY(l.expiry)}</div>
        <div class="lotQty">Qty: ${l.qty}</div>
      </div>
    `;

    const btns = document.createElement("div");

    // DELETE BUTTON
    const del = document.createElement("button");
    del.className = "btn small ghost danger";
    del.textContent = "Delete";

    del.onclick = (e) => {
      e.preventDefault();

      // Remove this lot
      p.lots = (p.lots || []).filter(x => x !== l);

      setDirty(true);
      render();            // refresh product cards
      renderLotList(p);    // refresh dialog
    };

    if (isOrdered) {
      // RECEIVED BUTTON
      const received = document.createElement("button");
      received.className = "btn small received";
      received.textContent = "Received";

      received.onclick = (e) => {
        e.preventDefault();

        // Remove the ordered lot
        p.lots = (p.lots || []).filter(x => x !== l);

        // Call the **exact same Add logic** as the Add button
        // Use product ID, expiry, and qty
        addLotViaUI(p.id, l.expiry, Number(l.qty));

        setDirty(true);
        render();            // refresh product cards
        renderLotList(p);    // refresh dialog
      };

      btns.append(received, del);
    } else {
      // NORMAL LOT: + - Delete
      const plus = document.createElement("button");
      plus.className = "btn small ghost";
      plus.textContent = "+";
      plus.onclick = (e) => {
        e.preventDefault();
        l.qty++;
        setDirty(true);
        render();
        renderLotList(p);
      };

      const minus = document.createElement("button");
      minus.className = "btn small ghost";
      minus.textContent = "-";
      minus.onclick = (e) => {
        e.preventDefault();
        if (l.qty > 1) l.qty--;
        setDirty(true);
        render();
        renderLotList(p);
      };

      btns.append(plus, minus, del);
    }

    row.appendChild(btns);
    lotList.appendChild(row);
  }
}

// helper to ensure all lots are created consistently
function createNormalLot(expiry, qty) {
  return { expiry, qty };
}

/* Stock */
function openStockDlg(productId) {
  ui.stockProductId = productId;

  const p = state.products.find((x) => x.id === productId);
  if (!p) return;

  els.stockMsg.textContent = "";
  els.stockExpiry.value = "";
  els.stockQty.value = "1";

  // Show CT option only if product has CT size
  if (p.ctSize && p.ctSize > 0) {
    $("#stockUnitSelector").style.display = "block";
  } else {
    $("#stockUnitSelector").value = "units";
    $("#stockUnitSelector").style.display = "none";
  }

  attachDMYMask(els.stockExpiry);

  // ✅ Update header / title if you have one
  if (els.stockTitle) {
    els.stockTitle.textContent = `Stock — ${p.name}`;
  }
  
  renderLots(p);

  els.stockDlg.showModal();
}

function renderLots(p) {
  els.lotList.innerHTML = "";

  const total = totalStock(p);
  let stockText = `${p.name} — Total: ${total}`;
  if (total > 0 && p.ctSize) {
    const cts = calculateCTs(p);
    stockText += ` (${cts.full} Full CT, ${cts.partial} Non-empty CT)`;
  }
  els.stockHeader.textContent = stockText;

  const lots = normalizeLots(p.lots).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const displayLots = lots.filter(l => l.qty > 0);

  if (displayLots.length === 0) {
    const d = document.createElement("div");
    d.className = "smallNote";
    d.textContent = "No stock yet. Add with an expiry date.";
    els.lotList.appendChild(d);
    return;
  }

  for (const l of displayLots) {
    const isOrdered = !!l.ordered;
    const st = lotStatus(l.expiry);

    const row = document.createElement("div");
    let rowClass = "lotRow";
    if (isOrdered) rowClass += " lotOrdered";
    if (!isOrdered) {
      if (st === "expired") rowClass += " lotExpired";
      else if (st === "expiring") rowClass += " lotExpiring";
      else if (st === "risky") rowClass += " lotRisky";
    }
    row.className = rowClass;

    // LEFT SIDE
    const meta = document.createElement("div");
    meta.className = "lotMeta";

    const main = document.createElement("div");
    main.className = "lotMain";

    const qtyLine = document.createElement("div");
    qtyLine.className = "lotQtyBig";
    qtyLine.textContent = `Qty: ${l.qty}`;
    if (p.ctSize) {
      const full = Math.floor(l.qty / p.ctSize);
      const rem = l.qty % p.ctSize;
      if (full > 0) qtyLine.appendChild(createCtPill(full, "full"));
      if (rem > 0) qtyLine.appendChild(createCtPill(1, "partial"));
    }

    const dateLine = document.createElement("div");
    dateLine.className = "lotDateSmall";
    dateLine.textContent = formatDateDMY(l.expiry);

    const tag = document.createElement("span");
    tag.className = "lotTag";
    tag.textContent = isOrdered ? "ORDERED" : st.toUpperCase();

    dateLine.appendChild(tag);
    main.append(qtyLine, dateLine);
    meta.appendChild(main);

    // BUTTONS
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "6px";

    // DEL BUTTON FIRST!
    const del = document.createElement("button");
    del.className = "btn small danger";
    del.textContent = "DEL";
    del.onclick = (e) => {
  e.preventDefault();

  const expiry = l.expiry;
  const isOrdered = !!l.ordered;

  p.lots = (p.lots || []).filter(x =>
    !(x.expiry === expiry && !!x.ordered === isOrdered)
  );

  setDirty(true);
  render();
  openStockDlg(p.id);
};

    if (isOrdered) {
  const received = document.createElement("button");
  received.className = "btn small received";
  received.textContent = "Received";
  received.onclick = (e) => {
    e.preventDefault();
    receiveOrderedLot(p, l);
  };
  btns.append(received, del);
} else {
      const plus = document.createElement("button");
      plus.className = "btn small";
      plus.textContent = "+";
      plus.onclick = (e) => {
        e.preventDefault();
        els.stockExpiry.value = formatDateDMY(l.expiry);
        els.stockQty.value = "1";
        adjustStock(+1);
      };

      const minus = document.createElement("button");
      minus.className = "btn small danger";
      minus.textContent = "-";
      minus.onclick = (e) => {
        e.preventDefault();
        els.stockExpiry.value = formatDateDMY(l.expiry);
        els.stockQty.value = "1";
        adjustStock(-1);
      };

      btns.append(plus, minus, del);
    }

    row.append(meta, btns);
    els.lotList.appendChild(row);
  }
}

function receiveOrderedLot(p, lot) {
  if (!p || !lot) return;

  const expiryISO = lot.expiry;
  const qty = Number(lot.qty || 0);

  // 1️⃣ Remove ordered lot
  p.lots = (p.lots || []).filter(l =>
    !(l.ordered && l.expiry === expiryISO)
  );

  // 2️⃣ Inject values into stock UI
  els.stockExpiry.value = formatDateDMY(expiryISO);
  els.stockQty.value = String(qty);

  // Force units mode (ordered lots already stored in units)
  const unitSel = $("#stockUnitSelector");
  if (unitSel) unitSel.value = "units";

  // 3️⃣ Use your existing stock logic
  const prevMode = unitSel?.value;
if (unitSel) unitSel.value = "units";

adjustStock(+1);

if (unitSel) unitSel.value = prevMode || "units";

  els.stockMsg.textContent =
    `Received ${qty} for ${formatDateDMY(expiryISO)}.`;
}

function adjustStock(dir) {
  const p = state.products.find(x => x.id === ui.stockProductId);
  if (!p) return;

  // --- Read expiry field with DMY mask already applied ---
  const expiryText = (els.stockExpiry.value || "").trim();
  let qty = Number(els.stockQty.value);

  // --- Determine real units (CT → units conversion) ---
  const unitMode = $("#stockUnitSelector").value;
  if (unitMode === "ct") {
    if (!p.ctSize || p.ctSize <= 0) {
      els.stockMsg.textContent = "This product has no CT size defined.";
      return;
    }
    qty = qty * p.ctSize;
  }

  // --- Convert DMY to ISO ---
  let expiryISO;

if (els.stockUnknownExpiry.checked) {
  expiryISO = "__unknown__";
} else {
  expiryISO = parseDMYToISO(expiryText);
  if (!expiryISO) {
    els.stockMsg.textContent =
      "Enter a valid date as DD/MM/YYYY (e.g. 08/02/2026).";
    return;
  }
}

  // --- Validate qty ---
  if (!Number.isInteger(qty) || qty <= 0) {
    els.stockMsg.textContent = "Quantity must be a whole number ≥ 1.";
    return;
  }

  // --- Normalize lots but KEEP ordered flag ---
  p.lots = normalizeLots(p.lots);

  // Only modify *real* lots, never ordered ones:
  let lot = p.lots.find(l => l.expiry === expiryISO && !l.ordered);

  // --- ADD ---
  if (dir > 0) {
    if (lot) {
      lot.qty += qty;
    } else {
      p.lots.push({ expiry: expiryISO, qty });
    }

    els.stockMsg.textContent =
      `Added ${qty} to ${formatDateDMY(expiryISO)}.`;
  }

  // --- WITHDRAW ---
  else {
    // Cannot withdraw from nonexistent real lot
    if (!lot) {
      els.stockMsg.textContent =
        `No lot for ${formatDateDMY(expiryISO)}.`;
      return;
    }
    if (lot.qty < qty) {
      els.stockMsg.textContent =
        `Cannot withdraw ${qty}. Only ${lot.qty} available for ${formatDateDMY(expiryISO)}.`;
      return;
    }

    lot.qty -= qty;
    els.stockMsg.textContent =
      `Withdrew ${qty} from ${formatDateDMY(expiryISO)}.`;
  }

  // --- Remove zero-qty lots & re‑normalize (keeps ordered flags) ---
  p.lots = normalizeLots(p.lots).filter(l => l.qty > 0);

  // --- Update UI ---
  setDirty(true);
  els.stockHeader.textContent =
    `${p.name} — Total: ${totalStock(p)}`;

  renderLots(p);
  render();
}

/* More info */
function openInfoDlg(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;

  els.infoTitle.textContent = `More info: ${p.name}`;

  const catNames = (Array.isArray(p.categoryIds) ? p.categoryIds : [])
    .map(id => state.categories.find(c => c.id === id)?.name)
    .filter(Boolean);

  let ctInfo = "";
  if (p.ctSize && p.ctSize > 0) ctInfo = ` • CT Size: ${p.ctSize} units`;

  els.infoSub.textContent = `Category: ${catNames.length ? catNames.join(", ") : "Uncategorized"}${ctInfo}`;

  els.infoWordings.textContent = (p.wordings?.length ? p.wordings.join("\n") : "—");
  els.infoCodes.textContent = (p.codes?.length ? p.codes.join("\n") : "—");

  els.infoLots.innerHTML = "";
  const lots = normalizeLots(p.lots)
    .filter(l => l.qty > 0)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));

  if (lots.length === 0) {
    els.infoLots.textContent = "No lots.";
  } else {
    for (const l of lots) {
    const st = lotStatus(l.expiry);

    const row = document.createElement("div");
    row.className = "lotItem";
    if (st === "expired") row.classList.add("lotExpired");
    else if (st === "expiring") row.classList.add("lotExpiring");
    else if (st === "risky") row.classList.add("lotRisky");

    const left = document.createElement("div");
    left.className = "lotMain";

    // --- Qty Line + CT pills ---
    const qtyLine = document.createElement("div");
    qtyLine.className = "lotQtyBig";
    qtyLine.style.display = "flex";
    qtyLine.style.alignItems = "center";
    qtyLine.style.gap = "8px";
    qtyLine.textContent = `Qty: ${l.qty}`;

    if (p.ctSize && p.ctSize > 0) {
        const full = Math.floor(l.qty / p.ctSize);
        const rem = l.qty % p.ctSize;

        if (full > 0) qtyLine.appendChild(createCtPill(full, "full"));
        if (rem > 0) qtyLine.appendChild(createCtPill(1, "partial"));
    }

    // --- Date + Status tag ---
    const dateLine = document.createElement("div");
    dateLine.className = "lotDateSmall";

    const dateText = document.createElement("span");
    dateText.textContent = formatDateDMY(l.expiry);

    const tag = document.createElement("span");
    tag.className = "lotTag";

    if (st === "expired") tag.textContent = "EXPIRED";
    else if (st === "expiring") tag.textContent = "EXPIRING";
    else if (st === "risky") tag.textContent = "RISKY";
    else tag.textContent = "OK";

    dateLine.append(dateText, tag);

    left.append(qtyLine, dateLine);

    // append row
    row.append(left, document.createElement("div"));
    els.infoLots.appendChild(row);
}
  }

  els.infoDlg.showModal();
}

/* Helpers */
function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function splitLines(text) {
  return (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function normalizeLots(lots) {
  const map = new Map(); // key = `${expiry}|${ordered?1:0}`

  for (const l of (lots || [])) {
    const expiry = String(l.expiry || "").trim();
    if (!expiry) continue;

    const qty = Math.max(0, Math.trunc(Number(l.qty) || 0));
    const ordered = !!l.ordered;

    const key = `${expiry}|${ordered ? 1 : 0}`;

    const prev = map.get(key);
    map.set(key, {
      expiry,
      qty: (prev?.qty || 0) + qty,
      ordered
    });
  }

  return [...map.values()];
}

function totalStock(p) {
  return normalizeLots(p.lots).reduce((s, l) => s + l.qty, 0);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function ym(iso) {
  return (iso || "").slice(0, 7);
}

function addMonthsYM(ymStr, monthsToAdd) {
  const [y0, m0] = ymStr.split("-").map(Number);
  let y = y0, m = m0 + monthsToAdd;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function lotStatus(expiryISO) {
  if (!expiryISO || expiryISO === "__unknown__") {
    return "ok"; // unknown treated as neutral
  }

  const now = new Date();
  const exp = new Date(expiryISO);
  if (exp < now) return "expired";

  const diffMonths =
    (exp.getFullYear() - now.getFullYear()) * 12 +
    (exp.getMonth() - now.getMonth());

  if (diffMonths <= 3) return "expiring";
  if (diffMonths <= 4) return "risky";
  return "ok";
}

function duplicateProductFromDialog() {
  if (!state) return;

  // Read current fields from the dialog (even if user hasn't pressed Save)
  const name = (els.prodName.value || "").trim();
  if (!name) {
    alert("Give the product a name first (then duplicate).");
    return;
  }

  // Multiple categories checkbox list (prodCategoriesBox)
  const selectedCategoryIds = els.prodCategoriesBox
    ? Array.from(els.prodCategoriesBox.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    : []; // fallback

  const wordings = splitLines(els.prodWordings.value);
  const codes = splitLines(els.prodCodes.value);
  const imageFileName = (els.prodImageFileName.value || "").trim();

  // Find the original (if editing an existing product)
  const original = ui.editingProductId
    ? state.products.find(p => p.id === ui.editingProductId)
    : null;

  // Decide what to clone:
  // - keep categories/wordings/codes/image
  // - DO NOT copy lots (new product should start at 0 stock)
  // - optionally copy notes if you still use it
  const newProduct = {
    id: uid("prod"),
    name: name,
    categoryIds: selectedCategoryIds,
    wordings: wordings,
    codes: codes,
    notes: (els.prodNotes?.value || "").trim(), // harmless if notes is unused
    imageFileName: imageFileName,
    lots: [], // ✅ start empty stock for the clone
  };

  // If you want to preserve some extra hidden fields from original in the future:
  // (none currently, but leaving hook)
  if (original) {
    // Example: if later you add vendor fields, etc.
  }

  state.products ||= [];
  state.products.push(newProduct);

  setDirty(true);

  // Close current dialog and immediately open edit for the new clone
  ui.editingProductId = null;
  els.prodDlg.close();

  // Open edit dialog for the cloned product
  openProductDlg(newProduct.id);
}

function parseDMYToISO(dmy) {
  const s = (dmy || "").trim();

  // Match DD/MM or DD/MM/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);

  // If year missing → use current year
  const yyyy = m[3] ? Number(m[3]) : new Date().getFullYear();

  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  const iso = `${String(yyyy).padStart(4,"0")}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  const test = new Date(`${iso}T00:00:00`);

  // Strict real-date validation (no 31 Feb nonsense)
  if (Number.isNaN(test.getTime())) return null;
  if (
    test.getFullYear() !== yyyy ||
    test.getMonth() + 1 !== mm ||
    test.getDate() !== dd
  ) return null;

  return iso;
}

function formatDateDMY(iso) {
  if (iso === "__unknown__") return "Unknown";
  if (!iso || typeof iso !== "string" || iso.length < 10) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function attachDMYMask(input) {
  input.addEventListener("input", (e) => {
    const start = input.selectionStart;
    const oldValue = input.value;

    // Only digits
    let digits = oldValue.replace(/\D/g, "").slice(0, 8);

    let formatted = "";
    if (digits.length >= 1) formatted += digits.slice(0, 2);
    if (digits.length >= 3) formatted += "/" + digits.slice(2, 4);
    if (digits.length >= 5) formatted += "/" + digits.slice(4, 8);

    // If less than full segments
    if (digits.length <= 2) formatted = digits;
    else if (digits.length <= 4) formatted = digits.slice(0,2) + "/" + digits.slice(2);
    else formatted = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4);

    const diff = formatted.length - oldValue.length;

    input.value = formatted;

    // Restore cursor properly
    input.setSelectionRange(start + diff, start + diff);
  });
}

function fuzzyMatch(query, text) {
  query = (query || "").toLowerCase().trim();
  if (!query) return true;

  const tokens = query.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (!fuzzyTokenMatch(t, text)) return false;
  }
  return true;
}

function fuzzyTokenMatch(token, text) {
  if (text.includes(token)) return true;
  let i = 0;
  for (let j = 0; j < text.length && i < token.length; j++) {
    if (text[j] === token[i]) i++;
  }
  return i === token.length;
}

function downloadJSON(obj, filename) {
  const clean = JSON.parse(JSON.stringify(obj));
  delete clean._dirty;

  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setDirty(false);
  alert(
    "Saved as a download.\n\n" +
    "Now replace data/catalogue.json with the downloaded catalogue.json.\n" +
    "(Or save directly into the data folder if your browser prompts.)"
  );
}

function createOrder() {
  const p = state.products.find(x => x.id === ui.stockProductId);
  if (!p) return;

  const expiryText = (els.stockExpiry.value || "").trim();
const qtyRaw = Number(els.stockQty.value);

let expiryISO;

if (els.stockUnknownExpiry.checked) {
  expiryISO = "__unknown__";
} else {
  expiryISO = parseDMYToISO(expiryText);
  if (!expiryISO) {
    els.stockMsg.textContent = "Enter a valid date (DD/MM/YYYY).";
    return;
  }
}

  if (!Number.isInteger(qtyRaw) || qtyRaw <= 0) {
    els.stockMsg.textContent = "Quantity must be whole number ≥ 1.";
    return;
  }

  let qty = qtyRaw;
  const mode = $("#stockUnitSelector")?.value;

  if (mode === "ct") {
    if (!p.ctSize || p.ctSize <= 0) {
      els.stockMsg.textContent = "CT mode not available.";
      return;
    }
    qty = qty * p.ctSize;
  }

  p.lots.push({
    expiry: expiryISO,
    qty,
    ordered: true
  });

  els.stockMsg.textContent = `Ordered ${qty} for ${formatDateDMY(expiryISO)}.`;

  setDirty(true);
  renderLots(p);
  render();
}


function availableStock(p) {
  return normalizeLots((p?.lots || []).filter(l => !l.ordered)).reduce((s, l) => s + l.qty, 0);
}

function sortedRealLotsForShipping(p) {
  return normalizeLots((p?.lots || []).filter(l => !l.ordered && l.qty > 0)).sort((a, b) => {
    const av = a.expiry === "__unknown__" ? "9999-12-31" : a.expiry;
    const bv = b.expiry === "__unknown__" ? "9999-12-31" : b.expiry;
    return av.localeCompare(bv);
  });
}

function withdrawFromLots(p, qtyNeeded) {
  let remaining = Math.max(0, Math.trunc(Number(qtyNeeded) || 0));
  if (!remaining) return true;
  const lots = (p.lots || []).filter(l => !l.ordered && l.qty > 0).sort((a,b) => {
    const av = a.expiry === "__unknown__" ? "9999-12-31" : a.expiry;
    const bv = b.expiry === "__unknown__" ? "9999-12-31" : b.expiry;
    return av.localeCompare(bv);
  });
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    lot.qty -= take;
    remaining -= take;
  }
  p.lots = normalizeLots((p.lots || []).filter(l => l.qty > 0 || l.ordered));
  return remaining === 0;
}

function openShipDlg(productId) {
  if (!isAdmin()) { alert('Admin login required.'); return; }
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  ui.shipProductId = productId;
  els.shipTitle.textContent = `Register shipment — ${p.name}`;
  els.shipProductName.value = p.name;
  els.shipDate.value = formatDateDMY(todayISO());
  els.shipQty.value = '';
  els.shipDestination.value = '';
  els.shipRecipient.value = '';
  els.shipReference.value = '';
  els.shipNotes.value = '';
  els.shipAvailableNote.textContent = `Available stock: ${availableStock(p)} units`;
  els.shipDlg.showModal();
}

function onShipSubmit(e) {
  e.preventDefault();
  const p = state.products.find(x => x.id === ui.shipProductId);
  if (!p) return;
  const dateISO = parseDMYToISO(els.shipDate.value || '') || todayISO();
  const qty = Math.max(0, Math.trunc(Number(els.shipQty.value) || 0));
  const destination = (els.shipDestination.value || '').trim();
  const recipient = (els.shipRecipient.value || '').trim();
  const reference = (els.shipReference.value || '').trim();
  const notes = (els.shipNotes.value || '').trim();
  if (qty < 1) { alert('Quantity must be at least 1.'); return; }
  const available = availableStock(p);
  if (qty > available) { alert(`Available stock is ${available}.`); return; }
  const ok = withdrawFromLots(p, qty);
  if (!ok) { alert('Could not register shipment.'); return; }
  state.shipments.unshift({
    id: uid('ship'),
    date: dateISO,
    productId: p.id,
    productName: p.name,
    qty,
    destination,
    recipient,
    reference,
    notes,
    createdAt: new Date().toISOString()
  });
  els.shipDlg.close();
  setDirty(true);
  render();
  renderShipmentHistory();
}

function filteredShipments() {
  const q = (els.shipHistSearch?.value || '').trim().toLowerCase();
  const arr = Array.isArray(state?.shipments) ? state.shipments.slice() : [];
  arr.sort((a,b) => `${b.date}|${b.createdAt || ''}`.localeCompare(`${a.date}|${a.createdAt || ''}`));
  if (!q) return arr;
  return arr.filter(s => [s.productName, s.destination, s.recipient, s.reference, s.notes].join(' ').toLowerCase().includes(q));
}

function renderShipmentHistory() {
  if (!els.shipHistBody) return;
  const rows = filteredShipments();
  els.shipHistBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" class="shipEmpty">No shipments registered yet.</td>';
    els.shipHistBody.appendChild(tr);
  } else {
    for (const s of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateDMY(s.date)}</td>
        <td>${escapeHtml(s.productName || '')}</td>
        <td>${s.qty}</td>
        <td>${escapeHtml(s.destination || '')}</td>
        <td>${escapeHtml(s.recipient || '')}</td>
        <td>${escapeHtml(s.reference || '')}</td>
        <td>${escapeHtml(s.notes || '')}</td>
        <td class="shipDel">${isAdmin() ? '<button class="btn small ghost danger" type="button">Del</button>' : ''}</td>`;
      const btn = tr.querySelector('button');
      if (btn) btn.addEventListener('click', () => deleteShipment(s.id));
      els.shipHistBody.appendChild(tr);
    }
  }
  if (els.shipHistCount) els.shipHistCount.textContent = `${rows.length} shipment${rows.length === 1 ? '' : 's'}`;
}

function openShipmentHistoryDlg() {
  renderShipmentHistory();
  els.shipHistDlg.showModal();
}

function deleteShipment(id) {
  if (!isAdmin()) return;
  if (!confirm('Delete this shipment record?')) return;
  state.shipments = (state.shipments || []).filter(x => x.id !== id);
  setDirty(true);
  renderShipmentHistory();
}

function exportCatalogueExcel() {
  if (!state) return;
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const products = (state.products || []).slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => ({
    Product: p.name,
    Categories: (p.categoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean).join(', '),
    Stock: totalStock(p),
    AvailableStock: availableStock(p),
    CTSize: p.ctSize || '',
    Image: p.imageFileName || '',
    Wordings: (p.wordings || []).join(' | '),
    Codes: (p.codes || []).join(' | '),
    Notes: p.notes || ''
  }));
  const lots = [];
  for (const p of (state.products || [])) {
    for (const l of normalizeLots(p.lots || [])) {
      lots.push({
        Product: p.name,
        Expiry: l.expiry === '__unknown__' ? 'Unknown' : l.expiry,
        Qty: l.qty,
        Ordered: l.ordered ? 'Yes' : 'No',
        Status: l.ordered ? 'Ordered' : lotStatus(l.expiry)
      });
    }
  }
  const shipments = (state.shipments || []).slice().sort((a,b) => `${b.date}|${b.createdAt || ''}`.localeCompare(`${a.date}|${a.createdAt || ''}`)).map(s => ({
    Date: s.date,
    Product: s.productName,
    Qty: s.qty,
    Destination: s.destination,
    Recipient: s.recipient,
    Reference: s.reference,
    Notes: s.notes
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.length ? products : [{Info:'No products'}]), 'Products');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lots.length ? lots : [{Info:'No lots'}]), 'Lots');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipments.length ? shipments : [{Info:'No shipments'}]), 'Shipments');
  const fileName = `campionature_${todayISO()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

/* Image copy (folder mode) */
function sanitizeFileName(name) {
  const s = (name || "").trim();
  if (!s) return "image";
  return s.replace(/[\\/:*?\"<>|]+/g, "_");
}

function splitBaseExt(name) {
  const n = name || "";
  const i = n.lastIndexOf(".");
  if (i <= 0) return { base: n, ext: "" };
  return { base: n.slice(0, i), ext: n.slice(i) };
}

async function copyPickedImageToMedia(file) {
  if (!fs.folderHandle) throw new Error("Folder mode not enabled.");

  const mediaDir = await fs.folderHandle.getDirectoryHandle("media", { create: true });

  const original = sanitizeFileName(file.name || "image");
  const { base, ext } = splitBaseExt(original);

  let candidate = `${base}${ext}`;
  for (let n = 1; n < 500; n++) {
    try {
      await mediaDir.getFileHandle(candidate, { create: false });
      candidate = `${base}_${n}${ext}`;
    } catch {
      break;
    }
  }

  const outHandle = await mediaDir.getFileHandle(candidate, { create: true });
  const writable = await outHandle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();

  return candidate;
}

function calculateCTs(p) {
  let full = 0;
  let partial = 0;
  if (!p.ctSize || p.ctSize <= 0) return { full, partial };

  (p.lots || []).forEach(l => {
    const q = parseInt(l.qty) || 0;
    if (q <= 0) return;
    full += Math.floor(q / p.ctSize);
    if (q % p.ctSize > 0) partial += 1;
  });

  return { full, partial };
}

function createCtPill(count, type) {
  const span = document.createElement("span");
  // Use the classes defined in your CSS
  span.className = `ct-pill ${type === 'full' ? 'ct-pill-full' : 'ct-pill-partial'}`;
  span.textContent = `${count} CT`;
  return span;
}



function inferCustomsCodeForProduct(p, categories=[]) {
  const names = [
    p?.name || '',
    ...(Array.isArray(p?.categoryIds) ? p.categoryIds.map(id => categories.find(c => c.id === id)?.name || '') : [])
  ].join(' ').toLowerCase();

  if (names.includes('wafer')) return '19053219';
  if (names.includes('biscotti') || names.includes('biscuit')) return '19053119';
  if (names.includes('savoiardi')) return '19059080';
  if (names.includes('patatine')) return '20052020';
  if (names.includes('crostatine')) return '19059070';
  return '19059070';
}

function getLotKey(expiry) {
  return String(expiry || "__unknown__");
}

function normalizeShipmentRecords(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map(s => {
    const items = Array.isArray(s.items) && s.items.length
      ? s.items.map(it => ({
          productId: it.productId || s.productId || "",
          productName: it.productName || s.productName || "",
          lotExpiry: it.lotExpiry || "__unknown__",
          unitMode: it.unitMode === "ct" ? "ct" : "units",
          qty: Math.max(1, Math.trunc(Number(it.qty) || Number(s.qty) || 1)),
          unitsQty: Math.max(1, Math.trunc(Number(it.unitsQty) || Number(it.qty) || Number(s.qty) || 1))
        }))
      : [{
          productId: s.productId || "",
          productName: s.productName || "",
          lotExpiry: s.lotExpiry || "__unknown__",
          unitMode: s.unitMode === "ct" ? "ct" : "units",
          qty: Math.max(1, Math.trunc(Number(s.qty) || 1)),
          unitsQty: Math.max(1, Math.trunc(Number(s.unitsQty) || Number(s.qty) || 1))
        }];

    return {
      id: s.id || uid("ship"),
      date: s.date || todayISO(),
      destination: s.destination || "",
      recipient: s.recipient || "",
      reference: s.reference || "",
      notes: s.notes || "",
      extraUE: !!s.extraUE,
      createdAt: s.createdAt || new Date().toISOString(),
      items
    };
  });
}

function shipmentItemAvailableUnits(item) {
  const p = state.products.find(x => x.id === item.productId);
  if (!p) return 0;
  const lot = normalizeLots((p.lots || []).filter(l => !l.ordered)).find(l => getLotKey(l.expiry) === getLotKey(item.lotExpiry));
  return Math.max(0, Math.trunc(Number(lot?.qty) || 0));
}

function shipmentItemAvailableDisplay(item) {
  const p = state.products.find(x => x.id === item.productId);
  const units = shipmentItemAvailableUnits(item);
  if (!p) return `${units} units`;
  if (item.unitMode === "ct" && p.ctSize > 0) {
    return `${Math.floor(units / p.ctSize)} CT (${units} units)`;
  }
  return `${units} units`;
}

function cartItemRequestedUnits(item) {
  const p = state.products.find(x => x.id === item.productId);
  const qty = Math.max(1, Math.trunc(Number(item.qty) || 1));
  if (item.unitMode === "ct") {
    if (!p?.ctSize) return 0;
    return qty * p.ctSize;
  }
  return qty;
}

function sortedLotsForCart(p) {
  return sortedRealLotsForShipping(p).filter(l => l.qty > 0);
}

function firstAvailableLotForProduct(p) {
  const lots = sortedLotsForCart(p);
  return lots.length ? lots[0] : null;
}

function addProductToShipmentCart(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const firstLot = firstAvailableLotForProduct(p);
  if (!firstLot) {
    alert("No available stock lots for this product.");
    return;
  }

  const existing = shipmentCart.find(it => it.productId === productId && getLotKey(it.lotExpiry) === getLotKey(firstLot.expiry) && it.unitMode === "units");
  if (existing) {
    existing.qty += 1;
  } else {
    shipmentCart.push({
      id: uid("cart"),
      productId: p.id,
      productName: p.name,
      lotExpiry: firstLot.expiry,
      unitMode: "units",
      qty: 1
    });
  }
  renderShipmentCart();
}

function clearShipmentCart() {
  shipmentCart = [];
  renderShipmentCart();
}

function buildLotOptionsHtml(p, selectedExpiry) {
  const lots = sortedLotsForCart(p);
  return lots.map(l => {
    const label = `${formatDateDMY(l.expiry)} — ${l.qty} units${p.ctSize ? ` (${Math.floor(l.qty / p.ctSize)} CT max)` : ''}`;
    const sel = getLotKey(l.expiry) === getLotKey(selectedExpiry) ? 'selected' : '';
    return `<option value="${escapeHtml(getLotKey(l.expiry))}" ${sel}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderShipmentCart() {
  if (!els.shipmentCartList) return;
  const box = els.shipmentCartList;
  box.innerHTML = "";

  if (!shipmentCart.length) {
    box.innerHTML = `<div class="shipmentCartEmpty">Cart empty. Use “Add to cart” on a product.</div>`;
    if (els.shipmentCartSummary) els.shipmentCartSummary.textContent = "No products in cart.";
    return;
  }

  let totalUnits = 0;

  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const row = document.createElement("div");
    row.className = "shipmentCartItem";

    const unitOptions = [`<option value="units" ${item.unitMode !== "ct" ? 'selected' : ''}>Units</option>`];
    if (p.ctSize && p.ctSize > 0) unitOptions.push(`<option value="ct" ${item.unitMode === "ct" ? 'selected' : ''}>Boxes / CT</option>`);

    row.innerHTML = `
      <div class="shipmentCartItemHead">
        <div class="shipmentCartItemName">${escapeHtml(item.productName)}</div>
        <button class="btn small ghost danger" type="button" data-cart-act="remove">Remove</button>
      </div>
      <div class="shipmentCartGrid">
        <label class="row">
          <span>Lot</span>
          <select data-cart-act="lot">${buildLotOptionsHtml(p, item.lotExpiry)}</select>
        </label>
        <label class="row">
          <span>Mode</span>
          <select data-cart-act="mode">${unitOptions.join('')}</select>
        </label>
        <label class="row">
          <span>Quantity</span>
          <input data-cart-act="qty" type="number" min="1" step="1" value="${Math.max(1, Math.trunc(Number(item.qty)||1))}">
        </label>
        <div class="cartMiniBtns">
          <button class="btn small ghost" type="button" data-cart-act="minus">-</button>
          <button class="btn small" type="button" data-cart-act="plus">+</button>
        </div>
      </div>
      <div class="shipmentCartMeta" data-cart-meta></div>
    `;

    const lotSel = row.querySelector('[data-cart-act="lot"]');
    const modeSel = row.querySelector('[data-cart-act="mode"]');
    const qtyInp = row.querySelector('[data-cart-act="qty"]');
    const meta = row.querySelector('[data-cart-meta]');

    function syncMeta() {
      const availableUnits = shipmentItemAvailableUnits(item);
      const requestedUnits = cartItemRequestedUnits(item);
      const status = requestedUnits > availableUnits ? 'Not enough stock in selected lot.' : 'OK';
      let extra = `Available in selected lot: ${shipmentItemAvailableDisplay(item)} • Requested: ${requestedUnits} units`;
      if (p.ctSize) extra += ` • CT size: ${p.ctSize}`;
      meta.textContent = `${extra} • ${status}`;
    }

    lotSel.addEventListener("change", () => {
      item.lotExpiry = lotSel.value;
      if (item.unitMode === "ct" && p.ctSize > 0) {
        const maxCt = Math.max(1, Math.floor(shipmentItemAvailableUnits(item) / p.ctSize) || 1);
        if ((Number(item.qty) || 1) > maxCt) item.qty = maxCt;
      }
      renderShipmentCart();
    });
    modeSel.addEventListener("change", () => {
      item.unitMode = modeSel.value === "ct" ? "ct" : "units";
      if (item.unitMode === "ct" && p.ctSize > 0) {
        const maxCt = Math.max(1, Math.floor(shipmentItemAvailableUnits(item) / p.ctSize) || 1);
        item.qty = Math.min(Math.max(1, Math.trunc(Number(item.qty) || 1)), maxCt);
      }
      renderShipmentCart();
    });
    qtyInp.addEventListener("input", () => {
      item.qty = Math.max(1, Math.trunc(Number(qtyInp.value) || 1));
      syncMeta();
    });
    row.querySelector('[data-cart-act="plus"]').addEventListener("click", () => {
      item.qty = Math.max(1, Math.trunc(Number(item.qty) || 1)) + 1;
      renderShipmentCart();
    });
    row.querySelector('[data-cart-act="minus"]').addEventListener("click", () => {
      item.qty = Math.max(1, Math.trunc(Number(item.qty) || 1) - 1);
      renderShipmentCart();
    });
    row.querySelector('[data-cart-act="remove"]').addEventListener("click", () => {
      shipmentCart = shipmentCart.filter(x => x.id !== item.id);
      renderShipmentCart();
    });

    syncMeta();
    totalUnits += cartItemRequestedUnits(item);
    box.appendChild(row);
  }

  if (els.shipmentCartSummary) {
    els.shipmentCartSummary.textContent = `${shipmentCart.length} product line${shipmentCart.length === 1 ? '' : 's'} • ${totalUnits} total units`;
  }
}

function buildShipmentDraftFromCart(requireValidation=true) {
  const dateISO = parseDMYToISO(els.cartShipDate?.value || '') || todayISO();
  const destination = (els.cartDestination?.value || '').trim();
  const recipient = (els.cartRecipient?.value || '').trim();
  const reference = (els.cartReference?.value || '').trim();
  const notes = (els.cartNotes?.value || '').trim();
  const extraUE = !!els.cartExtraUE?.checked;

  const items = [];
  const errors = [];

  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const lot = normalizeLots((p.lots || []).filter(l => !l.ordered)).find(l => getLotKey(l.expiry) === getLotKey(item.lotExpiry));
    const availableUnits = Math.max(0, Math.trunc(Number(lot?.qty) || 0));
    const requestedUnits = cartItemRequestedUnits(item);
    if (requireValidation) {
      if (!lot) errors.push(`${p.name}: selected lot not found.`);
      else if (requestedUnits > availableUnits) errors.push(`${p.name}: requested ${requestedUnits}, available ${availableUnits} in lot ${formatDateDMY(item.lotExpiry)}.`);
      if (item.unitMode === "ct" && (!p.ctSize || p.ctSize <= 0)) errors.push(`${p.name}: CT size missing.`);
    }
    items.push({
      productId: p.id,
      productName: p.name,
      lotExpiry: item.lotExpiry,
      unitMode: item.unitMode === "ct" ? "ct" : "units",
      qty: Math.max(1, Math.trunc(Number(item.qty) || 1)),
      unitsQty: requestedUnits,
      customsCode: p.customsCode || "",
      unitWeightKg: Number(p.unitWeightKg || 0) || 0
    });
  }

  return {
    id: uid("ship"),
    date: dateISO,
    destination,
    recipient,
    reference,
    notes,
    extraUE,
    createdAt: new Date().toISOString(),
    items,
    errors
  };
}

function withdrawFromSpecificLot(p, expiry, qtyNeeded) {
  let remaining = Math.max(0, Math.trunc(Number(qtyNeeded) || 0));
  if (!remaining) return true;
  const lot = (p.lots || []).find(l => !l.ordered && getLotKey(l.expiry) === getLotKey(expiry));
  if (!lot || lot.qty < remaining) return false;
  lot.qty -= remaining;
  p.lots = normalizeLots((p.lots || []).filter(l => l.qty > 0 || l.ordered));
  return true;
}

function createShipmentFromCart() {
  if (!isAdmin()) { alert("Admin login required."); return; }
  if (!shipmentCart.length) { alert("Cart is empty."); return; }
  const draft = buildShipmentDraftFromCart(true);
  if (draft.errors.length) {
    alert(draft.errors.join("\n"));
    return;
  }

  for (const item of draft.items) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const ok = withdrawFromSpecificLot(p, item.lotExpiry, item.unitsQty);
    if (!ok) {
      alert(`Could not withdraw stock for ${item.productName}.`);
      return;
    }
  }

  state.shipments.unshift({
    id: draft.id,
    date: draft.date,
    destination: draft.destination,
    recipient: draft.recipient,
    reference: draft.reference,
    notes: draft.notes,
    extraUE: draft.extraUE,
    createdAt: draft.createdAt,
    items: draft.items
  });

  setDirty(true);
  exportShipmentDraftPDF(draft);
  exportShipmentDraftExcel(draft);
  if (draft.extraUE) exportDHLList(draft);
  shipmentCart = [];
  render();
  renderShipmentHistory();
}

function shipmentItemsText(s) {
  const items = Array.isArray(s.items) ? s.items : [];
  return items.map(it => {
    const lotTxt = formatDateDMY(it.lotExpiry || "__unknown__");
    const modeTxt = it.unitMode === "ct" ? `${it.qty} CT` : `${it.qty} u`;
    return `${it.productName} • ${modeTxt} • Lot ${lotTxt}`;
  }).join(" | ");
}

function filteredShipments() {
  const q = (els.shipHistSearch?.value || '').trim().toLowerCase();
  const arr = normalizeShipmentRecords(state?.shipments);
  arr.sort((a,b) => `${b.date}|${b.createdAt || ''}`.localeCompare(`${a.date}|${a.createdAt || ''}`));
  if (!q) return arr;
  return arr.filter(s => [shipmentItemsText(s), s.destination, s.recipient, s.reference, s.notes, s.extraUE ? 'dhl extra ue' : ''].join(' ').toLowerCase().includes(q));
}

function renderShipmentHistory() {
  if (!els.shipHistBody) return;
  state.shipments = normalizeShipmentRecords(state.shipments);
  const rows = filteredShipments();
  els.shipHistBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" class="shipEmpty">No shipments registered yet.</td>';
    els.shipHistBody.appendChild(tr);
  } else {
    for (const s of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateDMY(s.date)}</td>
        <td>${escapeHtml(shipmentItemsText(s))}</td>
        <td>${escapeHtml(s.destination || '')}</td>
        <td>${escapeHtml(s.recipient || '')}</td>
        <td>${escapeHtml(s.reference || '')}</td>
        <td>${escapeHtml(s.notes || '')}</td>
        <td>${s.extraUE ? 'Yes' : 'No'}</td>
        <td class="shipDel">${isAdmin() ? '<button class="btn small ghost danger" type="button">Del</button>' : ''}</td>`;
      const btn = tr.querySelector('button');
      if (btn) btn.addEventListener('click', () => deleteShipment(s.id));
      els.shipHistBody.appendChild(tr);
    }
  }
  if (els.shipHistCount) els.shipHistCount.textContent = `${rows.length} shipment${rows.length === 1 ? '' : 's'}`;
}

function deleteShipment(id) {
  if (!isAdmin()) return;
  if (!confirm('Delete this shipment record?')) return;
  state.shipments = normalizeShipmentRecords(state.shipments).filter(x => x.id !== id);
  setDirty(true);
  renderShipmentHistory();
}

function exportCatalogueExcel() {
  if (!state) return;
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const products = (state.products || []).slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => ({
    Product: p.name,
    Categories: (p.categoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean).join(', '),
    Stock: totalStock(p),
    AvailableStock: availableStock(p),
    CTSize: p.ctSize || '',
    CustomsCode: p.customsCode || '',
    UnitWeightKg: p.unitWeightKg || '',
    Image: p.imageFileName || '',
    Wordings: (p.wordings || []).join(' | '),
    Codes: (p.codes || []).join(' | '),
    Notes: p.notes || ''
  }));
  const lots = [];
  for (const p of (state.products || [])) {
    for (const l of normalizeLots(p.lots || [])) {
      lots.push({
        Product: p.name,
        Expiry: l.expiry === '__unknown__' ? 'Unknown' : l.expiry,
        Qty: l.qty,
        Ordered: l.ordered ? 'Yes' : 'No',
        Status: l.ordered ? 'Ordered' : lotStatus(l.expiry)
      });
    }
  }
  const shipments = [];
  for (const s of normalizeShipmentRecords(state.shipments)) {
    for (const it of s.items) {
      shipments.push({
        Date: s.date,
        ShipmentID: s.id,
        Product: it.productName,
        Lot: it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry,
        Mode: it.unitMode,
        Qty: it.qty,
        UnitsQty: it.unitsQty,
        Destination: s.destination,
        Recipient: s.recipient,
        Reference: s.reference,
        Notes: s.notes,
        ExtraUE: s.extraUE ? 'Yes' : 'No'
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.length ? products : [{Info:'No products'}]), 'Products');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lots.length ? lots : [{Info:'No lots'}]), 'Lots');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipments.length ? shipments : [{Info:'No shipments'}]), 'Shipments');
  XLSX.writeFile(wb, `campionature_${todayISO()}.xlsx`);
}

function exportShipmentDraftExcel(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const rows = draft.items.map(it => ({
    ShipmentID: draft.id,
    Date: draft.date,
    Product: it.productName,
    Lot: it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry,
    Mode: it.unitMode,
    Qty: it.qty,
    UnitsQty: it.unitsQty,
    Destination: draft.destination,
    Recipient: draft.recipient,
    Reference: draft.reference,
    Notes: draft.notes,
    ExtraUE: draft.extraUE ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Shipment');
  XLSX.writeFile(wb, `${draft.id}.xlsx`);
}

function exportShipmentDraftPDF(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  const jspdfNs = window.jspdf;
  if (!jspdfNs?.jsPDF) { alert("PDF library not loaded."); return; }
  const doc = new jspdfNs.jsPDF();
  let y = 16;
  doc.setFontSize(16);
  doc.text(`Shipment ${draft.id}`, 14, y); y += 8;
  doc.setFontSize(11);
  const head = [
    `Date: ${draft.date}`,
    `Destination: ${draft.destination || '-'}`,
    `Recipient: ${draft.recipient || '-'}`,
    `Reference: ${draft.reference || '-'}`,
    `Notes: ${draft.notes || '-'}`,
    `Extra UE / DHL: ${draft.extraUE ? 'Yes' : 'No'}`
  ];
  head.forEach(line => { doc.text(line, 14, y); y += 6; });
  y += 2;
  draft.items.forEach((it, i) => {
    const lines = [
      `${i+1}. ${it.productName}`,
      `   Lot: ${it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry}`,
      `   Mode: ${it.unitMode}   Qty: ${it.qty}   Units: ${it.unitsQty}`
    ];
    lines.forEach(line => {
      if (y > 280) { doc.addPage(); y = 16; }
      doc.text(line, 14, y); y += 6;
    });
    y += 2;
  });
  doc.save(`${draft.id}.pdf`);
}

function exportDHLList(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  const blocks = draft.items.map(it => {
    const baseName = String(it.productName || '').split(' ');
    const brand = 'BALCONI';
    const line1 = it.customsCode || 'missing';
    const line2 = `${brand} [${it.productName}]`;
    const line3 = `[${it.unitWeightKg || 'missing'}]`;
    return [line1, line2, line3].join('\n');
  });
  const text = blocks.join('\n\n');
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${draft.id}_DHL_List.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

(async function bootstrap(){
  document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  wire();
});
  await initSupabase();
  portalSession = loadPortalSession();
  refreshAuthUI();
  const ok = await loadCatalogueOnline();
  if (!ok) {
    try {
      const res = await fetch('catalogue.json');
      if (!res.ok) throw new Error('catalogue.json not found');
      const obj = await res.json();
      validateAndNormalize(obj);
      state = obj;
      loadedFileName = 'catalogue.json';
      setEnabled(true);
      setDirty(false);
      render();
      refreshAuthUI();
    } catch (e) {
      console.warn('Fallback catalogue load failed', e);
    }
  }
  window.sb = supabaseClient;
})();



function getImageSrc(fileName) {
  const f = String(fileName || '').trim();
  return f ? `media/${f}` : '';
}

/* -------------------- Shipment persistence + export filename helpers -------------------- */
let persistOnlineTimer = null;

function sanitizeFilePart(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Cliente';
}

function formatYYMMDD(dateISO) {
  const d = String(dateISO || todayISO());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return todayISO().slice(2).replace(/-/g,'');
  return d.slice(2,4) + d.slice(5,7) + d.slice(8,10);
}

function nextShipmentProgressive(dateISO) {
  const key = formatYYMMDD(dateISO);
  const rows = normalizeShipmentRecords(state?.shipments);
  let maxNum = 0;
  for (const s of rows) {
    const base = s.fileBaseName || '';
    const m = base.match(/Campionatura_(\d{6})-(\d{3})_/i);
    if (m && m[1] === key) maxNum = Math.max(maxNum, Number(m[2]) || 0);
  }
  return String(maxNum + 1).padStart(3, '0');
}

function buildShipmentFileBase(dateISO, recipient, progressive) {
  const datePart = formatYYMMDD(dateISO);
  const seq = progressive || nextShipmentProgressive(dateISO);
  const client = sanitizeFilePart(recipient || els?.cartRecipient?.value || els?.cartDestination?.value || 'Cliente');
  return `Campionatura_${datePart}-${seq}_${client}`;
}

async function saveCatalogueOnlineSilently() {
  if (!supabaseClient || !isAdmin() || !state) return false;
  const { error } = await supabaseClient
    .from('catalogue')
    .upsert({ id: CATALOGUE_ROW_ID, data: state, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) {
    console.warn('Online save failed:', error.message);
    return false;
  }
  setDirty(false);
  return true;
}

function queueOnlineSave() {
  if (!supabaseClient || !isAdmin() || !state) return;
  clearTimeout(persistOnlineTimer);
  persistOnlineTimer = setTimeout(() => { saveCatalogueOnlineSilently(); }, 250);
}

function restoreShipmentStock(shipment) {
  const s = normalizeShipmentRecords([shipment])[0];
  if (!s) return;
  for (const it of s.items) {
    const p = state.products.find(x => x.id === it.productId);
    if (!p) continue;
    const key = getLotKey(it.lotExpiry);
    let lot = (p.lots || []).find(l => !l.ordered && getLotKey(l.expiry) === key);
    if (!lot) {
      lot = { expiry: it.lotExpiry || '__unknown__', qty: 0, ordered: false };
      p.lots = normalizeLots([...(p.lots || []), lot]);
      lot = (p.lots || []).find(l => !l.ordered && getLotKey(l.expiry) === key);
    }
    lot.qty = Math.max(0, Math.trunc(Number(lot.qty) || 0) + Math.max(1, Math.trunc(Number(it.unitsQty) || 0)));
    p.lots = normalizeLots(p.lots || []);
  }
}

function loadShipmentIntoCart(shipment) {
  const s = normalizeShipmentRecords([shipment])[0];
  if (!s) return;
  els.cartShipDate && (els.cartShipDate.value = formatDateDMY(s.date));
  els.cartDestination && (els.cartDestination.value = s.destination || '');
  els.cartRecipient && (els.cartRecipient.value = s.recipient || '');
  els.cartReference && (els.cartReference.value = s.reference || '');
  els.cartNotes && (els.cartNotes.value = s.notes || '');
  els.cartExtraUE && (els.cartExtraUE.checked = !!s.extraUE);
  shipmentCart = s.items.map(it => ({
    id: uid('cart'),
    productId: it.productId,
    productName: it.productName,
    lotExpiry: it.lotExpiry || '__unknown__',
    unitMode: it.unitMode === 'ct' ? 'ct' : 'units',
    qty: Math.max(1, Math.trunc(Number(it.qty) || 1))
  }));
  renderShipmentCart();
}

async function editShipment(id) {
  if (!isAdmin()) return;
  const s = normalizeShipmentRecords(state.shipments).find(x => x.id === id);
  if (!s) return;
  restoreShipmentStock(s);
  state.shipments = normalizeShipmentRecords(state.shipments).filter(x => x.id !== id);
  loadShipmentIntoCart(s);
  setDirty(true);
  render();
  renderShipmentHistory();
  queueOnlineSave();
  if (els.shipHistDlg?.open) els.shipHistDlg.close();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- overrides ---
function renderShipmentCart() {
  if (!els.shipmentCartList) return;
  const box = els.shipmentCartList;
  box.innerHTML = '';

  if (!shipmentCart.length) {
    box.innerHTML = `<div class="shipmentCartEmpty">Cart empty. Use “Add to cart” on a product.</div>`;
    if (els.shipmentCartSummary) els.shipmentCartSummary.textContent = 'No products in cart.';
    const lines = document.getElementById('cartLinesCount');
    const units = document.getElementById('cartUnitsCount');
    const ct = document.getElementById('cartCtCount');
    if (lines) lines.textContent = '0';
    if (units) units.textContent = '0';
    if (ct) ct.textContent = '0';
    return;
  }

  let totalUnits = 0;
  let totalCt = 0;

  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const row = document.createElement('div');
    row.className = 'shipmentCartItem';

    const unitOptions = [`<option value="units" ${item.unitMode !== 'ct' ? 'selected' : ''}>Units</option>`];
    if (p.ctSize && p.ctSize > 0) unitOptions.push(`<option value="ct" ${item.unitMode === 'ct' ? 'selected' : ''}>Boxes / CT</option>`);
    const imgSrc = getImageSrc(p.imageFileName || '');

    row.innerHTML = `
      <div class="shipmentCartItemBody">
        <div class="shipmentCartThumb">${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="">` : '<div class="shipmentCartThumbEmpty">No image</div>'}</div>
        <div class="shipmentCartMain">
          <div class="shipmentCartItemHead">
            <div class="shipmentCartItemName">${escapeHtml(item.productName)}</div>
            <button class="btn small ghost danger" type="button" data-cart-act="remove">Remove</button>
          </div>
          <div class="shipmentCartGrid">
            <label class="row">
              <span>Lot</span>
              <select data-cart-act="lot">${buildLotOptionsHtml(p, item.lotExpiry)}</select>
            </label>
            <label class="row">
              <span>Mode</span>
              <select data-cart-act="mode">${unitOptions.join('')}</select>
            </label>
            <label class="row">
              <span>Qty</span>
              <input data-cart-act="qty" type="number" min="1" step="1" value="${Math.max(1, Math.trunc(Number(item.qty)||1))}">
            </label>
            <div class="cartMiniBtns">
              <button class="btn small ghost" type="button" data-cart-act="minus">-</button>
              <button class="btn small" type="button" data-cart-act="plus">+</button>
            </div>
          </div>
          <div class="shipmentCartMeta" data-cart-meta></div>
        </div>
      </div>
    `;

    const lotSel = row.querySelector('[data-cart-act="lot"]');
    const modeSel = row.querySelector('[data-cart-act="mode"]');
    const qtyInp = row.querySelector('[data-cart-act="qty"]');
    const meta = row.querySelector('[data-cart-meta]');

    function syncMeta() {
      const availableUnits = shipmentItemAvailableUnits(item);
      const requestedUnits = cartItemRequestedUnits(item);
      const status = requestedUnits > availableUnits ? 'Not enough stock in selected lot.' : 'OK';
      let extra = `Available: ${shipmentItemAvailableDisplay(item)} • Requested: ${requestedUnits} units`;
      if (p.ctSize) extra += ` • CT size: ${p.ctSize}`;
      meta.textContent = `${extra} • ${status}`;
    }

    lotSel.addEventListener('change', () => {
      item.lotExpiry = lotSel.value;
      if (item.unitMode === 'ct' && p.ctSize > 0) {
        const maxCt = Math.max(1, Math.floor(shipmentItemAvailableUnits(item) / p.ctSize) || 1);
        if ((Number(item.qty) || 1) > maxCt) item.qty = maxCt;
      }
      renderShipmentCart();
    });
    modeSel.addEventListener('change', () => {
      item.unitMode = modeSel.value === 'ct' ? 'ct' : 'units';
      if (item.unitMode === 'ct' && p.ctSize > 0) {
        const maxCt = Math.max(1, Math.floor(shipmentItemAvailableUnits(item) / p.ctSize) || 1);
        item.qty = Math.min(Math.max(1, Math.trunc(Number(item.qty) || 1)), maxCt);
      }
      renderShipmentCart();
    });
    qtyInp.addEventListener('input', () => {
      item.qty = Math.max(1, Math.trunc(Number(qtyInp.value) || 1));
      syncMeta();
    });
    row.querySelector('[data-cart-act="plus"]').addEventListener('click', () => {
      item.qty = Math.max(1, Math.trunc(Number(item.qty) || 1)) + 1;
      renderShipmentCart();
    });
    row.querySelector('[data-cart-act="minus"]').addEventListener('click', () => {
      item.qty = Math.max(1, Math.trunc(Number(item.qty) || 1) - 1);
      renderShipmentCart();
    });
    row.querySelector('[data-cart-act="remove"]').addEventListener('click', () => {
      shipmentCart = shipmentCart.filter(x => x.id !== item.id);
      renderShipmentCart();
    });

    syncMeta();
    totalUnits += cartItemRequestedUnits(item);
    if (item.unitMode === 'ct') totalCt += Math.max(1, Math.trunc(Number(item.qty) || 1));
    box.appendChild(row);
  }

  if (els.shipmentCartSummary) {
    els.shipmentCartSummary.textContent = `${shipmentCart.length} line${shipmentCart.length === 1 ? '' : 'e'} • ${totalUnits} units total`;
  }
  const lines = document.getElementById('cartLinesCount');
  const units = document.getElementById('cartUnitsCount');
  const ct = document.getElementById('cartCtCount');
  if (lines) lines.textContent = String(shipmentCart.length);
  if (units) units.textContent = String(totalUnits);
  if (ct) ct.textContent = String(totalCt);
}

function buildShipmentDraftFromCart(requireValidation=true) {
  const dateISO = parseDMYToISO(els.cartShipDate?.value || '') || todayISO();
  const destination = (els.cartDestination?.value || '').trim();
  const recipient = (els.cartRecipient?.value || '').trim();
  const reference = (els.cartReference?.value || '').trim();
  const notes = (els.cartNotes?.value || '').trim();
  const extraUE = !!els.cartExtraUE?.checked;
  const progressive = nextShipmentProgressive(dateISO);

  const items = [];
  const errors = [];

  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const lot = normalizeLots((p.lots || []).filter(l => !l.ordered)).find(l => getLotKey(l.expiry) === getLotKey(item.lotExpiry));
    const availableUnits = Math.max(0, Math.trunc(Number(lot?.qty) || 0));
    const requestedUnits = cartItemRequestedUnits(item);
    if (requireValidation) {
      if (!lot) errors.push(`${p.name}: selected lot not found.`);
      else if (requestedUnits > availableUnits) errors.push(`${p.name}: requested ${requestedUnits}, available ${availableUnits} in lot ${formatDateDMY(item.lotExpiry)}.`);
      if (item.unitMode === 'ct' && (!p.ctSize || p.ctSize <= 0)) errors.push(`${p.name}: CT size missing.`);
    }
    items.push({
      productId: p.id,
      productName: p.name,
      lotExpiry: item.lotExpiry,
      unitMode: item.unitMode === 'ct' ? 'ct' : 'units',
      qty: Math.max(1, Math.trunc(Number(item.qty) || 1)),
      unitsQty: requestedUnits,
      customsCode: p.customsCode || '',
      unitWeightKg: Number(p.unitWeightKg || 0) || 0,
      imageFileName: p.imageFileName || ''
    });
  }

  const fileBaseName = buildShipmentFileBase(dateISO, recipient || destination, progressive);
  return {
    id: fileBaseName,
    fileBaseName,
    date: dateISO,
    destination,
    recipient,
    reference,
    notes,
    extraUE,
    createdAt: new Date().toISOString(),
    items,
    errors
  };
}

async function createShipmentFromCart() {
  if (!isAdmin()) { alert('Admin login required.'); return; }
  if (!shipmentCart.length) { alert('Cart is empty.'); return; }
  const draft = buildShipmentDraftFromCart(true);
  if (draft.errors.length) {
    alert(draft.errors.join('\n'));
    return;
  }

  for (const item of draft.items) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const ok = withdrawFromSpecificLot(p, item.lotExpiry, item.unitsQty);
    if (!ok) {
      alert(`Could not withdraw stock for ${item.productName}.`);
      return;
    }
  }

  state.shipments = normalizeShipmentRecords(state.shipments);
  state.shipments.unshift({
    id: draft.id,
    fileBaseName: draft.fileBaseName,
    date: draft.date,
    destination: draft.destination,
    recipient: draft.recipient,
    reference: draft.reference,
    notes: draft.notes,
    extraUE: draft.extraUE,
    createdAt: draft.createdAt,
    items: draft.items
  });

  setDirty(true);
  queueOnlineSave();
  exportShipmentDraftPDF(draft);
  exportShipmentDraftExcel(draft);
  if (draft.extraUE) exportDHLList(draft);
  shipmentCart = [];
  render();
  renderShipmentHistory();
}

function shipmentItemsText(s) {
  const items = Array.isArray(s.items) ? s.items : [];
  return items.map(it => {
    const lotTxt = formatDateDMY(it.lotExpiry || '__unknown__');
    const modeTxt = it.unitMode === 'ct' ? `${it.qty} CT` : `${it.qty} u`;
    return `${it.productName} • ${modeTxt} • Lot ${lotTxt}`;
  }).join(' | ');
}

function filteredShipments() {
  const q = (els.shipHistSearch?.value || '').trim().toLowerCase();
  const arr = normalizeShipmentRecords(state?.shipments);
  arr.sort((a,b) => `${b.date}|${b.createdAt || ''}`.localeCompare(`${a.date}|${a.createdAt || ''}`));
  if (!q) return arr;
  return arr.filter(s => [shipmentItemsText(s), s.destination, s.recipient, s.reference, s.notes, s.extraUE ? 'dhl extra ue' : ''].join(' ').toLowerCase().includes(q));
}

function renderShipmentHistory() {
  if (!els.shipHistBody) return;
  state.shipments = normalizeShipmentRecords(state.shipments);
  const rows = filteredShipments();
  els.shipHistBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" class="shipEmpty">No shipments registered yet.</td>';
    els.shipHistBody.appendChild(tr);
  } else {
    for (const s of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateDMY(s.date)}</td>
        <td>${escapeHtml(shipmentItemsText(s))}</td>
        <td>${escapeHtml(s.destination || '')}</td>
        <td>${escapeHtml(s.recipient || '')}</td>
        <td>${escapeHtml(s.reference || '')}</td>
        <td>${escapeHtml(s.notes || '')}</td>
        <td>${s.extraUE ? 'Yes' : 'No'}</td>
        <td class="shipDel">
          <div class="shipActions">
            <button class="btn small ghost" type="button" data-act="pdf">PDF</button>
            <button class="btn small ghost" type="button" data-act="edit">Edit</button>
            ${s.extraUE ? '<button class="btn small ghost" type="button" data-act="dhl">DHL</button>' : ''}
            ${isAdmin() ? '<button class="btn small ghost danger" type="button" data-act="del">Del</button>' : ''}
          </div>
        </td>`;
      tr.querySelector('[data-act="pdf"]')?.addEventListener('click', () => exportShipmentDraftPDF(s));
      tr.querySelector('[data-act="edit"]')?.addEventListener('click', () => editShipment(s.id));
      tr.querySelector('[data-act="dhl"]')?.addEventListener('click', () => exportDHLList(s));
      tr.querySelector('[data-act="del"]')?.addEventListener('click', () => deleteShipment(s.id));
      els.shipHistBody.appendChild(tr);
    }
  }
  if (els.shipHistCount) els.shipHistCount.textContent = `${rows.length} shipment${rows.length === 1 ? '' : 's'}`;
}

async function deleteShipment(id) {
  if (!isAdmin()) return;
  if (!confirm('Delete this shipment record? Stock will be restored.')) return;
  const s = normalizeShipmentRecords(state.shipments).find(x => x.id === id);
  if (!s) return;
  restoreShipmentStock(s);
  state.shipments = normalizeShipmentRecords(state.shipments).filter(x => x.id !== id);
  setDirty(true);
  render();
  renderShipmentHistory();
  queueOnlineSave();
}

function exportShipmentDraftExcel(draft) {
  if (!draft || !draft.items?.length) { alert('Cart is empty.'); return; }
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const rows = draft.items.map(it => ({
    ShipmentID: draft.id,
    Date: draft.date,
    Product: it.productName,
    Lot: it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry,
    Mode: it.unitMode,
    Qty: it.qty,
    UnitsQty: it.unitsQty,
    Destination: draft.destination,
    Recipient: draft.recipient,
    Reference: draft.reference,
    Notes: draft.notes,
    ExtraUE: draft.extraUE ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Shipment');
  XLSX.writeFile(wb, `${draft.fileBaseName || draft.id}.xlsx`);
}

function exportShipmentDraftPDF(draft) {
  if (!draft || !draft.items?.length) { alert('Cart is empty.'); return; }
  const jspdfNs = window.jspdf;
  if (!jspdfNs?.jsPDF) { alert('PDF library not loaded.'); return; }
  const doc = new jspdfNs.jsPDF();
  let y = 16;
  doc.setFontSize(16);
  doc.text(draft.fileBaseName || draft.id || 'Campionatura', 14, y); y += 8;
  doc.setFontSize(11);
  const head = [
    `Date: ${draft.date}`,
    `Destination: ${draft.destination || '-'}`,
    `Recipient: ${draft.recipient || '-'}`,
    `Reference: ${draft.reference || '-'}`,
    `Notes: ${draft.notes || '-'}`,
    `Extra UE / DHL: ${draft.extraUE ? 'Yes' : 'No'}`
  ];
  head.forEach(line => { doc.text(line, 14, y); y += 6; });
  y += 2;
  draft.items.forEach((it, i) => {
    const lines = [
      `${i+1}. ${it.productName}`,
      `   Lot: ${it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry}`,
      `   Mode: ${it.unitMode}   Qty: ${it.qty}   Units: ${it.unitsQty}`
    ];
    lines.forEach(line => {
      if (y > 280) { doc.addPage(); y = 16; }
      doc.text(line, 14, y); y += 6;
    });
    y += 2;
  });
  doc.save(`${draft.fileBaseName || draft.id}.pdf`);
}

function exportDHLList(draft) {
  if (!draft || !draft.items?.length) { alert('Cart is empty.'); return; }
  const blocks = draft.items.map(it => {
    const brand = 'BALCONI';
    const line1 = it.customsCode || 'missing';
    const line2 = `${brand} [${it.productName}]`;
    const line3 = `[${it.unitWeightKg || 'missing'}]`;
    return [line1, line2, line3].join('\n');
  });
  const text = blocks.join('\n\n');
  downloadBlob(new Blob([text], {type:'text/plain;charset=utf-8'}), `${draft.fileBaseName || draft.id}_DHL_List.txt`);
}
