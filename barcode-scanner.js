/* =====================================================================
   BARCODE SCANNER MODULE — Campionature
   Dipende da: state, isAdmin, openProductDlg, openStockDlg, totalStock,
               normalizeLots, lotStatus, formatDateDMY, setDirty, render,
               showAlert, showConfirm, uid, scheduleAutosave
   ===================================================================== */

(function () {
  /* ── helpers locali ── */
  function findProductByBarcode(barcode) {
    if (!state?.products) return null;
    return state.products.find(p =>
      Array.isArray(p.codes) && p.codes.some(c => c.trim() === barcode.trim())
    ) || null;
  }

  /* ── Overlay principale ── */
  function buildScannerUI() {
    if (document.getElementById('barcodeOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'barcodeOverlay';
    overlay.innerHTML = `
      <div class="bc-panel" id="bcPanel">
        <!-- Header -->
        <div class="bc-header">
          <span class="bc-title" id="bcTitle">📷 Barcode Scanner</span>
          <button class="bc-close" id="bcClose">✕</button>
        </div>

        <!-- Mode buttons -->
        <div class="bc-modes">
          <button class="bc-mode-btn active" data-mode="add">➕ Add Product</button>
          <button class="bc-mode-btn" data-mode="check">🔍 Check Stock</button>
          <button class="bc-mode-btn" data-mode="remove">➖ Remove Product</button>
        </div>

        <!-- Camera + manual input -->
        <div class="bc-cam-wrap">
          <video id="bcVideo" autoplay playsinline muted></video>
          <div class="bc-crosshair"></div>
          <canvas id="bcCanvas" hidden></canvas>
        </div>
        <div class="bc-manual-row">
          <input id="bcManualInput" type="text" placeholder="Or type / scan barcode here…" autocomplete="off" />
          <button class="btn primary" id="bcManualBtn">OK</button>
        </div>

        <!-- Result area -->
        <div class="bc-result" id="bcResult"></div>

        <!-- Remove session list -->
        <div id="bcRemoveSection" style="display:none">
          <div class="bc-remove-title">📋 Removed this session</div>
          <div id="bcRemoveList" class="bc-remove-list"></div>
          <div class="bc-remove-actions">
            <button class="btn ghost" id="bcUndoAll">↩ Undo all</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    attachScannerEvents(overlay);
  }

  /* ── State del scanner ── */
  let scanMode    = 'add';      // 'add' | 'check' | 'remove'
  let stream      = null;
  let scanLoop    = null;
  let lastBarcode = null;
  let removedItems = [];        // [{productId, productName, qty, expiry}]

  /* ── Apri / chiudi ── */
  function openScanner(mode) {
    buildScannerUI();
    scanMode = mode || 'add';
    lastBarcode = null;

    // aggiorna tab attivo
    document.querySelectorAll('.bc-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === scanMode);
    });
    updateModeTitle();

    document.getElementById('bcResult').innerHTML = '';
    document.getElementById('barcodeOverlay').style.display = 'flex';
    startCamera();
    renderRemoveList();
  }

  function closeScanner() {
    stopCamera();
    const ov = document.getElementById('barcodeOverlay');
    if (ov) ov.style.display = 'none';
    document.getElementById('bcResult').innerHTML = '';
  }

  /* ── Camera ── */
  async function startCamera() {
    stopCamera();
    const video = document.getElementById('bcVideo');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play();
      scheduleScanLoop();
    } catch (e) {
      showResult('⚠️ Camera not available: ' + e.message, 'warn');
    }
  }

  function stopCamera() {
    if (scanLoop) { clearInterval(scanLoop); scanLoop = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const video = document.getElementById('bcVideo');
    if (video) video.srcObject = null;
  }

  function scheduleScanLoop() {
    if (scanLoop) clearInterval(scanLoop);
    scanLoop = setInterval(grabFrame, 300);
  }

  async function grabFrame() {
    const video  = document.getElementById('bcVideo');
    const canvas = document.getElementById('bcCanvas');
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    if (!window.BarcodeDetector) return; // fallback: solo input manuale
    try {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code','data_matrix'] });
      const codes = await detector.detect(canvas);
      if (codes.length > 0) {
        const raw = codes[0].rawValue;
        if (raw !== lastBarcode) {
          lastBarcode = raw;
          handleBarcode(raw);
        }
      }
    } catch { /* silenzioso */ }
  }

  /* ── Gestione barcode ── */
  async function handleBarcode(barcode) {
    barcode = (barcode || '').trim();
    if (!barcode) return;

    const product = findProductByBarcode(barcode);

    if (scanMode === 'add') {
      await handleAdd(barcode, product);
    } else if (scanMode === 'check') {
      handleCheck(barcode, product);
    } else if (scanMode === 'remove') {
      await handleRemove(barcode, product);
    }
  }

  /* ── ADD ── */
  async function handleAdd(barcode, product) {
    if (product) {
      showResult(`✅ Product already exists: <b>${escHtml(product.name)}</b><br><small>Code: ${escHtml(barcode)}</small>`, 'ok');
      // offer to open edit dialog
      const resultEl = document.getElementById('bcResult');
      const editBtn = document.createElement('button');
      editBtn.className = 'btn small primary'; editBtn.style.marginTop = '8px';
      editBtn.textContent = '✏ Edit product';
      editBtn.onclick = () => { closeScanner(); openProductDlg(product.id); };
      resultEl.appendChild(document.createElement('br'));
      resultEl.appendChild(editBtn);
    } else {
      showResult(`🆕 New product — barcode: <b>${escHtml(barcode)}</b><br>Opening form…`, 'info');
      setTimeout(() => {
        closeScanner();
        // Pre-fill the product dialog with the scanned code
        openProductDlg(null);
        setTimeout(() => {
          const codesEl = document.getElementById('prodCodes');
          if (codesEl) codesEl.value = barcode;
          const nameEl = document.getElementById('prodName');
          if (nameEl) nameEl.focus();
        }, 120);
      }, 800);
    }
  }

  /* ── CHECK ── */
  function handleCheck(barcode, product) {
    if (!product) {
      showResult(`❓ Unknown barcode: <b>${escHtml(barcode)}</b><br><small>Product not found in catalogue.</small>`, 'warn');
      return;
    }
    const lots = normalizeLots(product.lots).filter(l => l.qty > 0)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    const total = totalStock(product);

    let html = `<div class="bc-check-name">${escHtml(product.name)}</div>`;
    html += `<div class="bc-check-total ${total === 0 ? 'stock-zero' : total < 10 ? 'stock-low' : ''}">
               Total stock: <b>${total}</b>
             </div>`;

    if (lots.length === 0) {
      html += `<div class="bc-lot-row">No stock in any lot.</div>`;
    } else {
      html += `<table class="bc-lot-table"><thead><tr><th>Expiry</th><th>Qty</th><th>Status</th></tr></thead><tbody>`;
      for (const l of lots) {
        const st = l.expiry === '__unknown__' ? 'unknown' : lotStatus(l.expiry);
        const stClass = { ok: 'bc-st-ok', risky: 'bc-st-risky', expiring: 'bc-st-expiring', expired: 'bc-st-expired', unknown: 'bc-st-unknown' }[st] || '';
        html += `<tr>
          <td>${l.expiry === '__unknown__' ? 'Unknown' : escHtml(formatDateDMY(l.expiry))}</td>
          <td>${l.qty}</td>
          <td><span class="bc-st-badge ${stClass}">${st.toUpperCase()}</span></td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }

    // Button to open full stock dialog
    html += `<button class="btn small primary bc-open-stock" style="margin-top:10px">📦 Manage Stock</button>`;
    showResult(html, 'ok');

    setTimeout(() => {
      const btn = document.querySelector('.bc-open-stock');
      if (btn) btn.onclick = () => { closeScanner(); openStockDlg(product.id); };
    }, 50);
  }

  /* ── REMOVE ── */
  async function handleRemove(barcode, product) {
    if (!product) {
      showResult(`❓ Unknown barcode: <b>${escHtml(barcode)}</b><br><small>Product not found in catalogue.</small>`, 'warn');
      return;
    }

    const lots = normalizeLots(product.lots).filter(l => l.qty > 0 && !l.ordered)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));

    if (lots.length === 0) {
      showResult(`⚠️ <b>${escHtml(product.name)}</b> has no stock to remove.`, 'warn');
      return;
    }

    // Show confirmation UI with lot picker
    const resultEl = document.getElementById('bcResult');
    let html = `<div class="bc-check-name">${escHtml(product.name)}</div>`;
    html += `<div style="margin-bottom:8px;font-size:13px;color:var(--text2)">Select lot and quantity to remove:</div>`;

    // Lot selector
    html += `<div class="bc-remove-form">
      <label class="bc-remove-label">Lot / Expiry
        <select id="bcRemoveLot" class="bc-select">`;
    for (const l of lots) {
      const label = l.expiry === '__unknown__' ? 'Unknown expiry' : formatDateDMY(l.expiry);
      html += `<option value="${escHtml(l.expiry)}">${escHtml(label)} — Qty: ${l.qty}</option>`;
    }
    html += `</select></label>
      <label class="bc-remove-label">Quantity
        <input type="number" id="bcRemoveQty" value="1" min="1" class="bc-number-input" />
      </label>
      <div class="bc-remove-btns">
        <button class="btn danger" id="bcConfirmRemove">🗑 Confirm Remove</button>
        <button class="btn ghost" id="bcCancelRemove">Cancel</button>
      </div>
    </div>`;

    showResult(html, 'warn');

    document.getElementById('bcCancelRemove').onclick = () => {
      showResult('', '');
      lastBarcode = null;
    };

    document.getElementById('bcConfirmRemove').onclick = async () => {
      const lotExpiry = document.getElementById('bcRemoveLot').value;
      let qty = parseInt(document.getElementById('bcRemoveQty').value, 10);
      if (isNaN(qty) || qty <= 0) { showResult('⚠️ Enter a valid quantity.', 'warn'); return; }

      const lot = (product.lots || []).find(l => l.expiry === lotExpiry && !l.ordered);
      if (!lot) { showResult('⚠️ Lot not found.', 'warn'); return; }
      if (qty > lot.qty) {
        showResult(`⚠️ Cannot remove ${qty}. Only ${lot.qty} available.`, 'warn'); return;
      }

      // Apply removal
      const originalQty = lot.qty;
      lot.qty -= qty;
      if (lot.qty <= 0) product.lots = (product.lots || []).filter(l => !(l.expiry === lotExpiry && !l.ordered));
      setDirty(true);
      if (typeof scheduleAutosave === 'function') scheduleAutosave();
      render();

      // Record in session list
      removedItems.push({
        productId: product.id,
        productName: product.name,
        qty,
        expiry: lotExpiry,
        originalQty,
        lotRef: lot
      });

      renderRemoveList();
      showResult(`✅ Removed <b>${qty}</b> × <b>${escHtml(product.name)}</b><br><small>${lotExpiry === '__unknown__' ? 'Unknown expiry' : formatDateDMY(lotExpiry)}</small>`, 'ok');
      lastBarcode = null;
    };
  }

  /* ── Remove session list ── */
  function renderRemoveList() {
    const section = document.getElementById('bcRemoveSection');
    const list    = document.getElementById('bcRemoveList');
    if (!section || !list) return;

    if (removedItems.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';

    list.innerHTML = '';
    removedItems.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'bc-removed-row';
      const expiryLabel = item.expiry === '__unknown__' ? 'Unknown expiry' : formatDateDMY(item.expiry);
      row.innerHTML = `
        <div class="bc-removed-info">
          <b>${escHtml(item.productName)}</b>
          <span class="bc-removed-meta">Qty: ${item.qty} · ${escHtml(expiryLabel)}</span>
        </div>
        <div class="bc-removed-btns">
          <button class="btn small" data-idx="${idx}" data-action="undo">↩ Undo</button>
          <button class="btn small primary" data-idx="${idx}" data-action="add-more">+ Add qty</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('[data-action="undo"]').forEach(btn => {
      btn.onclick = () => undoRemove(parseInt(btn.dataset.idx));
    });
    list.querySelectorAll('[data-action="add-more"]').forEach(btn => {
      btn.onclick = () => addMoreBack(parseInt(btn.dataset.idx));
    });
  }

  function undoRemove(idx) {
    const item = removedItems[idx];
    if (!item) return;
    const product = state.products.find(p => p.id === item.productId);
    if (!product) { removedItems.splice(idx, 1); renderRemoveList(); return; }
    // Re-add qty to the lot
    product.lots = normalizeLots(product.lots || []);
    let lot = product.lots.find(l => l.expiry === item.expiry && !l.ordered);
    if (lot) { lot.qty += item.qty; }
    else { product.lots.push({ expiry: item.expiry, qty: item.qty }); }
    setDirty(true);
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    render();
    removedItems.splice(idx, 1);
    renderRemoveList();
    showResult(`↩ Restored <b>${item.qty}</b> × <b>${escHtml(item.productName)}</b>`, 'ok');
  }

  async function addMoreBack(idx) {
    const item = removedItems[idx];
    if (!item) return;
    const extraStr = await promptQty(`How many units to add back for "${item.productName}"?`);
    const extra = parseInt(extraStr, 10);
    if (isNaN(extra) || extra <= 0) return;
    const product = state.products.find(p => p.id === item.productId);
    if (!product) return;
    product.lots = normalizeLots(product.lots || []);
    let lot = product.lots.find(l => l.expiry === item.expiry && !l.ordered);
    if (lot) { lot.qty += extra; }
    else { product.lots.push({ expiry: item.expiry, qty: extra }); }
    item.qty -= extra;
    if (item.qty <= 0) removedItems.splice(idx, 1);
    setDirty(true);
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    render();
    renderRemoveList();
    showResult(`✅ Added back <b>${extra}</b> × <b>${escHtml(item.productName)}</b>`, 'ok');
  }

  /* ── Inline qty prompt ── */
  function promptQty(msg) {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay');
      const body    = document.getElementById('customModalBody');
      const btns    = document.getElementById('customModalBtns');
      if (!overlay) { resolve(window.prompt(msg, '1')); return; }
      body.innerHTML = `<div style="margin-bottom:10px">${escHtml(msg)}</div><input type="number" id="qtyPromptInput" value="1" min="1" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:16px" />`;
      btns.innerHTML = '';
      const cancel = document.createElement('button'); cancel.className = 'btn ghost'; cancel.textContent = 'Cancel';
      cancel.onclick = () => { overlay.style.display = 'none'; resolve(null); };
      const ok = document.createElement('button'); ok.className = 'btn primary'; ok.textContent = 'OK';
      ok.onclick = () => { overlay.style.display = 'none'; resolve(document.getElementById('qtyPromptInput')?.value || '0'); };
      btns.append(cancel, ok);
      overlay.style.display = 'flex';
      setTimeout(() => document.getElementById('qtyPromptInput')?.focus(), 50);
    });
  }

  /* ── UI helpers ── */
  function showResult(html, type) {
    const el = document.getElementById('bcResult');
    if (!el) return;
    el.className = 'bc-result' + (type ? ' bc-result-' + type : '');
    el.innerHTML = html;
  }

  function updateModeTitle() {
    const titles = { add: '➕ Add Product', check: '🔍 Check Stock', remove: '➖ Remove Product' };
    const el = document.getElementById('bcTitle');
    if (el) el.textContent = '📷 ' + (titles[scanMode] || 'Barcode Scanner');
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  /* ── Evento pulsanti ── */
  function attachScannerEvents(overlay) {
    // Close
    document.getElementById('bcClose').onclick = closeScanner;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeScanner(); });

    // Mode tabs
    document.querySelectorAll('.bc-mode-btn').forEach(btn => {
      btn.onclick = () => {
        scanMode = btn.dataset.mode;
        document.querySelectorAll('.bc-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === scanMode));
        updateModeTitle();
        showResult('', '');
        lastBarcode = null;
        renderRemoveList();
      };
    });

    // Manual input
    const manualInput = document.getElementById('bcManualInput');
    const manualBtn   = document.getElementById('bcManualBtn');
    manualBtn.onclick = () => { const v = manualInput.value.trim(); if (v) { lastBarcode = null; handleBarcode(v); } };
    manualInput.addEventListener('keydown', e => { if (e.key === 'Enter') manualBtn.click(); });

    // Undo all
    document.getElementById('bcUndoAll').onclick = () => {
      [...removedItems].forEach((_, i) => undoRemove(0));
    };
  }

  /* ── Bottoni nella topbar ── */
  function injectTopbarButtons() {
    const sub = document.querySelector('.topbar-sub');
    if (!sub || document.getElementById('btnScanAdd')) return;

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;background:rgba(255,255,255,.15);margin:0 6px;align-self:stretch';

    const btnAdd = document.createElement('button');
    btnAdd.className = 'sub-link sub-link-scan'; btnAdd.id = 'btnScanAdd';
    btnAdd.innerHTML = '📷 Add Product'; btnAdd.title = 'Scan barcode to add a product';
    btnAdd.onclick = () => { if (!isAdmin()) { showAlert('Admin login required.'); return; } openScanner('add'); };

    const btnCheck = document.createElement('button');
    btnCheck.className = 'sub-link sub-link-scan'; btnCheck.id = 'btnScanCheck';
    btnCheck.innerHTML = '📷 Check Stock'; btnCheck.title = 'Scan barcode to check stock';
    btnCheck.onclick = () => openScanner('check');

    const btnRemove = document.createElement('button');
    btnRemove.className = 'sub-link sub-link-scan sub-link-scan-danger'; btnRemove.id = 'btnScanRemove';
    btnRemove.innerHTML = '📷 Remove Product'; btnRemove.title = 'Scan barcode to remove stock';
    btnRemove.onclick = () => { if (!isAdmin()) { showAlert('Admin login required.'); return; } openScanner('remove'); };

    sub.appendChild(sep);
    sub.appendChild(btnAdd);
    sub.appendChild(btnCheck);
    sub.appendChild(btnRemove);
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    injectTopbarButtons();
  });
  // Also try immediately in case DOM is already ready
  if (document.readyState !== 'loading') injectTopbarButtons();

})();
