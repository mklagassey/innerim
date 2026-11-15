// Draws the liver in isometric view, lit by the lamp the player carries. Tissue you have
// visited but cannot see right now is drawn from memory: dim and drained of colour.
//
// Tiles are painted once into small off-screen images (with all their texture) and then
// stamped, so the scene can be detailed without redrawing every granule each frame.
import { CONFIG } from './config';
import { Enemy, Point, State, cloaked, idx, open, scentScale, stripTarget, trailLife, vision } from './game';

export const TW = 64, TH = 32;
const INK = '#0a0407';

export interface View {
  w: number; h: number; zoom: number; dpr: number; time: number; showMap: boolean;
  hover: Point | null; hoverEnemy: number | null; mark: Point | null;
  heat: number; // 0 to 1: how wound-up the music is
  kick: number; // 1 at each drum hit, fading to 0
  still: boolean; // the player asked for reduced motion
}

export const project = (x: number, y: number): Point => ({ x: ((x - y) * TW) / 2, y: ((x + y) * TH) / 2 });
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
function paintCell(c: Ctx, variant: number) {
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
  g.addColorStop(0, '#f0b4ba'); g.addColorStop(0.55, '#cf8996'); g.addColorStop(0.9, '#a8627a'); g.addColorStop(1, '#8a4a66');
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
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
  // Nucleus, sometimes two: about a quarter of real hepatocytes are binucleate.
  const two = variant % 4 === 3;
  for (const off of two ? [-7.5, 7.5] : [0]) {
    const nx = ox + off + (r() - 0.5) * (two ? 2 : 9), ny = top + (r() - 0.5) * (two ? 2 : 4.5), nrx = two ? 6 : 8, nry = nrx * 0.56;
    c.fillStyle = 'rgba(60,20,50,0.25)'; oval(c, nx + 1, ny + 1.5, nrx + 1, nry + 1); c.fill();
    g = c.createRadialGradient(nx - nrx * 0.35, ny - nry * 0.5, 0.5, nx, ny, nrx);
    g.addColorStop(0, '#8a66bd'); g.addColorStop(0.7, '#553784'); g.addColorStop(1, '#2f1c50');
    c.fillStyle = g; oval(c, nx, ny, nrx, nry); c.fill();
    c.strokeStyle = 'rgba(25,12,45,0.7)'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = '#1c0f33';
    oval(c, nx + (r() - 0.5) * nrx * 0.7, ny + (r() - 0.5) * nry * 0.6, 1.5, 1); c.fill();
    if (r() < 0.6) { oval(c, nx + (r() - 0.5) * nrx, ny + (r() - 0.5) * nry * 0.8, 1, 0.7); c.fill(); }
  }
  // A wet sheen along the far rim and a soft glint on the crown.
  c.strokeStyle = 'rgba(255,232,228,0.45)'; c.lineWidth = 1.3; c.lineCap = 'round';
  c.beginPath(); lumpy(c, ox, top, rx - 1.5, ry - 1, seed, 0.05, Math.PI * 1.08, Math.PI * 1.7); c.stroke();
  c.fillStyle = 'rgba(255,245,240,0.22)'; oval(c, ox - rx * 0.36, top - ry * 0.42, rx * 0.26, ry * 0.2, -0.35); c.fill();
}

