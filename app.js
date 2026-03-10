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
  // Cart elements (new layout)
  shipmentCartList: $("#shipmentCartList"),
  shipmentCartSummary: $("#shipmentCartSummary"),
  cartOverview: $("#cartOverview"),
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
};

/* -------------------- Supabase + Portal Auth -------------------- */
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const CATALOGUE_ROW_ID = "main";

let supabaseClient = null;

const PORTAL_SESSION_KEY = "portal_session_v1";
let portalSession = null;

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
    if (st) st.textContent = `👤 ${portalSession.username} (${portalSession.role})`;
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "";
    if (u) u.style.display = "none";
    if (p) p.style.display = "none";
  } else {
    if (st) st.textContent = "Viewer";
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
  if (els?.btnAddProduct) {
    els.btnAddProduct.disabled = !editable;
    els.btnAddProduct.style.opacity = editable ? "" : ".4";
  }
  if (els?.btnAddCategory) {
    els.btnAddCategory.disabled = !editable;
    els.btnAddCategory.style.opacity = editable ? "" : ".4";
  }
  const btnImportExcel = document.getElementById("btnImportExcel");
  if (btnImportExcel) {
    btnImportExcel.disabled = !editable || !state;
    btnImportExcel.style.opacity = (editable && state) ? "" : ".4";
  }
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
  if (error) { console.warn("Supabase load failed:", error.message); return false; }
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
  if (!supabaseClient) { alert("Supabase not configured."); return; }
  const adminEmail = window.ADMIN_EMAIL || `${username}@campionature.local`;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: adminEmail, password });
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

/* ------------------------------------------------------------------ */
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

const fs = { folderHandle: null, jsonFileName: "catalogue.json" };

let autosaveTimer = null;
let autosaveInFlight = false;
let autosaveQueued = false;

function requestAutosave() {
  if (!fs.folderHandle || !state) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => doAutosave(), 600);
}

async function doAutosave() {
  if (!fs.folderHandle || !state) return;
  if (autosaveInFlight) { autosaveQueued = true; return; }
  autosaveInFlight = true; autosaveQueued = false;
  try {
    await saveJsonToFolder();
    setDirty(false);
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saved)";
  } catch (e) {
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (save failed)";
  } finally {
    autosaveInFlight = false;
    if (autosaveQueued) { autosaveQueued = false; doAutosave(); }
  }
}

/* ===================== WIRE ===================== */
function wire() {
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const authUser = document.getElementById("authUser");
  const authPass = document.getElementById("authPass");

  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      const username = (authUser?.value || "omaggi").trim();
      const password = (authPass?.value || "").trim();
      if (!password) { alert("Inserisci la password"); return; }
      await portalLogin(username, password);
      refreshAuthUI(); render();
    });
  }
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try { if (window.sb?.auth) await window.sb.auth.signOut(); } catch(e){}
      clearPortalSession(); refreshAuthUI(); render();
    });
  }
  if (authPass) {
    authPass.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") { e.preventDefault(); btnLogin?.click(); }
    });
  }

  if (els.btnOpenFolder) els.btnOpenFolder.addEventListener("click", openCatalogueFolder);

  els.stockUnknownExpiry.addEventListener("change", () => {
    if (els.stockUnknownExpiry.checked) {
      els.stockExpiry.value = ""; els.stockExpiry.disabled = true;
    } else { els.stockExpiry.disabled = false; }
  });

  els.btnLoad.addEventListener("click", () => els.filePicker.click());
  els.filePicker.addEventListener("change", loadJsonFromPicker);

  els.btnCatCancel.addEventListener("click", () => { ui.editingCategoryId = null; els.catDlg.close(); });
  els.btnProdCancel.addEventListener("click", () => { ui.editingProductId = null; els.prodDlg.close(); });

  els.btnSave.addEventListener("click", async () => {
    if (supabaseClient) { await portalSaveCatalogue(); return; }
    if (!state) return;
    if (fs.folderHandle) {
      await saveJsonToFolder(); setDirty(false);
      if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saved)";
      alert("Saved to data/catalogue.json");
    } else { downloadJSON(state, "catalogue.json"); }
  });

  els.search.addEventListener("input", () => { ui.search = els.search.value.trim(); render(); });

  els.btnAddCategory.addEventListener("click", () => openCategoryDlg(null));
  els.btnAddProduct.addEventListener("click", () => openProductDlg(null));

  els.catSearch.addEventListener("input", () => {
    ui.catSearch = els.catSearch.value.toLowerCase();
    renderCategories();
  });

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
    ui.editingCategoryId = null; els.catDlg.close(); setDirty(true); render();
  });

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
      p.name = name; p.ctSize = ctSize; p.customsCode = customsCode; p.unitWeightKg = unitWeightKg;
      p.categoryIds = selectedCategoryIds; delete p.categoryId;
      p.wordings = wordings; p.codes = codes; p.notes = notes; p.imageFileName = imageFileName;
      p.lots = normalizeLots(p.lots);
    } else {
      state.products.push({
        id: uid("prod"), name, ctSize, customsCode, unitWeightKg,
        categoryIds: selectedCategoryIds, wordings, codes, notes, imageFileName, lots: [],
      });
    }
    ui.editingProductId = null; els.prodDlg.close(); setDirty(true); render();
  });

  els.btnProdDuplicate.addEventListener("click", () => duplicateProductFromDialog());

  els.btnStockAdd.addEventListener("click", () => adjustStock(+1));
  els.btnStockWithdraw.addEventListener("click", () => adjustStock(-1));
  els.btnStockOrder.addEventListener("click", () => createOrder());
  attachDMYMask(els.stockExpiry);

  if (els.cartShipDate) { els.cartShipDate.value = formatDateDMY(todayISO()); attachDMYMask(els.cartShipDate); }
  els.btnClearCart?.addEventListener("click", clearShipmentCart);
  els.btnCreateShipment?.addEventListener("click", createShipmentFromCart);
  els.btnCartPdf?.addEventListener("click", () => exportShipmentDraftPDF(buildShipmentDraftFromCart(false)));
  els.btnCartExcel?.addEventListener("click", () => exportShipmentDraftExcel(buildShipmentDraftFromCart(false)));
  els.btnCartDhl?.addEventListener("click", () => exportDHLList(buildShipmentDraftFromCart(false)));

  els.btnPickImage.addEventListener("click", () => els.imgFilePicker.click());
  els.btnClearImage.addEventListener("click", () => {
    els.prodImageFileName.value = ""; els.imgHint.textContent = "Image cleared.";
    renderProductPreview(null); setDirty(true);
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
    } catch (e) { alert("Could not set image: " + (e?.message || e)); }
  });

  if (els.btnShipments) els.btnShipments.addEventListener("click", openShipmentHistoryDlg);
  if (els.btnExportExcel) els.btnExportExcel.addEventListener("click", exportCatalogueExcel);
  if (els.btnShipExport) els.btnShipExport.addEventListener("click", exportCatalogueExcel);
  if (els.btnShipCancel) els.btnShipCancel.addEventListener("click", () => els.shipDlg.close());
  if (els.btnShipHistClose) els.btnShipHistClose.addEventListener("click", () => els.shipHistDlg.close());
  if (els.shipHistSearch) els.shipHistSearch.addEventListener("input", renderShipmentHistory);
  if (els.shipForm) els.shipForm.addEventListener("submit", onShipSubmit);
  if (els.shipDate) attachDMYMask(els.shipDate);

  // Import Excel
  const btnImportExcel = document.getElementById("btnImportExcel");
  const importExcelPicker = document.getElementById("importExcelPicker");
  if (btnImportExcel && importExcelPicker) {
    btnImportExcel.addEventListener("click", () => importExcelPicker.click());
    importExcelPicker.addEventListener("change", () => {
      const file = importExcelPicker.files?.[0];
      importExcelPicker.value = "";
      if (!file) return;
      importCatalogueFromExcel(file);
    });
  }

  setEnabled(false);
  if (els.fileNote) els.fileNote.textContent = "Loading…";
}

