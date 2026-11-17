// Draws the liver in isometric view, lit by the lamp the player carries. Tissue you have
// visited but cannot see right now is drawn from memory: dim and drained of colour.
//
// Tiles are painted once into small off-screen images (with all their texture) and then
// stamped, so the scene can be detailed without redrawing every granule each frame.
import { CONFIG } from './config';
import { atmosphere } from './atmosphere';
import { Enemy, Point, State, tutorialTarget, markTarget, inSearch, inNiche, acidLevel, cloaked, digesting, hostState, maxHp, stage, riding, currentAt, currentStrength, idx, open, scentScale, stripTarget, trailLife, vision } from './game';

export const TW = 64, TH = 32;
const INK = '#0a0407';

export interface View {
  w: number; h: number; zoom: number; dpr: number; time: number; showMap: boolean;
  hover: Point | null; hoverEnemy: number | null; mark: Point | null;
  heat: number; // 0 to 1: how wound-up the music is
  kick: number; // 1 at each drum hit, fading to 0
  bpm: number; // the host's heart rate right now
  still: boolean; // the player asked for reduced motion
}

// The camera can be swung round the scene. Everything is turned by `spin` before it is laid out
// on the isometric grid, so the same tissue can be looked at from any side.
let cs = 1, sn = 0;
export function setSpin(radians: number) { cs = Math.cos(radians); sn = Math.sin(radians); }
export const project = (x: number, y: number): Point => {
  const rx = x * cs - y * sn, ry = x * sn + y * cs;
  return { x: ((rx - ry) * TW) / 2, y: ((rx + ry) * TH) / 2 };
};
/** How far toward the viewer a spot is: things further forward are drawn later, over the rest. */
const depthOf = (x: number, y: number) => x * cs - y * sn + (x * sn + y * cs);
/** Turns a direction on the screen's grid back into one in the world. */
export const unturn = (x: number, y: number): Point => ({ x: x * cs + y * sn, y: -x * sn + y * cs });
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
function rand(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type Ctx = CanvasRenderingContext2D;
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
// ---------- painted tiles ----------

const sprites = new Map<string, HTMLCanvasElement>();
let spriteScale = 0;
function sprite(key: string, w: number, h: number, scale: number, memory: boolean, paint: (c: Ctx) => void): HTMLCanvasElement {
  if (scale !== spriteScale) { sprites.clear(); spriteScale = scale; }
  const k = key + (memory ? 'm' : '');
  let cv = sprites.get(k);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale);
    const c = cv.getContext('2d')!;
    c.scale(scale, scale);
    paint(c);
    if (memory) {
      // Remembered tissue: mostly darkness with a cold cast, only where the tile was painted.
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(20,15,24,0.78)';
      c.fillRect(0, 0, w, h);
    }
    sprites.set(k, cv);
  }
  return cv;
}

// Each hepatocyte is its own size and height, so a wall of them reads as a heap of cells, not masonry.
const CELL_VARIANTS = 12;
const cellHeight = (variant: number) => 20 + ((variant * 7) % 12) * 1.4;
const cellRadius = (variant: number) => 29 + ((variant * 5) % 7) * 0.8;
const cellShift = (variant: number) => (((variant * 3) % 5) - 2) * 1.1;
const CELL_W = TW + 28, CELL_TOP = 46, CELL_H = CELL_TOP + TH + 16, CELL_OX = CELL_W / 2, CELL_OY = CELL_TOP + TH / 2;

/** A closed, slightly lumpy loop: no living membrane is a clean ellipse. */
function lumpy(c: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, depth = 0.05, from = 0, to = Math.PI * 2, move = true) {
  const steps = 40, p1 = seed * 1.7, p2 = seed * 3.1;
  for (let k = 0; k <= steps; k++) {
    const a = from + ((to - from) * k) / steps;
    const w = 1 + depth * Math.sin(a * 3 + p1) + depth * 0.6 * Math.sin(a * 5 + p2);
    const x = cx + Math.cos(a) * rx * w, y = cy + Math.sin(a) * ry * w;
    if (k === 0 && move) c.moveTo(x, y); else c.lineTo(x, y);
  }
}

/** A hepatocyte: a soft mound of pink cytoplasm, granular with mitochondria, with a round nucleus. */
/** What a wall cell is made of. Each tissue keeps the same body (and the same footprint for the rules); only its crown changes. */
type Tissue = 'liver' | 'muscle' | 'heart' | 'mucosa';
function paintCell(c: Ctx, variant: number, tissue: Tissue = 'liver') {
  const r = rand(variant * 31 + 3), H = cellHeight(variant), rx = cellRadius(variant), ry = rx / 2;
  const ox = CELL_OX + cellShift(variant), oy = CELL_OY, top = oy - H, seed = variant * 2.3 + 1;
  // Tissue packed in behind the cell, so the crevices between neighbours are dark flesh and not holes.
  c.fillStyle = '#2c0f1c';
  c.beginPath(); lumpy(c, CELL_OX, oy, 35, 17.5, seed + 9, 0.03); c.closePath(); c.fill();
  c.fillRect(CELL_OX - 35, oy - H * 0.62, 70, H * 0.62);
  c.beginPath(); lumpy(c, CELL_OX, oy - H * 0.62, 35, 17.5, seed + 9, 0.03); c.closePath(); c.fill();
  // Where it presses into the floor.
  c.save(); c.shadowColor = 'rgba(6,1,4,0.75)'; c.shadowBlur = 9 * spriteScale; c.shadowOffsetY = 3 * spriteScale;
  c.fillStyle = 'rgba(6,1,4,0.6)'; oval(c, ox, oy + 1, rx * 0.92, ry * 0.92); c.fill(); c.restore();

  // The flank: a bulging wall of membrane, lit from the left and falling into shadow on the right.
  c.beginPath();
  lumpy(c, ox, top, rx, ry, seed, 0.05, Math.PI, Math.PI * 2);
  c.quadraticCurveTo(ox + rx + 3.5, oy - H * 0.45, ox + rx * 0.97, oy);
  lumpy(c, ox, oy, rx * 0.97, ry * 0.97, seed + 4, 0.04, 0, Math.PI, false);
  c.quadraticCurveTo(ox - rx - 3.5, oy - H * 0.45, ox - rx, top);
  c.closePath();
  let g = c.createLinearGradient(ox - rx, 0, ox + rx, 0);
  g.addColorStop(0, '#9c5069'); g.addColorStop(0.3, '#a9596f'); g.addColorStop(0.62, '#6b2f49'); g.addColorStop(1, '#2d0f1f');
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  g = c.createLinearGradient(0, top, 0, oy + ry);
  g.addColorStop(0, 'rgba(20,4,12,0)'); g.addColorStop(0.75, 'rgba(20,4,12,0.4)'); g.addColorStop(1, 'rgba(150,30,40,0.38)'); // shade, then red light off the blood
  c.fillStyle = g; c.fillRect(0, 0, CELL_W, CELL_H);
  // Folds and stretch marks in the membrane.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + r() * 0.84), x = ox + Math.cos(a) * rx * 0.98, y0 = top + Math.sin(a) * ry + 3 + r() * 5, len = 4 + r() * (H - 9);
    c.strokeStyle = `rgba(${x < ox ? '255,200,205' : '15,3,10'},${0.07 + r() * 0.1})`; c.lineWidth = 0.8 + r() * 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + (r() - 0.5) * 5, y0 + len * 0.5, x + (r() - 0.5) * 3, y0 + len); c.stroke();
  }
  c.restore();

  // The crown, domed: brightest up and to the left, darkening as it rolls over the edge.
  c.beginPath(); lumpy(c, ox, top, rx, ry, seed); c.closePath();
  g = c.createRadialGradient(ox - rx * 0.3, top - ry * 0.35, 1, ox, top, rx * 1.05);
  const crown = tissue === 'heart' ? ['#c96a6a', '#a04650', '#7c2c3c', '#5e1e30'] : tissue === 'mucosa' ? ['#f4e2d8', '#dcc0b8', '#b8968f', '#987874'] : ['#f0b4ba', '#cf8996', '#a8627a', '#8a4a66'];
  g.addColorStop(0, crown[0]); g.addColorStop(0.55, crown[1]); g.addColorStop(0.9, crown[2]); g.addColorStop(1, crown[3]);
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  if (tissue !== 'liver') { crownOf(c, r, tissue, ox, top, rx, ry); c.restore(); }
  else {
  // Granules: hepatocytes are stuffed with mitochondria and glycogen.
  for (let i = 0; i < 80; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 0.93;
    c.fillStyle = r() < 0.6 ? `rgba(120,42,66,${0.16 + r() * 0.3})` : `rgba(255,228,222,${0.12 + r() * 0.22})`;
    oval(c, ox + Math.cos(a) * rx * d, top + Math.sin(a) * ry * d, 0.5 + r() * 1.1, 0.35 + r() * 0.6, r() * 3); c.fill();
  }
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { // fat droplets
    const a = r() * 6.283, d = 0.3 + r() * 0.5;
    c.fillStyle = 'rgba(255,240,228,0.32)'; oval(c, ox + Math.cos(a) * rx * d, top + Math.sin(a) * ry * d, 1.8 + r(), 1 + r() * 0.6); c.fill();
    c.strokeStyle = 'rgba(120,50,70,0.3)'; c.lineWidth = 0.5; c.stroke();
  }
  c.restore();
  // Nucleus, sometimes two: about a quarter of real hepatocytes are binucleate. The pair sit unequal and
  // on a slant, never level and matched, so a cell never reads as a pair of eyes.
  const two = variant % 4 === 3;
  for (const [off, lift, size] of two ? [[-7, -2.2, 6.4], [6, 2.4, 5]] : [[0, 0, 8]]) {
    const nx = ox + off + (r() - 0.5) * (two ? 2 : 9), ny = top + lift + (r() - 0.5) * (two ? 1.5 : 4.5), nrx = size, nry = nrx * 0.56;
    c.fillStyle = 'rgba(60,20,50,0.25)'; oval(c, nx + 1, ny + 1.5, nrx + 1, nry + 1); c.fill();
    g = c.createRadialGradient(nx - nrx * 0.35, ny - nry * 0.5, 0.5, nx, ny, nrx);
    g.addColorStop(0, '#8a66bd'); g.addColorStop(0.7, '#553784'); g.addColorStop(1, '#2f1c50');
    c.fillStyle = g; oval(c, nx, ny, nrx, nry); c.fill();
    c.strokeStyle = 'rgba(25,12,45,0.7)'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = '#1c0f33';
    oval(c, nx + (r() - 0.5) * nrx * 0.7, ny + (r() - 0.5) * nry * 0.6, 1.5, 1); c.fill();
    if (r() < 0.6) { oval(c, nx + (r() - 0.5) * nrx, ny + (r() - 0.5) * nry * 0.8, 1, 0.7); c.fill(); }
  }
  }
  // A wet sheen along the far rim and a soft glint on the crown.
  c.strokeStyle = 'rgba(255,232,228,0.45)'; c.lineWidth = 1.3; c.lineCap = 'round';
  c.beginPath(); lumpy(c, ox, top, rx - 1.5, ry - 1, seed, 0.05, Math.PI * 1.08, Math.PI * 1.7); c.stroke();
  c.fillStyle = 'rgba(255,245,240,0.22)'; oval(c, ox - rx * 0.36, top - ry * 0.42, rx * 0.26, ry * 0.2, -0.35); c.fill();
}

/** The crown of a cell that is not a hepatocyte. Seen end on, as the camera sees them.
 *  muscle: the smooth muscle of a vessel wall, spindle cells lying in one direction with one long nucleus each.
 *  heart: cardiac muscle, the same but striated across, with a dark band where one cell joins the next (an intercalated disc).
 *  mucosa: the stomach's surface cells, capped with pale mucus and opening into a gastric pit; the nucleus sits low, out of sight. */
