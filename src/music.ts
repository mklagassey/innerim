// The score is generated live, one heartbeat at a time, so the host's heart is the clock
// everything locks to. `heat` (0 to 1) moves it between two very different places:
//
//   cold   sparse and eerie: a faint drone, lonely square-wave blips that echo away,
//          stutters and clicks of digital grit, and nothing keeping time but the heart
//   0.2+   a sub-bass throb and a soft off-beat tick: something has noticed you
//   0.45+  a real kick and snare, a driving bass line, sixteenth hats
//   0.7+   syncopated kicks, octave-jumping bass, a filter-swept lead, pumping pads, crashes
//   0.9+   chord stabs on top of all of it
//
// When life is low the blips give way to a held, sour cluster.
export interface Kit { ac: AudioContext; out: AudioNode; noise: AudioBuffer }

let kit: Kit | null = null;
let bus: GainNode, pump: GainNode, echo: GainNode, padGain: GainNode, padFilter: BiquadFilterNode;
let pads: OscillatorNode[] = [];
let heat = 0, count = 0;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const ROOTS = [38, 38, 34, 33]; // D, D, B flat, A: one bar each
const BLIPS = [0, 7, 3, 10, 5, 12, 2, 15]; // a wandering minor figure for the quiet
const ARP = [12, 19, 24, 27, 24, 19, 25, 19]; // 25 is the flattened second, an octave up
const chance = (p: number) => Math.random() < p;

/** How wound-up the music currently is, 0 to 1. The picture follows the same number. */
export const level = () => heat;

export function init(k: Kit) {
  kit = k;
  const { ac } = k;
  bus = ac.createGain();
  bus.gain.value = 0.6;
  bus.connect(k.out);
  pump = ac.createGain(); // everything sent here ducks under the kick when things get loud
  pump.connect(bus);

  // A feedback delay gives the quiet notes a large, wet space to die away in.
  echo = ac.createGain();
  const delay = ac.createDelay(1), back = ac.createGain(), damp = ac.createBiquadFilter();
  delay.delayTime.value = 0.41; back.gain.value = 0.5;
  damp.type = 'lowpass'; damp.frequency.value = 1600;
  echo.connect(bus);
  echo.connect(delay).connect(damp).connect(back).connect(delay);
  damp.connect(bus);

  padFilter = ac.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 180; padFilter.Q.value = 0.7;
  padGain = ac.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain).connect(pump);
  pads = [0, 7, -5].map((cents, i) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth'; o.detune.value = cents;
    o.frequency.value = hz(ROOTS[0] + (i === 2 ? 19 : 12));
    o.connect(padFilter); o.start();
    return o;
  });
}