/* Folder mode */
async function openCatalogueFolder() {
  if (!window.showDirectoryPicker) { alert("Folder mode not supported. Use Chrome/Edge."); return; }
  try {
    const dir = await window.showDirectoryPicker({ id: "catalogueFolder", mode: "readwrite", startIn: "documents" });
    fs.folderHandle = dir;
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (loading…)";
    await loadJsonFromFolder();
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (ready)";
  } catch {}
}

async function loadJsonFromFolder() {
  if (!fs.folderHandle) return;
  const dataDir = await fs.folderHandle.getDirectoryHandle("data", { create: false });
  const fileHandle = await dataDir.getFileHandle(fs.jsonFileName, { create: false });
  const file = await fileHandle.getFile();
  const obj = JSON.parse(await file.text());
  validateAndNormalize(obj);
  state = obj; loadedFileName = "data/catalogue.json (folder mode)";
  ui.selectedCategoryId = "__all__"; ui.search = ""; els.search.value = "";
  setEnabled(true); setDirty(false); render();
  if (els.fileNote) els.fileNote.textContent = "📁 Folder: data/catalogue.json";
}

async function saveJsonToFolder() {
  if (!fs.folderHandle || !state) return;
  const dataDir = await fs.folderHandle.getDirectoryHandle("data", { create: true });
  const fileHandle = await dataDir.getFileHandle(fs.jsonFileName, { create: true });
  const writable = await fileHandle.createWritable();
  const clean = JSON.parse(JSON.stringify(state)); delete clean._dirty;
  await writable.write(JSON.stringify(clean, null, 2)); await writable.close();
}

async function loadJsonFromPicker() {
  const file = els.filePicker.files?.[0];
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    validateAndNormalize(obj);
    state = obj; loadedFileName = file.name;
    ui.selectedCategoryId = "__all__"; ui.search = ""; els.search.value = "";
    setEnabled(true); setDirty(false); render();
  } catch (e) { alert("Failed to load JSON: " + (e?.message || "Unknown error")); }
  finally { els.filePicker.value = ""; }
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

let supabaseAutosaveTimer = null;

