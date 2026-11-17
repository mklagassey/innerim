// The flight between two maps: a few seconds of being carried down a vessel. It covers the
// work of building the next map, and it is travel, not a menu. Nothing in it blinks: every
// change is eased, and with reduced motion it holds one still frame.
export type Way = 'artery' | 'vein' | 'portal' | 'airway';
export interface Frame { w: number; h: number; dpr: number; still: boolean; time: number; kick: number }

const LOOK: Record<Way, { deep: string; wall: [number, number, number]; glow: [number, number, number]; cells: [number, number, number]; speed: number }> = {
  artery: { deep: '#0d0205', wall: [150, 28, 30], glow: [255, 130, 100], cells: [214, 52, 44], speed: 1 },
  vein: { deep: '#04030f', wall: [52, 44, 130], glow: [130, 150, 255], cells: [128, 40, 70], speed: 0.6 },
  portal: { deep: '#070509', wall: [86, 52, 96], glow: [200, 150, 190], cells: [150, 46, 62], speed: 0.5 },
  airway: { deep: '#03080c', wall: [70, 110, 130], glow: [200, 235, 255], cells: [190, 215, 230], speed: 0.8 },
};
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

/** Draws the view down the vessel at `t` (0 at the start of the flight, 1 at the end). */
export function travel(ctx: CanvasRenderingContext2D, way: Way, t: number, f: Frame) {
  const L = LOOK[way], w = f.w, h = f.h, cx = w / 2, cy = h / 2, reach = Math.hypot(w, h) * 0.62;
  const ease = t * t * (3 - 2 * t), run = f.still ? 0.3 : f.time * 0.22 * L.speed + ease * 0.9;
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
  ctx.fillStyle = L.deep; ctx.fillRect(0, 0, w, h);
  // The vessel bends ahead: the far end wanders slowly off centre.
  const bx = cx + Math.sin(run * 1.3) * w * 0.08, by = cy + Math.cos(run * 0.9) * h * 0.06;
  // Rings of the wall coming toward you, nearest last. Each is a lumpy band, lit from ahead.
  const rings = 14;
  for (let k = 0; k < rings; k++) {
    const z = ((k / rings + run) % 1 + 1) % 1, near = z * z, r = 26 + near * reach, x = bx + (cx - bx) * near, y = by + (cy - by) * near;
    const light = (1 - near) * 0.55 + 0.12, pulse = 1 + f.kick * 0.035 * (1 - near);
    ctx.strokeStyle = `rgba(${L.wall[0]},${L.wall[1]},${L.wall[2]},${(0.16 + 0.5 * light) * Math.min(1, z * 6) * Math.min(1, (1 - z) * 5)})`;
    ctx.lineWidth = 6 + near * 46;
    ctx.beginPath();
    for (let j = 0; j <= 40; j++) {
      const a = (j / 40) * Math.PI * 2, lump = 1 + 0.05 * Math.sin(a * 3 + k * 1.7) + 0.03 * Math.sin(a * 7 + k);
      const px = x + Math.cos(a) * r * lump * pulse, py = y + Math.sin(a) * r * 0.82 * lump * pulse;
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  }
  // What is ahead: a soft light at the far end, growing as you arrive.
  const far = ctx.createRadialGradient(bx, by, 0, bx, by, 60 + ease * reach * 0.5);
  far.addColorStop(0, `rgba(${L.glow[0]},${L.glow[1]},${L.glow[2]},${0.3 + 0.3 * ease})`); far.addColorStop(1, `rgba(${L.glow[0]},${L.glow[1]},${L.glow[2]},0)`);
  ctx.fillStyle = far; ctx.fillRect(0, 0, w, h);
  // Things carried with you: discs tumbling past, slower than the wall.
  for (let k = 0; k < 26; k++) {
    const z = ((hash(k) + run * (0.5 + hash(k + 40) * 0.5)) % 1 + 1) % 1, near = z * z, a = hash(k + 9) * Math.PI * 2, d = (0.25 + hash(k + 3) * 0.6) * (26 + near * reach);
    const x = bx + (cx - bx) * near + Math.cos(a) * d, y = by + (cy - by) * near + Math.sin(a) * d * 0.82, r = 2 + near * 22;
    ctx.fillStyle = `rgba(${L.cells[0]},${L.cells[1]},${L.cells[2]},${0.75 * Math.min(1, z * 5) * Math.min(1, (1 - z) * 4)})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.45 + 0.4 * Math.abs(Math.sin(run * 3 + k))), a + run, 0, Math.PI * 2); ctx.fill();
  }
  // Dark at the edge of what the lamp reaches.
  const shade = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, reach);
  shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
}
