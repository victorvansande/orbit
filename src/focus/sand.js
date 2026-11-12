/* ---- Zand: de zandloper van rasterpunten, getekend voor elke maat ---- */
// Eén tekening voor de zandloper in de focus (timer.js: uitgeklapt, ingeklapt en compact op gsm) en het kleine glas
// buiten de focus (glass.js), zodat ze overal dezelfde vorm en hetzelfde zand hebben (Victor, 12/11/2026: "trek alles
// gelijk"). Eén silhouet van rasterpunten, zoals een risoposter en zoals de kern: zand zijn volle punten, leeg glas zijn
// speldenprikjes. `createSand()` geeft `fit(W, H)` (maat van het vak in CSS-px) en `draw(g, q, opties)`: q is het deel
// dat nog boven zit (1..0); de aanroeper zet de transformatie, wist het vak en kiest de vulkleur.
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

export function createSand() {
  let W = 0, H = 0, glass = null;
  function fit(w, h) {
    if (w === W && h === H) return;
    W = w; H = h;
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
    glass = { top, bot, neckLen, bulb, R, neck, sp, rimW, wall, inner, uEnd, dz, vol: total * (small ? VOLUME_SMALL : VOLUME), round: sp * 3.2, dot0: small ? 0.14 : 0.12, cx: W / 2, neckTop: top + bulb, neckBot: top + bulb + neckLen };
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
  // boven: een vlak oppervlak op hoogte L boven de hals met een kuil (halve breedte cr) waar het zand wegloopt. De kuil
  // is een zachte kom (cos²: vlak in het midden, vloeiend over in het oppervlak), geen rechte V (Victor, 12/11/2026:
  // "zand valt natuurlijker en niet in zo'n rechte V"); steilste helling net onder SLOPE
  const DIP = 0.36;                                 // diepte van de kuil / halve breedte
  const dipAt = (cr, dx) => { if (dx >= cr) return 0; const c = Math.cos(dx / cr * Math.PI / 2); return DIP * cr * c * c; };
  function topArea(L, cr) {
    const { inner, dz } = glass, D = DIP * cr;
    let a = 0;
    for (let i = 0; i <= STEPS; i++) {
      const z = i * dz; if (z >= L) break;
      const open = L - z >= D ? 0 : cr * 2 / Math.PI * Math.acos(Math.sqrt((L - z) / D));   // halve breedte van de kuil op deze hoogte
      a += 2 * Math.max(0, inner[i] - open) * dz;
    }
    return a;
  }
  // de hoogte waarbij een oppervlak precies de gevraagde inhoud heeft
  function solve(fn, want, max) {
    let lo = 0, hi = max;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fn(m) < want) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // korrels die door de hals vallen (Inkt, gekozen door Victor uit zes varianten: rood en druk was te veel): om de 70 ms
  // een kans van 75 %, trage val, in de kleur van het zand; na de landing stuiteren ze even opzij en vervagen
  const KEEP = 0.75, GRAV = 600, LAND = 260;
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  function draw(g, q, { live = false, now = 0, still = false, pausedAt = -1e9, doneAt = -1e9 } = {}) {
    if (!glass) return;
    const { top, bot, bulb, R, cx, neckTop, neckBot, sp, rimW, wall, vol, round, dot0 } = glass;
    // onder: een kegel op de ronde bodem die breder wordt tot hij de wanden raakt en dan stijgt; boven: het zand zakt
    // vlak, met een zachte kuil boven de hals die breder wordt naarmate er zand weg is (en blijft staan bij een pauze), tot
    // het laatste zand als een kegel naar de hals loopt. Beide oppervlakken liggen onder dezelfde helling en hun hoogte
    // volgt uit de inhoud, dus wat boven verdwijnt ligt onder.
    const floor = bot - wall;                              // bodem van de holte: daar ligt het zand op
    const pile = q < 1 ? solve(pileArea, (1 - q) * vol, bulb * 1.6) : 0;
    const crater = R * 0.62 * smooth(0, 0.3, 1 - q), level = q > 0 ? solve(L => topArea(L, crater), q * vol, bulb + crater) : 0;
    let sandAt = dx => pile - SLOPE * (Math.sqrt(dx * dx + round * round) - round);   // hoogte van het zand boven de bodem
    if (live && !still) { const ph = (now / 2600) % 1, base = sandAt, Rb = pile / SLOPE; if (ph < 0.25 && pile > 0) { const sag = 1 - 0.06 * Math.sin(ph / 0.25 * Math.PI); sandAt = dx => base(dx) * (dx < Rb * 0.5 ? sag + (1 - sag) * dx / (Rb * 0.5) : 1); } }   // af en toe een klein lawinetje
    // zachte pauze: er vallen geen nieuwe korrels meer, wat al valt landt nog
    const settling = !live && now - pausedAt < 1500 && q > 0.001 && q < 1;
    const flowing = (live || settling) && q > 0.001;
    const soft = sp * 1.3;                                // verloop aan het oppervlak, in px: even scherp in een groot en een klein glas
    // golf door het zand als het laatste korreltje gevallen is
    const waveAge = (now - doneAt) / 1000, waving = !still && waveAge >= 0 && waveAge < 1.1, waveR = waveAge * 320;
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
        const d = up ? level - dipAt(crater, dx) - (neckTop - y) : sandAt(dx) - (floor - y);
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

  return { fit, draw };
}
