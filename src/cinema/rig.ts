// Character rigs for the interludes: Marian, the dog, and her hands up close.
//
// They are posable silhouettes (forward kinematics over a simple skeleton), drawn into a mask
// and rim-lit by the stage, so posture can act: the drop of a shoulder, a hand pressed to her
// side, the dog's flank rising and falling. Faces stay out: Marian is only ever seen in
// profile against light, from behind, or as hands (style guide section 9).

export interface Arm {
  /** Upper arm from straight down, forward positive (radians). */
  sh: number;
  /** Elbow bend, forward positive. */
  el: number;
  /** Wrist bend. */
  wr?: number;
  grip?: 'open' | 'fist' | 'hold' | 'two' | 'flat';
}
export interface Pose {
  /** The floor point under her hips, in world units. */
  x: number; y: number;
  /** Standing height, world units. */
  s: number;
  face: 1 | -1;
  view?: 'side' | 'back';
  /** Torso lean forward from upright, and the slump of the upper back. */
  lean?: number; slump?: number;
  /** Neck and head tilt forward (down) from the torso line. */
  neck?: number; head?: number;
  near: Arm; far: Arm;
  legs?: 'stand' | 'sit' | 'none' | 'lie';
  /** Seat height as a fraction of her height, when sitting. */
  seat?: number;
  /** 0..1: how full of breath she is. */
  breath?: number;
  clothes?: 'cardigan' | 'gown' | 'scrubs' | 'coat';
  /** Which leg is forward when standing (stride), -1..1. */
  stride?: number;
}

type C = CanvasRenderingContext2D;
type P = [number, number];

/** A tapered limb from A to B, round at both ends. */
export function cap(c: C, ax: number, ay: number, bx: number, by: number, ra: number, rb: number) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  c.beginPath();
  c.moveTo(ax + nx * ra, ay + ny * ra); c.lineTo(bx + nx * rb, by + ny * rb);
  c.lineTo(bx - nx * rb, by - ny * rb); c.lineTo(ax - nx * ra, ay - ny * ra); c.closePath(); c.fill();
  c.beginPath(); c.arc(ax, ay, ra, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(bx, by, rb, 0, Math.PI * 2); c.fill();
}

/** A smooth closed shape through points (Catmull-Rom turned into Bézier curves). */
export function blob(c: C, pts: P[], closed = true, tension = 0.5) {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), k = tension / 3;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}

const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];

/**
 * Marian, as a silhouette. Call inside `stage.lit(par, c => woman(c, pose), …)`.
 * Returns the joints, so props (a mug, a letter) can be put in her hands.
 */
