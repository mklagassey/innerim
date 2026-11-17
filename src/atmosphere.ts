// The fluid you are suspended in, drawn over the scene in screen space.
//
// Plasma is never empty: platelets, protein flecks and lipid droplets drift with the current,
// catch the lamp near the ship and fade to nothing in the dark. A few huge, soft, out-of-focus
// specks slide past the lens, which is what makes the cells read as enormous. Over everything
// sits a faint colour grade keyed to the place, so a screenshot tells you where you are.
//
// Rules from docs/art-audio-direction.md: nothing here flashes, everything eases, and with
// reduced motion (`still`) nothing moves on its own (specks only shift as the camera does).

type Ctx = CanvasRenderingContext2D;
interface Pt { x: number; y: number }

export interface Air {
  w: number; h: number; dpr: number; zoom: number; time: number; still: boolean;
  /** 0 to 1 at each heartbeat. */
  kick: number;
  /** Where the camera is, in projected (unzoomed) pixels. */
  cam: Pt;
  /** The current here, already projected to the screen: a direction, not a speed. */
  flow: Pt;
  /** How hard it runs (0 gentle, 1 an artery). */
  strength: number;
  /** Radius of the lamp's reach on screen, in CSS pixels. */
  reach: number;
  /** 'liver', 'artery', 'vein', 'stomach' or 'lung'. */
  place: string;
  /** 0 to 1 lung fill. */
  breath: number;
  dt: number;
}

interface Key { speck: [number, number, number]; haze: [number, number, number]; grade: [number, number, number]; gradeA: number; pulse: number }
/** The place keys from the style guide. */
const KEYS: Record<string, Key> = {
  liver:   { speck: [255, 214, 150], haze: [255, 170, 90],  grade: [217, 164, 65],  gradeA: 0.07, pulse: 0.25 },
  artery:  { speck: [255, 190, 170], haze: [255, 90, 60],   grade: [255, 90, 60],   gradeA: 0.08, pulse: 1 },
  vein:    { speck: [190, 210, 255], haze: [90, 130, 255],  grade: [79, 125, 255],  gradeA: 0.1,  pulse: 0.35 },
  stomach: { speck: [220, 240, 170], haze: [170, 220, 90],  grade: [156, 210, 90],  gradeA: 0.09, pulse: 0.15 },
  lung:    { speck: [255, 235, 245], haze: [240, 200, 220], grade: [232, 184, 204], gradeA: 0.07, pulse: 0.2 },
};

type Kind = 0 | 1 | 2 | 3; // fleck, platelet, lipid droplet, out-of-focus blur
interface Mote { x: number; y: number; d: number; kind: Kind; size: number; seed: number; spin: number }

let motes: Mote[] = [], lastCam: Pt | null = null, lastW = 0, lastH = 0;
const grade = { r: 0, g: 0, b: 0, a: 0, hr: 0, hg: 0, hb: 0 };
let graded = false, surge = 0;

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(key: string, size: number, paint: (c: Ctx, s: number) => void): HTMLCanvasElement {
  let img = sprites.get(key);
  if (!img) {
    img = document.createElement('canvas');
    img.width = img.height = Math.ceil(size);
    paint(img.getContext('2d')!, size);
    sprites.set(key, img);
  }
  return img;
}
const rgba = (c: [number, number, number] | number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** One soft speck, white so it can be drawn additively and tinted by the place. */
function speckImg(tint: [number, number, number], kind: Kind): HTMLCanvasElement {
  return sprite(`${kind}:${tint.join(',')}`, kind === 3 ? 128 : 32, (c, s) => {
    const m = s / 2;
    if (kind === 3) {
      // Lens blur: a flat soft disc with a slightly brighter rim, the way real bokeh looks.
      const g = c.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, rgba(tint, 0.45)); g.addColorStop(0.7, rgba(tint, 0.5)); g.addColorStop(0.88, rgba(tint, 0.58)); g.addColorStop(1, rgba(tint, 0));
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    } else if (kind === 2) {
      // A lipid droplet: a bright ring with a clear middle.
      const g = c.createRadialGradient(m, m, m * 0.2, m, m, m);
      g.addColorStop(0, rgba(tint, 0.15)); g.addColorStop(0.55, rgba(tint, 0.25)); g.addColorStop(0.75, rgba(tint, 0.9)); g.addColorStop(1, rgba(tint, 0));
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    } else {
      const g = c.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, rgba(tint, 1)); g.addColorStop(0.35, rgba(tint, 0.6)); g.addColorStop(1, rgba(tint, 0));
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
  });
}

