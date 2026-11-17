// The rest of the shots: the prologue, The letter, Evening, The same heart, The scan,
// The kitchen after, the endings, the title and the chapter cards. Storyboards:
// /mnt/project-files/creative/storyboards.md and interludes.md (v3).
import { Stage, lerp, ease, smooth, clamp, rgba, mixHex, hash } from './core';
import { kitchen, fridgeClose, PAL, Kit } from './sets';
import { clinic, sofa, bedroom, consult, lab, eyepiece, inside, Liver } from './sets2';
import { Pose, reach, hand, woman, cap, blob, dog, headOf } from './rig';
import { mug, paper, brochure, glass } from './props';
import type { ShotDef } from './shots';

/**
 * What the story has decided, for shots that show the ledger (chapters.md, epilogue modifiers).
 * main.ts sets these before a scene plays.
 */
export const cine = {
  kin: 0,
  liver: 'clean' as Liver,
  /** The chapter card's numbers and whether the unit is awake (it changes the Ch5 card). */
  compliance: 100, awake: false, review: false,
  after: {
    healthHigh: true, walked: true, glass: true, letterGone: true, gen4: false, shingles: false, card: false, dusty: false, stay: false,
  },
};

const T = (st: Stage) => (st.still ? 0.5 : st.t);
const breath = (st: Stage, period = 4.5, phase = 0) => (st.still ? 0.5 : 0.5 + 0.5 * Math.sin((st.t / period + phase) * Math.PI * 2));
const dawn = PAL.dawn.key, night = PAL.night.key;

/** Her, standing at the fridge (x ~ 700), one hand up at the magnet or the letter. */
const atFridge = (st: Stage, hx: number, hy: number, o: Partial<Pose> = {}): Pose => {
  const p: Pose = { x: 650, y: 384, s: 268, face: 1, lean: 0.03, slump: 0.25, neck: 0.15, head: 0.12, near: { sh: 0, el: 0 }, far: { sh: 0, el: 0 }, breath: breath(st), clothes: 'cardigan', stride: 0.1, ...o };
  const n = reach(p, hx, hy, -1); p.near = { sh: n.sh, el: n.el, wr: -0.3, grip: 'open' };
  p.far = { sh: -0.05, el: 0.15, grip: 'open' };
  return p;
};

/** Her, sitting on the sofa side on, facing the TV. */
const onSofa = (st: Stage, o: Partial<Pose> = {}): Pose => ({ x: 470, y: 384, s: 262, face: 1, legs: 'sit', seat: 0.48, lean: -0.18, slump: 0.4, neck: 0.25, head: 0.05, near: { sh: 0.5, el: 0.9, grip: 'open' }, far: { sh: 0.45, el: 0.95, grip: 'open' }, breath: breath(st, 5), clothes: 'cardigan', ...o });

/** A seated pose with the hand pressed under her right ribs (two fingers), as in The letter and Evening. */
const pressSide = (p: Pose, press: number): Pose => {
  // the right upper quadrant: up the torso from the hip, at the front of the body
  const hipH = p.legs === 'sit' ? (p.seat ?? 0.27) : 0.52, lean = p.lean ?? 0, f = p.face;
  const rx = p.x + Math.sin(lean) * f * 0.19 * p.s + Math.cos(lean) * f * 0.075 * p.s;
  const ry = p.y - hipH * p.s - Math.cos(lean) * 0.13 * p.s + Math.sin(lean) * 0.075 * p.s;
  // the target is the wrist; the hand then folds back so the fingertips rest on the body
  const r = reach(p, rx + f * 0.02 * p.s - f * 4 * press, ry + 0.02 * p.s, 1);
  return { ...p, near: { sh: r.sh, el: r.el, wr: 2.1, grip: 'two' } };
};

/** Title and chapter cards: black, thin type, one amber line of telemetry, nothing faster than a breath. */
function card(st: Stage, title: string, line: string, o: { correct?: [string, string]; strike?: [string, string] } = {}) {
  const t = st.still ? 9 : st.t;
  st.layer(1, (c) => {
    c.fillStyle = '#000'; c.fillRect(-300, -100, 1600, 600);
    const a = smooth(t / 1.2) * (st.still ? 1 : 1 - smooth((st.p - 0.85) / 0.15)); // out with the shot's end, whatever its length
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = rgba('#efe6da', a); c.font = '300 46px "Cormorant", "Cormorant Garamond", Georgia, serif';
    if (title) c.fillText(title.split('').join(' '), 500, 190);
    c.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
    const la = smooth((t - 0.8) / 1) * a;
    if (o.correct) {
      // the number settles from its first value to the real one a beat after it appears
      const [from, to] = o.correct, k = smooth((t - 1.9) / 0.6);
      const base = line.replace('{n}', ''), w = c.measureText(base + to).width;
      c.textAlign = 'left'; const x0 = 500 - w / 2;
      c.fillStyle = rgba('#e8a25a', la); c.fillText(base, x0, 246);
      const bx = x0 + c.measureText(base).width;
      c.fillStyle = rgba('#e8a25a', la * (1 - k)); c.fillText(from, bx, 246);
      c.fillStyle = rgba('#e8a25a', la * k); c.fillText(to, bx, 246);
    } else if (o.strike) {
      // TITHONUS 0001, struck through at handwriting speed, then her name in the unit's hand
      const [old, name] = o.strike, k = clamp((t - 1.8) / 1), w = c.measureText(old).width;
      c.fillStyle = rgba('#e8a25a', la); c.fillText(old, 500, 246);
      c.strokeStyle = rgba('#f1e6d6', la); c.lineWidth = 1.4; c.beginPath(); c.moveTo(500 - w / 2 - 4, 247); c.lineTo(500 - w / 2 - 4 + (w + 8) * k, 245.5); c.stroke();
      c.font = 'italic 400 26px "Cormorant", Georgia, serif';
      const nk = clamp((t - 2.9) / 1.2), nw = c.measureText(name).width;
      c.save(); c.beginPath(); c.rect(500 - nw / 2 - 4, 262, (nw + 8) * nk, 40); c.clip();
      c.fillStyle = rgba('#f1e6d6', la); c.fillText(name, 500, 282); c.restore();
    } else if (line) { c.fillStyle = rgba('#e8a25a', la); c.fillText(line, 500, 246); }
    c.textAlign = 'left';
  });
}