export function woman(c: C, o: Pose) {
  const s = o.s, f = o.face, view = o.view ?? 'side';
  const lean = o.lean ?? 0, slump = o.slump ?? 0, br = o.breath ?? 0.5;
  // limb direction: angle from straight down, forward positive
  const down = (a: number): P => [Math.sin(a) * f, Math.cos(a)];
  const up = (a: number): P => [Math.sin(a) * f, -Math.cos(a)];
  const legs = o.legs ?? 'stand';
  const hipH = legs === 'sit' ? (o.seat ?? 0.27) : legs === 'none' ? 0 : 0.52;
  const hip: P = legs === 'lie' ? [o.x, o.y - 0.08 * s] : [o.x, o.y - hipH * s];
  const torsoLen = 0.3 * s;
  const tUp = up(lean), shoulder = add(hip, tUp, torsoLen);
  // the forward normal of the torso
  const nrm: P = [Math.cos(lean) * f, Math.sin(lean)];
  c.strokeStyle = c.fillStyle as string;
  c.lineCap = 'round'; c.lineJoin = 'round';

  // ---- legs (far first) ----
  const thighL = 0.25 * s, shinL = 0.25 * s;
  const leg = (near: boolean) => {
    const st = (o.stride ?? 0) * (near ? 1 : -1);
    let a1: number, a2: number;
    if (legs === 'sit') { a1 = Math.PI / 2 - 0.12 + (near ? 0 : 0.05); a2 = 0.05 + (near ? 0.12 : -0.02); }
    else if (legs === 'lie') { a1 = Math.PI / 2 + 0.1; a2 = Math.PI / 2 + 0.25 + (near ? -0.1 : 0.15); }
    else { a1 = 0.04 + st * 0.18 + (near ? 0.03 : -0.02); a2 = -0.03 + st * 0.05 + (near ? -0.06 : 0.02); }
    const hj = add(hip, nrm, near ? 0.012 * s : -0.006 * s);
    const knee = add(hj, down(a1), thighL), ankle = add(knee, down(a2), shinL);
    const wide = o.clothes === 'gown' ? 1.12 : 1;
    // trousers: a full thigh, then a straight leg that hangs from the knee to a slightly wider hem
    cap(c, hj[0], hj[1], knee[0], knee[1], 0.08 * s * wide, 0.054 * s * wide);
    cap(c, knee[0], knee[1], ankle[0], ankle[1], 0.052 * s * wide, 0.046 * s * wide);
    const kd: P = [ankle[0] - knee[0], ankle[1] - knee[1]], kl = Math.hypot(kd[0], kd[1]) || 1, kn: P = [-kd[1] / kl, kd[0] / kl];
    blob(c, [add(add(ankle, kn, 0.052 * s), kd, -0.08 / kl * s), add(ankle, kn, 0.056 * s), add(add(ankle, kn, -0.05 * s), kd, 0.02 / kl * s), add(add(ankle, kn, -0.048 * s), kd, -0.1 / kl * s)], true, 0.3); c.fill();
    // a flat shoe, toe forward
    const toe = legs === 'lie' ? add(ankle, [0, -1], 0.1 * s) : add(ankle, [f, 0], 0.11 * s);
    blob(c, [[ankle[0] - f * 0.03 * s, ankle[1] - 0.02 * s], [ankle[0] + f * 0.02 * s, ankle[1] - 0.03 * s], [toe[0], toe[1] - 0.012 * s], [toe[0] + f * 0.005 * s, toe[1] + 0.012 * s], [ankle[0] - f * 0.035 * s, ankle[1] + 0.015 * s]]);
    c.fill();
    return { knee, ankle };
  };
  let farLeg = null, nearLeg = null;
  if (legs !== 'none') { farLeg = leg(false); }

  // ---- far arm, behind the body ----
  const shoulderJ = add(add(shoulder, tUp, -0.035 * s), nrm, -0.005 * s);
  const arm = (a: Arm, near: boolean) => {
    const sj = near ? shoulderJ : add(shoulderJ, nrm, 0.01 * s);
    const elbow = add(sj, down(lean + a.sh), 0.17 * s);
    const wrist = add(elbow, down(lean + a.sh + a.el), 0.155 * s);
    const sleeve = o.clothes === 'gown' ? 1.25 : o.clothes === 'scrubs' ? 0.95 : 1.08;
    cap(c, sj[0], sj[1], elbow[0], elbow[1], 0.045 * s * sleeve, 0.036 * s * sleeve);
    cap(c, elbow[0], elbow[1], wrist[0], wrist[1], 0.036 * s * sleeve, 0.026 * s * (sleeve > 1 ? 1.15 : 1));
    if (sleeve > 1) { c.beginPath(); c.arc(...add(wrist, down(lean + a.sh + a.el), -0.012 * s), 0.031 * s, 0, Math.PI * 2); c.fill(); }
    const ha = lean + a.sh + a.el + (a.wr ?? 0), hd = down(ha), hn: P = [-hd[1], hd[0]];
    const grip = a.grip ?? 'open', L = 0.085 * s;
    if (grip === 'fist' || grip === 'hold') {
      blob(c, [add(wrist, hn, 0.022 * s), add(add(wrist, hd, L * 0.75), hn, 0.024 * s), add(wrist, hd, L * 0.95), add(add(wrist, hd, L * 0.75), hn, -0.026 * s), add(wrist, hn, -0.02 * s)]);
      c.fill();
    } else if (grip === 'two') {
      // two fingers extended and pressed, the others folded
      blob(c, [add(wrist, hn, 0.02 * s), add(add(wrist, hd, L * 0.55), hn, 0.022 * s), add(add(wrist, hd, L * 0.55), hn, -0.024 * s), add(wrist, hn, -0.02 * s)]); c.fill();
      cap(c, ...add(add(wrist, hd, L * 0.5), hn, 0.01 * s), ...add(add(wrist, hd, L * 1.15), hn, 0.008 * s), 0.01 * s, 0.008 * s);
      cap(c, ...add(add(wrist, hd, L * 0.5), hn, -0.006 * s), ...add(add(wrist, hd, L * 1.2), hn, -0.006 * s), 0.01 * s, 0.008 * s);
    } else {
      // an open, relaxed hand: palm then fingers together, thumb a little apart
      blob(c, [add(wrist, hn, 0.021 * s), add(add(wrist, hd, L * 0.5), hn, 0.024 * s), add(add(wrist, hd, L * 1.05), hn, 0.012 * s), add(wrist, hd, L * 1.12), add(add(wrist, hd, L * 1.0), hn, -0.012 * s), add(add(wrist, hd, L * 0.5), hn, -0.022 * s), add(wrist, hn, -0.019 * s)]);
      c.fill();
      cap(c, ...add(add(wrist, hd, L * 0.2), hn, 0.02 * f * s), ...add(add(wrist, hd, L * 0.6), hn, 0.04 * f * s), 0.011 * s, 0.008 * s);
    }
    return { elbow, wrist, hand: add(wrist, hd, L * 0.6), dir: hd };
  };
  const farArm = arm(o.far, false);

  // ---- torso ----
  if (view === 'side') {
    const F = [0.074, 0.07, 0.062, 0.066, 0.084 + br * 0.008, 0.072, 0.042];
    const B = [0.095, 0.082, 0.062, 0.058, 0.066, 0.072 + slump * 0.03, 0.05];
    const fs = [0, 0.15, 0.35, 0.55, 0.72, 0.86, 1];
    const loose = o.clothes === 'cardigan' || o.clothes === 'gown' ? 1.06 : 1;
    const mid = add(add(hip, tUp, torsoLen * 0.55), nrm, -slump * 0.05 * s);
    const spine = (t: number): P => { // quadratic through the slumped middle
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t;
      const ctl = add(mid, add(hip, shoulder, -1), 0); // placeholder for type
      void ctl;
      const cx = 2 * mid[0] - (hip[0] + shoulder[0]) / 2, cy = 2 * mid[1] - (hip[1] + shoulder[1]) / 2;
      return [a * hip[0] + b * cx + cc * shoulder[0], a * hip[1] + b * cy + cc * shoulder[1]];
    };
    const front: P[] = [], back: P[] = [];
    fs.forEach((t, i) => {
      const p = spine(t), q = spine(Math.min(1, t + 0.02)), r = spine(Math.max(0, t - 0.02));
      const tx = q[0] - r[0], ty = q[1] - r[1], d = Math.hypot(tx, ty) || 1;
      // normal pointing forward: rotate the up-tangent toward the face
      const nx = (-ty / d) * f, ny = (tx / d) * f;
      front.push([p[0] + nx * F[i] * s * loose, p[1] + ny * F[i] * s * loose]);
      back.push([p[0] - nx * B[i] * s * loose, p[1] - ny * B[i] * s * loose]);
    });
    const top = add(shoulder, tUp, 0.012 * s);
    const hem = o.clothes === 'gown' ? 0.3 : o.clothes === 'coat' ? 0.2 : o.clothes === 'cardigan' ? 0.15 : 0.03;
    const below = (p: P, k: number): P => add(p, tUp, -k * s);
    blob(c, [
      add(below(back[0], hem), nrm, -0.012 * s), back[0], back[1], back[2], back[3], back[4], back[5], back[6], top,
      front[6], front[5], front[4], front[3], front[2], add(front[1], nrm, hem > 0.1 ? 0.01 * s : 0), add(front[0], nrm, hem > 0.1 ? 0.014 * s : 0), add(below(front[0], hem), nrm, hem > 0.1 ? 0.02 * s : 0),
    ], true, 0.45);
    c.fill();
  } else {
    // from behind: shoulders, a waist, hips, symmetrical about the spine
    const half = [0.1, 0.094, 0.076, 0.08, 0.098, 0.118 - slump * 0.01, 0.084];
    const fs = [0, 0.15, 0.35, 0.55, 0.72, 0.88, 1];
    const side: P = [1, 0];
    const L: P[] = [], R: P[] = [];
    fs.forEach((t, i) => {
      const p = add(hip, tUp, torsoLen * t - (i === 6 ? 0 : 0));
      L.push(add(p, side, -half[i] * s)); R.push(add(p, side, half[i] * s));
    });
    const hem = o.clothes === 'gown' ? 0.3 : o.clothes === 'cardigan' ? 0.08 : 0.03;
    const top = add(shoulder, tUp, 0.01 * s);
    blob(c, [add(L[0], tUp, -hem * s), ...L, add(top, side, -0.04 * s), add(top, side, 0.04 * s), ...R.reverse(), add(R[R.length - 1], tUp, -hem * s)], true, 0.4);
    c.fill();
  }

  // ---- near leg ----
  if (legs !== 'none') nearLeg = leg(true);

  // ---- neck and head ----
  const neckA = lean + (o.neck ?? 0), headA = neckA + (o.head ?? 0);
  const neckBase = add(shoulder, nrm, view === 'side' ? 0.012 * s : 0), neckTop = add(neckBase, up(neckA), 0.06 * s);
  cap(c, neckBase[0], neckBase[1], neckTop[0], neckTop[1], 0.036 * s, 0.03 * s);
  const hu = 0.14 * s; // head height
  const hc = add(add(neckTop, up(headA), hu * 0.42), view === 'side' ? [Math.cos(headA) * f, Math.sin(headA)] : [0, 0], 0.012 * s);
  c.save(); c.translate(hc[0], hc[1]); c.rotate(headA * f); c.scale(f * hu, hu);
  if (view === 'side') {
    // A profile, simplified: forehead, nose, lips and chin read only as an edge against the light.
    blob(c, [
      [-0.16, 0.5], [-0.4, 0.14], [-0.38, -0.25], [-0.12, -0.5], [0.14, -0.5], [0.33, -0.3], [0.37, -0.11],
      [0.36, -0.02], [0.45, 0.11], [0.37, 0.15], [0.385, 0.22], [0.355, 0.26], [0.37, 0.3], [0.32, 0.36], [0.3, 0.45], [0.12, 0.5], [0.06, 0.6],
    ], true, 0.35);
    c.fill();
    // hair, gathered back into a low bun, a few loose strands
    blob(c, [[0.31, -0.34], [0.2, -0.52], [0.0, -0.58], [-0.24, -0.55], [-0.46, -0.3], [-0.52, 0.06], [-0.34, 0.36], [-0.18, 0.2], [-0.08, -0.12], [0.16, -0.28]], true, 0.4); c.fill();
    c.beginPath(); c.ellipse(-0.48, 0.02, 0.2, 0.18, 0.4, 0, Math.PI * 2); c.fill();
    c.lineWidth = 0.018;
    c.beginPath(); c.moveTo(-0.55, 0.12); c.quadraticCurveTo(-0.62, 0.32, -0.52, 0.42); c.stroke();
    c.beginPath(); c.moveTo(0.26, -0.33); c.quadraticCurveTo(0.33, -0.12, 0.27, 0.0); c.stroke();
  } else {
    c.beginPath(); c.ellipse(0, 0, 0.36, 0.48, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-0.37, 0.06, 0.06, 0.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0.37, 0.06, 0.06, 0.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, 0.06, 0.2, 0.17, 0, 0, Math.PI * 2); c.fill(); // the bun
    c.lineWidth = 0.018;
    c.beginPath(); c.moveTo(0.15, 0.3); c.quadraticCurveTo(0.24, 0.48, 0.18, 0.62); c.stroke();
  }
  c.restore();

  // ---- near arm, in front ----
  const nearArm = arm(o.near, true);
  return { hip, shoulder, head: hc, near: nearArm, far: farArm, nearLeg, farLeg };
}

