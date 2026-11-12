/* ---- Natuurvenster in het bakje: twee scènes achter het pijltje ---- */
// Victor (12/11/2026): het paludarium (src/focus/terra.js) en de Japanse tuin (src/focus/garden.js) zijn twee scènes
// van één fidget; het pijltje onder het bakje wisselt (hasPresets). De gekozen scène wordt per toestel onthouden.
// Elke scène wordt pas gemaakt als je ze opent, en enkel de zichtbare tekent.

import { createTerra } from './terra.js';
import { createGarden } from './garden.js';
import { tx } from '../core/i18n.js';

const SCENE_KEY = 'priority-orbit.nature.v1';
const SCENES = ['palu', 'garden'];

export function createNature({ reducedMotion, store, zoom = 1, onScene = () => {} }) {
  const made = {};
  let i = 0, host = null;
  try { const v = SCENES.indexOf(localStorage.getItem(SCENE_KEY)); if (v >= 0) i = v; } catch { /* geen opslag */ }
  const scene = () => {
    const k = SCENES[i];
    if (!made[k]) { made[k] = k === 'palu' ? createTerra({ reducedMotion, store, zoom }) : createGarden({ reducedMotion, zoom }); made[k].init(); }
    return made[k];
  };
  const announce = () => onScene(i, SCENES.length, tx(`nature.${SCENES[i]}`));
  return {
    own: true,
    onDark: true,
    get busy() { return false; },
    init() { scene(); announce(); },
    reload() { made.palu?.reload?.(); },
    mount(el) { host = el; scene().mount(el); announce(); },
    unmount() { scene().unmount(); host = null; },
    frame(now) { scene().frame(now); },
    next(d) {
      const el = host;
      if (el) scene().unmount();
      i = (i + d + SCENES.length) % SCENES.length;
      try { localStorage.setItem(SCENE_KEY, SCENES[i]); } catch { /* geen opslag */ }
      if (el) { host = el; scene().mount(el); }
      announce();
    },
    move(p) { scene().move?.(p); },
    down(p) { scene().down?.(p); },
    drag(p) { scene().drag?.(p); },
    up(p) { scene().up?.(p); },
    tap(p) { scene().tap?.(p); },
    leave() { scene().leave?.(); },
    recolor() {},
  };
}
