/* ---- Scores van de spelletjes in het bakje ---- */
// Wat een fidget bijhoudt (highscores, beste score) gaat mee in sync, export en import, net als de prestaties
// (Victor, 08/11/2026: "ook toekomstige fidgets met zaken die bijgehouden moeten worden").
// Nieuw spel: één regel in GAMES (naam en opslagsleutel) en in het bakje `scores.game(naam)` doorgeven.
// Hoe er samengevoegd wordt, volgt uit de vorm van de waarde, zodat ook een oudere versie scores van een nieuw spel
// juist samenvoegt en doorgeeft (bewaard onder EXTRA_KEY):
//   { top: [{ s, at, ... }] }  toplijst: alle regels van beide kanten (uniek op tijdstip en score), de beste n
//   { best, at }               beste score: de hoogste
//   { run, at }                een lopend spel (voortgang), of run = null als het gedaan is: het recentste wint
// Samenvoegen verliest dus nooit een score. Een nieuwe vorm: een soort in KINDS erbij.

export const GAMES = {
  breakout: { key: 'priority-orbit.breakout.v1', n: 5 },
  snake: { key: 'priority-orbit.snake.v1' },
  // lopend spel, zodat draaien, een andere maat van het bakje of herladen het niet wist (Victor, 10/11/2026)
  breakoutRun: { key: 'priority-orbit.breakoutrun.v1' },
  snakeRun: { key: 'priority-orbit.snakerun.v1' },
  // paludarium: de hele stand ({ run: { mist, lamp, yellow, nextY, frog, snail, fog, drops, fogAt }, at }), zodat het op elk
  // toestel en na elke sluiting hetzelfde is; een oudere versie bewaarde enkel { mist }
  terra: { key: 'priority-orbit.terra.v1' },
  // Japanse tuin: de lantaarns en de voren die je in het grind harkte ({ run: { lamp, rake }, at })
  garden: { key: 'priority-orbit.garden.v1' },
};
const EXTRA_KEY = 'priority-orbit.games.v1';   // spellen die enkel een nieuwere versie kent: bewaren en doorgeven
const TOP_N = 5;

const readJson = key => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* geen opslag */ } };
const num = v => (Number.isFinite(v) ? v : 0);

const KINDS = {
  top: {
    is: v => Array.isArray(v?.top),
    clean: v => ({ top: v.top.filter(e => e && Number.isFinite(e.s) && e.s > 0).map(e => ({ ...e, at: num(e.at) })) }),
    merge(a, b, name) {
      const seen = new Map();
      for (const e of [...a.top, ...b.top]) seen.set(`${e.at}:${e.s}`, e);
      return { top: [...seen.values()].sort((x, y) => y.s - x.s || x.at - y.at).slice(0, GAMES[name]?.n || TOP_N) };
    },
    sig: v => v.top.map(e => `${e.at}:${e.s}`).join(','),
  },
  best: {
    is: v => Number.isFinite(v?.best),
    clean: v => ({ ...v, best: Math.max(0, v.best), at: num(v.at) }),
    merge: (a, b) => (b.best > a.best ? b : a),
    sig: v => String(v.best),
  },
  run: {
    is: v => v && typeof v === 'object' && 'run' in v && Number.isFinite(v.at),
    clean: v => ({ run: v.run && typeof v.run === 'object' ? v.run : null, at: num(v.at) }),
    merge: (a, b) => (b.at > a.at ? b : a),
    sig: v => String(v.at),
  },
};
const kindOf = v => Object.values(KINDS).find(k => k.is(v));

function mergeOne(a, b, name) {
  const ka = kindOf(a), kb = kindOf(b);
  if (!ka) return kb ? kb.clean(b) : undefined;
  if (!kb || kb !== ka) return ka.clean(a);   // onbekende of andere vorm: de eigen waarde blijft
  return ka.merge(ka.clean(a), kb.clean(b), name);
}

// scores = { naam: waarde }; een oudere versie stuurt er geen
export function mergeScores(a, b) {
  const out = {};
  for (const name of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const v = mergeOne(a?.[name], b?.[name], name);
    if (v) out[name] = v;
  }
  return out;
}

export const scoresSig = s => Object.keys(s || {}).sort().map(n => { const k = kindOf(s[n]); return k ? `${n}=${k.sig(k.clean(s[n]))}` : ''; }).join('|');

export function loadScores() {
  const s = { ...(readJson(EXTRA_KEY) || {}) };
  for (const [name, { key }] of Object.entries(GAMES)) { const v = readJson(key); if (v) s[name] = v; else delete s[name]; }
  return mergeScores(s, null);
}

export function saveScores(s) {
  const m = mergeScores(s, null), extra = {};
  for (const [name, v] of Object.entries(m)) {
    if (GAMES[name]) writeJson(GAMES[name].key, v); else extra[name] = v;
  }
  if (Object.keys(extra).length) writeJson(EXTRA_KEY, extra);
  return m;
}

export const isScoreKey = key => key === EXTRA_KEY || Object.values(GAMES).some(g => g.key === key);

// Opslag voor één spel (src/focus kent src/data niet): app.js geeft dit via het bakje door.
// save voegt samen met wat er al staat en meldt een wijziging enkel als er echt iets bijkwam.
export function createScoreStore(onChange) {
  return {
    game: name => ({
      load: () => loadScores()[name],
      save(v) {
        const cur = loadScores(), next = mergeScores(cur, { [name]: v });
        if (scoresSig(next) === scoresSig(cur)) return;
        saveScores(next);
        onChange();
      },
    }),
  };
}
