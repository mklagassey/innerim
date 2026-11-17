// The sets: her kitchen, the clinic, the sitting room, the bedroom, the consulting room, the lab.
// Each set draws its depth layers into a Stage; shots choose the camera, the time of day and
// what is in frame. Everything is in world units (core.W x core.H).
import { Stage, rgba, mixHex, hash, W } from './core';
import { woman, dog, Pose, DogPose, blob, cap } from './rig';
import { mug, paper, brochure, magnet, leash, patch, floor, glass } from './props';

export type Time = 'dawn' | 'day' | 'night' | 'dusk';
type C = CanvasRenderingContext2D;

export interface Kit {
  time: Time;
  /** What is on the fridge, and in the room: the ledger shows here (interludes.md, ending table). */
  letter?: boolean; brochure?: boolean; gen4?: boolean; card?: boolean;
  leash?: boolean; rack?: boolean; bottle?: 'none' | 'shelf' | 'dusty';
  mug?: boolean; steam?: boolean; pills?: boolean; kettle?: boolean;
  dog?: DogPose | null; her?: Pose | null; herDark?: string;
  /** Drawn after her: the prop in her hand and so on. */
  hands?: (st: Stage) => void;
  /** Leash sway (the dog nudging it). */
  sway?: number;
  /** A note added to the fridge (the echo variants): her GP's handwriting, or a line printed from the trial portal. */
  note?: 'lfts' | 'reserve';
  /** The fridge door open (0..1): its cold light falls on her. */
  open?: number;
  /** A tub of antacids on the counter. */
  tub?: boolean;
}

const PAL = {
  dawn: { key: '#f6c88c', sky0: '#ffd9a0', sky1: '#9aa4bc', wall: '#3a2a22', wallLit: '#9a6a46', dark: '#050303', floor: '#4a3424', cab: '#2a1f19', fill: '#5a6a8a' },
  day: { key: '#f4e2c2', sky0: '#e8eef0', sky1: '#a8c0d0', wall: '#4a3a30', wallLit: '#7a6250', dark: '#16100e', floor: '#5a4230', cab: '#3a2c24', fill: '#7a8aa0' },
  dusk: { key: '#e88e52', sky0: '#e87a4a', sky1: '#4a3050', wall: '#2e1e1a', wallLit: '#5a3424', dark: '#0e0808', floor: '#3a261c', cab: '#24181a', fill: '#4a4466' },
  night: { key: '#eab06a', sky0: '#141a34', sky1: '#070912', wall: '#1c1418', wallLit: '#4a3226', dark: '#070506', floor: '#22180f', cab: '#140e10', fill: '#2a3458' },
};

/**
 * Her kitchen, seen side on. Counter and window centre left, fridge right, the door with the
 * leash hook at the far right, the dog's bed on the floor at the left. At dawn the sun comes in
 * low through the window; at night the only light is the small one over the stove.
 */