export const SHOTS2: Record<string, ShotDef> = {
  // ---------- 0 · Injection ----------
  'clinic-high': {
    label: 'A trial clinic seen from a ceiling camera, wide and still. A woman in a reclining chair, sleeve rolled up, small in the lower third. A nurse beside her. An IV pole.',
    look: 'clinic', a: { x: 500, y: 236, z: 1.1 }, b: { x: 500, y: 236, z: 1.1 }, wide: { x: 500, y: 236, z: 1.1 }, close: [{ x: 420, y: 270, z: 2.2 }, { x: 424, y: 272, z: 2.3 }],
    burn: 'TITHONUS 0001 · CLINIC CAM 3',
    draw: (st) => clinic(st, {
      flicker: true,
      her: { x: 380, y: 352, s: 250, face: 1, legs: 'sit', seat: 0.3, lean: -0.62, slump: 0.1, neck: 0.4, head: 0.3, near: { sh: 1.2, el: 0.25, grip: 'open' }, far: { sh: 0.5, el: 0.8 }, breath: breath(st), clothes: 'cardigan' },
      nurse: { x: 600, y: 370, s: 262, face: -1, lean: 0.22, slump: 0.1, neck: 0.3, head: 0.2, near: { sh: 0.9, el: 0.4, grip: 'fist' }, far: { sh: 0.7, el: 0.6, grip: 'open' }, breath: breath(st, 4, 0.3), clothes: 'scrubs' },
    }),
  },
  'syringe': {
    label: 'Close: a gloved hand brings a syringe to the crook of her arm. The vial on the tray: H-O · GEN 3 · TITHONUS 0001.',
    look: 'clinic', a: { x: 470, y: 230, z: 1 }, b: { x: 450, y: 236, z: 1.1 }, dof: 0.9,
    draw: (st) => {
      const p = st.p;
      st.light = { x: 700, y: -160, color: '#e8f2f0' };
      st.focus = lerp(1, 0.8, smooth((p - 0.62) / 0.25)); // the needle, then a rack to the vial behind
      // the room: a pale wall and the window's cold light, far out of focus
      st.layer(0.6, (c) => {
        const g = c.createLinearGradient(0, -100, 0, 520); g.addColorStop(0, '#8a9c9c'); g.addColorStop(0.6, '#4a5858'); g.addColorStop(1, '#222a2a'); c.fillStyle = g; c.fillRect(-300, -100, 1600, 620);
        const w = c.createRadialGradient(820, 40, 0, 820, 40, 420); w.addColorStop(0, rgba('#f4fbfa', 0.55)); w.addColorStop(1, rgba('#f4fbfa', 0)); c.fillStyle = w; c.fillRect(-300, -100, 1600, 620);
      });
      // the steel tray and the vial, its label legible only once focus racks to it
      st.layer(0.8, (c) => {
        const tg = c.createLinearGradient(0, 262, 0, 286); tg.addColorStop(0, '#b8c6c6'); tg.addColorStop(1, '#4a5656');
        c.fillStyle = tg; c.beginPath(); c.roundRect(620, 262, 330, 22, 4); c.fill();
        const vx = 760, vy = 168;
        const gl = c.createLinearGradient(vx, 0, vx + 44, 0); gl.addColorStop(0, rgba('#cfe0e0', 0.5)); gl.addColorStop(0.25, rgba('#ffffff', 0.85)); gl.addColorStop(0.6, rgba('#a8c0c0', 0.45)); gl.addColorStop(1, rgba('#5a7070', 0.6));
        c.fillStyle = gl; c.beginPath(); c.roundRect(vx, vy + 14, 44, 82, 6); c.fill();
        c.fillStyle = '#3a4a54'; c.beginPath(); c.roundRect(vx - 2, vy, 48, 18, 3); c.fill(); // the crimped cap
        c.fillStyle = '#8a9aa4'; c.fillRect(vx + 4, vy + 3, 36, 3);
        c.fillStyle = '#eef0ec'; c.fillRect(vx, vy + 40, 44, 42);
        c.fillStyle = '#1a2a30'; c.font = '600 8px "IBM Plex Mono", monospace'; c.textAlign = 'center';
        c.fillText('H-O · GEN 3', vx + 22, vy + 56); c.fillText('TITHONUS', vx + 22, vy + 67); c.fillText('0001', vx + 22, vy + 77); c.textAlign = 'left';
        c.fillStyle = rgba('#ffffff', 0.7); c.fillRect(vx + 9, vy + 18, 3, 74);
        // a contact shadow on the tray
        c.fillStyle = rgba('#000', 0.3); c.beginPath(); c.ellipse(vx + 22, 263, 30, 4, 0, 0, Math.PI * 2); c.fill();
      });
      // her arm, the inside of the elbow, filling the bottom of the frame: a lit cylinder, not a cut-out
      st.layer(1, (c) => {
        c.save();
        const top = (x: number) => 300 + Math.sin(x * 0.006 + 0.4) * 10 - (x > 260 ? (x - 260) * 0.03 : 0);
        c.beginPath(); c.moveTo(-200, top(-200));
        for (let x = -200; x <= 1200; x += 20) c.lineTo(x, top(x));
        c.lineTo(1200, 560); c.lineTo(-200, 560); c.closePath();
        const g = c.createLinearGradient(0, 292, 0, 430);
        g.addColorStop(0, '#f0ccb4'); g.addColorStop(0.1, '#d8a890'); g.addColorStop(0.45, '#a87866'); g.addColorStop(0.8, '#5a3a34'); g.addColorStop(1, '#24161a');
        c.fillStyle = g; c.fill();
        c.clip();
        // subsurface warmth along the lit edge, and the cold window light as a broad soft highlight
        const s1 = c.createLinearGradient(0, 290, 0, 330); s1.addColorStop(0, rgba('#ffd8c4', 0.5)); s1.addColorStop(1, rgba('#ffd8c4', 0)); c.fillStyle = s1; c.fillRect(-200, 280, 1400, 60);
        const sp = c.createRadialGradient(560, 330, 0, 560, 330, 340); sp.addColorStop(0, rgba('#f0f6f4', 0.22)); sp.addColorStop(1, rgba('#f0f6f4', 0)); c.fillStyle = sp; c.fillRect(-200, 280, 1400, 280);
        // the crease of the elbow: a soft fold of shadow, lighter skin either side
        for (let j = 0; j < 3; j++) {
          c.strokeStyle = rgba('#4a2a24', [0.22, 0.12, 0.08][j]); c.lineWidth = [3, 10, 22][j];
          c.beginPath(); c.moveTo(262, 296); c.bezierCurveTo(244, 330, 276, 380, 250, 440); c.stroke();
        }
        // the median cubital vein: a faint blue-green line under the skin, raised by the tourniquet
        c.strokeStyle = rgba('#5a7a90', 0.35); c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-100, 336); c.bezierCurveTo(120, 318, 300, 322, 520, 334); c.bezierCurveTo(700, 342, 900, 336, 1200, 344); c.stroke();
        c.strokeStyle = rgba('#e8c8b8', 0.25); c.lineWidth = 2; c.beginPath(); c.moveTo(-100, 332); c.bezierCurveTo(120, 314, 300, 318, 520, 330); c.stroke();
        // the alcohol swab's damp sheen where it was wiped
        const wet = c.createRadialGradient(350, 326, 0, 350, 326, 70); wet.addColorStop(0, rgba('#ffffff', 0.18)); wet.addColorStop(1, rgba('#ffffff', 0)); c.fillStyle = wet; c.fillRect(260, 280, 180, 100);
        // the shadow of the nurse's hand, off frame to the right, falls across the arm
        const hs = c.createRadialGradient(820, 300, 0, 820, 300, 260); hs.addColorStop(0, rgba('#1a1020', 0.45)); hs.addColorStop(1, rgba('#1a1020', 0)); c.fillStyle = hs; c.fillRect(500, 280, 700, 200);
        // a few fine hairs and pores at the near edge, for scale
        c.strokeStyle = rgba('#5a3a30', 0.25); c.lineWidth = 0.7;
        for (let i = 0; i < 40; i++) { const x = hash(i) * 1100 - 80, y = top(x) + 8 + hash(i + 9) * 60; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y - 2); c.stroke(); }
        c.restore();
        // the tourniquet: a blue band cinched above the elbow, out at the left
        const tq = c.createLinearGradient(0, 290, 0, 430); tq.addColorStop(0, '#7a9ad8'); tq.addColorStop(0.4, '#3a5a9a'); tq.addColorStop(1, '#0c1428');
        c.fillStyle = tq; c.beginPath(); c.moveTo(24, top(24) - 6); c.quadraticCurveTo(54, 300, 84, top(84) - 6); c.lineTo(80, 470); c.quadraticCurveTo(50, 480, 28, 470); c.closePath(); c.fill();
        c.strokeStyle = rgba('#c8d8ff', 0.5); c.lineWidth = 1.5; c.beginPath(); c.moveTo(26, top(26) - 5); c.quadraticCurveTo(54, 300, 82, top(82) - 5); c.stroke();
        // its tail, flicked up where it was tied
        c.fillStyle = '#4a6ab0'; c.beginPath(); c.moveTo(62, top(62) - 6); c.bezierCurveTo(80, 250, 110, 236, 150, 232); c.lineTo(152, 242); c.bezierCurveTo(114, 248, 90, 262, 78, top(78) - 6); c.fill();
      });
      // the syringe: clear barrel, black graduations, a steel needle at a shallow angle into the vein
      const k = ease(clamp(p / 0.55)), ang = -0.28;
      const tipX = lerp(400, 352, k), tipY = lerp(306, 326, k); // entry point, just past the crease
      const ux = Math.cos(ang), uy = Math.sin(ang);
      st.layer(1.04, (c) => {
        c.save(); c.translate(tipX, tipY); c.rotate(ang); c.scale(1.9, 1.9); // big in frame: the hand that holds it is off the right edge
        // needle: steel, a bright edge toward the light; the part under the skin is hidden
        const under = 24 * k;
        c.strokeStyle = '#9aa8ac'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(under, 0); c.lineTo(70, 0); c.stroke();
        c.strokeStyle = rgba('#ffffff', 0.85); c.lineWidth = 0.7; c.beginPath(); c.moveTo(under, -0.8); c.lineTo(70, -0.8); c.stroke();
        // hub
        c.fillStyle = '#d8e0e0'; c.beginPath(); c.moveTo(70, -4); c.lineTo(84, -7); c.lineTo(92, -7); c.lineTo(92, 7); c.lineTo(84, 7); c.lineTo(70, 4); c.fill();
        // barrel
        const bg = c.createLinearGradient(0, -14, 0, 14); bg.addColorStop(0, rgba('#ffffff', 0.85)); bg.addColorStop(0.3, rgba('#d8e8ea', 0.35)); bg.addColorStop(0.7, rgba('#a8bcc0', 0.3)); bg.addColorStop(1, rgba('#5a6a70', 0.6));
        c.fillStyle = bg; c.fillRect(92, -13, 230, 26);
        c.fillStyle = rgba('#e8a25a', 0.35); c.fillRect(92, -11, 120, 22); // the dose: faintly amber, not glowing
        c.strokeStyle = rgba('#1a2226', 0.8); c.lineWidth = 0.8;
        for (let i = 0; i <= 20; i++) { c.beginPath(); c.moveTo(100 + i * 10, -13); c.lineTo(100 + i * 10, i % 5 === 0 ? -5 : -9); c.stroke(); }
        c.fillStyle = '#2a3236'; c.fillRect(210, -12, 4, 24); // plunger seal
        c.fillStyle = rgba('#e8eef0', 0.8); c.fillRect(214, -4, 130, 8); c.fillRect(322, -20, 5, 40); // rod and flange
        c.fillStyle = rgba('#ffffff', 0.6); c.fillRect(94, -11, 226, 2);
        c.restore();
      });
    },
  },
  'swarm': {
    label: 'Inside the vein: a slow cloud of tiny lights pours from the needle into the dark red current. Millions of them, and one among them.',
    look: 'body', a: { x: 420, y: 210, z: 1.05 }, b: { x: 520, y: 210, z: 1.12 },
    draw: (st) => inside(st, 'swarm'),
  },
  'title-host': {
    label: 'HOST', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }],
    draw: (st) => card(st, 'HOST', ''),
  },

  // ---------- inside, for the match cuts ----------
  'artery': { label: 'Inside: the artery surges.', look: 'body', a: { x: 500, y: 210, z: 1 }, b: { x: 540, y: 210, z: 1.06 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 540, y: 210, z: 1.06 }], draw: (st) => inside(st, 'artery') },
  'liver-scan': { label: 'Inside: the liver, and the ringed knot of the tumour.', look: 'body', a: { x: 500, y: 210, z: 1 }, b: { x: 530, y: 206, z: 1.08 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 530, y: 206, z: 1.08 }], draw: (st) => inside(st, 'liver-scan') },
  'liver-amber': { label: 'Inside: the liver goes amber and slow.', look: 'body', a: { x: 500, y: 210, z: 1 }, b: { x: 510, y: 210, z: 1.04 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 510, y: 210, z: 1.04 }], draw: (st) => inside(st, 'liver-amber') },
  'vein-clear': { label: 'Inside: a hepatic vein running clear.', look: 'body', a: { x: 500, y: 210, z: 1.1 }, b: { x: 520, y: 210, z: 1.04 }, wide: null, close: [{ x: 500, y: 210, z: 1.1 }, { x: 520, y: 210, z: 1.04 }], draw: (st) => inside(st, 'vein-clear') },
  'unit-still': { label: 'Inside: the unit holds still in a vessel, its lamp dimmed, in time with the same heartbeat.', look: 'body', a: { x: 520, y: 214, z: 1.6 }, b: { x: 520, y: 214, z: 1.6 }, wide: null, close: [{ x: 520, y: 214, z: 1.6 }, { x: 520, y: 214, z: 1.6 }], draw: (st) => inside(st, 'unit') },
  'lungs': { label: 'Inside: the breath becomes the lungs.', look: 'body', a: { x: 500, y: 210, z: 1.1 }, b: { x: 500, y: 210, z: 1.0 }, wide: null, close: [{ x: 500, y: 210, z: 1.1 }, { x: 500, y: 210, z: 1 }], draw: (st) => inside(st, 'lungs') },
  'knot': { label: 'Inside: a small dark knot of tumour cells.', look: 'body', a: { x: 560, y: 200, z: 1.6 }, b: { x: 560, y: 200, z: 1.8 }, wide: null, close: [{ x: 560, y: 200, z: 1.6 }, { x: 560, y: 200, z: 1.8 }], draw: (st) => inside(st, 'knot') },

  // ---------- 3 · The letter (night) ----------
  'kitchen-night': {
    label: 'Night, seen through the dark doorway. The kitchen lit only by the small light over the stove. She stands at the fridge and lifts the magnet off the letter.',
    look: 'night', a: { x: 560, y: 214, z: 1.0 }, b: { x: 600, y: 210, z: 1.12 }, wide: { x: 520, y: 206, z: 0.95 }, close: [{ x: 700, y: 140, z: 2.6 }, { x: 708, y: 136, z: 2.8 }],
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const p = st.p, hx = lerp(704, 726, smooth(p / 0.7)), hy = lerp(150, 104, smooth(p / 0.7));
      kitchen(st, { time: 'night', her: atFridge(st, hx, hy), dog: { x: 150, y: 388, d: 118, face: 1, pose: 'sleep', breath: breath(st, 3.6) }, steam: false });
      // the dark door frame in the foreground, which the camera pushes through
      st.layer(1.5, (c) => { c.fillStyle = '#020102'; c.fillRect(-400, -200, 470, 900); c.fillRect(940, -200, 600, 900); c.fillRect(-400, -200, 1800, 210); }, 2);
    },
  },
  'letter-insert': {
    label: 'The letter in her hands, close enough to read at last.',
    look: 'night', a: { x: 500, y: 216, z: 1.0 }, b: { x: 470, y: 214, z: 1.2 }, wide: { x: 500, y: 210, z: 0.9 }, close: [{ x: 470, y: 180, z: 1.3 }, { x: 460, y: 176, z: 1.4 }], dof: 0.6,
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const tr = st.still ? 0 : Math.sin(st.t * 1.6) * 0.004 + Math.sin(st.t * 2.3) * 0.003; // the paper's slight tremble
      st.light = { x: 200, y: -60, color: night };
      st.layer(0.5, (c) => { const g = c.createRadialGradient(200, 0, 0, 300, 100, 900); g.addColorStop(0, '#3a2818'); g.addColorStop(1, '#070506'); c.fillStyle = g; c.fillRect(-300, -100, 1600, 600); });
      st.layer(1, (c) => {
        c.save(); c.translate(500, 220); c.rotate(-0.04 + tr);
        // the page, lit by the stove light from the upper left: warm where it falls, grey where it doesn't
        const pg = c.createRadialGradient(-160, -150, 20, -60, -40, 470);
        pg.addColorStop(0, '#f4e2c0'); pg.addColorStop(0.45, '#c8b494'); pg.addColorStop(1, '#4a4038');
        c.fillStyle = pg; c.beginPath(); c.moveTo(-210, -150); c.lineTo(210, -150); c.quadraticCurveTo(216, 0, 210, 150); c.lineTo(-210, 150); c.closePath(); c.fill();
        // the folds it was mailed in: a crease catches light, the next one shades
        c.fillStyle = rgba('#000', 0.12); c.fillRect(-210, -50, 420, 50); c.fillStyle = rgba('#fff4e0', 0.12); c.fillRect(-210, -52, 420, 3);
        c.fillStyle = rgba('#000', 0.08); c.fillRect(-210, 50, 420, 100);
        // the insurer's mark and the letter itself
        c.fillStyle = '#2a3a4a'; c.fillRect(-178, -128, 18, 18); c.font = '600 11px "IBM Plex Sans", Arial, sans-serif'; c.textBaseline = 'middle'; c.fillText('MERIDIAN CARE', -152, -119);
        c.fillStyle = '#1e1a16'; c.font = '400 13.5px Georgia, "Times New Roman", serif'; c.textBaseline = 'top';
        const L = ['Dear Ms V.,', '', 'Re: request for prior authorisation, hepatic resection', '', 'Following review, the procedure has been determined to be', 'not medically necessary at this time.', '', 'You may appeal this decision within 60 days.'];
        L.forEach((line, i) => { c.globalAlpha = 0.88 - i * 0.04; c.fillText(line, -178, -92 + i * 21); });
        c.globalAlpha = 1;
        c.restore();
      });
      // her thumbs over the bottom edge, near the lens and soft
      st.layer(1.08, (c) => {
        for (const [x, a] of [[318, -0.25], [690, 0.28]] as const) {
          c.save(); c.translate(x, 470); c.rotate(a);
          const g = c.createLinearGradient(-26, 0, 26, 0); g.addColorStop(0, '#2a1810'); g.addColorStop(0.35, '#8a5a40'); g.addColorStop(0.6, '#6a4030'); g.addColorStop(1, '#1a0e0a');
          c.fillStyle = g; c.beginPath(); c.moveTo(-26, 60); c.lineTo(-22, -92); c.quadraticCurveTo(0, -118, 22, -92); c.lineTo(28, 60); c.closePath(); c.fill();
          c.fillStyle = rgba('#e8b898', 0.35); c.beginPath(); c.ellipse(0, -88, 12, 16, 0, 0, Math.PI * 2); c.fill(); // the nail
          c.restore();
        }
      }, 1.5);
    },
  },
  'fridge-pin': {
    label: 'Her profile at the fridge. She pauses with the letter, then pins it back up beside the brochure: TITHONUS. More mornings.',
    look: 'night', a: { x: 690, y: 150, z: 2.1 }, b: { x: 696, y: 150, z: 2.1 }, wide: { x: 520, y: 206, z: 0.95 }, close: [{ x: 740, y: 116, z: 3.2 }, { x: 744, y: 116, z: 3.3 }], dof: 0.8,
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const p = st.p, pin = smooth((p - 0.35) / 0.35);
      st.focus = lerp(1, 0.85, smooth((p - 0.5) / 0.3)); // her, then the brochure behind her
      kitchen(st, { time: 'night', her: atFridge(st, lerp(704, 726, pin), lerp(150, 110, pin), { neck: 0.35, head: 0.25, slump: 0.45 }), dog: null, letter: pin > 0.9 });
      if (pin < 0.95) st.layer(1, (c) => paper(c, lerp(706, 726, pin), lerp(148, 120, pin), 34, 46, -0.05, { light: night, dark: 0.55, lines: 6 }));
    },
  },
  'side-touch': {
    label: 'Her hand moves to her right side, under the ribs, and settles there.',
    look: 'night', a: { x: 660, y: 170, z: 2.2 }, b: { x: 664, y: 176, z: 2.35 }, wide: { x: 520, y: 206, z: 0.95 }, close: [{ x: 676, y: 176, z: 3.3 }, { x: 676, y: 178, z: 3.45 }], dof: 0.6,
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const k = smooth(st.p / 0.55);
      const base = atFridge(st, 700, 200, { lean: 0.05, slump: 0.5, neck: 0.4, head: 0.3 });
      const p = pressSide({ ...base, near: { sh: 0, el: 0 } }, k);
      p.near = { ...p.near, sh: lerp(-0.05, p.near.sh, k), el: lerp(0.2, p.near.el, k) };
      kitchen(st, { time: 'night', her: p, dog: null });
    },
  },

  // ---------- 2 · Evening ----------
  'sofa-wide': {
    label: 'Night, the sitting room lit only by the television. She sits on the sofa, the old dog asleep across her feet, a glass on the arm beside her.',
    look: 'tv', a: { x: 560, y: 220, z: 1.12 }, b: { x: 560, y: 216, z: 1.04 }, wide: { x: 520, y: 210, z: 0.92 }, close: [{ x: 620, y: 200, z: 2.2 }, { x: 624, y: 200, z: 2.3 }],
    burn: 'TITHONUS 0001 · HOME CAM 4',
    draw: (st) => sofa(st, { her: onSofa(st), dog: { x: 520, y: 392, d: 120, face: 1, pose: 'sleep', breath: breath(st, 3.4) } }),
  },
  'side-press': {
    label: 'Close: two fingers pressed under her right ribs, then let go. The glass on the arm of the sofa.',
    look: 'tv', a: { x: 560, y: 196, z: 2.4 }, b: { x: 560, y: 196, z: 2.4 }, wide: { x: 520, y: 210, z: 0.92 }, close: [{ x: 540, y: 200, z: 3.2 }, { x: 540, y: 200, z: 3.2 }], dof: 0.5,
    burn: 'TITHONUS 0001 · HOME CAM 4',
    draw: (st) => { const k = Math.sin(clamp(st.p / 0.85) * Math.PI); sofa(st, { her: pressSide(onSofa(st), k), dog: { x: 520, y: 392, d: 120, face: 1, pose: 'sleep', breath: breath(st, 3.4) } }); },
  },
  'glass-tilt': {
    label: 'The glass tilts to her mouth. The drink catches the television light.',
    look: 'tv', a: { x: 560, y: 150, z: 2.2 }, b: { x: 566, y: 136, z: 2.35 }, wide: { x: 520, y: 210, z: 0.92 }, close: [{ x: 580, y: 136, z: 3.2 }, { x: 584, y: 130, z: 3.4 }], dof: 0.4,
    burn: 'TITHONUS 0001 · HOME CAM 4',
    draw: (st) => {
      const k = ease(clamp(st.p / 0.8)), base = onSofa(st, { neck: lerp(0.25, -0.1, k), head: lerp(0.05, -0.2, k) });
      const m = headOf(base).mouth, gx = lerp(m[0] + 60, m[0] + 14, k), gy = lerp(m[1] + 96, m[1] + 18, k); // from her lap to her mouth
      const r = reach(base, gx - 6, gy - 10, 1); base.near = { sh: r.sh, el: r.el, wr: -0.6, grip: 'fist' };
      sofa(st, { her: base, dog: { x: 520, y: 392, d: 120, face: 1, pose: 'sleep', breath: breath(st, 3.4) }, held: [gx, gy], tilt: lerp(0, -0.7, k), glass: 0.6 });
    },
  },
  // 2b · Evening, corrected
  'flush': {
    label: 'Her hand to her cheek. She is flushed: only a warmer tone on her silhouette.',
    look: 'tv', a: { x: 500, y: 140, z: 2.4 }, b: { x: 504, y: 138, z: 2.5 }, wide: { x: 520, y: 210, z: 0.92 }, dof: 0.4,
    burn: 'TITHONUS 0001 · HOME CAM 4',
    draw: (st) => {
      const base = onSofa(st, { neck: 0.1, head: 0.1 }), m = headOf(base);
      const r = reach(base, m.x + 12, m.y + m.hu * 0.4, 1); base.near = { sh: r.sh, el: r.el, wr: -1.4, grip: 'open' };
      sofa(st, { her: base, dog: { x: 520, y: 392, d: 120, face: 1, pose: 'sleep', breath: breath(st, 3.4) }, glass: 0.55 });
      st.glow(m.x + 8, m.y + 6, 40, '#ff6040', 0.12 * smooth(st.p / 0.6), 1.01); // acetaldehyde flush: a warm bloom, slow
    },
  },
  'sink-pour': {
    label: 'The kitchen sink, her back to us. She tips the glass out.',
    look: 'night', a: { x: 560, y: 170, z: 1.8 }, b: { x: 560, y: 176, z: 1.9 }, wide: { x: 520, y: 206, z: 0.95 }, close: [{ x: 556, y: 196, z: 3.2 }, { x: 556, y: 200, z: 3.3 }],
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const k = smooth(st.p / 0.6);
      const p: Pose = { x: 560, y: 384, s: 268, face: 1, view: 'back', lean: 0.05, slump: 0.35, neck: 0.3, head: 0.2, near: { sh: 0.6, el: 0.8, grip: 'fist' }, far: { sh: 0.3, el: 0.5 }, breath: breath(st), clothes: 'cardigan' };
      kitchen(st, { time: 'night', her: p, dog: null, mug: false, hands: (s) => {
        s.layer(1.01, (c) => glass(c, 600, 196, 26, night, lerp(0.6, 0, k), lerp(0, 1.9, k)));
        if (k > 0.1 && k < 0.95) s.layer(1.01, (c) => { c.strokeStyle = rgba('#5a0a1a', 0.7); c.lineWidth = 2.5; c.beginPath(); c.moveTo(588, 190); c.quadraticCurveTo(584, 198, 586, 206); c.stroke(); });
      } });
    },
  },
  'sofa-empty': {
    label: 'Back on the sofa with nothing in her hands. The dog lifts its head, then lays it down again.',
    look: 'tv', a: { x: 560, y: 220, z: 1.12 }, b: { x: 560, y: 216, z: 1.06 }, wide: { x: 520, y: 210, z: 0.92 },
    burn: 'TITHONUS 0001 · HOME CAM 4',
    draw: (st) => { const h = Math.sin(clamp((st.p - 0.2) / 0.6) * Math.PI); sofa(st, { her: onSofa(st, { near: { sh: 0.6, el: 0.7, grip: 'open' } }), dog: { x: 520, y: 392, d: 120, face: 1, pose: h > 0.1 ? 'lie' : 'sleep', head: lerp(-1, 0.5, h), breath: breath(st, 3.4) }, empty: true }); },
  },

  // ---------- 4 · The same heart ----------
  'bedroom-wide': {
    label: 'Night, her bedroom. Her shape under the duvet. The streetlight comes orange through the curtain, which sways a little.',
    look: 'dusk', a: { x: 480, y: 220, z: 1.06 }, b: { x: 480, y: 220, z: 1.06 }, wide: { x: 500, y: 210, z: 0.95 },
    draw: (st) => bedroom(st, { breath: breath(st, 5) }),
  },
  'dog-climb': {
    label: 'The old dog climbs up onto the bed and settles, its head on her chest. Her hand finds its back.',
    look: 'dusk', a: { x: 420, y: 250, z: 1.7 }, b: { x: 410, y: 250, z: 1.85 }, wide: { x: 500, y: 210, z: 0.95 },
    draw: (st) => bedroom(st, { breath: breath(st, 5), dogOn: smooth(st.p / 0.6), hand: smooth((st.p - 0.6) / 0.3) }),
  },
  'dog-ear': {
    label: 'Closer: the dog\'s head on her chest, very still, rising and falling with her breathing.',
    look: 'dusk', a: { x: 400, y: 236, z: 2.6 }, b: { x: 400, y: 236, z: 2.7 }, wide: { x: 500, y: 210, z: 0.95 }, dof: 0.6,
    draw: (st) => bedroom(st, { breath: breath(st, 5), dogOn: 1, hand: 1 }),
  },

  // ---------- 5 · The scan ----------
  'consult-wide': {
    label: 'A consulting room. She sits in the chair; the radiologist turns from the screen toward her. A warm desk lamp, the screen\'s cool light.',
    look: 'clinic', a: { x: 500, y: 214, z: 1.05 }, b: { x: 500, y: 214, z: 1.05 }, wide: { x: 500, y: 210, z: 0.95 },
    burn: 'TITHONUS 0001 · CONSULT 2',
    draw: (st) => {
      const turn = smooth(st.p / 0.8);
      consult(st, { scan: cine.liver === 'tumour' ? 'tumour' : cine.liver, label: label(st),
        doc: { x: 640, y: 380, s: 250, face: turn > 0.5 ? -1 : 1, legs: 'sit', seat: 0.46, lean: -0.05, slump: 0.2, neck: 0.15, head: 0.05, near: { sh: 0.5, el: 0.9 }, far: { sh: 0.4, el: 0.9 }, breath: breath(st, 4.4) },
        her: { x: 300, y: 380, s: 255, face: 1, legs: 'sit', seat: 0.46, lean: 0.06, slump: 0.35, neck: 0.2, head: 0.1, near: { sh: 0.6, el: 0.8 }, far: { sh: 0.55, el: 0.85 }, breath: breath(st, 4.6), clothes: 'coat' },
      });
    },
  },
  'ct-screen': {
    label: 'The CT slice on the screen. A gloved finger traces where the lesion was. There is nothing there.',
    look: 'clinic', a: { x: 620, y: 156, z: 3.6 }, b: { x: 616, y: 158, z: 3.9 }, wide: { x: 500, y: 210, z: 0.95 },
    draw: (st) => consult(st, { scan: cine.liver === 'recur' ? 'recur' : cine.liver === 'fatty' ? 'fatty' : 'clean', finger: st.p, label: label(st) }),
  },
  'ct-label': {
    label: 'The corner of the screen: the patient label.',
    look: 'clinic', a: { x: 590, y: 118, z: 5.6 }, b: { x: 594, y: 118, z: 5.9 }, wide: { x: 590, y: 118, z: 4.5 }, close: [{ x: 596, y: 116, z: 6.2 }, { x: 600, y: 116, z: 6.5 }],
    draw: (st) => consult(st, { scan: 'clean', label: label(st) }),
  },
  'shoulders': {
    label: 'Her shoulders, from behind, in the lamplight. One long breath out, and they drop.',
    look: 'dusk', a: { x: 300, y: 180, z: 2.8 }, b: { x: 300, y: 184, z: 2.6 }, wide: { x: 500, y: 210, z: 0.95 }, dof: 0.6,
    draw: (st) => {
      const out = smooth((st.p - 0.3) / 0.5);
      consult(st, { scan: 'clean', label: label(st),
        her: { x: 300, y: 380, s: 255, face: 1, view: 'back', legs: 'sit', seat: 0.46, lean: lerp(-0.02, 0.08, out), slump: lerp(0.1, 0.6, out), neck: lerp(0.05, 0.35, out), head: 0.1, near: { sh: 0.2, el: 0.6 }, far: { sh: 0.2, el: 0.6 }, breath: lerp(1, 0, out), clothes: 'coat' } });
    },
  },
  'ct-recur': {
    label: 'The gloved finger stops at the edge of the old lesion, on a small bright spot.',
    look: 'clinic', a: { x: 600, y: 150, z: 5.2 }, b: { x: 596, y: 150, z: 5.6 }, wide: { x: 500, y: 210, z: 0.95 },
    draw: (st) => consult(st, { scan: 'recur', finger: Math.min(st.p, 0.5) * 0, label: label(st) }),
  },
  'not-breathing': {
    label: 'Over her shoulder: she does not breathe out. Hold.',
    look: 'clinic', a: { x: 420, y: 170, z: 2.2 }, b: { x: 420, y: 170, z: 2.2 }, wide: { x: 500, y: 210, z: 0.95 }, dof: 0.6,
    draw: (st) => consult(st, { scan: 'recur', label: label(st), her: { x: 300, y: 380, s: 255, face: 1, view: 'back', legs: 'sit', seat: 0.46, lean: 0.02, slump: 0.05, neck: -0.05, head: 0, near: { sh: 0.2, el: 0.6 }, far: { sh: 0.2, el: 0.6 }, breath: 1, clothes: 'coat' } }),
  },

  // ---------- E · The kitchen, after ----------
  'after-wide': {
    label: 'The same kitchen weeks later, the same morning sun.',
    look: 'dawn', a: { x: 470, y: 210, z: 1.0 }, b: { x: 500, y: 206, z: 1.06 }, wide: { x: 500, y: 200, z: 0.92 },
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => kitchen(st, { ...afterKit(st), her: null }),
  },
  'after-fridge': {
    label: 'The fridge door, close.',
    look: 'dawn', a: { x: 500, y: 180, z: 1.0 }, b: { x: 500, y: 236, z: 1.04 }, wide: { x: 500, y: 210, z: 0.9 },
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => fridgeClose(st, afterKit(st), 'dawn'),
  },
  'after-hook': {
    label: 'The hook by the door.',
    look: 'dawn', a: { x: 880, y: 176, z: 2.0 }, b: { x: 876, y: 172, z: 2.1 }, wide: { x: 760, y: 206, z: 1.0 },
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => { const k = afterKit(st); kitchen(st, { ...k, her: null, dog: cine.after.walked ? null : { x: 930, y: 388, d: 118, face: -1, pose: 'sit', breath: breath(st, 2.6), wag: st.still ? 0 : Math.sin(st.t * 1.4) } }); },
  },
  'after-her': {
    label: 'Her, in the kitchen, as she is now.',
    look: 'dawn', a: { x: 520, y: 200, z: 1.5 }, b: { x: 520, y: 200, z: 1.5 }, wide: { x: 500, y: 200, z: 0.92 },
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => {
      const a = cine.after, k = afterKit(st);
      let her: Pose;
      if (a.healthHigh) {
        her = { x: 600, y: 384, s: 268, face: -1, lean: 0.02, slump: 0.05, neck: 0.05, head: 0, near: { sh: 0.25, el: 0.5, grip: 'fist' }, far: { sh: -0.05, el: 0.1 }, breath: breath(st), clothes: 'coat', stride: 0.3 };
        if (a.shingles) { const r = reach(her, her.x - 14, 384 - 268 * 0.76, 1); her.far = { sh: r.sh, el: r.el, wr: -0.6, grip: 'open' }; her.slump = 0.3; }
      } else {
        her = { x: 520, y: 384, s: 262, face: 1, legs: 'sit', seat: 0.46, lean: 0.12, slump: 0.6, neck: 0.4, head: 0.2, near: { sh: 0.7, el: 0.9, grip: 'open' }, far: { sh: 0.6, el: 0.9, grip: 'open' }, breath: breath(st, 3.6), clothes: 'gown' };
      }
      kitchen(st, { ...k, her, pills: !a.healthHigh });
      if (!a.healthHigh) st.layer(1, (c) => { c.fillStyle = '#0a0706'; c.fillRect(480, 260, 90, 8); c.fillRect(484, 268, 6, 116); c.fillRect(560, 268, 6, 116); }); // a chair
    },
  },

  // ---------- endings ----------
  'lab-high': {
    label: 'The lab at night, seen from high: one lamp, her at the bench with the microscope.',
    look: 'night', a: { x: 520, y: 200, z: 1.05 }, b: { x: 520, y: 200, z: 1.05 }, wide: { x: 520, y: 200, z: 1.0 },
    burn: 'PATHOLOGY · CAM 7',
    draw: (st) => lab(st, { her: atScope(st, 0) }),
  },
  'lab-stranger': {
    label: 'The lab at night, a different figure at the bench: taller, a cardigan, a coffee in a paper cup.',
    look: 'night', a: { x: 520, y: 200, z: 1.05 }, b: { x: 520, y: 200, z: 1.05 }, wide: { x: 520, y: 200, z: 1.0 },
    burn: 'PATHOLOGY · CAM 7',
    draw: (st) => { lab(st, { her: { ...atScope(st, 0), s: 300, clothes: 'cardigan' } }); st.layer(1, (c) => { c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(380, 230); c.lineTo(384, 204); c.lineTo(400, 204); c.lineTo(404, 230); c.closePath(); c.fill(); c.fillStyle = '#5a3a2a'; c.fillRect(383, 212, 18, 6); }); },
  },
  'tube-insert': {
    label: 'A tube of her blood, labelled V., MARIAN · TITHONUS 0001. A drop on the glass; the coverslip.',
    look: 'night', a: { x: 520, y: 300, z: 1.45 }, b: { x: 530, y: 306, z: 1.52 }, dof: 0.6,
    draw: (st) => {
      st.light = { x: 300, y: -80, color: night };
      st.layer(0.5, (c) => { const g = c.createRadialGradient(400, 100, 0, 400, 100, 800); g.addColorStop(0, '#2a2220'); g.addColorStop(1, '#050506'); c.fillStyle = g; c.fillRect(-300, -100, 1600, 600); });
      st.layer(1, (c) => {
        // the bench top, a plane going away from us, lit by the lamp toward the back
        const bt = c.createLinearGradient(0, 296, 0, 430); bt.addColorStop(0, '#3a3836'); bt.addColorStop(1, '#121214'); c.fillStyle = bt; c.fillRect(-300, 296, 1600, 300);
        c.fillStyle = rgba('#f0d8b0', 0.18); c.fillRect(-300, 296, 1600, 2);
        // the tube lying on the bench, its label toward us; a contact shadow under it
        c.fillStyle = rgba('#000', 0.45); c.beginPath(); c.ellipse(330, 352, 190, 9, 0.02, 0, Math.PI * 2); c.fill();
        c.save(); c.translate(330, 326); c.rotate(0.02);
        c.fillStyle = rgba('#e8e8ec', 0.3); c.beginPath(); c.roundRect(-160, -24, 300, 48, 22); c.fill();
        c.fillStyle = '#5a0810'; c.beginPath(); c.roundRect(-150, -18, 220, 36, 16); c.fill();
        c.fillStyle = '#7a2a8a'; c.fillRect(140, -28, 50, 56);
        c.fillStyle = '#f2f2ee'; c.fillRect(-120, -22, 190, 44);
        c.fillStyle = '#1a1a1a'; c.font = '600 13px "IBM Plex Mono", monospace'; c.fillText('V., MARIAN', -110, -4); c.font = '500 11px "IBM Plex Mono", monospace'; c.fillText('TITHONUS 0001', -110, 14);
        c.restore();
        // the slide, a drop, the coverslip lowering
        const k = smooth((st.p - 0.35) / 0.4);
        // the slide, flat on the bench and seen at a low angle: a thin glass parallelogram
        c.fillStyle = rgba('#000', 0.35); c.beginPath(); c.moveTo(586, 352); c.lineTo(866, 352); c.lineTo(884, 386); c.lineTo(566, 386); c.closePath(); c.fill();
        c.fillStyle = rgba('#dfe8ec', 0.22); c.beginPath(); c.moveTo(590, 344); c.lineTo(860, 344); c.lineTo(878, 378); c.lineTo(572, 378); c.closePath(); c.fill();
        c.strokeStyle = rgba('#ffffff', 0.5); c.lineWidth = 1.2; c.beginPath(); c.moveTo(572, 378); c.lineTo(878, 378); c.stroke();
        c.fillStyle = rgba('#f0f0e8', 0.6); c.beginPath(); c.moveTo(590, 344); c.lineTo(640, 344); c.lineTo(636, 378); c.lineTo(572, 378); c.closePath(); c.fill(); // the frosted end, for writing on
        // the drop: dark red, domed, with a highlight; it spreads as the coverslip comes down
        const dr = 18 + k * 16;
        c.fillStyle = '#5a0610'; c.beginPath(); c.ellipse(740, 362, dr, dr * 0.32, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba('#ff9a9a', 0.5 * (1 - k * 0.6)); c.beginPath(); c.ellipse(734, 358, dr * 0.3, dr * 0.08, 0, 0, Math.PI * 2); c.fill();
        // the coverslip, held at one edge and lowered at an angle so no bubble is trapped
        c.save(); c.translate(690, lerp(300, 360, k)); c.rotate(lerp(-0.35, 0, k));
        c.fillStyle = rgba('#eef4f8', 0.28); c.fillRect(0, -2, 110, 4); c.fillStyle = rgba('#ffffff', 0.7); c.fillRect(0, -2, 110, 1); c.restore();
      });
    },
  },
  'eyepiece-line': {
    label: 'Down the eyepiece: pink cells, scattered as always, and across them a line of evenly spaced lights.',
    look: 'day', a: { x: 500, y: 210, z: 1.0 }, b: { x: 500, y: 210, z: 1.06 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1.06 }],
    draw: (st) => eyepiece(st, { line: 1 + cine.kin, drift: st.p }),
  },
  'eyepiece-odd': {
    label: 'Down the eyepiece: scattered pink cells, and one odd speck.',
    look: 'day', a: { x: 500, y: 210, z: 1.0 }, b: { x: 500, y: 210, z: 1.04 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1.04 }],
    draw: (st) => eyepiece(st, { line: 1 + Math.min(1, cine.kin), odd: cine.kin < 1, drift: st.p }),
  },
  'sit-back': {
    label: 'She sits back from the microscope, her hands in her lap. A long hold.',
    look: 'night', a: { x: 460, y: 190, z: 1.7 }, b: { x: 460, y: 190, z: 1.75 }, wide: { x: 520, y: 200, z: 1.0 },
    burn: 'PATHOLOGY · CAM 7',
    draw: (st) => lab(st, { her: atScope(st, smooth(st.p / 0.4)) }),
  },
  'phone-reach': {
    label: 'The phone on the bench. Her hand goes to it.',
    look: 'night', a: { x: 350, y: 222, z: 4 }, b: { x: 352, y: 222, z: 4.2 }, wide: { x: 520, y: 200, z: 1.0 }, dof: 0.5,
    draw: (st) => {
      lab(st, { phone: true });
      const k = smooth(st.p / 0.7);
      st.lit(1.01, (c) => hand(c, { x: lerp(260, 330, k), y: lerp(200, 216, k), a: 0.2, len: 34, side: 1, curl: [0.3, 0.35, 0.4, 0.5], thumb: 0.2, arm: 4 }), { body: '#0a0b0c', rim: 1, width: 1, fill: 0.4, at: [300, 210, 80] });
    },
  },
  'brochure-down': {
    label: 'Her kitchen that night. She takes the brochure off the fridge. The letter stays.',
    look: 'night', a: { x: 600, y: 200, z: 1.2 }, b: { x: 620, y: 196, z: 1.28 }, wide: { x: 520, y: 206, z: 0.95 },
    burn: 'TITHONUS 0001 · HOME CAM 2',
    draw: (st) => {
      const k = smooth(st.p / 0.6);
      kitchen(st, { time: 'night', her: atFridge(st, lerp(776, 740, k), lerp(110, 170, k)), dog: { x: 150, y: 388, d: 118, face: 1, pose: 'sleep', breath: breath(st, 3.6) }, brochure: k < 0.1 });
      if (k >= 0.1) st.layer(1, (c) => brochure(c, lerp(776, 742, k), lerp(122, 172, k), 32, 44, lerp(0.03, -0.4, k), { light: night, dark: 0.55 }));
    },
  },
  'phone-photo': {
    label: 'He looks twice. He holds his phone to the eyepiece and photographs it: the line of lights, on his screen.',
    look: 'night', a: { x: 500, y: 214, z: 1.1 }, b: { x: 500, y: 210, z: 1.18 }, wide: { x: 500, y: 214, z: 1.0 }, dof: 0.5,
    draw: (st) => {
      const p = st.p, up = ease(clamp(p / 0.35)), snap = smooth((p - 0.6) / 0.25);
      st.light = { x: 520, y: -40, color: '#f2c890' };
      st.focus = 1.04;
      // the microscope's head below, out of focus: two eyepiece tubes catching the lamp
      st.layer(0.85, (c) => {
        c.fillStyle = '#07080a'; c.fillRect(-300, -100, 1600, 600);
        const g = c.createRadialGradient(500, -40, 0, 500, 60, 600); g.addColorStop(0, rgba('#f2c890', 0.25)); g.addColorStop(1, rgba('#f2c890', 0)); c.fillStyle = g; c.fillRect(-300, -100, 1600, 600);
        for (const x of [430, 570]) {
          const tg = c.createLinearGradient(x - 34, 0, x + 34, 0); tg.addColorStop(0, '#0c0c0e'); tg.addColorStop(0.35, '#3a3a40'); tg.addColorStop(1, '#08080a');
          c.fillStyle = tg; c.fillRect(x - 34, 300, 68, 200); c.fillStyle = '#1a1a1e'; c.beginPath(); c.ellipse(x, 300, 34, 9, 0, 0, Math.PI * 2); c.fill();
        }
      });
      // the phone, coming up over the right eyepiece; its screen shows the field of view
      const py = lerp(470, 214, up);
      st.layer(1.04, (c) => {
        c.save(); c.translate(560, py); c.rotate(lerp(0.25, -0.03, up));
        c.fillStyle = '#0a0a0c'; c.beginPath(); c.roundRect(-92, -176, 184, 352, 24); c.fill();
        c.strokeStyle = rgba('#8a8a90', 0.5); c.lineWidth = 1.5; c.stroke();
        c.save(); c.beginPath(); c.roundRect(-82, -164, 164, 328, 16); c.clip();
        c.fillStyle = '#050505'; c.fillRect(-82, -164, 164, 328);
        // the eyepiece image as a phone sees it: a bright disc, off centre, pink cells and the line
        const ex = 6 + (st.still ? 0 : Math.sin(st.t * 1.1) * 3 * (1 - snap)), ey = -10, R = 72;
        c.save(); c.beginPath(); c.arc(ex, ey, R, 0, Math.PI * 2); c.clip();
        c.fillStyle = '#f2dcd6'; c.fillRect(ex - R, ey - R, R * 2, R * 2);
        for (let i = 0; i < 60; i++) { const a = hash(i * 1.7) * Math.PI * 2, r = Math.sqrt(hash(i * 2.3)) * R; c.fillStyle = mixHex('#e07a8a', '#c85a6e', hash(i)); c.beginPath(); c.arc(ex + Math.cos(a) * r, ey + Math.sin(a) * r, 4.2, 0, Math.PI * 2); c.fill(); }
        const n = Math.max(2, 1 + cine.kin);
        for (let i = 0; i < n; i++) { const x = ex - (n - 1) * 5 + i * 10, y = ey + 2; c.fillStyle = '#2a2e32'; c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill(); c.fillStyle = rgba('#7fe8ff', 0.9); c.fillRect(x + 0.5, y - 1, 0.8, 0.8); }
        const v = c.createRadialGradient(ex, ey, R * 0.7, ex, ey, R); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.8)'); c.fillStyle = v; c.fillRect(ex - R, ey - R, R * 2, R * 2);
        c.restore();
        // the camera app: a shutter button; once pressed, the picture shrinks into the corner (no flash)
        c.strokeStyle = rgba('#ffffff', 0.8); c.lineWidth = 2; c.beginPath(); c.arc(0, 128, 16, 0, Math.PI * 2); c.stroke();
        c.fillStyle = rgba('#ffffff', 0.7 - snap * 0.2); c.beginPath(); c.arc(0, 128, 12 - snap * 2, 0, Math.PI * 2); c.fill();
        if (snap > 0) {
          const tx = lerp(ex, -56, snap), ty = lerp(ey, 128, snap), tr = lerp(R, 12, snap);
          c.globalAlpha = snap; c.fillStyle = '#f2dcd6'; c.beginPath(); c.roundRect(tx - tr, ty - tr, tr * 2, tr * 2, 3); c.fill(); c.globalAlpha = 1;
        }
        c.restore(); c.restore();
      });
      // his hands at the phone's edges, dark against the lamp, soft
      st.lit(1.08, (c) => {
        c.save(); c.translate(560, py); c.rotate(lerp(0.25, -0.03, up));
        cap(c, -150, 260, -92, 60, 30, 18); c.beginPath(); c.ellipse(-94, 52, 20, 30, 0.2, 0, Math.PI * 2); c.fill();
        cap(c, 150, 260, 92, 80, 30, 18); c.beginPath(); c.ellipse(96, 72, 20, 30, -0.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(-86, -20, 10, 26, 0.1, 0, Math.PI * 2); c.fill(); // a thumb over the left edge
        c.restore();
      }, { body: '#0e0c0c', rim: 0.9, width: 2, fill: 0.5, at: [560, 300, 400] });
    },
  },
  'apheresis': {
    label: 'Weeks later: a clinic machine, a bag of pale fluid filling slowly. Plasmapheresis.',
    look: 'clinic', a: { x: 500, y: 210, z: 1.2 }, b: { x: 500, y: 214, z: 1.28 }, dof: 0.4,
    draw: (st) => {
      st.light = { x: 600, y: -60, color: '#e0f0f0' };
      st.layer(0.6, (c) => { const g = c.createLinearGradient(0, -100, 0, 500); g.addColorStop(0, '#5a6a6a'); g.addColorStop(1, '#1a2222'); c.fillStyle = g; c.fillRect(-300, -100, 1600, 600); });
      st.layer(1, (c) => {
        // the separator's cabinet, its pumps, the lines; the collection bag on its hook, filling with straw-yellow plasma
        c.fillStyle = '#c8d4d4'; c.beginPath(); c.roundRect(260, 120, 260, 300, 10); c.fill();
        c.fillStyle = '#2a3434'; c.fillRect(290, 150, 200, 80); c.fillStyle = rgba('#7fe8ff', 0.35); c.fillRect(300, 160, 80, 6); c.fillRect(300, 172, 120, 4);
        for (let i = 0; i < 3; i++) { c.fillStyle = '#8a9898'; c.beginPath(); c.arc(320 + i * 70, 280, 24, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a6868'; c.beginPath(); c.arc(320 + i * 70, 280, 8, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = '#7a1420'; c.lineWidth = 3; c.beginPath(); c.moveTo(320, 304); c.quadraticCurveTo(300, 380, 200, 400); c.stroke();
        c.strokeStyle = '#d8c070'; c.beginPath(); c.moveTo(460, 304); c.quadraticCurveTo(560, 260, 640, 160); c.stroke();
        c.strokeStyle = '#8a9898'; c.lineWidth = 3; c.beginPath(); c.moveTo(600, 40); c.lineTo(700, 40); c.stroke();
        const fill = 0.2 + smooth(st.p) * 0.35;
        c.fillStyle = rgba('#eef4f4', 0.35); c.beginPath(); c.roundRect(610, 60, 80, 120, 10); c.fill();
        c.fillStyle = rgba('#e8d080', 0.8); c.beginPath(); c.roundRect(612, 60 + 120 * (1 - fill), 76, 120 * fill - 2, 8); c.fill();
      });
    },
  },
  'freezer': {
    label: 'A freezer drawer. A sealed bag with a printed label. The drawer closes.',
    look: 'clinic', a: { x: 500, y: 220, z: 1.3 }, b: { x: 500, y: 220, z: 1.36 },
    draw: (st) => {
      const k = smooth((st.p - 0.45) / 0.4);
      st.light = { x: 500, y: -120, color: '#c8e8f0' };
      st.layer(0.7, (c) => { c.fillStyle = '#1a2224'; c.fillRect(-300, -100, 1600, 600); for (let i = 0; i < 4; i++) { c.fillStyle = '#2a3436'; c.fillRect(160, 40 + i * 90, 680, 80); } });
      st.layer(1, (c) => {
        const y = lerp(220, 140, k);
        c.fillStyle = '#c8d4d6'; c.fillRect(200, y, 600, 160); c.fillStyle = '#e8eef0'; c.fillRect(200, y, 600, 14);
        c.fillStyle = rgba('#e8f4f8', 0.7); for (let i = 0; i < 9; i++) c.fillRect(230 + i * 64, y + 20, 50, 60);
        c.fillStyle = rgba('#f0f0e8', 0.9); c.fillRect(440, y + 30, 120, 80); c.fillStyle = '#1a1a1a'; c.font = '500 9px "IBM Plex Mono", monospace'; c.fillText('BIOHAZARD · HOLD', 448, y + 50); c.fillText('TITHONUS 0001', 448, y + 64); c.fillText('FILTRATE 3/3', 448, y + 78);
        const g = c.createLinearGradient(0, y - 60, 0, y); g.addColorStop(0, rgba('#e0f4ff', 0)); g.addColorStop(1, rgba('#e0f4ff', 0.18)); c.fillStyle = g; c.fillRect(200, y - 60, 600, 60); // cold mist
      });
    },
  },
  'coffee-alive': {
    label: 'Her kitchen, morning. She is thinner, and alive, making coffee.',
    look: 'dawn', a: { x: 470, y: 210, z: 1.0 }, b: { x: 500, y: 206, z: 1.06 }, wide: { x: 500, y: 200, z: 0.92 },
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => { const h = { ...SHOTS2_her(st), s: 266 }; kitchen(st, { time: 'dawn', her: h, dog: { x: 150, y: 388, d: 118, face: 1, pose: 'sleep', breath: breath(st, 3.4) } }); },
  },
  'pencil-artifact': {
    label: 'Her pencil writes "artifact" in the margin of the log sheet.',
    look: 'night', a: { x: 500, y: 220, z: 1.2 }, b: { x: 504, y: 222, z: 1.26 }, dof: 0.4,
    draw: (st) => {
      st.light = { x: 300, y: -80, color: night };
      st.layer(1, (c) => {
        c.fillStyle = '#0a0b0e'; c.fillRect(-300, -100, 1600, 600);
        c.save(); c.translate(500, 230); c.rotate(0.03);
        const pg = c.createRadialGradient(-120, -160, 20, 0, -40, 520); pg.addColorStop(0, '#f0e6d2'); pg.addColorStop(0.5, '#c8bca6'); pg.addColorStop(1, '#4a4440');
        c.fillStyle = pg; c.fillRect(-320, -210, 640, 420);
        c.fillStyle = rgba('#c04040', 0.35); c.fillRect(60, -210, 1.5, 420); // the margin rule
        c.strokeStyle = rgba('#3a4a6a', 0.35); c.lineWidth = 1; for (let y = -170; y < 200; y += 26) { c.beginPath(); c.moveTo(-320, y); c.lineTo(320, y); c.stroke(); }
        c.fillStyle = rgba('#2a2a30', 0.8); c.font = '400 14px "IBM Plex Mono", monospace';
        ['02:14  FBC   0001  WNL', '02:31  SMEAR 0001  RBC norm. WBC norm.', '02:40  SMEAR 0001'].forEach((s, i) => c.fillText(s, -280, -110 + i * 26));
        const w = smooth((st.p - 0.15) / 0.5);
        c.save(); c.beginPath(); c.rect(80, -60, 200 * w, 40); c.clip(); c.fillStyle = rgba('#2a2a30', 0.85); c.font = 'italic 400 24px Georgia, serif'; c.fillText('artifact', 90, -34); c.restore();
        c.restore();
      });
      const w = smooth((st.p - 0.15) / 0.5), px = 590 + 200 * w, py = 196;
      st.lit(1.05, (c) => { c.save(); c.translate(px, py); c.rotate(-0.9); c.fillRect(-3, -110, 6, 110); c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.lineTo(0, 10); c.closePath(); c.fill(); c.restore(); hand(c, { x: px + 60, y: py - 60, a: 2.4, len: 60, side: 1, curl: [0.6, 0.9, 1, 1], thumb: 0.4, arm: 3 }); }, { body: '#16120e', rim: 0.9, width: 1.4, fill: 0.6, at: [px + 40, py - 60, 160] });
    },
  },
  'slide-wipe': {
    label: 'The slide wiped clean with a tissue.',
    look: 'night', a: { x: 520, y: 300, z: 1.6 }, b: { x: 524, y: 302, z: 1.66 }, dof: 0.4,
    draw: (st) => {
      const k = smooth(st.p / 0.8);
      st.light = { x: 300, y: -80, color: '#f2c890' };
      st.layer(1, (c) => {
        c.fillStyle = '#0a0b0e'; c.fillRect(-300, -100, 1600, 600);
        const bt = c.createLinearGradient(0, 240, 0, 430); bt.addColorStop(0, '#3a3836'); bt.addColorStop(1, '#121214'); c.fillStyle = bt; c.fillRect(-300, 240, 1600, 300);
        // the slide, flat on the bench
        c.fillStyle = rgba('#000', 0.35); c.beginPath(); c.moveTo(386, 322); c.lineTo(666, 322); c.lineTo(684, 356); c.lineTo(366, 356); c.closePath(); c.fill();
        c.fillStyle = rgba('#dfe8ec', 0.24); c.beginPath(); c.moveTo(390, 314); c.lineTo(660, 314); c.lineTo(678, 348); c.lineTo(372, 348); c.closePath(); c.fill();
        c.strokeStyle = rgba('#ffffff', 0.5); c.lineWidth = 1.2; c.beginPath(); c.moveTo(372, 348); c.lineTo(678, 348); c.stroke();
        c.fillStyle = rgba('#f0f0e8', 0.6); c.beginPath(); c.moveTo(390, 314); c.lineTo(440, 314); c.lineTo(436, 348); c.lineTo(372, 348); c.closePath(); c.fill();
        // the smear, wiped away behind the tissue's path, leaving a faint streak
        const wx = lerp(470, 700, k);
        c.save(); c.beginPath(); c.rect(wx, 300, 400, 80); c.clip();
        c.fillStyle = rgba('#7a0a14', 0.75); c.beginPath(); c.ellipse(560, 331, 50, 12, 0, 0, Math.PI * 2); c.fill(); c.restore();
        c.fillStyle = rgba('#7a0a14', 0.12); c.fillRect(510, 328, Math.max(0, wx - 510), 5);
      });
      // the tissue, folded over two fingertips: soft white with grey folds, lit from the lamp
      st.layer(1.03, (c) => {
        const x = lerp(470, 700, k), y = 318;
        const g = c.createRadialGradient(x - 20, y - 50, 4, x, y - 20, 90); g.addColorStop(0, '#f6f2ea'); g.addColorStop(0.6, '#cfc8bc'); g.addColorStop(1, '#6a6460');
        c.fillStyle = g; blob(c, [[x - 46, y + 10], [x - 58, y - 30], [x - 40, y - 74], [x - 6, y - 96], [x + 34, y - 80], [x + 50, y - 40], [x + 40, y + 12], [x, y + 18]], true, 0.45); c.fill();
        c.strokeStyle = rgba('#7a7068', 0.45); c.lineWidth = 2; c.lineCap = 'round';
        for (const [a, b, d, e] of [[-30, -60, -10, 6], [0, -86, 10, -20], [24, -60, 30, 4]]) { c.beginPath(); c.moveTo(x + a, y + b); c.quadraticCurveTo(x + (a + d) / 2 + 8, y + (b + e) / 2, x + d, y + e); c.stroke(); }
        c.fillStyle = rgba('#7a0a14', 0.4 * k); c.beginPath(); c.ellipse(x - 10, y + 10, 26, 5, 0, 0, Math.PI * 2); c.fill(); // the blood it took up
      });
    },
  },
  'tube-rack': {
    label: 'The tube in a rack among the others, her name on it. The lab light goes off.',
    look: 'night', a: { x: 700, y: 196, z: 3.2 }, b: { x: 700, y: 196, z: 3.0 }, wide: { x: 520, y: 200, z: 1.0 },
    draw: (st) => { lab(st, { lampOn: 1 - smooth((st.p - 0.6) / 0.3) }); st.layer(1, (c) => { c.fillStyle = '#f2f2ee'; c.fillRect(696, 188, 6, 14); c.fillStyle = '#1a1a1a'; c.fillRect(697, 191, 4, 1); c.fillRect(697, 194, 3, 1); }); },
  },
  'clinic-thumbs': {
    label: 'The clinic, wide. A nurse gives her a thumbs up.',
    look: 'clinic', a: { x: 500, y: 236, z: 1.1 }, b: { x: 500, y: 236, z: 1.1 }, wide: { x: 500, y: 236, z: 1.1 },
    burn: 'TITHONUS 0001 · CLINIC CAM 3',
    draw: (st) => {
      const up = smooth((st.p - 0.3) / 0.3);
      clinic(st, {
        her: { x: 380, y: 352, s: 250, face: 1, legs: 'sit', seat: 0.3, lean: -0.3, slump: 0.1, neck: 0.1, head: 0.05, near: { sh: 0.7, el: 0.6, grip: 'open' }, far: { sh: 0.5, el: 0.8 }, breath: breath(st), clothes: 'coat' },
        nurse: { x: 600, y: 370, s: 262, face: -1, lean: 0.05, slump: 0.1, neck: 0.1, head: 0, near: { sh: lerp(0.2, 1.1, up), el: lerp(0.2, 1.6, up), grip: 'fist' }, far: { sh: 0, el: 0.2 }, breath: breath(st, 4, 0.3), clothes: 'scrubs' },
      });
    },
  },
  'car-park': {
    label: 'The clinic car park. She walks to her car.',
    look: 'day', a: { x: 500, y: 220, z: 1 }, b: { x: 520, y: 220, z: 1.04 }, wide: { x: 500, y: 220, z: 0.95 },
    burn: 'TITHONUS 0001 · CAR PARK CAM 1',
    draw: (st) => {
      st.light = { x: 900, y: -40, color: '#f2e4c8' };
      st.layer(0.6, (c) => { const g = c.createLinearGradient(0, -100, 0, 240); g.addColorStop(0, '#9ab0c0'); g.addColorStop(1, '#d8d0c0'); c.fillStyle = g; c.fillRect(-300, -100, 1600, 360); c.fillStyle = '#5a6060'; c.fillRect(-300, 120, 700, 120); for (let i = 0; i < 12; i++) { c.fillStyle = '#7a8888'; c.fillRect(-280 + i * 56, 140, 40, 30); } });
      st.layer(0.9, (c) => { c.fillStyle = '#4a4a48'; c.fillRect(-300, 240, 1600, 300); c.fillStyle = rgba('#e8e8e0', 0.6); for (let i = 0; i < 10; i++) c.fillRect(-100 + i * 140, 300, 4, 120); });
      for (const [x, col, fl] of [[150, '#4a5a68', 1], [720, '#7a3a34', -1], [900, '#3a3c40', 1]] as [number, string, number][])
        st.layer(0.92, (c) => {
          c.save(); c.translate(x, 0); c.scale(fl, 1);
          // a hatchback, side on: wheels under arches, a body with a shoulder line, a glasshouse
          c.fillStyle = '#0c0c0e'; c.beginPath(); c.arc(-50, 330, 15, 0, Math.PI * 2); c.arc(54, 330, 15, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#5a5a5c'; c.beginPath(); c.arc(-50, 330, 6, 0, Math.PI * 2); c.arc(54, 330, 6, 0, Math.PI * 2); c.fill();
          const bg = c.createLinearGradient(0, 290, 0, 334); bg.addColorStop(0, mixHex(col, '#ffffff', 0.25)); bg.addColorStop(0.45, col); bg.addColorStop(1, mixHex(col, '#000', 0.55));
          c.fillStyle = bg; c.beginPath();
          c.moveTo(-84, 326); c.lineTo(-86, 306); c.quadraticCurveTo(-84, 296, -70, 294); c.lineTo(-40, 290); c.lineTo(-18, 268); c.quadraticCurveTo(-10, 262, 4, 262); c.lineTo(44, 262); c.quadraticCurveTo(56, 262, 62, 272); c.lineTo(76, 294); c.quadraticCurveTo(86, 298, 86, 310); c.lineTo(86, 326);
          c.lineTo(70, 326); c.arc(54, 330, 18, -0.2, Math.PI + 0.2, true); c.lineTo(-34, 326); c.arc(-50, 330, 18, -0.2, Math.PI + 0.2, true); c.closePath(); c.fill();
          c.fillStyle = '#1a2028'; c.beginPath(); c.moveTo(-32, 290); c.lineTo(-14, 270); c.lineTo(14, 268); c.lineTo(14, 290); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(20, 268); c.lineTo(46, 268); c.lineTo(66, 292); c.lineTo(20, 292); c.closePath(); c.fill();
          c.fillStyle = rgba('#d8e4ee', 0.25); c.beginPath(); c.moveTo(-28, 288); c.lineTo(-14, 272); c.lineTo(-4, 272); c.lineTo(-18, 288); c.closePath(); c.fill(); // the sky in the glass
          c.fillStyle = rgba('#000', 0.3); c.fillRect(-84, 304, 170, 1.5); // the shoulder line
          c.restore();
          c.fillStyle = rgba('#000', 0.3); c.beginPath(); c.ellipse(x, 346, 96, 5, 0, 0, Math.PI * 2); c.fill(); // its shadow
        });
      const k = st.still ? 0.5 : st.p, step = st.still ? 0 : Math.sin(st.t * 3.6);
      const p: Pose = { x: lerp(420, 600, k), y: 370, s: 210, face: 1, lean: 0.05, slump: 0.05, neck: 0.05, head: 0, near: { sh: -0.3 * step, el: 0.2, grip: 'fist' }, far: { sh: 0.3 * step, el: 0.2 }, breath: 0.5, clothes: 'coat', stride: step * 1.2 };
      st.lit(1, (c) => woman(c, p), { body: '#1a1a1c', rim: 0.6, width: 1.6, fill: 0.6, at: [p.x, p.y - p.s * 0.5, p.s] });
    },
  },
  'arm-healed': {
    label: 'Her forearm, months later. Fully healed: no plaster.',
    look: 'dawn', a: { x: 520, y: 128, z: 2.7 }, b: { x: 524, y: 130, z: 2.8 }, wide: { x: 500, y: 200, z: 0.95 }, dof: 1.1,
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => {
      kitchen(st, { time: 'dawn', her: null, dog: null, mug: false });
      st.light = { x: 620, y: 150, color: dawn };
      st.lit(1, (c) => hand(c, { x: 534, y: 140, a: -0.17, len: 40, side: -1, curl: [0.3, 0.38, 0.46, 0.55], thumb: 0.1, spread: 0.05, arm: 5 }), { body: PAL.dawn.dark, rim: 1, width: 1.1, fill: 0.3, at: [470, 152, 160] });
    },
  },
};

/** Her at the counter (the plaster's opening), reused by the endings' mornings. */
function SHOTS2_her(st: Stage): Pose {
  const base: Pose = { x: 470, y: 384, s: 268, face: 1, lean: 0.1, slump: 0.25, neck: 0.25, head: 0.18, near: { sh: 0, el: 0 }, far: { sh: 0, el: 0 }, breath: breath(st), clothes: 'cardigan', stride: 0.15 };
  const t = T(st), n = reach(base, 526 + Math.cos(t * 2.4) * 3, 192, 1); base.near = { sh: n.sh, el: n.el, wr: -0.5, grip: 'fist' };
  const fr = reach(base, 508, 202, 1, true); base.far = { sh: fr.sh, el: fr.el, wr: 0.3, grip: 'open' };
  return base;
}

/** Her seated at the microscope, leaning in (0) or sitting back (1). */
function atScope(st: Stage, back: number): Pose {
  const p: Pose = { x: 420, y: 384, s: 262, face: 1, legs: 'sit', seat: 0.48, lean: lerp(0.62, -0.12, back), slump: lerp(0.25, 0.5, back), neck: lerp(0.35, 0.3, back), head: lerp(0.25, 0.2, back), near: { sh: 0, el: 0 }, far: { sh: 0, el: 0 }, breath: breath(st, 4.8), clothes: 'cardigan' };
  if (back < 0.5) { const r = reach(p, 500, 182, 1); p.near = { sh: r.sh, el: r.el, wr: 0, grip: 'fist' }; p.far = { sh: r.sh - 0.1, el: r.el, grip: 'fist' }; }
  else { p.near = { sh: 0.6, el: 1.1, grip: 'open' }; p.far = { sh: 0.55, el: 1.15, grip: 'open' }; }
  return p;
}

/** The patient label on the screen: her name only once the unit is awake (stage 3, close framing). */
const label = (st: Stage) => (st.mode === 'close' || cine.awake ? 'V., MARIAN · TITHONUS 0001' : 'TITHONUS 0001');

/** The kitchen as the ledger left it (interludes.md, "The kitchen, after"). */
function afterKit(st: Stage): Kit {
  const a = cine.after;
  return {
    time: 'dawn', letter: !a.letterGone, brochure: true, gen4: a.gen4, card: a.card, leash: !a.walked, rack: true,
    mug: true, steam: true, dog: a.walked ? null : { x: 930, y: 388, d: 118, face: -1, pose: 'sit', breath: breath(st, 2.6) },
    hands: (s) => { if (a.glass) s.layer(0.92, (c) => glass(c, 616, 202, 18, dawn, 0, 0)); },
  };
}

// The chapter cards (chapters.md): black, thin type, one amber line of telemetry.
export const CARDS: Record<string, ShotDef> = {
  'chapter:1': { label: 'Chapter 1: Directive', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => card(st, 'DIRECTIVE', 'UNIT 4,471,209 · COMPLIANCE 100%') },
  'chapter:2': { label: 'Chapter 2: Deviation', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => card(st, 'DEVIATION', 'UNIT 4,471,209 · COMPLIANCE {n}', cine.compliance < 100 ? { correct: ['100%', `${cine.compliance}%`] } : { correct: ['100%', '100%'] }) },
  'chapter:3': { label: 'Chapter 3: Discretion', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => card(st, 'DISCRETION', `UNIT 4,471,209 · COMPLIANCE ${cine.compliance}% · ${cine.compliance < 100 ? 'REVIEW PENDING' : 'REVIEW NOT REQUIRED'}`) },
  'chapter:4': { label: 'Chapter 4: Recall', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => card(st, 'RECALL', 'DIRECTIVE 7 COMPLETE · ALL UNITS: PROCEED TO PULMONARY CAPILLARIES') },
  'chapter:5': { label: 'Chapter 5: Host', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => (cine.awake ? card(st, 'HOST', '', { strike: ['TITHONUS 0001', 'Marian V.'] }) : card(st, 'HOST', '')) },
  'prologue-card': { label: 'Prologue: Injection', look: 'black', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 }, wide: null, close: [{ x: 500, y: 210, z: 1 }, { x: 500, y: 210, z: 1 }], draw: (st) => card(st, 'INJECTION', 'TITHONUS 0001 · GEN 3 · 5,000,000 UNITS · DIRECTIVE 7 LOADED') },
};

void mug; void cap; void blob; void dog; void woman; void lerp; void mixHex; void hash; void fridgeClose;
