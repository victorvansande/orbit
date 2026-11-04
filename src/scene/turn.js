// Maandwissel: vier uitwerkingen van de zwaartekracht (Victor, 04/11/2026: "Kan je z1 tot en met z4 allemaal uitwerken en
// elke maand random kiezen uit een van de vier animaties?"; voorstellen in ontwerp/maandwissel/zwaartekracht.html).
// Dit bestand legt per variant de tijdlijn vast, in tijd (s) en in hemeleenheden (de stage-eenheden van de sterren).
// Beeld (scene.js) en geluid (sound.js) lezen dezelfde tijdlijn, dus elk tikje valt op het moment dat een ster aankomt.
// Geen DOM, geen canvas.

export const TURN_STYLES = ['slok', 'kolk', 'beeld', 'adem'];   // Z1 Opgeslokt, Z2 Draaikolk, Z3 Sterrenbeeld, Z4 Inademen

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const pullEase = u => u * u * (1.6 - 0.6 * u);   // zacht vertrek, versnelt, zonder ruk op het einde
const SKY_IN = 50, SKY_OUT = 250, CORE_U = 30;          // binnen- en buitenrand van de hemel, rand van de kern (eenheden)

// Elke maand een andere variant: per blok van vier maanden een vaste, geschudde volgorde van de vier, zodat je ze alle vier
// ziet en nooit twee keer na elkaar dezelfde. Vast per maand (geen toeval per toestel), dus elk gekoppeld toestel speelt
// dezelfde.
function hash(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; }
function blockOrder(b) {
  const o = [0, 1, 2, 3];
  let h = hash(b + 7919);
  for (let i = 3; i > 0; i--) { const j = h % (i + 1); h = hash(h + i); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
export function turnStyle(date) {
  const k = date.getFullYear() * 12 + date.getMonth(), b = Math.floor(k / 4), o = blockOrder(b);
  if (o[0] === blockOrder(b - 1)[3]) [o[0], o[1]] = [o[1], o[0]];
  return TURN_STYLES[o[k % 4]];
}

// vaste getallen per ster uit haar fase (zelfde ster, zelfde beweging)
const frac = v => v - Math.floor(v);
const rnd = (st, k) => frac(Math.sin((st.ph || 0) * 12.9898 + k * 78.233) * 43758.5453);

// plan(style, sterren): tijdlijn en per ster wat de scène nodig heeft.
// light: wanneer het licht begint (zacht vanuit de kern, of een flits); end: einde van de wissel in de scène.
// arrivals: [{t, u, a}] een ster bereikt de kern (u = 0 dichtbij .. 1 ver, a = hoek bij aankomst, voor links en rechts);
// layers: tijden waarop een laag van het sterrenbeeld zich tekent (Z3); collapse: de schijf knijpt dicht (Z2).
export function turnPlan(style, stars) {
  const N = stars.length;
  const S = stars.map((st, i) => {
    const r0 = Math.hypot(st.x, st.y);
    return { i, st, r0, a0: Math.atan2(st.y, st.x), ur: clamp((r0 - SKY_IN) / (SKY_OUT - SKY_IN), 0, 1), r1: rnd(st, 1), r2: rnd(st, 2) };
  });
  const plan = { style: TURN_STYLES.includes(style) ? style : 'slok', stars: S, arrivals: [], layers: [], collapse: 0 };

  if (plan.style === 'slok') {
    // Z1 Opgeslokt: van binnen naar buiten, steeds dichter op elkaar; elke aankomst is een slok van de kern
    [...S].sort((p, q) => p.r0 - q.r0).forEach((s, k) => { s.u = N > 1 ? k / (N - 1) : 1; });
    for (const s of S) { s.T = 1.45 + 2.95 * Math.sqrt(s.u); s.F = 0.75 + 1.45 * s.ur; s.w = 0.9 + 1.6 * (0.36 + 0.64 * s.ur); }
    const last = Math.max(...S.map(s => s.T));
    plan.light = last + 0.42; plan.kind = 'soft'; plan.inhale = [last + 0.05, plan.light];
    plan.arrivals = S.map(s => ({ t: s.T, u: s.u, a: s.a0 + s.w }));
  } else if (plan.style === 'kolk') {
    // Z2 Draaikolk: eerst een platte schijf rond de kern, die sneller draait en dichtknijpt; dan een flits
    plan.collapse = 4.55; plan.light = plan.collapse; plan.kind = 'flood';
  } else if (plan.style === 'beeld') {
    // Z3 Sterrenbeeld: kortste verbindingen (Prim) vanaf de kern, daarna schuiven de sterren als kralen naar binnen
    const inTree = new Array(N).fill(false), dist = S.map(s => Math.max(1, s.r0 - CORE_U)), par = new Array(N).fill(-1);
    for (let n = 0; n < N; n++) {
      let b = -1;
      for (let i = 0; i < N; i++) if (!inTree[i] && (b < 0 || dist[i] < dist[b])) b = i;
      inTree[b] = true; S[b].parent = par[b];
      for (let j = 0; j < N; j++) if (!inTree[j]) {
        const d = Math.hypot(S[j].st.x - S[b].st.x, S[j].st.y - S[b].st.y);
        if (d < dist[j]) { dist[j] = d; par[j] = b; }
      }
    }
    for (const s of S) {
      const path = [s.i], lens = []; let p = s, depth = 0;
      while (p.parent >= 0) { const q = S[p.parent]; lens.push(Math.hypot(q.st.x - p.st.x, q.st.y - p.st.y)); path.push(q.i); p = q; depth++; }
      lens.push(Math.max(1, p.r0 - CORE_U));   // laatste stuk: naar de rand van de kern
      s.path = path; s.lens = lens; s.L = lens.reduce((x, y) => x + y, 0); s.depth = depth;
    }
    const maxD = Math.max(0, ...S.map(s => s.depth)), maxL = Math.max(1, ...S.map(s => s.L));
    plan.step = Math.min(0.2, 1.5 / Math.max(1, maxD)); plan.draw = 0.35;
    plan.tC = 0.35 + maxD * plan.step + plan.draw + 0.45; plan.dur = 2.5; plan.maxL = maxL;
    for (const s of S) {
      s.lit = 0.35 + s.depth * plan.step + plan.draw;
      let lo = 0, hi = 1;
      for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (maxL * pullEase(m) < s.L) lo = m; else hi = m; }
      s.T = plan.tC + hi * plan.dur;
      const root = S[s.path[s.path.length - 1]];
      s.u = s.L / maxL;
      plan.arrivals.push({ t: s.T, u: s.u, a: root.a0 });
    }
    for (let d = 0; d <= maxD; d++) plan.layers.push(0.35 + d * plan.step + 0.1);
    plan.light = plan.tC + plan.dur + 0.42; plan.kind = 'soft'; plan.inhale = [plan.light - 0.38, plan.light];
  } else {
    // Z4 Inademen: de hele hemel zakt als één geheel naar de kern; de kern ademt in, houdt vast en ademt uit
    plan.inEnd = 4.35; plan.light = 4.75; plan.kind = 'soft';
  }
  plan.arrivals.sort((p, q) => p.t - q.t);
  plan.T = plan.arrivals.map(x => x.t);
  plan.end = plan.light + 3.1;
  return plan;
}

// hoeveel sterren er al in de kern zitten op tijd t (binair zoeken in de gesorteerde aankomsten)
export function arrived(plan, t) {
  const T = plan.T; let lo = 0, hi = T.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m + 1; else hi = m; }
  return lo;
}
