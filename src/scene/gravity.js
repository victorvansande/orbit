/* ---- Zwaartekracht rond een niet-draaiend zwart gat (Schwarzschild) ---- */
// Zuivere rekenfuncties voor het zwarte gat (src/scene/hole.js); geen DOM. Eenheden G = c = M = 1: horizon r = 2,
// fotonbaan r = 3 (kritische botsparameter b = 3√3), binnenste stabiele cirkelbaan r = 6.
// Bronnen van de vergelijkingen: lichtbanen en deeltjesbanen volgen de vergelijking van Binet voor Schwarzschild,
// u'' + u = 3u² (licht) en u'' + u = 1/L² + 3u² (materie), hier geschreven als een centrale versnelling in
// cartesische coördinaten (r de omtrekstraal van Schwarzschild); getijden en roodverschuiving uit de metriek zelf.

export const D = 4000;                        // afstand van de camera: een verre toeschouwer, zodat de schaal op het hele scherm dezelfde is
export const PXM = 2.8;                       // schermpixels per M bij een gat van 120 px breed
export const ELEV = 7.5 * Math.PI / 180;      // hoogte van de camera boven het vlak van de schijf
export const R_IN = 6, R_OUT = 17;            // schijf: van de binnenste stabiele baan tot 17
export const FOV = 60 / (PXM * D);             // halve beeldbreedte (tangens)
const CAM = [0, D * Math.sin(ELEV), D * Math.cos(ELEV)];
const FWD = [0, -Math.sin(ELEV), -Math.cos(ELEV)], RIGHT = [1, 0, 0], UP = [0, Math.cos(ELEV), -Math.sin(ELEV)];

