// Props that come back in every interlude (the motifs) and the small things of her house.
// They are drawn lit, not as flat cut-outs: a cylinder of a mug has a lit side and a shadow side,
// paper has a warm side toward the lamp. All units are world units; `lx` is the light's
// direction on x (-1 from the left, 1 from the right).
import { rgba, mixHex } from './core';
import { blob } from './rig';

type C = CanvasRenderingContext2D;

/**
 * The chipped lab mug: white hospital-issue ceramic, a faded blue band, the chip always on the left
 * of the rim (seen from her side). `fill` 0..1 how much coffee is in it. Bottom centre at (x, y).
 */
export function mug(c: C, x: number, y: number, h: number, lx: number, o: { light: string; dark?: number; fill?: number; tilt?: number; handle?: 1 | -1 } = { light: '#f0c48a' }) {
  const w = h * 0.82, r = w / 2, e = h * 0.13, dark = o.dark ?? 0.55, hs = o.handle ?? 1;
  c.save(); c.translate(x, y); if (o.tilt) c.rotate(o.tilt);
  const base = mixHex('#e8e2d6', '#1a1414', dark);
  // handle
  c.lineWidth = h * 0.11; c.strokeStyle = mixHex('#d8d0c2', '#120e0e', Math.min(1, dark + (hs === Math.sign(lx) ? -0.2 : 0.15)));
  c.beginPath(); c.moveTo(hs * r * 0.92, -h * 0.78); c.bezierCurveTo(hs * (r + h * 0.42), -h * 0.8, hs * (r + h * 0.42), -h * 0.2, hs * r * 0.92, -h * 0.25); c.stroke();
  // body: lit side to shadow side across the cylinder
  const g = c.createLinearGradient(-r, 0, r, 0);
  const lit = mixHex('#fbf3e4', o.light, 0.35), sh = mixHex(base, '#000000', 0.45);
  if (lx > 0) { g.addColorStop(0, sh); g.addColorStop(0.55, base); g.addColorStop(0.86, lit); g.addColorStop(1, mixHex(lit, base, 0.5)); }
  else { g.addColorStop(0, mixHex(lit, base, 0.5)); g.addColorStop(0.14, lit); g.addColorStop(0.45, base); g.addColorStop(1, sh); }
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-r, -h); c.lineTo(-r * 0.97, -e * 0.4); c.quadraticCurveTo(0, e * 0.6, r * 0.97, -e * 0.4); c.lineTo(r, -h); c.closePath(); c.fill();
  // the faded blue band of a hospital mug, no words
  c.save(); c.clip();
  c.fillStyle = rgba('#5a7a96', 0.42 * (1 - dark * 0.6)); c.fillRect(-r, -h * 0.62, w, h * 0.12);
  c.fillStyle = rgba('#5a7a96', 0.3 * (1 - dark * 0.6)); c.fillRect(-r, -h * 0.45, w, h * 0.035);
  c.restore();
  // rim and the coffee inside
  c.fillStyle = mixHex('#2a170e', '#000000', dark * 0.5);
  c.beginPath(); c.ellipse(0, -h, r, e, 0, 0, Math.PI * 2); c.fill();
  if ((o.fill ?? 0.8) > 0) {
    c.fillStyle = mixHex('#3a1e10', '#000', dark * 0.4);
    c.beginPath(); c.ellipse(0, -h + e * 0.35, r * 0.9, e * 0.75, 0, 0, Math.PI * 2); c.fill();
    // the lamp's reflection on the coffee
    c.fillStyle = rgba(o.light, 0.35);
    c.beginPath(); c.ellipse(lx * r * 0.35, -h + e * 0.25, r * 0.22, e * 0.22, 0, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = mixHex('#f8f0e0', '#2a2020', dark * 0.8); c.lineWidth = h * 0.035;
  c.beginPath(); c.ellipse(0, -h, r, e, 0, 0, Math.PI * 2); c.stroke();
  // the chip, on the left of the rim
  c.fillStyle = mixHex('#7a6a5a', '#100c0c', dark);
  c.beginPath(); c.moveTo(-r * 0.86, -h - e * 0.5); c.lineTo(-r * 0.62, -h - e * 0.8); c.lineTo(-r * 0.7, -h - e * 0.05); c.closePath(); c.fill();
  c.restore();
}

/** A sheet of paper, lit from one side, slightly curled. Optional text lines (as grey bars) or real text. */
export function paper(c: C, x: number, y: number, w: number, h: number, a: number, o: { light: string; dark: number; lines?: number; text?: string[]; font?: number; fold?: boolean }) {
  c.save(); c.translate(x, y); c.rotate(a);
  const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  const tone = mixHex('#efe4d0', '#1a1410', o.dark);
  g.addColorStop(0, mixHex(tone, o.light, 0.25)); g.addColorStop(1, mixHex(tone, '#000', 0.25));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.quadraticCurveTo(w / 2 + w * 0.02, 0, w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); c.fill();
  if (o.fold) { c.strokeStyle = rgba('#000', 0.18); c.lineWidth = h * 0.006; c.beginPath(); c.moveTo(-w / 2, -h / 6); c.lineTo(w / 2, -h / 6); c.moveTo(-w / 2, h / 6); c.lineTo(w / 2, h / 6); c.stroke(); }
  if (o.text) {
    const fs = o.font ?? h * 0.05;
    c.fillStyle = mixHex('#2a2620', '#000', o.dark * 0.5); c.font = `400 ${fs}px Georgia, "Times New Roman", serif`; c.textBaseline = 'top';
    o.text.forEach((t, i) => c.fillText(t, -w / 2 + w * 0.1, -h / 2 + h * 0.1 + i * fs * 1.5, w * 0.8));
  } else if (o.lines) {
    c.fillStyle = rgba(mixHex('#5a5048', '#000', o.dark * 0.6), 0.6);
    for (let i = 0; i < o.lines; i++) c.fillRect(-w / 2 + w * 0.12, -h / 2 + h * 0.16 + i * h * 0.085, w * (i === o.lines - 1 ? 0.4 : 0.74), h * 0.022);
  }
  c.restore();
}

/** The trial brochure: glossy, a sunrise over water on the cover. Too small to read unless close. */
export function brochure(c: C, x: number, y: number, w: number, h: number, a: number, o: { light: string; dark: number; words?: boolean; gen?: 3 | 4 }) {
  c.save(); c.translate(x, y); c.rotate(a);
  const d = o.dark;
  const sky = c.createLinearGradient(0, -h / 2, 0, h * 0.15);
  sky.addColorStop(0, mixHex(o.gen === 4 ? '#7fb6c8' : '#f2c27a', '#100c0c', d)); sky.addColorStop(1, mixHex(o.gen === 4 ? '#d8eef0' : '#f7e2b6', '#100c0c', d));
  c.fillStyle = sky; c.fillRect(-w / 2, -h / 2, w, h * 0.65);
  c.fillStyle = mixHex(o.gen === 4 ? '#ffffff' : '#fff2cc', '#100c0c', d); c.beginPath(); c.arc(0, h * 0.12, w * 0.16, Math.PI, 0); c.fill();
  c.fillStyle = mixHex(o.gen === 4 ? '#3c7d92' : '#c9783a', '#100c0c', d); c.fillRect(-w / 2, h * 0.15, w, h * 0.35);
  c.fillStyle = mixHex('#ffffff', '#100c0c', d); c.fillRect(-w / 2 + w * 0.1, -h / 2 + h * 0.08, w * 0.6, h * 0.06);
  // gloss: a soft diagonal sheen toward the light
  const gl = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  gl.addColorStop(0, rgba(o.light, 0)); gl.addColorStop(0.45, rgba(o.light, 0.22 * (1 - d))); gl.addColorStop(0.55, rgba(o.light, 0)); c.fillStyle = gl; c.fillRect(-w / 2, -h / 2, w, h);
  if (o.words) {
    c.fillStyle = mixHex('#2a1a10', '#000', d * 0.5); c.font = `600 ${h * 0.085}px Georgia, serif`; c.textBaseline = 'top';
    c.fillText(o.gen === 4 ? 'TITHONUS GEN 4' : 'TITHONUS', -w / 2 + w * 0.1, -h / 2 + h * 0.18);
    c.font = `italic 400 ${h * 0.06}px Georgia, serif`;
    c.fillText(o.gen === 4 ? 'Stay well, always.' : 'More mornings.', -w / 2 + w * 0.1, -h / 2 + h * 0.3);
  }
  c.restore();
}

/** A round fridge magnet. */
export function magnet(c: C, x: number, y: number, r: number, color: string, dark: number) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, mixHex(color, '#ffffff', 0.3 * (1 - dark))); g.addColorStop(1, mixHex(color, '#000', 0.4 + dark * 0.4));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

