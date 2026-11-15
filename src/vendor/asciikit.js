/* Helpers uit de kit van ASCII Magic (https://www.ascii-magic.com/ascii/lib/kit.js), gedeeld door de stukken in
   src/vendor/colorpicker.js en src/vendor/spinners.js. (c) 2026 ASCII Magic, All Rights Reserved. Letterlijk
   overgenomen op uitdrukkelijke vraag van Victor (15/11/2026); enkel wat de stukken gebruiken (Grid zonder setZ,
   get, block, fill, line, circle, shade). */

export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return "#" + x(f(0)) + x(f(8)) + x(f(4));
}
export const KEYS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function palette(hexes) {
  const p = {};
  hexes.forEach((h, i) => (p[KEYS[i]] = h));
  return p;
}

export class Grid {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.ch = new Array(cols * rows).fill(" ");
    this.co = new Array(cols * rows).fill(" ");
    this.z = new Float32Array(cols * rows);
  }
  clear(ch = " ", co = " ") { this.ch.fill(ch); this.co.fill(co); this.z.fill(-Infinity); return this; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  /** Put a character (and optional colour key) at integer x,y. */
  set(x, y, ch, co) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = x + y * this.cols;
    this.ch[i] = ch; if (co !== undefined) this.co[i] = co;
  }
  /** Write a string left to right. */
  text(x, y, s, co) { for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i], co); }
  hline(x0, x1, y, ch = "─", co) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, ch, co); }
  vline(x, y0, y1, ch = "│", co) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, ch, co); }
  /** Box with light, heavy, double or round corners. */
  box(x, y, w, h, style = "light", co) {
    const S = {
      light: "┌┐└┘─│", heavy: "┏┓┗┛━┃", double: "╔╗╚╝═║", round: "╭╮╰╯─│", ascii: "++++-|",
    }[style] || style;
    this.hline(x + 1, x + w - 2, y, S[4], co); this.hline(x + 1, x + w - 2, y + h - 1, S[4], co);
    this.vline(x, y + 1, y + h - 2, S[5], co); this.vline(x + w - 1, y + 1, y + h - 2, S[5], co);
    this.set(x, y, S[0], co); this.set(x + w - 1, y, S[1], co);
    this.set(x, y + h - 1, S[2], co); this.set(x + w - 1, y + h - 1, S[3], co);
  }
  /** The frame a piece returns: plain text when no colours were used, else {text, color}. */
  frame() {
    const lines = [], cl = [];
    let colored = false;
    for (let y = 0; y < this.rows; y++) {
      lines.push(this.ch.slice(y * this.cols, (y + 1) * this.cols).join(""));
      const c = this.co.slice(y * this.cols, (y + 1) * this.cols).join("");
      if (!colored && c.trim()) colored = true;
      cl.push(c);
    }
    return colored ? { text: lines.join("\n"), color: cl.join("\n") } : lines.join("\n");
  }
}