function seedMotes(w: number, h: number) {
  const n = Math.round(Math.max(40, Math.min(150, (w * h) / 9000)));
  motes = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random(), kind: Kind = r < 0.7 ? 0 : r < 0.9 ? 1 : 2;
    const d = [0.55, 0.8, 1.05, 1.3][Math.floor(Math.random() * 4)];
    motes.push({ x: Math.random() * w, y: Math.random() * h, d, kind, size: (kind === 0 ? 1.2 + Math.random() * 1.6 : kind === 1 ? 2.2 + Math.random() * 1.6 : 2.6 + Math.random() * 2.4) * d, seed: Math.random(), spin: Math.random() * 6.28 });
  }
  const blurs = Math.max(3, Math.min(7, Math.round((w * h) / 160000)));
  for (let i = 0; i < blurs; i++) motes.push({ x: Math.random() * w, y: Math.random() * h, d: 1.9 + Math.random() * 0.8, kind: 3, size: 40 + Math.random() * 70, seed: Math.random(), spin: 0 });
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Draws the fluid over a finished frame. Call with the canvas transform at CSS pixels. */
export function atmosphere(ctx: Ctx, a: Air) {
  const key = KEYS[a.place] ?? KEYS.liver;
  if (!motes.length || Math.abs(a.w - lastW) > 80 || Math.abs(a.h - lastH) > 80) { seedMotes(a.w, a.h); lastW = a.w; lastH = a.h; }

  // The grade eases toward the new place over about a second, so a change of place never pops.
  const k = graded ? 1 - Math.exp(-a.dt / 0.6) : 1; graded = true;
  grade.r += (key.grade[0] - grade.r) * k; grade.g += (key.grade[1] - grade.g) * k; grade.b += (key.grade[2] - grade.b) * k; grade.a += (key.gradeA - grade.a) * k;
  grade.hr += (key.haze[0] - grade.hr) * k; grade.hg += (key.haze[1] - grade.hg) * k; grade.hb += (key.haze[2] - grade.hb) * k;

  // Blood comes in surges: each beat shoves the fluid forward and it coasts until the next.
  // Arteries surge hard, veins hardly at all.
  surge += ((a.still ? 0 : a.kick * key.pulse) - surge) * Math.min(1, a.dt * 10);
  const flowLen = Math.hypot(a.flow.x, a.flow.y) || 1, fx = a.flow.x / flowLen, fy = a.flow.y / flowLen;
  const run = (14 + a.strength * 70) * (0.55 + surge * 1.4) * a.zoom;
  const cdx = lastCam ? (a.cam.x - lastCam.x) * a.zoom : 0, cdy = lastCam ? (a.cam.y - lastCam.y) * a.zoom : 0;
  lastCam = { x: a.cam.x, y: a.cam.y };
  const jump = Math.hypot(cdx, cdy) > Math.max(a.w, a.h) * 0.25; // a new map: do not sweep every speck across the screen
  const cx = a.w / 2, cy = a.h / 2, M = 60;

  for (const m of motes) {
    if (!jump) { m.x -= cdx * m.d; m.y -= cdy * m.d; }
    if (!a.still) {
      // Drift with the current, plus a slow Brownian wander of its own.
      const wob = a.time * (0.3 + m.seed * 0.4) + m.seed * 40;
      m.x += (fx * run * m.d * (0.6 + m.seed * 0.8) + Math.sin(wob) * 6) * a.dt;
      m.y += (fy * run * m.d * (0.6 + m.seed * 0.8) + Math.cos(wob * 1.3) * 4 + (a.place === 'lung' ? (a.breath - 0.5) * 8 : 0)) * a.dt;
      m.spin += a.dt * (0.4 + m.seed);
    }
    const pad = m.kind === 3 ? m.size : M;
    if (m.x < -pad) m.x += a.w + pad * 2; else if (m.x > a.w + pad) m.x -= a.w + pad * 2;
    if (m.y < -pad) m.y += a.h + pad * 2; else if (m.y > a.h + pad) m.y -= a.h + pad * 2;
  }

  ctx.save();
  // The lamp lights the fluid itself: a soft in-scatter around the ship, warmer than the dark.
  ctx.globalCompositeOperation = 'lighter';
  const hazeR = a.reach * 1.1, breathe = a.still ? 0 : (a.breath - 0.5) * 0.015;
  const haze = ctx.createRadialGradient(cx, cy - 10 * a.zoom, 0, cx, cy - 10 * a.zoom, hazeR);
  haze.addColorStop(0, rgba([grade.hr, grade.hg, grade.hb], 0.075 + breathe)); haze.addColorStop(0.45, rgba([grade.hr, grade.hg, grade.hb], 0.03)); haze.addColorStop(1, rgba([grade.hr, grade.hg, grade.hb], 0));
  ctx.fillStyle = haze; ctx.fillRect(cx - hazeR, cy - hazeR, hazeR * 2, hazeR * 2);

  // Specks: bright inside the lamp's reach, a faint memory of light beyond it.
  for (const m of motes) {
    if (m.kind === 3) continue;
    const dist = Math.hypot(m.x - cx, (m.y - cy) * 1.6);
    const lit = 1 - smooth(a.reach * 0.35, a.reach * 1.25, dist);
    const alpha = (0.04 + 0.62 * lit) * (m.d < 0.7 ? 0.55 : 1) * (0.75 + 0.25 * Math.sin(m.seed * 50 + a.time * (a.still ? 0 : 0.7)));
    if (alpha < 0.02) continue;
    const img = speckImg(key.speck, m.kind);
    ctx.globalAlpha = Math.min(1, alpha);
    if (m.kind === 1) {
      // Platelets are discs: they flatten to slivers as they tumble.
      const sq = 0.35 + 0.65 * Math.abs(Math.cos(m.spin));
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.seed * 6.28); ctx.scale(1, sq);
      ctx.drawImage(img, -m.size * 1.6, -m.size * 1.6, m.size * 3.2, m.size * 3.2); ctx.restore();
    } else ctx.drawImage(img, m.x - m.size * 1.6, m.y - m.size * 1.6, m.size * 3.2, m.size * 3.2);
  }

  // Out-of-focus specks right against the lens. Very faint; skipped entirely for reduced motion.
  if (!a.still) {
    for (const m of motes) {
      if (m.kind !== 3) continue;
      const dist = Math.hypot(m.x - cx, m.y - cy), lit = 1 - smooth(a.reach * 0.5, a.reach * 2, dist);
      ctx.globalAlpha = 0.012 + 0.035 * lit;
      ctx.drawImage(speckImg(key.speck, 3), m.x - m.size, m.y - m.size, m.size * 2, m.size * 2);
    }
  }
  ctx.globalAlpha = 1;

  // The grade: the place's key colour laid softly over everything.
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = rgba([grade.r, grade.g, grade.b], grade.a * 2.2);
  ctx.fillRect(0, 0, a.w, a.h);
  ctx.restore();
}

/** Forget the specks, for a new map or a resized screen. */
export function resetAtmosphere() { motes = []; lastCam = null; }
