/* ---- Zandloper: focustimer in de focusmodus ---- */
// Vrije hint boven het bakje, zonder kaart of ingelaten kader (Victor, 04/11/2026, Voorstel 1: "geen kaart maar eerder
// ook een kleine 'hint', exact zoals het wordt weergegeven op het dashboard ... ook het vergroten van de zandloper
// vergroot gewoon de zandloper zoals nu maar dan vrij, zonder kaart erachter"). De zandloper is één silhouet van
// rasterpunten, zoals een risoposter en zoals de kern (Halftoon, gekozen door Victor): zand zijn volle punten, leeg glas
// zijn speldenprikjes, en het oppervlak is een zacht verloop van puntgroottes, met volume zoals de kern. Boven zakt het
// zand met een kuiltje, door de hals vallen kalme korrels in inkt, onder groeit een kegel. Geen omtrek of platen.
// Ingeklapt: klein glas (36 × 60 px) met het dunne minutencijfer (T3); aanwijzen toont 15 / 25 / 50, Start / Pauze, ↺
// en ⤢ links ernaast, exact zoals het kleine glas buiten de focus. Uitgeklapt: de zandloper groeit vrij in de ruimte
// boven het bakje met de stippencijfers eronder, zonder kaart erachter.
// Compact (gsm, klasse is-compact, P3 van Victor, 02/11/2026): klein glas met de resterende minuten als groot, dun cijfer
// (T3) rechts in de knoppenrij; duur, Start / Pauze en ↺ verschijnen pas bij een tik, in een pilletje erboven.
// De tijd loopt op de klok (eindtijd in de opslag), dus ook verder als de focus dicht is of de pagina herlaadt.
// Klaar: een golf door het zand, een paar stippen fonkelen uit als de vierpuntige ster en de afvinktik klinkt.
import { setMatrix, morphMatrix, twinkleDot } from '../scene/matrix.js';

export const TIMER_KEY = 'priority-orbit.timer.v1';
const KEY = TIMER_KEY;
const UI_KEY = 'priority-orbit.timer.ui.v1';     // uitgeklapt of niet, per toestel
const DURATIONS = [15, 25, 50];
const VOLUME = 0.56, VOLUME_SMALL = 0.8;          // deel van een bol dat het zand vult (een klein glaasje voller: weinig punten)
const STEPS = 240;                                // stappen voor de inhoud van een bol
const SLOPE = 0.6;                                // helling waaronder zand blijft liggen (ongeveer 31 graden), boven en onder
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// vorm van één bol: halve breedte (0..1) op hoogte u, van de hals (0) naar het uiteinde (1). Een gesloten druppel: uit
// de hals waaiert het glas uit tot de buik (op UM) en sluit dan rond, zoals geblazen glas. Eerst was het een kom met een
// vlakke, vervagende rand: uitgeklapt had het glas daardoor geen bodem en lag het hoopje eronder (Victor, 12/11/2026).
const UM = 0.58, FLARE = 1.3, CAP = 2.4;
const shape = u => u < UM ? Math.pow(Math.sin(u / UM * Math.PI / 2), FLARE) : Math.pow(Math.max(0, 1 - Math.pow((u - UM) / (1 - UM), CAP)), 1 / CAP);
// omgekeerd: op welke hoogte ligt de wand bij halve breedte w (0..1), aan de kant van de hals en aan de kant van het uiteinde
const wallLow = w => UM * 2 / Math.PI * Math.asin(Math.pow(w, 1 / FLARE));
const wallHigh = w => UM + (1 - UM) * Math.pow(Math.max(0, 1 - Math.pow(w, CAP)), 1 / CAP);
const RATIO = 0.6;                                // halve breedte van een bol / hoogte van een bol: het glas houdt zijn verhouding

const ICON_OPEN = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 6.5h-4v-4M9.5 6.5 14 2M2.5 9.5h4v4M6.5 9.5 2 14"/></svg>';