const FLOOR_W = TW * 1.6, FLOOR_H = TH * 1.6 + 6;
/** Sinusoid floor: the thin lining of a blood channel, perforated by clusters of pores. Soft-edged, so tiles melt together. */
function paintFloor(c: Ctx, variant: number, dead: boolean) {
  const r = rand(variant * 17 + (dead ? 91 : 5)), ox = FLOOR_W / 2, oy = FLOOR_H / 2;
  // A feathered pool of colour a little bigger than the tile: neighbours overlap and no seam shows.
  c.save(); c.shadowColor = '#7c2231'; c.shadowBlur = 8 * spriteScale; c.fillStyle = '#7c2231';
  oval(c, ox, oy, TW * 0.55, TH * 0.55); c.fill(); c.fill(); c.restore();
  poly(c, [ox, oy - TH / 2 - 2, ox + TW / 2 + 4, oy, ox, oy + TH / 2 + 2, ox - TW / 2 - 4, oy]);
  c.save(); c.clip();
  // Slow streaks in the plasma.
  for (let i = 0; i < 5; i++) {
    c.strokeStyle = `rgba(${r() < 0.5 ? '255,150,150' : '40,5,12'},${0.04 + r() * 0.05})`; c.lineWidth = 1 + r() * 2.5; c.lineCap = 'round';
    const y = oy - 12 + r() * 24, x = ox - 26 + r() * 18;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 16, y + (r() - 0.5) * 8, x + 26 + r() * 14, y + 5 + r() * 7); c.stroke();
  }
  // Fenestrations: the sieve plates of a liver sinusoid.
  for (let k = 0; k < 3; k++) {
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

// ---------- red blood cells ----------

// Purely for show, so they live here and not in the rules. They drift with the blood,
// which in a liver always means toward the central vein.
interface Rbc extends Point { z: number; spin: number; seed: number }
let heroMoving = false, heroWas: Point = { x: 0, y: 0 };
let rbcs: Rbc[] = [], flow: Int16Array | null = null, flowFor: State | null = null, flowKills = -1, lastTime = 0;

function flowField(s: State): Int16Array {
  if (flow && flowFor === s && flowKills === s.cellsKilled) return flow;
  const N = s.size, d = new Int16Array(N * N).fill(-1), queue = [idx(s, s.vein.x, s.vein.y)];
  d[queue[0]] = 0;
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
let glowFor: Uint8Array | null = null;
let lit = new Float32Array(0), known = new Float32Array(0), reek = new Float32Array(0);
const FADE_IN = 0.45, FADE_OUT = 0.8, FADE_KNOWN = 0.5; // seconds

export function draw(ctx: Ctx, s: State, v: View) {
  const p = s.player, R = vision(s), scale = v.zoom * v.dpr;
  const dt = Math.min(0.05, Math.max(0, v.time - lastTime)); lastTime = v.time;
  driftBlood(s, dt);
  if (dt > 0) { heroMoving = Math.hypot(p.x - heroWas.x, p.y - heroWas.y) > dt * 0.5; heroWas = { x: p.x, y: p.y }; }

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.save();
  const cam = project(p.x, p.y);
  ctx.translate(v.w / 2, v.h / 2);
  // The whole view jumps a hair with each kick once the music is loud.
  const hot = Math.max(0, (v.heat - 0.4) / 0.6), punch = v.still ? 0 : hot * v.kick;
  ctx.scale(v.zoom * (1 + punch * 0.022), v.zoom * (1 + punch * 0.022));
  ctx.translate(-cam.x, -cam.y);

  const span = Math.ceil(v.w / v.zoom / TW + v.h / v.zoom / TH) + 2;
  const px = Math.floor(p.x), py = Math.floor(p.y);
  const target = stripTarget(s);
  const things: { depth: number; draw: () => void }[] = [];
  const seenAt = (q: Point) => s.visible[idx(s, Math.floor(q.x), Math.floor(q.y))] === 1;
  const floors: { x: number; y: number; i: number; c: Point; vis: boolean }[] = [];
  const road = s.place === 'vessel';
  if (glowFor !== s.explored) { glowFor = s.explored; lit = new Float32Array(s.size * s.size); known = new Float32Array(s.size * s.size); reek = new Float32Array(s.size * s.size); }

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
        things.push({ depth: x + y + 1, draw: () => {
          const squash = 1 - dying * 0.4, h = CELL_OY * squash;
          // The remembered look underneath, the lit look faded in over it.
          for (const memory of [true, false]) {
            const a = memory ? (glow > 0.99 ? 0 : seen) : glow;
            if (a < 0.01) continue;
            const img = sprite(`${road ? 'v' : 'c'}${variant}`, CELL_W, CELL_H, scale, memory, (cx) => {
              paintCell(cx, variant);
              if (!road) return;
              // Vessel wall: the same living cells, but soaked in arterial red rather than liver pink.
              cx.globalCompositeOperation = 'source-atop';
              cx.fillStyle = 'rgba(128,18,30,0.55)'; cx.fillRect(0, 0, CELL_W, CELL_H);
              cx.globalCompositeOperation = 'source-over';
            });
            ctx.globalAlpha = a;
            // Squash toward the floor as the cell is torn open.
            if (dying) ctx.drawImage(img, 0, 0, img.width, (CELL_OY / CELL_H) * img.height, c.x - CELL_OX, c.y - h, CELL_W, h);
            else ctx.drawImage(img, c.x - CELL_OX, c.y - CELL_OY, CELL_W, CELL_H);
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
    return sprite(`f${variant}${dead ? 'd' : ''}`, FLOOR_W, FLOOR_H, scale, memory, (cx) => paintFloor(cx, variant, dead));
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
      if (g !== undefined) things.push({ depth: x + y + 0.2, draw: () => {
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
    if (left <= 0) continue; // you always know where you have just walked
    // Left and right feet alternate. The side comes from when the print was made, so it never changes.
    const side = Math.round(f.born * 1000) % 2 ? 1 : -1, c = project(f.x - f.dy * 0.13 * side, f.y + f.dx * 0.13 * side);
    const ahead = project(f.dx, f.dy), turn = Math.atan2(ahead.y, ahead.x);
    ctx.globalAlpha = left * 0.6; // a dark stain that thins out steadily until it is gone
    ctx.fillStyle = '#1a0a10';
    oval(ctx, c.x + Math.cos(turn) * 2.5, c.y + Math.sin(turn) * 2.5, 5.5, 3, turn); ctx.fill(); // sole
    oval(ctx, c.x - Math.cos(turn) * 5.5, c.y - Math.sin(turn) * 5.5, 2.6, 2, turn); ctx.fill(); // heel
  }
  ctx.globalAlpha = 1;

  // Vessels: openings in the floor that the blood pours into or out of.
  const vessel = (at: Point, vein: boolean) => {
    if (!s.explored[idx(s, at.x, at.y)]) return;
    const c = project(at.x + 0.5, at.y + 0.5), size = vein ? 62 : 40, rgb = vein ? '70,110,255' : '235,60,48';
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
  vessel(s.vein, true);
  for (const portal of s.portals) vessel(portal, false);

  // The lamp: a warm pool at your feet and a beam the way you are facing.
  const f = project(p.face.x, p.face.y), fa = Math.atan2(f.y, f.x);
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

  for (const b of rbcs) if (b.x > 0 && seenAt(b)) things.push({ depth: b.x + b.y, draw: () => bloodCell(ctx, b, v.time) });
  for (const e of s.enemies) if (seenAt(e)) things.push({ depth: e.x + e.y, draw: () => enemy(ctx, e, v) });
  for (const item of s.pickups) {
    if (!s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) continue;
    const seen = seenAt(item);
    things.push({ depth: item.x + item.y - 0.01, draw: () => pickup(ctx, item.x, item.y, item.kind, seen, v.time) });
  }
  things.push({ depth: p.x + p.y, draw: () => hero(ctx, s, v) });
  if (s.snare > 0) things.push({ depth: p.x + p.y + 0.01, draw: () => {
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
  things.sort((a, b) => a.depth - b.depth);
  for (const t of things) t.draw();

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
    // Each kick throws a neon ring out across the floor from where you stand.
    const grow = 1 - v.kick, tint = hot < 0.55 ? '255,70,60' : '255,40,170';
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      const r = (0.6 + grow * (R * 0.9) - k * 0.8) * TW * 0.5;
      if (r <= 0) continue;
      ctx.strokeStyle = `rgba(${k ? '90,230,255' : tint},${(k ? 0.35 : 0.6) * hot * v.kick})`;
      ctx.lineWidth = (k ? 2 : 5) * (0.5 + hot);
      oval(ctx, cam.x, cam.y, r, r * 0.5); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
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

  // Darkness closing in at the edge of the screen.
  const dark = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
  dark.addColorStop(0, 'rgba(10,4,7,0)'); dark.addColorStop(1, 'rgba(10,4,7,0.7)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, v.w, v.h);

  if (hot > 0) {
    // The edges of the screen glow and throb with the beat: red first, then hot pink.
    const tint = hot < 0.55 ? '255,40,40' : '255,30,150', a = hot * (0.1 + (v.still ? 0.12 : 0.3 * v.kick));
    ctx.globalCompositeOperation = 'lighter';
    const edge = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.34, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.66);
    edge.addColorStop(0, `rgba(${tint},0)`); edge.addColorStop(1, `rgba(${tint},${a})`);
    ctx.fillStyle = edge; ctx.fillRect(0, 0, v.w, v.h);
    if (hot > 0.55 && !v.still) { // scan lines sweep down at full tilt
      ctx.fillStyle = `rgba(90,230,255,${0.05 * hot * (0.4 + v.kick)})`;
      const gap = 46, off = (v.time * 90) % gap;
      for (let y = off - gap; y < v.h; y += gap) ctx.fillRect(0, y, v.w, 1.5);
    }
    ctx.globalCompositeOperation = 'source-over';
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
  const c = project(e.x, e.y), kup = e.kind === 'kupffer', flash = e.flash > 0;
  const wind = e.windup >= 0 ? 1 - e.windup / CONFIG.enemies[e.kind].windup : 0;
  const r = (kup ? 19 : 12.5) * (1 + wind * 0.22);
  const cy = c.y - r * 0.85 - 3 + Math.sin(v.time * (kup ? 1.6 : 4) + e.id) * (kup ? 1 : 1.8);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; oval(ctx, c.x, c.y + 1, r * 0.95, r * 0.4); ctx.fill();

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

/** You: a person in a pressure suit, about ten micrometres tall. */
function hero(ctx: Ctx, s: State, v: View) {
  const p = s.player, c = project(p.x, p.y);
  const f = project(p.face.x, p.face.y), fl = Math.hypot(f.x, f.y) || 1, fx = f.x / fl, fy = f.y / fl;
  const moving = heroMoving, stride = moving ? Math.sin(v.time * 14) : 0;
  const k = 1.3, away = fy < -0.3; // facing up the screen shows the back
  if (cloaked(s)) ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; oval(ctx, c.x, c.y, 10, 5); ctx.fill();
  if (p.swing > 0) {
    const a = Math.atan2(fy, fx), t = 1 - p.swing / 0.18;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,236,205,${0.85 - t * 0.6})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 13, 40, 22, 0, a - 1.1 + t * 0.5, a - 0.2 + t * 1.3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  const hurt = p.hurt > 0, suit = hurt ? '#ff8a7e' : '#dbe6e2', shade = hurt ? '#b5544b' : '#8ea09c', dark = '#27353a';
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Legs and boots.
  ctx.strokeStyle = shade; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(-2.6, -9); ctx.lineTo(-2.8 - fx * stride * 2.4, -1.5 - Math.abs(stride)); ctx.moveTo(2.6, -9); ctx.lineTo(2.8 + fx * stride * 2.4, -1.5 - Math.abs(-stride) * 0.3); ctx.stroke();
  ctx.fillStyle = dark; oval(ctx, -2.8 - fx * stride * 2.4, -0.8, 2.6, 1.5); ctx.fill(); oval(ctx, 2.8 + fx * stride * 2.4, -0.8, 2.6, 1.5); ctx.fill();
  const pack = () => { ctx.fillStyle = '#6f827f'; ctx.beginPath(); ctx.roundRect(-4.5 - fx * 4.5, -20.5 - fy * 1.5, 9, 11, 3); ctx.fill(); ctx.fillStyle = '#4b5b59'; ctx.fillRect(-2.5 - fx * 4.5, -18.5 - fy * 1.5, 5, 1.6); };
  if (!away) pack();
  // Torso, shaded down one side.
  const torso = ctx.createLinearGradient(-6, 0, 6, 0);
  torso.addColorStop(0, suit); torso.addColorStop(1, shade);
  ctx.fillStyle = torso; ctx.beginPath(); ctx.roundRect(-5.6, -21, 11.2, 13.5, 4.5); ctx.fill();
  ctx.strokeStyle = 'rgba(30,45,50,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-5, -12.5); ctx.lineTo(5, -12.5); ctx.stroke(); // belt
  // Arms, swinging against the legs.
  ctx.strokeStyle = suit; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-5.4, -19); ctx.lineTo(-7 + fx * stride * 2, -12 + stride); ctx.stroke();
  ctx.strokeStyle = shade;
  ctx.beginPath(); ctx.moveTo(5.4, -19); ctx.lineTo(7 + fx * 3, -13 + fy * 2 - stride); ctx.stroke();
  if (away) pack();
  // Helmet: a white shell with a dark glass visor.
  const helm = ctx.createRadialGradient(-2, -29, 0.5, 0, -27, 7);
  helm.addColorStop(0, '#ffffff'); helm.addColorStop(1, hurt ? '#d06a60' : '#aebfbb');
  ctx.fillStyle = helm; oval(ctx, 0, -27, 6.4, 6.4); ctx.fill();
  if (!away) {
    ctx.fillStyle = '#101c24'; oval(ctx, fx * 2.6, -26.6 + fy * 1.4, 4, 3.6); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.55)'; oval(ctx, fx * 2.6 - 1.3, -27.8 + fy * 1.4, 1.5, 0.9, -0.5); ctx.fill();
  }
  // The lamp on the chest.
  ctx.globalCompositeOperation = 'lighter';
  const lamp = ctx.createRadialGradient(fx * 6, -17 + fy * 3, 0, fx * 6, -17 + fy * 3, 6);
  lamp.addColorStop(0, 'rgba(255,236,190,0.95)'); lamp.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = lamp; oval(ctx, fx * 6, -17 + fy * 3, 6, 6); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  if (p.channel) {
    const t = p.channel.t / p.channel.total;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y - 56, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p.channel.kind === 'strip' ? '#ff5a4d' : '#ecb42e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y - 56, 9, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The overlay map: only the tissue you have actually seen. */
function automap(ctx: Ctx, s: State, v: View) {
  const u = Math.max(4, Math.min(8, Math.min(v.w, v.h) / 95)), p = s.player;
  const at = (x: number, y: number) => ({ x: v.w / 2 + (x - y - (p.x - p.y)) * u, y: v.h / 2 + (x + y - (p.x + p.y)) * u * 0.5 });
  const dot = (x: number, y: number, r: number, color: string) => { const c = at(x, y); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); };
  ctx.fillStyle = 'rgba(10,4,7,0.35)'; ctx.fillRect(0, 0, v.w, v.h);
  for (let y = 0; y < s.size; y++)
    for (let x = 0; x < s.size; x++) {
      const i = idx(s, x, y);
      if (!s.explored[i] || s.tiles[i] === 'cell') continue;
      const c = at(x + 0.5, y + 0.5);
      ctx.fillStyle = s.visible[i] ? 'rgba(255,226,190,0.5)' : 'rgba(255,226,190,0.26)';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - u * 0.5); ctx.lineTo(c.x + u, c.y); ctx.lineTo(c.x, c.y + u * 0.5); ctx.lineTo(c.x - u, c.y); ctx.closePath(); ctx.fill();
    }
  for (const [k, g] of s.glucose) if (s.explored[k]) dot((k % s.size) + 0.5, Math.floor(k / s.size) + 0.5, u * 0.7, g > 0 ? '#ecb42e' : 'rgba(236,180,46,0.35)');
  for (const portal of s.portals) if (s.explored[idx(s, portal.x, portal.y)]) dot(portal.x + 0.5, portal.y + 0.5, u * 0.9, '#e23a30');
  for (const item of s.pickups) if (s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) dot(item.x, item.y, u * 0.6, item.kind === 'cache' ? '#78f0e1' : item.kind === 'calm' ? '#b9a4ff' : '#7be08a');
  if (s.explored[idx(s, s.vein.x, s.vein.y)]) dot(s.vein.x + 0.5, s.vein.y + 0.5, u * 1.3, '#5680ff');
  for (const e of s.enemies) if (s.visible[idx(s, Math.floor(e.x), Math.floor(e.y))]) dot(e.x, e.y, u * 0.6, '#ff5a4d');
  dot(p.x, p.y, u * 0.8, '#ffffff');
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