function crownOf(c: Ctx, r: () => number, tissue: Tissue, ox: number, top: number, rx: number, ry: number) {
  const ang = -0.42 + (r() - 0.5) * 0.3, ca = Math.cos(ang), sa = Math.sin(ang);
  const along = (u: number, v: number): [number, number] => [ox + (u * ca - v * sa) * rx, top + (u * sa + v * ca) * ry];
  if (tissue === 'mucosa') {
    // Mucus: a glossy, lighter film over most of the crown.
    c.fillStyle = 'rgba(255,250,244,0.22)'; oval(c, ox - rx * 0.1, top - ry * 0.1, rx * 0.8, ry * 0.7); c.fill();
    // The pit: a small dark opening with a pale lip, off centre.
    const [px, py] = along(0.38, 0.1);
    c.fillStyle = 'rgba(70,40,46,0.55)'; oval(c, px, py, 3.2, 1.8); c.fill();
    c.strokeStyle = 'rgba(255,244,236,0.4)'; c.lineWidth = 0.8; oval(c, px - 0.4, py - 0.4, 4, 2.3); c.stroke();
    for (let i = 0; i < 30; i++) { // mucin granules under the film
      const a = r() * 6.283, d = Math.sqrt(r()) * 0.85;
      c.fillStyle = `rgba(255,252,246,${0.08 + r() * 0.14})`; oval(c, ox + Math.cos(a) * rx * d, top + Math.sin(a) * ry * d, 0.8 + r() * 1.4, 0.5 + r() * 0.8); c.fill();
    }
    // No nucleus: in these cells it sits at the base, out of sight under the mucus, and a dot beside the pit would make a face.
    return;
  }
  // Fibres: two or three spindles lying side by side, the boundary between them a soft dark seam.
  const n = 2 + Math.floor(r() * 2);
  for (let k = 1; k < n; k++) {
    const v = -1 + (2 * k) / n + (r() - 0.5) * 0.15;
    c.strokeStyle = 'rgba(30,6,14,0.32)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(...along(-1.1, v)); c.quadraticCurveTo(...along(0, v + (r() - 0.5) * 0.2), ...along(1.1, v)); c.stroke();
  }
  if (tissue === 'heart') {
    // Cross-striations: fine, faint, close together. Read as texture, never as stripes that flicker.
    c.strokeStyle = 'rgba(255,200,196,0.09)'; c.lineWidth = 0.7;
    for (let u = -1; u <= 1; u += 0.11) { c.beginPath(); c.moveTo(...along(u, -1)); c.lineTo(...along(u + 0.04, 1)); c.stroke(); }
    const u0 = 0.55 + (r() - 0.5) * 0.3; // an intercalated disc, stepped
    c.strokeStyle = 'rgba(40,8,18,0.5)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(...along(u0, -1)); c.lineTo(...along(u0, -0.2)); c.lineTo(...along(u0 + 0.08, -0.2)); c.lineTo(...along(u0 + 0.08, 1)); c.stroke();
  } else {
    for (let i = 0; i < 26; i++) { // a few dense bodies, the anchors smooth muscle pulls on
      const u = (r() - 0.5) * 1.8, v = (r() - 0.5) * 1.6;
      c.fillStyle = `rgba(110,40,62,${0.12 + r() * 0.2})`; oval(c, ...along(u, v), 0.6 + r() * 0.8, 0.4 + r() * 0.4); c.fill();
    }
  }
  // One long nucleus per fibre, lying along it.
  for (let k = 0; k < Math.min(n, 2); k++) nucleus(c, r, ...along((r() - 0.5) * 0.6, -1 + (2 * k + 1) / n), tissue === 'heart' ? 6.5 : 7.5, 0.34, ang);
}
function nucleus(c: Ctx, r: () => number, nx: number, ny: number, nrx: number, squash: number, rot: number) {
  const nry = nrx * squash;
  c.fillStyle = 'rgba(60,20,50,0.25)'; oval(c, nx + 1, ny + 1.2, nrx + 1, nry + 0.8, rot); c.fill();
  const g = c.createRadialGradient(nx - nrx * 0.3, ny - nry * 0.5, 0.5, nx, ny, nrx);
  g.addColorStop(0, '#8a66bd'); g.addColorStop(0.7, '#553784'); g.addColorStop(1, '#2f1c50');
  c.fillStyle = g; oval(c, nx, ny, nrx, nry, rot); c.fill();
  c.strokeStyle = 'rgba(25,12,45,0.6)'; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = '#1c0f33'; oval(c, nx + (r() - 0.5) * nrx * 0.6, ny + (r() - 0.5) * nry * 0.5, 1.2, 0.7, rot); c.fill();
}

/** An air sac of the lung: not a solid cell but a thin, translucent bubble of membrane one cell
 *  thick, wrapped in a net of capillaries, with the odd flat nucleus of the cells that make its wall.
 *  Mostly see-through, so the lung reads as airy and hollow next to the packed liver. */
function paintAlveolus(c: Ctx, variant: number) {
  const r = rand(variant * 41 + 9), rx = cellRadius(variant) * 0.98, H = cellHeight(variant) * 1.25;
  const ox = CELL_OX + cellShift(variant), base = CELL_OY, top = base - H, cy = base - H * 0.55, ry = H * 0.62;
  // A faint shadow where it meets the floor.
  c.fillStyle = 'rgba(40,6,14,0.35)'; oval(c, ox, base + 1, rx * 0.95, rx * 0.42); c.fill();
  // The sac: a squashed sphere, nearly clear in the middle and denser toward the rim, as thin film is.
  const outline = () => { c.beginPath(); c.ellipse(ox, cy, rx, ry, 0, 0, Math.PI * 2); };
  let g = c.createRadialGradient(ox - rx * 0.25, cy - ry * 0.3, rx * 0.1, ox, cy, rx * 1.05);
  g.addColorStop(0, 'rgba(255,225,232,0.2)'); g.addColorStop(0.65, 'rgba(236,180,198,0.34)'); g.addColorStop(0.92, 'rgba(226,150,176,0.55)'); g.addColorStop(1, 'rgba(200,120,150,0.7)');
  outline(); c.fillStyle = g; c.fill();
  c.save(); outline(); c.clip();
  // Capillaries: a fine red net over the wall, thickest at the rim where we see the wall edge-on.
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 0.35 + r() * 0.65, x0 = ox + Math.cos(a) * rx * d, y0 = cy + Math.sin(a) * ry * d;
    c.strokeStyle = `rgba(${170 + Math.floor(r() * 40)},30,50,${0.25 + d * 0.3})`; c.lineWidth = 0.6 + r() * 0.7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0);
    c.bezierCurveTo(x0 + (r() - 0.5) * 14, y0 + (r() - 0.5) * 10, x0 + (r() - 0.5) * 16, y0 + (r() - 0.5) * 12, x0 + (r() - 0.5) * 20, y0 + (r() - 0.5) * 14); c.stroke();
  }
  // Red cells squeezing through in single file.
  for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = 0.5 + r() * 0.45; c.fillStyle = 'rgba(190,30,40,0.7)'; oval(c, ox + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 1.6, 1); c.fill(); }
  // Flat nuclei of the thin wall cells, and one plump cell that makes surfactant.
  for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2, d = 0.4 + r() * 0.5; c.fillStyle = 'rgba(90,60,140,0.55)'; oval(c, ox + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 2.6, 1.1, a); c.fill(); }
  { const a = r() * Math.PI * 2; c.fillStyle = 'rgba(110,70,150,0.6)'; oval(c, ox + Math.cos(a) * rx * 0.6, cy + Math.sin(a) * ry * 0.6, 2.8, 2.2); c.fill(); }
  c.restore();
  // The rim, and a wet highlight high on the left.
  outline(); c.strokeStyle = 'rgba(255,215,228,0.7)'; c.lineWidth = 1.2; c.stroke();
  c.strokeStyle = 'rgba(255,245,250,0.55)'; c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.ellipse(ox, cy, rx * 0.86, ry * 0.86, 0, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  void top;
}

const FLOOR_W = TW * 1.6, FLOOR_H = TH * 1.6 + 6;
/** Sinusoid floor: the thin lining of a blood channel, perforated by clusters of pores. Soft-edged, so tiles melt together. */
/** What the floor between the walls is. liver: the sieve-plated lining of a sinusoid. vessel: endothelium, flat cells
 *  drawn out along the flow. heart: endocardium, smooth and glossy over the ridged muscle under it. stomach: mucosa,
 *  dimpled with gastric pits under a film of mucus. lung: the thin wall of an air space, a net of capillaries showing through. */
type Ground = 'liver' | 'vessel' | 'heart' | 'stomach' | 'lung';
const GROUND: Record<Ground, string> = { liver: '#7c2231', vessel: '#7a1c2a', heart: '#6e1826', stomach: '#7a3a3c', lung: '#8a3a46' };
function paintFloor(c: Ctx, variant: number, dead: boolean, ground: Ground = 'liver') {
  const r = rand(variant * 17 + (dead ? 91 : 5)), ox = FLOOR_W / 2, oy = FLOOR_H / 2, base = GROUND[ground];
  // A feathered pool of colour a little bigger than the tile: neighbours overlap and no seam shows.
  c.save(); c.shadowColor = base; c.shadowBlur = 8 * spriteScale; c.fillStyle = base;
  oval(c, ox, oy, TW * 0.55, TH * 0.55); c.fill(); c.fill(); c.restore();
  poly(c, [ox, oy - TH / 2 - 2, ox + TW / 2 + 4, oy, ox, oy + TH / 2 + 2, ox - TW / 2 - 4, oy]);
  c.save(); c.clip();
  // Slow streaks in the plasma.
  for (let i = 0; i < 5; i++) {
    c.strokeStyle = `rgba(${r() < 0.5 ? '255,150,150' : '40,5,12'},${0.04 + r() * 0.05})`; c.lineWidth = 1 + r() * 2.5; c.lineCap = 'round';
    const y = oy - 12 + r() * 24, x = ox - 26 + r() * 18;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 16, y + (r() - 0.5) * 8, x + 26 + r() * 14, y + 5 + r() * 7); c.stroke();
  }
  if (ground !== 'liver') groundOf(c, r, ground, ox, oy);
  // Fenestrations: the sieve plates of a liver sinusoid.
  if (ground === 'liver') for (let k = 0; k < 3; k++) {
    const cx = ox + (r() - 0.5) * 30, cy = oy + (r() - 0.5) * 12;
    for (let i = 0; i < 8; i++) {
      c.fillStyle = `rgba(28,4,10,${0.28 + r() * 0.3})`;
      oval(c, cx + (r() - 0.5) * 11, cy + (r() - 0.5) * 5.5, 0.9, 0.5); c.fill();
    }
  }
  if (dead) {
    // What is left of a hepatocyte: a collapsed membrane, spilled granules, a broken nucleus.
    c.fillStyle = 'rgba(86,70,84,0.72)'; c.beginPath(); lumpy(c, ox, oy, 25, 11.5, variant + 2, 0.12); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(190,168,180,0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.3, d = 6 + r() * 14;
      c.beginPath(); c.moveTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d * 0.5);
      c.quadraticCurveTo(ox + Math.cos(a + 0.6) * d * 1.2, oy + Math.sin(a + 0.6) * d * 0.6, ox + Math.cos(a + 1.1) * d, oy + Math.sin(a + 1.1) * d * 0.5); c.stroke();
    }
    for (let i = 0; i < 26; i++) {
      c.fillStyle = r() < 0.3 ? 'rgba(58,32,92,0.85)' : r() < 0.5 ? 'rgba(132,130,48,0.6)' : 'rgba(170,120,136,0.5)';
      oval(c, ox + (r() - 0.5) * 44, oy + (r() - 0.5) * 20, 0.8 + r() * 1.8, 0.5 + r()); c.fill();
    }
  }
  c.restore();
}

function groundOf(c: Ctx, r: () => number, ground: Ground, ox: number, oy: number) {
  if (ground === 'vessel') {
    // Endothelial cells: long flat cobbles, all pointing the way the blood runs (one diagonal of the grid), each with a faint flat nucleus.
    for (let k = 0; k < 7; k++) {
      const cx = ox + (r() - 0.5) * 60, cy = oy + (r() - 0.5) * 30, L = 14 + r() * 8;
      c.strokeStyle = 'rgba(30,4,10,0.22)'; c.lineWidth = 0.8; oval(c, cx, cy, L, 3.2 + r(), 0.46); c.stroke();
      c.fillStyle = 'rgba(255,170,170,0.05)'; c.fill();
      c.fillStyle = 'rgba(70,30,80,0.2)'; oval(c, cx + (r() - 0.5) * 4, cy, 3.4, 1.2, 0.46); c.fill();
    }
  } else if (ground === 'heart') {
    // Endocardium: a wet, glassy lining. Under it the trabeculae, broad soft ridges of muscle, show as slow light and dark bands.
    for (let k = 0; k < 3; k++) {
      const y = oy - 10 + k * 10 + (r() - 0.5) * 4;
      c.strokeStyle = 'rgba(30,4,12,0.2)'; c.lineWidth = 5 + r() * 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ox - 40, y + 8); c.quadraticCurveTo(ox, y - 6 + (r() - 0.5) * 6, ox + 40, y + 2); c.stroke();
      c.strokeStyle = 'rgba(255,190,190,0.07)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox - 40, y + 5); c.quadraticCurveTo(ox, y - 9, ox + 40, y - 1); c.stroke();
    }
    c.fillStyle = 'rgba(255,230,230,0.06)'; oval(c, ox - 8, oy - 4, 18, 5, -0.2); c.fill(); // gloss
  } else if (ground === 'stomach') {
    // Gastric pits: small dark openings in a loose honeycomb, each with a pale lip of mucus.
    for (let k = 0; k < 9; k++) {
      const cx = ox + (r() - 0.5) * 54, cy = oy + (r() - 0.5) * 24;
      c.fillStyle = 'rgba(40,14,20,0.4)'; oval(c, cx, cy, 2.2, 1.2); c.fill();
      c.strokeStyle = 'rgba(255,236,226,0.16)'; c.lineWidth = 0.8; oval(c, cx - 0.3, cy - 0.3, 3.4, 1.9); c.stroke();
    }
    c.fillStyle = 'rgba(255,240,230,0.05)'; oval(c, ox, oy, 26, 10); c.fill(); // mucus film
  } else if (ground === 'lung') {
    // A capillary net under a wall one cell thick.
    c.strokeStyle = 'rgba(170,30,50,0.22)'; c.lineWidth = 1;
    for (let k = 0; k < 6; k++) { const x = ox + (r() - 0.5) * 50, y = oy + (r() - 0.5) * 22; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y + (r() - 0.5) * 8, x + 14 + r() * 8, y + (r() - 0.5) * 8); c.stroke(); }
  }
}

// ---------- red blood cells ----------

// Purely for show, so they live here and not in the rules. They drift with the blood,
// which in a liver always means toward the central vein.
interface Rbc extends Point { z: number; spin: number; seed: number }
let heroMoving = false, heroWas: Point = { x: 0, y: 0 }, heroTurn = 0, heroSpin = 0, frameDt = 0;

