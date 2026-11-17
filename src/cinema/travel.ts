// The flight between maps: a few seconds carried down a vessel by the current
// (chapters.md, "Travel between organs"). The lead engineer owns the canvas, the timing and
// the label; this draws one frame of the fly-through at progress t (0..1).
//
// A tunnel of wall rings recedes to a vanishing point that wanders as the vessel curves; the
// walls carry the long, flow-aligned endothelial cells of a real vessel lining; red cells and
// platelets stream past faster than the walls. Speed eases in and out. Bend for readability:
// the lumen is lit as if by the unit's lamp from behind the camera, and the depth fog is the
// place's key colour, so the destination is felt before it is seen.
import { clamp, hash, rgba, mixHex, smooth } from './core';

export type Vessel = 'artery' | 'vein' | 'portal' | 'airway';
export interface TravelView { w: number; h: number; dpr: number; still: boolean; time: number; kick?: number; edges?: boolean }

const LOOK: Record<Vessel, { wall: string; deep: string; lit: string; fog: string; cells: boolean; pulse: number; speed: number }> = {
  // arterial blood is bright red and comes in surges
  artery: { wall: '#8a1a1c', deep: '#1a0204', lit: '#ff7a5a', fog: '#ff5a3c', cells: true, pulse: 1, speed: 1 },
  // venous blood is darker; the flow is steady and slower; the walls thinner and bluish
  vein: { wall: '#4a1830', deep: '#0a0410', lit: '#b05a7a', fog: '#4f7dff', cells: true, pulse: 0.2, speed: 0.75 },
  // the portal vein carries blood from the gut, rich with what she ate, to the liver
  portal: { wall: '#5a2a1a', deep: '#120804', lit: '#c88a4a', fog: '#d9a441', cells: true, pulse: 0.15, speed: 0.7 },
  // the airway: pale, ringed with cartilage, air instead of blood
  airway: { wall: '#c88a98', deep: '#2a1418', lit: '#ffd8e0', fog: '#e8b8cc', cells: false, pulse: 0, speed: 0.9 },
};

/** Distance travelled by progress t: eased in and out, so the flight starts and lands gently. */
const travelled = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };

