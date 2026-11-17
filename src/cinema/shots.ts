// The shots. Each is one camera set-up in one set, with one slow move and one living detail
// (storyboards in /mnt/project-files/creative/storyboards.md). Names are what scenes.ts beats
// put in their `shot` field.
import { Stage, Cam, Look, Mode, lerp, ease, smooth, clamp, rgba, mixHex, hash } from './core';
import { kitchen, fridgeClose, PAL } from './sets';
import { Pose, reach, hand, handLines, woman, cap, blob, dog, headOf } from './rig';
import { mug, paper } from './props';

export interface ShotDef {
  look: Look;
  /** Eye-level camera: from `a` to `b` over the hold. */
  a: Cam; b: Cam;
  /** Footage framing (stages 0 to 1): locked, wide and high. Defaults to a pulled-back `a`. */
  wide?: Cam | null;
  /** Close framing (stage 3 and on). Defaults to pushing in on `focus`. */
  close?: [Cam, Cam];
  focus?: [number, number];
  /** Burned-in caption when shown as footage. */
  burn?: string;
  /** Depth of field (0 none) in eye mode; close mode always has some. */
  dof?: number;
  draw: (st: Stage) => void;
  label: string;
}

const T = (st: Stage) => (st.still ? 0.5 : st.t);
/** The slow rise and fall of breathing, about one breath every 4.5 s (a resting adult). */
const breath = (st: Stage, period = 4.5, phase = 0) => (st.still ? 0.5 : 0.5 + 0.5 * Math.sin((st.t / period + phase) * Math.PI * 2));

// ---------- 1 · The plaster ----------

const herAtCounter = (st: Stage, stir: boolean): Pose => {
  const base: Pose = { x: 470, y: 384, s: 268, face: 1, lean: 0.12, slump: 0.25, neck: 0.25, head: 0.18, near: { sh: 0, el: 0 }, far: { sh: 0, el: 0 }, breath: breath(st), clothes: 'cardigan', stride: 0.15 };
  const t = T(st), cx = 532 + (stir ? Math.cos(t * 2.4) * 3 : 0), cy = 196 + (stir ? Math.sin(t * 2.4) * 1.2 : 0);
  const n = reach(base, cx - 6, cy - 4, 1);
  base.near = { sh: n.sh, el: n.el, wr: -0.5, grip: 'fist' };
  const fr = reach(base, 508, 202, 1, true);
  base.far = { sh: fr.sh, el: fr.el, wr: 0.3, grip: 'open' };
  return base;
};