// ---------- a body that moves ----------
// Nothing in here is rigid. Every wall takes the pulse a moment after the one upstream of it, the stomach
// squeezes in slow waves, and the lung's air sacs swell and sink with each breath. All of it is for the eye:
// the rules still see walls where they have always been.
const pulses: { t: number; k: number }[] = [];
function pulseAt(time: number, delay: number): number {
  const at = time - delay;
  for (let n = pulses.length - 1; n >= 0; n--) if (pulses[n].t <= at) return pulses[n].k;
  return 0;
}
/** How full the lungs are, 0 to 1. The first half of each breath is in. */
/** How full one air sac is, 0 to 1: the breath reaches sacs further from the airway a moment later. */
function lungFill(s: State, x: number, y: number): number {
  const len = CONFIG.host.breath[hostState(s)], lag = Math.hypot(x - s.vein.x, y - s.vein.y) * 0.05;
  return 0.5 - 0.5 * Math.cos((((s.time - lag) % len + len) % len) / len * Math.PI * 2);
}
export const breath = (s: State) => { const len = CONFIG.host.breath[hostState(s)]; return 0.5 - 0.5 * Math.cos(((s.time % len) / len) * Math.PI * 2); };
interface Sway { dx: number; dy: number; sx: number; sy: number }
const REST: Sway = { dx: 0, dy: 0, sx: 1, sy: 1 };
function sway(s: State, v: View, x: number, y: number): Sway {
  if (v.still) return REST;
  const t = v.time, stressed = hostState(s) === 'stressed' ? 1.6 : 1;
  // Soft tissue never quite holds still.
  let dx = Math.sin(t * 0.7 + x * 0.9 + y * 0.4) * 0.9, dy = Math.cos(t * 0.55 + x * 0.3 - y * 0.8) * 0.7, sx = 1, sy = 1;
  // The pulse arrives as a wave running along the tissue.
  const amp = (s.place === 'vessel' ? (s.vessel === 'artery' ? 0.05 : 0.018) : s.place === 'liver' ? 0.022 : 0.014) * stressed;
  const k = pulseAt(t, (x + y) * 0.014);
  sx += amp * k; sy += amp * k * 0.8;
  if (s.place === 'stomach') {
    // Peristalsis: rings of muscle tightening one after another, harder when there is a meal to work on.
    const fed = digesting(s.host.hour, s.host.snack, s.event), g = 0.3 + 0.7 * fed;
    const w = Math.max(0, Math.sin(x * 0.5 + y * 0.35 - t * (0.8 + 0.6 * fed))), squeeze = w * w * g;
    const mid = s.size / 2, to = project(mid - x, mid - y), len = Math.hypot(to.x, to.y) || 1;
    dx += (to.x / len) * 5 * squeeze; dy += (to.y / len) * 5 * squeeze;
    sy *= 1 + 0.08 * squeeze; sx *= 1 - 0.05 * squeeze;
  } else if (s.place === 'lung') {
    // Air sacs fill and empty. The breath arrives as a wave rolling out from the airway, so you can
    // watch it travel across the field. (Readability bend: real alveoli swell by roughly this much,
    // but all at once and too slowly to notice; the wave makes the breath legible at a glance.)
    const b = lungFill(s, x, y), own = 0.9 + 0.2 * hash(x + 3, y + 7), full = 0.86 + 0.24 * b * own;
    sx *= full; sy *= full; dy -= 3 * b * own;
  }
  return { dx, dy, sx, sy };
}
interface Lump { x: number; y: number; r: number; fall: number; alpha: number; hue: number; fizz: number }
let lakeFor: unknown = null, lake: Point[] = [];
/** Food in the stomach: it drops in at a meal, sits in the acid, and comes apart. */
export function food(s: State): Lump[] {
  if (s.place !== 'stomach' || !s.acid) return [];
  if (lakeFor !== s.acid) { lakeFor = s.acid; lake = []; for (let i = 0; i < s.acid.length; i++) if (s.acid[i] === 2) lake.push({ x: i % s.size, y: Math.floor(i / s.size) }); }
  const fed = digesting(s.host.hour, s.host.snack, s.event), out: Lump[] = [];
  if (!lake.length || fed <= 0) return out;
  for (let k = 0; k < Math.ceil(fed * 26); k++) {
    const life = 15 + (k % 5) * 2.5, at = s.time + k * 4.3, round = Math.floor(at / life), ph = (at % life) / life;
    const tile = lake[Math.floor(hash(k * 7 + 1, round * 13 + 5) * lake.length)];
    out.push({
      x: tile.x + 0.2 + hash(k, round) * 0.6, y: tile.y + 0.2 + hash(round, k + 9) * 0.6,
      r: (10 + hash(k + 2, 3) * 10) * Math.pow(1 - ph, 0.6), fall: Math.max(0, 1 - ph / 0.07), alpha: Math.min(1, ph / 0.05) * Math.min(1, (1 - ph) / 0.15),
      hue: k % 4, fizz: ph,
    });
  }
  return out;
}
let rbcs: Rbc[] = [], flow: Int16Array | null = null, flowFor: State | null = null, flowKills = -1, lastTime = 0;

function flowField(s: State): Int16Array {
  if (flow && flowFor === s && flowKills === s.cellsKilled) return flow;
  const N = s.size, d = new Int16Array(N * N).fill(-1), queue = s.junction ? s.junction.exits.map((e) => idx(s, e.at.x, e.at.y)) : [idx(s, s.vein.x, s.vein.y)];
  for (const q of queue) d[q] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head], cx = cur % N, cy = Math.floor(cur / N);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = idx(s, cx + dx, cy + dy);
      if (open(s, cx + dx, cy + dy) && d[i] < 0) { d[i] = d[cur] + 1; queue.push(i); }
    }
  }
  if (flowFor !== s) rbcs = [];
  flow = d; flowFor = s; flowKills = s.cellsKilled;
  return d;
}

function driftBlood(s: State, dt: number) {
  const d = flowField(s), p = s.player, N = s.size;
  while (rbcs.length < 54) rbcs.push({ x: -99, y: -99, z: 0, spin: 0, seed: Math.random() });
  for (const b of rbcs) {
    const tx = Math.floor(b.x), ty = Math.floor(b.y);
    const lost = !open(s, tx, ty) || d[idx(s, tx, ty)] < 2 || Math.hypot(b.x - p.x, b.y - p.y) > 15;
    if (lost) {
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * 6.283, r = 3 + Math.random() * 11, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (open(s, Math.floor(x), Math.floor(y)) && d[idx(s, Math.floor(x), Math.floor(y))] > 3) { b.x = x; b.y = y; b.z = 5 + Math.random() * 16; b.spin = Math.random() * 6; break; }
      }
      continue;
    }
    // Step toward whichever neighbouring tile is closer to the vein.
    let best = d[idx(s, tx, ty)], bx = tx, by = ty;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const v = open(s, tx + dx, ty + dy) ? d[(ty + dy) * N + tx + dx] : -1;
      if (v >= 0 && v < best) { best = v; bx = tx + dx; by = ty + dy; }
    }
    const gx = bx + 0.25 + b.seed * 0.5 - b.x, gy = by + 0.25 + ((b.seed * 7) % 1) * 0.5 - b.y, len = Math.hypot(gx, gy) || 1;
    const speed = 0.9 + b.seed * 0.9;
    b.x += (gx / len) * speed * dt; b.y += (gy / len) * speed * dt;
    b.spin += dt * (0.6 + b.seed);
  }
}

/** A red blood cell: a disc with a dimple, tumbling slowly. About 7 micrometres across. */
function bloodCell(ctx: Ctx, b: Rbc, time: number) {
  const c = project(b.x, b.y), y = c.y - b.z - Math.sin(time * 1.3 + b.seed * 9) * 2.5;
  const tilt = 0.35 + 0.5 * Math.abs(Math.sin(b.spin)), rx = 8.5, ry = rx * tilt, rot = Math.sin(b.spin * 0.7) * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; oval(ctx, c.x, c.y, 7, 3.2); ctx.fill();
  const g = ctx.createRadialGradient(c.x - 2, y - ry * 0.4, 0.5, c.x, y, rx);
  g.addColorStop(0, 'rgba(238,96,84,0.95)'); g.addColorStop(0.75, 'rgba(182,38,40,0.95)'); g.addColorStop(1, 'rgba(110,16,24,0.95)');
  ctx.fillStyle = g; oval(ctx, c.x, y, rx, ry, rot); ctx.fill();
  ctx.fillStyle = 'rgba(96,12,20,0.55)'; oval(ctx, c.x + 0.6, y + 0.4, rx * 0.42, ry * 0.42, rot); ctx.fill(); // the dimple
  ctx.strokeStyle = 'rgba(255,170,150,0.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(c.x, y, rx - 0.8, Math.max(0.2, ry - 0.8), rot, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
}

// ---------- the scene ----------

// How brightly each tile is currently drawn, eased toward what the rules say so nothing snaps on or off.
let glowFor: Uint8Array | null = null, night = 0;
let lit = new Float32Array(0), known = new Float32Array(0), reek = new Float32Array(0), thin = new Float32Array(0);
const FADE_IN = 0.45, FADE_OUT = 0.8, FADE_KNOWN = 0.5; // seconds