/* ---- Beeld van de schijf: één lichtstraal terug vanaf de camera ---- */
// x'' = -3 h² x / r^5 met h = |x × v| geeft exact de lichtbanen. Tot drie kruisingen met de schijf, of gevangen,
// of voorbij.
export function trace(sx, sy) {
  let px = CAM[0], py = CAM[1], pz = CAM[2], s = 0;   // s: afgelegde weg (= reistijd van het licht, voor de lichtecho)
  let vx = FWD[0] + FOV * (sx * RIGHT[0] + sy * UP[0]), vy = FWD[1] + FOV * (sx * RIGHT[1] + sy * UP[1]), vz = FWD[2] + FOV * (sx * RIGHT[2] + sy * UP[2]);
  const n = Math.hypot(vx, vy, vz); vx /= n; vy /= n; vz /= n;
  const cx = py * vz - pz * vy, cy = pz * vx - px * vz, cz = px * vy - py * vx, h2 = cx * cx + cy * cy + cz * cz;
  const acc = (x, y, z) => { const r2 = x * x + y * y + z * z, k = -3 * h2 / (r2 * r2 * Math.sqrt(r2)); return [k * x, k * y, k * z]; };
  const hits = [];
  for (let i = 0; i < 3000; i++) {
    const r = Math.hypot(px, py, pz);
    if (r < 2.02) return { hits };
    if (r > 40 && px * vx + py * vy + pz * vz > 0) return { hits };   // voorbij de schijf en op weg naar buiten
    const dt = Math.max(0.012, 0.06 * (r - 1.6));   // ver weg grote stappen (de baan is daar recht), dichtbij fijn
    const a1 = acc(px, py, pz);
    const v2 = [vx + a1[0] * dt / 2, vy + a1[1] * dt / 2, vz + a1[2] * dt / 2], a2 = acc(px + vx * dt / 2, py + vy * dt / 2, pz + vz * dt / 2);
    const v3 = [vx + a2[0] * dt / 2, vy + a2[1] * dt / 2, vz + a2[2] * dt / 2], a3 = acc(px + v2[0] * dt / 2, py + v2[1] * dt / 2, pz + v2[2] * dt / 2);
    const v4 = [vx + a3[0] * dt, vy + a3[1] * dt, vz + a3[2] * dt], a4 = acc(px + v3[0] * dt, py + v3[1] * dt, pz + v3[2] * dt);
    const nx = px + dt / 6 * (vx + 2 * v2[0] + 2 * v3[0] + v4[0]), ny = py + dt / 6 * (vy + 2 * v2[1] + 2 * v3[1] + v4[1]), nz = pz + dt / 6 * (vz + 2 * v2[2] + 2 * v3[2] + v4[2]);
    const nvx = vx + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]), nvy = vy + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]), nvz = vz + dt / 6 * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]);
    if (py * ny < 0) {
      const f = py / (py - ny), hx = px + (nx - px) * f, hz = pz + (nz - pz) * f, rr = Math.hypot(hx, hz);
      if (rr >= R_IN && rr <= R_OUT) {
        // roodverschuiving van gas op een cirkelbaan: g = sqrt(1 - 3/r) / (1 - Ω L), Ω = r^-1,5, L = impulsmoment van
        // het foton om de as (we volgen terug, dus het foton zelf beweegt tegen v in)
        const kx = -(vx + (nvx - vx) * f), kz = -(vz + (nvz - vz) * f), L = hz * kx - hx * kz;
        hits.push({ r: rr, phi: Math.atan2(hz, hx), g: Math.sqrt(1 - 3 / rr) / (1 - Math.pow(rr, -1.5) * L), k: hits.length, s: s + dt * f });
        if (hits.length >= 3) return { hits };
      }
    }
    s += dt; px = nx; py = ny; pz = nz; vx = nvx; vy = nvy; vz = nvz;
  }
  return { hits };
}
// helderheid van de schijf per oppervlak (vorm van Page en Thorne, genormaliseerd op haar maximum)
export const emit = r => { const x = R_IN / r; return Math.max(0, (1 - Math.sqrt(x)) * x * x * x) / 0.0255; };
/* ---- Lens voor een voorwerp naast het gat ---- */
// Een puntbron in het hemelvlak (het vlak door het gat, loodrecht op de kijklijn) op afstand r heeft een hoofdbeeld aan
// haar eigen kant en een tweede beeld aan de overkant, vlak bij de fotonring (het licht loopt driekwart rond het gat).
// Door de bolsymmetrie volstaat één doorsnede: een straal vanaf de camera onder hoek α kruist het hemelvlak een eerste
// keer (hoofdbeeld van een bron op die afstand) en, als hij genoeg afbuigt, een tweede keer aan de andere kant.
function ray2d(alpha, plane = 0) {
  let x = D, y = 0, vx = -Math.cos(alpha), vy = Math.sin(alpha);
  const h2 = (x * vy - y * vx) ** 2;
  const acc = (px, py) => { const r2 = px * px + py * py, k = -3 * h2 / (r2 * r2 * Math.sqrt(r2)); return [k * px, k * py]; };
  let r0 = null, r1 = null, back = null, turned = false;
  for (let i = 0; i < 20000; i++) {
    const r = Math.hypot(x, y);
    if (r < 2.0005) return { r0, r1, back, cap: true };
    if (r > 90 && x * vx + y * vy > 0 && (!plane || x < -plane - 1)) return { r0, r1, back, cap: false };
    const dt = Math.max(0.004, 0.04 * (r - 1.9));
    const a1 = acc(x, y);
    const v2 = [vx + a1[0] * dt / 2, vy + a1[1] * dt / 2], a2 = acc(x + vx * dt / 2, y + vy * dt / 2);
    const v3 = [vx + a2[0] * dt / 2, vy + a2[1] * dt / 2], a3 = acc(x + v2[0] * dt / 2, y + v2[1] * dt / 2);
    const v4 = [vx + a3[0] * dt, vy + a3[1] * dt], a4 = acc(x + v3[0] * dt, y + v3[1] * dt);
    const nx = x + dt / 6 * (vx + 2 * v2[0] + 2 * v3[0] + v4[0]), ny = y + dt / 6 * (vy + 2 * v2[1] + 2 * v3[1] + v4[1]);
    if (vx > 0) turned = true;   // omgekeerd: die straal ziet het vlak erachter niet meer rechtstreeks
    if (plane && back == null && !turned && x > -plane && nx <= -plane) back = y + (ny - y) * ((x + plane) / (x - nx));
    if (r0 == null && x > 0 && nx <= 0 && y > 0) r0 = y + (ny - y) * (x / (x - nx));
    else if (r0 != null && r1 == null && x < 0 && nx >= 0 && y < 0) r1 = -(y + (ny - y) * (x / (x - nx)));   // verder volgen: gevangen of niet bepaalt de schaduwrand
    vx += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); vy += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    x = nx; y = ny;
  }
  return { r0, r1, cap: false };
}
// botsparameter b = L/E van een straal die bij de camera hoek α maakt met de richting naar het gat
export const impact = alpha => D / Math.sqrt(1 / Math.tan(alpha) ** 2 + 1 - 2 / D);