export function travel(ctx: CanvasRenderingContext2D, kind: Vessel, t: number, view: TravelView) {
  const L = LOOK[kind], w = view.w, h = view.h, still = view.still;
  const cx0 = w / 2, cy0 = h / 2, R = Math.hypot(w, h) * 0.62;
  const dist = (still ? 0.5 : travelled(t)) * 26 * L.speed; // in ring spacings
  // her heartbeat, about 72 a minute; one soft swell per beat, never a flash
  const beat = still ? 0 : (view.kick ?? Math.max(0, Math.sin(view.time * Math.PI * 2 * 1.2)) ** 6) * L.pulse;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = L.deep; ctx.fillRect(0, 0, w, h);
  // the vessel bends: the centre of the lumen at depth z
  const bendX = (z: number) => Math.sin(z * 0.11 + dist * 0.11) * w * 0.18 * (1 - 1 / (1 + z * 0.3));
  const bendY = (z: number) => Math.cos(z * 0.08 + dist * 0.09 + 1.3) * h * 0.12 * (1 - 1 / (1 + z * 0.3));
  const N = 34, frac = dist % 1, ring = Math.floor(dist);
  // far to near: each band of wall is the annulus between one ring and the next one further in
  const ringAt = (i: number) => { const z = i + 1 - frac + 0.35; return { z, r: (R / z) * (1 + beat * 0.035 / (1 + z * 0.2)), x: cx0 + bendX(z), y: cy0 + bendY(z) }; };
  for (let i = N; i >= 0; i--) {
    const o = ringAt(i), n = ringAt(i + 1), z = o.z;
    const fog = clamp(1 - Math.exp(-z * 0.085));
    const lightK = clamp(2.4 / (0.5 + z * 0.16)); // the lamp behind us falls off with depth
    const idx = ring + i;
    const band = (idx % 2 === 0 ? 1 : 0.86) * (kind === 'airway' && idx % 3 === 0 ? 1.25 : 1); // cartilage rings in the airway
    const base = mixHex(mixHex(L.wall, L.lit, lightK * 0.42 * band), mixHex(L.deep, L.fog, 0.4), fog * 0.9);
    // shade the band: lighter toward its near edge, so the wall reads as a curved surface
    const g = ctx.createRadialGradient(o.x, o.y, n.r, o.x, o.y, o.r);
    g.addColorStop(0, mixHex(base, '#000', 0.12)); g.addColorStop(1, mixHex(base, L.lit, 0.22 * lightK));
    ctx.fillStyle = g; ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r, o.r * 0.92, 0, 0, Math.PI * 2);
    ctx.ellipse(n.x, n.y, n.r, n.r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill('evenodd');
    // the lining: long cells laid along the flow, faint streaks on the near bands
    if (z < 10 && o.r > 30) {
      ctx.save(); ctx.globalAlpha = 0.22 * (1 - fog); ctx.strokeStyle = mixHex(base, kind === 'airway' ? '#ffffff' : '#ffc0b0', 0.35); ctx.lineWidth = Math.max(1, o.r * 0.008); ctx.lineCap = 'round';
      for (let k = 0; k < 30; k++) {
        const a = (k / 30) * Math.PI * 2 + hash(idx * 7 + k) * 0.2, f2 = 0.15 + hash(idx + k * 3) * 0.7;
        const rr = n.r + (o.r - n.r) * f2, cxx = n.x + (o.x - n.x) * f2, cyy = n.y + (o.y - n.y) * f2;
        ctx.beginPath(); ctx.ellipse(cxx, cyy, rr, rr * 0.92, 0, a, a + 0.06 + hash(k + idx) * 0.05); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // the lumen's glow far ahead: the place's colour, felt before it is seen
  const fz = N * 0.45, fx = cx0 + bendX(fz), fy = cy0 + bendY(fz), fr = R / fz;
  const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 4);
  fg.addColorStop(0, rgba(L.fog, 0.35 + smooth(t) * 0.25)); fg.addColorStop(1, rgba(L.fog, 0));
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
  // what the current carries: red cells (biconcave discs) and platelets, or in the airway, motes of mucus
  const M = kind === 'airway' ? 40 : 90;
  for (let i = 0; i < M; i++) {
    const seed = i * 13.37;
    const lane = hash(seed), ang = hash(seed + 1) * Math.PI * 2, rad = 0.15 + Math.sqrt(hash(seed + 2)) * 0.62;
    // particles move faster than the walls (the centre of the stream is fastest), and loop
    const speed = 1.25 + (1 - rad) * 0.9;
    let z = ((lane * 30 - dist * speed) % 30 + 30) % 30 + 0.4;
    if (z > 28) continue;
    const r = R / z, x = cx0 + bendX(z) + Math.cos(ang) * rad * r * 0.8, y = cy0 + bendY(z) + Math.sin(ang) * rad * r * 0.74;
    const size = (kind === 'airway' ? 0.014 : 0.045) * R / z, fog = clamp(1 - Math.exp(-z * 0.1));
    if (size < 0.5 || x < -size * 2 || x > w + size * 2 || y < -size * 2 || y > h + size * 2) continue;
    const tumble = hash(seed + 3) * Math.PI + (still ? 0 : view.time * (0.4 + hash(seed + 4)));
    ctx.save(); ctx.translate(x, y); ctx.rotate(tumble);
    if (kind === 'airway') {
      ctx.fillStyle = rgba(mixHex('#fff0f0', L.fog, fog), 0.35 * (1 - fog)); ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
    } else if (hash(seed + 5) < 0.12) {
      // a platelet: small, pale, irregular
      ctx.fillStyle = rgba(mixHex('#e8c8a8', L.deep, fog), 0.8); ctx.beginPath(); ctx.ellipse(0, 0, size * 0.35, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // a red cell, seen at an angle: a disc with a paler rim and a darker dimple
      const sq = 0.35 + Math.abs(Math.sin(tumble)) * 0.65;
      const body = mixHex(kind === 'vein' ? '#7a1426' : kind === 'portal' ? '#8a2418' : '#b81c22', L.deep, fog * 0.9);
      const lit = mixHex(body, L.lit, 0.35 * (1 - fog));
      const g = ctx.createRadialGradient(-size * 0.2, -size * 0.2 * sq, 0, 0, 0, size);
      g.addColorStop(0, lit); g.addColorStop(1, body);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, size, size * sq, 0, 0, Math.PI * 2); ctx.fill();
      const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.55); dg.addColorStop(0, rgba(mixHex(body, '#000', 0.35), 0.5)); dg.addColorStop(1, rgba(mixHex(body, '#000', 0.35), 0));
      ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(0, 0, size * 0.55, size * 0.55 * sq, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // vignette and a soft lens fade at the very start and end, so the cut in and out is gentle
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  const edge = still || view.edges === false ? 0 : Math.max(0, 1 - t / 0.12, (t - 0.88) / 0.12);
  if (edge > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(edge).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