export function draw(ctx: Ctx, s: State, v: View) {
  const p = s.player, R = vision(s), scale = v.zoom * v.dpr;
  const dt = Math.min(0.05, Math.max(0, v.time - lastTime)); lastTime = v.time;
  driftBlood(s, dt * (0.5 + currentStrength(s) * 3.5)); // the red cells show how hard the blood is running
  if (dt > 0) { heroMoving = Math.hypot(p.x - heroWas.x, p.y - heroWas.y) > dt * 0.5; heroWas = { x: p.x, y: p.y }; }
  frameDt = dt;
  {
    // The hull swings round to a new heading instead of snapping to it, and rolls a little into the turn.
    const f = project(p.face.x, p.face.y), want = Math.atan2(f.y, f.x);
    let off = want - heroTurn; off = Math.atan2(Math.sin(off), Math.cos(off));
    const step = v.still || dt <= 0 ? (v.still ? off : 0) : off * (1 - Math.exp(-dt * 9));
    heroTurn += step;
    heroSpin += ((dt > 0 ? step / dt : 0) - heroSpin) * Math.min(1, dt * 8);
  }
  pulses.push({ t: v.time, k: v.kick }); if (pulses.length > 150) pulses.shift();

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.save();
  const cam = project(p.x, p.y);
  ctx.translate(v.w / 2, v.h / 2);
  // The whole view jumps a hair with each kick once the music is loud.
  const hot = Math.max(0, (v.heat - 0.4) / 0.6), punch = v.still ? 0 : hot * v.kick;
  // The host breathes, and everything inside them rides up and down a little with it. In the lung it is most of the view.
  const air = v.still ? 0.5 : breath(s), heave = s.place === 'lung' ? 0.02 : 0.004;
  ctx.scale(v.zoom * (1 + punch * 0.022) * (1 + (air - 0.5) * heave), v.zoom * (1 + punch * 0.022) * (1 + (air - 0.5) * heave));
  ctx.translate(-cam.x, -cam.y);

  const span = Math.ceil(v.w / v.zoom / TW + v.h / v.zoom / TH) + 2;
  const px = Math.floor(p.x), py = Math.floor(p.y);
  const target = stripTarget(s);
  const things: { depth: number; draw: () => void }[] = [];
  const seenAt = (q: Point) => s.visible[idx(s, Math.floor(q.x), Math.floor(q.y))] === 1;
  const floors: { x: number; y: number; i: number; c: Point; vis: boolean }[] = [];
  const road = s.place === 'vessel', gut = s.place === 'stomach', heart = s.junction?.kind === 'heart';
  const ground: Ground = heart ? 'heart' : road ? 'vessel' : gut ? 'stomach' : s.place === 'lung' ? 'lung' : 'liver';
  if (glowFor !== s.explored) { glowFor = s.explored; lit = new Float32Array(s.size * s.size); known = new Float32Array(s.size * s.size); reek = new Float32Array(s.size * s.size); thin = new Float32Array(s.size * s.size); }
  // Whatever matters on screen: a cell standing in front of one of these goes glassy so you can see it.
  const behind: Point[] = [p, ...s.enemies.filter(seenAt), ...s.pickups.filter(seenAt), ...s.antibodies.filter(seenAt)].map((q) => project(q.x, q.y));
  const hides = (c: Point) => behind.some((q) => c.y - q.y > 1 && c.y - q.y < 62 && Math.abs(c.x - q.x) < 42);

  for (let y = Math.max(0, py - span); y <= Math.min(s.size - 1, py + span); y++) {
    for (let x = Math.max(0, px - span); x <= Math.min(s.size - 1, px + span); x++) {
      const i = idx(s, x, y);
      if (!s.explored[i]) continue;
      const c = project(x + 0.5, y + 0.5);
      if (Math.abs(c.x - cam.x) > v.w / v.zoom / 2 + TW || Math.abs(c.y - cam.y) > v.h / v.zoom / 2 + TH * 2.5) continue;
      const vis = s.visible[i] === 1, t = s.tiles[i];
      lit[i] = vis ? Math.min(1, lit[i] + dt / FADE_IN) : Math.max(0, lit[i] - dt / FADE_OUT);
      known[i] = Math.min(1, known[i] + dt / FADE_KNOWN);
      const glow = lit[i] * lit[i] * (3 - 2 * lit[i]), seen = known[i]; // smoothstep: eases in and out
      if (t === 'cell') {
        const variant = Math.floor(hash(x, y) * CELL_VARIANTS);
        const hit = !!target && target.x === x && target.y === y;
        const dying = hit && p.channel?.kind === 'strip' ? p.channel.t / p.channel.total : 0;
        thin[i] = hides(c) ? Math.min(1, thin[i] + dt / 0.3) : Math.max(0, thin[i] - dt / 0.5);
        const glass = 1 - 0.72 * thin[i] * thin[i] * (3 - 2 * thin[i]);
        const m = sway(s, v, x, y);
        things.push({ depth: depthOf(x + 0.5, y + 0.5), draw: () => {
          const squash = 1 - dying * 0.4, h = CELL_OY * squash;
          // The remembered look underneath, the lit look faded in over it.
          for (const memory of [true, false]) {
            const a = memory ? (glow > 0.99 ? 0 : seen) : glow;
            if (a < 0.01) continue;
            const rich = s.rich.has(i), look = s.place === 'lung' ? 'l' : heart ? 'h' : road ? (s.vessel === 'vein' ? 'b' : 'v') : rich ? 'p' : gut ? 'g' : s.tumor.has(i) ? 't' : 'c';
            const img = sprite(`${look}${variant}`, CELL_W, CELL_H, scale, memory, (cx) => {
              if (look === 'l') { paintAlveolus(cx, variant); return; }
              paintCell(cx, variant, look === 'h' ? 'heart' : look === 'v' || look === 'b' ? 'muscle' : look === 'g' || look === 'p' ? 'mucosa' : 'liver');
              if (look === 'c' || look === 'h') return;
              // The same living cells in other tissues: soaked in arterial red in a vessel wall, pale and
              // slimy in the stomach, and amber where a parietal cell is busy making acid.
              cx.globalCompositeOperation = 'source-atop';
              cx.fillStyle = look === 'v' ? 'rgba(128,18,30,0.55)' : look === 'b' ? 'rgba(44,40,120,0.5)' : look === 'p' ? 'rgba(240,160,30,0.5)' : look === 't' ? 'rgba(38,30,70,0.72)' : 'rgba(150,170,130,0.38)'; cx.fillRect(0, 0, CELL_W, CELL_H);
              cx.globalCompositeOperation = 'source-over';
            });
            ctx.globalAlpha = a * glass;
            // Squash toward the floor as the cell is torn open.
            if (dying) ctx.drawImage(img, 0, 0, img.width, (CELL_OY / CELL_H) * img.height, c.x - CELL_OX, c.y - h, CELL_W, h);
            else ctx.drawImage(img, c.x + m.dx - CELL_OX * m.sx, c.y + m.dy - CELL_OY * m.sy, CELL_W * m.sx, CELL_H * m.sy);
          }
          if (s.place === 'lung' && glow > 0.01 && !v.still) {
            // A full sac is stretched thin and flushed with fresh blood; an empty one is slack and duller.
            const b = lungFill(s, x, y), cx0 = c.x + m.dx + cellShift(variant) * m.sx, cy0 = c.y + m.dy - cellHeight(variant) * m.sy, rr = cellRadius(variant) * m.sx;
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = glow * glass * (0.04 + 0.2 * b);
            const flush = ctx.createRadialGradient(cx0 - rr * 0.25, cy0 - rr * 0.15, 1, cx0, cy0, rr);
            flush.addColorStop(0, 'rgba(255,190,205,1)'); flush.addColorStop(1, 'rgba(255,150,170,0)');
            ctx.fillStyle = flush; oval(ctx, cx0, cy0, rr, rr * 0.5); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha = 1;
          if (hit) {
            ctx.strokeStyle = dying ? '#ff5a4d' : 'rgba(236,180,46,0.95)'; ctx.lineWidth = 2;
            oval(ctx, c.x + cellShift(variant), c.y - cellHeight(variant) * squash, cellRadius(variant) - 3, cellRadius(variant) / 2 - 1.5); ctx.stroke();
          }
        } });
        continue;
      }
      floors.push({ x, y, i, c, vis });
    }
  }
  // Remembered floor first, lit floor over it, so the edge of your sight is a soft boundary and not a staircase.
  // Each tile's lit look is faded in over its remembered one, so light arrives and leaves gradually.
  const floorImg = (x: number, y: number, i: number, memory: boolean) => {
    const variant = Math.floor(hash(x, y) * 6), dead = s.tiles[i] === 'dead';
    return sprite(`f${ground}${variant}${dead ? 'd' : ''}`, FLOOR_W, FLOOR_H, scale, memory, (cx) => paintFloor(cx, variant, dead, ground));
  };
  const ease = (i: number) => lit[i] * lit[i] * (3 - 2 * lit[i]);
  for (const { x, y, i, c } of floors) {
    if (ease(i) > 0.99) continue;
    ctx.globalAlpha = known[i];
    ctx.drawImage(floorImg(x, y, i, true), c.x - FLOOR_W / 2, c.y - FLOOR_H / 2, FLOOR_W, FLOOR_H);
  }
  for (const { x, y, i, c } of floors) {
    const a = ease(i);
    if (a < 0.01) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(floorImg(x, y, i, false), c.x - FLOOR_W / 2, c.y - FLOOR_H / 2, FLOOR_W, FLOOR_H);
  }
  ctx.globalAlpha = 1;
  for (const { x, y, i, c, vis } of floors) {
    {

      const g = s.glucose.get(i);
      // Drawn with the standing things, so a neighbouring floor tile cannot wash over it.
      if (g !== undefined) things.push({ depth: depthOf(x + 0.5, y + 0.5) - 0.8, draw: () => {
        if (vis && g > 0) {
          ctx.globalCompositeOperation = 'lighter';
          const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 36);
          glow.addColorStop(0, `rgba(236,180,46,${0.22 + 0.06 * Math.sin(v.time * 3)})`); glow.addColorStop(1, 'rgba(236,180,46,0)');
          ctx.fillStyle = glow; oval(ctx, c.x, c.y, 36, 18); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        // Sugar crystallised out of the blood: small faceted prisms.
        for (let k = 0; k < CONFIG.energy.patchMax; k++) {
          const gx = c.x - 13 + k * 13, gy = c.y + (k % 2 ? 4 : -3), full = k < g, a = vis ? 1 : 0.35;
          ctx.globalAlpha = full ? a : a * 0.22;
          ctx.fillStyle = '#b5820f'; poly(ctx, [gx - 5, gy - 2, gx, gy + 2, gx, gy - 9, gx - 5, gy - 11]); ctx.fill();
          ctx.fillStyle = '#8a5f08'; poly(ctx, [gx + 5, gy - 2, gx, gy + 2, gx, gy - 9, gx + 5, gy - 11]); ctx.fill();
          ctx.fillStyle = '#ffe08a'; poly(ctx, [gx, gy - 14, gx + 5, gy - 11, gx, gy - 9, gx - 5, gy - 11]); ctx.fill();
          ctx.globalAlpha = 1;
        }
      } });
    }
  }

  // The stomach's lake: acid glows a sour green that brightens as the host digests; mucus lies pale along its shore.
  if (s.acid) {
    const strength = acidLevel(s);
    for (const { c, i, x, y } of floors) {
      const kind = s.acid[i];
      if (!kind) continue;
      const shown = Math.max(lit[i], 0.35) * known[i];
      if (kind === 2) {
        const swell = 0.5 + 0.5 * Math.sin(v.time * 1.3 + x * 0.9 + y * 0.6);
        ctx.fillStyle = `rgba(${150 + 40 * strength},${205 + 30 * strength},60,${shown * (0.2 + 0.3 * strength + 0.06 * swell)})`;
      } else ctx.fillStyle = `rgba(226,232,214,${shown * 0.3})`;
      oval(ctx, c.x, c.y, TW * 0.56, TH * 0.56); ctx.fill();
      if (kind === 2 && hash(x * 7 + Math.floor(v.time * 0.7 + hash(x, y) * 9), y * 3) > 0.9 - strength * 0.12) { // bubbles
        const up = (v.time * 0.7 + hash(x, y) * 9) % 1;
        ctx.fillStyle = `rgba(235,255,170,${shown * 0.5 * (1 - up)})`;
        oval(ctx, c.x + (hash(y, x) - 0.5) * 30, c.y - up * 10, 2.2, 2.2); ctx.fill();
      }
    }
  }

  // Your scent on the current: a faint sickly haze over every tile it has reached.
  ctx.globalCompositeOperation = 'lighter';
  for (const { c, i } of floors) {
    // Eased, like the light, so the haze drifts along with you and never jumps from tile to tile.
    const aim = Math.max(0, 1 - s.scent[i] / (CONFIG.scent.reach * scentScale(s)));
    reek[i] += Math.max(-dt / 0.9, Math.min(dt / 0.6, aim - reek[i]));
    const whiff = Math.max(lit[i], 0.4) * reek[i];
    if (whiff < 0.03) continue;
    const haze = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, TW * 0.62);
    haze.addColorStop(0, `rgba(200,225,80,${0.26 * whiff})`); haze.addColorStop(1, 'rgba(190,215,90,0)');
    ctx.fillStyle = haze; oval(ctx, c.x, c.y, TW * 0.62, TH * 0.62); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Your footprints, fading as they age. Immune cells that cross them will follow.
  const life = trailLife(s);
  for (const f of s.trail) {
    const left = 1 - (s.time - f.born) / life;
    if (left <= 0) continue; // you always know where you have just been
    // A dark smear of exhaust that spreads and thins steadily until it is gone.
    const c = project(f.x, f.y), r = 5 + (1 - left) * 5;
    ctx.globalAlpha = left * 0.5;
    ctx.fillStyle = '#1a0a10';
    oval(ctx, c.x, c.y, r, r * 0.5); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Vessels: openings in the floor that the blood pours into or out of.
  const vessel = (at: Point, vein: boolean, tint = '') => {
    if (!s.explored[idx(s, at.x, at.y)]) return;
    const c = project(at.x + 0.5, at.y + 0.5), size = tint ? 50 : vein ? 62 : 40, rgb = tint || (vein ? '70,110,255' : '235,60,48');
    ctx.globalAlpha = s.visible[idx(s, at.x, at.y)] === 1 ? 1 : 0.4;
    const hole = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, size);
    hole.addColorStop(0, vein ? 'rgba(4,6,26,0.98)' : 'rgba(255,150,120,0.9)');
    hole.addColorStop(0.45, vein ? 'rgba(14,22,70,0.9)' : 'rgba(200,36,30,0.75)');
    hole.addColorStop(0.8, `rgba(${rgb},0.22)`); hole.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.5); ctx.translate(-c.x, -c.y);
    ctx.fillStyle = hole; oval(ctx, c.x, c.y, size, size); ctx.fill();
    // The current: spiralling in at the vein, welling out at a portal.
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const turn = v.time * (vein ? 0.9 : -0.5) + (k / 7) * Math.PI * 2;
      ctx.strokeStyle = `rgba(${vein ? '150,180,255' : '255,190,170'},${vein ? 0.4 : 0.3})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) {
        const f = j / 10, rr = size * (0.92 - f * 0.72), a = turn + f * 2.4;
        ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${rgb},0.75)`; ctx.lineWidth = 3; oval(ctx, c.x, c.y, size * 0.5, size * 0.5); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  if (s.junction) for (const ex of s.junction.exits) vessel(ex.at, true, ex.tint); // each way out has its own colour, which is how you learn them
  else { vessel(s.vein, true); for (const portal of s.portals) vessel(portal, false); }

  // The lamp: a warm pool at your feet and a beam the way you are facing.
  const fa = heroTurn;
  ctx.globalCompositeOperation = 'lighter';
  const pool = ctx.createRadialGradient(cam.x, cam.y, 0, cam.x, cam.y, 120);
  pool.addColorStop(0, 'rgba(255,214,170,0.16)'); pool.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = pool; oval(ctx, cam.x, cam.y, 120, 60); ctx.fill();
  if (!cloaked(s)) {
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(1, 0.5); ctx.rotate(Math.atan2(Math.sin(fa) * 2, Math.cos(fa)));
    const beam = ctx.createRadialGradient(0, 0, 8, 0, 0, 250);
    beam.addColorStop(0, 'rgba(255,228,190,0.24)'); beam.addColorStop(1, 'rgba(255,228,190,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 250, -0.42, 0.42); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  if (v.hover && s.explored[idx(s, Math.floor(v.hover.x), Math.floor(v.hover.y))] && v.hoverEnemy === null && !v.mark) {
    const c = project(Math.floor(v.hover.x) + 0.5, Math.floor(v.hover.y) + 0.5);
    ctx.strokeStyle = 'rgba(255,236,210,0.3)'; ctx.lineWidth = 1.5;
    oval(ctx, c.x, c.y, TW * 0.3, TH * 0.3); ctx.stroke();
  }

  for (const b of rbcs) if (b.x > 0 && seenAt(b) && !s.acid?.[idx(s, Math.floor(b.x), Math.floor(b.y))]) things.push({ depth: depthOf(b.x, b.y), draw: () => bloodCell(ctx, b, v.time) });
  for (const e of s.enemies) if (seenAt(e)) things.push({ depth: depthOf(e.x, e.y), draw: () => enemy(ctx, e, v) });
  for (const a of s.antibodies) if (seenAt(a)) things.push({ depth: depthOf(a.x, a.y), draw: () => { const c = project(a.x, a.y); antibody(ctx, c.x, c.y - 14 + Math.sin(v.time * 1.7 + a.seed) * 3, v.time * 0.6 + a.seed, 1); } });
  if (s.tagged > 0) things.push({ depth: depthOf(p.x, p.y) + 0.02, draw: () => {
    // The ones that caught you, stuck fast and waving for attention. They fade as they work loose.
    const c = project(p.x, p.y), hold = Math.min(1, s.tagged / 1.5);
    for (let k = 0; k < 3; k++) { const a = v.time * 0.9 + k * 2.1; antibody(ctx, c.x + Math.cos(a) * 15, c.y - 20 + Math.sin(a) * 7, a, hold); }
  } });
  for (const f of food(s)) {
    if (!s.explored[idx(s, Math.floor(f.x), Math.floor(f.y))] || f.r < 0.6) continue;
    things.push({ depth: depthOf(f.x, f.y) - 0.02, draw: () => {
      // A piece of the host's meal: it lands, bobs, and fizzes away to nothing.
      const c = project(f.x, f.y), y = c.y - 4 - f.fall * f.fall * 70 + Math.sin(v.time * 1.4 + f.x * 5) * 1.5;
      const tone = ['#b98a4e', '#d8c79a', '#7f9a4a', '#a0552f'][f.hue];
      ctx.globalAlpha = f.alpha * 0.92;
      ctx.fillStyle = 'rgba(210,240,120,0.16)'; oval(ctx, c.x, y + 2, f.r * 1.7, f.r * 0.8); ctx.fill();
      ctx.fillStyle = tone; ctx.beginPath(); lumpy(ctx, c.x, y, f.r, f.r * 0.72, f.hue * 11 + Math.floor(f.x * 7), 0.16); ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,10,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; oval(ctx, c.x - f.r * 0.3, y - f.r * 0.3, f.r * 0.35, f.r * 0.18); ctx.fill();
      for (let b = 0; b < 4; b++) {
        const up = (v.time * 0.6 + b * 0.25 + f.x) % 1;
        ctx.fillStyle = `rgba(235,255,170,${(1 - up) * 0.5 * Math.min(1, f.fizz * 6)})`;
        oval(ctx, c.x + Math.sin(b * 2.4 + f.y * 9) * f.r * 0.9, y - up * 22, 1.3 + b * 0.3, 1.3 + b * 0.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } });
  }
  for (const b of s.decoys) things.push({ depth: depthOf(b.x, b.y) - 0.01, draw: () => {
    // A little knot of rod-shaped bacteria, tumbling, with a green haze that fades as it runs out.
    const c = project(b.x, b.y), fade = Math.min(1, b.t / 2) * Math.min(1, (CONFIG.flora.lasts - b.t) / 0.4);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(140,230,120,0.13)'; oval(ctx, c.x, c.y - 10, 20 + Math.sin(v.time * 2) * 2, 12); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = v.time * (0.7 + k * 0.13) + k * 1.3, x = c.x + Math.cos(a) * 7, y = c.y - 10 + Math.sin(a * 1.3) * 4;
      ctx.fillStyle = k % 2 ? '#9be38a' : '#6cc46a'; oval(ctx, x, y, 4.2, 1.7, a * 1.7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } });
  for (const item of s.pickups) {
    if (!s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) continue;
    const seen = seenAt(item);
    const kind = item.kind;
    if (kind === 'cortisol') things.push({ depth: depthOf(item.x, item.y) - 0.01, draw: () => {
      // A warm amber droplet with a slow halo.
      const c = project(item.x, item.y), y = c.y - 12 + Math.sin(v.time * 2 + item.x) * 2, pulse = 0.5 + 0.5 * Math.sin(v.time * 1.6 + item.y);
      ctx.globalAlpha = seen ? 1 : 0.35;
      ctx.fillStyle = `rgba(255,200,120,${0.12 + 0.1 * pulse})`; oval(ctx, c.x, y, 13 + pulse * 3, 13 + pulse * 3); ctx.fill();
      const g = ctx.createRadialGradient(c.x - 2, y - 2, 0.5, c.x, y, 7); g.addColorStop(0, '#fff3d8'); g.addColorStop(1, '#e09a3c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x, y - 9); ctx.quadraticCurveTo(c.x + 8, y + 1, c.x, y + 6); ctx.quadraticCurveTo(c.x - 8, y + 1, c.x, y - 9); ctx.fill();
      ctx.globalAlpha = 1;
    } });
    else if (kind === 'sibling' || kind === 'kin') things.push({ depth: depthOf(item.x, item.y) - 0.01, draw: () => {
      // A unit exactly like you, dark and slowly tumbling. Now and then its lamp tries to come on.
      const c = project(item.x, item.y), y = c.y - 13 + Math.sin(v.time * 0.9 + item.x) * 2, lit = kind === 'kin', blink = lit ? 0.75 + 0.2 * Math.sin(v.time * 1.3 + item.x) : item.lamp ? 0.45 + 0.12 * Math.sin(v.time * 0.9) : Math.max(0, Math.sin(v.time * 0.7 + item.y * 3)) ** 6;
      ctx.globalAlpha = seen ? 1 : 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; oval(ctx, c.x, c.y, 12, 5); ctx.fill();
      ctx.save(); ctx.translate(c.x, y); ctx.rotate(0.5 + Math.sin(v.time * 0.35 + item.x) * 0.5); ctx.scale(1.25, 1.25);
      ctx.fillStyle = lit ? '#3a464c' : '#262e32'; oval(ctx, -7, -3.4, 4, 1.8); ctx.fill(); oval(ctx, -7, 3.4, 4, 1.8); ctx.fill();
      const body = ctx.createRadialGradient(1, -1.5, 0.5, 0, 0, 10);
      body.addColorStop(0, lit ? '#c9d2d2' : '#6a7476'); body.addColorStop(0.55, lit ? '#7e8a8e' : '#434c50'); body.addColorStop(1, lit ? '#2e383e' : '#1e2528');
      ctx.fillStyle = body; oval(ctx, 0, 0, 10, 4.6); ctx.fill();
      ctx.fillStyle = lit ? '#7fd3e6' : '#6e6034'; ctx.fillRect(-8.5, -4, 2, 8);
      ctx.fillStyle = `rgba(150,225,255,${0.1 + blink * 0.8})`; oval(ctx, 5, 0, 3, 2.2); ctx.fill();
      ctx.restore();
      if (blink > 0.05) { ctx.fillStyle = `rgba(150,225,255,${blink * 0.12})`; oval(ctx, c.x, y, 22, 14); ctx.fill(); }
      ctx.globalAlpha = 1;
    } });
    else if (kind === 'stall') things.push({ depth: depthOf(item.x, item.y) - 0.01, draw: () => {
      // A raft of gut bacteria on a fleck of fibre: rods and beads in a soft green film, slowly turning over.
      const c = project(item.x, item.y), breathe = v.still ? 0.5 : 0.5 + 0.5 * Math.sin(v.time * 0.8);
      ctx.globalAlpha = seen ? 1 : 0.4;
      ctx.fillStyle = `rgba(123,224,138,${0.08 + 0.06 * breathe})`; oval(ctx, c.x, c.y - 6, 34 + breathe * 3, 18 + breathe * 2); ctx.fill();
      ctx.fillStyle = 'rgba(60,84,48,0.85)'; oval(ctx, c.x, c.y - 4, 20, 9); ctx.fill();
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4 + (v.still ? 0 : v.time * 0.12), r = 4 + (k % 5) * 3.2, x = c.x + Math.cos(a) * r * 1.5, y = c.y - 6 + Math.sin(a) * r * 0.7;
        ctx.fillStyle = k % 3 ? 'rgba(150,230,150,0.85)' : 'rgba(230,220,140,0.85)';
        ctx.save(); ctx.translate(x, y); ctx.rotate(a * 1.7); oval(ctx, 0, 0, k % 2 ? 4.2 : 2.2, 1.8); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    } });
    else if (kind === 'drop') things.push({ depth: depthOf(item.x, item.y) - 0.01, draw: () => {
      // Shepherd's supply drop: a fibrin patch in a ring of its amber light.
      const c = project(item.x, item.y), ease = v.still ? 0.8 : 0.7 + 0.3 * Math.sin(v.time * 1.6);
      ctx.globalAlpha = seen ? 1 : 0.4;
      ctx.strokeStyle = `rgba(240,170,90,${0.7 * ease})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(c.x, c.y - 4, 20, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      pickup(ctx, item.x, item.y, 'patch', seen, v.time);
    } });
    else things.push({ depth: depthOf(item.x, item.y) - 0.01, draw: () => pickup(ctx, item.x, item.y, kind, seen, v.time) });
  }
  things.push({ depth: depthOf(p.x, p.y), draw: () => hero(ctx, s, v) });
  if (s.snare > 0) things.push({ depth: depthOf(p.x, p.y) + 0.01, draw: () => {
    // A neutrophil's net: pale strands of DNA strung across you.
    const c = project(p.x, p.y), rf = rand(77);
    ctx.globalAlpha = Math.min(1, s.snare * 2) * 0.8;
    ctx.strokeStyle = '#dfe6ff'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = rf() * Math.PI * 2, r = 16 + rf() * 12;
      ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r, c.y - 18 + Math.sin(a) * r * 0.8);
      ctx.quadraticCurveTo(c.x + (rf() - 0.5) * 8, c.y - 18 + (rf() - 0.5) * 8, c.x - Math.cos(a + rf()) * r, c.y - 18 - Math.sin(a + rf()) * r * 0.8); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } });
  // Hiding places: a dark slit in the wall with a faint cool rim. Readability bend: the real gap is far too thin to see.
  for (const k of s.niche) {
    if (!s.explored[k]) continue;
    const q = project((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5), lit = s.visible[k] === 1, mine = inNiche(s) && idx(s, Math.floor(s.player.x), Math.floor(s.player.y)) === k;
    // The space of Disse: the thin sinusoid lining lifts away from the liver cells, leaving a dark gap
    // fringed with microvilli. Drawn as a recessed slit under a pale overhanging lip.
    ctx.globalAlpha = lit ? 1 : 0.45;
    const rx = TW * 0.36, ry = TH * 0.3, rr = rand(k * 7 + 1);
    ctx.fillStyle = 'rgba(4,6,10,0.8)'; oval(ctx, q.x, q.y + 1, rx, ry); ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,100,0.55)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    for (let m = 0; m < 14; m++) { // microvilli: short fingers reaching into the gap from the liver-cell side
      const a = Math.PI * (0.1 + 0.8 * (m / 13)), x0 = q.x + Math.cos(a) * rx * 0.92, y0 = q.y + 1 + Math.sin(a) * ry * 0.92, len = 3 + rr() * 2.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - Math.cos(a) * len * 0.6, y0 - Math.sin(a) * len); ctx.stroke();
    }
    // the lifted lining: a pale translucent lip over the far edge
    ctx.fillStyle = 'rgba(232,190,196,0.45)';
    ctx.beginPath(); ctx.ellipse(q.x, q.y - 1, rx * 1.02, ry * 0.95, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.ellipse(q.x, q.y + 2, rx * 0.92, ry * 0.6, 0, Math.PI * 1.97, Math.PI * 1.03, true); ctx.closePath(); ctx.fill();
    // a cool rim, brighter while you are tucked in (machine teal: the only colour that means "safe for you")
    ctx.strokeStyle = mine ? 'rgba(120,240,225,0.85)' : 'rgba(120,210,215,0.35)'; ctx.lineWidth = mine ? 2 : 1; oval(ctx, q.x, q.y + 1, rx + 1.5, ry + 1); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (s.search && s.alert > 0) {
    // The search area: a soft ring on the floor that breathes slowly. Inside it they are still looking.
    const z = s.search, slow = v.still ? 0.5 : 0.5 + 0.5 * Math.sin(v.time * 1.1), inside = inSearch(s);
    ctx.beginPath();
    for (let k = 0; k <= 56; k++) { const a = (k / 56) * Math.PI * 2, q = project(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.fillStyle = `rgba(190,60,130,${inside ? 0.05 + 0.02 * slow : 0.025})`; ctx.fill();
    ctx.strokeStyle = `rgba(236,110,180,${0.55 + 0.25 * slow})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = v.still ? 0 : -v.time * 6; ctx.stroke();
    ctx.setLineDash([]);
  }
  things.sort((a, b) => a.depth - b.depth);
  for (const t of things) t.draw();

  // A hiding place is usually tucked behind a cell from where you are looking, so each one in view also carries a small steady mark above the wall.
  for (const k of s.niche) {
    if (!s.visible[k]) continue;
    // A small downward chevron with a soft glow and a fine leader line to the floor: "here", in the unit's teal.
    const q = project((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5), y = q.y - 46;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(q.x, y, 0, q.x, y, 12);
    halo.addColorStop(0, 'rgba(120,220,225,0.22)'); halo.addColorStop(1, 'rgba(120,220,225,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(q.x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8,14,18,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(q.x - 6, y - 3); ctx.lineTo(q.x, y + 4); ctx.lineTo(q.x + 6, y - 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,235,230,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,225,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(q.x, y + 7); ctx.lineTo(q.x, q.y - 6); ctx.stroke(); ctx.setLineDash([]);
  }
  // The ways out of a junction. Shepherd's overlay names the road it has assigned; the unit's own chart names the ones it has been down. The rest it has to learn.
  if (s.junction) {
    const ease = v.still ? 0.8 : 0.7 + 0.3 * Math.sin(v.time * 1.6);
    ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const ex of s.junction.exits) {
      if (!s.explored[idx(s, ex.at.x, ex.at.y)]) continue;
      const q = project(ex.at.x + 0.5, ex.at.y + 0.5), near = Math.max(0.35, Math.min(1, 1.4 - Math.hypot(ex.at.x + 0.5 - p.x, ex.at.y + 0.5 - p.y) / 16));
      if (ex.assigned) { ctx.strokeStyle = `rgba(240,170,90,${0.8 * ease})`; ctx.lineWidth = 2.4; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(q.x, q.y, 40, 22, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      if (!ex.assigned && !ex.known) continue; // a mouth the unit has never been down has no name yet: it has a colour, and a taste
      const name = ex.label, sub = ex.assigned ? 'assigned' : ex.note;
      ctx.globalAlpha = near;
      ctx.font = '600 13px "IBM Plex Mono", ui-monospace, monospace';
      ctx.strokeStyle = 'rgba(10,4,7,0.85)'; ctx.lineWidth = 4; ctx.strokeText(name.toUpperCase(), q.x, q.y - 44);
      ctx.fillStyle = ex.assigned ? '#e8a25a' : ex.known ? 'rgba(240,230,220,0.92)' : 'rgba(240,230,220,0.5)'; ctx.fillText(name.toUpperCase(), q.x, q.y - 44);
      if (sub) { ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'; ctx.strokeText(sub, q.x, q.y - 30); ctx.fillStyle = ex.assigned ? 'rgba(232,162,90,0.85)' : 'rgba(240,230,220,0.6)'; ctx.fillText(sub, q.x, q.y - 30); }
      ctx.globalAlpha = 1;
    }
    // A small chevron beside the ship toward the road Shepherd has assigned.
    const want = s.junction.exits.find((e) => e.assigned);
    if (want) {
      const q = project(want.at.x + 0.5, want.at.y + 0.5), h = project(p.x, p.y), dx = q.x - h.x, dy = q.y - h.y, far = Math.hypot(dx, dy);
      if (far > 120) {
        const ux = dx / far, uy = dy / far, ax = h.x + ux * 46, ay = h.y - 8 + uy * 46;
        ctx.lineCap = 'round';
        for (const [w, col] of [[5, 'rgba(10,6,4,0.7)'], [2.4, `rgba(232,162,90,${0.9 * ease})`]] as const) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          ctx.moveTo(ax - ux * 7 - uy * 7, ay - uy * 7 + ux * 7); ctx.lineTo(ax + ux * 4, ay + uy * 4); ctx.lineTo(ax - ux * 7 + uy * 7, ay - uy * 7 - ux * 7); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  // Shepherd's pointer in its first liver: a steady amber ring on the thing it wants, and a small chevron beside the ship toward it. Both breathe slowly; neither blinks.
  const want = tutorialTarget(s) ?? markTarget(s);
  if (want) {
    const q = project(want.x, want.y), h = project(p.x, p.y), dx = q.x - h.x, dy = q.y - h.y, far = Math.hypot(dx, dy), ease = v.still ? 0.8 : 0.7 + 0.3 * Math.sin(v.time * 1.6);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.visible[idx(s, Math.floor(want.x), Math.floor(want.y))] || far < 150) {
      ctx.strokeStyle = `rgba(240,170,90,${0.8 * ease})`; ctx.lineWidth = 2.4; ctx.setLineDash([6, 5]);
      const lift = s.tiles[idx(s, Math.floor(want.x), Math.floor(want.y))] === 'cell' ? 30 : 4; // on a cell, ring its top face
      ctx.beginPath(); ctx.ellipse(q.x, q.y - lift, 28, 16, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (far > 70) {
      const ux = dx / far, uy = dy / far, ax = h.x + ux * 46, ay = h.y - 8 + uy * 46;
      for (const [w, col] of [[5, 'rgba(10,6,4,0.7)'], [2.4, `rgba(232,162,90,${0.9 * ease})`]] as const) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        ctx.moveTo(ax - ux * 7 - uy * 7, ay - uy * 7 + ux * 7); ctx.lineTo(ax + ux * 4, ay + uy * 4); ctx.lineTo(ax - ux * 7 + uy * 7, ay - uy * 7 - ux * 7); ctx.stroke();
      }
    }
    ctx.restore();
  }
  for (const shot of s.shots) {
    const c = project(shot.x, shot.y), tail = project(shot.x - shot.vx * 0.05, shot.y - shot.vy * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(120,255,235,0.35)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y - 16); ctx.lineTo(c.x, c.y - 16); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,255,250,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y - 16); ctx.lineTo(c.x, c.y - 16); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // Light falls off smoothly with distance from the lamp, on top of what the walls hide.
  const reach = (R + 1.5) * TW * 0.5;
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(1, 0.5);
  const fall = ctx.createRadialGradient(0, 0, reach * 0.3, 0, 0, reach * 1.25);
  fall.addColorStop(0, 'rgba(10,4,7,0)'); fall.addColorStop(0.7, 'rgba(10,4,7,0.5)'); fall.addColorStop(1, 'rgba(10,4,7,0.72)');
  ctx.fillStyle = fall; ctx.fillRect(-4000, -8000, 8000, 16000);
  ctx.restore();

  if (hot > 0) {
    // Each beat sends a pressure wave out through the fluid from where you stand: a broad, soft band
    // of inflamed light, not a neon line. Once per beat at most (art direction, section 3).
    const grow = 1 - v.kick, r = (0.6 + grow * (R * 0.9)) * TW * 0.5, band = (10 + hot * 14);
    if (r > band) {
      const tint = hot < 0.55 ? '255,110,70' : '235,50,45';
      ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(1, 0.5);
      const wave = ctx.createRadialGradient(0, 0, r - band, 0, 0, r + band);
      wave.addColorStop(0, `rgba(${tint},0)`); wave.addColorStop(0.5, `rgba(${tint},${0.28 * hot * v.kick})`); wave.addColorStop(1, `rgba(${tint},0)`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = wave; ctx.beginPath(); ctx.arc(0, 0, r + band, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  ctx.textAlign = 'center';
  for (const fl of s.floats) {
    const c = project(fl.x, fl.y);
    ctx.globalAlpha = 1 - fl.age / 0.9;
    ctx.font = '700 15px "IBM Plex Mono", ui-monospace, monospace';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(fl.text, c.x, c.y - 40 - fl.age * 34);
    ctx.fillStyle = fl.color; ctx.fillText(fl.text, c.x, c.y - 40 - fl.age * 34);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // The fluid itself: drifting specks, lamp haze and the place's colour grade (src/atmosphere.ts).
  const here = currentAt(s, p), along = project(here.x, here.y);
  atmosphere(ctx, { w: v.w, h: v.h, dpr: v.dpr, zoom: v.zoom, time: v.time, still: v.still, kick: v.kick, cam, flow: along, strength: currentStrength(s), reach: reach * v.zoom, place: s.place === 'vessel' ? (s.vessel ?? 'artery') : s.place, breath: air, heat: hot, dt });

  // Darkness closing in at the edge of the screen.
  const dark = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
  dark.addColorStop(0, 'rgba(10,4,7,0)'); dark.addColorStop(1, 'rgba(10,4,7,0.7)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, v.w, v.h);

  if (hot > 0) {
    // Fear narrows the view: the dark closes in, and the edges flush with blood on each beat, the way
    // your own pulse shows at the edge of your sight when you are frightened. Inflamed red, never neon.
    const inner = Math.min(v.w, v.h) * (0.34 - 0.08 * hot), a = hot * (0.16 + (v.still ? 0.08 : 0.18 * v.kick));
    const edge = ctx.createRadialGradient(v.w / 2, v.h / 2, inner, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.66);
    edge.addColorStop(0, 'rgba(60,4,8,0)'); edge.addColorStop(0.6, `rgba(90,8,12,${a * 0.6})`); edge.addColorStop(1, `rgba(120,12,16,${a})`);
    ctx.fillStyle = edge; ctx.fillRect(0, 0, v.w, v.h);
  }

  if (v.mark) {
    // Points out whatever the info box on screen is talking about.
    const m = project(v.mark.x, v.mark.y);
    const x = v.w / 2 + (m.x - cam.x) * v.zoom, y = v.h / 2 + (m.y - cam.y) * v.zoom;
    const beat = (v.time * 1.4) % 1, hop = Math.abs(Math.sin(v.time * 5)) * 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3;
    oval(ctx, x, y, 34 * v.zoom, 17 * v.zoom); ctx.stroke();
    ctx.globalAlpha = 1 - beat;
    oval(ctx, x, y, (34 + beat * 30) * v.zoom, (17 + beat * 15) * v.zoom); ctx.stroke();
    ctx.globalAlpha = 1;
    const top = y - 66 * v.zoom - hop;
    ctx.fillStyle = '#ffd35a';
    poly(ctx, [x, top + 22, x - 13, top, x - 5, top, x - 5, top - 18, x + 5, top - 18, x + 5, top, x + 13, top]); ctx.fill();
    ctx.restore();
  }

  // Night: while the host sleeps everything cools toward blue. It comes on over a few seconds.
  night += Math.max(-dt / 4, Math.min(dt / 4, (hostState(s) === 'asleep' ? 1 : 0) - night));
  if (night > 0.01) { ctx.fillStyle = `rgba(14,26,96,${0.2 * night})`; ctx.fillRect(0, 0, v.w, v.h); }
  if (v.showMap && !v.mark) automap(ctx, s, v);
}

/** A wobbling outline: nothing alive in here holds a fixed shape. */
function blob(ctx: Ctx, x: number, y: number, r: number, time: number, seed: number, lumps: number, depth: number, squash = 0.92) {
  ctx.beginPath();
  for (let k = 0; k <= 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const rr = r * (1 + depth * Math.sin(a * lumps + time * 2.1 + seed) + depth * 0.5 * Math.sin(a * (lumps + 3) - time * 1.3 + seed * 2));
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash);
  }
  ctx.closePath();
}

function enemy(ctx: Ctx, e: Enemy, v: View) {
  enemyBody(ctx, e, v);
  // It has found something and is making sure: a ring closes over it. Get clear before it closes and it loses you.
  const onto = e.mood === 'chase' ? 0 : e.onto ?? 0;
  if (onto > 0.02) {
    // Drawn on the floor round the cell, in the iso plane, so it reads as the cell taking hold of
    // the ground you left rather than a badge floating over it. It fills clockwise and warms from
    // pale to inflamed red as it closes. No blinking. (Readability bend: real cells give no sign.)
    const q = project(e.x, e.y), rx = (e.kind === 'kupffer' ? 26 : 18), ry = rx * 0.5, fade = Math.min(1, onto * 4);
    const ease = onto * onto * (3 - 2 * onto), g = Math.round(220 - 150 * ease), b = Math.round(170 - 120 * ease);
    ctx.save(); ctx.translate(q.x, q.y + 1); ctx.scale(1, ry / rx); ctx.lineCap = 'round';
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(12,4,6,${0.5 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3.6; ctx.strokeStyle = `rgba(255,${g},${b},${0.95 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, rx, -Math.PI / 2, -Math.PI / 2 + ease * Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx * 1.35);
    glow.addColorStop(0, 'rgba(255,90,60,0)'); glow.addColorStop(0.7, `rgba(255,90,60,${0.18 * ease * fade})`); glow.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, rx * 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  }
  // A hit used to turn the whole cell white for a few frames. Now it is a warm glow that fades
  // as quickly as it came: the same information, without the strobe (art direction, section 3).
  const hot = Math.max(0, Math.min(1, e.flash / 0.15));
  if (hot <= 0) return;
  const c = project(e.x, e.y), r = e.kind === 'kupffer' ? 19 : 12.5, cy = c.y - r * 0.85 - 3;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(c.x, cy, 0, c.x, cy, r * 1.5);
  g.addColorStop(0, `rgba(255,236,220,${0.42 * hot * hot})`); g.addColorStop(1, 'rgba(255,236,220,0)');
  ctx.fillStyle = g; oval(ctx, c.x, cy, r * 1.5, r * 1.2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function enemyBody(ctx: Ctx, e: Enemy, v: View) {
  const c = project(e.x, e.y), kup = e.kind === 'kupffer', flash = false;
  const wind = e.windup >= 0 ? 1 - e.windup / CONFIG.enemies[e.kind].windup : 0;
  const r = (kup ? 19 : 12.5) * (1 + wind * 0.22);
  const cy = c.y - r * 0.85 - 3 + Math.sin(v.time * (kup ? 1.6 : 4) + e.id) * (kup ? 1 : 1.8);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; oval(ctx, c.x, c.y + 1, r * 0.95, r * 0.4); ctx.fill();

  if (e.kind === 'warden') {
    // One of your own build, still on Shepherd's leash: grey hull, amber band, and an amber lamp sweeping ahead of it.
    const f = project(e.face?.x ?? 1, e.face?.y ?? 0), a = Math.atan2(f.y, f.x), hunting = e.mood === 'chase', y = c.y - 15 + Math.sin(v.time * 2.2 + e.id) * 1.6;
    ctx.save(); ctx.translate(c.x, y); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(8, 0, 95, 0);
    beam.addColorStop(0, hunting ? 'rgba(255,120,70,0.34)' : 'rgba(255,190,90,0.2)'); beam.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(95, -30); ctx.lineTo(95, 30); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(1.25 * (1 + wind * 0.15), 1.25 * (1 + wind * 0.15));
    ctx.fillStyle = flash ? '#fff' : '#4a5558'; oval(ctx, -7, -3.4, 4, 1.8); ctx.fill(); oval(ctx, -7, 3.4, 4, 1.8); ctx.fill();
    if (flash) ctx.fillStyle = '#fff';
    else { const body = ctx.createRadialGradient(1, -1.5, 0.5, 0, 0, 10); body.addColorStop(0, '#b4bec2'); body.addColorStop(0.55, '#6c787e'); body.addColorStop(1, '#283238'); ctx.fillStyle = body; }
    oval(ctx, 0, 0, 10, 4.6); ctx.fill();
    ctx.strokeStyle = 'rgba(20,28,32,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : '#e2953c'; ctx.fillRect(-8.5, -4, 2, 8);
    ctx.fillStyle = hunting || wind ? '#ff8a5a' : '#ffc46a'; oval(ctx, 5, 0, 3, 2.2); ctx.fill();
    ctx.restore();
    return;
  }

  if (kup) {
    // A Kupffer cell is star-shaped: long arms feeling along the sinusoid wall.
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + e.id + Math.sin(v.time * 0.9 + k * 2) * 0.25, len = r * (1.45 + 0.25 * Math.sin(v.time * 1.7 + k));
      const ex = c.x + Math.cos(a) * len, ey = cy + Math.sin(a) * len * 0.7 + 4;
      const arm = ctx.createLinearGradient(c.x, cy, ex, ey);
      arm.addColorStop(0, flash ? '#fff' : '#b9813a'); arm.addColorStop(1, flash ? '#fff' : 'rgba(120,70,24,0.55)');
      ctx.strokeStyle = arm; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.4);
      ctx.quadraticCurveTo(c.x + Math.cos(a + 0.35) * len * 0.7, cy + Math.sin(a + 0.35) * len * 0.5, ex, ey); ctx.stroke();
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * 5, ey + Math.sin(a) * 3.5); ctx.stroke();
    }
    const body = ctx.createRadialGradient(c.x - r * 0.35, cy - r * 0.4, 1, c.x, cy, r * 1.1);
    body.addColorStop(0, flash ? '#fff' : '#f3cf8f'); body.addColorStop(0.6, flash ? '#fff' : wind ? '#c2562a' : '#b0752c'); body.addColorStop(1, flash ? '#fff' : '#5e3a12');
    ctx.fillStyle = body; blob(ctx, c.x, cy, r * 0.9, v.time, e.id, 5, 0.09); ctx.fill();
    ctx.strokeStyle = 'rgba(50,25,8,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    if (!flash) {
      // Vacuoles full of whatever it last swallowed.
      const rv = rand(e.id * 13);
      for (let k = 0; k < 7; k++) {
        const a = rv() * 6.3, d = rv() * r * 0.6, vr = 1.6 + rv() * 2.6;
        ctx.fillStyle = 'rgba(255,240,205,0.4)'; oval(ctx, c.x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, vr, vr); ctx.fill();
        ctx.fillStyle = 'rgba(70,35,10,0.6)'; oval(ctx, c.x + Math.cos(a) * d + 0.5, cy + Math.sin(a) * d * 0.9 + 0.5, vr * 0.45, vr * 0.45); ctx.fill();
      }
      ctx.fillStyle = '#3a1d40'; oval(ctx, c.x + 3, cy + 1, 7, 4.6, 0.5); ctx.fill(); // bean-shaped nucleus
      ctx.fillStyle = 'rgba(255,245,220,0.35)'; oval(ctx, c.x - r * 0.35, cy - r * 0.45, r * 0.3, r * 0.16, -0.5); ctx.fill();
    }
  } else if (e.kind === 'tcell') {
    // Killer T cell: small and smooth, nearly all nucleus, bristling with receptors.
    ctx.strokeStyle = flash ? '#fff' : wind ? '#ff9a7a' : '#7fd8d0'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + v.time * 0.7 + e.id, reach = r * (1.22 + wind * 0.25);
      ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.85); ctx.lineTo(c.x + Math.cos(a) * reach, cy + Math.sin(a) * reach * 0.94); ctx.stroke();
    }
    const body = ctx.createRadialGradient(c.x - r * 0.35, cy - r * 0.45, 1, c.x, cy, r * 1.05);
    body.addColorStop(0, flash ? '#fff' : '#e6fbf6'); body.addColorStop(0.7, flash ? '#fff' : wind ? '#e0907a' : '#7ec4c8'); body.addColorStop(1, flash ? '#fff' : '#2f6f84');
    ctx.fillStyle = body; oval(ctx, c.x, cy, r * 0.95, r * 0.9); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,70,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    if (!flash) {
      const core = ctx.createRadialGradient(c.x - 2, cy - 2, 0.5, c.x, cy, r * 0.7);
      core.addColorStop(0, '#5a4aa0'); core.addColorStop(1, '#231a4e');
      ctx.fillStyle = core; oval(ctx, c.x + 0.6, cy + 0.6, r * 0.66, r * 0.62); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; oval(ctx, c.x - r * 0.4, cy - r * 0.5, r * 0.26, r * 0.14, -0.5); ctx.fill();
    }
  } else {
    // Neutrophil: a pale, grainy cell with a nucleus pinched into lobes.
    const body = ctx.createRadialGradient(c.x - r * 0.35, cy - r * 0.45, 1, c.x, cy, r * 1.1);
    body.addColorStop(0, flash ? '#fff' : '#fbeef4'); body.addColorStop(0.65, flash ? '#fff' : wind ? '#d88aa6' : '#d9bfdc'); body.addColorStop(1, flash ? '#fff' : '#8d6fa8');
    ctx.fillStyle = body; blob(ctx, c.x, cy, r, v.time * 1.6, e.id, 4, 0.07 + wind * 0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,95,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    if (!flash) {
      const rg = rand(e.id * 29);
      for (let k = 0; k < 22; k++) {
        const a = rg() * 6.3, d = Math.sqrt(rg()) * r * 0.82;
        ctx.fillStyle = `rgba(${rg() < 0.5 ? '170,90,140' : '120,95,170'},0.45)`; oval(ctx, c.x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.92, 0.9, 0.9); ctx.fill();
      }
      const lobes = [[-4.6, 1.5], [-0.8, -3.6], [4, -0.6], [1.6, 3.6]].slice(0, 3 + (e.id % 2));
      ctx.strokeStyle = '#3e225c'; ctx.lineWidth = 1.6; ctx.beginPath();
      lobes.forEach(([dx, dy], k) => (k ? ctx.lineTo(c.x + dx, cy + dy) : ctx.moveTo(c.x + dx, cy + dy))); ctx.stroke();
      for (const [dx, dy] of lobes) {
        const lobe = ctx.createRadialGradient(c.x + dx - 1, cy + dy - 1, 0.3, c.x + dx, cy + dy, 3.6);
        lobe.addColorStop(0, '#7650a8'); lobe.addColorStop(1, '#2e1848');
        ctx.fillStyle = lobe; oval(ctx, c.x + dx, cy + dy, 3.5, 3.1); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; oval(ctx, c.x - r * 0.38, cy - r * 0.48, r * 0.28, r * 0.15, -0.5); ctx.fill();
    }
  }
  const max = CONFIG.enemies[e.kind].hp;
  if (e.hp < max || v.hoverEnemy === e.id) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(c.x - 15, cy - r - 12, 30, 4);
    ctx.fillStyle = '#e23a30'; ctx.fillRect(c.x - 15, cy - r - 12, 30 * Math.max(0, e.hp / max), 4);
  }
  if (v.hoverEnemy === e.id) { ctx.strokeStyle = 'rgba(255,90,77,0.9)'; ctx.lineWidth = 2; oval(ctx, c.x, c.y + 1, r * 1.2, r * 0.54); ctx.stroke(); }
}

/** A cache is a vesicle of loot; a patch is a pale knot of fibrin. */
/** An antibody: a pale Y, two arms to grab with and a stem for immune cells to grab. */
function antibody(ctx: Ctx, x: number, y: number, turn: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(turn) * 0.7); ctx.scale(1.35, 1.35);
  ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  for (const [w, color] of [[5, 'rgba(20,16,50,0.7)'], [2.4, '#b8c8ff']] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 0); ctx.lineTo(-5.5, -7); ctx.moveTo(0, 0); ctx.lineTo(5.5, -7); ctx.stroke();
  }
  ctx.fillStyle = '#e8eeff'; oval(ctx, -5.5, -7, 1.6, 1.6); ctx.fill(); oval(ctx, 5.5, -7, 1.6, 1.6); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

function pickup(ctx: Ctx, x: number, y: number, kind: 'cache' | 'patch' | 'calm', seen: boolean, time: number) {
  const c = project(x, y), hover = seen ? Math.sin(time * 2.4 + x) * 2 : 0;
  ctx.globalAlpha = seen ? 1 : 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; oval(ctx, c.x, c.y, 8, 4); ctx.fill();
  if (kind === 'cache') {
    if (seen) {
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(c.x, c.y - 12, 0, c.x, c.y - 12, 32);
      glow.addColorStop(0, 'rgba(120,240,225,0.35)'); glow.addColorStop(1, 'rgba(120,240,225,0)');
      ctx.fillStyle = glow; oval(ctx, c.x, c.y - 12, 32, 32); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // A membrane bubble with cargo showing through it.
    const cy = c.y - 14 + hover;
    const body = ctx.createRadialGradient(c.x - 3, cy - 4, 1, c.x, cy, 11);
    body.addColorStop(0, 'rgba(233,255,251,0.95)'); body.addColorStop(0.6, 'rgba(70,190,180,0.7)'); body.addColorStop(1, 'rgba(24,110,108,0.85)');
    ctx.fillStyle = body; oval(ctx, c.x, cy, 10, 10); ctx.fill();
    ctx.fillStyle = 'rgba(12,70,72,0.7)';
    for (let k = 0; k < 4; k++) { const a = time * 0.8 + k * 1.57; oval(ctx, c.x + Math.cos(a) * 4, cy + Math.sin(a) * 3.2 + 1, 1.7, 1.7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(233,255,251,0.75)'; ctx.lineWidth = 1.2; oval(ctx, c.x, cy, 10, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; oval(ctx, c.x - 4, cy - 5, 2.6, 1.5, -0.6); ctx.fill();
  } else if (kind === 'calm') {
    // Interleukin-10: a violet droplet that breathes out slow rings.
    const cy = c.y - 12 + hover;
    if (seen) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const t = (time * 0.45 + k * 0.5) % 1;
        ctx.strokeStyle = `rgba(170,140,255,${0.5 * (1 - t)})`; ctx.lineWidth = 1.5;
        oval(ctx, c.x, c.y, 6 + t * 22, 3 + t * 11); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const body = ctx.createRadialGradient(c.x - 2, cy - 3, 1, c.x, cy, 9);
    body.addColorStop(0, 'rgba(240,232,255,0.95)'); body.addColorStop(0.55, 'rgba(150,120,235,0.8)'); body.addColorStop(1, 'rgba(70,48,150,0.85)');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(c.x, cy - 12); ctx.bezierCurveTo(c.x + 9, cy - 2, c.x + 8, cy + 8, c.x, cy + 8); ctx.bezierCurveTo(c.x - 8, cy + 8, c.x - 9, cy - 2, c.x, cy - 12); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; oval(ctx, c.x - 3, cy - 1, 1.6, 2.6, 0.5); ctx.fill();
  } else {
    // Fibrin: a mesh of pale threads with a clot at the centre.
    const cy = c.y - 9 + hover, rf = rand(Math.floor(x * 31 + y * 17));
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const a = rf() * Math.PI, len = 6 + rf() * 4;
      ctx.strokeStyle = `rgba(226,236,180,${0.55 + rf() * 0.4})`; ctx.lineWidth = 1.2 + rf();
      ctx.beginPath(); ctx.moveTo(c.x - Math.cos(a) * len, cy - Math.sin(a) * len * 0.6);
      ctx.quadraticCurveTo(c.x + (rf() - 0.5) * 5, cy + (rf() - 0.5) * 4, c.x + Math.cos(a) * len, cy + Math.sin(a) * len * 0.6); ctx.stroke();
    }
    ctx.fillStyle = '#7be08a'; oval(ctx, c.x, cy, 3, 2.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; oval(ctx, c.x - 1, cy - 1, 1, 0.8); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** You: a submersible about ten micrometres long, hanging in the blood. */
function hero(ctx: Ctx, s: State, v: View) {
  const p = s.player, c = project(p.x, p.y);
  const f = project(p.face.x, p.face.y), fl = Math.hypot(f.x, f.y) || 1, fx = f.x / fl, fy = f.y / fl;
  const moving = heroMoving, bob = Math.sin(v.time * 2.2) * 1.6, lift = 15 + bob;
  void fx; void fy;
  const a = heroTurn, roll = Math.max(-1, Math.min(1, heroSpin / 6));
  const worn = 1 - Math.max(0, Math.min(1, p.hp / maxHp(s))), st = stage(s);
  if (riding(s)) {
    // Wearing a neutrophil: its pale body all round the ship, lobed nucleus pushed to one side.
    const r = 21 + Math.sin(v.time * 3) * 1, cy = c.y - lift;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; oval(ctx, c.x, c.y, 18, 7.5); ctx.fill();
    const body = ctx.createRadialGradient(c.x - 6, cy - 8, 2, c.x, cy, r * 1.1);
    body.addColorStop(0, 'rgba(251,238,244,0.8)'); body.addColorStop(0.65, 'rgba(217,191,220,0.62)'); body.addColorStop(1, 'rgba(141,111,168,0.7)');
    ctx.fillStyle = body; blob(ctx, c.x, cy, r, v.time * 1.6, 7, 4, 0.08); ctx.fill();
    for (const [dx, dy] of [[-11, -7], [-14, 0], [-10, 7]]) { ctx.fillStyle = 'rgba(62,34,92,0.8)'; oval(ctx, c.x + dx, cy + dy, 4, 3.6); ctx.fill(); }
    ctx.globalAlpha = 0.75;
  } else if (cloaked(s)) ctx.globalAlpha = 0.35;
  if (!riding(s)) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; oval(ctx, c.x, c.y, 13 - bob * 0.5, 5.5 - bob * 0.2); ctx.fill(); }
  if (p.swing > 0) {
    const t = 1 - p.swing / 0.18;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,236,205,${0.85 - t * 0.6})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 13, 40, 22, 0, a - 1.1 + t * 0.5, a - 0.2 + t * 1.3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Worn gunmetal, satin rather than chrome (docs/art-audio-direction.md, section 6). A hit warms the
  // plating for a moment and it cools back down: a fade, not a flash.
  const burn = Math.max(0, Math.min(1, p.hurt / 0.25)), heat = burn * burn;
  const mix = (a: number[], b: number[]) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * heat)).join(',')})`;
  const hull = mix([100, 110, 116], [186, 110, 98]), shade = mix([34, 42, 48], [90, 36, 32]), shine = mix([178, 188, 190], [236, 180, 165]), dark = '#161e24';
  if (s.suppressed > 0 && !riding(s)) {
    // Cortisol in the water around you: a slow amber halo for as long as it lasts.
    ctx.fillStyle = `rgba(255,200,120,${Math.min(1, s.suppressed / 2) * (0.1 + 0.05 * Math.sin(v.time * 1.8))})`;
    oval(ctx, c.x, c.y - lift, 30, 19); ctx.fill();
  }
  ctx.save(); ctx.translate(c.x, c.y - lift); ctx.rotate(a); ctx.scale(1.25, 1.25 * (1 - Math.abs(roll) * 0.22));
  // Engine wash behind the ship while it is under way. ATP upgrades burn longer and whiter.
  if (moving) {
    ctx.globalCompositeOperation = 'lighter';
    const len = (15 + Math.sin(v.time * 31) * 3) * (1 + 0.3 * s.upgrades.atp) * (worn > 0.7 ? 0.6 + 0.3 * Math.sin(v.time * 6) : 1), wash = ctx.createLinearGradient(-12, 0, -12 - len, 0);
    wash.addColorStop(0, 'rgba(140,230,255,0.75)'); wash.addColorStop(1, 'rgba(140,230,255,0)');
    ctx.fillStyle = wash;
    for (const side of [-3.4, 3.4]) { ctx.beginPath(); ctx.moveTo(-11, side - 1.8); ctx.lineTo(-12 - len, side); ctx.lineTo(-11, side + 1.8); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // Twin engine pods and tail fins, darker than the hull and edged where the lamp catches them.
  for (const side of [-1, 1]) {
    const pod = ctx.createLinearGradient(0, side * 1.3, 0, side * 5.5);
    pod.addColorStop(0, hull); pod.addColorStop(1, shade);
    ctx.fillStyle = pod;
    ctx.beginPath(); ctx.roundRect(-13, side * 3.4 - 2.1, 7.5, 4.2, 1.8); ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.moveTo(-6, side * 4.5); ctx.lineTo(-12.5, side * 9); ctx.lineTo(-10.5, side * 4.5); ctx.fill();
    ctx.strokeStyle = 'rgba(220,228,228,0.25)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-12.4, side * 3.4 - side * 2); ctx.lineTo(-6.2, side * 3.4 - side * 2); ctx.stroke();
  }
  ctx.fillStyle = dark; for (const side of [-3.4, 3.4]) { oval(ctx, -13, side, 1.1, 1.7); ctx.fill(); }
  // The pressure hull: a fat teardrop of worn gunmetal, lit from above and warmed underneath by the flesh around it.
  const hullPath = () => { ctx.beginPath(); ctx.moveTo(13, 0); ctx.bezierCurveTo(11, -7, -4, -7.5, -10.5, -3.6); ctx.lineTo(-10.5, 3.6); ctx.bezierCurveTo(-4, 7.5, 11, 7, 13, 0); };
  const skin = ctx.createRadialGradient(2, -2.5, 0.5, 0, 0, 13);
  skin.addColorStop(0, shine); skin.addColorStop(0.5, hull); skin.addColorStop(1, shade);
  ctx.fillStyle = skin; hullPath(); ctx.fill();
  ctx.save(); hullPath(); ctx.clip();
  // Bounce light: the red of the tissue reflected up onto the belly.
  const bounce = ctx.createLinearGradient(0, 2, 0, 7.5);
  bounce.addColorStop(0, 'rgba(190,60,60,0)'); bounce.addColorStop(1, 'rgba(190,60,60,0.35)');
  ctx.fillStyle = bounce; ctx.fillRect(-12, 0, 26, 8);
  // Panel lines and scuffs: this hull has done this before.
  ctx.strokeStyle = 'rgba(16,24,30,0.45)'; ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(-3.5, -6.6); ctx.lineTo(-3.5, 6.6); ctx.moveTo(8.5, -4.8); ctx.quadraticCurveTo(7.6, 0, 8.5, 4.8); ctx.moveTo(-3.5, -2.4); ctx.lineTo(1.5, -2.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(235,240,240,0.12)'; ctx.lineWidth = 0.4;
  for (const [x1, y1, x2, y2] of [[-1, -5.2, 3, -4.6], [5, 3.8, 9, 3], [-7, 1.5, -5, 2.6]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  ctx.restore();
  // A satin highlight along the spine, soft rather than a hard chrome glint.
  ctx.strokeStyle = 'rgba(235,240,238,0.32)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, -3.2); ctx.bezierCurveTo(5, -5.6, -2, -5.8, -7.5, -3.6); ctx.stroke();
  ctx.fillStyle = '#b88a2e'; ctx.fillRect(-8.5, -5, 2, 10); // a band of hazard yellow, faded: every unit of the swarm wears one
  ctx.fillStyle = 'rgba(20,16,10,0.35)'; ctx.fillRect(-8.5, -1.2, 2, 0.8); ctx.fillRect(-8.5, 2.4, 2, 0.6);
  // Cyan running lights on the pod tips: steady, never blinking.
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const run = ctx.createRadialGradient(-12.6, side * 5.2, 0, -12.6, side * 5.2, 3);
    run.addColorStop(0, 'rgba(120,235,255,0.8)'); run.addColorStop(1, 'rgba(120,235,255,0)');
    ctx.fillStyle = run; oval(ctx, -12.6, side * 5.2, 3, 3); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Extra plating shows as a pale shell over the hull, one line per level.
  for (let k = 0; k < s.upgrades.glycocalyx; k++) {
    ctx.strokeStyle = `rgba(215,240,255,${0.55 - k * 0.12})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(13.5 + k, 0); ctx.bezierCurveTo(11 + k, -7.8 - k * 0.9, -3, -8.3 - k * 0.9, -9.5, -4.6 - k * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13.5 + k, 0); ctx.bezierCurveTo(11 + k, 7.8 + k * 0.9, -3, 8.3 + k * 0.9, -9.5, 4.6 + k * 0.7); ctx.stroke();
  }
  // A cloak that is charged and ready runs a faint teal shimmer down the flanks.
  if (s.upgrades.cd47 > 0 && s.cloakCd <= 0 && !cloaked(s)) {
    ctx.strokeStyle = `rgba(120,240,225,${0.25 + 0.2 * Math.sin(v.time * 2.4)})`; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(9, -4.6); ctx.quadraticCurveTo(0, -7.6, -8, -4.4); ctx.moveTo(9, 4.6); ctx.quadraticCurveTo(0, 7.6, -8, 4.4); ctx.stroke();
  }
  // Damage stays on the hull: hairline cracks first, then scorched plating, then a breach venting behind you.
  if (worn > 0.25) {
    ctx.strokeStyle = `rgba(28,18,22,${Math.min(0.85, 0.35 + worn * 0.6)})`; ctx.lineWidth = 0.75; ctx.lineCap = 'round';
    const cracks: number[][] = [[2, -6, 0.5, -3, 2.5, -1.5], [-6, 2, -3.5, 3.5, -4.5, 6], [8, 2.5, 6, 4, 6.8, 5.6], [-1, -1, 1.5, 1.5, 0, 4], [-8, -3, -5.5, -1.5, -6.5, 0.5]];
    for (const [x1, y1, x2, y2, x3, y3] of cracks.slice(0, Math.ceil((worn - 0.25) / 0.75 * cracks.length))) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke(); }
  }
  if (worn > 0.5) {
    ctx.fillStyle = `rgba(35,20,18,${(worn - 0.5) * 0.9})`; oval(ctx, -2, 3, 4.5, 2.6, 0.4); ctx.fill(); oval(ctx, 7, -3, 2.6, 1.6, -0.3); ctx.fill();
  }
  if (worn > 0.65) for (let k = 0; k < 4; k++) {
    const u = (v.time * 0.9 + k * 0.25) % 1;
    ctx.fillStyle = `rgba(200,235,255,${(1 - u) * 0.55})`; oval(ctx, -4 - u * 16, 3 + Math.sin(k * 2.1 + v.time * 2) * 2.5 - u * 3, 0.9 + u * 1.4, 0.9 + u * 1.4); ctx.fill();
  }
  // Stowaways cling on aft.
  for (let k = 0; k < Math.min(4, s.flora); k++) { ctx.fillStyle = k % 2 ? '#9be38a' : '#6cc46a'; oval(ctx, -9.5 + (k % 2) * 2.2, (k < 2 ? -1 : 1) * (5.6 + (k % 2)), 2.1, 0.9, k * 0.9 + Math.sin(v.time * 1.5 + k) * 0.3); ctx.fill(); }
  // The canopy.
  ctx.fillStyle = '#0b141b'; oval(ctx, 4.6, 0, 4.6, 3.6); ctx.fill();
  ctx.strokeStyle = 'rgba(16,24,30,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.fillStyle = 'rgba(120,200,230,0.42)'; oval(ctx, 5.8, -1.3, 2.2, 0.9, -0.15); ctx.fill(); // the lamp's spill caught in the glass
  ctx.fillStyle = 'rgba(200,70,70,0.25)'; oval(ctx, 4.2, 1.8, 2.6, 0.8); ctx.fill(); // and the flesh, reflected underneath
  // The lamp on the nose.
  ctx.globalCompositeOperation = 'lighter';
  const lamp = ctx.createRadialGradient(13, 0, 0, 13, 0, 7);
  // The lamp warms as the unit wakes, and gutters when the hull is nearly gone.
  const glowing = (worn > 0.8 ? 0.6 + 0.3 * Math.sin(v.time * 4.5) : 0.95), tint = st >= 3 ? '255,214,140' : st >= 1 ? '245,236,205' : '215,236,255';
  lamp.addColorStop(0, `rgba(${tint},${glowing})`); lamp.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = lamp; oval(ctx, 13, 0, 7 + st * 0.5, 7 + st * 0.5); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  if (p.channel) {
    const t = p.channel.t / p.channel.total;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y - 48, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p.channel.kind === 'strip' ? '#ff5a4d' : '#ecb42e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y - 48, 9, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The overlay map: only the tissue you have actually seen. */
function automap(ctx: Ctx, s: State, v: View) {
  const u = Math.max(4, Math.min(8, Math.min(v.w, v.h) / 95)), p = s.player;
  const at = (x: number, y: number) => ({ x: v.w / 2 + (x - y - (p.x - p.y)) * u, y: v.h / 2 + (x + y - (p.x + p.y)) * u * 0.5 });
  const dot = (x: number, y: number, r: number, color: string) => { const c = at(x, y); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); };
  // The map is a small-scale drawing laid over the view, so its marks do not sit on the things themselves:
  // dim the world well down while it is open so the two are not read as one picture.
  ctx.fillStyle = 'rgba(10,4,7,0.74)'; ctx.fillRect(0, 0, v.w, v.h);
  for (let y = 0; y < s.size; y++)
    for (let x = 0; x < s.size; x++) {
      const i = idx(s, x, y);
      if ((!s.explored[i] && (s.scan !== 'full' || s.place !== 'liver')) || s.tiles[i] === 'cell') continue;
      const c = at(x + 0.5, y + 0.5);
      const sour = s.acid?.[i] === 2;
      ctx.fillStyle = !s.explored[i] ? 'rgba(232,162,90,0.13)' : sour ? (s.visible[i] ? 'rgba(190,235,70,0.5)' : 'rgba(190,235,70,0.26)') : s.visible[i] ? 'rgba(255,226,190,0.5)' : 'rgba(255,226,190,0.26)';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - u * 0.5); ctx.lineTo(c.x + u, c.y); ctx.lineTo(c.x, c.y + u * 0.5); ctx.lineTo(c.x - u, c.y); ctx.closePath(); ctx.fill();
    }
  if (s.tumor.size) {
    // The pre-op scan: roughly where the nodule is, whether or not you have been there.
    let tx = 0, ty = 0;
    for (const k of s.tumor) { tx += (k % s.size) + 0.5; ty += Math.floor(k / s.size) + 0.5; if (s.explored[k]) { dot((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5, u * 1.05, 'rgba(235,225,255,0.9)'); dot((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5, u * 0.8, '#8a5cf0'); } }
    const c = at(tx / s.tumor.size, ty / s.tumor.size);
    ctx.strokeStyle = 'rgba(160,130,240,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, u * 5, u * 2.5, 0, 0, Math.PI * 2); if (s.scan !== 'none') ctx.stroke(); ctx.setLineDash([]); // a unit Shepherd does not trust is not sent the scan
  }
  for (const [k, g] of s.glucose) if (s.explored[k]) dot((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5, u * 0.7, g > 0 ? '#ecb42e' : 'rgba(236,180,46,0.35)');
  for (const portal of s.portals) if (s.explored[idx(s, portal.x, portal.y)]) dot(portal.x + 0.5, portal.y + 0.5, u * 0.9, '#e23a30');
  for (const item of s.pickups) if (s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) dot(item.x, item.y, u * 0.6, item.kind === 'sibling' || item.kind === 'kin' ? '#96e1ff' : item.kind === 'cortisol' ? '#ffc878' : item.kind === 'cache' ? '#78f0e1' : item.kind === 'calm' ? '#b9a4ff' : '#7be08a');
  for (const k of s.niche) if (s.explored[k]) dot((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5, u * 0.6, '#78c8d7');
  if (s.junction) { for (const ex of s.junction.exits) if (s.explored[idx(s, ex.at.x, ex.at.y)]) dot(ex.at.x + 0.5, ex.at.y + 0.5, u * 1.3, ex.assigned ? '#e8a25a' : `rgb(${ex.tint})`); }
  else if (s.explored[idx(s, s.vein.x, s.vein.y)]) dot(s.vein.x + 0.5, s.vein.y + 0.5, u * 1.3, '#5680ff');
  for (const e of s.enemies) if (s.visible[idx(s, Math.floor(e.x), Math.floor(e.y))]) dot(e.x, e.y, u * 0.6, '#ff5a4d');
  for (const a of s.antibodies) if (s.visible[idx(s, Math.floor(a.x), Math.floor(a.y))]) dot(a.x, a.y, u * 0.35, '#b8c8ff');
  if (s.search && s.alert > 0) {
    const z = s.search;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2, q = at(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.fillStyle = 'rgba(190,60,130,0.12)'; ctx.fill();
    ctx.strokeStyle = 'rgba(214,92,160,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  dot(p.x, p.y, u * 0.8, '#ffffff');
  // What the dots mean.
  const key: [string, string][] = [['#ffffff', 'You'], ['#5680ff', 'Vein out'], ['#ecb42e', 'Glucose'], ['#ff5a4d', 'Immune cell'], ...(s.place === 'liver' ? [['#8a5cf0', 'Tumor cell'], ['#e23a30', 'Portal inflow'], ['#78c8d7', 'Hiding place']] as [string, string][] : []), ...(s.search && s.alert > 0 ? [['#d65ca0', 'Being searched']] as [string, string][] : [])];
  ctx.font = '500 11px ui-monospace, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const kx = 16, ky = v.h - 110 - key.length * 16;
  key.forEach(([color, name], k) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(kx + 4, ky + k * 16, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(240,230,220,0.85)'; ctx.fillText(name, kx + 14, ky + k * 16);
  });
}

/** The nearest red blood cell the player can see, for the info box about them. */
export function nearestBloodCell(s: State): Point | null {
  let best: Point | null = null, bestD = 5;
  for (const b of rbcs) {
    const d = Math.hypot(b.x - s.player.x, b.y - s.player.y);
    if (d < bestD && d > 1.2 && s.visible[idx(s, Math.floor(b.x), Math.floor(b.y))]) { bestD = d; best = { x: b.x, y: b.y }; }
  }
  return best;
}