// Tabellen r -> beeldhoek. `primary(r)` en `secondary(r)` geven { tan, b } (tangens van de beeldhoek, botsparameter)
// of null; `radius(tan)` is het omgekeerde van het hoofdbeeld (waar staat een bron die je op die plek ziet?).
// In stukjes: `lensSteps()` is een generator die na elke straal even pauzeert (yield) en aan het eind de tabel geeft,
// zodat het rekenwerk over rustige momenten gespreid kan worden; `lensTable()` rekent alles in één keer (controles).
const runAll = it => { let r; while (!(r = it.next()).done); return r.value; };
export const lensTable = () => runAll(lensSteps());
export function* lensSteps() {
  let lo = 1 / D, hi = 12 / D;   // kritische hoek: de rand van de schaduw
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ray2d(m).cap) lo = m; else hi = m; yield; }
  const crit = (lo + hi) / 2;
  const P = [], S = [];
  const add = a => { const q = ray2d(a); if (q.r0 != null && q.r0 >= 2) P.push([a, q.r0]); if (q.r1 != null && q.r1 >= 2) S.push([a, q.r1]); };
  const aMax = Math.atan(FOV * 6);   // tot ongeveer 360 px van het gat: binnen 300 px grijpt het gat de bol al vast
  for (let i = 1; i <= 600; i++) { add(aMax * i / 600); yield; }
  for (let i = 0; i <= 260; i++) { add(crit * (0.7 + 0.75 * i / 260)); yield; }
  for (let k = 1; k <= 28; k++) { const e = Math.pow(10, -k / 4); add(crit * (1 + e)); add(crit * (1 - e)); yield; }
  const mono = list => { list.sort((p, q) => p[0] - q[0]); const out = []; for (const e of list) if (!out.length || e[1] > out[out.length - 1][1]) out.push(e); return out; };
  const p = mono(P), s = mono(S);
  const at = (list, r) => {   // hoek bij straal r (lineair tussen de steunpunten)
    if (!list.length || r < list[0][1] || r > list[list.length - 1][1]) return null;
    let a = 0, b = list.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (list[m][1] <= r) a = m; else b = m; }
    const f = (r - list[a][1]) / ((list[b][1] - list[a][1]) || 1), al = list[a][0] + (list[b][0] - list[a][0]) * f;
    return { tan: Math.tan(al), b: impact(al) };
  };
  return {
    crit: Math.tan(crit),                       // schaduwrand (tangens)
    rMax: p[p.length - 1][1],
    primary: r => at(p, r),
    secondary: r => at(s, r),
    radius(tan) {
      const al = Math.atan(tan);
      if (al <= p[0][0]) return p[0][1];
      if (al >= p[p.length - 1][0]) return p[p.length - 1][1];
      let a = 0, b = p.length - 1;
      while (b - a > 1) { const m = (a + b) >> 1; if (p[m][0] <= al) a = m; else b = m; }
      return p[a][1] + (p[b][1] - p[a][1]) * (al - p[a][0]) / (p[b][0] - p[a][0]);
    },
  };
}

/* ---- Lens voor het raster achter het gat ---- */
// Het stippenraster is een vlak op afstand `depth` achter het gat, loodrecht op de kijklijn. Een punt van dat vlak dat
// je zonder gat op afstand t van het gat zou zien (tangens van de hoek), zie je met gat op twee plekken: het hoofdbeeld
// aan dezelfde kant, naar buiten geschoven tot voorbij de ring van Einstein, en een tweede beeld aan de overkant,
// binnen die ring. Licht buigt naar het gat toe, dus beelden schuiven ervan weg. Staat een punt recht achter het gat,
// dan vloeien de twee beelden samen tot een ring. De helderheid per oppervlak blijft gelijk; het beeld wordt in de
// richting van het gat samengedrukt (factor `slope`) en dwars uitgerekt (beeldafstand / bronafstand).
// `primary(t, out)` en `secondary(t, out)` zetten [tangens van het beeld, slope] in `out` en geven false als er geen is.
// Eén afspraak: de afstandsmaat rond een zwart gat loopt niet gelijk met die van vlakke ruimte (een lichtstraal loopt
// ongeveer 1 M dichter langs het gat dan haar richting van ver doet verwachten), dus "hetzelfde punt met en zonder gat"
// ligt niet vanzelf vast. We leggen het raster zo dat punten ver van het gat op hun plaats blijven (`far`, gemeten op
// 250 M); wat overblijft is de buiging dichtbij.
export const backdropTable = depth => runAll(backdropSteps(depth));
export function* backdropSteps(depth) {
  const bc = Math.sqrt(27), pts = [];
  const alphaOf = b => Math.atan(1 / Math.sqrt(D * D / (b * b) - 1 + 2 / D));
  const ref = alphaOf(250), far = (D + depth) * Math.tan(ref) - ray2d(ref, depth).back;
  for (let i = 0; i <= 360; i++) {
    const al = alphaOf(bc + 1e-2 * Math.pow(2.6e4, i / 360)), q = ray2d(al, depth);
    if (!q.cap && q.back != null) pts.push([Math.tan(al), q.back * (1 + far / Math.hypot(q.back, depth)) / (D + depth)]);
    yield;
  }
  const list = [];
  for (const e of pts) if (!list.length || e[1] > list[list.length - 1][1]) list.push(e);
  const find = (v, out) => {
    if (v < list[0][1]) return false;
    if (v >= list[list.length - 1][1]) { out[0] = v; out[1] = 1; return true; }   // ver weg: geen merkbare buiging meer
    let a = 0, b = list.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (list[m][1] <= v) a = m; else b = m; }
    const sl = (list[b][0] - list[a][0]) / (list[b][1] - list[a][1]);
    out[0] = list[a][0] + (v - list[a][1]) * sl; out[1] = sl;
    return true;
  };
  return { primary: (t, out) => find(t, out), secondary: (t, out) => find(-t, out) };
}

