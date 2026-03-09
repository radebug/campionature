const $ = (s) => document.querySelector(s);

const els = {
  search: $("#search"),
  catSearch: $("#catSearch"),
  categoryList: $("#categoryList"),
  filterLine: $("#filterLine"),
  productGrid: $("#productGrid"),
  empty: $("#empty"),
  filePicker: $("#filePicker"),
  btnSaveJson: $("#btnSaveJson"),
  btnHistory: $("#btnHistory"),
  btnHistoryClose: $("#btnHistoryClose"),
  historyDlg: $("#historyDlg"),
  historyList: $("#historyList"),
  historySearch: $("#historySearch"),
  btnExportHistory: $("#btnExportHistory"),
  cartList: $("#cartList"),
  cartInfo: $("#cartInfo"),
  cartPanel: $("#cartPanel"),
  btnToggleCart: $("#btnToggleCart"),
  btnClearCart: $("#btnClearCart"),
  btnCreateShipment: $("#btnCreateShipment"),
  shipDate: $("#shipDate"),
  shipDestination: $("#shipDestination"),
  shipRecipient: $("#shipRecipient"),
  shipReference: $("#shipReference"),
  shipNotes: $("#shipNotes"),
  shipExtraUE: $("#shipExtraUE"),
  productCardTpl: $("#productCardTpl"),
  cartRowTpl: $("#cartRowTpl")
};

let state = null;
let ui = {
  selectedCategoryId: "__all__",
  search: "",
  catSearch: "",
  editingShipmentId: null
};
let shipmentCart = [];

