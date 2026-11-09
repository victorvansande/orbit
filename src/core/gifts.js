/* ---- Geschenken bij een nieuwe rang ---- */
// Victor, 09/11/2026: "bij elke level up van rank een soort van unlockable gift ... zoals cosmetics in een game, dat geen
// functionaliteit toevoegt maar gewoon een leuke beloning is". Eén geschenk per rang vanaf rang 2. Puur uiterlijk of klank:
// niets verandert aan taken, sync of telling. Een geschenk is ontgrendeld zodra de rang gehaald is (de rang zelf komt uit de
// punten en gaat dus mee met de sync); aan of uit is een keuze per toestel, zoals het thema. Nieuw ontgrendeld = aan.
// Victor wil ze pas zien als hij de rang haalt: namen en uitleg staan in i18n (`gift.<id>`), de app toont een
// niet-gehaald geschenk enkel als "Verrassing".

export const GIFTS = [
  { id: 'stamp', rank: 2 },     // afvinkrondje: vierpuntige ster in plaats van een vinkje (CSS, html.gift-stamp)
  { id: 'blush', rank: 3 },     // kern: twee blosjes onder de ogen (scene.js, drawCore)
  { id: 'stardust', rank: 4 },  // sterren aan de hemel in de kleuren van de momenten (scene.js, drawStars)
  { id: 'glass', rank: 5 },     // afvinkgeluid: tik tegen kristal (sound.js, SOUNDS.glas)
  { id: 'moon', rank: 6 },      // maantje rond de kern (scene.js, drawSatellites)
  { id: 'meteors', rank: 7 },   // vallende sterren om de 1 tot 3 min in plaats van om de 6 tot 14 (scene.js, drawMeteor)
  { id: 'tinted', rank: 8 },    // ringen zacht in de tint van hun moment (scene.js, drawRings)
  { id: 'milky', rank: 9 },     // vage melkweg achter de ringen (scene.js, drawMilky)
  { id: 'saturn', rank: 10 },   // schuine ring om de kern (scene.js, drawSatellites)
];

const KEY = 'priority-orbit.gifts.v1';   // { off: { id: 1 }, seen: hoogste rang waarvan de geschenken al gemeld zijn }

export function loadGiftPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') {
      const off = v.off && typeof v.off === 'object' && !Array.isArray(v.off) ? v.off : {};
      return { off: Object.fromEntries(Object.keys(off).filter(id => GIFTS.some(g => g.id === id)).map(id => [id, 1])), seen: Number.isFinite(v.seen) ? v.seen : 0 };
    }
  } catch { /* geen of onleesbare opslag */ }
  return { off: {}, seen: 0 };
}

export function saveGiftPrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify({ off: p.off, seen: p.seen })); } catch { /* geen opslag */ }
}

// ontgrendeld bij deze rang
export const giftsAt = level => GIFTS.filter(g => g.rank <= level);

// welke geschenken nu werken: ontgrendeld en niet uitgezet
export const activeGifts = (level, prefs) => new Set(giftsAt(level).filter(g => !prefs.off[g.id]).map(g => g.id));