export function kitchen(st: Stage, k: Kit) {
  const P = PAL[k.time], night = k.time === 'night';
  const sun = night ? null : { x: 640, y: 120 };
  st.light = night ? { x: 300, y: 92, color: P.key } : { x: 700, y: 110, color: P.key };
  // ---- outside the window (furthest) ----
  st.layer(0.55, (c) => {
    const g = c.createLinearGradient(0, 40, 0, 200);
    g.addColorStop(0, P.sky1); g.addColorStop(1, P.sky0);
    c.fillStyle = g; c.fillRect(380, 30, 300, 180);
    if (!night) {
      // the low sun, bloomed, and rooftops and a tree across the road
      const s = c.createRadialGradient(600, 170, 0, 600, 170, 120);
      s.addColorStop(0, rgba('#fff4dc', 0.95)); s.addColorStop(0.2, rgba(P.key, 0.6)); s.addColorStop(1, rgba(P.key, 0));
      c.fillStyle = s; c.fillRect(380, 30, 300, 180);
    } else {
      // a streetlight far off, and windows of other houses
      c.fillStyle = rgba('#e8a050', 0.5); c.beginPath(); c.arc(640, 140, 2.5, 0, Math.PI * 2); c.fill();
      const s = c.createRadialGradient(640, 140, 0, 640, 140, 40); s.addColorStop(0, rgba('#e8a050', 0.25)); s.addColorStop(1, rgba('#e8a050', 0)); c.fillStyle = s; c.fillRect(580, 90, 120, 100);
    }
    c.fillStyle = night ? '#05060c' : mixHex(P.sky1, '#1a1418', 0.55);
    c.beginPath(); c.moveTo(380, 190); c.lineTo(420, 172); c.lineTo(450, 182); c.lineTo(470, 160); c.lineTo(520, 160); c.lineTo(540, 176); c.lineTo(680, 176); c.lineTo(680, 210); c.lineTo(380, 210); c.fill();
    // across the road: a chimney, a bare young tree, a fence line
    c.fillRect(498, 146, 10, 16);
    c.strokeStyle = c.fillStyle as string; c.lineCap = 'round';
    const br = (x: number, y: number, a: number, l: number, w: number, n: number) => {
      if (n <= 0 || l < 3) return;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      br(x2, y2, a - 0.42 - hash(n + x) * 0.2, l * 0.74, w * 0.68, n - 1); br(x2, y2, a + 0.38 + hash(n + y) * 0.2, l * 0.7, w * 0.68, n - 1);
    };
    br(462, 182, -Math.PI / 2, 22, 3.2, 6);
    c.fillRect(380, 186, 300, 3); for (let x = 384; x < 680; x += 9) c.fillRect(x, 180, 2, 9);
    if (night) { c.fillStyle = rgba('#e8b060', 0.55); c.fillRect(436, 180, 5, 4); c.fillRect(556, 184, 4, 4); }
  }, 1.5);
  // ---- back wall, cabinets, window frame, fridge, door ----
  st.layer(0.85, (c) => {
    // the wall, with the window cut out of it (even-odd), so the sky shows through
    c.fillStyle = P.wall; c.beginPath(); c.rect(-300, -100, 1600, 440); c.rect(430, 50, 180, 130); c.fill('evenodd');
    // light falls off across the wall away from the window; corners and the ceiling line go dark
    if (!night) {
      const wl = c.createRadialGradient(520, 120, 20, 520, 140, 520);
      wl.addColorStop(0, rgba(P.wallLit, 0.75)); wl.addColorStop(0.35, rgba(P.wallLit, 0.25)); wl.addColorStop(1, rgba(P.wallLit, 0));
      c.fillStyle = wl; c.beginPath(); c.rect(-300, -100, 1600, 440); c.rect(430, 50, 180, 130); c.fill('evenodd');
    }
    const ao = c.createLinearGradient(0, -100, 0, 60); ao.addColorStop(0, rgba('#000', 0.6)); ao.addColorStop(1, rgba('#000', 0));
    c.fillStyle = ao; c.fillRect(-300, -100, 1600, 160);
    c.fillStyle = mixHex(P.wall, '#000', 0.3); c.fillRect(424, 44, 192, 6); c.fillRect(424, 180, 192, 8);
    c.fillStyle = mixHex(P.wall, '#000', 0.55); c.fillRect(426, 50, 6, 130); c.fillRect(604, 50, 8, 130); c.fillRect(516, 50, 5, 130); c.fillRect(426, 112, 186, 4);
    // a plant on the sill, in silhouette
    c.fillStyle = P.dark; c.fillRect(440, 166, 22, 16);
    for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(451 + Math.cos(i * 0.9) * 12, 154 - i * 3, 9, 4, i * 0.6 - 0.4, 0, Math.PI * 2); c.fill(); }
    // upper cabinets
    c.fillStyle = P.cab; c.fillRect(60, 30, 340, 96);
    c.strokeStyle = rgba('#000', 0.35); c.lineWidth = 2; for (let x = 60; x <= 400; x += 85) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, 126); c.stroke(); }
    c.fillStyle = rgba(P.key, night ? 0.1 : 0.06); c.fillRect(60, 122, 340, 4);
    // the stove hood and its small light, the only light at night
    c.fillStyle = mixHex(P.cab, '#000', 0.2); c.beginPath(); c.moveTo(250, 30); c.lineTo(350, 30); c.lineTo(362, 86); c.lineTo(238, 86); c.closePath(); c.fill();
    c.fillStyle = night ? '#ffd9a0' : mixHex(P.cab, '#000', 0.3); c.fillRect(276, 84, 48, 4);
    // tiles above the counter: faint grid
    c.strokeStyle = rgba('#000', 0.18); c.lineWidth = 1;
    for (let y = 140; y < 210; y += 14) { c.beginPath(); c.moveTo(60, y); c.lineTo(424, y); c.stroke(); }
    for (let x = 60; x < 424; x += 20) { c.beginPath(); c.moveTo(x, 130); c.lineTo(x, 208); c.stroke(); }
    // the fridge
    const fg = c.createLinearGradient(690, 0, 830, 0);
    fg.addColorStop(0, mixHex('#c8c0b4', P.dark, night ? 0.8 : 0.58)); fg.addColorStop(0.6, mixHex('#d8d0c4', P.dark, night ? 0.74 : 0.7)); fg.addColorStop(1, mixHex('#a8a094', P.dark, night ? 0.9 : 0.86));
    c.fillStyle = fg; c.beginPath(); c.roundRect(690, 64, 140, 270, 8); c.fill();
    c.fillStyle = rgba('#000', 0.35); c.fillRect(690, 150, 140, 2); c.fillRect(816, 90, 4, 40); c.fillRect(816, 170, 4, 60);
    // what is on the fridge
    fridgeFront(c, k, night ? 0.7 : 0.55, P.key, false);
    if ((k.open ?? 0) > 0) {
      // open: the inside lit cold white, shelves and jars; the door swung toward us on its right hinge
      const o = k.open!;
      const ig = c.createLinearGradient(0, 68, 0, 330); ig.addColorStop(0, '#f2f8ff'); ig.addColorStop(1, '#a8b8c8');
      c.globalAlpha = o; c.fillStyle = ig; c.fillRect(696, 70, 128, 258);
      c.fillStyle = rgba('#5a6a7a', 0.6); for (const y of [130, 190, 250]) c.fillRect(696, y, 128, 3);
      for (let i = 0; i < 9; i++) { c.fillStyle = mixHex('#c87a4a', '#4a7a5a', hash(i)); c.fillRect(704 + (i % 3) * 40 + hash(i + 2) * 10, [108, 168, 228][Math.floor(i / 3)] - hash(i + 4) * 10, 16 + hash(i) * 8, 22 + hash(i + 1) * 10); }
      c.globalAlpha = 1;
      const dx = 64 * o;
      c.fillStyle = mixHex('#c8c0b4', P.dark, night ? 0.8 : 0.5); c.beginPath(); c.moveTo(830, 64); c.lineTo(830 + dx, 52); c.lineTo(830 + dx, 346); c.lineTo(830, 334); c.closePath(); c.fill();
      c.fillStyle = rgba('#e8f0f8', 0.35 * o); c.beginPath(); c.moveTo(832, 70); c.lineTo(830 + dx * 0.9, 62); c.lineTo(830 + dx * 0.9, 336); c.lineTo(832, 328); c.closePath(); c.fill();
    }
    // the door to the hall and the leash hook beside it
    c.fillStyle = mixHex(P.wall, '#000', 0.45); c.fillRect(880, 40, 110, 300);
    c.fillStyle = mixHex(P.wall, '#000', 0.25); c.fillRect(872, 34, 8, 306); c.fillRect(990, 34, 8, 306);
    c.fillStyle = mixHex('#a08060', '#000', night ? 0.7 : 0.35); c.beginPath(); c.arc(898, 200, 4, 0, Math.PI * 2); c.fill();
    if (k.leash !== false) leash(c, 860, 120, 80, k.sway ?? 0, night ? 0.65 : 0.25);
    else {
      // the empty hook, and the paler shape on the wall where the leash hung for years
      c.fillStyle = rgba(mixHex(P.wallLit, '#ffffff', 0.2), 0.12); c.beginPath(); c.roundRect(852, 122, 16, 82, 6); c.fill();
      c.strokeStyle = mixHex('#a08050', '#000', night ? 0.6 : 0.2); c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(860, 112); c.lineTo(860, 124); c.quadraticCurveTo(860, 132, 868, 130); c.stroke();
      c.fillStyle = mixHex('#a08050', '#000', night ? 0.6 : 0.3); c.fillRect(854, 108, 12, 6);
    }
    // light from the window, laid on the wall to the left of it and on the fridge
    if (sun) patch(c, [[290, 110], [400, 96], [410, 220], [300, 236]], P.key, 0.12);
    if (night) patch(c, [[180, 86], [420, 86], [460, 230], [140, 230]], P.key, 0.12);
  });
  // ---- counter (base units, worktop, sink, kettle, the mug) ----
  st.layer(0.92, (c) => {
    c.fillStyle = mixHex(P.cab, '#000', 0.15); c.fillRect(40, 214, 620, 130);
    c.strokeStyle = rgba('#000', 0.45); c.lineWidth = 2; for (let x = 40; x <= 660; x += 103) { c.beginPath(); c.moveTo(x, 218); c.lineTo(x, 344); c.stroke(); }
    c.fillStyle = rgba('#000', 0.4); c.fillRect(40, 330, 620, 14);
    // worktop edge catches the light
    const wg = c.createLinearGradient(40, 0, 660, 0);
    wg.addColorStop(0, mixHex('#5a4a3c', '#000', night ? 0.4 : 0.3)); wg.addColorStop(night ? 0.45 : 0.85, mixHex('#9a8064', P.key, night ? 0.2 : 0.35)); wg.addColorStop(1, mixHex('#5a4a3c', '#000', 0.2));
    c.fillStyle = wg; c.fillRect(36, 204, 628, 12);
    c.fillStyle = rgba('#000', 0.3); c.fillRect(36, 214, 628, 3);
    // the tap over the sink, under the window
    c.strokeStyle = mixHex('#8a8a8a', '#000', night ? 0.6 : 0.2); c.lineWidth = 4; c.beginPath(); c.moveTo(560, 204); c.lineTo(560, 172); c.quadraticCurveTo(560, 162, 548, 164); c.stroke();
    // the kettle
    if (k.kettle !== false) {
      c.fillStyle = mixHex('#5a4a40', '#000', night ? 0.6 : 0.62);
      blob(c, [[190, 204], [186, 180], [196, 160], [230, 158], [240, 180], [238, 204]], true, 0.5); c.fill();
      c.lineWidth = 5; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(198, 160); c.quadraticCurveTo(213, 140, 230, 160); c.stroke();
      c.beginPath(); c.moveTo(188, 186); c.lineTo(172, 172); c.stroke();
      c.fillStyle = rgba(P.key, 0.25); c.fillRect(232, 166, 3, 30);
    }
    if (k.rack) {
      // the drying rack by the sink, and whatever is in it
      c.strokeStyle = mixHex('#8a8a8a', '#000', 0.4); c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(600 + i * 8, 204); c.lineTo(600 + i * 8, 186); c.stroke(); }
      c.beginPath(); c.moveTo(596, 204); c.lineTo(650, 204); c.stroke();
    }
    if (k.tub) {
      // a white plastic tub of chewable antacids, its lid beside it
      c.fillStyle = mixHex('#f0f0ec', P.dark, night ? 0.55 : 0.2); c.beginPath(); c.roundRect(160, 186, 22, 22, 3); c.fill();
      c.fillStyle = mixHex('#3a7ac8', P.dark, night ? 0.5 : 0.15); c.fillRect(160, 194, 22, 6);
      c.fillStyle = mixHex('#e8e8e4', P.dark, night ? 0.55 : 0.2); c.beginPath(); c.ellipse(196, 206, 12, 3, 0, 0, Math.PI * 2); c.fill();
    }
    if (k.pills) for (let i = 0; i < 4; i++) {
      c.fillStyle = mixHex(['#c87a2a', '#e8e0d0', '#c87a2a', '#d8d0c0'][i], '#000', 0.3);
      c.beginPath(); c.roundRect(470 + i * 14, 186 + (i % 2) * 2, 10, 18 - (i % 2) * 2, 2); c.fill();
      c.fillStyle = mixHex('#f0f0f0', '#000', 0.35); c.fillRect(470 + i * 14, 184 + (i % 2) * 2, 10, 4);
    }
  });
  if (k.mug !== false) {
    if (k.bottle && k.bottle !== 'none') st.layer(0.94, (c) => {
      // a wine bottle at the back of the counter by the tiles; 'dusty' has lost its shine and wears a grey bloom
      const x = 400, y = 206, dusty = k.bottle === 'dusty';
      c.fillStyle = mixHex('#1a2418', '#000', night ? 0.6 : 0.2); c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 9, y - 40); c.quadraticCurveTo(x - 9, y - 50, x - 3, y - 54); c.lineTo(x - 3, y - 70); c.lineTo(x + 3, y - 70); c.lineTo(x + 3, y - 54); c.quadraticCurveTo(x + 9, y - 50, x + 9, y - 40); c.lineTo(x + 9, y); c.closePath(); c.fill();
      c.fillStyle = mixHex('#e8dcc0', '#000', night ? 0.6 : 0.25); c.fillRect(x - 8, y - 34, 16, 18); // the label
      if (dusty) { c.fillStyle = rgba('#b8b0a0', 0.3); c.fillRect(x - 9, y - 70, 18, 70); }
      else { c.fillStyle = rgba(P.key, 0.5); c.fillRect(x + 4, y - 44, 2, 30); }
    });
    st.layer(0.94, (c) => mug(c, 532, 206, 26, night ? -1 : 1, { light: P.key, dark: night ? 0.55 : 0.2 }));
    if (k.steam !== false) st.steam(0.94, 532, 176, 1, '#fff4e4', night ? 0.18 : 0.3, 3);
  }
  // ---- the beam through the window, dust in it ----
  if (sun) st.glow(560, 120, 260, P.key, 0.32, 0.85);
  // the beam comes in as four panes, the mullions' shadows running through it
  if (sun) for (const [x0, x1, y0, y1, m] of [[432, 516, 50, 112, 18], [521, 604, 50, 112, 18], [432, 516, 116, 180, 18], [521, 604, 116, 180, 18]] as const)
    st.shaft(0.88, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [-1, 0.6], 520, P.key, 0.05, m, x0 + y0);
  else st.glow(300, 96, 200, P.key, 0.22, 0.88);
  // ---- floor ----
  st.layer(1, (c) => floor(c, 340, 420, mixHex(P.floor, '#000', night ? 0.5 : 0.1), mixHex(P.floor, '#000', 0.55), 520));
  if (sun) st.layer(1, (c) => patch(c, [[140, 360], [330, 344], [400, 400], [170, 428]], P.key, 0.18));
  // ---- the dog's bed and the dog ----
  st.layer(1.05, (c) => {
    c.fillStyle = mixHex('#4a3028', '#000', night ? 0.6 : 0.3);
    c.beginPath(); c.ellipse(205, 400, 96, 20, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = mixHex('#5a3a30', '#000', night ? 0.6 : 0.25);
    blob(c, [[110, 400], [116, 374], [140, 372], [270, 372], [298, 378], [302, 402]], true, 0.4); c.fill();
    c.fillStyle = mixHex('#3a241e', '#000', night ? 0.6 : 0.3); c.beginPath(); c.ellipse(206, 386, 82, 13, 0, 0, Math.PI * 2); c.fill();
  });
  if (k.dog) {
    const dp = k.dog;
    let muzzle: ((g: C) => void) | null = null;
    st.lit(dp.y > 360 ? 1.05 : 0.9, (c) => { muzzle = dog(c, dp); }, { body: k.herDark ?? P.dark, rim: 0.7, width: 2.2, fill: 0.5, cool: P.fill, at: [dp.x + dp.d * 0.5 * dp.face, dp.y - dp.d * 0.25, dp.d * 1.4] });
    st.layer(dp.y > 360 ? 1.05 : 0.9, (c) => { if (muzzle) { c.fillStyle = rgba('#8a8580', night ? 0.12 : 0.18); muzzle(c); } });
  }
  // ---- her ----
  if ((k.open ?? 0) > 0) st.layer(1, (c) => {
    const g = c.createRadialGradient(760, 220, 20, 720, 300, 420); g.addColorStop(0, rgba('#dfeeff', 0.32 * k.open!)); g.addColorStop(1, rgba('#dfeeff', 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(300, 0, 700, 460); c.globalCompositeOperation = 'source-over';
  });
  if (k.her) {
    const hp = k.her, fl = (k.open ?? 0) > 0.5 ? { x: 760, y: 200, color: '#e8f4ff' } : undefined; // the fridge's light, when it is open, is the one on her
    st.lit(1, (c) => woman(c, hp), { body: k.herDark ?? P.dark, rim: 1, width: 2.2, fill: fl ? 0.6 : 0.35, cool: P.fill, light: fl, at: [hp.x, hp.y - hp.s * 0.55, hp.s] });
  }
  if (k.hands) k.hands(st);
}

/** The fridge door's front: the letter under a magnet and the brochure beside it (and later, more). */
export function fridgeFront(c: C, k: Kit, dark: number, key: string, readable: boolean) {
  if (k.letter !== false) { paper(c, 726, 120, 34, 46, -0.05, { light: key, dark, lines: readable ? 0 : 6, fold: true }); magnet(c, 726, 100, 4, '#a8382c', dark); }
  if (k.brochure !== false) { brochure(c, 776, 122, 32, 44, 0.03, { light: key, dark, words: readable }); magnet(c, 776, 102, 3.5, '#3a6a8a', dark); }
  if (k.gen4) { brochure(c, 760, 196, 30, 42, -0.04, { light: key, dark, gen: 4, words: readable }); magnet(c, 760, 177, 3.5, '#e0e0e0', dark); }
  if (k.note) {
    // a small sheet held by a magnet, low on the door
    c.save(); c.translate(726, 178); c.rotate(k.note === 'lfts' ? -0.06 : 0.04);
    c.fillStyle = mixHex(k.note === 'lfts' ? '#f6f0dc' : '#f4f4f2', '#000', dark); c.fillRect(-15, -11, 30, 22);
    if (readable) {
      c.fillStyle = mixHex(k.note === 'lfts' ? '#1e2a5a' : '#202020', '#000', dark * 0.5);
      if (k.note === 'lfts') { c.font = 'italic 3.1px "Caveat", "Segoe Script", "Bradley Hand", cursive'; c.fillText('LFTs fine.', -12, -4); c.fillText('See you in 3 months.', -12, 0.5); c.fillText('- Dr A.', -12, 6); }
      else { c.font = '500 2.4px "IBM Plex Mono", monospace'; c.fillText('TITHONUS PORTAL', -12, -6); c.fillText('Hepatic reserve: 82%', -12, -1); c.fillStyle = mixHex('#3c7d92', '#000', dark); c.fillRect(-12, 3, 18, 1.2); }
    } else { c.fillStyle = rgba('#000', 0.3); c.fillRect(-11, -5, 20, 1.5); c.fillRect(-11, -1, 16, 1.5); }
    c.restore(); magnet(c, 726, 167, 3, k.note === 'lfts' ? '#3a8a4a' : '#c0c0c0', dark);
  }
  if (k.card) {
    c.save(); c.translate(722, 192); c.rotate(0.06);
    c.fillStyle = mixHex('#f4f4f0', '#000', dark); c.fillRect(-14, -9, 28, 18);
    c.fillStyle = mixHex('#2a5a9a', '#000', dark); c.fillRect(-14, -9, 28, 4);
    c.fillStyle = rgba('#000', 0.3); c.fillRect(-10, -1, 18, 1.5); c.fillRect(-10, 3, 12, 1.5);
    c.restore(); magnet(c, 722, 182, 3, '#d8a020', dark);
  }
}

/** The fridge door up close (for inserts), with the ledger's objects readable. */
export function fridgeClose(st: Stage, k: Kit, time: Time) {
  const P = PAL[time], night = time === 'night';
  st.light = night ? { x: 560, y: 40, color: P.key } : { x: 900, y: 60, color: P.key };
  st.layer(0.9, (c) => {
    const fg = c.createLinearGradient(560, 0, 940, 0);
    fg.addColorStop(0, mixHex('#c8c0b4', P.dark, night ? 0.6 : 0.35)); fg.addColorStop(1, mixHex('#e0d8cc', P.dark, night ? 0.72 : 0.22));
    c.fillStyle = fg; c.fillRect(0, -50, 1000, 520);
    c.save(); c.translate(500, 210); c.scale(4.2, 4.2); c.translate(-750, -150);
    fridgeFront(c, k, night ? 0.45 : 0.12, P.key, true);
    c.restore();
    const g = c.createRadialGradient(st.light.x, st.light.y, 0, st.light.x, st.light.y, 700);
    g.addColorStop(0, rgba(P.key, 0.18)); g.addColorStop(1, rgba(P.key, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, -50, 1000, 520);
  });
}

export { hash, W, cap, glass, mug, paper, brochure, PAL };
