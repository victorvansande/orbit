/* ---- Koppelen met een QR-code ---- */
// Het ene toestel toont een QR-code met de koppellink (…#sync=CODE), het andere scant hem:
// met de gewone camera (de link opent Orbit) of met de scanner in Orbit zelf.
// Bibliotheken worden pas geladen als ze nodig zijn: QR maken (qrcode-generator, 21 KB) en QR lezen (jsQR, 131 KB,
// alleen als de browser geen ingebouwde BarcodeDetector heeft, zoals Safari).

import { tx } from './i18n.js';

import { normalizeCode } from './sync.js';

let qrLib = null;
let jsqrPromise = null;

// QR-code als SVG: vierkante modules met een stille rand, altijd donker op licht (scant het best, ook in het donkere thema)
export async function renderQr(root, text) {
  if (root.dataset.text === text) return;
  root.dataset.text = text;
  qrLib ??= import('./vendor/qrcode.min.mjs').then(m => m.default);
  const qrcode = await qrLib;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), pad = 3, size = n + pad * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + pad} ${y + pad}h1v1h-1z`;
  if (root.dataset.text !== text) return;   // intussen een andere code
  root.innerHTML = `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect class="qr-bg" width="${size}" height="${size}"/><path class="qr-ink" d="${d}"/></svg>`;
}

// Code uit een gescande tekst: een koppellink (…#sync=CODE) of de code zelf
export function codeFromText(text) {
  const m = String(text || '').match(/#sync=([0-9A-Za-z-]+)/);
  return normalizeCode(m ? m[1] : text);
}

function loadJsQr() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  jsqrPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('./vendor/jsqr.min.js', import.meta.url).href;
    s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR ontbreekt')));
    s.onerror = () => { jsqrPromise = null; reject(new Error('jsQR kon niet laden')); };
    document.head.append(s);
  });
  return jsqrPromise;
}

// Camera-scanner. onCode(tekst) geeft false terug om verder te scannen; onMessage(tekst, fout) toont uitleg.
export function createScanner(video, { onCode, onMessage }) {
  let stream = null, timer = 0, detector = null, canvas = null, running = false;

  async function start() {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      onMessage(tx('cam.none'), true);
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      onMessage(tx('cam.denied'), true);
      return false;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch { detector = null; }
    }
    if (!detector) {
      try { await loadJsQr(); } catch { onMessage(tx('cam.load'), true); stop(); return false; }
    }
    running = true;
    tick();
    return true;
  }

  async function tick() {
    if (!running) return;
    let text = null;
    if (video.readyState >= 2) {
      if (detector) {
        try { text = (await detector.detect(video))[0]?.rawValue ?? null; }
        catch { detector = null; try { await loadJsQr(); } catch { /* volgende poging */ } }
      } else if (window.jsQR) {
        text = decodeFrame();
      }
    }
    if (!running) return;
    if (text && onCode(text) !== false) { stop(); return; }
    timer = setTimeout(tick, 160);
  }

  // jsQR op een verkleind beeld (max. 640 px): snel genoeg op een gsm
  function decodeFrame() {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const s = Math.min(1, 640 / Math.max(w, h));
    canvas ??= document.createElement('canvas');
    canvas.width = Math.round(w * s);
    canvas.height = Math.round(h * s);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
  }

  return { start, stop, get running() { return running; } };
}

// Korte naam van dit toestel, zodat de verzender ziet wie ontving ("Verstuurd naar iPhone")
export function deviceName() {
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? tx('device.android') : tx('device.androidTab');
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return tx('device.windows');
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return tx('device.linux');
  return tx('device.other');
}