interface NoteOpts { attack?: number; cutoff?: number; sweep?: number; to?: AudioNode; bend?: number }
function note(at: number, midi: number, dur: number, vol: number, wave: OscillatorType, opts: NoteOpts = {}) {
  if (!kit) return;
  const { ac } = kit, o = ac.createOscillator(), g = ac.createGain();
  o.type = wave; o.frequency.setValueAtTime(hz(midi), at);
  if (opts.bend) o.frequency.exponentialRampToValueAtTime(hz(midi + opts.bend), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + (opts.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  if (opts.cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(opts.cutoff, at);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, at + dur);
    o.connect(f).connect(g);
  } else o.connect(g);
  g.connect(opts.to ?? bus);
  o.start(at); o.stop(at + dur + 0.05);
}

function tick(at: number, dur: number, vol: number, freq: number, kind: BiquadFilterType, q = 0.9) {
  if (!kit) return;
  const { ac } = kit, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = kit.noise; src.loop = true;
  f.type = kind; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(at, Math.random()); src.stop(at + dur + 0.02);
}

const kick = (at: number, vol: number) => { note(at, 50, 0.22, vol, 'sine', { bend: -26 }); tick(at, 0.02, vol * 0.5, 3000, 'highpass'); };
const snare = (at: number, vol: number) => { tick(at, 0.17, vol, 1800, 'bandpass'); note(at, 55, 0.09, vol * 0.3, 'triangle', { bend: -7 }); };

/** Lets the score sink to a faint drone while the game is paused or over. */
export function rest() {
  if (!kit) return;
  const now = kit.ac.currentTime;
  padGain.gain.setTargetAtTime(0.03, now, 0.6);
  padFilter.frequency.setTargetAtTime(180, now, 0.6);
  heat *= 0.98;
}

/** Schedules one beat of music starting at `at` and lasting `len` seconds.
 *  Returns the moments the kick lands, so the picture can jump with it. */
export function beat(at: number, len: number, target: number, life: number): number[] {
  if (!kit) return [];
  heat += (target - heat) * (target > heat ? 0.5 : 0.1); // tension arrives fast and drains slowly
  const h = heat, b = count++, inBar = b % 4, bar = Math.floor(b / 4), root = ROOTS[bar % 4], step = len / 4;
  const weak = life < 0.35, kicks: number[] = [];

  if (inBar === 0) pads.forEach((o, i) => o.frequency.setTargetAtTime(hz(root + (i === 2 ? 19 : 12)), at, 0.25));
  // The lead's filter opens and closes over eight bars once the music is loud.
  const sweep = 0.5 + 0.5 * Math.sin((b / 32) * Math.PI * 2);
  padFilter.frequency.setTargetAtTime(160 + h * h * 2200 * (0.5 + sweep * 0.5), at, 0.4);
  padGain.gain.setTargetAtTime(0.04 + h * 0.1, at, 0.5);
  bus.gain.setTargetAtTime(0.6 + h * 0.55, at, 0.5);
  if (h > 0.6) { // sidechain: pads and lead duck under each kick and swell back
    pump.gain.cancelScheduledValues(at);
    pump.gain.setValueAtTime(0.3, at);
    pump.gain.linearRampToValueAtTime(1, at + len * 0.7);
  } else pump.gain.setTargetAtTime(1, at, 0.2);

  // --- The quiet: blips, echoes and grit ------------------------------------------------
  if (weak) {
    if (inBar === 0) for (const m of [74, 75]) note(at, m, len * 4, 0.03 + h * 0.03, 'sine', { attack: len, to: pump });
  } else if (h < 0.5) {
    const quiet = 1 - h; // thins out as the beat takes over
    for (const i of [0, 2]) {
      if (!chance(0.62 * quiet)) continue;
      const m = root + 36 + BLIPS[(b * 2 + i / 2) % BLIPS.length] + (chance(0.12) ? 12 : 0);
      note(at + i * step, m, 0.5, 0.05, 'square', { cutoff: 1400, to: echo });
    }
    if (chance(0.16 * quiet)) { // a stutter: one note retriggered too fast, like a skipping disc
      const m = root + 48 + BLIPS[Math.floor(Math.random() * BLIPS.length)], n = 3 + Math.floor(Math.random() * 4), gap = step / 3;
      for (let i = 0; i < n; i++) note(at + step * 2 + i * gap, m, gap * 0.7, 0.035, 'square', { cutoff: 2600, to: i === n - 1 ? echo : bus });
    }
    if (chance(0.4 * quiet)) tick(at + Math.floor(Math.random() * 8) * (step / 2), 0.012, 0.12, 2500 + Math.random() * 5000, 'bandpass', 6); // grit
    if (chance(0.07 * quiet)) note(at + step, root + 60, 0.35, 0.03, 'sawtooth', { bend: -24, cutoff: 3000, to: echo }); // a falling glitch
  }

  // --- Something has noticed ------------------------------------------------------------
  if (h > 0.2 && h <= 0.45) {
    note(at, root, len * 0.9, 0.2, 'sine');
    tick(at + step * 2, 0.04, 0.08, 6500, 'highpass');
  }

  // --- The beat -------------------------------------------------------------------------
  if (h > 0.45) {
    const top = h > 0.7, drive = (h - 0.45) / 0.55; // 0 to 1 across the loud range
    kick(at, 0.5 + drive * 0.35); kicks.push(at);
    if (top && (inBar === 1 || inBar === 3)) kick(at + step * 3, 0.5); // heard but not shown: the picture never flashes more than once a beat
    if (inBar === 1 || inBar === 3) snare(at, 0.4 + drive * 0.3);
    if (top && inBar === 3 && bar % 2 === 1) for (let i = 1; i < 4; i++) snare(at + i * step, 0.15 + i * 0.08); // a roll into the next phrase
    if (top && inBar === 0 && bar % 4 === 0) tick(at, 1.4, 0.3, 5000, 'highpass'); // crash

    for (let i = 0; i < 4; i++) {
      const open = top && i === 2;
      tick(at + i * step, open ? 0.14 : 0.03, i === 2 ? 0.16 : 0.07 + drive * 0.05, open ? 6000 : 8500, 'highpass');
    }

    const line = top ? [0, 12, 0, 12] : [0, null, 0, inBar === 3 ? 7 : null];
    line.forEach((n, i) => {
      if (n === null) return;
      note(at + i * step, root + n, step * (top ? 0.85 : 1.7), 0.2 + drive * 0.1, 'sawtooth', { cutoff: 300 + drive * 1500, sweep: 150 });
    });
  }

  if (h > 0.7) {
    const bright = 900 + sweep * 3200;
    for (let i = 0; i < 4; i++) note(at + i * step, root + ARP[(b * 4 + i) % ARP.length] + 12, step * 0.9, 0.06, 'sawtooth', { cutoff: bright, sweep: bright * 0.4, to: pump });
  }
  if (h > 0.9) {
    for (const i of [1, 3]) for (const n of [12, 15, 19]) note(at + i * step, root + n + 12, step * 0.6, 0.05, 'sawtooth', { cutoff: 2400, to: pump });
  }
  return kicks.length ? kicks : [at]; // with no drum yet, the heart itself is the beat
}