/* ---- Materie: vrije val in de tijd van een verre toeschouwer ---- */
// Een deeltje {x, y, ux, uy} in zijn baanvlak (u = dx/dτ, eigentijd). Exacte baan: d²x/dτ² = -(1/r³ + 3L²/r^5) x met
// L = x·uy - y·ux. We stappen in coördinaattijd t (wat een verre toeschouwer meet): dτ = dt (1 - 2/r) / E, met
// E² = (1 - 2/r)(1 + L²/r²) + (dr/dτ)². Bij de horizon gaat dτ naar nul: het deeltje lijkt te bevriezen.
// Geeft false zodra het deeltje de horizon zo dicht genaderd is dat het voor de toeschouwer stilstaat.
export function stepFree(p, dt, sub = 6) {
  const h = dt / sub;
  for (let i = 0; i < sub; i++) {
    let r = Math.hypot(p.x, p.y);
    if (r < 2.004) return false;
    const L = p.x * p.uy - p.y * p.ux, rd = (p.x * p.ux + p.y * p.uy) / r, f = 1 - 2 / r;
    const E = Math.sqrt(f * (1 + L * L / (r * r)) + rd * rd);
    const dtau = h * f / E;
    p.tau = (p.tau || 0) + dtau;   // verstreken eigentijd (voor de controle tegen de theorie)
    let k = -(1 / (r * r * r) + 3 * L * L / (r ** 5));
    p.ux += k * p.x * dtau / 2; p.uy += k * p.y * dtau / 2;
    p.x += p.ux * dtau; p.y += p.uy * dtau;
    r = Math.hypot(p.x, p.y);
    if (r < 2.004) return false;
    k = -(1 / (r * r * r) + 3 * L * L / (r ** 5));
    p.ux += k * p.x * dtau / 2; p.uy += k * p.y * dtau / 2;
  }
  return true;
}
// behouden energie per massa van een deeltje (1 = uit rust op oneindig)
export function energy(p) {
  const r = Math.hypot(p.x, p.y), L = p.x * p.uy - p.y * p.ux, rd = (p.x * p.ux + p.y * p.uy) / r;
  return Math.sqrt((1 - 2 / r) * (1 + L * L / (r * r)) + rd * rd);
}
// Verhouding ontvangen / uitgezonden frequentie voor licht van een deeltje in het hemelvlak naar de verre camera.
// Het licht vertrekt in het vlak door de kijklijn, dus loodrecht op de dwarssnelheid van het deeltje: enkel de radiale
// snelheid en de tijdvertraging tellen. `b` is de botsparameter van dat beeld, `out` of het licht eerst naar buiten gaat
// (hoofdbeeld) of eerst naar binnen (tweede beeld). Stilstaand: sqrt(1 - 2/r); invallend bij de horizon: naar nul.
export function shift(p, b, out = true) {
  const r = Math.hypot(p.x, p.y), f = 1 - 2 / r, rd = (p.x * p.ux + p.y * p.uy) / r;
  const kr = Math.sqrt(Math.max(0, 1 - b * b * f / (r * r))) * (out ? 1 : -1);
  return f / (energy(p) - kr * rd);
}
// gewicht per massa van iets dat stil gehouden wordt op afstand r (wordt oneindig aan de horizon)
export const weight = r => 1 / (r * r * Math.sqrt(1 - 2 / r));
