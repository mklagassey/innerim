// More sets: the clinic, the sitting room, the bedroom, the consulting room, the lab, the
// eyepiece, and the inside of the body for the match cuts.
import { Stage, rgba, mixHex, hash, lerp, clamp } from './core';
import { woman, dog, Pose, DogPose, blob, cap } from './rig';
import { glass, paper, floor, patch } from './props';
import { travel } from './travel';

type C = CanvasRenderingContext2D;

// ---------- the clinic (Injection, Repaired) ----------

export interface ClinicKit { her?: Pose | null; nurse?: Pose | null; flicker?: boolean; high?: boolean }
/** A trial clinic: pale walls, fluorescent panels, a phlebotomy chair, an IV pole, a trolley. */
export function clinic(st: Stage, k: ClinicKit) {
  const key = '#d8ecec';
  st.light = { x: 520, y: -40, color: key };
  const t = st.still ? 0 : st.t;
  st.layer(0.8, (c) => {
    // wall, with the cold even light of a ceiling panel falling off toward the floor
    const g = c.createLinearGradient(0, -60, 0, 260); g.addColorStop(0, '#5e6e6c'); g.addColorStop(1, '#2e3a3a');
    c.fillStyle = g; c.fillRect(-300, -100, 1600, 400);
    // a window with the blinds down, daylight through the slats
    c.fillStyle = '#9ab0b0'; c.fillRect(640, 30, 220, 150);
    c.fillStyle = '#3e4a4a'; for (let y = 34; y < 180; y += 9) c.fillRect(640, y, 220, 5);
    c.fillStyle = '#2a3434'; c.fillRect(634, 26, 232, 6); c.fillRect(634, 178, 232, 6);
    // cabinets, a sharps bin (yellow), a hand basin
    c.fillStyle = '#3a4646'; c.fillRect(60, 140, 260, 120); c.fillStyle = '#4a5656'; c.fillRect(56, 132, 268, 10);
    c.strokeStyle = rgba('#000', 0.3); c.lineWidth = 2; for (let x = 60; x <= 320; x += 65) { c.beginPath(); c.moveTo(x, 142); c.lineTo(x, 260); c.stroke(); }
    c.fillStyle = '#c8a828'; c.fillRect(270, 108, 26, 24); c.fillStyle = '#a82828'; c.fillRect(270, 108, 26, 5);
    c.fillStyle = '#7a8a8a'; c.fillRect(120, 70, 70, 50); c.fillStyle = '#5a6a6a'; c.fillRect(126, 76, 58, 38);
    // a poster-shaped rectangle, no words
    c.fillStyle = '#6e7e7c'; c.fillRect(380, 40, 70, 96); c.fillStyle = '#8a9a98'; c.fillRect(388, 50, 54, 30);
  });
  // floor: in the high view it fills most of the frame, like a ceiling camera looking down
  st.layer(0.95, (c) => {
    const g = c.createLinearGradient(0, 260, 0, 460); g.addColorStop(0, '#3a4646'); g.addColorStop(1, '#5a6a68');
    c.fillStyle = g; c.fillRect(-300, 258, 1600, 300);
    c.strokeStyle = rgba('#000', 0.16); c.lineWidth = 1.2;
    for (let i = -20; i <= 20; i++) { c.beginPath(); c.moveTo(500 + i * 40, 258); c.lineTo(500 + i * 120, 520); c.stroke(); }
    for (let y = 270, d = 8; y < 460; y += d, d *= 1.3) { c.beginPath(); c.moveTo(-300, y); c.lineTo(1300, y); c.stroke(); }
  });
  // the ceiling panels' glow; one tube a touch uneven, drifting slowly (well under 1 Hz, never a flicker)
  const hum = k.flicker && !st.still ? 0.04 * Math.sin(t * 2.1) * Math.sin(t * 0.7) : 0;
  st.glow(300, -30, 320, key, 0.22, 0.8);
  st.glow(700, -30, 320, key, 0.2 + hum, 0.8);
  // the trolley and tray, the IV pole
  st.layer(1, (c) => {
    c.fillStyle = '#8a9898'; c.fillRect(560, 238, 90, 6); c.fillStyle = '#5a6868'; c.fillRect(566, 244, 4, 86); c.fillRect(640, 244, 4, 86); c.fillRect(560, 300, 90, 4);
    c.fillStyle = '#b8c8c8'; c.fillRect(574, 232, 30, 6); c.fillStyle = '#d8e8e8'; c.fillRect(612, 224, 8, 14);
    c.strokeStyle = '#7a8888'; c.lineWidth = 3; c.beginPath(); c.moveTo(250, 370); c.lineTo(250, 70); c.moveTo(232, 70); c.lineTo(268, 70); c.stroke();
    c.fillStyle = rgba('#e8f0f0', 0.6); c.beginPath(); c.roundRect(236, 74, 22, 40, 5); c.fill();
    c.fillStyle = '#5a6868'; c.fillRect(234, 366, 32, 4);
  });
  // the chair: a reclining phlebotomy chair with a padded arm rest
  st.layer(1, (c) => {
    c.fillStyle = '#26302f';
    blob(c, [[330, 360], [336, 300], [300, 200], [318, 192], [380, 288], [520, 292], [532, 314], [500, 330], [420, 330], [400, 362]], true, 0.3); c.fill();
    c.fillStyle = '#323e3d'; c.beginPath(); c.roundRect(400, 270, 150, 14, 6); c.fill(); // the arm rest
    c.fillStyle = '#1c2424'; c.fillRect(380, 360, 60, 10); c.fillRect(404, 330, 12, 34);
  });
  if (k.her) { const p = k.her; st.lit(1, (c) => woman(c, p), { body: '#1a2222', rim: 0.6, width: 1.8, fill: 0.5, cool: '#8ab0c0', at: [p.x, p.y - p.s * 0.4, p.s] }); }
  if (k.nurse) { const p = k.nurse; st.lit(1.02, (c) => woman(c, p), { body: '#2a4048', rim: 0.6, width: 1.8, fill: 0.6, cool: '#8ab0c0', at: [p.x, p.y - p.s * 0.5, p.s] }); }
}

// ---------- the sitting room (Evening) ----------

export interface SofaKit { her?: Pose | null; dog?: DogPose | null; glass?: number; tilt?: number; held?: [number, number] | null; empty?: boolean }
/**
 * Night, the television the only light: cool and slowly shifting. She sits side on, facing it
 * (right of frame); the dog lies across her feet; her glass on the arm of the sofa.
 */