function todayISO() { return new Date().toISOString().slice(0,10); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`; }
function safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function escapeHtml(s){ return String(s ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

function normalizeLots(lots){
  if (!Array.isArray(lots)) return [];
  return lots.map(l => ({
    expiry: l?.expiry || "__unknown__",
    qty: Math.max(0, Math.trunc(safeNum(l?.qty))),
    ordered: !!l?.ordered
  })).filter(l => l.qty > 0 || l.ordered);
}

function totalStock(product){
  return normalizeLots(product.lots).reduce((s,l) => s + (l.ordered ? 0 : l.qty), 0);
}

function availableLots(product){
  return normalizeLots(product.lots)
    .filter(l => !l.ordered && l.qty > 0)
    .sort((a,b) => {
      const ax = a.expiry === "__unknown__" ? "9999-12-31" : a.expiry;
      const bx = b.expiry === "__unknown__" ? "9999-12-31" : b.expiry;
      return ax.localeCompare(bx);
    });
}

function formatDateISO(iso){
  if (!iso || iso === "__unknown__") return "Unknown";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildCategoryName(product){
  const names = (product.categoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean);
  return names.join(", ") || "No category";
}

function getImagePath(product){ return product.imageFileName ? `media/${product.imageFileName}` : ""; }

function inferCustomsCode(product){
  const txt = `${product.name || ""} ${buildCategoryName(product)}`.toLowerCase();
  if (txt.includes("wafer")) return "19053219";
  if (txt.includes("biscotti") || txt.includes("biscuit")) return "19053119";
  if (txt.includes("savoiardi")) return "19059080";
  if (txt.includes("patatine")) return "20052020";
  return "19059070";
}

function buildShipmentCode(s){
  const date = (s.date || todayISO()).replaceAll("-", "");
  const sameDayCount = (state?.shipments || []).filter(x => (x.date || "") === s.date).length + 1;
  return `SHP-${date}-${String(sameDayCount).padStart(3, "0")}`;
}

function migrateShipmentRecord(s){
  s.id = s.id || uid("ship");
  s.date = s.date || todayISO();
  s.destination = s.destination || "";
  s.recipient = s.recipient || "";
  s.reference = s.reference || "";
  s.notes = s.notes || "";
  s.extraUE = !!s.extraUE;
  s.createdAt = s.createdAt || new Date().toISOString();
  if (!Array.isArray(s.items) || !s.items.length) {
    s.items = [{
      productId: s.productId || "",
      productName: s.productName || "",
      lotExpiry: s.lotExpiry || "__unknown__",
      unitMode: s.unitMode || "units",
      qty: Math.max(1, Math.trunc(safeNum(s.qty) || 1)),
      qtyUnits: Math.max(1, Math.trunc(safeNum(s.qtyUnits || s.qty) || 1)),
      ctSize: Math.max(1, Math.trunc(safeNum(s.ctSize) || 1)),
      customsCode: s.customsCode || "",
      unitWeightKg: s.unitWeightKg || ""
    }];
  }
  s.code = s.code || buildShipmentCode(s);
}

function saveJsonDownload(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "catalogue.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadDefaultCatalogue(){
  try {
    const res = await fetch("catalogue.json", {cache:"no-store"});
    const obj = await res.json();
    loadInitialCatalogue(obj);
  } catch (e) {
    loadInitialCatalogue({version:2,categories:[],products:[],shipments:[]});
  }
}

function loadInitialCatalogue(obj){
  state = obj && typeof obj === "object" ? obj : {};
  state.version = state.version || 2;
  state.categories = Array.isArray(state.categories) ? state.categories : [];
  state.products = Array.isArray(state.products) ? state.products : [];
  state.shipments = Array.isArray(state.shipments) ? state.shipments : [];

  for (const p of state.products) {
    p.categoryIds = Array.isArray(p.categoryIds) ? p.categoryIds : [];
    p.wordings = Array.isArray(p.wordings) ? p.wordings : [];
    p.codes = Array.isArray(p.codes) ? p.codes : [];
    p.notes = p.notes || "";
    p.ctSize = Math.max(1, Math.trunc(safeNum(p.ctSize) || 1));
    p.customsCode = p.customsCode || inferCustomsCode(p);
    p.unitWeightKg = p.unitWeightKg || "";
    p.lots = normalizeLots(p.lots);
  }
  for (const s of state.shipments) migrateShipmentRecord(s);
  writeShipmentToForm({date: todayISO()});
  render();
}

function bindEvents(){
  els.search.addEventListener("input", () => { ui.search = els.search.value.trim().toLowerCase(); renderProducts(); });
  els.catSearch.addEventListener("input", () => { ui.catSearch = els.catSearch.value.trim().toLowerCase(); renderCategories(); });
  els.btnSaveJson.addEventListener("click", saveJsonDownload);
  els.filePicker.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadInitialCatalogue(JSON.parse(text));
    e.target.value = "";
  });
  els.btnHistory.addEventListener("click", openHistory);
  els.btnHistoryClose.addEventListener("click", () => els.historyDlg.close());
  els.historySearch.addEventListener("input", renderHistory);
  els.btnExportHistory.addEventListener("click", exportHistoryExcel);
  els.btnToggleCart.addEventListener("click", () => {
    els.cartPanel.classList.toggle("collapsed");
    els.btnToggleCart.textContent = els.cartPanel.classList.contains("collapsed") ? "Open" : "Close";
  });
  els.btnClearCart.addEventListener("click", () => {
    if (!shipmentCart.length) return;
    if (!confirm("Clear current shipment cart?")) return;
    resetCart();
  });
  els.btnCreateShipment.addEventListener("click", saveShipmentFromCart);
}

function filteredProducts(){
  const q = ui.search;
  const cat = ui.selectedCategoryId;
  return state.products.filter(p => {
    if (cat !== "__all__" && !(p.categoryIds || []).includes(cat)) return false;
    if (!q) return true;
    const hay = [p.name, ...(p.wordings || []), ...(p.codes || []), p.notes].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function renderCategories(){
  const cats = state.categories.filter(c => !ui.catSearch || (c.name || "").toLowerCase().includes(ui.catSearch)).slice().sort((a,b) => a.name.localeCompare(b.name));
  const items = [{id:"__all__", name:"All"}].concat(cats);
  els.categoryList.innerHTML = "";
  for (const c of items){
    const div = document.createElement("div");
    div.className = "cat" + (ui.selectedCategoryId === c.id ? " active" : "");
    const count = c.id === "__all__" ? state.products.length : state.products.filter(p => (p.categoryIds || []).includes(c.id)).length;
    div.innerHTML = `<span>${c.name}</span><span class="smallNote">${count}</span>`;
    div.addEventListener("click", () => { ui.selectedCategoryId = c.id; renderCategories(); renderProducts(); });
    els.categoryList.appendChild(div);
  }
}

function renderProducts(){
  const rows = filteredProducts();
  els.productGrid.innerHTML = "";
  els.empty.hidden = rows.length > 0;
  const catLabel = ui.selectedCategoryId === "__all__" ? "All categories" : (state.categories.find(c => c.id === ui.selectedCategoryId)?.name || "Filtered");
  els.filterLine.textContent = `${rows.length} products • ${catLabel}`;
  for (const p of rows){
    const node = els.productCardTpl.content.cloneNode(true);
    node.querySelector(".pName").textContent = p.name;
    node.querySelector(".pCat").textContent = buildCategoryName(p);
    node.querySelector(".stockTotal").textContent = `Stock: ${totalStock(p)} units`;
    node.querySelector(".ctPill").textContent = `CT ${p.ctSize}`;
    const img = node.querySelector(".thumbImg");
    const empty = node.querySelector(".thumbEmpty");
    const src = getImagePath(p);
    if (src){
      img.src = src; img.style.display = ""; empty.hidden = true;
      img.onerror = () => { img.style.display = "none"; empty.hidden = false; };
    }
    node.querySelector('[data-act="add"]').addEventListener("click", () => addProductToCart(p.id));
    els.productGrid.appendChild(node);
  }
}

function cartItemDetails(item){
  const product = state.products.find(p => p.id === item.productId);
  if (!product) return null;
  const lots = availableLots(product);
  const selectedLot = lots.find(l => l.expiry === item.lotExpiry) || lots[0] || null;
  const ctSize = Math.max(1, Math.trunc(safeNum(product.ctSize) || 1));
  const qty = Math.max(1, Math.trunc(safeNum(item.qty) || 1));
  const unitMode = item.unitMode === "ct" ? "ct" : "units";
  const availableUnits = selectedLot ? selectedLot.qty : 0;
  const requestedUnits = unitMode === "ct" ? qty * ctSize : qty;
  const availableInMode = unitMode === "ct" ? Math.floor(availableUnits / ctSize) : availableUnits;
  return {product, lots, selectedLot, ctSize, qty, unitMode, availableUnits, requestedUnits, availableInMode};
}

function addProductToCart(productId){
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const lots = availableLots(product);
  if (!lots.length) { alert("No available lots for this product."); return; }
  shipmentCart.push({ productId, qty: 1, unitMode: "units", lotExpiry: lots[0].expiry });
  renderCart();
  if (window.innerWidth < 981) { els.cartPanel.classList.remove("collapsed"); els.btnToggleCart.textContent = "Close"; }
}

function updateCartItem(index, patch){ shipmentCart[index] = {...shipmentCart[index], ...patch}; renderCart(); }
function removeCartItem(index){ shipmentCart.splice(index, 1); renderCart(); }

function writeShipmentToForm(s){
  els.shipDate.value = s?.date || todayISO();
  els.shipDestination.value = s?.destination || "";
  els.shipRecipient.value = s?.recipient || "";
  els.shipReference.value = s?.reference || "";
  els.shipNotes.value = s?.notes || "";
  els.shipExtraUE.checked = !!s?.extraUE;
}

function readShipmentForm(){
  return {
    date: els.shipDate.value || todayISO(),
    destination: (els.shipDestination.value || "").trim(),
    recipient: (els.shipRecipient.value || "").trim(),
    reference: (els.shipReference.value || "").trim(),
    notes: (els.shipNotes.value || "").trim(),
    extraUE: !!els.shipExtraUE.checked
  };
}

function resetCart(){ shipmentCart = []; ui.editingShipmentId = null; writeShipmentToForm({date: todayISO()}); renderCart(); }

function renderCart(){
  els.cartList.innerHTML = "";
  const totalRows = shipmentCart.length;
  const totalUnits = shipmentCart.reduce((sum, item) => { const d = cartItemDetails(item); return sum + (d ? d.requestedUnits : 0); }, 0);
  els.cartInfo.textContent = totalRows ? `${totalRows} lines • ${totalUnits} units total` : "No products selected.";
  if (!shipmentCart.length){
    const div = document.createElement("div"); div.className = "empty"; div.textContent = "Add one or more products to prepare a shipment."; els.cartList.appendChild(div); return;
  }
  shipmentCart.forEach((item, index) => {
    const d = cartItemDetails(item); if (!d) return;
    const node = els.cartRowTpl.content.cloneNode(true);
    node.querySelector(".cartName").textContent = d.product.name;
    node.querySelector(".cartSub").textContent = `${buildCategoryName(d.product)} • Customs ${d.product.customsCode || "-"}`;
    const lotSel = node.querySelector(".cartLot");
    for (const lot of d.lots){
      const opt = document.createElement("option");
      opt.value = lot.expiry; opt.textContent = `${formatDateISO(lot.expiry)} • ${lot.qty} units`;
      if (lot.expiry === d.selectedLot?.expiry) opt.selected = true;
      lotSel.appendChild(opt);
    }
    lotSel.addEventListener("change", () => updateCartItem(index, {lotExpiry: lotSel.value}));
    const modeSel = node.querySelector(".cartMode");
    modeSel.value = d.unitMode; modeSel.addEventListener("change", () => updateCartItem(index, {unitMode: modeSel.value}));
    const qtyInput = node.querySelector(".cartQty");
    qtyInput.value = d.qty; qtyInput.addEventListener("change", () => updateCartItem(index, {qty: Math.max(1, parseInt(qtyInput.value || "1", 10) || 1)}));
    node.querySelector('[data-act="remove"]').addEventListener("click", () => removeCartItem(index));
    const availability = d.unitMode === "ct" ? `${d.availableInMode} CT available` : `${d.availableInMode} units available`;
    const requested = d.unitMode === "ct" ? `${d.qty} CT = ${d.requestedUnits} units` : `${d.qty} units`;
    const weight = d.product.unitWeightKg ? ` • ${(safeNum(d.product.unitWeightKg) * d.requestedUnits).toFixed(2)} kg` : "";
    node.querySelector(".cartSummary").textContent = `Lot: ${formatDateISO(d.selectedLot?.expiry)} • ${availability} • Requested: ${requested}${weight}`;
    els.cartList.appendChild(node);
  });
}

function validateCart(){
  if (!shipmentCart.length) { alert("Add at least one product."); return false; }
  for (const item of shipmentCart) {
    const d = cartItemDetails(item);
    if (!d || !d.selectedLot) { alert("Each line must have a valid lot."); return false; }
    if (d.requestedUnits > d.availableUnits) { alert(`${d.product.name}: lot ${formatDateISO(d.selectedLot.expiry)} has only ${d.availableUnits} units available.`); return false; }
  }
  return true;
}

function consumeLot(productId, lotExpiry, qtyUnits){
  const p = state.products.find(x => x.id === productId); if (!p) return false;
  const lot = (p.lots || []).find(l => !l.ordered && l.expiry === lotExpiry); if (!lot || lot.qty < qtyUnits) return false;
  lot.qty -= qtyUnits; p.lots = normalizeLots(p.lots); return true;
}

function restoreShipmentToStock(shipment){
  for (const item of (shipment.items || [])){
    const p = state.products.find(x => x.id === item.productId); if (!p) continue;
    const existing = (p.lots || []).find(l => !l.ordered && l.expiry === item.lotExpiry);
    if (existing) existing.qty += item.qtyUnits; else p.lots.push({expiry: item.lotExpiry || "__unknown__", qty: item.qtyUnits, ordered:false});
    p.lots = normalizeLots(p.lots);
  }
}

function saveShipmentFromCart(){
  if (!validateCart()) return;
  const meta = readShipmentForm();
  const shipment = {
    id: ui.editingShipmentId || uid("ship"),
    code: "",
    date: meta.date || todayISO(),
    destination: meta.destination,
    recipient: meta.recipient,
    reference: meta.reference,
    notes: meta.notes,
    extraUE: meta.extraUE,
    createdAt: new Date().toISOString(),
    items: shipmentCart.map(item => {
      const d = cartItemDetails(item);
      return {
        productId: d.product.id,
        productName: d.product.name,
        lotExpiry: d.selectedLot.expiry,
        unitMode: d.unitMode,
        qty: d.qty,
        qtyUnits: d.requestedUnits,
        ctSize: d.ctSize,
        customsCode: d.product.customsCode || "",
        unitWeightKg: d.product.unitWeightKg || ""
      };
    })
  };
  shipment.code = buildShipmentCode(shipment);

  if (ui.editingShipmentId) {
    const idx = state.shipments.findIndex(x => x.id === ui.editingShipmentId);
    if (idx >= 0) state.shipments[idx] = shipment; else state.shipments.unshift(shipment);
  } else {
    state.shipments.unshift(shipment);
  }

  for (const item of shipment.items){
    const ok = consumeLot(item.productId, item.lotExpiry, item.qtyUnits);
    if (!ok) { alert(`Could not consume lot for ${item.productName}.`); return; }
  }

  exportShipmentPdf(shipment);
  exportShipmentExcel(shipment);
  if (shipment.extraUE) exportShipmentDHL(shipment);
  resetCart(); render(); alert("Shipment saved.");
}

function filteredHistory(){
  const q = (els.historySearch.value || "").trim().toLowerCase();
  const rows = (state.shipments || []).slice().sort((a,b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
  if (!q) return rows;
  return rows.filter(s => {
    const itemsText = (s.items || []).map(i => [i.productName, i.lotExpiry].join(" ")).join(" ");
    const hay = [s.code, s.destination, s.recipient, s.reference, s.notes, itemsText].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function renderHistory(){
  const rows = filteredHistory(); els.historyList.innerHTML = "";
  if (!rows.length){ const div = document.createElement("div"); div.className = "empty"; div.textContent = "No shipments registered yet."; els.historyList.appendChild(div); return; }
  for (const s of rows){
    const div = document.createElement("div"); div.className = "histCard";
    const itemLines = (s.items || []).map(i => {
      const qtyText = i.unitMode === "ct" ? `${i.qty} CT (${i.qtyUnits} units)` : `${i.qty} units`;
      return `<div class="histItem"><b>${escapeHtml(i.productName)}</b> • Lot ${escapeHtml(formatDateISO(i.lotExpiry))} • ${qtyText}</div>`;
    }).join("");
    div.innerHTML = `
      <div class="histTop">
        <div>
          <div class="histCode">${escapeHtml(s.code || s.id)}</div>
          <div class="histMeta">${escapeHtml(formatDateISO(s.date))} • ${escapeHtml(s.destination || "-")} • ${escapeHtml(s.reference || "-")}</div>
        </div>
        <div class="histMeta">${s.extraUE ? "Extra UE" : ""}</div>
      </div>
      <div class="histItems">${itemLines}</div>
      <div class="histActions">
        <button class="btn small" data-act="edit" type="button">Edit</button>
        <button class="btn small ghost" data-act="pdf" type="button">PDF</button>
        <button class="btn small ghost" data-act="excel" type="button">Excel</button>
        <button class="btn small ghost" data-act="dhl" type="button">DHL list</button>
      </div>`;
    div.querySelector('[data-act="edit"]').addEventListener("click", () => editShipment(s.id));
    div.querySelector('[data-act="pdf"]').addEventListener("click", () => exportShipmentPdf(s));
    div.querySelector('[data-act="excel"]').addEventListener("click", () => exportShipmentExcel(s));
    div.querySelector('[data-act="dhl"]').addEventListener("click", () => exportShipmentDHL(s));
    els.historyList.appendChild(div);
  }
}

function openHistory(){ renderHistory(); els.historyDlg.showModal(); }

function editShipment(id){
  const s = state.shipments.find(x => x.id === id); if (!s) return;
  if (!confirm("Load this shipment back into the cart for editing? Current cart will be replaced.")) return;
  restoreShipmentToStock(s);
  state.shipments = state.shipments.filter(x => x.id !== id);
  ui.editingShipmentId = s.id;
  shipmentCart = (s.items || []).map(i => ({ productId: i.productId, lotExpiry: i.lotExpiry, unitMode: i.unitMode === "ct" ? "ct" : "units", qty: i.qty }));
  writeShipmentToForm(s); els.historyDlg.close(); render(); window.scrollTo({top:0, behavior:"smooth"});
}

function shipmentToRows(s){
  return (s.items || []).map(i => ({
    ShipmentCode: s.code || s.id,
    Date: s.date,
    Destination: s.destination,
    Recipient: s.recipient,
    Reference: s.reference,
    ExtraUE: s.extraUE ? "Yes" : "No",
    Product: i.productName,
    Lot: i.lotExpiry,
    Mode: i.unitMode,
    Qty: i.qty,
    QtyUnits: i.qtyUnits,
    CustomsCode: i.customsCode || "",
    UnitWeightKg: i.unitWeightKg || "",
    Notes: s.notes || ""
  }));
}

function exportHistoryExcel(){
  if (typeof XLSX === "undefined") { alert("Excel library not available."); return; }
  const wb = XLSX.utils.book_new();
  const rows = filteredHistory().flatMap(shipmentToRows);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{Info:"No shipments"}]), "Shipments");
  XLSX.writeFile(wb, "shipping_history.xlsx");
}

function exportShipmentExcel(s){
  if (typeof XLSX === "undefined") { alert("Excel library not available."); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipmentToRows(s)), "Shipment");
  XLSX.writeFile(wb, `${(s.code || "shipment").replace(/[^\w-]+/g,"_")}.xlsx`);
}

function shipmentPdfHtml(s){
  const items = (s.items || []).map(i => {
    const qtyText = i.unitMode === "ct" ? `${i.qty} CT (${i.qtyUnits} units)` : `${i.qty} units`;
    return `<tr><td>${escapeHtml(i.productName)}</td><td>${escapeHtml(formatDateISO(i.lotExpiry))}</td><td>${escapeHtml(qtyText)}</td><td>${escapeHtml(i.customsCode || "")}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(s.code || s.id)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:22px;margin:0 0 8px}.meta{margin-bottom:16px;color:#555;font-size:13px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body><h1>Shipment ${escapeHtml(s.code || s.id)}</h1><div class="meta">Date: ${escapeHtml(formatDateISO(s.date))}<br>Destination: ${escapeHtml(s.destination || "-")}<br>Recipient: ${escapeHtml(s.recipient || "-")}<br>Reference: ${escapeHtml(s.reference || "-")}<br>Extra UE: ${s.extraUE ? "Yes" : "No"}<br>Notes: ${escapeHtml(s.notes || "-")}</div><table><thead><tr><th>Product</th><th>Lot</th><th>Qty</th><th>Customs</th></tr></thead><tbody>${items}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`;
}

function exportShipmentPdf(s){
  const w = window.open("", "_blank"); if (!w) { alert("Popup blocked."); return; }
  w.document.open(); w.document.write(shipmentPdfHtml(s)); w.document.close();
}

function exportShipmentDHL(s){
  const lines = [];
  for (const i of (s.items || [])){
    lines.push(i.customsCode || "");
    lines.push(`BALCONI [${i.productName}]`);
    lines.push(`[${i.unitWeightKg || ""}]`);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(s.code || "shipment").replace(/[^\w-]+/g,"_")}_DHL.txt`;
  a.click(); URL.revokeObjectURL(a.href);
}

bindEvents();
loadDefaultCatalogue();