function requestSupabaseAutosave() {
  if (!supabaseClient || !isAdmin() || !state) return;
  if (supabaseAutosaveTimer) clearTimeout(supabaseAutosaveTimer);
  supabaseAutosaveTimer = setTimeout(async () => {
    try {
      const { error } = await supabaseClient
        .from("catalogue")
        .upsert({ id: CATALOGUE_ROW_ID, data: state, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (!error) {
        setDirtyUI(false);
        if (els.fileNote) els.fileNote.textContent = (loadedFileName ? `📂 ${loadedFileName}` : "Loaded.") + " • ✓ Saved";
      }
    } catch(e) { console.warn("Autosave failed:", e); }
  }, 800);
}

function setDirty(isDirty) {
  if (!state) return;
  state._dirty = !!isDirty;
  if (els.fileNote) {
    els.fileNote.textContent =
      (loadedFileName ? `📂 ${loadedFileName}` : "Loaded.")
      + (isDirty ? " • ⚠ Saving…" : " • ✓ Saved");
  }
  if (isDirty && fs.folderHandle) {
    if (els.folderStatus) els.folderStatus.textContent = "Folder mode: ON (saving…)";
    requestAutosave();
  }
  if (isDirty && supabaseClient) {
    requestSupabaseAutosave();
  }
}



function validateAndNormalize(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Invalid JSON format");
  obj.version = 1;
  obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
  obj.products = Array.isArray(obj.products) ? obj.products : [];
  obj.shipments = Array.isArray(obj.shipments) ? obj.shipments : [];
  for (const c of obj.categories) { if (!c.id) c.id = uid("cat"); if (!c.name) c.name = "Unnamed"; }
  obj.shipments = normalizeShipmentRecords(obj.shipments);
  for (const p of obj.products) {
    if (!p.id) p.id = uid("prod");
    if (!p.name) p.name = "Unnamed product";
    if (Array.isArray(p.categoryIds)) p.categoryIds = p.categoryIds.filter(Boolean);
    else if (typeof p.categoryId === "string" && p.categoryId.trim()) p.categoryIds = [p.categoryId.trim()];
    else p.categoryIds = [];
    delete p.categoryId;
    p.wordings = Array.isArray(p.wordings) ? p.wordings : [];
    p.codes = Array.isArray(p.codes) ? p.codes : [];
    p.notes = p.notes || "";
    p.customsCode = p.customsCode || inferCustomsCodeForProduct(p, obj.categories);
    p.unitWeightKg = Number(p.unitWeightKg || 0) || "";
    p.imageFileName = p.imageFileName || "";
    p.ctSize = (p.ctSize !== undefined && p.ctSize !== null && p.ctSize > 0) ? Number(p.ctSize) : null;
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
  const specials = [
    { id: "__all__", name: "All products", icon: "🏪" },
    { id: "__in__", name: "✅ In stock (Usable)", icon: "" },
    { id: "__low__", name: "⚠️ Low stock (<10)", icon: "" },
    { id: "__out__", name: "❌ Out of stock (0)", icon: "" },
    { id: "__exp__", name: "⏳ Expiring / Expired", icon: "" }
  ];
  for (const s of specials) els.categoryList.appendChild(catRow(s, true));

  const cats = (state.categories || [])
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .filter(c => c.name.toLowerCase().includes(ui.catSearch));

  if (cats.length > 0) {
    const hr = document.createElement("div"); hr.className = "catSeparator";
    els.categoryList.appendChild(hr);
  }
  for (const c of cats) els.categoryList.appendChild(catRow(c, false));
  if (ui.catSearch && cats.length === 0) {
    const note = document.createElement("div"); note.className = "smallNote";
    note.style.textAlign = "center"; note.textContent = "No matches";
    els.categoryList.appendChild(note);
  }
}

function catRow(cat, pseudo) {
  const row = document.createElement("div");
  row.className = "cat" + (ui.selectedCategoryId === cat.id ? " active" : "");
  const name = document.createElement("div");
  name.className = "catName"; name.textContent = cat.name;
  const btns = document.createElement("div"); btns.className = "catBtns";
  if (!pseudo) {
    const edit = document.createElement("button");
    edit.className = "btn small ghost"; edit.textContent = "Edit";
    edit.addEventListener("click", (e) => { e.stopPropagation(); openCategoryDlg(cat.id); });
    const del = document.createElement("button");
    del.className = "btn small ghost danger"; del.textContent = "Del";
    del.addEventListener("click", (e) => { e.stopPropagation(); deleteCategory(cat.id); });
    btns.append(edit, del);
  }
  row.append(name, btns);
  row.addEventListener("click", () => { ui.selectedCategoryId = cat.id; render(); });
  return row;
}

function renderFilterLine() {
  let label = "";
  if (ui.selectedCategoryId === "__all__") label = "All products";
  else if (ui.selectedCategoryId === "__in__") label = "In stock (Usable)";
  else if (ui.selectedCategoryId === "__low__") label = "Low stock (1–10)";
  else if (ui.selectedCategoryId === "__out__") label = "Out of stock";
  else if (ui.selectedCategoryId === "__exp__") label = "Expiring / Expired";
  else label = state.categories.find(c => c.id === ui.selectedCategoryId)?.name || "Uncategorized";

  if (els.filterLine) els.filterLine.innerHTML = `Filter: <strong>${label}</strong>${ui.search ? ` &nbsp;·&nbsp; Search: "<em>${ui.search}</em>"` : ""}`;
}

function renderProducts() {
  const list = filteredProducts();
  els.productGrid.innerHTML = "";
  els.empty.hidden = list.length !== 0;

  const countEl = document.getElementById("resultsCount");
  if (countEl) countEl.textContent = `${list.length} product${list.length !== 1 ? "s" : ""}`;

  for (const p of list) els.productGrid.appendChild(productCard(p));
}

function filteredProducts() {
  const q = ui.search.toLowerCase();
  return state.products
    .filter(p => {
      if (ui.selectedCategoryId === "__all__") return true;
      const t = totalStock(p);
      if (ui.selectedCategoryId === "__in__") {
        if (totalStock(p) <= 0) return false;
        return normalizeLots(p.lots).filter(l => {
          if (l.qty <= 0) return false;
          const s = lotStatus(l.expiry);
          return s !== "expired" && s !== "expiring";
        }).length > 0;
      }
      if (ui.selectedCategoryId === "__low__") return t > 0 && t < 10;
      if (ui.selectedCategoryId === "__out__") return t === 0;
      if (ui.selectedCategoryId === "__exp__") {
        return normalizeLots(p.lots).filter(l => l.qty > 0).some(l => {
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
      return hay.includes(q);
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
    img.src = imgPath; img.alt = p.name; img.style.display = "block"; empty.style.display = "none";
    img.onerror = () => { img.style.display = "none"; empty.style.display = "flex"; empty.textContent = "Image missing"; };
  } else {
    img.style.display = "none"; empty.style.display = "flex"; empty.textContent = "";
  }

  node.querySelector(".pName").textContent = p.name;
  const names = (p.categoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean);
  node.querySelector(".pCat").textContent = names.length ? names.join(", ") : "Uncategorized";

  const total = totalStock(p);
  const stockTotalEl = node.querySelector(".stockTotal");
  let dotsContainer = null;
  if (stockTotalEl) {
    stockTotalEl.textContent = total > 0 ? `In stock: ${total}` : "Out of stock";
    stockTotalEl.className = "stockTotal" + (total === 0 ? " stock-zero" : total < 10 ? " stock-low" : "");
    dotsContainer = document.createElement("div"); dotsContainer.className = "statusDots";
    stockTotalEl.style.display = "flex"; stockTotalEl.style.alignItems = "center";
    stockTotalEl.appendChild(dotsContainer);
  }

  const ctContainer = node.querySelector("#ctPillContainer");
  if (ctContainer) {
    ctContainer.innerHTML = "";
    if (total > 0 && p.ctSize && p.ctSize > 0) {
      const cts = calculateCTs(p);
      if (cts.full > 0) ctContainer.appendChild(createCtPill(cts.full, "full"));
      if (cts.partial > 0) ctContainer.appendChild(createCtPill(cts.partial, "partial"));
    }
  }

  // Card coloring
  cardEl.classList.remove("cardLow","cardExpiring","cardExpired","cardRisky","cardOut","cardOrdered");
  const realLots = (p.lots || []).filter(l => !l.ordered && l.qty > 0);
  const orderedLotsOnly = (p.lots || []).filter(l => l.ordered && l.qty > 0);
  const statusesReal = realLots.map(l => lotStatus(l.expiry));
  const totalReal = realLots.reduce((s, l) => s + l.qty, 0);
  const totalOrdered = orderedLotsOnly.reduce((s, l) => s + l.qty, 0);
  const hasOrdered = totalOrdered > 0;

  if (hasOrdered && totalReal === 0) cardEl.classList.add("cardOrdered");
  else if (totalReal > 0) {
    const hasExpired = statusesReal.includes("expired"), hasExpiring = statusesReal.includes("expiring"),
          hasRisky = statusesReal.includes("risky"), hasOk = statusesReal.includes("ok");
    if (hasOk) { if (totalReal < 10) cardEl.classList.add("cardLow"); }
    else {
      if (hasExpired) cardEl.classList.add("cardExpired");
      else if (hasExpiring) cardEl.classList.add("cardExpiring");
      else if (hasRisky) cardEl.classList.add("cardRisky");
      else if (totalReal < 10) cardEl.classList.add("cardLow");
    }
  } else cardEl.classList.add("cardOut");

  // Status dots
  if (dotsContainer) {
    dotsContainer.innerHTML = "";
    const isOut = cardEl.classList.contains("cardOut");
    const isExpired = cardEl.classList.contains("cardExpired");
    const isExpiring = cardEl.classList.contains("cardExpiring");
    const isOrderedOnly = cardEl.classList.contains("cardOrdered");
    const isRiskyCard = cardEl.classList.contains("cardRisky");
    const hasExpiredReal = statusesReal.includes("expired"), hasExpiringReal = statusesReal.includes("expiring"),
          hasRiskyReal = statusesReal.includes("risky");

    if (!isOut && !isExpired && !isExpiring && !isOrderedOnly) {
      if (isRiskyCard) { if (hasExpiringReal) addDot(dotsContainer, "expiring", "Has expiring lots"); }
      else {
        if (hasExpiredReal) addDot(dotsContainer, "expired", "Has expired lots");
        if (hasExpiringReal) addDot(dotsContainer, "expiring", "Has expiring lots");
        if (hasRiskyReal) addDot(dotsContainer, "risky", "Has risky lots");
      }
      if (totalReal > 0 && hasOrdered) addDot(dotsContainer, "ordered", "Ordered stock pending");
    }
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
    setDirty(true); render();
  });

  return node;
}

function addDot(container, cls, title) {
  const d = document.createElement("span");
  d.className = `dot ${cls}`; d.title = title;
  container.appendChild(d);
}

/* Dialogs */
function openCategoryDlg(id) {
  ui.editingCategoryId = id;
  if (id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    els.catTitle.textContent = "Edit category"; els.catName.value = c.name;
  } else { els.catTitle.textContent = "Add category"; els.catName.value = ""; }
  els.catDlg.showModal(); setTimeout(() => els.catName.focus(), 50);
}

function deleteCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  const used = state.products.some(p => (p.categoryIds || []).includes(id));
  const msg = used ? `Delete category "${c.name}"? Products in it will become Uncategorized.` : `Delete category "${c.name}"?`;
  if (!confirm(msg)) return;
  state.categories = state.categories.filter(x => x.id !== id);
  for (const p of state.products) p.categoryIds = (p.categoryIds || []).filter(cid => cid !== id);
  if (ui.selectedCategoryId === id) ui.selectedCategoryId = "__all__";
  setDirty(true); render();
}

function openProductDlg(id) {
  ui.editingProductId = id;
  els.prodCategoriesBox.innerHTML = "";
  const cats = state.categories.slice().sort((a,b) => a.name.localeCompare(b.name));
  for (const c of cats) {
    const label = document.createElement("label"); label.className = "checkItem";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = c.id; cb.style.width = "auto";
    const text = document.createElement("span"); text.textContent = c.name;
    label.append(cb, text); els.prodCategoriesBox.appendChild(label);
  }
  if (id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    els.prodTitle.textContent = "✏ Edit product";
    els.prodName.value = p.name;
    $("#prodCtSize").value = p.ctSize || "";
    if (els.prodCustomsCode) els.prodCustomsCode.value = p.customsCode || "";
    if (els.prodUnitWeightKg) els.prodUnitWeightKg.value = p.unitWeightKg || "";
    const selectedIds = Array.isArray(p.categoryIds) ? p.categoryIds : (p.categoryId ? [p.categoryId] : []);
    for (const cb of els.prodCategoriesBox.querySelectorAll('input[type="checkbox"]')) cb.checked = selectedIds.includes(cb.value);
    els.prodWordings.value = (p.wordings || []).join("\n"); els.prodCodes.value = (p.codes || []).join("\n");
    els.prodNotes.value = p.notes || ""; els.prodImageFileName.value = p.imageFileName || "";
    renderProductPreview(p);
  } else {
    els.prodTitle.textContent = "+ Add product";
    els.prodName.value = ""; $("#prodCtSize").value = "";
    if (els.prodCustomsCode) els.prodCustomsCode.value = "";
    if (els.prodUnitWeightKg) els.prodUnitWeightKg.value = "";
    if (state.categories.some(c => c.id === ui.selectedCategoryId)) {
      const cb = els.prodCategoriesBox.querySelector(`input[value="${ui.selectedCategoryId}"]`);
      if (cb) cb.checked = true;
    }
    els.prodWordings.value = ""; els.prodCodes.value = ""; els.prodNotes.value = ""; els.prodImageFileName.value = "";
    renderProductPreview(null);
  }
  els.prodDlg.showModal(); setTimeout(() => els.prodName.focus(), 50);
}

function renderProductPreview(p) {
  els.imgPreview.innerHTML = "";
  const fileName = (p?.imageFileName || "").trim();
  if (!fileName) { els.imgPreview.textContent = "No image"; return; }
  const img = document.createElement("img");
  img.src = `media/${fileName}`; img.alt = "Image";
  img.onerror = () => { els.imgPreview.textContent = "Image missing"; };
  els.imgPreview.appendChild(img);
}

/* Stock */
function openStockDlg(productId) {
  ui.stockProductId = productId;
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  els.stockMsg.textContent = ""; els.stockExpiry.value = ""; els.stockQty.value = "1";
  const sel = $("#stockUnitSelector");
  if (sel) sel.style.display = p.ctSize && p.ctSize > 0 ? "" : "none";
  if (sel && !(p.ctSize && p.ctSize > 0)) sel.value = "units";
  attachDMYMask(els.stockExpiry);
  renderLots(p);
  els.stockDlg.showModal();
}

function renderLots(p) {
  els.lotList.innerHTML = "";
  const total = totalStock(p);
  let stockText = `${p.name} — Total: ${total}`;
  if (total > 0 && p.ctSize) {
    const cts = calculateCTs(p);
    stockText += ` (${cts.full} Full CT, ${cts.partial} Partial CT)`;
  }
  els.stockHeader.textContent = stockText;
  const lots = normalizeLots(p.lots).sort((a, b) => a.expiry.localeCompare(b.expiry)).filter(l => l.qty > 0);
  if (!lots.length) {
    const d = document.createElement("div"); d.className = "smallNote";
    d.textContent = "No stock yet. Add with an expiry date."; els.lotList.appendChild(d); return;
  }
  for (const l of lots) {
    const isOrdered = !!l.ordered;
    const st = lotStatus(l.expiry);
    const row = document.createElement("div");
    let rowClass = "lotRow";
    if (isOrdered) rowClass += " lotOrdered";
    else if (st === "expired") rowClass += " lotExpired";
    else if (st === "expiring") rowClass += " lotExpiring";
    else if (st === "risky") rowClass += " lotRisky";
    row.className = rowClass;

    const meta = document.createElement("div"); meta.className = "lotMeta";
    const main = document.createElement("div"); main.className = "lotMain";
    const qtyLine = document.createElement("div"); qtyLine.className = "lotQtyBig";
    qtyLine.textContent = `Qty: ${l.qty}`;
    if (p.ctSize) {
      const full = Math.floor(l.qty / p.ctSize), rem = l.qty % p.ctSize;
      if (full > 0) qtyLine.appendChild(createCtPill(full, "full"));
      if (rem > 0) qtyLine.appendChild(createCtPill(1, "partial"));
    }
    const dateLine = document.createElement("div"); dateLine.className = "lotDateSmall";
    dateLine.textContent = formatDateDMY(l.expiry);
    const tag = document.createElement("span"); tag.className = "lotTag";
    tag.textContent = isOrdered ? "ORDERED" : st.toUpperCase();
    dateLine.appendChild(tag);
    main.append(qtyLine, dateLine); meta.appendChild(main);

    const btns = document.createElement("div"); btns.style.cssText = "display:flex;gap:5px;flex-wrap:wrap;";
    const del = document.createElement("button"); del.className = "btn small danger"; del.textContent = "DEL";
    del.onclick = (e) => {
      e.preventDefault();
      p.lots = (p.lots || []).filter(x => !(x.expiry === l.expiry && !!x.ordered === isOrdered));
      setDirty(true); render(); openStockDlg(p.id);
    };
    if (isOrdered) {
      const received = document.createElement("button"); received.className = "btn small received"; received.textContent = "✓ Received";
      received.onclick = (e) => { e.preventDefault(); receiveOrderedLot(p, l); };
      btns.append(received, del);
    } else {
      const plus = document.createElement("button"); plus.className = "btn small"; plus.textContent = "+";
      plus.onclick = (e) => {
        e.preventDefault(); els.stockExpiry.value = formatDateDMY(l.expiry); els.stockQty.value = "1"; adjustStock(+1);
      };
      const minus = document.createElement("button"); minus.className = "btn small danger"; minus.textContent = "−";
      minus.onclick = (e) => {
        e.preventDefault(); els.stockExpiry.value = formatDateDMY(l.expiry); els.stockQty.value = "1"; adjustStock(-1);
      };
      btns.append(plus, minus, del);
    }
    row.append(meta, btns); els.lotList.appendChild(row);
  }
}

function receiveOrderedLot(p, lot) {
  if (!p || !lot) return;
  const expiryISO = lot.expiry; const qty = Number(lot.qty || 0);
  p.lots = (p.lots || []).filter(l => !(l.ordered && l.expiry === expiryISO));
  els.stockExpiry.value = formatDateDMY(expiryISO); els.stockQty.value = String(qty);
  const unitSel = $("#stockUnitSelector");
  if (unitSel) unitSel.value = "units";
  adjustStock(+1);
  els.stockMsg.textContent = `Received ${qty} for ${formatDateDMY(expiryISO)}.`;
}

function adjustStock(dir) {
  const p = state.products.find(x => x.id === ui.stockProductId);
  if (!p) return;
  const expiryText = (els.stockExpiry.value || "").trim();
  let qty = Number(els.stockQty.value);
  const unitMode = $("#stockUnitSelector").value;
  if (unitMode === "ct") {
    if (!p.ctSize || p.ctSize <= 0) { els.stockMsg.textContent = "This product has no CT size defined."; return; }
    qty = qty * p.ctSize;
  }
  let expiryISO;
  if (els.stockUnknownExpiry.checked) expiryISO = "__unknown__";
  else {
    expiryISO = parseDMYToISO(expiryText);
    if (!expiryISO) { els.stockMsg.textContent = "Enter a valid date as DD/MM/YYYY (e.g. 08/02/2026)."; return; }
  }
  if (!Number.isInteger(qty) || qty <= 0) { els.stockMsg.textContent = "Quantity must be a whole number ≥ 1."; return; }
  p.lots = normalizeLots(p.lots);
  let lot = p.lots.find(l => l.expiry === expiryISO && !l.ordered);
  if (dir > 0) {
    if (lot) lot.qty += qty; else p.lots.push({ expiry: expiryISO, qty });
    els.stockMsg.textContent = `✅ Added ${qty} to ${formatDateDMY(expiryISO)}.`;
  } else {
    if (!lot) { els.stockMsg.textContent = `No lot for ${formatDateDMY(expiryISO)}.`; return; }
    if (lot.qty < qty) { els.stockMsg.textContent = `Cannot withdraw ${qty}. Only ${lot.qty} available.`; return; }
    lot.qty -= qty; els.stockMsg.textContent = `Withdrew ${qty} from ${formatDateDMY(expiryISO)}.`;
  }
  p.lots = normalizeLots(p.lots).filter(l => l.qty > 0);
  setDirty(true); els.stockHeader.textContent = `${p.name} — Total: ${totalStock(p)}`;
  renderLots(p); render();
}

/* More info */
function openInfoDlg(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  els.infoTitle.textContent = `${p.name}`;
  const catNames = (Array.isArray(p.categoryIds) ? p.categoryIds : []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean);
  let ctInfo = ""; if (p.ctSize && p.ctSize > 0) ctInfo = ` • CT Size: ${p.ctSize} units`;
  els.infoSub.textContent = `Category: ${catNames.length ? catNames.join(", ") : "Uncategorized"}${ctInfo}`;
  els.infoWordings.textContent = (p.wordings?.length ? p.wordings.join("\n") : "—");
  els.infoCodes.textContent = (p.codes?.length ? p.codes.join("\n") : "—");
  els.infoLots.innerHTML = "";
  const lots = normalizeLots(p.lots).filter(l => l.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!lots.length) { els.infoLots.textContent = "No lots."; }
  else {
    for (const l of lots) {
      const st = lotStatus(l.expiry);
      const row = document.createElement("div"); row.className = "lotItem";
      if (st === "expired") row.classList.add("lotExpired");
      else if (st === "expiring") row.classList.add("lotExpiring");
      else if (st === "risky") row.classList.add("lotRisky");
      const left = document.createElement("div"); left.className = "lotMain";
      const qtyLine = document.createElement("div"); qtyLine.className = "lotQtyBig";
      qtyLine.style.cssText = "display:flex;align-items:center;gap:6px;";
      qtyLine.textContent = `Qty: ${l.qty}`;
      if (p.ctSize && p.ctSize > 0) {
        const full = Math.floor(l.qty / p.ctSize), rem = l.qty % p.ctSize;
        if (full > 0) qtyLine.appendChild(createCtPill(full, "full"));
        if (rem > 0) qtyLine.appendChild(createCtPill(1, "partial"));
      }
      const dateLine = document.createElement("div"); dateLine.className = "lotDateSmall";
      const dateText = document.createElement("span"); dateText.textContent = formatDateDMY(l.expiry);
      const tag = document.createElement("span"); tag.className = "lotTag";
      if (st === "expired") tag.textContent = "EXPIRED";
      else if (st === "expiring") tag.textContent = "EXPIRING";
      else if (st === "risky") tag.textContent = "RISKY";
      else tag.textContent = "OK";
      dateLine.append(dateText, tag); left.append(qtyLine, dateLine);
      row.append(left, document.createElement("div")); els.infoLots.appendChild(row);
    }
  }
  els.infoDlg.showModal();
}

function openShipmentHistoryDlg() {
  if (!state) return;
  renderShipmentHistory();
  els.shipHistDlg.showModal();
}

/* Helpers */
function uid(prefix) { return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }
function splitLines(text) { return (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

function normalizeLots(lots) {
  const map = new Map();
  for (const l of (lots || [])) {
    const expiry = String(l.expiry || "").trim(); if (!expiry) continue;
    const qty = Math.max(0, Math.trunc(Number(l.qty) || 0));
    const ordered = !!l.ordered;
    const key = `${expiry}|${ordered ? 1 : 0}`;
    const prev = map.get(key);
    map.set(key, { expiry, qty: (prev?.qty || 0) + qty, ordered });
  }
  return [...map.values()];
}

function totalStock(p) { return normalizeLots(p.lots).reduce((s, l) => s + l.qty, 0); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function lotStatus(expiryISO) {
  if (!expiryISO || expiryISO === "__unknown__") return "ok";
  const now = new Date(); const exp = new Date(expiryISO);
  if (exp < now) return "expired";
  const diff = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
  if (diff <= 3) return "expiring"; if (diff <= 4) return "risky"; return "ok";
}

function duplicateProductFromDialog() {
  if (!state) return;
  const name = (els.prodName.value || "").trim();
  if (!name) { alert("Give the product a name first (then duplicate)."); return; }
  const selectedCategoryIds = els.prodCategoriesBox
    ? Array.from(els.prodCategoriesBox.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  const newProduct = {
    id: uid("prod"), name, categoryIds: selectedCategoryIds,
    wordings: splitLines(els.prodWordings.value), codes: splitLines(els.prodCodes.value),
    notes: (els.prodNotes?.value || "").trim(), imageFileName: (els.prodImageFileName.value || "").trim(), lots: [],
  };
  state.products ||= []; state.products.push(newProduct);
  setDirty(true); ui.editingProductId = null; els.prodDlg.close();
  openProductDlg(newProduct.id);
}

function parseDMYToISO(dmy) {
  const s = (dmy || "").trim();
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4,"0")}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  const test = new Date(`${iso}T00:00:00`);
  if (isNaN(test.getTime()) || test.getFullYear() !== yyyy || test.getMonth()+1 !== mm || test.getDate() !== dd) return null;
  return iso;
}

function formatDateDMY(iso) {
  if (iso === "__unknown__") return "Unknown";
  if (!iso || typeof iso !== "string" || iso.length < 10) return iso || "";
  const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`;
}

function attachDMYMask(input) {
  input.addEventListener("input", () => {
    const start = input.selectionStart; const old = input.value;
    let digits = old.replace(/\D/g, "").slice(0, 8);
    let f = "";
    if (digits.length <= 2) f = digits;
    else if (digits.length <= 4) f = digits.slice(0,2) + "/" + digits.slice(2);
    else f = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4);
    const diff = f.length - old.length;
    input.value = f; input.setSelectionRange(start + diff, start + diff);
  });
}

function downloadJSON(obj, filename) {
  const clean = JSON.parse(JSON.stringify(obj)); delete clean._dirty;
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  setDirty(false);
  alert("Saved as download.\n\nReplace data/catalogue.json with the downloaded file.");
}

function createOrder() {
  const p = state.products.find(x => x.id === ui.stockProductId);
  if (!p) return;
  const expiryText = (els.stockExpiry.value || "").trim();
  const qtyRaw = Number(els.stockQty.value);
  let expiryISO;
  if (els.stockUnknownExpiry.checked) expiryISO = "__unknown__";
  else { expiryISO = parseDMYToISO(expiryText); if (!expiryISO) { els.stockMsg.textContent = "Enter a valid date (DD/MM/YYYY)."; return; } }
  if (!Number.isInteger(qtyRaw) || qtyRaw <= 0) { els.stockMsg.textContent = "Quantity must be whole number ≥ 1."; return; }
  let qty = qtyRaw;
  const mode = $("#stockUnitSelector")?.value;
  if (mode === "ct") { if (!p.ctSize || p.ctSize <= 0) { els.stockMsg.textContent = "CT mode not available."; return; } qty = qty * p.ctSize; }
  p.lots.push({ expiry: expiryISO, qty, ordered: true });
  els.stockMsg.textContent = `📋 Ordered ${qty} for ${formatDateDMY(expiryISO)}.`;
  setDirty(true); renderLots(p); render();
}

function availableStock(p) { return normalizeLots((p?.lots || []).filter(l => !l.ordered)).reduce((s, l) => s + l.qty, 0); }

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
    const take = Math.min(lot.qty, remaining); lot.qty -= take; remaining -= take;
  }
  p.lots = normalizeLots((p.lots || []).filter(l => l.qty > 0 || l.ordered));
  return remaining === 0;
}

function onShipSubmit(e) {
  e.preventDefault();
  const p = state.products.find(x => x.id === ui.shipProductId);
  if (!p) return;
  const dateISO = parseDMYToISO(els.shipDate.value || '') || todayISO();
  const qty = Math.max(0, Math.trunc(Number(els.shipQty.value) || 0));
  if (qty < 1) { alert('Quantity must be at least 1.'); return; }
  const available = availableStock(p);
  if (qty > available) { alert(`Available stock is ${available}.`); return; }
  const ok = withdrawFromLots(p, qty);
  if (!ok) { alert('Could not register shipment.'); return; }
  state.shipments.unshift({
    id: uid('ship'), date: dateISO, productId: p.id, productName: p.name, qty,
    destination: (els.shipDestination.value || '').trim(), recipient: (els.shipRecipient.value || '').trim(),
    reference: (els.shipReference.value || '').trim(), notes: (els.shipNotes.value || '').trim(),
    createdAt: new Date().toISOString()
  });
  els.shipDlg.close(); setDirty(true); render(); renderShipmentHistory();
}

/* =================== SHIPMENT CART =================== */
function getLotKey(expiry) { return String(expiry || "__unknown__"); }

function addProductToShipmentCart(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const firstLot = sortedRealLotsForShipping(p).find(l => l.qty > 0);
  if (!firstLot) { alert("No available stock lots for this product."); return; }
  const existing = shipmentCart.find(it => it.productId === productId && getLotKey(it.lotExpiry) === getLotKey(firstLot.expiry) && it.unitMode === "units");
  if (existing) existing.qty += 1;
  else shipmentCart.push({ id: uid("cart"), productId: p.id, productName: p.name, lotExpiry: firstLot.expiry, unitMode: "units", qty: 1 });
  renderShipmentCart();
}

function clearShipmentCart() { shipmentCart = []; renderShipmentCart(); }

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
  if (item.unitMode === "ct" && p.ctSize > 0) return `${Math.floor(units / p.ctSize)} CT (${units} units)`;
  return `${units} units`;
}

function cartItemRequestedUnits(item) {
  const p = state.products.find(x => x.id === item.productId);
  const qty = Math.max(1, Math.trunc(Number(item.qty) || 1));
  if (item.unitMode === "ct") { if (!p?.ctSize) return 0; return qty * p.ctSize; }
  return qty;
}

function buildLotOptionsHtml(p, selectedExpiry) {
  const lots = sortedRealLotsForShipping(p).filter(l => l.qty > 0);
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

  // Update badge
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = shipmentCart.length;

  if (!shipmentCart.length) {
    box.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span>Cart empty.<br>Use <b>Add to cart</b> on a product card.</div>`;
    if (els.shipmentCartSummary) els.shipmentCartSummary.textContent = "No products in cart.";
    updateCartOverview(0, 0);
    return;
  }

  let totalUnits = 0, totalCt = 0;

  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) continue;
    const row = document.createElement("div"); row.className = "cart-item shipmentCartItem";
    const unitOptions = [`<option value="units" ${item.unitMode !== "ct" ? 'selected' : ''}>Units</option>`];
    if (p.ctSize && p.ctSize > 0) unitOptions.push(`<option value="ct" ${item.unitMode === "ct" ? 'selected' : ''}>Boxes / CT</option>`);
    const fileName = (p.imageFileName || '').trim();
    const imgHtml = fileName ? `<img class="shipmentCartThumbImg" src="media/${escapeHtml(fileName)}" alt="${escapeHtml(item.productName)}" onerror="this.closest('.shipmentCartThumb').classList.add('is-empty');this.remove()">` : '';
    const thumbClass = fileName ? 'shipmentCartThumb' : 'shipmentCartThumb is-empty';

    row.innerHTML = `
      <div class="shipmentCartItemTop">
        <div class="${thumbClass}">${imgHtml}<span>${fileName ? '' : '📦'}</span></div>
        <div class="shipmentCartMain">
          <div class="shipmentCartItemHead">
            <div>
              <div class="shipmentCartItemName">${escapeHtml(item.productName)}</div>
              <div class="shipmentCartItemSub">${p.ctSize ? `CT: ${p.ctSize}` : 'No CT'}${item.unitMode === 'ct' ? ' · boxes mode' : ' · units mode'}</div>
            </div>
            <button class="btn small ghost danger" type="button" data-cart-act="remove">✕</button>
          </div>
          <div class="shipmentCartGrid">
            <label class="row"><span>Lot</span><select data-cart-act="lot">${buildLotOptionsHtml(p, item.lotExpiry)}</select></label>
            <label class="row"><span>Mode</span><select data-cart-act="mode">${unitOptions.join('')}</select></label>
            <label class="row"><span>Qty</span><input data-cart-act="qty" type="number" min="1" step="1" value="${Math.max(1,Math.trunc(Number(item.qty)||1))}"></label>
            <div class="cartMiniBtns">
              <button class="btn small ghost" type="button" data-cart-act="minus">−</button>
              <button class="btn small" type="button" data-cart-act="plus">+</button>
            </div>
          </div>
          <div class="shipmentCartMeta" data-cart-meta></div>
        </div>
      </div>`;

    const lotSel = row.querySelector('[data-cart-act="lot"]');
    const modeSel = row.querySelector('[data-cart-act="mode"]');
    const qtyInp = row.querySelector('[data-cart-act="qty"]');
    const meta = row.querySelector('[data-cart-meta]');

    function syncMeta() {
      const availableUnits = shipmentItemAvailableUnits(item);
      const requestedUnits = cartItemRequestedUnits(item);
      const status = requestedUnits > availableUnits ? '⚠ Not enough stock.' : '✓ Ready';
      let extra = `Avail: ${shipmentItemAvailableDisplay(item)} · Req: ${requestedUnits} units`;
      if (p.ctSize) { const ct = requestedUnits / p.ctSize; extra += ` · ${ct % 1 === 0 ? ct.toFixed(0) : ct.toFixed(2)} CT`; }
      meta.textContent = `${extra} · ${status}`;
      meta.classList.toggle('is-error', requestedUnits > availableUnits);
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
    qtyInp.addEventListener("input", () => { item.qty = Math.max(1, Math.trunc(Number(qtyInp.value) || 1)); syncMeta(); updateCartOverview(); });
    row.querySelector('[data-cart-act="plus"]').addEventListener("click", () => { item.qty = Math.max(1, Math.trunc(Number(item.qty)||1)) + 1; renderShipmentCart(); });
    row.querySelector('[data-cart-act="minus"]').addEventListener("click", () => { item.qty = Math.max(1, Math.trunc(Number(item.qty)||1) - 1); renderShipmentCart(); });
    row.querySelector('[data-cart-act="remove"]').addEventListener("click", () => { shipmentCart = shipmentCart.filter(x => x.id !== item.id); renderShipmentCart(); });

    syncMeta();
    const requestedUnits = cartItemRequestedUnits(item);
    totalUnits += requestedUnits;
    if (p.ctSize) totalCt += requestedUnits / p.ctSize;
    box.appendChild(row);
  }

  if (els.shipmentCartSummary) els.shipmentCartSummary.textContent = `${shipmentCart.length} line${shipmentCart.length !== 1 ? 's' : ''} · ${totalUnits} units total`;
  updateCartOverview(totalUnits, totalCt);
}

function updateCartOverview(totalUnits, totalCt) {
  if (totalUnits == null) {
    totalUnits = 0; totalCt = 0;
    for (const item of shipmentCart) {
      const p = state.products.find(x => x.id === item.productId); if (!p) continue;
      const units = cartItemRequestedUnits(item); totalUnits += units;
      if (p.ctSize) totalCt += units / p.ctSize;
    }
  }
  const lines = shipmentCart.length;
  const ctLabel = Number.isFinite(totalCt) ? (Math.round(totalCt * 100) / 100).toString() : '0';
  // Update new stat elements
  const sL = document.getElementById("statLines"), sU = document.getElementById("statUnits"), sC = document.getElementById("statCT");
  if (sL) sL.textContent = lines; if (sU) sU.textContent = totalUnits; if (sC) sC.textContent = ctLabel;
  const badge = document.getElementById("cartBadge"); if (badge) badge.textContent = lines;
}

function buildShipmentDraftFromCart(requireValidation = true) {
  const dateISO = parseDMYToISO(els.cartShipDate?.value || '') || todayISO();
  const destination = (els.cartDestination?.value || '').trim();
  const recipient = (els.cartRecipient?.value || '').trim();
  const reference = (els.cartReference?.value || '').trim();
  const notes = (els.cartNotes?.value || '').trim();
  const extraUE = !!els.cartExtraUE?.checked;
  const items = []; const errors = [];
  for (const item of shipmentCart) {
    const p = state.products.find(x => x.id === item.productId); if (!p) continue;
    const lot = normalizeLots((p.lots || []).filter(l => !l.ordered)).find(l => getLotKey(l.expiry) === getLotKey(item.lotExpiry));
    const availableUnits = Math.max(0, Math.trunc(Number(lot?.qty) || 0));
    const requestedUnits = cartItemRequestedUnits(item);
    if (requireValidation) {
      if (!lot) errors.push(`${p.name}: selected lot not found.`);
      else if (requestedUnits > availableUnits) errors.push(`${p.name}: requested ${requestedUnits}, available ${availableUnits}.`);
      if (item.unitMode === "ct" && (!p.ctSize || p.ctSize <= 0)) errors.push(`${p.name}: CT size missing.`);
    }
    items.push({
      productId: p.id, productName: p.name, lotExpiry: item.lotExpiry,
      unitMode: item.unitMode === "ct" ? "ct" : "units",
      qty: Math.max(1, Math.trunc(Number(item.qty) || 1)), unitsQty: requestedUnits,
      customsCode: p.customsCode || "", unitWeightKg: Number(p.unitWeightKg || 0) || 0
    });
  }
  return { id: formatShipmentFileName(dateISO), date: dateISO, destination, recipient, reference, notes, extraUE, createdAt: new Date().toISOString(), items, errors };
}

function getNextShipmentNumber() {
  const all = normalizeShipmentRecords(state.shipments || []);
  // Count how many shipments share the same date as today
  const todayStr = todayISO();
  const todayShipments = all.filter(s => s.date === todayStr);
  return todayShipments.length + 1;
}

function formatShipmentFileName(dateISO) {
  // Format: GGMMAA-N (e.g. 100326-1)
  const d = new Date(dateISO + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  const n = getNextShipmentNumber();
  return `${dd}${mm}${yy}-${n}`;
}


  let remaining = Math.max(0, Math.trunc(Number(qtyNeeded) || 0)); if (!remaining) return true;
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
  if (draft.errors.length) { alert(draft.errors.join("\n")); return; }
  for (const item of draft.items) {
    const p = state.products.find(x => x.id === item.productId); if (!p) continue;
    if (!withdrawFromSpecificLot(p, item.lotExpiry, item.unitsQty)) { alert(`Could not withdraw stock for ${item.productName}.`); return; }
  }
  state.shipments.unshift({ id: draft.id, date: draft.date, destination: draft.destination, recipient: draft.recipient, reference: draft.reference, notes: draft.notes, extraUE: draft.extraUE, createdAt: draft.createdAt, items: draft.items });
  setDirty(true);
  exportShipmentDraftPDF(draft); exportShipmentDraftExcel(draft);
  if (draft.extraUE) exportDHLList(draft);
  shipmentCart = []; render(); renderShipmentHistory();
}

/* Shipment history */
function normalizeShipmentRecords(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map(s => {
    const items = Array.isArray(s.items) && s.items.length
      ? s.items.map(it => ({ productId: it.productId || s.productId || "", productName: it.productName || s.productName || "", lotExpiry: it.lotExpiry || "__unknown__", unitMode: it.unitMode === "ct" ? "ct" : "units", qty: Math.max(1, Math.trunc(Number(it.qty) || Number(s.qty) || 1)), unitsQty: Math.max(1, Math.trunc(Number(it.unitsQty) || Number(it.qty) || Number(s.qty) || 1)) }))
      : [{ productId: s.productId || "", productName: s.productName || "", lotExpiry: s.lotExpiry || "__unknown__", unitMode: s.unitMode === "ct" ? "ct" : "units", qty: Math.max(1, Math.trunc(Number(s.qty) || 1)), unitsQty: Math.max(1, Math.trunc(Number(s.unitsQty) || Number(s.qty) || 1)) }];
    return { id: s.id || uid("ship"), date: s.date || todayISO(), destination: s.destination || "", recipient: s.recipient || "", reference: s.reference || "", notes: s.notes || "", extraUE: !!s.extraUE, createdAt: s.createdAt || new Date().toISOString(), items };
  });
}

function shipmentItemsText(s) {
  return (Array.isArray(s.items) ? s.items : []).map(it => {
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
        <td>${s.extraUE ? '✅ Yes' : 'No'}</td>
        <td class="shipDel">
          <div class="shipRowActions">
            <button class="btn small ghost" type="button" data-act="pdf">📄 PDF</button>
            <button class="btn small ghost" type="button" data-act="edit">✏ Edit</button>
            ${s.extraUE ? '<button class="btn small ghost" type="button" data-act="dhl">🚚 DHL</button>' : ''}
            ${isAdmin() ? '<button class="btn small ghost danger" type="button" data-act="del">🗑 Del</button>' : ''}
          </div>
        </td>`;
      tr.querySelector('[data-act="pdf"]')?.addEventListener('click', () => exportShipmentFromHistory(s.id, 'pdf'));
      tr.querySelector('[data-act="edit"]')?.addEventListener('click', () => editShipment(s.id));
      tr.querySelector('[data-act="dhl"]')?.addEventListener('click', () => exportShipmentFromHistory(s.id, 'dhl'));
      tr.querySelector('[data-act="del"]')?.addEventListener('click', () => deleteShipment(s.id));
      els.shipHistBody.appendChild(tr);
    }
  }
  if (els.shipHistCount) els.shipHistCount.textContent = `${rows.length} shipment${rows.length === 1 ? '' : 's'}`;
}

function deleteShipment(id) {
  if (!isAdmin()) return;
  if (!confirm('Delete this shipment record?')) return;
  const shipment = normalizeShipmentRecords(state.shipments).find(x => x.id === id);
  if (shipment) {
    const restoreStock = confirm('Vuoi aggiornare lo stock?\n\nSì = i prodotti della spedizione vengono rimessi in stock.\nNo = la spedizione viene cancellata senza modifiche allo stock.');
    if (restoreStock) restoreShipmentToStock(shipment);
  }
  state.shipments = normalizeShipmentRecords(state.shipments).filter(x => x.id !== id);
  setDirty(true); renderShipmentHistory();
}

function restoreShipmentToStock(shipment) {
  for (const item of (shipment?.items || [])) {
    const p = state.products.find(x => x.id === item.productId); if (!p) continue;
    p.lots = normalizeLots(p.lots || []);
    let lot = p.lots.find(l => !l.ordered && getLotKey(l.expiry) === getLotKey(item.lotExpiry));
    if (!lot) { lot = { expiry: item.lotExpiry || '', qty: 0, ordered: false }; p.lots.push(lot); }
    lot.qty = Math.max(0, Math.trunc(Number(lot.qty)||0)) + Math.max(0, Math.trunc(Number(item.unitsQty)||0));
    p.lots = normalizeLots(p.lots);
  }
}

function loadShipmentIntoCart(shipment) {
  shipmentCart = (shipment?.items || []).map(it => ({ id: uid("cart"), productId: it.productId, productName: it.productName, lotExpiry: it.lotExpiry || '', unitMode: it.unitMode === "ct" ? "ct" : "units", qty: Math.max(1, Math.trunc(Number(it.qty)||1)) }));
  if (els.cartShipDate) els.cartShipDate.value = formatDateDMY(shipment?.date || todayISO());
  if (els.cartDestination) els.cartDestination.value = shipment?.destination || '';
  if (els.cartRecipient) els.cartRecipient.value = shipment?.recipient || '';
  if (els.cartReference) els.cartReference.value = shipment?.reference || '';
  if (els.cartNotes) els.cartNotes.value = shipment?.notes || '';
  if (els.cartExtraUE) els.cartExtraUE.checked = !!shipment?.extraUE;
  renderShipmentCart();
}

function editShipment(id) {
  if (!isAdmin()) return;
  const shipment = normalizeShipmentRecords(state.shipments).find(x => x.id === id);
  if (!shipment) return;
  if (!confirm('Load this shipment back into the cart for editing?')) return;
  const restoreStock = confirm('Vuoi aggiornare lo stock?\n\nSì = i prodotti della spedizione vengono rimessi in stock.\nNo = la spedizione viene caricata nel carrello senza modifiche allo stock.');
  if (restoreStock) restoreShipmentToStock(shipment);
  state.shipments = normalizeShipmentRecords(state.shipments).filter(x => x.id !== id);
  loadShipmentIntoCart(shipment);
  setDirty(true); render(); renderShipmentHistory();
  els.shipHistDlg?.close();
  document.querySelector('.cart-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportShipmentFromHistory(id, kind = 'pdf') {
  const shipment = normalizeShipmentRecords(state.shipments).find(x => x.id === id);
  if (!shipment) return;
  if (kind === 'pdf') exportShipmentDraftPDF(shipment);
  else if (kind === 'excel') exportShipmentDraftExcel(shipment);
  else if (kind === 'dhl') exportDHLList(shipment);
}

/* Import catalogue from Excel */
function importCatalogueFromExcel(file) {
  if (!isAdmin()) { alert("Admin login required to import."); return; }
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const sheet = wb.Sheets['Products'];
      if (!sheet) { alert('Sheet "Products" not found in the Excel file.\nMake sure to upload the file exported by "Export Excel".'); return; }
      const rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows.length) { alert('No product rows found in sheet "Products".'); return; }

      let imported = 0, updated = 0;
      for (const row of rows) {
        const name = (row['Product'] || '').trim();
        if (!name) continue;
        // Find categories by name
        const catNames = (row['Categories'] || '').split(',').map(s => s.trim()).filter(Boolean);
        const categoryIds = catNames.map(n => {
          let cat = state.categories.find(c => c.name === n);
          if (!cat) { cat = { id: uid('cat'), name: n }; state.categories.push(cat); }
          return cat.id;
        });
        let p = state.products.find(x => x.name === name);
        if (p) {
          // Update existing product fields (keep lots/stock intact)
          p.categoryIds = categoryIds.length ? categoryIds : p.categoryIds;
          if (row['CTSize'] !== undefined && row['CTSize'] !== '') p.ctSize = parseInt(row['CTSize']) || null;
          if (row['CustomsCode']) p.customsCode = String(row['CustomsCode']).trim();
          if (row['UnitWeightKg'] !== undefined && row['UnitWeightKg'] !== '') p.unitWeightKg = Number(row['UnitWeightKg']) || '';
          if (row['Image']) p.imageFileName = String(row['Image']).trim();
          if (row['Wordings'] !== undefined) p.wordings = row['Wordings'] ? String(row['Wordings']).split('|').map(s=>s.trim()).filter(Boolean) : p.wordings;
          if (row['Codes'] !== undefined) p.codes = row['Codes'] ? String(row['Codes']).split('|').map(s=>s.trim()).filter(Boolean) : p.codes;
          if (row['Notes'] !== undefined) p.notes = String(row['Notes'] || '').trim();
          updated++;
        } else {
          state.products.push({
            id: uid('prod'), name, categoryIds,
            ctSize: parseInt(row['CTSize']) || null,
            customsCode: String(row['CustomsCode'] || '').trim(),
            unitWeightKg: Number(row['UnitWeightKg'] || 0) || '',
            imageFileName: String(row['Image'] || '').trim(),
            wordings: row['Wordings'] ? String(row['Wordings']).split('|').map(s=>s.trim()).filter(Boolean) : [],
            codes: row['Codes'] ? String(row['Codes']).split('|').map(s=>s.trim()).filter(Boolean) : [],
            notes: String(row['Notes'] || '').trim(),
            lots: []
          });
          imported++;
        }
      }
      setDirty(true); render();
      alert(`✅ Import completato!\n${imported} prodotti aggiunti, ${updated} prodotti aggiornati.`);
    } catch(err) {
      alert('Errore durante l\'import: ' + (err?.message || err));
    }
  };
  reader.readAsBinaryString(file);
}


  if (!state) return;
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const products = (state.products || []).slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => ({
    Product: p.name, Categories: (p.categoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean).join(', '),
    Stock: totalStock(p), AvailableStock: availableStock(p), CTSize: p.ctSize || '', CustomsCode: p.customsCode || '',
    UnitWeightKg: p.unitWeightKg || '', Image: p.imageFileName || '', Wordings: (p.wordings || []).join(' | '), Codes: (p.codes || []).join(' | '), Notes: p.notes || ''
  }));
  const lots = [];
  for (const p of (state.products || [])) for (const l of normalizeLots(p.lots || [])) lots.push({ Product: p.name, Expiry: l.expiry === '__unknown__' ? 'Unknown' : l.expiry, Qty: l.qty, Ordered: l.ordered ? 'Yes' : 'No', Status: l.ordered ? 'Ordered' : lotStatus(l.expiry) });
  const shipments = [];
  for (const s of normalizeShipmentRecords(state.shipments)) for (const it of s.items) shipments.push({ Date: s.date, ShipmentID: s.id, Product: it.productName, Lot: it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry, Mode: it.unitMode, Qty: it.qty, UnitsQty: it.unitsQty, Destination: s.destination, Recipient: s.recipient, Reference: s.reference, Notes: s.notes, ExtraUE: s.extraUE ? 'Yes' : 'No' });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.length ? products : [{Info:'No products'}]), 'Products');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lots.length ? lots : [{Info:'No lots'}]), 'Lots');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipments.length ? shipments : [{Info:'No shipments'}]), 'Shipments');
  XLSX.writeFile(wb, `campionature_${todayISO()}.xlsx`);
}

function exportShipmentDraftExcel(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
  const wb = XLSX.utils.book_new();
  const rows = draft.items.map(it => ({ ShipmentID: draft.id, Date: draft.date, Product: it.productName, Lot: it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry, Mode: it.unitMode, Qty: it.qty, UnitsQty: it.unitsQty, Destination: draft.destination, Recipient: draft.recipient, Reference: draft.reference, Notes: draft.notes, ExtraUE: draft.extraUE ? 'Yes' : 'No' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Shipment');
  XLSX.writeFile(wb, `${draft.id}.xlsx`);
}

function exportShipmentDraftPDF(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  const jspdfNs = window.jspdf;
  if (!jspdfNs?.jsPDF) { alert("PDF library not loaded."); return; }
  const doc = new jspdfNs.jsPDF(); let y = 16;
  doc.setFontSize(16); doc.text(`Shipment ${draft.id}`, 14, y); y += 8;
  doc.setFontSize(11);
  [`Date: ${draft.date}`, `Destination: ${draft.destination || '-'}`, `Recipient: ${draft.recipient || '-'}`, `Reference: ${draft.reference || '-'}`, `Notes: ${draft.notes || '-'}`, `Extra UE / DHL: ${draft.extraUE ? 'Yes' : 'No'}`].forEach(line => { doc.text(line, 14, y); y += 6; });
  y += 2;
  draft.items.forEach((it, i) => {
    [`${i+1}. ${it.productName}`, `   Lot: ${it.lotExpiry === '__unknown__' ? 'Unknown' : it.lotExpiry}`, `   Mode: ${it.unitMode}   Qty: ${it.qty}   Units: ${it.unitsQty}`].forEach(line => {
      if (y > 280) { doc.addPage(); y = 16; } doc.text(line, 14, y); y += 6;
    }); y += 2;
  });
  doc.save(`${draft.id}.pdf`);
}

function exportDHLList(draft) {
  if (!draft || !draft.items?.length) { alert("Cart is empty."); return; }
  const text = draft.items.map(it => [`${it.customsCode || 'missing'}`, `BALCONI [${it.productName}]`, `[${it.unitWeightKg || 'missing'}]`].join('\n')).join('\n\n');
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${draft.id}_DHL_List.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* Misc helpers */
function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

function calculateCTs(p) {
  let full = 0, partial = 0;
  if (!p.ctSize || p.ctSize <= 0) return { full, partial };
  (p.lots || []).forEach(l => { const q = parseInt(l.qty) || 0; if (q <= 0) return; full += Math.floor(q / p.ctSize); if (q % p.ctSize > 0) partial += 1; });
  return { full, partial };
}

function createCtPill(count, type) {
  const span = document.createElement("span");
  span.className = `ct-pill ${type === 'full' ? 'ct-pill-full' : 'ct-pill-partial'}`;
  span.textContent = `${count} CT`; return span;
}

function inferCustomsCodeForProduct(p, categories = []) {
  const names = [p?.name || '', ...(Array.isArray(p?.categoryIds) ? p.categoryIds.map(id => categories.find(c => c.id === id)?.name || '') : [])].join(' ').toLowerCase();
  if (names.includes('wafer')) return '19053219';
  if (names.includes('biscotti') || names.includes('biscuit')) return '19053119';
  if (names.includes('savoiardi')) return '19059080';
  return '19059070';
}

function sanitizeFileName(name) { return (name || "").trim().replace(/[\\/:*?\"<>|]+/g, "_") || "image"; }
function splitBaseExt(name) { const n = name || ""; const i = n.lastIndexOf("."); if (i <= 0) return { base: n, ext: "" }; return { base: n.slice(0, i), ext: n.slice(i) }; }

async function copyPickedImageToMedia(file) {
  if (!fs.folderHandle) throw new Error("Folder mode not enabled.");
  const mediaDir = await fs.folderHandle.getDirectoryHandle("media", { create: true });
  const original = sanitizeFileName(file.name || "image");
  const { base, ext } = splitBaseExt(original);
  let candidate = `${base}${ext}`;
  for (let n = 1; n < 500; n++) {
    try { await mediaDir.getFileHandle(candidate, { create: false }); candidate = `${base}_${n}${ext}`; } catch { break; }
  }
  const outHandle = await mediaDir.getFileHandle(candidate, { create: true });
  const writable = await outHandle.createWritable();
  await writable.write(await file.arrayBuffer()); await writable.close();
  return candidate;
}

/* ===================== BOOTSTRAP ===================== */
(async function bootstrap() {
  document.addEventListener("DOMContentLoaded", () => {
    initSupabase(); wire();
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
      validateAndNormalize(obj); state = obj; loadedFileName = 'catalogue.json';
      setEnabled(true); setDirty(false); render(); refreshAuthUI();
      if (els.fileNote) els.fileNote.textContent = "📂 catalogue.json (local)";
    } catch (e) { console.warn('Fallback catalogue load failed', e); if (els.fileNote) els.fileNote.textContent = "⚠ No catalogue loaded"; }
  }
  window.sb = supabaseClient;
})();
