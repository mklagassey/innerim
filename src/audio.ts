// Every sound is synthesised on the spot with Web Audio: no files to load.
// The host's heartbeat and the rush of blood past you run underneath everything.
import * as Music from './music';

let ac: AudioContext | null = null;
let master: GainNode, bed: GainNode, noise: AudioBuffer;
let on = true;
try { on = localStorage.getItem('insiderim.sound') !== 'off'; } catch { /* default to on */ }

export const isOn = () => on;
export function setOn(value: boolean) {
  on = value;
  try { localStorage.setItem('insiderim.sound', on ? 'on' : 'off'); } catch { /* not remembered */ }
  if (ac) master.gain.setTargetAtTime(on ? 0.9 : 0, ac.currentTime, 0.05);
}

/** Must be called from a click: browsers only let sound start on a user's action. */
export function start() {
  if (ac) { void ac.resume(); return; }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ac = new Ctor();
  master = ac.createGain();
  master.gain.value = on ? 0.9 : 0;
  const squash = ac.createDynamicsCompressor(); // keeps a busy fight from clipping
  master.connect(squash).connect(ac.destination);

  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noise.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; } // brown noise

  // Blood moving past: a low wash that swells with each heartbeat.
  const flow = ac.createBufferSource();
  flow.buffer = noise; flow.loop = true;
  const low = ac.createBiquadFilter();
  low.type = 'lowpass'; low.frequency.value = 260;
  bed = ac.createGain();
  bed.gain.value = 0.0;
  flow.connect(low).connect(bed).connect(master);
  flow.start();
  Music.init({ ac, out: master, noise });
}

type Wave = OscillatorType;
function tone(from: number, to: number, dur: number, vol: number, wave: Wave = 'sine', delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function hiss(from: number, to: number, dur: number, vol: number, kind: BiquadFilterType = 'bandpass', delay = 0, q = 1.2) {
  if (!ac) return;
  const t = ac.currentTime + delay, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noise; src.loop = true;
  f.type = kind; f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random()); src.stop(t + dur + 0.02);
}

const SOUNDS: Record<string, () => void> = {
  step: () => { hiss(240 + Math.random() * 60, 120, 0.22, 0.32, 'lowpass'); tone(92, 80, 0.2, 0.07, 'sawtooth'); }, // the engines, pulsing
  surge: () => { tone(60, 44, 0.5, 0.9, 'sine'); tone(180, 520, 1.1, 0.12, 'sawtooth', 0.05); hiss(200, 1800, 1.2, 0.5, 'bandpass', 0, 2); }, // a jolt of adrenaline
  sleep: () => { [392, 330, 262].forEach((f, i) => tone(f, f * 0.99, 1.4, 0.1, 'sine', i * 0.35)); },
  wake: () => { [262, 330, 392].forEach((f, i) => tone(f, f, 0.9, 0.1, 'sine', i * 0.22)); },
  burn: () => hiss(5200, 2200, 0.5, 0.45, 'bandpass', 0, 3), // the hull fizzing
  meal: () => { [40, 52, 46].forEach((f, i) => tone(f, f * 1.5, 0.5, 0.5, 'sine', i * 0.3)); hiss(120, 500, 1.3, 0.6, 'lowpass', 0.1); }, // a long gurgle
  tag: () => { tone(1320, 1320, 0.09, 0.14, 'square'); tone(990, 1480, 0.25, 0.1, 'triangle', 0.09); hiss(3000, 6000, 0.2, 0.3, 'bandpass', 0.05, 5); }, // a latch closing
  fever: () => { tone(110, 165, 1.4, 0.3, 'sawtooth'); tone(112, 170, 1.4, 0.25, 'sawtooth', 0.02); hiss(300, 2000, 1.4, 0.3, 'bandpass', 0, 2); }, // heat rising
  excise: () => { hiss(3200, 400, 0.35, 1, 'bandpass', 0, 3); [523, 659, 784].forEach((f, i) => tone(f, f, 0.5, 0.13, 'sine', 0.15 + i * 0.09)); }, // a clean cut, and a good sign
  swing: () => hiss(900, 3200, 0.13, 0.7, 'bandpass', 0, 1.5),
  hit: () => { tone(190, 70, 0.11, 0.5, 'triangle'); hiss(1400, 300, 0.09, 0.9); },
  kill: () => { tone(240, 45, 0.3, 0.5, 'triangle'); hiss(2400, 120, 0.4, 1.4, 'lowpass'); }, // a cell bursting
  bigkill: () => { tone(120, 30, 0.7, 0.7, 'sawtooth'); hiss(1800, 60, 0.9, 1.8, 'lowpass'); tone(660, 990, 0.5, 0.12, 'sine', 0.25); },
  shot: () => { tone(1500, 240, 0.14, 0.22, 'square'); hiss(5000, 900, 0.1, 0.5, 'highpass'); },
  hurt: () => { tone(150, 55, 0.22, 0.7, 'sawtooth'); hiss(700, 150, 0.2, 1.2, 'lowpass'); },
  sip: () => hiss(300, 1400, 0.9, 0.5, 'bandpass', 0, 6),
  skim: () => { tone(660, 880, 0.12, 0.18); tone(990, 1320, 0.16, 0.12, 'sine', 0.07); },
  tear: () => { hiss(180, 1200, 0.85, 1.2, 'bandpass', 0, 3); tone(70, 110, 0.85, 0.3, 'sawtooth'); },
  strip: () => { hiss(2600, 90, 0.6, 1.8, 'lowpass'); tone(95, 32, 0.6, 0.8, 'sine'); tone(440, 660, 0.25, 0.14, 'sine', 0.2); },
  pickup: () => { tone(520, 780, 0.1, 0.2, 'triangle'); tone(780, 1040, 0.14, 0.16, 'triangle', 0.08); },
  cache: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, f * 1.01, 0.5, 0.14, 'sine', i * 0.07)); },
  upgrade: () => { [294, 440, 587].forEach((f, i) => tone(f, f, 0.7, 0.16, 'triangle', i * 0.05)); hiss(600, 4000, 0.5, 0.25, 'bandpass', 0, 4); },
  heal: () => { tone(330, 495, 0.3, 0.2); tone(495, 660, 0.35, 0.14, 'sine', 0.12); },
  calm: () => { [587, 440, 349, 294].forEach((f, i) => tone(f, f, 0.9, 0.13, 'sine', i * 0.16)); hiss(2400, 200, 1.2, 0.3, 'lowpass'); }, // a long breath out
  cloak: () => { hiss(4000, 300, 0.7, 0.5, 'bandpass', 0, 5); tone(880, 220, 0.6, 0.1); },
  net: () => { hiss(3000, 500, 0.35, 0.7, 'bandpass', 0, 4); tone(240, 120, 0.3, 0.2, 'triangle'); },
  sniff: () => { tone(300, 420, 0.12, 0.1, 'triangle'); tone(420, 380, 0.1, 0.08, 'triangle', 0.1); },
  spot: () => { tone(520, 700, 0.07, 0.16, 'square'); tone(700, 930, 0.09, 0.16, 'square', 0.08); },
  alarm: () => { tone(98, 92, 0.9, 0.5, 'sawtooth'); tone(147, 139, 0.9, 0.35, 'sawtooth', 0.02); },
  tip: () => tone(740, 880, 0.12, 0.12, 'triangle'),
  win: () => { [262, 330, 392, 523].forEach((f, i) => tone(f, f, 1.2, 0.2, 'triangle', i * 0.14)); hiss(200, 2400, 1.6, 0.6, 'bandpass', 0, 2); },
  dead: () => { tone(220, 30, 1.6, 0.7, 'sawtooth'); hiss(1500, 50, 1.8, 1.6, 'lowpass'); },
};