export interface DogPose {
  x: number; y: number;
  /** Body length from rump to chest, world units. */
  d: number;
  face: 1 | -1;
  pose: 'lie' | 'sleep' | 'stand' | 'sit' | 'chin';
  /** 0..1 breath, and the head's lift (-1 resting down .. 1 up and alert). */
  breath?: number; head?: number;
  /** The tail's slow wag, -1..1. */
  wag?: number;
}
/**
 * The old dog: a grey-muzzled mutt with some shepherd in it, one ear folded. Drawn from a
 * hand-shaped outline (deep chest, tucked waist, jointed legs) rather than primitives, so it
 * reads as a real animal in silhouette. Returns a painter for its grey muzzle.
 */
export function dog(c: C, o: DogPose) {
  const d = o.d, f = o.face, b = o.breath ?? 0.5;
  const fl = (b - 0.5) * 0.035; // the flank rising and falling
  const X = (u: number) => o.x + u * d * f, Y = (v: number) => o.y + v * d;
  const pt = (u: number, v: number): P => [X(u), Y(v)];
  const path = (pts: [number, number][], t = 0.5) => { blob(c, pts.map(([u, v]) => pt(u, v)), true, t); c.fill(); };
  c.strokeStyle = c.fillStyle as string; c.lineCap = 'round'; c.lineJoin = 'round';
  const wag = o.wag ?? 0;
  let head: { x: number; y: number; a: number; rest: boolean };
  if (o.pose === 'stand' || o.pose === 'sit') {
    const sit = o.pose === 'sit';
    // far legs, a touch behind
    path([[0.84, -0.38], [0.9, -0.36], [0.92, -0.08], [0.98, -0.01], [1.0, 0], [0.89, 0], [0.86, -0.08], [0.82, -0.34]]);
    if (!sit) path([[0.3, -0.42], [0.36, -0.3], [0.26, -0.16], [0.26, 0], [0.18, 0], [0.16, -0.14], [0.1, -0.2], [0.14, -0.4]]);
    // tail, low and a little curled
    c.lineWidth = 0.06 * d; c.beginPath(); c.moveTo(X(0.02), Y(sit ? -0.3 : -0.6));
    c.quadraticCurveTo(X(-0.14 + wag * 0.03), Y(sit ? -0.1 : -0.5), X(-0.12 + wag * 0.08), Y(sit ? 0 : -0.22)); c.stroke();
    // body and near legs in one outline
    const by = sit ? 0.16 : 0;
    path([
      [0.0, -0.6 + by], [0.06, -0.66 + by - fl * 0.5], [0.36, -0.63 + by * 0.8 - fl], [0.7, -0.69 - fl], [0.84, -0.74],
      [0.96, -0.66], [1.0, -0.56], [0.97, -0.44 + fl * 0.5],
      [0.93, -0.38], [0.95, -0.1], [1.01, -0.02], [1.02, 0], [0.88, 0], [0.86, -0.06], [0.84, -0.33],
      [0.66, -0.37 - fl], [0.48, -0.41 + by * 0.4],
      ...(sit
        ? [[0.3, -0.22], [0.4, -0.04], [0.42, 0], [0.12, 0], [0.0, -0.1], [-0.04, -0.3]] as [number, number][]
        : [[0.33, -0.4], [0.32, -0.3], [0.22, -0.16], [0.24, -0.02], [0.25, 0], [0.13, 0], [0.12, -0.15], [0.06, -0.24], [-0.03, -0.44]] as [number, number][]),
    ], 0.42);
    head = { x: 0.9, y: -0.82 - (o.head ?? 0.4) * 0.06, a: -(o.head ?? 0.4) * 0.12, rest: false };
    // neck
    path([[0.78, -0.72], [0.86, -0.88 - (o.head ?? 0.4) * 0.05], [0.98, -0.86], [1.0, -0.62], [0.9, -0.56]], 0.5);
  } else {
    const rest = o.pose === 'sleep' || o.pose === 'chin' || (o.head ?? 0) < 0;
    // the tail wrapped forward along the floor
    c.lineWidth = 0.055 * d; c.beginPath(); c.moveTo(X(0.0), Y(-0.12));
    c.quadraticCurveTo(X(-0.12), Y(-0.02), X(0.12 + wag * 0.02), Y(-0.025)); c.quadraticCurveTo(X(0.28), Y(-0.03), X(0.36), Y(-0.04)); c.stroke();
    // far foreleg
    path([[0.9, -0.1], [1.4, -0.08], [1.44, -0.03], [1.38, 0], [0.92, -0.02]]);
    // body: the round haunch, the back, the chest down on the floor
    path([
      [-0.04, -0.12], [-0.01, -0.28 - fl * 0.3], [0.12, -0.38 - fl * 0.6], [0.34, -0.36 - fl], [0.62, -0.38 - fl], [0.84, -0.44 - fl * 0.6],
      [0.98, -0.36], [1.03, -0.2], [1.0, -0.08], [1.46, -0.07], [1.5, -0.02], [1.44, 0.0],
      [0.62, 0.0], [0.46, -0.02], [0.4, -0.02], [0.18, 0.0], [0.04, -0.02],
    ], 0.45);
    // the hind paw tucked forward under the haunch, the line of the thigh
    path([[0.16, -0.06], [0.44, -0.07], [0.48, -0.02], [0.42, 0.0], [0.16, 0.0]]);
    const up = o.head ?? (rest ? -1 : 0.5);
    if (rest) head = { x: 1.2, y: -0.15, a: 0.06, rest: true };
    else head = { x: 1.04, y: -0.6 - up * 0.06, a: -up * 0.1, rest: false };
    // neck from the withers to the head
    if (rest) path([[0.8, -0.44 - fl * 0.6], [1.0, -0.34], [1.18, -0.24], [1.24, -0.07], [1.0, -0.06]]);
    else path([[0.8, -0.44], [0.94, -0.62 - up * 0.05], [1.08, -0.62 - up * 0.05], [1.06, -0.3], [0.96, -0.2]]);
  }
  // the head: a long muzzle, a soft stop, the skull; ears relaxed when resting
  const drawHead = (g: C, muzzleOnly: boolean) => {
    g.save(); g.translate(X(head.x), Y(head.y)); g.scale(f * d, d); g.rotate(head.a);
    if (!muzzleOnly) {
      blob(g, [[-0.12, -0.02], [-0.06, -0.12], [0.06, -0.13], [0.15, -0.09], [0.2, -0.06], [0.34, -0.035], [0.37, 0.0], [0.34, 0.03], [0.22, 0.06], [0.08, 0.08], [-0.06, 0.08]], true, 0.45);
      g.fill();
      if (head.rest) {
        // ears lying back
        blob(g, [[-0.04, -0.1], [-0.2, -0.13], [-0.16, -0.06]], true, 0.4); g.fill();
      } else {
        // one ear up and soft at the tip, one folded over
        blob(g, [[-0.07, -0.08], [-0.06, -0.24], [-0.02, -0.25], [0.03, -0.1]], true, 0.35); g.fill();
        blob(g, [[0.0, -0.11], [0.07, -0.18], [0.12, -0.13], [0.1, -0.07]], true, 0.4); g.fill();
      }
    } else {
      blob(g, [[0.15, -0.075], [0.34, -0.035], [0.37, 0.0], [0.34, 0.03], [0.22, 0.06], [0.12, 0.05], [0.1, -0.02]], true, 0.45); g.fill();
      // and the grey around the eye that old dogs get
      g.beginPath(); g.ellipse(0.06, -0.05, 0.04, 0.025, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
  drawHead(c, false);
  return (g: C) => drawHead(g, true);
}

export interface HandPose {
  /** Wrist position and the direction the fingers point (radians, 0 = +x). */
  x: number; y: number; a: number;
  /** Hand length, wrist to fingertip. */
  len: number;
  /** Which way the thumb side faces: 1 down the screen, -1 up. */
  side: 1 | -1;
  /** Curl per finger (index..little), 0 straight to 1 a fist; and the thumb's. */
  curl: [number, number, number, number]; thumb: number;
  /** Spread of the fingers, 0..1. */
  spread?: number;
  /** Forearm length behind the wrist, drawn back the other way. Sleeve cuff if `cuff`. */
  arm?: number; cuff?: number;
}
/** A hand seen from the back, close: palm, four jointed fingers held loosely together, the thumb. */
export function hand(c: C, o: HandPose) {
  const L = o.len, ca = Math.cos(o.a), sa = Math.sin(o.a), sd = o.side;
  const T = (u: number, v: number): P => [o.x + (u * ca - v * sa * sd) * L, o.y + (u * sa + v * ca * sd) * L];
  c.strokeStyle = c.fillStyle as string;
  if (o.arm) {
    // the forearm, tapering to the wrist, with the soft swell of the muscle near the elbow
    blob(c, [T(-o.arm, -0.36), T(-o.arm * 0.6, -0.34), T(-0.15, -0.22), T(0.04, -0.2), T(0.04, 0.2), T(-0.15, 0.24), T(-o.arm * 0.55, 0.32), T(-o.arm, 0.3)], true, 0.4); c.fill();
    if (o.cuff) { blob(c, [T(-o.arm, -0.42), T(-o.cuff, -0.4), T(-o.cuff + 0.04, 0), T(-o.cuff, 0.38), T(-o.arm, 0.4)], true, 0.4); c.fill(); }
  }
  // the back of the hand: wide at the knuckles, narrowing to the wrist
  blob(c, [T(0, -0.2), T(0.22, -0.25), T(0.5, -0.24), T(0.58, -0.1), T(0.58, 0.1), T(0.5, 0.22), T(0.2, 0.26), T(0, 0.2)], true, 0.5);
  c.fill();
  const lens = [0.44, 0.5, 0.46, 0.36], base = [-0.17, -0.06, 0.05, 0.155], sp = o.spread ?? 0.1;
  const tips: P[] = [];
  for (let i = 0; i < 4; i++) {
    let p = T(0.52 - (i === 3 ? 0.05 : i === 0 ? 0.01 : 0), base[i]);
    let ang = o.a + (i - 1.5) * 0.07 * sp * sd;
    const segs = [0.46, 0.3, 0.24], w = [0.064, 0.066, 0.062, 0.054];
    for (let k = 0; k < 3; k++) {
      ang += o.curl[i] * [0.5, 0.95, 0.75][k] * sd;
      const q: P = [p[0] + Math.cos(ang) * lens[i] * segs[k] * L, p[1] + Math.sin(ang) * lens[i] * segs[k] * L];
      cap(c, p[0], p[1], q[0], q[1], w[i] * L * (1 - k * 0.06), w[i] * L * (0.9 - k * 0.1));
      p = q;
    }
    tips.push(p);
  }
  // thumb: a thick first joint from the heel of the hand, then the tip
  let tp = T(0.14, 0.2), ta = o.a + 0.75 * sd;
  for (let k = 0; k < 2; k++) {
    ta += o.thumb * 0.6 * sd;
    const q: P = [tp[0] + Math.cos(ta) * (k ? 0.17 : 0.22) * L, tp[1] + Math.sin(ta) * (k ? 0.17 : 0.22) * L];
    cap(c, tp[0], tp[1], q[0], q[1], (k ? 0.068 : 0.09) * L, (k ? 0.056 : 0.075) * L);
    tp = q;
  }
  return { tips, thumb: tp, knuckle: T(0.5, 0) };
}
/** The darker lines between fingers and across knuckles, painted over a lit hand so it reads up close. */
export function handLines(c: C, o: HandPose, color: string) {
  const L = o.len, ca = Math.cos(o.a), sa = Math.sin(o.a), sd = o.side;
  const T = (u: number, v: number): P => [o.x + (u * ca - v * sa * sd) * L, o.y + (u * sa + v * ca * sd) * L];
  c.save(); c.strokeStyle = color; c.lineWidth = 0.012 * L; c.lineCap = 'round';
  for (const v of [-0.105, 0.005, 0.11]) {
    const a = T(0.5, v), b = T(0.62 - Math.abs(v) * 0.2, v);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  // tendons on the back of the hand: faint
  c.globalAlpha = 0.5;
  for (const v of [-0.12, -0.03, 0.06]) { const a = T(0.08, v * 0.6), b = T(0.46, v); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.restore();
}

/** Where her near shoulder joint is for a pose, so a reach can be solved before drawing. */
export function shoulderOf(o: Pose): [number, number] {
  const s = o.s, f = o.face, lean = o.lean ?? 0, legs = o.legs ?? 'stand';
  const hipH = legs === 'sit' ? (o.seat ?? 0.27) : legs === 'none' ? 0 : 0.52;
  const hip: [number, number] = legs === 'lie' ? [o.x, o.y - 0.08 * s] : [o.x, o.y - hipH * s];
  const tUp: [number, number] = [Math.sin(lean) * f, -Math.cos(lean)], nrm: [number, number] = [Math.cos(lean) * f, Math.sin(lean)];
  const sh: [number, number] = [hip[0] + tUp[0] * 0.3 * s, hip[1] + tUp[1] * 0.3 * s];
  return [sh[0] - tUp[0] * 0.035 * s - nrm[0] * 0.005 * s, sh[1] - tUp[1] * 0.035 * s - nrm[1] * 0.005 * s];
}
/**
 * Two-bone reach: the arm angles (relative to her lean) that put her wrist at (tx, ty).
 * `bend` 1 bends the elbow down and back, the natural way; -1 the other way.
 */
export function reach(o: Pose, tx: number, ty: number, bend: 1 | -1 = 1, far = false): { sh: number; el: number } {
  const [sx0, sy0] = shoulderOf(o), lean = o.lean ?? 0, f = o.face;
  const nrm: [number, number] = [Math.cos(lean) * f, Math.sin(lean)];
  const sx = sx0 + (far ? nrm[0] * 0.01 * o.s : 0), sy = sy0 + (far ? nrm[1] * 0.01 * o.s : 0);
  const l1 = 0.17 * o.s, l2 = 0.155 * o.s;
  let dx = tx - sx, dy = ty - sy; const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const a = Math.atan2(dx * f, dy); // angle from straight down, forward positive
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const cosB = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), B = Math.acos(Math.max(-1, Math.min(1, cosB)));
  const sh = a - bend * A, el = bend * (Math.PI - B);
  void dx; void dy;
  return { sh: sh - lean, el };
}

/** Where her head's centre is for a pose, and the head height, to aim a hand (a mug to her lips). */
export function headOf(o: Pose): { x: number; y: number; hu: number; mouth: [number, number] } {
  const s = o.s, f = o.face, lean = o.lean ?? 0, legs = o.legs ?? 'stand';
  const hipH = legs === 'sit' ? (o.seat ?? 0.27) : legs === 'none' ? 0 : 0.52;
  const hip: [number, number] = legs === 'lie' ? [o.x, o.y - 0.08 * s] : [o.x, o.y - hipH * s];
  const up = (a: number): [number, number] => [Math.sin(a) * f, -Math.cos(a)];
  const tUp = up(lean), nrm: [number, number] = [Math.cos(lean) * f, Math.sin(lean)];
  const sh: [number, number] = [hip[0] + tUp[0] * 0.3 * s, hip[1] + tUp[1] * 0.3 * s];
  const view = o.view ?? 'side';
  const nb: [number, number] = [sh[0] + nrm[0] * (view === 'side' ? 0.012 * s : 0), sh[1] + nrm[1] * (view === 'side' ? 0.012 * s : 0)];
  const neckA = lean + (o.neck ?? 0), headA = neckA + (o.head ?? 0), nu = up(neckA), hu2 = up(headA);
  const nt: [number, number] = [nb[0] + nu[0] * 0.06 * s, nb[1] + nu[1] * 0.06 * s];
  const hu = 0.14 * s;
  const hx = nt[0] + hu2[0] * hu * 0.42 + (view === 'side' ? Math.cos(headA) * f * 0.012 * s : 0), hy = nt[1] + hu2[1] * hu * 0.42 + (view === 'side' ? Math.sin(headA) * 0.012 * s : 0);
  // the mouth in the head's own frame is at (0.36, 0.26) head-heights
  const ca = Math.cos(headA * f), sa = Math.sin(headA * f);
  const mx = hx + (0.36 * f * ca - 0.26 * sa) * hu, my = hy + (0.36 * f * sa + 0.26 * ca) * hu;
  return { x: hx, y: hy, hu, mouth: [mx, my] };
}