// toestand zoals bewaard: duur (min), en ofwel een eindtijd (loopt), ofwel de resterende tijd (gepauzeerd of nog niet
// gestart), plus `at` (laatste wijziging, voor de sync). Ook gelezen door het kleine glas buiten de focus (glass.js).
export function timerState() {
  let st = { dur: 25, endAt: 0, left: 25 * 60000, done: false, at: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && DURATIONS.includes(s.dur)) st = { ...st, ...s }; } catch { /* geen opslag */ }
  return st;
}
// toestand van een ander toestel overnemen (sync); geeft false als ze ongeldig is
export function saveTimerState(s) {
  if (!s || !DURATIONS.includes(s.dur)) return false;
  const st = { dur: s.dur, endAt: Number(s.endAt) || 0, left: Number(s.left) || 0, done: !!s.done, at: Number(s.at) || 0 };
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ }
  return true;
}

export function createTimer(box, { reducedMotion, tx, onDone = () => {}, onChange = () => {} }) {
  const wrap = Object.assign(document.createElement('div'), { className: 'timer-glass' });
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  wrap.append(cv);
  const side = Object.assign(document.createElement('div'), { className: 'timer-side' });
  const digits = Object.assign(document.createElement('div'), { className: 'timer-digits' });
  digits.setAttribute('role', 'timer');
  const row = Object.assign(document.createElement('div'), { className: 'timer-row' });
  const durs = DURATIONS.map(m => Object.assign(document.createElement('button'), { type: 'button', textContent: String(m), className: 'timer-dur' }));
  const unit = Object.assign(document.createElement('span'), { className: 'timer-unit', textContent: 'min' });
  const go = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-go' });
  const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-reset', textContent: '↺' });
  reset.setAttribute('aria-label', tx('timer.reset')); reset.title = tx('timer.reset');
  const durWrap = Object.assign(document.createElement('div'), { className: 'timer-durs' });
  durWrap.setAttribute('role', 'group');
  durs.forEach(b => durWrap.append(b));
  durWrap.append(unit);
  const expand = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-expand' });
  row.append(durWrap, go, reset, expand);
  // groot, dun minutencijfer met klein MIN erachter (op gsm toont een tik de bediening, op pc start/pauzeert het)
  const minBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-min' });
  const minNum = Object.assign(document.createElement('span'), { className: 'timer-num' });
  const minUnit = document.createElement('small');
  minBtn.append(minNum, minUnit);
  minBtn.setAttribute('aria-expanded', 'false');
  side.append(minBtn, digits, row);
  box.append(wrap, side);
  const g = cv.getContext('2d');

  let st = timerState();
  // elke eigen wijziging krijgt een tijdstip en gaat naar de sync (onChange): het recentste toestel wint
  const save = () => { st = { ...st, at: Date.now() }; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ } onChange(); };
  const remaining = (now = Date.now()) => st.endAt ? Math.max(0, st.endAt - now) : st.left;

  let open = false;
  try { open = localStorage.getItem(UI_KEY) === 'open'; } catch { /* geen opslag */ }

  let raf = 0, running = false, shownText = '', ink = '#1B1B22', colAt = 0;
  function readColors(now) {
    if (now - colAt < 1000) return;
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--ink').trim() || ink;
    colAt = now;
  }

  /* ---- Glas: maat, vorm en inhoud ---- */
  let W = 0, H = 0, dpr = 1, glass = null;
  function measure() {
    const w = Math.round(wrap.clientWidth), h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const small = W < 40;                                     // compact glaasje op gsm: fijner raster, minder marge
    const sp = small ? 3.3 : Math.max(3.6, Math.min(6.5, W / 30));   // afstand tussen de rasterpunten
    // vaste verhouding, gecentreerd in het vak: uitgeklapt werd het glas anders lang en smal (Victor, 29/10/2026)
    const avail = H - (small ? 2 : 6), neckLen = sp * 0.5;
    const R = Math.min(W / 2 - (small ? 1.5 : 4), (avail - neckLen) / 2 * RATIO);   // halve breedte van een bol
    const bulb = R / RATIO;
    const top = (H - (bulb * 2 + neckLen)) / 2, bot = top + bulb * 2 + neckLen;
    const neck = Math.max(1.4, R * 0.075);
    // het zand ligt binnen de wand: `wall` px van de buitenste punten blijft leeg glas (speldenprikjes), zodat het
    // glas een leesbare rand en bodem heeft; in een klein glaasje niet, daar is elke punt nodig
    const rimW = small ? 1.6 : 2.2, wall = small ? 0 : Math.min(sp * rimW * 0.5, neck * 0.6);
    // halve breedte van de holte per stap in de hoogte, en haar inhoud (px²)
    const inner = new Float64Array(STEPS + 1), uEnd = 1 - wall / bulb, dz = bulb / STEPS;
    let total = 0;
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      inner[i] = u > uEnd ? 0 : Math.max(0, neck + (R - neck) * shape(u) - wall * 1.1);
      total += 2 * inner[i] * dz;
    }
    glass = { top, bot, neckLen, bulb, R, neck, sp, rimW, wall, inner, uEnd, dz, vol: total * (small ? VOLUME_SMALL : VOLUME), round: sp * 1.4, dot0: small ? 0.14 : 0.12, cx: W / 2, neckTop: top + bulb, neckBot: top + bulb + neckLen };
  }
  const halfAt = u => glass.neck + (glass.R - glass.neck) * shape(Math.min(1, Math.max(0, u)));
  // afstand (px) van een punt in een bol tot de wand, bij benadering: uit de afstand opzij en de afstand in de hoogte
  function rimAt(u, dx, hw) {
    const { bulb, R, neck } = glass, w = Math.min(1, Math.max(0, (dx - neck) / (R - neck)));
    const dh = hw - dx, dv = Math.min(dx < neck ? 1e9 : (u - wallLow(w)) * bulb, (wallHigh(w) - u) * bulb);
    return dh <= 0 || dv <= 0 ? 0 : dh * dv / Math.hypot(dh, dv);
  }
  // onder: een kegel met een ronde top, hoogte h boven de bodem van de holte; halve breedte van het zand op hoogte z
  const pileHalf = (h, z) => { const { round } = glass; if (z >= h) return 0; const t = (h - z) / SLOPE + round; return Math.sqrt(t * t - round * round); };
  function pileArea(h) {
    const { inner, uEnd, bulb, dz } = glass;
    let a = 0;
    for (let i = 0; i <= STEPS; i++) { const z = (uEnd - i / STEPS) * bulb; if (z >= 0 && z < h) a += 2 * Math.min(inner[i], pileHalf(h, z)) * dz; }
    return a;
  }
  // boven: een vlak oppervlak op hoogte L boven de hals met een trechter (halve breedte cr) waar het zand wegloopt
  function topArea(L, cr) {
    const { inner, dz } = glass;
    let a = 0;
    for (let i = 0; i <= STEPS; i++) { const z = i * dz; if (z >= L) break; a += 2 * Math.max(0, inner[i] - Math.max(0, cr - (L - z) / SLOPE)) * dz; }
    return a;
  }
  // de hoogte waarbij een oppervlak precies de gevraagde inhoud heeft
  function solve(fn, want, max) {
    let lo = 0, hi = max;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fn(m) < want) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  function draw(now = performance.now()) {
    readColors(now);
    measure();
    const total = st.dur * 60000, left = remaining(), live = Boolean(st.endAt && left > 0);
    if (glass) drawGlass(left / total, live, now);
    // tijd en knoppen
    const s = Math.ceil(left / 1000), text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (text + st.done !== shownText) {
      // een nieuwe minuut (of een andere duur) valt in ruis en bezinkt, zoals de stippenteller; de seconden wisselen
      // gewoon, elke seconde ruis was te onrustig
      if (shownText && shownText.slice(0, 2) !== text.slice(0, 2) && !digits._morphT) morphMatrix(digits, text, { still: reducedMotion.matches, only: true });
      else setMatrix(digits, text);
      shownText = text + st.done;
      const num = st.done ? '' : String(left >= 60000 ? Math.ceil(left / 60000) : s), unit = st.done ? tx('timer.done') : left >= 60000 ? 'min' : 's';
      minNum.textContent = num; minUnit.textContent = unit;
      minBtn.setAttribute('aria-label', tx('timer.tools', { time: num ? `${num} ${unit}` : unit }));
    }
    go.textContent = tx(st.done ? 'timer.done' : st.endAt ? 'timer.pause' : left < total ? 'timer.resume' : 'timer.start');
    go.disabled = st.done;
    durs.forEach(b => { b.setAttribute('aria-pressed', String(Number(b.textContent) === st.dur)); b.disabled = Boolean(st.endAt); });   // een lopend blok wissel je niet per ongeluk
    reset.hidden = !st.done && !st.endAt && left >= total;
    box.classList.toggle('is-running', Boolean(st.endAt));
    box.classList.toggle('is-paused', !st.endAt && !st.done && left < total);
    if (st.endAt && left <= 0) finish();
  }

  // korrels die door de hals vallen (Inkt, gekozen door Victor uit zes varianten: rood en druk was te veel): om de 70 ms
  // een kans van 75 %, trage val, in de kleur van het zand; na de landing stuiteren ze even opzij en vervagen
  const KEEP = 0.75, GRAV = 600, LAND = 260;
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  let pausedAt = -1e9, doneAt = -1e9;

  function drawGlass(q, live, now) {
    const { top, bot, bulb, R, cx, neckTop, neckBot, sp, rimW, wall, vol, round, dot0 } = glass;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const still = reducedMotion.matches;
    // onder: een kegel op de ronde bodem die breder wordt tot hij de wanden raakt en dan stijgt; boven: het zand zakt
    // vlak, met een trechter boven de hals die breder wordt naarmate er zand weg is (en blijft staan bij een pauze), tot
    // het laatste zand als een kegel naar de hals loopt. Beide oppervlakken liggen onder dezelfde helling en hun hoogte
    // volgt uit de inhoud, dus wat boven verdwijnt ligt onder.
    const floor = bot - wall;                              // bodem van de holte: daar ligt het zand op
    const pile = q < 1 ? solve(pileArea, (1 - q) * vol, bulb * 1.6) : 0;
    const crater = R * 0.34 * smooth(0, 0.25, 1 - q), level = q > 0 ? solve(L => topArea(L, crater), q * vol, bulb + crater * SLOPE) : 0;
    let sandAt = dx => pile - SLOPE * (Math.sqrt(dx * dx + round * round) - round);   // hoogte van het zand boven de bodem
    if (live && !still) { const ph = (now / 2600) % 1, base = sandAt, Rb = pile / SLOPE; if (ph < 0.25 && pile > 0) { const sag = 1 - 0.06 * Math.sin(ph / 0.25 * Math.PI); sandAt = dx => base(dx) * (dx < Rb * 0.5 ? sag + (1 - sag) * dx / (Rb * 0.5) : 1); } }   // af en toe een klein lawinetje
    // zachte pauze: er vallen geen nieuwe korrels meer, wat al valt landt nog
    const settling = !live && now - pausedAt < 1500 && q > 0.001 && q < 1;
    const flowing = (live || settling) && q > 0.001;
    const soft = sp * 1.3;                                // verloop aan het oppervlak, in px: even scherp in een groot en een klein glas
    // golf door het zand als het laatste korreltje gevallen is
    const waveAge = (now - doneAt) / 1000, waving = !still && waveAge >= 0 && waveAge < 1.1, waveR = waveAge * 320;
    g.fillStyle = ink;
    for (let row = 0, y = top + sp / 2; y < bot; row++, y += sp * 0.866) {
      const up = y < neckTop;
      if (!up && y <= neckBot) continue;
      const u = up ? (neckTop - y) / bulb : (y - neckBot) / bulb, hw = halfAt(u);
      for (let x = cx - Math.ceil(hw / sp) * sp + (row % 2) * sp / 2; x <= cx + hw; x += sp) {
        const dx = Math.abs(x - cx);
        if (dx > hw - 1) continue;
        // zachte rand (Victor, 02/11/2026: "geleidelijk aan een klein beetje vervaagd, zodat het niet zo'n harde rand heeft"):
        // over een paar puntafstanden van de wand worden de punten kleiner en lichter
        const k = 1 - dx / hw, rim = rimAt(u, dx, hw), edge = smooth(0, sp * rimW, rim);
        // hoeveel zand er op deze plek is (0..1), met een zacht verloop aan het oppervlak en aan de wand, en hoe diep
        // onder het oppervlak
        const d = up ? level - SLOPE * Math.max(0, crater - dx) - (neckTop - y) : sandAt(dx) - (floor - y);
        const f = smooth(-soft, soft, d) * smooth(wall - soft * 0.5, wall + soft * 0.5, rim), depth = d / bulb;
        let r = sp * (dot0 + 0.39 * f) * (0.5 + 0.5 * edge);
        // volume, zoals de kern: grotere punten in het midden, kleiner naar de wand en naar het oppervlak
        if (f > 0.05) r *= (0.74 + 0.26 * Math.sqrt(k)) * (0.82 + 0.18 * smooth(0, 0.25, depth));
        if (waving && !up && f > 0.3) { const d = Math.hypot(x - cx, y - neckBot); r *= 1 + 0.22 * Math.exp(-(((d - waveR) / 14) ** 2)) * (1 - waveAge / 1.1); }
        g.globalAlpha = (0.24 + 0.76 * f) * (0.3 + 0.7 * edge);
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    // geen aparte puntjes meer in de hals: de twee helften raken elkaar (dat kolommetje oogde vreemd)
    if (flowing) {
      // in een groot glas een fijne, dichte draad van korrels; in een klein glaasje af en toe één
      const EVERY = W < 40 ? 70 : 30, wide = sp * (W < 40 ? 1.8 : 0.7);
      const end = floor - Math.max(0, sandAt(0)), drop = Math.max(4, end - neckTop);
      const fall = Math.sqrt(2 * drop / GRAV) * 1000, t = still ? 0 : now, last = Math.floor(t / EVERY);
      for (let i = last; i > last - (fall + LAND) / EVERY - 1; i--) {
        if (rnd(i, 9) > KEEP) continue;
        const born = i * EVERY, age = t - born;
        if (age < 0 || (!live && born > pausedAt)) continue;
        const rr = W < 40 ? sp * (0.17 + 0.17 * rnd(i, 1)) : sp * (0.12 + 0.12 * rnd(i, 1));
        let x, y, a = 1;
        if (age < fall) {
          const sec = age / 1000, d = 0.5 * GRAV * sec * sec;
          x = cx + (rnd(i, 2) - 0.5) * Math.min(wide, d * 0.07);
          y = neckTop - 2 + d;
        } else {
          const k = Math.min(1, (age - fall) / LAND), side = rnd(i, 3) < 0.5 ? -1 : 1;
          x = cx + (rnd(i, 2) - 0.5) * Math.min(wide, drop * 0.07) + side * k * sp * (0.5 + rnd(i, 4) * 1.1);
          y = neckTop - 2 + drop - Math.sin(k * Math.PI) * sp * (0.25 + 0.4 * rnd(i, 5));
          a = 1 - k;
        }
        g.globalAlpha = a; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // Klaar. Het blok telt onder zijn eindtijd (`end`): loopt dezelfde zandloper op twee gekoppelde toestellen, dan delen ze
  // die eindtijd via de sync en valt het blok bij het samenvoegen samen tot één (nooit dubbel geteld). Ook stil klaar
  // (lang na het einde geopend) telt het blok nu, zonder geluid of melding.
  function finish(quiet = false) {
    const end = st.endAt || Date.now();
    st = { ...st, endAt: 0, left: 0, done: true };
    save();
    if (!quiet) {
      doneAt = performance.now();
      if (!reducedMotion.matches) [0, 260, 520].forEach(ms => setTimeout(() => twinkleDot(digits), ms));
    }
    onDone(st.dur, end, quiet);
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    if (st.done) return;
    if (st.endAt) { st = { ...st, left: remaining(), endAt: 0 }; pausedAt = performance.now(); }   // pauze
    else st = { ...st, endAt: Date.now() + st.left };                 // start of verder
    save();
    schedule();
    draw();
  }
  // compact: de bediening verschijnt bij een tik en verdwijnt 2,5 s na de laatste aanraking (zoals de knoppen in de focus)
  let toolsTimer = 0;
  const compact = () => box.classList.contains('is-compact');
  function tools(on) {
    box.classList.toggle('is-tools', on);
    minBtn.setAttribute('aria-expanded', String(on));
    clearTimeout(toolsTimer);
    if (on) toolsTimer = setTimeout(() => tools(row.contains(document.activeElement) && document.documentElement.dataset.input === 'keyboard'), 2500);
  }
  minBtn.addEventListener('click', () => { if (compact()) tools(!box.classList.contains('is-tools')); else toggle(); });
  row.addEventListener('pointerdown', () => { if (compact()) tools(true); });
  row.addEventListener('focusin', () => { if (compact()) tools(true); });
  document.addEventListener('pointerdown', e => { if (box.classList.contains('is-tools') && !box.contains(e.target)) tools(false); }, true);
  go.addEventListener('click', toggle);
  wrap.addEventListener('click', () => { if (compact()) tools(!box.classList.contains('is-tools')); else toggle(); });
  function restart() { st = { dur: st.dur, endAt: 0, left: st.dur * 60000, done: false }; save(); schedule(); draw(); }
  reset.addEventListener('click', restart);
  durs.forEach(b => b.addEventListener('click', () => {
    const m = Number(b.textContent);
    st = { dur: m, endAt: 0, left: m * 60000, done: false };
    save(); draw();
  }));

  // uitklappen: het vak vult de ruimte boven het bakje
  function setOpen(on) {
    open = on;
    box.classList.toggle('is-open', on);
    expand.innerHTML = on ? ICON_CLOSE : ICON_OPEN;
    expand.setAttribute('aria-label', tx(on ? 'timer.collapse' : 'timer.expand'));
    expand.title = tx(on ? 'timer.collapse' : 'timer.expand');
    expand.setAttribute('aria-expanded', String(on));
    try { localStorage.setItem(UI_KEY, on ? 'open' : 'closed'); } catch { /* geen opslag */ }
  }
  expand.addEventListener('click', () => setOpen(!open));
  new ResizeObserver(() => { W = 0; draw(); }).observe(wrap);

  // het einde ook opmerken als de focus dicht is (geluid op tijd); wat lang geleden afliep, eindigt stil
  let endTimer = 0;
  function schedule() {
    clearTimeout(endTimer);
    if (st.endAt) endTimer = setTimeout(() => draw(), Math.max(0, st.endAt - Date.now()) + 50);
  }
  if (st.endAt && Date.now() - st.endAt > 60000) finish(true);
  setOpen(open);
  draw();
  schedule();
  return {
    start() { if (running) return; running = true; raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); tools(false); },
    // ook van buiten de focus (het glas op pc): pauzeren of verder, en opnieuw
    toggle() { st = timerState(); toggle(); },
    reset() { st = timerState(); restart(); },
    // toestand opnieuw lezen (gewijzigd op een ander toestel of in een ander tabblad)
    reload() { st = timerState(); if (st.endAt && Date.now() - st.endAt > 60000) finish(true); schedule(); draw(); },
  };
}
