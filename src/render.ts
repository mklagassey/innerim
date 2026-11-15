// Draws the liver in isometric view, lit only by what the player can see. Tissue you have
// visited but cannot see right now is drawn from memory: dim and drained of colour.
import { CONFIG } from './config';
import { Enemy, Point, State, cloaked, idx, stripTarget, vision } from './game';

export const TW = 64, TH = 32;
const WALL = 24;
type RGB = readonly [number, number, number];
const INK: RGB = [10, 4, 7];
const FLOOR: RGB = [112, 30, 40], CELL_TOP: RGB = [186, 108, 118], CELL_L: RGB = [128, 62, 78], CELL_R: RGB = [92, 42, 60];
const NUCLEUS: RGB = [62, 34, 92], DEAD: RGB = [74, 58, 70], AMBER: RGB = [236, 180, 46];

export interface View { w: number; h: number; zoom: number; time: number; showMap: boolean; hover: Point | null; hoverEnemy: number | null; mark: Point | null }

export const project = (x: number, y: number): Point => ({ x: ((x - y) * TW) / 2, y: ((x + y) * TH) / 2 });

const cache = new Map<string, string>();
/** A colour at a given brightness. Remembered tissue loses most of its colour. */
function tint(c: RGB, light: number, memory = false): string {
  const q = Math.round(light * 16);
  const k = `${c[0]},${c[1]},${c[2]},${q},${memory ? 1 : 0}`;
  let out = cache.get(k);
  if (!out) {
    const l = q / 16, grey = (c[0] + c[1] + c[2]) / 3;
    const ch = (v: number, cold: number) => Math.round(INK[0] + ((memory ? v * 0.35 + grey * 0.65 + cold : v) - INK[0]) * l);
    out = `rgb(${ch(c[0], -6)},${ch(c[1], 0)},${ch(c[2], 10)})`;
    cache.set(k, out);
  }
  return out;
}
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, lift = 0, grow = 0) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - TH / 2 - lift - grow);
  ctx.lineTo(cx + TW / 2 + grow * 2, cy - lift);
  ctx.lineTo(cx, cy + TH / 2 - lift + grow);
  ctx.lineTo(cx - TW / 2 - grow * 2, cy - lift);
  ctx.closePath();
}
function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export function draw(ctx: CanvasRenderingContext2D, s: State, v: View) {
  const p = s.player, R = vision(s);
  ctx.fillStyle = `rgb(${INK[0]},${INK[1]},${INK[2]})`;
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.save();
  const cam = project(p.x, p.y);
  ctx.translate(v.w / 2, v.h / 2);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-cam.x, -cam.y);

  const span = Math.ceil((v.w / v.zoom / TW + v.h / v.zoom / TH)) + 2;
  const px = Math.floor(p.x), py = Math.floor(p.y);
  const light = (x: number, y: number) => {
    const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) / (R + 0.5);
    return Math.max(0.34, 1 - 0.66 * d * d);
  };
  const target = stripTarget(s);
  const things: { depth: number; draw: () => void }[] = [];

  for (let y = Math.max(0, py - span); y <= Math.min(s.size - 1, py + span); y++) {
    for (let x = Math.max(0, px - span); x <= Math.min(s.size - 1, px + span); x++) {
      const i = idx(s, x, y);
      if (!s.explored[i]) continue;
      const c = project(x + 0.5, y + 0.5);
      if (Math.abs(c.x - cam.x) > v.w / v.zoom / 2 + TW || Math.abs(c.y - cam.y) > v.h / v.zoom / 2 + TH * 2) continue;
      const vis = s.visible[i] === 1, l = vis ? light(x, y) : 0.3, t = s.tiles[i];
      if (t === 'cell') {
        const hit = !!target && target.x === x && target.y === y;
        const dying = hit && p.channel?.kind === 'strip' ? p.channel.t / p.channel.total : 0;
        things.push({ depth: x + y + 1, draw: () => cell(ctx, c, x, y, l, !vis, hit, dying) });
        continue;
      }
      // Sinusoid floor: blood plasma, a little uneven from tile to tile.
      ctx.fillStyle = tint(t === 'dead' ? DEAD : FLOOR, l * (0.86 + hash(x, y) * 0.14), !vis);
      diamond(ctx, c.x, c.y, 0, 0.6); ctx.fill();
      if (t === 'dead') {
        ctx.fillStyle = tint(NUCLEUS, l, !vis);
        for (let k = 0; k < 5; k++) { oval(ctx, c.x - 16 + hash(x + k, y) * 32, c.y - 6 + hash(x, y + k) * 12, 2.2, 1.2); ctx.fill(); }
      }
      const g = s.glucose.get(i);
      if (g !== undefined) {
        for (let k = 0; k < CONFIG.energy.patchMax; k++) {
          const gx = c.x - 12 + k * 12, gy = c.y + (k % 2 ? 3 : -3);
          ctx.fillStyle = k < g ? tint(AMBER, vis ? 1 : 0.4, !vis) : tint(AMBER, 0.16, true);
          ctx.beginPath(); ctx.moveTo(gx, gy - 7); ctx.lineTo(gx + 5, gy); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 5, gy); ctx.closePath(); ctx.fill();
        }
        if (vis && g > 0) {
          ctx.globalCompositeOperation = 'lighter';
          const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 34);
          glow.addColorStop(0, `rgba(236,180,46,${0.2 + 0.06 * Math.sin(v.time * 3)})`); glow.addColorStop(1, 'rgba(236,180,46,0)');
          ctx.fillStyle = glow; oval(ctx, c.x, c.y, 34, 17); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  }

  // Vessels: the vein you came for, and the portals the immune system arrives through.
  const vessel = (at: Point, rgb: string, size: number) => {
    if (!s.explored[idx(s, at.x, at.y)]) return;
    const c = project(at.x + 0.5, at.y + 0.5), on = s.visible[idx(s, at.x, at.y)] === 1;
    ctx.globalAlpha = on ? 1 : 0.35;
    for (let k = 0; k < 3; k++) {
      const r = size * (1 - ((v.time * 0.35 + k / 3) % 1));
      ctx.strokeStyle = `rgba(${rgb},${0.25 + 0.5 * (r / size)})`; ctx.lineWidth = 2.5;
      oval(ctx, c.x, c.y, r, r / 2); ctx.stroke();
    }
    ctx.fillStyle = `rgba(${rgb},0.9)`; oval(ctx, c.x, c.y, size * 0.22, size * 0.11); ctx.fill();
    ctx.globalAlpha = 1;
  };
  vessel(s.vein, '86,128,255', 58);
  for (const portal of s.portals) vessel(portal, '226,58,48', 36);

  // Your own light on the floor.
  ctx.globalCompositeOperation = 'lighter';
  const lamp = ctx.createRadialGradient(cam.x, cam.y, 0, cam.x, cam.y, 150);
  lamp.addColorStop(0, 'rgba(255,214,170,0.20)'); lamp.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = lamp; oval(ctx, cam.x, cam.y, 150, 75); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  if (v.hover && s.explored[idx(s, Math.floor(v.hover.x), Math.floor(v.hover.y))] && v.hoverEnemy === null) {
    const c = project(Math.floor(v.hover.x) + 0.5, Math.floor(v.hover.y) + 0.5);
    ctx.strokeStyle = 'rgba(255,236,210,0.35)'; ctx.lineWidth = 1.5; diamond(ctx, c.x, c.y, 0, -3); ctx.stroke();
  }

  for (const e of s.enemies) {
    if (!s.visible[idx(s, Math.floor(e.x), Math.floor(e.y))]) continue;
    things.push({ depth: e.x + e.y, draw: () => enemy(ctx, e, v) });
  }
  for (const item of s.pickups) {
    if (!s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) continue;
    const seen = s.visible[idx(s, Math.floor(item.x), Math.floor(item.y))] === 1;
    things.push({ depth: item.x + item.y - 0.01, draw: () => pickup(ctx, item.x, item.y, item.kind, seen, v.time) });
  }
  things.push({ depth: p.x + p.y, draw: () => hero(ctx, s, v) });
  things.sort((a, b) => a.depth - b.depth);
  for (const t of things) t.draw();

  for (const shot of s.shots) {
    const c = project(shot.x, shot.y), tail = project(shot.x - shot.vx * 0.04, shot.y - shot.vy * 0.04);
    ctx.strokeStyle = 'rgba(190,255,245,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y - 14); ctx.lineTo(c.x, c.y - 14); ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (const f of s.floats) {
    const c = project(f.x, f.y);
    ctx.globalAlpha = 1 - f.age / 0.9;
    ctx.font = '700 15px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, c.x, c.y - 34 - f.age * 34);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Darkness closing in at the edge of what you can see.
  const dark = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.2, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.62);
  dark.addColorStop(0, 'rgba(10,4,7,0)'); dark.addColorStop(1, 'rgba(10,4,7,0.8)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, v.w, v.h);

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
    const top = y - 62 * v.zoom - hop;
    ctx.fillStyle = '#ffd35a';
    ctx.beginPath(); ctx.moveTo(x, top + 22); ctx.lineTo(x - 13, top); ctx.lineTo(x - 5, top); ctx.lineTo(x - 5, top - 18); ctx.lineTo(x + 5, top - 18); ctx.lineTo(x + 5, top); ctx.lineTo(x + 13, top); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  if (v.showMap && !v.mark) automap(ctx, s, v);
}

function cell(ctx: CanvasRenderingContext2D, c: Point, x: number, y: number, l: number, memory: boolean, target: boolean, dying: number) {
  const lift = WALL * (1 - dying * 0.5);
  ctx.fillStyle = tint(CELL_L, l, memory);
  ctx.beginPath(); ctx.moveTo(c.x - TW / 2 - 1, c.y); ctx.lineTo(c.x, c.y + TH / 2 + 0.6); ctx.lineTo(c.x, c.y + TH / 2 - lift); ctx.lineTo(c.x - TW / 2 - 1, c.y - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint(CELL_R, l, memory);
  ctx.beginPath(); ctx.moveTo(c.x + TW / 2 + 1, c.y); ctx.lineTo(c.x, c.y + TH / 2 + 0.6); ctx.lineTo(c.x, c.y + TH / 2 - lift); ctx.lineTo(c.x + TW / 2 + 1, c.y - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint(CELL_TOP, l * (0.9 + hash(x, y) * 0.1), memory);
  diamond(ctx, c.x, c.y, lift, 0.6); ctx.fill();
  ctx.fillStyle = tint(NUCLEUS, l, memory);
  oval(ctx, c.x + (hash(x, y) - 0.5) * 12, c.y - lift + (hash(y, x) - 0.5) * 5, 8, 4.2); ctx.fill();
  if (target) {
    ctx.strokeStyle = dying ? '#ff5a4d' : 'rgba(236,180,46,0.95)'; ctx.lineWidth = 2;
    diamond(ctx, c.x, c.y, lift, -2); ctx.stroke();
  }
}

function enemy(ctx: CanvasRenderingContext2D, e: Enemy, v: View) {
  const c = project(e.x, e.y), kup = e.kind === 'kupffer';
  const bob = Math.sin(v.time * (kup ? 2 : 5) + e.id) * (kup ? 1 : 2);
  const wind = e.windup >= 0 ? 1 - e.windup / CONFIG.enemies[e.kind].windup : 0;
  const r = (kup ? 17 : 11) * (1 + wind * 0.25);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; oval(ctx, c.x, c.y, r * 0.95, r * 0.42); ctx.fill();
  const cy = c.y - r - 2 + bob;
  const body = ctx.createRadialGradient(c.x - r * 0.35, cy - r * 0.4, 1, c.x, cy, r);
  const flash = e.flash > 0;
  if (kup) { body.addColorStop(0, flash ? '#fff' : '#f0bd72'); body.addColorStop(1, flash ? '#fff' : wind ? '#b3401f' : '#8a5a1e'); }
  else { body.addColorStop(0, flash ? '#fff' : '#efe9ff'); body.addColorStop(1, flash ? '#fff' : wind ? '#b0688f' : '#8f7fc0'); }
  ctx.fillStyle = body;
  if (kup) {
    // A macrophage is never round: it reaches out in every direction at once.
    ctx.beginPath();
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2, rr = r * (1 + 0.2 * Math.sin(a * 7 + v.time * 2.2 + e.id));
      ctx.lineTo(c.x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a1f10'; oval(ctx, c.x + 2, cy + 1, 6, 5); ctx.fill();
  } else {
    oval(ctx, c.x, cy, r, r); ctx.fill();
    // The three-lobed nucleus is how you tell a neutrophil on a real slide.
    ctx.fillStyle = '#3e225c';
    for (const [dx, dy] of [[-4, 2], [0, -3.5], [4, 2]]) { oval(ctx, c.x + dx, cy + dy, 3.3, 3.3); ctx.fill(); }
  }
  const max = CONFIG.enemies[e.kind].hp;
  if (e.hp < max || v.hoverEnemy === e.id) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(c.x - 14, cy - r - 9, 28, 4);
    ctx.fillStyle = '#e23a30'; ctx.fillRect(c.x - 14, cy - r - 9, 28 * (e.hp / max), 4);
  }
  if (v.hoverEnemy === e.id) { ctx.strokeStyle = 'rgba(255,90,77,0.9)'; ctx.lineWidth = 2; oval(ctx, c.x, c.y, r * 1.15, r * 0.52); ctx.stroke(); }
}

/** A cache is a vesicle of loot; a patch is a pale knot of fibrin. */
function pickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'cache' | 'patch', seen: boolean, time: number) {
  const c = project(x, y), hover = seen ? Math.sin(time * 2.4 + x) * 2 : 0;
  ctx.globalAlpha = seen ? 1 : 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; oval(ctx, c.x, c.y, 8, 4); ctx.fill();
  if (kind === 'cache') {
    if (seen) {
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(c.x, c.y - 12, 0, c.x, c.y - 12, 30);
      glow.addColorStop(0, 'rgba(120,240,225,0.35)'); glow.addColorStop(1, 'rgba(120,240,225,0)');
      ctx.fillStyle = glow; oval(ctx, c.x, c.y - 12, 30, 30); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    const body = ctx.createRadialGradient(c.x - 3, c.y - 17 + hover, 1, c.x, c.y - 13 + hover, 10);
    body.addColorStop(0, '#e9fffb'); body.addColorStop(1, '#2f9e97');
    ctx.fillStyle = body; oval(ctx, c.x, c.y - 13 + hover, 9, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(233,255,251,0.7)'; ctx.lineWidth = 1.2; oval(ctx, c.x, c.y - 13 + hover, 9, 9); ctx.stroke();
  } else {
    ctx.strokeStyle = '#d9e8a8'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + 0.4;
      ctx.beginPath(); ctx.moveTo(c.x - Math.cos(a) * 7, c.y - 8 + hover - Math.sin(a) * 5); ctx.lineTo(c.x + Math.cos(a) * 7, c.y - 8 + hover + Math.sin(a) * 5); ctx.stroke();
    }
    ctx.fillStyle = '#7be08a'; oval(ctx, c.x, c.y - 8 + hover, 2.6, 2.6); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function hero(ctx: CanvasRenderingContext2D, s: State, v: View) {
  const p = s.player, c = project(p.x, p.y);
  if (cloaked(s)) ctx.globalAlpha = 0.38;
  const f = project(p.face.x, p.face.y), fl = Math.hypot(f.x, f.y) || 1, fx = f.x / fl, fy = f.y / fl;
  const moving = p.path.length > 0, step = moving ? Math.sin(v.time * 16) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; oval(ctx, c.x, c.y, 9, 4.5); ctx.fill();
  if (p.swing > 0) {
    const a = Math.atan2(fy, fx), t = 1 - p.swing / 0.18;
    ctx.strokeStyle = `rgba(255,244,225,${0.9 - t * 0.6})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 10, 34, 19, 0, a - 1.1 + t * 0.5, a - 0.2 + t * 1.3); ctx.stroke();
  }
  const suit = p.hurt > 0 ? '#ff7a6e' : '#dfeee9';
  ctx.strokeStyle = '#2a3b3d'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(c.x - 3, c.y - 8); ctx.lineTo(c.x - 3, c.y - 1 + step); ctx.moveTo(c.x + 3, c.y - 8); ctx.lineTo(c.x + 3, c.y - 1 - step); ctx.stroke();
  ctx.fillStyle = suit; ctx.beginPath(); ctx.roundRect(c.x - 6, c.y - 21, 12, 15, 5); ctx.fill();
  ctx.fillStyle = '#9fb6b1'; ctx.beginPath(); ctx.roundRect(c.x - 4 - fx * 5, c.y - 20 - fy * 2, 8, 10, 3); ctx.fill(); // air pack
  ctx.fillStyle = suit; oval(ctx, c.x, c.y - 26, 6, 6); ctx.fill();
  ctx.fillStyle = '#1c2b33'; oval(ctx, c.x + fx * 2.6, c.y - 26 + fy * 1.6, 3.6, 3.2); ctx.fill(); // visor
  ctx.fillStyle = 'rgba(255,224,170,0.95)'; oval(ctx, c.x + fx * 7, c.y - 17 + fy * 4, 1.8, 1.8); ctx.fill(); // lamp
  if (p.channel) {
    const t = p.channel.t / p.channel.total;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y - 44, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p.channel.kind === 'strip' ? '#ff5a4d' : '#ecb42e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y - 44, 9, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The overlay map: only the tissue you have actually seen. */
function automap(ctx: CanvasRenderingContext2D, s: State, v: View) {
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
  for (const item of s.pickups) if (s.explored[idx(s, Math.floor(item.x), Math.floor(item.y))]) dot(item.x, item.y, u * 0.6, item.kind === 'cache' ? '#78f0e1' : '#7be08a');
  if (s.explored[idx(s, s.vein.x, s.vein.y)]) dot(s.vein.x + 0.5, s.vein.y + 0.5, u * 1.3, '#5680ff');
  for (const e of s.enemies) if (s.visible[idx(s, Math.floor(e.x), Math.floor(e.y))]) dot(e.x, e.y, u * 0.6, '#ff5a4d');
  dot(p.x, p.y, u * 0.8, '#ffffff');
}
