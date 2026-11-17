// The cinema renderer's core: a camera, depth layers, light and the film look.
// Interludes are *shot*, not illustrated (docs/art-audio-direction.md section 9, and the
// creative brief in /mnt/project-files/creative/chapters.md, "Cut scenes: shot direction").
//
// Every set is built in one world frame, W x H units (2.38:1). A shot moves a camera through it;
// each layer has a parallax factor, so near things slide past far things as the camera drifts.
// Flashing rules apply: every change is slow (well under 3 per second), nothing strobes, and
// `still` (reduced motion) holds the camera and every drifting thing in place.

export const W = 1000, H = 420;

export interface Cam { x: number; y: number; z: number }
export type Mode = 'footage' | 'eye' | 'close';
export type Look = 'dawn' | 'day' | 'dusk' | 'night' | 'clinic' | 'tv' | 'body' | 'black';

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
/** A seeded pseudo-random number, the same every frame for the same inputs. */
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });

/** Hex colour to [r, g, b]. */
export const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
export const mixHex = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`;
};

let filterOk: boolean | null = null;
/** Whether this browser blurs canvas drawing with ctx.filter (Safari did not for a long time). */
export function canFilter(): boolean {
  if (filterOk === null) {
    try { const c = document.createElement('canvas').getContext('2d')!; c.filter = 'blur(2px)'; filterOk = c.filter === 'blur(2px)'; } catch { filterOk = false; }
  }
  return filterOk;
}

const pool: HTMLCanvasElement[] = [];
/** A scratch canvas the size of the frame, borrowed for one layer and given back. */
export function borrow(w: number, h: number): HTMLCanvasElement {
  const c = pool.pop() ?? document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return c; }
  // a reused canvas keeps its state: reset it, or a stale composite mode eats the next drawing
  const g = c.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
  g.clearRect(0, 0, w, h);
  return c;
}
export const giveBack = (c: HTMLCanvasElement) => { if (pool.length < 8) pool.push(c); };

let grainTile: HTMLCanvasElement | null = null;
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d')!, img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    // Two octaves, so it reads as film grain rather than digital noise.
    const v = 128 + (hash(i * 0.37) - 0.5) * 120 + (hash(Math.floor(i / 8) * 1.7) - 0.5) * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (grainTile = c);
}

/**
 * One frame of one shot. Drawing calls take world units; `layer()` sets the camera transform for
 * a given depth. The stage also carries the light, so helpers can rim-light what they draw.
 */
export class Stage {
  cam: Cam = { x: W / 2, y: H / 2, z: 1 };
  /** Seconds since the shot began, and 0..1 through its hold. */
  t = 0; p = 0;
  /** The key light's position in world units, and its colour. Rim light faces it. */
  light: { x: number; y: number; color: string } = { x: 700, y: 100, color: '#f0c48a' };
  /** How far the depth of field reaches: layers further than this from the focal plane blur. */
  focus = 1; dof = 0;
  readonly k: number;
  constructor(public ctx: CanvasRenderingContext2D, public w: number, public h: number, public mode: Mode, public still: boolean) {
    this.k = Math.max(w / W, h / H);
  }
  /** The transform for a layer at parallax `par` (1: the focal plane; under 1, further away). */
  transform(par: number): DOMMatrix {
    const z = 1 + (this.cam.z - 1) * par, cx = W / 2 + (this.cam.x - W / 2) * par, cy = H / 2 + (this.cam.y - H / 2) * par;
    return new DOMMatrix().translate(this.w / 2, this.h / 2).scale(this.k * z).translate(-cx, -cy);
  }
  /** World point to screen pixels, for a layer at `par`. */
  toScreen(x: number, y: number, par = 1): [number, number] {
    const m = this.transform(par), p = m.transformPoint(new DOMPoint(x, y));
    return [p.x, p.y];
  }
  /** Draw `fn` as one depth layer. `blur` (in world units) softens it; depth of field adds more. */
  layer(par: number, fn: (c: CanvasRenderingContext2D) => void, blur = 0) {
    const dofBlur = this.dof * Math.abs(par - this.focus) * 10;
    const b = (blur + dofBlur) * this.k * (1 + (this.cam.z - 1) * par);
    const ctx = this.ctx;
    if (b < 0.6) {
      ctx.save(); ctx.setTransform(this.transform(par)); fn(ctx); ctx.restore();
      return;
    }
    if (canFilter()) {
      const c = borrow(this.w, this.h), g = c.getContext('2d')!;
      g.setTransform(this.transform(par)); fn(g);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${b.toFixed(1)}px)`; ctx.drawImage(c, 0, 0); ctx.restore();
      giveBack(c);
      return;
    }
    // No canvas filter: draw small and scale up, which blurs. Two steps keep it from looking blocky.
    const f = Math.min(16, 1 + b / 1.5), sw = Math.max(1, Math.round(this.w / f)), sh = Math.max(1, Math.round(this.h / f));
    const c = borrow(sw, sh), g = c.getContext('2d')!;
    g.setTransform(new DOMMatrix().scale(1 / f).multiply(this.transform(par))); fn(g);
    const m = borrow(Math.round(this.w / Math.sqrt(f)), Math.round(this.h / Math.sqrt(f))), mg = m.getContext('2d')!;
    mg.imageSmoothingQuality = 'high'; mg.drawImage(c, 0, 0, m.width, m.height);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(m, 0, 0, this.w, this.h); ctx.restore();
    giveBack(c); giveBack(m);
  }

  /**
   * A silhouette with directional rim light: `shape` fills the outline, and the edge facing the
   * light glows. Volume comes from a soft gradient across the body toward the light.
   */
  lit(par: number, shape: (c: CanvasRenderingContext2D) => void, o: { body: string; rim?: number; width?: number; fill?: number; cool?: string; blur?: number; at?: [number, number, number]; light?: { x: number; y: number; color: string } }) {
    const L = o.light ?? this.light, width = o.width ?? 2.2, rim = o.rim ?? 0.8;
    const mask = borrow(this.w, this.h), mg = mask.getContext('2d')!;
    const tf = this.transform(par);
    mg.setTransform(tf); mg.fillStyle = '#fff'; shape(mg);
    // where is the light from, on screen
    // `at` (world x, y and size) saves reading the mask back from the GPU to find the shape
    let cx: number, cy: number, span: number;
    if (o.at) { [cx, cy] = this.toScreen(o.at[0], o.at[1], par); span = o.at[2] * this.k * (1 + (this.cam.z - 1) * par); }
    else { const bb = this.bounds(mask); cx = (bb[0] + bb[2]) / 2; cy = (bb[1] + bb[3]) / 2; span = Math.max(bb[2] - bb[0], bb[3] - bb[1]); }
    const [lx, ly] = this.toScreen(L.x, L.y, par);
    let dx = lx - cx, dy = ly - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const out = borrow(this.w, this.h), og = out.getContext('2d')!;
    // body, with a soft gradient of light across it
    og.drawImage(mask, 0, 0);
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = o.body; og.fillRect(0, 0, this.w, this.h);
    og.globalCompositeOperation = 'source-atop';
    const gr = og.createLinearGradient(cx + dx * span * 0.6, cy + dy * span * 0.6, cx - dx * span * 0.5, cy - dy * span * 0.5);
    gr.addColorStop(0, rgba(L.color, 0.16 * (o.fill ?? 1))); gr.addColorStop(1, rgba(L.color, 0));
    og.fillStyle = gr; og.fillRect(0, 0, this.w, this.h);
    if (o.cool) { // a cool fill from the other side, so the shadow side is not dead black
      const g2 = og.createLinearGradient(cx - dx * span * 0.6, cy - dy * span * 0.6, cx, cy);
      g2.addColorStop(0, rgba(o.cool, 0.12)); g2.addColorStop(1, rgba(o.cool, 0));
      og.fillStyle = g2; og.fillRect(0, 0, this.w, this.h);
    }
    // rim: the silhouette minus itself shifted away from the light leaves the lit edge
    if (rim > 0) {
      const r = borrow(this.w, this.h), rg = r.getContext('2d')!, px = width * this.k * Math.max(0.6, this.cam.z * par);
      rg.drawImage(mask, 0, 0);
      rg.globalCompositeOperation = 'source-in'; rg.fillStyle = L.color; rg.fillRect(0, 0, this.w, this.h);
      rg.globalCompositeOperation = 'destination-out'; rg.drawImage(mask, -dx * px, -dy * px);
      og.globalCompositeOperation = 'source-atop'; og.globalAlpha = rim;
      if (canFilter()) og.filter = `blur(${(px * 0.35).toFixed(1)}px)`;
      og.drawImage(r, 0, 0); og.filter = 'none'; og.globalAlpha = 1;
      giveBack(r);
    }
    const ctx = this.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const b = (o.blur ?? 0) * this.k + this.dof * Math.abs(par - this.focus) * 10 * this.k;
    if (b > 0.6 && canFilter()) ctx.filter = `blur(${b.toFixed(1)}px)`;
    ctx.drawImage(out, 0, 0); ctx.restore();
    giveBack(mask); giveBack(out);
  }
  /** Rough on-screen bounds of what a mask holds, sampled coarsely (fast enough per frame). */
  private bounds(c: HTMLCanvasElement): [number, number, number, number] {
    // We know what we drew; sampling every pixel is slow, so use a 1/16 scale probe.
    const s = 16, w = Math.max(1, Math.ceil(c.width / s)), h = Math.max(1, Math.ceil(c.height / s));
    const p = borrow(w, h), g = p.getContext('2d')!; g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; giveBack(p);
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return [0, 0, c.width, c.height];
    return [x0 * s, y0 * s, (x1 + 1) * s, (y1 + 1) * s];
  }

  /** A soft glow, added to what is there (a lamp, a window's bloom). World units, focal plane unless `par`. */
  glow(x: number, y: number, r: number, color: string, a: number, par = 1) {
    this.layer(par, (c) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
      c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }

  /**
   * A shaft of light through a window: the window's quad pushed along `dir` and faded with distance.
   * Dust motes drift slowly inside it. `quad` is the window opening, clockwise.
   */
  shaft(par: number, quad: [number, number][], dir: [number, number], len: number, color: string, a: number, motes = 0, seed = 1) {
    const far = quad.map(([x, y]) => [x + dir[0] * len, y + dir[1] * len] as [number, number]);
    this.layer(par, (c) => {
      c.save(); c.globalCompositeOperation = 'lighter';
      // the beam: sides of the extruded quad
      const cx = quad.reduce((s, q) => s + q[0], 0) / 4, cy = quad.reduce((s, q) => s + q[1], 0) / 4;
      const g = c.createLinearGradient(cx, cy, cx + dir[0] * len, cy + dir[1] * len);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.55, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g;
      c.beginPath();
      // hull of the near and far quads, which is the beam seen from the side
      const pts = hull([...quad, ...far]);
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath(); c.fill();
      if (motes > 0) {
        c.clip();
        for (let i = 0; i < motes; i++) {
          const u = hash(seed * 31 + i), v = hash(seed * 17 + i * 3), sz = 0.6 + hash(i * 7.3 + seed) * 1.6;
          const drift = this.still ? 0 : this.t;
          const along = (u + drift * (0.004 + v * 0.004)) % 1;
          const x0 = lerp(quad[0][0], quad[1][0], v), y0 = lerp(quad[0][1], quad[3][1], hash(i * 2.1 + seed));
          const x = x0 + dir[0] * len * along + Math.sin(drift * 0.3 + i) * 6, y = y0 + dir[1] * len * along + Math.cos(drift * 0.23 + i * 1.3) * 5;
          // brighter in the strong part of the beam; a slow swell (well under 1 Hz) as they turn
          const lum = (1 - along) * (0.5 + 0.5 * Math.sin(drift * 0.4 + i * 2.7));
          c.fillStyle = rgba(color, 0.55 * lum * a * 3);
          c.beginPath(); c.arc(x, y, sz, 0, Math.PI * 2); c.fill();
        }
      }
      c.restore();
    }, 6);
  }

  /** Steam rising from (x, y): soft wisps that curl and thin out. Slow. */
  steam(par: number, x: number, y: number, scale: number, color: string, a = 0.28, seed = 0) {
    this.layer(par, (c) => {
      c.save(); c.globalCompositeOperation = 'lighter';
      const tt = this.still ? 2 : this.t;
      for (let i = 0; i < 5; i++) {
        const life = ((tt * 0.16 + i / 5 + hash(seed + i) * 0.1) % 1);
        const rise = life * 60 * scale, sway = Math.sin(tt * 0.5 + i * 1.7 + life * 4) * 7 * scale * life;
        const r = (5 + life * 14) * scale, al = a * Math.sin(life * Math.PI) * (0.6 + hash(i + seed) * 0.4);
        const g = c.createRadialGradient(x + sway, y - rise, 0, x + sway, y - rise, r);
        g.addColorStop(0, rgba(color, al)); g.addColorStop(1, rgba(color, 0));
        c.fillStyle = g; c.beginPath(); c.ellipse(x + sway, y - rise, r * 0.7, r, 0, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }, 1.2);
  }
}

/** Convex hull (monotone chain), for light beams. */
function hull(p: [number, number][]): [number, number][] {
  const pts = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

// ---------- the film look, over the finished frame ----------

const GRADES: Record<Look, { key: string; shadow: string; tint: number; lift: number; vig: number }> = {
  dawn: { key: '#f4c890', shadow: '#1c1420', tint: 0.22, lift: 0.08, vig: 0.62 },
  day: { key: '#f2dcb4', shadow: '#1a1a20', tint: 0.16, lift: 0.08, vig: 0.55 },
  dusk: { key: '#e8955a', shadow: '#1e1014', tint: 0.24, lift: 0.07, vig: 0.66 },
  night: { key: '#e8b36a', shadow: '#0c1024', tint: 0.18, lift: 0.07, vig: 0.72 },
  clinic: { key: '#d4e6ea', shadow: '#0c1416', tint: 0.14, lift: 0.08, vig: 0.6 },
  tv: { key: '#9fb8e8', shadow: '#0a0c1a', tint: 0.18, lift: 0.06, vig: 0.72 },
  body: { key: '#ff6a50', shadow: '#1a0206', tint: 0.12, lift: 0.04, vig: 0.7 },
  black: { key: '#ffffff', shadow: '#000000', tint: 0, lift: 0, vig: 0 },
};

/** Grade, vignette and grain over the frame. Footage adds a camera's flat, drained look. */
export function finish(ctx: CanvasRenderingContext2D, w: number, h: number, look: Look, mode: Mode, time: number, still: boolean, burn?: string) {
  const g = GRADES[look];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (look !== 'black') {
    // warm the midtones toward the key light
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = rgba(g.key, g.tint); ctx.fillRect(0, 0, w, h);
    // lift the blacks into a coloured shadow, the way film does
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgba(g.shadow, g.lift * 4); ctx.fillRect(0, 0, w, h);
  }
  if (mode === 'footage') {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.82)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#c8d4d0'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(30,38,38,0.5)'; ctx.fillRect(0, 0, w, h);
    // fixed lines of a cheap sensor: drawn once, never moving, so they read as a camera, not a flicker
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(0,0,0,0.16)';
    const step = Math.max(2, Math.round(h / 180));
    for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step);
  }
  // vignette
  if (g.vig > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const r = Math.hypot(w, h) / 2, vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.7, `rgba(0,0,0,${(g.vig * 0.45).toFixed(3)})`); vg.addColorStop(1, `rgba(0,0,0,${(mode === 'footage' ? 0.95 : g.vig).toFixed(3)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }
  // grain: a texture that drifts slowly across the frame, never re-rolled per frame (no shimmer)
  if (look !== 'black') {
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = mode === 'footage' ? 0.2 : 0.1;
    const tile = grain(), pat = ctx.createPattern(tile, 'repeat')!;
    const s = Math.max(1, w / 900), off = still ? 0 : time;
    pat.setTransform(new DOMMatrix().scale(s).translate((off * 9) % 160, (off * 5) % 160));
    ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (mode === 'footage' && burn) {
    // The camera's own burned-in caption: the only words, and they would really be there.
    ctx.globalCompositeOperation = 'source-over';
    const fs = Math.max(9, Math.round(h * 0.038));
    ctx.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; ctx.fillStyle = 'rgba(214,226,222,0.72)';
    ctx.textBaseline = 'top'; ctx.fillText(burn, Math.round(w * 0.045), Math.round(h * 0.06));
    // a steady record dot: lit, never blinking
    ctx.fillStyle = 'rgba(190,60,50,0.8)'; ctx.beginPath(); ctx.arc(w * 0.94, h * 0.06 + fs / 2, fs * 0.3, 0, Math.PI * 2); ctx.fill();
    // corner marks
    ctx.strokeStyle = 'rgba(214,226,222,0.45)'; ctx.lineWidth = Math.max(1, h / 300);
    const m = h * 0.05, L = h * 0.07;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
    }
  }
  ctx.restore();
}