const lastPlayed: Record<string, number> = {};
export function play(name: string) {
  if (!ac || !on || !SOUNDS[name]) return;
  // The same sound many times in one instant is just louder noise.
  if (ac.currentTime - (lastPlayed[name] ?? -1) < 0.04) return;
  lastPlayed[name] = ac.currentTime;
  SOUNDS[name]();
}

let nextBeat = 0;
const hits: number[] = []; // when each kick lands, for the picture

/** 1 at the instant of a kick, fading to 0 before the next. */
export function thump() {
  if (!ac) return 0;
  const now = ac.currentTime;
  hits.sort((a, b) => a - b);
  while (hits.length > 1 && hits[1] <= now) hits.shift();
  return hits.length && hits[0] <= now ? Math.exp(-(now - hits[0]) / 0.14) : 0;
}
/** How wound-up the score is, 0 to 1. */
export const intensity = () => (ac ? Music.level() : 0);
/** Keeps the host's heart and the score going. Call every frame; bpm 0 lets them rest.
 *  `life` is 0 to 1 and `heat` (0 to 1) is how much trouble the player is in. */
export function pulse(bpm: number, life: number, heat = 0) {
  if (!ac) return;
  const now = ac.currentTime;
  bed.gain.setTargetAtTime(bpm ? 0.38 : 0.1, now, 0.4);
  if (!bpm) { nextBeat = 0; Music.rest(); return; } // when muted this still runs, silently, so the picture keeps its beat
  if (nextBeat < now) nextBeat = now + 0.05;
  if (nextBeat - now > 0.12) return; // schedule just ahead of time
  const at = nextBeat - now, loud = 0.34 + (1 - Math.max(0, Math.min(1, life))) * 0.5; // louder as you weaken
  tone(62, 38, 0.16, loud, 'sine', at); // lub
  tone(84, 46, 0.12, loud * 0.7, 'sine', at + Math.min(0.3, 18 / bpm)); // dub
  hiss(140, 420, 0.3, 0.5, 'lowpass', at); // the surge of blood that follows
  hits.push(...Music.beat(nextBeat, 60 / bpm, heat, life));
  nextBeat += 60 / bpm;
}