const SHOTS: Record<string, ShotDef> = {
  'test-rig': {
    label: 'rig test', look: 'dusk', a: { x: 500, y: 210, z: 1 }, b: { x: 500, y: 210, z: 1 },
    draw: (st) => {
      st.light = { x: 1000, y: 0, color: '#f0c48a' };
      st.layer(1, (c) => { c.fillStyle = '#5a4a40'; c.fillRect(0, 0, 1000, 420); });
      for (const [i, pose] of (['sleep', 'chin', 'lie', 'stand', 'sit'] as const).entries())
        st.lit(1, (c) => { dog(c, { x: 30 + i * 200, y: 200 + (i > 2 ? 200 : 0) * 0, d: 110, face: 1, pose, breath: 0.5 }); }, { body: '#111', rim: 1, width: 2, at: [100 + i * 200, 170, 150] });
      st.lit(1, (c) => { woman(c, { x: 150, y: 410, s: 190, face: 1, near: { sh: 0.3, el: 0.6 }, far: { sh: -0.2, el: 0.3 }, clothes: 'cardigan' }); }, { body: '#111', rim: 1, at: [150, 300, 190] });
      st.lit(1, (c) => { woman(c, { x: 400, y: 410, s: 190, face: 1, legs: 'sit', seat: 0.27, lean: -0.1, near: { sh: 0.6, el: 0.9 }, far: { sh: 0.4, el: 1.0 }, clothes: 'gown' }); }, { body: '#111', rim: 1, at: [400, 300, 190] });
      st.lit(1, (c) => { woman(c, { x: 650, y: 410, s: 190, face: 1, view: 'back', near: { sh: 0.1, el: 0.2 }, far: { sh: 0.1, el: 0.2 } }); }, { body: '#111', rim: 1, at: [650, 300, 190] });
      st.lit(1, (c) => { hand(c, { x: 800, y: 330, a: -0.3, len: 120, side: 1, curl: [0.1, 0.2, 0.3, 0.4], thumb: 0.2, arm: 60 }); }, { body: '#4a3026', rim: 1, at: [850, 320, 120] });
    },
  },
  'kitchen-dawn': {
    label: 'Morning in the kitchen. Low sun through the window, dust in the beam. She stands at the counter, stirring her coffee. The old dog asleep in its bed.',
    look: 'dawn', a: { x: 470, y: 210, z: 1.0 }, b: { x: 500, y: 206, z: 1.06 }, wide: { x: 500, y: 200, z: 0.92 },
    close: [{ x: 530, y: 190, z: 2.3 }, { x: 534, y: 188, z: 2.45 }], focus: [530, 190],
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => kitchen(st, { time: 'dawn', her: herAtCounter(st, true), dog: { x: 150, y: 388, d: 118, face: 1, pose: 'sleep', breath: breath(st, 3.4) } }),
  },
  'plaster': {
    label: 'Close, against the window: her forearm in silhouette, a small plaster on it catching the sun. Her fingers scratch at its edge without her noticing. The old dog\'s nose comes up into frame and nudges her elbow.',
    look: 'dawn', a: { x: 520, y: 128, z: 2.7 }, b: { x: 526, y: 130, z: 2.9 }, wide: { x: 500, y: 200, z: 0.95 },
    close: [{ x: 526, y: 132, z: 3.6 }, { x: 530, y: 134, z: 3.85 }], dof: 1.1,
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => {
      const t = T(st), p = st.p, P = PAL.dawn;
      kitchen(st, { time: 'dawn', her: null, dog: null, mug: false });
      st.light = { x: 620, y: 150, color: P.key };
      // her forearm across the window, held a little up: a dark shape with the sun on its upper edge
      const lift = st.still ? 0 : Math.sin(t * 0.5) * 0.6;
      const arm = (c: CanvasRenderingContext2D) => {
        hand(c, { x: 534, y: 140 + lift, a: -0.17, len: 40, side: -1, curl: [0.3, 0.38, 0.46, 0.55], thumb: 0.1, spread: 0.05, arm: 5 });
      };
      st.lit(1, arm, { body: P.dark, rim: 1, width: 1.1, fill: 0.3, cool: P.fill, at: [470, 152, 160] });
      // the plaster: the only lit thing on the arm, its pad and adhesive edges
      st.layer(1, (c) => {
        c.save(); c.translate(484, 147.5 + lift); c.rotate(-0.18);
        c.fillStyle = '#7a5a44'; c.beginPath(); c.roundRect(-11, -3.6, 22, 6, 2.4); c.fill();
        c.fillStyle = '#9a7a60'; c.fillRect(-3.4, -3, 6.8, 4.8);
        c.fillStyle = rgba(P.key, 0.9); c.beginPath(); c.roundRect(-11, -3.9, 22, 1.4, 0.7); c.fill();
        c.restore();
      });
      // her other hand from above: two fingers scratching at the plaster's edge, then still
      const sc = st.still ? 0 : Math.sin(t * 4.2) * 0.5 + 0.5, stop = smooth((p - 0.6) / 0.15);
      const fx = 478 + sc * 4 * (1 - stop), fy = 132 + lift;
      st.lit(1.02, (c) => {
        hand(c, { x: fx - 16, y: fy - 22, a: 1.0, len: 36, side: -1, curl: [0.2 + sc * 0.25 * (1 - stop), 0.3 + sc * 0.15 * (1 - stop), 0.9, 1.0], thumb: 0.7, spread: 0.05, arm: 4.5, cuff: 3.2 });
      }, { body: P.dark, rim: 1, width: 1.1, fill: 0.3, cool: P.fill, at: [460, 90, 120] });
      // the dog's nose rises into frame from below and nudges her elbow
      const nose = smooth((p - 0.55) / 0.2) - smooth((p - 0.82) / 0.18) * 0.3;
      if (nose > 0.001) st.lit(1.06, (c) => {
        // the real dog's head, large and close, tilted up so only the muzzle and brow come into frame
        dog(c, { x: 215, y: lerp(450, 330, nose), d: 200, face: 1, pose: 'stand', head: 0.9 }); void 0;
      }, { body: P.dark, rim: 1, width: 1.2, fill: 0.2, at: [420, 220, 120] });
    },
  },
  'lift': {
    label: 'She lifts the mug toward her. Steam rises past her face, a dark profile against the window.',
    look: 'dawn', a: { x: 520, y: 150, z: 1.55 }, b: { x: 528, y: 120, z: 1.7 }, wide: { x: 500, y: 190, z: 1.0 },
    close: [{ x: 548, y: 112, z: 2.6 }, { x: 552, y: 100, z: 2.9 }], focus: [548, 112],
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => {
      const p = ease(st.p);
      const pose: Pose = { x: 470, y: 384, s: 268, face: 1, lean: 0.05, slump: 0.15, neck: lerp(0.25, -0.05, p), head: lerp(0.18, -0.12, p), near: { sh: 0, el: 0 }, far: { sh: 0, el: 0 }, breath: breath(st), clothes: 'cardigan', stride: 0.15 };
      const mouth = headOf(pose).mouth;
      const mx = lerp(536, mouth[0] + 14, p), my = lerp(200, mouth[1] + 6, p);
      const n = reach(pose, mx - 8, my + 4, 1); pose.near = { sh: n.sh, el: n.el, wr: -0.9, grip: 'fist' };
      const fr = reach(pose, 488, 232, 1, true); pose.far = { sh: fr.sh, el: fr.el, wr: 0.2, grip: 'open' };
      kitchen(st, { time: 'dawn', her: pose, mug: false, dog: null, hands: (s) => {
        s.layer(1, (c) => mug(c, mx, my + 10, 26, 1, { light: PAL.dawn.key, dark: 0.62, tilt: lerp(0, -0.25, p) }));
        s.steam(1, mx, my - 18, 1.1, '#fff4e4', 0.32, 5);
      } });
    },
  },
  'mug-insert': {
    label: 'Close on the chipped mug on the counter, steam rising, the window a blur of gold behind.',
    look: 'dawn', a: { x: 532, y: 188, z: 3.6 }, b: { x: 534, y: 184, z: 3.85 }, wide: { x: 520, y: 196, z: 1.2 }, dof: 1.2,
    burn: 'TITHONUS 0001 · HOME CAM 1',
    draw: (st) => kitchen(st, { time: 'dawn', her: null, dog: null }),
  },
};

export { SHOTS };
export type ShotName = keyof typeof SHOTS;

/** The camera for a shot in a framing mode, `p` through its hold. */
export function shotCam(s: ShotDef, mode: Mode, p: number): Cam {
  const e = ease(p);
  // Footage is a locked camera. For a wide shot that is the wide framing; for an insert it is a
  // camera zoomed in and holding still (pulling an insert out to the room would show it floating).
  if (mode === 'footage') return s.wide && s.wide.z >= s.a.z * 0.7 ? s.wide : { x: s.a.x, y: s.a.y, z: s.a.z * 0.92 };
  if (mode === 'close') {
    const [a, b] = s.close ?? [{ x: s.focus?.[0] ?? s.b.x, y: s.focus?.[1] ?? s.b.y, z: s.b.z * 1.6 }, { x: s.focus?.[0] ?? s.b.x, y: s.focus?.[1] ?? s.b.y, z: s.b.z * 1.72 }];
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: lerp(a.z, b.z, e) };
  }
  return { x: lerp(s.a.x, s.b.x, e), y: lerp(s.a.y, s.b.y, e), z: lerp(s.a.z, s.b.z, e) };
}

void woman; void paper; void fridgeClose; void hash; void handLines;
