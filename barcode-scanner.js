/* =====================================================================
   BARCODE SCANNER MODULE — Campionature
   Enhanced scanner with ZXing fallback, ITF-14 / GS1-128 support,
   flashlight toggle and better status UI.
   ===================================================================== */

(function () {
  function findProductByBarcode(barcode) {
    if (!state?.products) return null;
    const clean = normalizeScannedCode(barcode);
    return state.products.find(p =>
      Array.isArray(p.codes) && p.codes.some(c => normalizeScannedCode(c) === clean)
    ) || null;
  }

  function normalizeScannedCode(value) {
    let v = String(value || '').trim();
    // ZXing can prepend GS1 symbology identifier for FNC1 / GS1-128
    v = v.replace(/^\]C1/, '').replace(/^\(]C1\)/, '');
    return v;
  }

  function buildScannerUI() {
    if (document.getElementById('barcodeOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'barcodeOverlay';
    overlay.innerHTML = `
      <div class="bc-panel" id="bcPanel">
        <div class="bc-header">
          <span class="bc-title" id="bcTitle">📷 Barcode Scanner</span>
          <button class="bc-close" id="bcClose">✕</button>
        </div>

        <div class="bc-modes">
          <button class="bc-mode-btn active" data-mode="add">➕ Add Product</button>
          <button class="bc-mode-btn" data-mode="check">🔍 Check Stock</button>
          <button class="bc-mode-btn" data-mode="remove">➖ Remove Product</button>
        </div>

        <div class="bc-cam-wrap">
          <video id="bcVideo" autoplay playsinline muted></video>
          <div class="bc-crosshair"></div>
          <canvas id="bcCanvas" hidden></canvas>
        </div>

        <div class="bc-camera-tools">
          <button class="btn ghost small" id="bcTorchBtn" type="button">🔦 Flash non disponibile</button>
          <button class="btn ghost small" id="bcEnhanceBtn" type="button">🎚 Contrasto auto: ON</button>
          <button class="btn ghost small" id="bcRestartBtn" type="button">↻ Riavvia camera</button>
        </div>
        <div class="bc-camera-hint" id="bcCameraHint">
          Prova a inquadrare il codice da vicino. Questo scanner legge anche <b>ITF-14 / GTIN-14</b>,
          <b>EAN</b>, <b>UPC</b>, <b>QR</b>, <b>CODE128 / GS1-128</b> e usa anche <b>OCR</b> come fallback.
        </div>
        <div class="bc-status" id="bcStatus">Avvio fotocamera…</div>

        <div class="bc-manual-row">
          <input id="bcManualInput" type="text" placeholder="Or type / scan barcode here…" autocomplete="off" />
          <button class="btn primary" id="bcManualBtn">OK</button>
        </div>

        <div class="bc-result" id="bcResult"></div>

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

  let scanMode = 'add';
  let stream = null;
  let lastBarcode = null;
  let removedItems = [];
  let zxingReader = null;
  let zxingControls = null;
  let torchAvailable = false;
  let torchEnabled = false;
  let nativeScanLoop = null;
  let ocrLoop = null;
  let pauseUntil = 0;
  let enhanceMode = true;
  let ocrBusy = false;
  let ocrAttemptCounter = 0;
  let nativeMissCounter = 0;
  let barcodeMissCounter = 0;

  function openScanner(mode) {
    buildScannerUI();
    scanMode = mode || 'add';
    lastBarcode = null;
    pauseUntil = 0;

    document.querySelectorAll('.bc-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === scanMode);
    });
    updateModeTitle();

    document.getElementById('bcResult').innerHTML = '';
    document.getElementById('barcodeOverlay').style.display = 'flex';
    renderRemoveList();
    startCamera();
  }

  function closeScanner() {
    stopCamera();
    const ov = document.getElementById('barcodeOverlay');
    if (ov) ov.style.display = 'none';
    const result = document.getElementById('bcResult');
    if (result) result.innerHTML = '';
  }

  function setStatus(msg, level) {
    const el = document.getElementById('bcStatus');
    if (!el) return;
    el.className = 'bc-status' + (level ? ' bc-status-' + level : '');
    el.innerHTML = msg;
  }

  function updateTorchButton() {
    const btn = document.getElementById('bcTorchBtn');
    if (!btn) return;
    btn.disabled = !torchAvailable;
    btn.textContent = !torchAvailable
      ? '🔦 Flash non disponibile'
      : (torchEnabled ? '🔦 Spegni flash' : '🔦 Accendi flash');
  }

  async function loadZXingBrowser() {
    if (window.ZXingBrowser) return window.ZXingBrowser;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-zxing-browser="1"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
      s.async = true;
      s.dataset.zxingBrowser = '1';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Impossibile caricare ZXing dal CDN'));
      document.head.appendChild(s);
    });
    return window.ZXingBrowser;
  }


  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract="1"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.async = true;
      s.dataset.tesseract = '1';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Impossibile caricare Tesseract dal CDN'));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }

  async function startCamera() {
    stopCamera();
    nativeMissCounter = 0;
    barcodeMissCounter = 0;
    ocrAttemptCounter = 0;
    ocrBusy = false;
    const video = document.getElementById('bcVideo');
    if (!video) return;

    try {
      setStatus('Richiesta accesso fotocamera…', 'info');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: 'continuous'
        }
      });

      video.srcObject = stream;
      await video.play();
      await applyBestEffortCameraSettings();
      detectTorchSupport();
      updateTorchButton();

      let startedWithZXing = false;
      try {
        await startZXingScanner();
        startedWithZXing = true;
        startOCRLoop();
        setStatus('Scanner attivo. Supporto: EAN / UPC / QR / CODE128 / ITF-14 / GS1-128 + OCR fallback', 'ok');
      } catch (err) {
        console.warn('ZXing non disponibile, fallback BarcodeDetector:', err);
      }

      if (!startedWithZXing) {
        startNativeScanLoop();
        startOCRLoop();
        setStatus('Scanner attivo in modalità fallback. EAN / UPC / QR / CODE128 + OCR', 'warn');
      }
    } catch (e) {
      setStatus('⚠️ Fotocamera non disponibile: ' + escHtml(e.message || 'errore sconosciuto'), 'warn');
      showResult('⚠️ Camera not available: ' + escHtml(e.message || 'Unknown error'), 'warn');
      updateTorchButton();
    }
  }

  async function applyBestEffortCameraSettings() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    const advanced = [];

    if (caps.focusMode && caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
    if (caps.exposureMode && caps.exposureMode.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
    if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
    if (caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max >= 2) {
      advanced.push({ zoom: Math.min(2, caps.zoom.max) });
    }

    if (advanced.length) {
      try { await track.applyConstraints({ advanced }); } catch (_) {}
    }
  }

  function detectTorchSupport() {
    torchAvailable = false;
    torchEnabled = false;

    if (zxingControls && typeof zxingControls.switchTorch === 'function') {
      torchAvailable = true;
      return;
    }

    const track = stream?.getVideoTracks?.()[0];
    if (!track || typeof track.getCapabilities !== 'function') return;
    const caps = track.getCapabilities();
    torchAvailable = !!caps.torch;
  }

  async function toggleTorch() {
    if (!torchAvailable) {
      setStatus('Il flash non è supportato da questo browser / telefono.', 'warn');
      updateTorchButton();
      return;
    }

    try {
      if (zxingControls && typeof zxingControls.switchTorch === 'function') {
        await zxingControls.switchTorch();
        torchEnabled = !torchEnabled;
      } else {
        const track = stream?.getVideoTracks?.()[0];
        if (!track) throw new Error('Track video non disponibile');
        torchEnabled = !torchEnabled;
        await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
      }
      updateTorchButton();
      setStatus(torchEnabled ? 'Flash acceso.' : 'Flash spento.', 'ok');
    } catch (err) {
      torchEnabled = false;
      updateTorchButton();
      setStatus('Non riesco ad accendere il flash su questo dispositivo.', 'warn');
      console.warn('Torch error', err);
    }
  }

  async function startZXingScanner() {
    const ZXingBrowser = await loadZXingBrowser();
    if (!ZXingBrowser) throw new Error('ZXingBrowser non caricato');

    const hints = new Map();
    const f = ZXingBrowser.BarcodeFormat;
    const d = ZXingBrowser.DecodeHintType;
    hints.set(d.POSSIBLE_FORMATS, [
      f.EAN_13,
      f.EAN_8,
      f.UPC_A,
      f.UPC_E,
      f.QR_CODE,
      f.CODE_128,
      f.CODE_39,
      f.ITF,
      f.DATA_MATRIX
    ]);
    hints.set(d.TRY_HARDER, true);

    zxingReader = new ZXingBrowser.BrowserMultiFormatReader(hints);
    const videoEl = document.getElementById('bcVideo');

    zxingControls = await zxingReader.decodeFromVideoDevice(undefined, videoEl, (result, error, controls) => {
      if (controls) zxingControls = controls;
      if (result) {
        onDetectedCode(result.getText ? result.getText() : String(result.text || result));
      }
    });

    detectTorchSupport();
    updateTorchButton();
  }

  function startNativeScanLoop() {
    if (nativeScanLoop) clearInterval(nativeScanLoop);
    nativeScanLoop = setInterval(grabFrameNative, 280);
  }

  async function grabFrameNative() {
    if (Date.now() < pauseUntil) return;
    const video = document.getElementById('bcVideo');
    const canvas = document.getElementById('bcCanvas');
    if (!video || !canvas || video.readyState < 2 || !window.BarcodeDetector) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const attempts = [
      { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight, filter: enhanceMode ? 'contrast(1.25) brightness(1.08) saturate(0.92)' : 'none' },
      { sx: video.videoWidth * 0.08, sy: video.videoHeight * 0.12, sw: video.videoWidth * 0.84, sh: video.videoHeight * 0.76, filter: 'contrast(1.7) saturate(0.65) brightness(1.12)' },
      { sx: video.videoWidth * 0.15, sy: video.videoHeight * 0.2, sw: video.videoWidth * 0.7, sh: video.videoHeight * 0.6, filter: 'grayscale(1) contrast(2.35) brightness(1.18)' },
      { sx: video.videoWidth * 0.05, sy: video.videoHeight * 0.52, sw: video.videoWidth * 0.9, sh: video.videoHeight * 0.34, filter: 'grayscale(1) contrast(2.8) brightness(1.25)' }
    ];

    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'itf']
    });

    for (const a of attempts) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = a.filter;
      ctx.drawImage(video, a.sx, a.sy, a.sw, a.sh, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      try {
        const codes = await detector.detect(canvas);
        if (codes?.length) {
          nativeMissCounter = 0;
          barcodeMissCounter = 0;
          onDetectedCode(codes[0].rawValue);
          return;
        }
      } catch (_) {}
    }

    nativeMissCounter += 1;
    barcodeMissCounter += 1;
  }


  function startOCRLoop() {
    if (ocrLoop) clearInterval(ocrLoop);
    ocrLoop = setInterval(() => {
      if (Date.now() < pauseUntil) return;
      if (ocrBusy) return;
      if (barcodeMissCounter < 6 && nativeMissCounter < 4) return;
      runOCRFallback();
    }, 900);
  }

  function enhanceCanvasForBarcode(ctx, width, height) {
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    let minL = 255, maxL = 0;

    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (lum < minL) minL = lum;
      if (lum > maxL) maxL = lum;
    }

    const range = Math.max(25, maxL - minL);
    const gain = 255 / range;
    const threshold = Math.max(70, Math.min(205, minL + range * 0.58));

    for (let i = 0; i < data.length; i += 4) {
      let lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      lum = (lum - minL) * gain;
      lum = lum < threshold ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = lum;
    }

    ctx.putImageData(img, 0, 0);
  }

  function extractLikelyBarcodeFromText(text) {
    const normalized = String(text || '')
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[Ss]/g, '5')
      .replace(/[^0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return '';

    const parts = normalized.split(' ').map(v => v.trim()).filter(Boolean);
    const joined = normalized.replace(/\s+/g, '');

    const candidates = [];
    for (const p of parts) {
      if (/^\d{8,14}$/.test(p)) candidates.push(p);
    }
    if (/^\d{8,14}$/.test(joined)) candidates.push(joined);

    const deduped = [...new Set(candidates)].sort((a, b) => b.length - a.length);
    return deduped[0] || '';
  }

  async function runOCRFallback() {
    const video = document.getElementById('bcVideo');
    const canvas = document.getElementById('bcCanvas');
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    ocrBusy = true;
    ocrAttemptCounter += 1;

    try {
      const Tesseract = await loadTesseract();
      const width = video.videoWidth;
      const height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const attempts = [
        { sx: width * 0.03, sy: height * 0.50, sw: width * 0.94, sh: height * 0.32, scale: 2.2, label: 'bottom' },
        { sx: width * 0.10, sy: height * 0.58, sw: width * 0.80, sh: height * 0.22, scale: 2.8, label: 'digits' },
        { sx: width * 0.12, sy: height * 0.44, sw: width * 0.76, sh: height * 0.30, scale: 2.4, label: 'center-bottom' }
      ];

      setStatus('Ricerca OCR in corso… aumento contrasto per sfondi scuri/cartone.', 'info');

      for (const a of attempts) {
        const targetW = Math.max(320, Math.round(a.sw * a.scale));
        const targetH = Math.max(120, Math.round(a.sh * a.scale));
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.save();
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.filter = enhanceMode
          ? 'grayscale(1) contrast(2.6) brightness(1.22) saturate(0)'
          : 'grayscale(1) contrast(2) brightness(1.12)';
        ctx.drawImage(video, a.sx, a.sy, a.sw, a.sh, 0, 0, targetW, targetH);
        ctx.restore();
        enhanceCanvasForBarcode(ctx, targetW, targetH);

        const result = await Tesseract.recognize(canvas, 'eng', {
          tessedit_pageseg_mode: 6,
          tessedit_char_whitelist: '0123456789',
          preserve_interword_spaces: '1'
        });

        const text = result?.data?.text || '';
        const candidate = extractLikelyBarcodeFromText(text);
        if (candidate) {
          nativeMissCounter = 0;
          barcodeMissCounter = 0;
          onDetectedCode(candidate + '');
          setStatus('Codice letto via OCR: <b>' + escHtml(candidate) + '</b>', 'ok');
          return;
        }
      }

      if (ocrAttemptCounter % 2 === 0) {
        setStatus('Barcode non trovato: continuo con OCR + contrasto avanzato.', 'warn');
      }
    } catch (err) {
      console.warn('OCR fallback error', err);
      if (ocrAttemptCounter <= 2) {
        setStatus('OCR fallback non disponibile su questo dispositivo/browser.', 'warn');
      }
    } finally {
      ocrBusy = false;
    }
  }

  function stopCamera() {
    if (nativeScanLoop) { clearInterval(nativeScanLoop); nativeScanLoop = null; }
    if (ocrLoop) { clearInterval(ocrLoop); ocrLoop = null; }

    try {
      if (zxingControls && typeof zxingControls.stop === 'function') zxingControls.stop();
    } catch (_) {}
    zxingControls = null;

    try {
      if (zxingReader && typeof zxingReader.reset === 'function') zxingReader.reset();
    } catch (_) {}
    zxingReader = null;

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    const video = document.getElementById('bcVideo');
    if (video) video.srcObject = null;

    torchAvailable = false;
    torchEnabled = false;
    updateTorchButton();
  }

  function onDetectedCode(raw) {
    const barcode = normalizeScannedCode(raw);
    if (!barcode) return;
    if (barcode === lastBarcode && Date.now() < pauseUntil) return;

    lastBarcode = barcode;
    pauseUntil = Date.now() + 1700;
    nativeMissCounter = 0;
    barcodeMissCounter = 0;

    if (navigator.vibrate) {
      try { navigator.vibrate(120); } catch (_) {}
    }

    setStatus('Codice letto: <b>' + escHtml(barcode) + '</b>', 'ok');
    handleBarcode(barcode);
  }

  async function handleBarcode(barcode) {
    barcode = normalizeScannedCode(barcode);
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

  async function handleAdd(barcode, product) {
    if (product) {
      showResult(`✅ Product already exists: <b>${escHtml(product.name)}</b><br><small>Code: ${escHtml(barcode)}</small>`, 'ok');
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

    html += `<button class="btn small primary bc-open-stock" style="margin-top:10px">📦 Manage Stock</button>`;
    showResult(html, 'ok');

    setTimeout(() => {
      const btn = document.querySelector('.bc-open-stock');
      if (btn) btn.onclick = () => { closeScanner(); openStockDlg(product.id); };
    }, 50);
  }

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

    const resultEl = document.getElementById('bcResult');
    let html = `<div class="bc-check-name">${escHtml(product.name)}</div>`;
    html += `<div style="margin-bottom:8px;font-size:13px;color:var(--text2)">Select lot and quantity to remove:</div>`;

    html += `<div class="bc-remove-form">
      <label class="bc-remove-label">Lot / Expiry
        <select id="bcRemoveLot" class="bc-select">`;
    for (const l of lots) {
      const label = l.expiry === '__unknown__' ? 'Unknown expiry' : formatDateDMY(l.expiry);
      html += `<option value="${escHtml(l.expiry)}">${escHtml(label)} — Qty: ${l.qty}</option>`;
    }
    html += `</select></label>
      <label class="bc-remove-label">Qty
        <input id="bcRemoveQty" class="bc-input" type="number" min="1" value="1" />
      </label>
      <div class="bc-remove-btnrow">
        <button class="btn ghost" type="button" id="bcRemoveCancel">Cancel</button>
        <button class="btn primary" type="button" id="bcRemoveConfirm">Confirm remove</button>
      </div>
    </div>`;

    showResult(html, 'warn');

    const cancel = document.getElementById('bcRemoveCancel');
    const confirm = document.getElementById('bcRemoveConfirm');
    if (cancel) cancel.onclick = () => showResult('', '');
    if (confirm) confirm.onclick = () => {
      const expiry = document.getElementById('bcRemoveLot')?.value || '__unknown__';
      const qty = parseInt(document.getElementById('bcRemoveQty')?.value || '0', 10);
      doRemove(product, expiry, qty);
    };

    if (resultEl) resultEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function doRemove(product, expiry, qty) {
    if (!qty || qty <= 0) return;

    product.lots = normalizeLots(product.lots || []);
    const lot = product.lots.find(l => l.expiry === expiry && !l.ordered);
    if (!lot || lot.qty < qty) {
      showResult('⚠️ Invalid quantity for selected lot.', 'warn');
      return;
    }

    lot.qty -= qty;
    if (lot.qty <= 0) product.lots = product.lots.filter(l => !(l.expiry === expiry && !l.ordered && l.qty <= 0));

    removedItems.unshift({
      productId: product.id,
      productName: product.name,
      qty,
      expiry
    });

    setDirty(true);
    if (typeof scheduleAutosave === 'function') scheduleAutosave();
    render();
    renderRemoveList();
    showResult(`➖ Removed <b>${qty}</b> × <b>${escHtml(product.name)}</b>`, 'ok');
  }

  function renderRemoveList() {
    const sec = document.getElementById('bcRemoveSection');
    const list = document.getElementById('bcRemoveList');
    if (!sec || !list) return;

    sec.style.display = (scanMode === 'remove' && removedItems.length) ? '' : 'none';
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

  function promptQty(msg) {
    return new Promise(resolve => {
      const overlay = document.getElementById('customModalOverlay');
      const body = document.getElementById('customModalBody');
      const btns = document.getElementById('customModalBtns');
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

  function attachScannerEvents(overlay) {
    document.getElementById('bcClose').onclick = closeScanner;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeScanner(); });

    document.querySelectorAll('.bc-mode-btn').forEach(btn => {
      btn.onclick = () => {
        scanMode = btn.dataset.mode;
        document.querySelectorAll('.bc-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === scanMode));
        updateModeTitle();
        showResult('', '');
        lastBarcode = null;
        nativeMissCounter = 0;
        barcodeMissCounter = 0;
        setStatus('Scanner pronto. Modalità: ' + escHtml(btn.textContent || scanMode), 'info');
        renderRemoveList();
      };
    });

    const manualInput = document.getElementById('bcManualInput');
    const manualBtn = document.getElementById('bcManualBtn');
    manualBtn.onclick = () => {
      const v = manualInput.value.trim();
      if (v) { lastBarcode = null; nativeMissCounter = 0; barcodeMissCounter = 0; handleBarcode(v); }
    };
    manualInput.addEventListener('keydown', e => { if (e.key === 'Enter') manualBtn.click(); });

    const torchBtn = document.getElementById('bcTorchBtn');
    if (torchBtn) torchBtn.onclick = toggleTorch;

    const enhanceBtn = document.getElementById('bcEnhanceBtn');
    if (enhanceBtn) {
      const paintEnhanceBtn = () => {
        enhanceBtn.textContent = enhanceMode ? '🎚 Contrasto auto: ON' : '🎚 Contrasto auto: OFF';
        enhanceBtn.classList.toggle('primary', enhanceMode);
      };
      paintEnhanceBtn();
      enhanceBtn.onclick = () => {
        enhanceMode = !enhanceMode;
        paintEnhanceBtn();
        setStatus(enhanceMode ? 'Contrasto automatico attivo.' : 'Contrasto automatico disattivato.', enhanceMode ? 'ok' : 'info');
      };
    }

    const restartBtn = document.getElementById('bcRestartBtn');
    if (restartBtn) restartBtn.onclick = startCamera;

    document.getElementById('bcUndoAll').onclick = () => {
      [...removedItems].forEach(() => undoRemove(0));
    };
  }

  function injectTopbarButtons() {
    const sub = document.querySelector('.topbar-sub');
    if (!sub || document.getElementById('btnScanAdd')) return;

    const sep = document.createElement('div');
    sep.id = 'bcSep';
    sep.style.cssText = 'width:1px;background:rgba(255,255,255,.15);margin:0 6px;align-self:stretch';

    const btnAdd = document.createElement('button');
    btnAdd.className = 'sub-link sub-link-scan'; btnAdd.id = 'btnScanAdd';
    btnAdd.innerHTML = '📷 Add Product';
    btnAdd.onclick = () => { if (!isAdmin()) { showAlert('Admin login required.'); return; } openScanner('add'); };

    const btnCheck = document.createElement('button');
    btnCheck.className = 'sub-link sub-link-scan'; btnCheck.id = 'btnScanCheck';
    btnCheck.innerHTML = '📷 Check Stock';
    btnCheck.onclick = () => openScanner('check');

    const btnRemove = document.createElement('button');
    btnRemove.className = 'sub-link sub-link-scan sub-link-scan-danger'; btnRemove.id = 'btnScanRemove';
    btnRemove.innerHTML = '📷 Remove Product';
    btnRemove.onclick = () => { if (!isAdmin()) { showAlert('Admin login required.'); return; } openScanner('remove'); };

    sub.appendChild(sep);
    sub.appendChild(btnAdd);
    sub.appendChild(btnCheck);
    sub.appendChild(btnRemove);

    refreshBarcodeButtons();
  }

  function refreshBarcodeButtons() {
    const sep = document.getElementById('bcSep');
    const btnAdd = document.getElementById('btnScanAdd');
    const btnCheck = document.getElementById('btnScanCheck');
    const btnRemove = document.getElementById('btnScanRemove');
    if (!btnAdd) return;

    const loggedIn = !!(typeof portalSession !== 'undefined' && portalSession?.token);
    const commRole = typeof isCommerciale === 'function' && isCommerciale();

    if (!loggedIn) {
      if (sep) sep.style.display = 'none';
      if (btnAdd) btnAdd.style.display = 'none';
      if (btnCheck) btnCheck.style.display = 'none';
      if (btnRemove) btnRemove.style.display = 'none';
    } else if (commRole) {
      if (sep) sep.style.display = '';
      if (btnAdd) btnAdd.style.display = 'none';
      if (btnCheck) btnCheck.style.display = '';
      if (btnRemove) btnRemove.style.display = 'none';
    } else {
      if (sep) sep.style.display = '';
      if (btnAdd) btnAdd.style.display = '';
      if (btnCheck) btnCheck.style.display = '';
      if (btnRemove) btnRemove.style.display = '';
    }

    const sub = document.querySelector('.topbar-sub');
    if (sub) {
      const anyVisible = [btnAdd, btnCheck, btnRemove].some(b => b && b.style.display !== 'none');
      sub.dataset.scannerVisible = anyVisible ? '1' : '0';
    }
  }

  window.refreshBarcodeButtons = refreshBarcodeButtons;

  document.addEventListener('DOMContentLoaded', () => {
    injectTopbarButtons();
  });
  if (document.readyState !== 'loading') injectTopbarButtons();
})();