export function sofa(st: Stage, k: SofaKit) {
  const t = st.still ? 0 : st.t;
  // the TV's light changes as the picture changes: slow hue and level drift, well under 1 Hz
  const tv = mixHex('#7a9ae8', mixHex('#9ac8d8', '#c8b0e0', 0.5 + 0.5 * Math.sin(t * 0.37)), 0.5 + 0.5 * Math.sin(t * 0.23));
  const lv = 0.85 + 0.15 * Math.sin(t * 0.53) * Math.sin(t * 0.31);
  st.light = { x: 930, y: 190, color: tv };
  st.layer(0.75, (c) => {
    c.fillStyle = '#0c0e18'; c.fillRect(-300, -100, 1600, 600);
    // a framed picture, a lamp that is off, a bookshelf, all just catching the TV light
    c.fillStyle = '#161a28'; c.fillRect(140, 60, 90, 70); c.fillStyle = '#1e2436'; c.fillRect(150, 70, 70, 50);
    c.fillStyle = '#121624'; c.fillRect(20, 40, 90, 260); for (let y = 70; y < 300; y += 46) { c.fillStyle = '#0a0c14'; c.fillRect(20, y, 90, 4); }
    for (let i = 0; i < 18; i++) { c.fillStyle = mixHex('#1a2030', '#2a3048', hash(i)); c.fillRect(24 + (i % 6) * 14, 46 + Math.floor(i / 6) * 46 + hash(i + 2) * 6, 10, 20 - hash(i + 2) * 6); }
    // the TV's glow on the far wall
    const g = c.createRadialGradient(940, 180, 10, 880, 180, 560);
    g.addColorStop(0, rgba(tv, 0.36 * lv)); g.addColorStop(0.5, rgba(tv, 0.08 * lv)); g.addColorStop(1, rgba(tv, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(-300, -100, 1600, 600);
    // the TV faces her, so it lights the wall behind her too: she sits in silhouette against it
    const bw = c.createRadialGradient(420, 170, 20, 420, 190, 330); bw.addColorStop(0, rgba(tv, 0.13 * lv)); bw.addColorStop(1, rgba(tv, 0));
    c.fillStyle = bw; c.fillRect(-300, -100, 1600, 600); c.globalCompositeOperation = 'source-over';
  });
  st.layer(0.92, (c) => {
    floor(c, 330, 430, '#141620', '#080a10', 600);
    // the TV, side on at the right: a thin dark slab with its lit face turned away from us
    c.fillStyle = '#05060a'; c.fillRect(960, 120, 14, 130); c.fillRect(930, 250, 70, 70);
    c.fillStyle = rgba(tv, 0.7 * lv); c.fillRect(956, 122, 4, 126);
    patch(c, [[600, 340], [1000, 330], [1000, 420], [560, 430]], tv, 0.08 * lv);
  });
  st.glow(960, 185, 120, tv, 0.3 * lv, 0.92);
  // the sofa, side on: back, seat, arm
  st.lit(1, (c) => {
    blob(c, [[300, 360], [296, 230], [312, 140], [352, 132], [376, 150], [380, 250], [620, 250], [640, 240], [668, 246], [676, 280], [664, 360]], true, 0.25); c.fill();
  }, { body: '#0e1018', rim: 0.7, width: 2.4, fill: 0.4, at: [480, 260, 380] });
  if (k.dog) { const d = k.dog; st.lit(1.02, (c) => dog(c, d), { body: '#06070a', rim: 0.9, width: 2.2, fill: 0.4, at: [d.x + d.d * 0.6 * d.face, d.y - 30, d.d * 1.4] }); }
  if (k.her) { const p = k.her; st.lit(1, (c) => woman(c, p), { light: { x: 930, y: 190, color: mixHex(tv, '#ffffff', 0.55) }, body: '#05060a', rim: 1, width: 3, fill: 0.3, at: [p.x, p.y - p.s * 0.4, p.s] }); }
  // the glass on the arm of the sofa, or in her hand
  if (!k.empty) {
    const [gx, gy] = k.held ?? [650, 241];
    st.layer(1.01, (c) => glass(c, gx, gy, 30, tv, k.glass ?? 0.6, k.tilt ?? 0));
    if ((k.glass ?? 0.6) > 0) st.glow(gx, gy - 12, 18, '#d89040', 0.12, 1.01);
  }
}

// ---------- the sitting room by day (the echo variants: The nap, Groggy) ----------

export interface NapKit { breath: number; mug?: 'cold' | 'hot' | null; up?: Pose | null; clock?: string; light?: 'afternoon' | 'morning' }
/** The same sofa in daylight: a window at the left, the blind's slats laid across the wall; the TV off. */
export function sofaDay(st: Stage, k: NapKit) {
  const key = k.light === 'morning' ? '#f4e6c8' : '#f2b870', t = st.still ? 0 : st.t;
  st.light = { x: 60, y: 80, color: key };
  st.layer(0.75, (c) => {
    c.fillStyle = '#2e2420'; c.fillRect(-300, -100, 1600, 600);
    // the window and its blind, and the stripes of light it lays on the wall (steady; a blind does not flicker)
    c.fillStyle = mixHex('#2a201c', key, 0.85); c.fillRect(20, 40, 130, 170);
    c.fillStyle = rgba('#2a201c', 0.55); for (let y = 44; y < 210; y += 12) c.fillRect(20, y, 130, 4);
    c.fillStyle = '#1a1412'; c.fillRect(14, 34, 142, 6); c.fillRect(14, 210, 142, 8);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { c.fillStyle = rgba(key, 0.07); c.beginPath(); c.moveTo(300, 60 + i * 22); c.lineTo(760, 90 + i * 26); c.lineTo(760, 102 + i * 26); c.lineTo(300, 68 + i * 22); c.closePath(); c.fill(); }
    const g = c.createRadialGradient(90, 120, 10, 200, 160, 700); g.addColorStop(0, rgba(key, 0.32)); g.addColorStop(1, rgba(key, 0));
    c.fillStyle = g; c.fillRect(-300, -100, 1600, 600); c.globalCompositeOperation = 'source-over';
    // the TV off at the right: a dark slab with a dull reflection of the window
    c.fillStyle = '#0a0a0c'; c.fillRect(960, 120, 14, 130); c.fillRect(930, 250, 70, 70);
    if (k.clock) { c.fillStyle = '#e8e0d0'; c.beginPath(); c.arc(820, 70, 16, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2a2420'; c.lineWidth = 2; c.stroke(); }
  });
  st.layer(0.92, (c) => floor(c, 330, 430, '#4a3628', '#1a120e', 600));
  // a low table with the mug
  st.lit(0.96, (c) => { c.fillRect(700, 300, 160, 10); c.fillRect(712, 310, 8, 56); c.fillRect(840, 310, 8, 56); }, { body: '#1e1612', rim: 0.6, width: 1.6, fill: 0.5, at: [780, 320, 200] });
  if (k.mug) st.layer(0.96, (c) => mugFor(c, 760, 300, k.mug!, key));
  // the sofa, and her asleep along it under a blanket, head on the arm, face to the ceiling
  st.lit(1, (c) => { blob(c, [[300, 360], [296, 230], [312, 140], [352, 132], [376, 150], [380, 250], [620, 250], [640, 240], [668, 246], [676, 280], [664, 360]], true, 0.25); c.fill(); }, { body: '#3a2c26', rim: 0.6, width: 2, fill: 0.7, at: [480, 260, 380] });
  if (!k.up) {
    const b = k.breath;
    st.layer(1, (c) => {
      c.fillStyle = '#120c0a';
      c.save(); c.translate(636, 228); c.rotate(1.55); c.scale(28, 28);
      blob(c, [[-0.16, 0.5], [-0.4, 0.14], [-0.38, -0.25], [-0.12, -0.5], [0.14, -0.5], [0.33, -0.3], [0.37, -0.11], [0.36, -0.02], [0.45, 0.11], [0.37, 0.15], [0.385, 0.22], [0.355, 0.26], [0.37, 0.3], [0.32, 0.36], [0.3, 0.45], [0.12, 0.5]], true, 0.35); c.fill();
      c.restore();
      // the blanket: knitted, warm in the window light along its top, its fringe hanging over the seat
      const top = 232 - b * 4;
      const g = c.createLinearGradient(0, 220, 0, 300); g.addColorStop(0, '#7a4a36'); g.addColorStop(1, '#24120e');
      // over her shape: feet, shins, the knees drawn up a little, hip, then the chest rising with her breath
      c.fillStyle = g; c.beginPath(); c.moveTo(384, 262); c.bezierCurveTo(390, 246, 404, 240, 420, 242); c.bezierCurveTo(446, 244, 462, 226, 480, 226); c.bezierCurveTo(500, 226, 512, 242, 530, 240); c.bezierCurveTo(556, 236, 566, top, 594, top - 2); c.quadraticCurveTo(616, top - 2, 624, 246); c.lineTo(640, 264); c.lineTo(644, 300); c.quadraticCurveTo(510, 308, 378, 300); c.closePath(); c.fill();
      c.strokeStyle = rgba('#000', 0.25); c.lineWidth = 2; for (let x = 396; x < 636; x += 14) { c.beginPath(); c.moveTo(x, 284); c.lineTo(x + 2, 296); c.stroke(); }
      c.strokeStyle = rgba('#ffd0a0', 0.25); c.lineWidth = 1.2; c.beginPath(); c.moveTo(400, 244); c.bezierCurveTo(450, 236, 520, 244, 560, top + 2); c.stroke();
    });
  } else {
    const p = k.up;
    st.lit(1.01, (c) => woman(c, p), { body: '#120c0a', rim: 1, width: 2.2, fill: 0.5, at: [p.x, p.y - p.s * 0.4, p.s] });
  }
  void t;
}
function mugFor(c: C, x: number, y: number, kind: 'cold' | 'hot', key: string) {
  c.save(); c.translate(x, y);
  const g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#d8d0c4'); g.addColorStop(1, '#6a6058');
  c.fillStyle = g; c.beginPath(); c.roundRect(-10, -24, 20, 24, 3); c.fill();
  c.strokeStyle = '#8a8076'; c.lineWidth = 3; c.beginPath(); c.arc(12, -12, 6, -1.2, 1.2); c.stroke();
  // coffee gone cold has a dull skin; hot coffee has a light on it
  c.fillStyle = kind === 'cold' ? '#3a2a1e' : '#4a2e1a'; c.beginPath(); c.ellipse(0, -22, 9, 2.4, 0, 0, Math.PI * 2); c.fill();
  if (kind === 'hot') { c.fillStyle = rgba(key, 0.5); c.fillRect(-5, -23, 6, 1); }
  c.restore();
}

// ---------- the bedroom (The same heart) ----------

export interface BedKit { dogOn?: number; hand?: number; breath: number; close?: boolean }
/** Night. The bed side on, her shape under the duvet, the curtain lit orange by a streetlight. */
export function bedroom(st: Stage, k: BedKit) {
  const t = st.still ? 0 : st.t, key = '#f0a050';
  st.light = { x: 820, y: 60, color: key };
  const sway = st.still ? 0 : Math.sin(t * 0.35) * 0.5 + Math.sin(t * 0.21) * 0.5;
  st.layer(0.8, (c) => {
    c.fillStyle = '#140c10'; c.fillRect(-300, -100, 1600, 600);
    // the window: a deep reveal, a rail, and an unlined curtain the streetlight comes through
    c.fillStyle = '#0a0607'; c.fillRect(686, 6, 228, 252);
    c.fillStyle = '#1e1214'; c.fillRect(694, 14, 212, 236);
    c.save(); c.beginPath(); c.rect(698, 22, 204, 222); c.clip();
    const lightAt = (x: number) => 0.55 + 0.45 * Math.exp(-(((x - 790) / 80) ** 2)); // the lamp is behind and left of centre
    for (let x = 698; x < 902; x += 2) {
      const fold = 0.5 + 0.5 * Math.sin((x - 698) / 15 + sway * 0.6 + Math.sin(x * 0.05) * 0.8);
      const v = lightAt(x) * (0.55 + 0.45 * fold);
      const g = c.createLinearGradient(0, 22, 0, 244);
      g.addColorStop(0, mixHex('#2a1410', key, v * 0.75)); g.addColorStop(0.4, mixHex('#2a1410', '#ffd090', v * 0.85)); g.addColorStop(1, mixHex('#2a1410', key, v * 0.5));
      c.fillStyle = g; c.fillRect(x + sway * (x - 698) / 204 * 3, 22, 2.4, 222);
    }
    // the window's cross bar and the streetlight itself, soft shapes through the cloth
    c.fillStyle = rgba('#1a0a08', 0.35); c.fillRect(698, 128, 204, 6); c.fillRect(796, 22, 6, 222);
    const sl = c.createRadialGradient(760, 70, 0, 760, 70, 60); sl.addColorStop(0, rgba('#fff0c8', 0.55)); sl.addColorStop(1, rgba('#fff0c8', 0)); c.fillStyle = sl; c.fillRect(698, 22, 204, 120);
    c.restore();
    c.fillStyle = '#060304'; c.fillRect(680, 12, 240, 6); // the rail
    // a sliver of cold night at the curtain's edge
    c.fillStyle = rgba('#5a6a9a', 0.5); c.fillRect(899 + sway * 2, 24, 3, 220);
    // the window's light on the wall and the ceiling corner
    const wl = c.createRadialGradient(800, 140, 60, 700, 180, 520); wl.addColorStop(0, rgba(key, 0.22)); wl.addColorStop(1, rgba(key, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = wl; c.fillRect(-300, -100, 1600, 600); c.globalCompositeOperation = 'source-over';
    // a framed photograph over the bed, catching an edge of light
    c.fillStyle = '#0c0708'; c.fillRect(300, 70, 110, 80); c.fillStyle = '#20161a'; c.fillRect(308, 78, 94, 64); c.fillStyle = rgba(key, 0.3); c.fillRect(408, 70, 2, 80);
  });
  st.layer(0.92, (c) => floor(c, 330, 430, '#1e1412', '#0a0606', 500));
  // the nightstand: a clock face-down so its light doesn't keep her up, a glass of water
  st.lit(0.98, (c) => { c.fillRect(40, 262, 80, 108); c.fillRect(36, 256, 88, 8); }, { body: '#120c0c', rim: 0.6, width: 1.6, fill: 0.4, at: [80, 300, 120] });
  st.layer(0.98, (c) => glass(c, 92, 256, 26, key, 0.7, 0));
  const b = k.breath;
  // the bed: an upholstered headboard, the mattress, the duvet hanging over the edge in folds
  st.lit(1, (c) => {
    c.beginPath(); c.roundRect(118, 150, 40, 220, [16, 16, 4, 4]); c.fill();
    c.fillRect(156, 284, 572, 50); c.fillRect(166, 334, 10, 34); c.fillRect(708, 334, 10, 34);
  }, { body: '#140c0c', rim: 0.8, width: 2, fill: 0.5, at: [420, 300, 600] });
  const ch = 238 - b * 4;
  const duvet = (c: CanvasRenderingContext2D) => {
    c.beginPath(); c.moveTo(226, 284);
    c.bezierCurveTo(240, 256, 270, ch + 2, 300, ch); c.bezierCurveTo(330, ch - 2, 380, ch - 3, 420, 248);
    c.bezierCurveTo(470, 240, 520, 246, 560, 252); c.bezierCurveTo(600, 256, 630, 246, 670, 250); c.bezierCurveTo(710, 254, 730, 270, 736, 290);
    // over the edge of the mattress, hanging in soft folds
    c.lineTo(740, 340); for (let x = 740; x > 220; x -= 26) c.quadraticCurveTo(x - 13, 352 + hash(x) * 8, x - 26, 342 + hash(x + 1) * 6);
    c.closePath();
  };
  st.layer(1, (c) => {
    // the pillow, plump, and her head on it in profile, face to the ceiling
    const pg = c.createLinearGradient(0, 246, 0, 290); pg.addColorStop(0, '#5a4038'); pg.addColorStop(1, '#1a1012');
    c.fillStyle = pg; blob(c, [[160, 288], [164, 256], [190, 244], [250, 244], [272, 258], [268, 288]], true, 0.5); c.fill();
    c.fillStyle = '#0c0708';
    c.save(); c.translate(222, 248); c.rotate(-1.45); c.scale(30, 30);
    blob(c, [[-0.16, 0.5], [-0.4, 0.14], [-0.38, -0.25], [-0.12, -0.5], [0.14, -0.5], [0.33, -0.3], [0.37, -0.11], [0.36, -0.02], [0.45, 0.11], [0.37, 0.15], [0.385, 0.22], [0.355, 0.26], [0.37, 0.3], [0.32, 0.36], [0.3, 0.45], [0.12, 0.5]], true, 0.35); c.fill();
    c.restore();
    // the duvet: lit from the window along its top, falling to shadow down its side
    const dg = c.createLinearGradient(0, 230, 0, 360); dg.addColorStop(0, '#3a221c'); dg.addColorStop(0.3, '#1e1212'); dg.addColorStop(1, '#080506');
    c.fillStyle = dg; duvet(c); c.fill();
    c.save(); duvet(c); c.clip();
    // the window light falls warmer toward the foot of the bed
    const wl = c.createRadialGradient(720, 200, 20, 640, 260, 360); wl.addColorStop(0, rgba(key, 0.22)); wl.addColorStop(1, rgba(key, 0)); c.fillStyle = wl; c.fillRect(200, 220, 560, 140);
    // folds: soft shadow grooves running down from the body's shape
    for (let i = 0; i < 7; i++) {
      // irregular: cloth gathers where the body pushes it up, and lies flat between
      const x = 270 + i * 70 + (hash(i) - 0.5) * 50, top = 256 + hash(i + 3) * 26, wv = 10 + hash(i + 5) * 16, sk = (hash(i + 7) - 0.5) * 40;
      c.strokeStyle = rgba('#000', 0.16 + hash(i + 9) * 0.12); c.lineWidth = wv; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, top); c.quadraticCurveTo(x + sk * 0.5, 300, x + sk, 352); c.stroke();
      c.strokeStyle = rgba(key, 0.07); c.lineWidth = wv * 0.4; c.beginPath(); c.moveTo(x + wv * 0.7, top + 4); c.quadraticCurveTo(x + wv * 0.7 + sk * 0.5, 300, x + wv * 0.7 + sk, 352); c.stroke();
    }
    c.restore();
    // a warm rim along the top edge, where the streetlight grazes it
    c.strokeStyle = rgba('#ffb070', 0.45); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(300, ch); c.bezierCurveTo(330, ch - 2, 380, ch - 3, 420, 248); c.bezierCurveTo(470, 240, 520, 246, 560, 252); c.bezierCurveTo(600, 256, 630, 246, 670, 250); c.bezierCurveTo(710, 254, 730, 270, 736, 290); c.stroke();
  });
  // the dog, up on the bed with its head on her chest
  if ((k.dogOn ?? 0) > 0) {
    const on = k.dogOn!;
    st.lit(1.01, (c) => dog(c, { x: lerp(820, 470, on), y: lerp(380, ch_y(b) + 6, on), d: 120, face: -1, pose: on > 0.95 ? 'chin' : 'lie', breath: (b + 0.4) % 1, head: on > 0.95 ? -0.6 : 0.5 }), { body: '#07050a', rim: 1, width: 2, fill: 0.4, at: [lerp(820, 450, on), 250, 220] });
  }
  if ((k.hand ?? 0) > 0) {
    // her hand resting on the dog's back
    st.lit(1.02, (c) => { cap(c, 340, 250 - b * 3, 420, lerp(250, 222, k.hand!) - b * 3, 10, 8); c.beginPath(); c.ellipse(428, lerp(248, 220, k.hand!) - b * 3, 14, 8, -0.2, 0, Math.PI * 2); c.fill(); }, { body: '#07050a', rim: 1, width: 1.6, fill: 0.4, at: [400, 240, 100] });
  }
}
const ch_y = (b: number) => 252 - b * 4;

// ---------- the consulting room (The scan) ----------

export type Liver = 'clean' | 'fatty' | 'tumour' | 'recur';
export interface ConsultKit { her?: Pose | null; doc?: Pose | null; scan: Liver; turn?: number; finger?: number; label?: string }
/** A consulting room: the CT on a monitor, a warm desk lamp, the radiologist, her in the chair. */
export function consult(st: Stage, k: ConsultKit) {
  const lamp = '#f0c080', screen = '#c8dce8';
  st.light = { x: 620, y: 150, color: screen };
  st.layer(0.8, (c) => {
    c.fillStyle = '#141618'; c.fillRect(-300, -100, 1600, 600);
    c.fillStyle = '#1a1c20'; c.fillRect(80, 40, 140, 100); c.fillStyle = '#2a2e34'; for (let i = 0; i < 4; i++) c.fillRect(92 + i * 32, 52, 24, 76); // a light box on the wall, off
    const g = c.createRadialGradient(250, 210, 0, 250, 210, 300); g.addColorStop(0, rgba(lamp, 0.25)); g.addColorStop(1, rgba(lamp, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(-300, -100, 1600, 600);
    const s = c.createRadialGradient(620, 160, 0, 620, 160, 360); s.addColorStop(0, rgba(screen, 0.2)); s.addColorStop(1, rgba(screen, 0));
    c.fillStyle = s; c.fillRect(-300, -100, 1600, 600); c.globalCompositeOperation = 'source-over';
  });
  st.layer(0.92, (c) => floor(c, 320, 430, '#22201c', '#0c0b0a', 500));
  // desk, lamp, monitor
  st.layer(1, (c) => {
    c.fillStyle = '#1c1814'; c.fillRect(200, 240, 560, 14); c.fillRect(214, 254, 10, 110); c.fillRect(736, 254, 10, 110);
    c.fillStyle = '#0c0c0e'; c.fillRect(250, 236, 26, 6); c.strokeStyle = '#0c0c0e'; c.lineWidth = 4; c.beginPath(); c.moveTo(262, 236); c.lineTo(250, 190); c.lineTo(282, 166); c.stroke();
    c.beginPath(); c.moveTo(272, 160); c.lineTo(300, 154); c.lineTo(296, 178); c.closePath(); c.fillStyle = '#0c0c0e'; c.fill();
    c.fillStyle = '#08090a'; c.fillRect(540, 100, 160, 110); c.fillRect(612, 210, 16, 26); c.fillRect(592, 232, 56, 6);
  });
  st.glow(292, 176, 60, lamp, 0.5, 1);
  st.layer(1, (c) => ctSlice(c, 546, 106, 148, 98, k.scan, k.finger ?? -1, st, k.label));
  if (k.doc) { const p = k.doc; st.lit(1, (c) => woman(c, p), { body: '#0a0b0c', rim: 0.8, width: 2, fill: 0.5, at: [p.x, p.y - p.s * 0.4, p.s] }); }
  if (k.her) { const p = k.her; st.lit(1.02, (c) => woman(c, p), { body: '#08090a', rim: 0.9, width: 2, fill: 0.5, light: { x: 292, y: 176, color: lamp }, at: [p.x, p.y - p.s * 0.4, p.s] }); }
}

/**
 * An axial CT slice through the upper abdomen as a radiologist sees it: the body's oval, the
 * liver large on the image's left (her right), the spine at the bottom centre, aorta in front of it,
 * the stomach on the right. Real anatomy; the lesion is a low-density ring with a bright rim, as
 * an enhancing tumour looks. `fatty`: the liver darker than the spleen (steatosis) with a lumpy edge.
 */
export function ctSlice(c: C, x: number, y: number, w: number, h: number, liver: Liver, finger: number, st: Stage, label?: string) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#020304'; c.fillRect(0, 0, w, h);
  c.save(); c.translate(w * 0.5, h * 0.54); c.scale(w / 160, h / 110);
  const g = (v: number) => `rgb(${v},${v},${v + 2})`;
  // skin and subcutaneous fat
  c.fillStyle = g(70); c.beginPath(); c.ellipse(0, 0, 66, 44, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = g(118); c.beginPath(); c.ellipse(0, 0, 62, 40, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = g(60); c.beginPath(); c.ellipse(0, 1, 58, 37, 0, 0, Math.PI * 2); c.fill();
  // the liver: big, on the image's left
  const lv = liver === 'fatty' ? 92 : 138;
  c.fillStyle = g(lv);
  blob(c, [[-54, -10], [-44, -30], [-20, -33], [4, -28], [10, -16], [-4, -6], [-10, 12], [-24, 26], [-46, 22], [-56, 6]], true, liver === 'fatty' ? 0.25 : 0.45); c.fill();
  if (liver === 'fatty') { c.fillStyle = g(80); for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-50 + hash(i) * 8, -18 + i * 7, 2.2, 0, Math.PI * 2); c.fill(); } }
  // spleen and stomach on the image's right
  c.fillStyle = g(132); blob(c, [[40, -18], [54, -8], [52, 12], [42, 6]], true, 0.5); c.fill();
  c.fillStyle = g(40); blob(c, [[14, -26], [36, -24], [38, -6], [22, 2], [12, -10]], true, 0.5); c.fill();
  c.fillStyle = g(150); c.beginPath(); c.ellipse(24, -4, 10, 4, 0, 0, Math.PI * 2); c.fill();
  // spine, aorta, kidneys
  c.fillStyle = g(230); c.beginPath(); c.ellipse(0, 22, 8, 7, 0, 0, Math.PI * 2); c.fill(); c.fillRect(-2, 28, 4, 8);
  c.fillStyle = g(60); c.beginPath(); c.ellipse(0, 22, 4, 3.4, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = g(200); c.beginPath(); c.arc(4, 10, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = g(160); c.beginPath(); c.ellipse(-22, 22, 7, 5, 0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(24, 22, 7, 5, -0.4, 0, Math.PI * 2); c.fill();
  // the lesion, or where it was
  if (liver === 'tumour' || liver === 'recur') {
    const r = liver === 'tumour' ? 7 : 2.2;
    c.fillStyle = g(liver === 'tumour' ? 96 : 200); c.beginPath(); c.arc(-30, -8, r, 0, Math.PI * 2); c.fill();
    if (liver === 'tumour') { c.strokeStyle = g(180); c.lineWidth = 1.4; c.beginPath(); c.arc(-30, -8, r, 0, Math.PI * 2); c.stroke(); }
  } else {
    // healed: a faint scar line where it was cut out
    c.strokeStyle = g(lv - 14); c.lineWidth = 1; c.beginPath(); c.moveTo(-34, -10); c.lineTo(-27, -6); c.stroke();
  }
  c.restore();
  // window chrome: the patient label in the corner, the scale bar, the slice number
  c.fillStyle = '#9ab0c0'; c.font = `500 ${h * 0.07}px "IBM Plex Mono", monospace`; c.textBaseline = 'top';
  c.fillText(label ?? 'TITHONUS 0001', w * 0.04, h * 0.04);
  c.fillText('AX 2.5mm  SE4', w * 0.04, h * 0.88);
  c.fillRect(w * 0.82, h * 0.9, w * 0.12, 1);
  c.restore();
  // the radiologist's cursor: it circles where the lesion is (or was), drawing a measurement ring
  if (finger >= 0) {
    const sx = w / 160, sy = h / 110, lx = x + w * 0.5 - 30 * sx, ly = y + h * 0.54 - 8 * sy;
    const k = clamp(finger * 1.4), a0 = -Math.PI / 2, a1 = a0 + k * Math.PI * 2, rr = 11 * sx;
    c.save();
    c.strokeStyle = rgba('#f0d070', 0.9); c.lineWidth = Math.max(1, w * 0.006); c.setLineDash([w * 0.02, w * 0.012]);
    c.beginPath(); c.ellipse(lx, ly, rr, rr * (sy / sx), 0, a0, a1); c.stroke(); c.setLineDash([]);
    const cx = lx + Math.cos(a1) * rr, cy = ly + Math.sin(a1) * rr * (sy / sx), s = w * 0.05;
    // a plain white arrow pointer, with a dark edge so it reads on grey tissue
    c.fillStyle = '#ffffff'; c.strokeStyle = '#000'; c.lineWidth = Math.max(0.6, w * 0.004);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + s); c.lineTo(cx + s * 0.28, cy + s * 0.74); c.lineTo(cx + s * 0.48, cy + s * 1.1); c.lineTo(cx + s * 0.6, cy + s * 1.04); c.lineTo(cx + s * 0.42, cy + s * 0.68); c.lineTo(cx + s * 0.74, cy + s * 0.68); c.closePath(); c.fill(); c.stroke();
    if (k >= 1) {
      c.fillStyle = rgba('#f0d070', clamp((finger * 1.4 - 1) * 3)); c.font = `500 ${h * 0.065}px "IBM Plex Mono", monospace`; c.textBaseline = 'middle';
      c.fillText(liver === 'tumour' ? '31 mm' : liver === 'recur' ? '6 mm' : '', lx + rr + w * 0.02, ly - rr);
    }
    c.restore();
  }
  void st;
}

// ---------- the lab (The slide, A stranger's slide, Artifact) ----------

export interface LabKit { her?: Pose | null; lampOn?: number; tubes?: boolean; phone?: boolean }
/** The hospital lab at night: one lamp over a bench, the microscope, racks of tubes. */
export function lab(st: Stage, k: LabKit) {
  const lamp = '#f2c890', on = k.lampOn ?? 1;
  st.light = { x: 520, y: 70, color: lamp };
  st.layer(0.8, (c) => {
    c.fillStyle = '#0a0c10'; c.fillRect(-300, -100, 1600, 600);
    // shelves of reagents, a centrifuge, the dark window onto the corridor
    c.fillStyle = '#10141a'; c.fillRect(60, 30, 300, 8); c.fillRect(60, 90, 300, 8);
    for (let i = 0; i < 16; i++) { c.fillStyle = mixHex('#1a2028', '#2a3440', hash(i)); c.fillRect(66 + i * 18, 38 - hash(i + 4) * 0 + 14 - hash(i) * 10, 12, 38 - 14 + hash(i) * 10); }
    c.fillStyle = '#141a22'; c.fillRect(760, 40, 160, 120); c.fillStyle = '#0a0d12'; c.fillRect(766, 46, 148, 108);
    c.fillStyle = rgba('#7aa0c0', 0.15); c.fillRect(800, 60, 30, 80);
    const g = c.createRadialGradient(520, 140, 0, 520, 160, 420); g.addColorStop(0, rgba(lamp, 0.32 * on)); g.addColorStop(1, rgba(lamp, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(-300, -100, 1600, 600); c.globalCompositeOperation = 'source-over';
  });
  st.layer(0.92, (c) => floor(c, 340, 430, '#14161a', '#08090b', 500));
  // the bench, the microscope, the tube rack, the lamp on its arm
  st.layer(1, (c) => {
    c.fillStyle = '#1a1c20'; c.fillRect(160, 230, 700, 12); c.fillStyle = '#0e1014'; c.fillRect(170, 242, 680, 120);
    // the lamp
    c.strokeStyle = '#0a0b0d'; c.lineWidth = 5; c.beginPath(); c.moveTo(640, 230); c.lineTo(620, 120); c.lineTo(540, 62); c.stroke();
    c.fillStyle = '#0a0b0d'; c.beginPath(); c.moveTo(510, 56); c.lineTo(560, 50); c.lineTo(552, 76); c.lineTo(518, 80); c.closePath(); c.fill();
    // the microscope: base, arm, stage, objectives, the eyepieces angled up toward her
    c.fillStyle = '#121418';
    c.beginPath(); c.roundRect(470, 214, 90, 16, 3); c.fill();
    blob(c, [[540, 214], [552, 150], [540, 112], [520, 104], [512, 122], [528, 150], [522, 214]], true, 0.3); c.fill();
    c.fillRect(468, 176, 70, 8); c.fillRect(492, 150, 12, 26);
    c.save(); c.translate(512, 108); c.rotate(-0.75); c.fillRect(-6, -40, 12, 40); c.fillRect(-9, -46, 18, 8); c.restore();
    c.fillStyle = rgba(lamp, 0.25 * on); c.fillRect(496, 174, 10, 3);
    if (k.tubes !== false) for (let i = 0; i < 9; i++) {
      c.fillStyle = '#16181c'; c.fillRect(650, 212, 100, 18);
      c.fillStyle = mixHex('#5a0a12', '#2a0408', hash(i)); c.fillRect(656 + i * 10, 176 + hash(i) * 4, 6, 36);
      c.fillStyle = ['#7a2a8a', '#2a5a9a', '#c8a020'][i % 3]; c.fillRect(656 + i * 10, 172 + hash(i) * 4, 6, 6);
    }
    if (k.phone) { c.fillStyle = '#050608'; c.beginPath(); c.roundRect(330, 222, 40, 10, 2); c.fill(); }
  });
  st.glow(534, 72, 46, lamp, 0.7 * on, 1);
  if (k.her) { const p = k.her; st.lit(1, (c) => woman(c, p), { body: '#060708', rim: 1, width: 2.2, fill: 0.4, at: [p.x, p.y - p.s * 0.4, p.s] }); }
}

/**
 * Down the eyepiece: a stained blood smear in a bright circle. Red cells as a microscopist sees
 * them (pink discs, paler centres), and the units: tiny dark specks, each with a glint of the
 * running light the player knows. `line` units are evenly spaced, which nothing in a smear ever is.
 */
export function eyepiece(st: Stage, o: { line: number; odd?: boolean; drift?: number }) {
  st.layer(1, (c) => {
    c.fillStyle = '#000'; c.fillRect(-300, -100, 1600, 600);
    const cx = 500, cy = 210, R = 190;
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    const bg = c.createRadialGradient(cx - 30, cy - 30, 0, cx, cy, R);
    bg.addColorStop(0, '#fbf2ee'); bg.addColorStop(0.7, '#efdcd6'); bg.addColorStop(1, '#c8aea8');
    c.fillStyle = bg; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    const dr = (o.drift ?? 0) * 6;
    for (let i = 0; i < 150; i++) {
      const a = hash(i * 1.7) * Math.PI * 2, r = Math.sqrt(hash(i * 2.3)) * R * 1.05, x = cx + Math.cos(a) * r + dr, y = cy + Math.sin(a) * r;
      const s = 10 + hash(i * 5.1) * 3, sq = 0.85 + hash(i) * 0.15;
      c.fillStyle = mixHex('#e07a8a', '#c85a6e', hash(i * 3.3)); c.beginPath(); c.ellipse(x, y, s, s * sq, hash(i) * 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = rgba('#f8e4e4', 0.75); c.beginPath(); c.ellipse(x, y, s * 0.4, s * 0.4 * sq, 0, 0, Math.PI * 2); c.fill();
    }
    // a white cell, purple-stained nucleus, as there always is one somewhere
    c.fillStyle = '#d8c0d8'; c.beginPath(); c.arc(cx - 110 + dr, cy + 70, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6a3a8a'; for (const [dx, dy] of [[-5, -3], [4, -4], [0, 5]]) { c.beginPath(); c.arc(cx - 110 + dr + dx, cy + 70 + dy, 5, 0, Math.PI * 2); c.fill(); }
    // the units: in a line, evenly spaced, crossing the field; or one odd speck
    const n = Math.max(1, o.line);
    for (let i = 0; i < n; i++) {
      const x = o.odd ? cx + 40 + dr : cx - (n - 1) * 14 + i * 28 + dr, y = o.odd ? cy - 30 : cy + 4 + (n > 1 ? -i * 3 : 0);
      c.fillStyle = '#2a2e32'; c.beginPath(); c.ellipse(x, y, 3.2, 2.2, -0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = rgba('#7fe8ff', 0.85); c.beginPath(); c.arc(x + 1.4, y - 0.6, 0.9, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // the edge of the field: a soft dark ring, and the black beyond
    const v = c.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = v; c.beginPath(); c.arc(cx, cy, R + 1, 0, Math.PI * 2); c.fill();
  });
}

// ---------- inside the body, for the match cuts ----------

export type Inside = 'swarm' | 'artery' | 'liver' | 'liver-amber' | 'liver-scan' | 'unit' | 'lungs' | 'vein-clear' | 'knot';
/**
 * The body from inside, in the game's own look (dark, wet, lamp-lit), so a match cut lands on
 * something the player knows. Side-on views of a vessel or tissue, flow left to right.
 */
export function inside(st: Stage, kind: Inside, o: { count?: number; pour?: number } = {}) {
  const t = st.still ? 0 : st.t;
  const beat = st.still ? 0 : Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.15)), 5);
  const pal = {
    swarm: ['#1a0306', '#5a0a12', '#ff6a50'], artery: ['#1a0204', '#6a0e14', '#ff5a3c'], liver: ['#1a0e04', '#5a3410', '#d9a441'],
    'liver-amber': ['#1c0e02', '#6a3c08', '#e8a830'], 'liver-scan': ['#1a0e04', '#5a3410', '#d9a441'], unit: ['#120206', '#4a0a12', '#ff6a50'],
    lungs: ['#1a0c10', '#6a3444', '#e8b8cc'], 'vein-clear': ['#06040e', '#2a1a40', '#4f7dff'], knot: ['#1a0e04', '#5a3410', '#d9a441'],
  }[kind];
  st.light = { x: 300, y: 200, color: pal[2] };
  st.layer(0.6, (c) => {
    const g = c.createRadialGradient(420, 210, 0, 420, 210, 620); g.addColorStop(0, pal[1]); g.addColorStop(1, pal[0]);
    c.fillStyle = g; c.fillRect(-300, -100, 1600, 600);
  }, 2);
  if (kind === 'artery' || kind === 'vein-clear') {
    // looking down the vessel, as the game's own flights do: the same renderer, so the cut lands on something known
    travel(st.ctx, kind === 'artery' ? 'artery' : 'vein', 0.25 + (st.still ? 0.25 : st.p * 0.5), { w: st.w, h: st.h, dpr: 1, still: st.still, time: t, edges: false });
    return;
  }
  if (kind === 'liver' || kind === 'liver-amber' || kind === 'liver-scan' || kind === 'knot') {
    // A liver lobule seen in the unit's lamp: plates of hepatocytes, one cell thick, radiating from a
    // central vein; sinusoids of blood between the plates, flowing inward to it. Cells are irregular
    // polygons, many with two nuclei (as hepatocytes often have). 'liver-amber' is a fatty liver:
    // clear lipid droplets inside the cells push the nucleus aside (steatosis).
    const cvx = 250, cvy = 190, fat = kind === 'liver-amber';
    const lamp = (x: number, y: number) => clamp(1.15 - Math.hypot(x - 520, y - 210) / 560);
    st.layer(0.85, (c) => {
      c.fillStyle = '#1a0606'; c.fillRect(-300, -100, 1600, 600);
      // the central vein: a dark open mouth the sinusoids drain into
      const cv = c.createRadialGradient(cvx, cvy, 0, cvx, cvy, 46); cv.addColorStop(0, '#050102'); cv.addColorStop(0.7, '#1a0406'); cv.addColorStop(1, '#4a1410');
      c.fillStyle = cv; c.beginPath(); c.ellipse(cvx, cvy, 46, 40, 0.3, 0, Math.PI * 2); c.fill();
      // sinusoids: blood-dark channels with red cells sliding inward
      const plates = 26;
      for (let pI = 0; pI < plates; pI++) {
        const a = (pI / plates) * Math.PI * 2 + (hash(pI) - 0.5) * 0.12 + Math.PI / plates;
        c.strokeStyle = '#3a0a0c'; c.lineWidth = 10; c.lineCap = 'round';
        c.beginPath(); c.moveTo(cvx + Math.cos(a) * 44, cvy + Math.sin(a) * 40);
        for (let r = 60; r < 1200; r += 40) c.lineTo(cvx + Math.cos(a + Math.sin(r * 0.006 + pI) * 0.05) * r, cvy + Math.sin(a + Math.sin(r * 0.006 + pI) * 0.05) * r);
        c.stroke();
        for (let j = 0; j < 7; j++) {
          const r = ((hash(pI * 7 + j) * 1100 - (st.still ? 0 : t * (fat ? 9 : 22))) % 1100 + 1100) % 1100 + 50;
          const x = cvx + Math.cos(a) * r, y = cvy + Math.sin(a) * r, s = 5.5;
          c.fillStyle = mixHex('#a01820', '#2a0406', 1 - lamp(x, y)); c.beginPath(); c.ellipse(x, y, s, s * 0.6, a, 0, Math.PI * 2); c.fill();
        }
      }
      // the plates: cells laid along each radius between sinusoids. Plates branch as they go out
      // (more of them at each ring), so cells stay about the same size and touch their neighbours.
      const rings = [{ n: 20, r0: 50, r1: 210 }, { n: 40, r0: 210, r1: 430 }, { n: 80, r0: 430, r1: 1250 }];
      rings.forEach((ring, ri) => {
        const step = (Math.PI * 2) / ring.n;
        for (let pI = 0; pI < ring.n; pI++) {
          const a0 = pI * step + (ri % 2 ? step / 2 : 0) + Math.sin(pI * 1.7 + ri) * step * 0.08;
          for (let r = ring.r0, j = 0; r < ring.r1; j++) {
            const span = r * step;
            const cs = Math.max(16, Math.min(40, span * 0.95)) * (0.85 + hash(pI * 31 + j + ri * 7) * 0.3);
            const rr = r + cs / 2, aw = step * 0.44;
            const wob = Math.sin(rr * 0.02 + pI) * step * 0.1;
            const x = cvx + Math.cos(a0 + wob) * rr, y = cvy + Math.sin(a0 + wob) * rr;
            r += cs * 0.96;
            if (x < -120 || x > 1120 || y < -80 || y > 500) continue;
            const L = lamp(x, y), base = fat ? '#c8904a' : '#a86a34';
            c.fillStyle = mixHex('#1e0c06', mixHex(base, '#f0c070', L * 0.25), 0.15 + L * 0.7);
            const hex: [number, number][] = [[0.05, -0.5], [-1, -0.26], [-1, 0.26], [-0.05, 0.5], [1, 0.26], [1, -0.26]];
            c.beginPath();
            hex.forEach(([u, v], k) => {
              const ang = a0 + wob + u * aw * (0.88 + hash(pI * 11 + j * 3 + k + ri) * 0.18), rad = rr + v * cs + (hash(pI + j * 3 + k + ri * 5) - 0.5) * 5;
              const px = cvx + Math.cos(ang) * rad, py = cvy + Math.sin(ang) * rad;
              k ? c.lineTo(px, py) : c.moveTo(px, py);
            });
            c.closePath(); c.fill();
            c.strokeStyle = rgba('#2a0a06', 0.5); c.lineWidth = 1.2; c.stroke();
            const sz = Math.min(cs, span * 0.8);
            if (fat && hash(pI * 3 + j + ri) < 0.65) {
              // a lipid droplet: clear, with a highlight; the nucleus squeezed to the edge
              c.fillStyle = rgba('#fff4dc', 0.3 + L * 0.35); c.beginPath(); c.arc(x, y, sz * 0.3, 0, Math.PI * 2); c.fill();
              c.fillStyle = rgba('#ffffff', 0.45 * L); c.beginPath(); c.arc(x - sz * 0.1, y - sz * 0.1, sz * 0.07, 0, Math.PI * 2); c.fill();
              c.fillStyle = rgba('#2a1206', 0.7); c.beginPath(); c.ellipse(x + Math.cos(a0) * sz * 0.38, y + Math.sin(a0) * sz * 0.38, sz * 0.07, sz * 0.11, a0, 0, Math.PI * 2); c.fill();
            } else {
              // some hepatocytes have two nuclei; kept close, unequal and skewed so a pair never reads as eyes
              const two = hash(pI * 5 + j + ri) < 0.12, sk = (hash(pI + j * 7) - 0.5) * 1.6;
              c.fillStyle = rgba('#3a1606', 0.65);
              c.beginPath(); c.ellipse(x, y, sz * 0.13, sz * 0.11, sk, 0, Math.PI * 2); c.fill();
              if (two) { c.beginPath(); c.ellipse(x + Math.cos(a0 + sk) * sz * 0.2, y + Math.sin(a0 + sk) * sz * 0.2, sz * 0.09, sz * 0.08, 0, 0, Math.PI * 2); c.fill(); }
            }
            c.fillStyle = rgba('#ffe0a0', 0.14 * L); c.beginPath(); c.ellipse(x - 2, y - sz * 0.18, sz * 0.24, sz * 0.07, 0, 0, Math.PI * 2); c.fill();
          }
        }
      });
      // the lamp's pool of light, and the dark beyond it
      const v = c.createRadialGradient(520, 210, 120, 520, 210, 640); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,1,1,0.85)');
      c.fillStyle = v; c.fillRect(-300, -100, 1600, 600);
    });
    if (kind === 'liver-scan' || kind === 'knot') st.layer(0.95, (c) => {
      // the tumour: crowded, larger, darker cells with big irregular nuclei, breaking the plates' order
      const kx = 600, ky = 220;
      c.fillStyle = rgba('#140404', 0.6); c.beginPath(); c.ellipse(kx, ky, 92, 80, 0.2, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 46; i++) {
        const a = i * 2.39996, r = Math.sqrt(i + 0.5) * 12.5, x = kx + Math.cos(a) * r, y = ky + Math.sin(a) * r * 0.9, s = 13 + hash(i) * 7;
        c.fillStyle = mixHex('#3a1612', '#7a3a26', hash(i + 3) * 0.6 + 0.2); blob(c, [[x - s, y], [x - s * 0.5, y - s * 0.8], [x + s * 0.6, y - s * 0.7], [x + s, y + s * 0.1], [x + s * 0.4, y + s * 0.8], [x - s * 0.6, y + s * 0.7]], true, 0.4); c.fill();
        c.fillStyle = rgba('#1a0606', 0.75); c.beginPath(); c.ellipse(x + (hash(i + 5) - 0.5) * 4, y, s * 0.36, s * 0.28, hash(i) * 3, 0, Math.PI * 2); c.fill();
      }
      if (kind === 'liver-scan') { c.strokeStyle = rgba('#7fe8ff', 0.5 + 0.2 * Math.sin(t * 1.2)); c.lineWidth = 2.5; c.setLineDash([10, 8]); c.beginPath(); c.arc(kx, ky, 104, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    });
  } else if (kind === 'lungs') {
    // Alveoli: a foam of thin-walled sacs packed against each other, capillaries in the walls with
    // red cells moving single file; the whole foam swells and settles with each breath.
    const br = st.still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9 - Math.PI / 2), sc = 0.94 + br * 0.08;
    st.layer(0.9, (c) => {
      c.fillStyle = '#2a0e16'; c.fillRect(-300, -100, 1600, 600);
      c.save(); c.translate(500, 210); c.scale(sc, sc); c.translate(-500, -210);
      const pts: [number, number, number][] = [];
      for (let row = -1; row < 6; row++) for (let i = -2; i < 12; i++) {
        const x = i * 112 + (row % 2) * 56 + (hash(row * 31 + i) - 0.5) * 40, y = row * 96 + (hash(row * 17 + i) - 0.5) * 30, r = 54 + hash(row + i * 7) * 16;
        pts.push([x, y, r]);
      }
      // each sac: dim pink depth inside, a bright rim where the wall turns away from us
      for (const [x, y, r] of pts) {
        const L = clamp(1.1 - Math.hypot(x - 500, y - 210) / 600);
        const g = c.createRadialGradient(x - r * 0.15, y - r * 0.2, r * 0.1, x, y, r);
        g.addColorStop(0, mixHex('#3a1420', '#a85a70', L * 0.5)); g.addColorStop(0.75, mixHex('#4a1a28', '#c87890', L * 0.7)); g.addColorStop(1, mixHex('#6a2838', '#f0b8c8', L));
        c.fillStyle = g; c.beginPath(); blob(c, Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2, rr = r * (0.92 + hash(x + k) * 0.1); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr] as [number, number]; }), true, 0.45); c.fill();
      }
      // the walls between sacs: capillaries, red cells in single file
      c.lineCap = 'round';
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const [x1, y1, r1] = pts[i], [x2, y2, r2] = pts[j], d = Math.hypot(x2 - x1, y2 - y1);
        if (d > r1 + r2 + 8) continue;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) / d, ny = (x2 - x1) / d, half = Math.sqrt(Math.max(0, r1 * r1 - (d / 2) ** 2)) * 0.9;
        const L = clamp(1.1 - Math.hypot(mx - 500, my - 210) / 600);
        c.strokeStyle = rgba(mixHex('#5a1020', '#c83848', L), 0.6); c.lineWidth = 3;
        c.beginPath(); c.moveTo(mx - nx * half, my - ny * half); c.lineTo(mx + nx * half, my + ny * half); c.stroke();
        const ph = ((st.still ? 0.3 : t * 0.25) + hash(i * 13 + j)) % 1;
        for (let q = 0; q < 2; q++) { const u = ((ph + q * 0.5) % 1) * 2 - 1; c.fillStyle = mixHex('#8a1020', '#ff5060', L * 0.6); c.beginPath(); c.arc(mx + nx * half * u, my + ny * half * u, 2.6, 0, Math.PI * 2); c.fill(); }
      }
      c.restore();
      const v = c.createRadialGradient(500, 210, 140, 500, 210, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,2,4,0.8)');
      c.fillStyle = v; c.fillRect(-300, -100, 1600, 600);
    });
  } else {
    // a vessel side on: walls at the top and bottom, soft and wet, pulsing with the beat
    const swell = beat * 4;
    st.layer(0.9, (c) => {
      for (const top of [true, false]) {
        const y0 = top ? -60 : 480, edge = top ? 40 - swell : 380 + swell;
        const g = c.createLinearGradient(0, edge + (top ? -60 : 60), 0, edge);
        g.addColorStop(0, pal[0]); g.addColorStop(1, mixHex(pal[1], pal[2], 0.3));
        c.fillStyle = g; c.beginPath(); c.moveTo(-300, y0);
        for (let x = -300; x <= 1300; x += 40) c.lineTo(x, edge + Math.sin(x * 0.01 + t * 0.6) * 10 * (top ? 1 : -1));
        c.lineTo(1300, y0); c.closePath(); c.fill();
      }
    });
    // red cells drifting with the flow
    const flow = 40 + beat * 60;
    st.layer(1, (c) => {
      const n = 40;
      for (let i = 0; i < n; i++) {
        const x = ((hash(i) * 1600 + t * flow * (0.7 + hash(i + 1) * 0.6)) % 1600) - 300, y = 70 + hash(i + 2) * 280, s = 16 + hash(i + 3) * 10, sq = 0.3 + Math.abs(Math.sin(t * 0.5 + i)) * 0.6;
        const g = c.createRadialGradient(x - s * 0.3, y - s * 0.3 * sq, 0, x, y, s);
        g.addColorStop(0, '#c8343a'); g.addColorStop(1, '#6a0a14');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, s, s * sq, hash(i) * 0.5, 0, Math.PI * 2); c.fill();
      }
    }, kind === 'swarm' ? 0.5 : 0);
    if (kind === 'swarm') {
      // the lights: pouring in from the needle at the left, spreading as the current takes them
      const pour = o.pour ?? st.p;
      st.layer(1, (c) => {
        c.globalCompositeOperation = 'lighter';
        const n = 900;
        for (let i = 0; i < n; i++) {
          const born = hash(i * 1.3) * 0.8; if (pour < born) continue;
          const age = (pour - born) * 6 + (st.still ? 0 : 0);
          const x = 40 + age * (90 + hash(i + 7) * 160), y = 210 + (hash(i * 2.7) - 0.5) * Math.min(300, 20 + age * 70) + Math.sin(t * 0.7 + i) * 3;
          if (x > 1300) continue;
          const s = 1.1 + hash(i * 3.1) * 1.4, a = 0.35 + hash(i * 4.1) * 0.5;
          c.fillStyle = rgba('#9ff0ff', a); c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
          if (i % 9 === 0) { const g = c.createRadialGradient(x, y, 0, x, y, s * 6); g.addColorStop(0, rgba('#7fe8ff', 0.12)); g.addColorStop(1, rgba('#7fe8ff', 0)); c.fillStyle = g; c.fillRect(x - s * 6, y - s * 6, s * 12, s * 12); }
        }
        // the needle's bevelled tip at the left edge
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#8a9aa0'; c.beginPath(); c.moveTo(-300, 196); c.lineTo(40, 202); c.lineTo(20, 214); c.lineTo(-300, 216); c.closePath(); c.fill();
        c.fillStyle = rgba('#e8f0f4', 0.6); c.fillRect(-300, 198, 330, 2);
      });
    }
    if (kind === 'unit') {
      // the unit, holding still in the current, its lamp dimmed: the gunmetal hull, one cyan light
      st.layer(1, (c) => {
        const x = 520, y = 214 + Math.sin(t * 0.8) * 2;
        const g = c.createRadialGradient(x + 30, y, 0, x + 30, y, 120); g.addColorStop(0, rgba('#fff0d8', 0.12)); g.addColorStop(1, rgba('#fff0d8', 0));
        c.fillStyle = g; c.fillRect(x - 100, y - 120, 260, 240);
        const hg = c.createLinearGradient(0, y - 16, 0, y + 16); hg.addColorStop(0, '#9aa4aa'); hg.addColorStop(0.5, '#5a646a'); hg.addColorStop(1, '#22282c');
        c.fillStyle = hg; blob(c, [[x - 36, y], [x - 24, y - 14], [x + 20, y - 15], [x + 40, y - 6], [x + 44, y + 2], [x + 30, y + 12], [x - 22, y + 14]], true, 0.4); c.fill();
        c.fillStyle = rgba('#7fe8ff', 0.9); c.beginPath(); c.arc(x + 28, y - 4, 2.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba('#7fe8ff', 0.25); c.beginPath(); c.arc(x + 28, y - 4, 8, 0, Math.PI * 2); c.fill();
      });
    }
  }
  // plasma specks drifting, as in the game's atmosphere layer
  st.layer(1.2, (c) => {
    for (let i = 0; i < 40; i++) {
      const x = ((hash(i * 9.1) * 1600 + t * 22 * (0.5 + hash(i))) % 1600) - 300, y = hash(i * 3.7) * 420, s = 1 + hash(i) * 2.5;
      c.fillStyle = rgba(pal[2], 0.18 + hash(i * 2) * 0.2); c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
    }
  }, 1.5);
  void o.count; void paper;
}