/** A leash hanging from its hook by the door: a loop of red webbing and the clip. */
export function leash(c: C, x: number, y: number, len: number, sway: number, dark: number) {
  c.save(); c.strokeStyle = mixHex('#8a2e22', '#000', dark); c.lineWidth = len * 0.035; c.lineCap = 'round';
  c.fillStyle = mixHex('#6a5a44', '#000', dark); c.fillRect(x - len * 0.05, y - len * 0.04, len * 0.1, len * 0.05);
  c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - len * 0.18 + sway, y + len * 0.5, x + len * 0.1 + sway, y + len * 0.75, x + sway * 1.2, y + len);
  c.moveTo(x, y); c.bezierCurveTo(x + len * 0.14 + sway * 0.6, y + len * 0.3, x + len * 0.06 + sway, y + len * 0.6, x + sway * 1.2, y + len); c.stroke();
  c.fillStyle = mixHex('#9a9488', '#000', dark); c.fillRect(x + sway * 1.2 - len * 0.03, y + len, len * 0.06, len * 0.09);
  c.restore();
}

/** A glass, mostly transparent: rim highlights and a little wine if `wine` > 0. */
export function glass(c: C, x: number, y: number, h: number, light: string, wine = 0, tilt = 0) {
  c.save(); c.translate(x, y); c.rotate(tilt);
  const w = h * 0.5;
  if (wine > 0) {
    // the wine stays level however the glass tilts: clip to the bowl, then fill below a line
    // that is horizontal in the room, not in the glass
    c.save();
    c.beginPath(); c.moveTo(-w / 2 + h * 0.02, -h); c.quadraticCurveTo(-w * 0.53, -h * 0.3, 0, -h * 0.24); c.quadraticCurveTo(w * 0.53, -h * 0.3, w / 2 - h * 0.02, -h); c.closePath(); c.clip();
    const cy = -h * 0.24 - h * 0.6 * wine * Math.cos(tilt); // the surface, measured from the bowl's base
    c.rotate(-tilt);
    const bx = -Math.sin(tilt) * h * 0.24, by = -Math.cos(tilt) * h * 0.24; // the bowl's base, in room axes
    const lv = by + (cy + h * 0.24) * 1;
    c.fillStyle = 'rgba(96,14,26,0.85)'; c.fillRect(bx - h * 2, lv, h * 4, h * 3);
    c.fillStyle = rgba(light, 0.35); c.fillRect(bx - h * 2, lv, h * 4, h * 0.03); // the meniscus catches the light
    c.restore();
  }
  c.strokeStyle = rgba(light, 0.55); c.lineWidth = h * 0.02;
  c.beginPath(); c.moveTo(-w / 2, -h); c.quadraticCurveTo(-w * 0.55, -h * 0.3, 0, -h * 0.22); c.quadraticCurveTo(w * 0.55, -h * 0.3, w / 2, -h); c.stroke();
  c.beginPath(); c.moveTo(0, -h * 0.22); c.lineTo(0, -h * 0.02); c.moveTo(-w * 0.3, 0); c.lineTo(w * 0.3, 0); c.stroke();
  c.strokeStyle = rgba(light, 0.85); c.lineWidth = h * 0.025;
  c.beginPath(); c.moveTo(w * 0.36, -h * 0.9); c.quadraticCurveTo(w * 0.42, -h * 0.55, w * 0.22, -h * 0.35); c.stroke();
  c.restore();
}

/** A soft rectangle of light on a wall or floor (where the window lands). */
export function patch(c: C, pts: [number, number][], color: string, a: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const r = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.7, rgba(color, a * 0.7)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; blob(c, pts, true, 0.2); c.fill();
  c.restore();
}

/** Wooden floorboards receding toward a horizon line `y0`; `y1` is the bottom of the frame. */
export function floor(c: C, y0: number, y1: number, tone: string, dark: string, vx = 500) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, dark); g.addColorStop(1, tone);
  c.fillStyle = g; c.fillRect(-400, y0, 1800, y1 - y0 + 200);
  c.strokeStyle = rgba('#000', 0.22); c.lineWidth = 1.2;
  for (let i = -14; i <= 14; i++) {
    c.beginPath(); c.moveTo(vx + i * 30, y0); c.lineTo(vx + i * 150, y1 + 120); c.stroke();
  }
}
