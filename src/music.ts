// The score is generated live, one heartbeat at a time, so the host's heart is the drum
// everything else locks to. `heat` (0 to 1) decides which layers play:
//   always   a low drone that follows a four-bar progression in D minor
//   calm     sparse, echoing bell notes
//   0.2+     a bass line
//   0.45+    hats and a snare on the backbeat
//   0.75+    a nervous arpeggio with a flattened second
//   weak     the bells give way to a held, sour cluster
export interface Kit { ac: AudioContext; out: AudioNode; noise: AudioBuffer }

let kit: Kit | null = null;
let bus: GainNode, echo: GainNode, padGain: GainNode, padFilter: BiquadFilterNode;
let pads: OscillatorNode[] = [];
let heat = 0, count = 0;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const ROOTS = [38, 38, 34, 33]; // D, D, B flat, A: one bar each
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic above the root
const ARP = [12, 19, 24, 27, 24, 19, 25, 19]; // 25 is the flattened second, an octave up
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function init(k: Kit) {
  kit = k;
  const { ac } = k;
  bus = ac.createGain();
  bus.gain.value = 0.85;
  bus.connect(k.out);

  // A feedback delay gives the bells a sense of a large, wet space.
  echo = ac.createGain();
  const delay = ac.createDelay(1), back = ac.createGain(), damp = ac.createBiquadFilter();
  delay.delayTime.value = 0.41; back.gain.value = 0.42;
  damp.type = 'lowpass'; damp.frequency.value = 1800;
  echo.connect(bus);
  echo.connect(delay).connect(damp).connect(back).connect(delay);
  damp.connect(bus);

  padFilter = ac.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 220; padFilter.Q.value = 0.7;
  padGain = ac.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain).connect(bus);
  pads = [0, 7, -5].map((cents, i) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth'; o.detune.value = cents;
    o.frequency.value = hz(ROOTS[0] + (i === 2 ? 19 : 12));
    o.connect(padFilter); o.start();
    return o;
  });
}

function note(at: number, midi: number, dur: number, vol: number, wave: OscillatorType, opts: { attack?: number; cutoff?: number; to?: AudioNode } = {}) {
  if (!kit) return;
  const { ac } = kit, o = ac.createOscillator(), g = ac.createGain();
  o.type = wave; o.frequency.value = hz(midi);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  if (opts.cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = opts.cutoff;
    o.connect(f).connect(g);
  } else o.connect(g);
  g.connect(opts.to ?? bus);
  o.start(at); o.stop(at + dur + 0.05);
}

function tick(at: number, dur: number, vol: number, freq: number, kind: BiquadFilterType) {
  if (!kit) return;
  const { ac } = kit, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = kit.noise; src.loop = true;
  f.type = kind; f.frequency.value = freq; f.Q.value = 0.9;
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(at, Math.random()); src.stop(at + dur + 0.02);
}

/** Lets the score sink to a faint drone while the game is paused or over. */
export function rest() {
  if (!kit) return;
  padGain.gain.setTargetAtTime(0.035, kit.ac.currentTime, 0.6);
  padFilter.frequency.setTargetAtTime(200, kit.ac.currentTime, 0.6);
}

/** Schedules one beat of music starting at `at` and lasting `len` seconds. */
export function beat(at: number, len: number, target: number, life: number) {
  if (!kit) return;
  heat += (target - heat) * (target > heat ? 0.5 : 0.12); // tension arrives fast and drains slowly
  const b = count++, inBar = b % 4, root = ROOTS[Math.floor(b / 4) % 4], step = len / 4;
  const weak = life < 0.35;

  if (inBar === 0) pads.forEach((o, i) => o.frequency.setTargetAtTime(hz(root + (i === 2 ? 19 : 12)), at, 0.25));
  padFilter.frequency.setTargetAtTime(220 + heat * 1100, at, 0.5);
  padGain.gain.setTargetAtTime(0.07 + heat * 0.05, at, 0.5);

  if (weak) {
    if (inBar === 0) for (const m of [74, 75]) note(at, m, len * 4, 0.03, 'sine', { attack: len });
  } else if (heat < 0.55 && Math.random() < 0.42) {
    const m = root + 24 + (Math.random() < 0.3 ? 12 : 0) + pick(SCALE);
    note(at + (Math.random() < 0.5 ? 0 : step * 2), m, 1.6, 0.075, 'triangle', { to: echo });
  }

  if (heat > 0.2) {
    const vol = 0.12 + heat * 0.12, driven = heat > 0.5;
    const line = driven ? [0, heat > 0.8 ? 0 : null, 12, 0] : [0, null, inBar === 3 ? 7 : 0, null];
    line.forEach((n, i) => {
      if (n === null) return;
      note(at + i * step, root + n, step * (driven ? 0.9 : 1.8), vol, driven ? 'sawtooth' : 'triangle', driven ? { cutoff: 400 + heat * 900 } : {});
    });
  }

  if (heat > 0.45) {
    tick(at + step * 2, 0.05, 0.16, 7000, 'highpass');
    if (heat > 0.7) for (const i of [0, 1, 3]) tick(at + i * step, 0.03, 0.07, 8000, 'highpass');
    if (heat > 0.55 && (inBar === 1 || inBar === 3)) {
      tick(at, 0.16, 0.5, 1700, 'bandpass');
      note(at, 50, 0.1, 0.12, 'triangle');
    }
    if (heat > 0.8 && inBar === 3) note(at + step * 3, 33, 0.14, 0.3, 'sine'); // a push into the next bar
  }

  if (heat > 0.75) {
    for (let i = 0; i < 4; i++) note(at + i * step, root + ARP[(b * 4 + i) % ARP.length] + 12, step * 0.9, 0.035, 'square', { cutoff: 1900 });
  }
}
