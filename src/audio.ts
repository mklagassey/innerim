// Every sound is synthesised on the spot with Web Audio: no files to load.
// The host's heartbeat and the rush of blood past you run underneath everything.
import * as Music from './music';

let ac: AudioContext | null = null;
let master: GainNode, bed: GainNode, noise: AudioBuffer, muffle: BiquadFilterNode;
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
  muffle = ac.createBiquadFilter(); // opened all the way in play; closes for a scene from outside the body
  muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
  master.connect(muffle).connect(squash).connect(ac.destination);
  cavity(ac, muffle);

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
  beds(ac);
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
  slam: () => { tone(90, 40, 0.25, 0.8, 'sine'); hiss(900, 120, 0.25, 1.3, 'lowpass'); },
  inhale: () => hiss(300, 1500, 1.6, 0.5, 'bandpass', 0, 1.2),
  exhale: () => hiss(1500, 250, 1.8, 0.55, 'bandpass', 0, 1.2),
  aware: () => { tone(330, 330, 1.6, 0.07, 'sine'); tone(495, 495, 1.8, 0.06, 'sine', 0.35); tone(660, 664, 2.2, 0.05, 'sine', 0.8); }, // three soft notes, one after another: something new is running
  bait: () => { tone(520, 300, 0.25, 0.12, 'triangle'); hiss(900, 400, 0.3, 0.25, 'bandpass', 0.05, 2); }, // a small wet plop
  board: () => { hiss(500, 2600, 0.5, 0.9, 'bandpass', 0, 3); tone(140, 90, 0.45, 0.4, 'sine'); tone(330, 440, 0.4, 0.12, 'triangle', 0.3); }, // a wet squeeze, then quiet
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
  swell(nextBeat, 60 / bpm);
  hits.push(...Music.beat(nextBeat, 60 / bpm, heat, life));
  nextBeat += 60 / bpm;
}

// ---------- the room and the place ----------
//
// Everything plays in the same wet room: a short, dark, dense reverb, as if heard through flesh.
// Under it runs a bed for the place you are in (see docs/art-audio-direction.md, section 7):
// rushing flow in a vessel that surges with each beat, thick slow flow in the liver,
// gurgles and churn in the stomach, wind that rises and falls with each breath in the lung.

function cavity(ac: AudioContext, out: AudioNode) {
  const len = Math.floor(ac.sampleRate * 1.6), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate;
      lp += 0.18 * ((Math.random() * 2 - 1) - lp); // darken as it goes: soft tissue swallows the highs
      d[i] = lp * Math.exp(-t * 3.4) * (i < ac.sampleRate * 0.012 ? i / (ac.sampleRate * 0.012) : 1);
    }
  }
  const send = ac.createGain(), cut = ac.createBiquadFilter(), verb = ac.createConvolver(), dark = ac.createBiquadFilter(), wet = ac.createGain();
  cut.type = 'highpass'; cut.frequency.value = 160; // keep the heart's low end dry and tight
  verb.buffer = ir;
  dark.type = 'lowpass'; dark.frequency.value = 2200;
  send.gain.value = 1; wet.gain.value = 0.32;
  master.connect(send).connect(cut).connect(verb).connect(dark).connect(wet).connect(out);
}

interface Bed { level: GainNode; filter: BiquadFilterNode }
let rush: Bed, surgeGain: GainNode, wind: Bed, churn: Bed, thick: Bed;
let place = '', gurgleAt = 0;

function loopNoise(ac: AudioContext, type: BiquadFilterType, freq: number, q: number, to: AudioNode): Bed {
  const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), level = ac.createGain();
  src.buffer = noise; src.loop = true;
  filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
  level.gain.value = 0;
  src.connect(filter).connect(level).connect(to);
  src.start(0, Math.random() * 2);
  return { level, filter };
}

function beds(ac: AudioContext) {
  surgeGain = ac.createGain(); surgeGain.gain.value = 0.35; surgeGain.connect(master);
  rush = loopNoise(ac, 'bandpass', 520, 0.8, surgeGain);
  thick = loopNoise(ac, 'lowpass', 150, 0.9, master);
  churn = loopNoise(ac, 'lowpass', 90, 2.5, master);
  wind = loopNoise(ac, 'bandpass', 700, 0.6, master);
}

/** Blood comes in surges: the rushing bed swells on each beat and coasts down before the next. */
function swell(at: number, len: number) {
  if (!ac || !rush) return;
  const g = surgeGain.gain, hard = place === 'artery' ? 1 : place === 'vein' ? 0.25 : place === 'liver' ? 0.15 : 0;
  g.cancelScheduledValues(at);
  g.setTargetAtTime(0.35 + hard * 0.9, at + 0.04, 0.05);
  g.setTargetAtTime(0.35, at + 0.18, len * 0.35);
}

function gurgle(at: number, size: number) {
  if (!ac) return;
  // A bubble of gas moving through a fold of gut: a low, wobbling tone in a burst of filtered noise.
  const o = ac.createOscillator(), g = ac.createGain(), base = 70 + Math.random() * 90, dur = 0.35 + size * 0.9;
  o.type = 'sine';
  o.frequency.setValueAtTime(base, at);
  for (let i = 1; i <= 6; i++) o.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.7), at + (dur * i) / 6);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.12 + size * 0.18, at + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at); o.stop(at + dur + 0.05);
  hiss(180 + Math.random() * 200, 90, dur, 0.2 + size * 0.3, 'lowpass', at - ac.currentTime, 2);
}

/** The bed for where you are. Call every frame. `place` is 'liver', 'artery', 'vein', 'stomach' or 'lung';
 *  `breath` is 0 to 1 lung fill, `digest` 0 to 1 how hard the stomach is working, and with `live` false
 *  (paused, a card up, the world map) every bed sinks to a murmur. */
export function scene(where: string, breath: number, digest: number, live: boolean) {
  if (!ac || !rush) return;
  const now = ac.currentTime, fade = where === place ? 0.25 : 0.8; // a new place cross-fades in over a second or two
  place = where;
  const quiet = live ? 1 : 0.2, set = (b: Bed, v: number) => b.level.gain.setTargetAtTime(v * quiet, now, fade);
  set(rush, where === 'artery' ? 0.5 : where === 'vein' ? 0.32 : where === 'liver' ? 0.12 : 0);
  rush.filter.frequency.setTargetAtTime(where === 'artery' ? 620 : 380, now, fade);
  set(thick, where === 'liver' ? 0.28 : where === 'vein' ? 0.18 : 0.06);
  set(churn, where === 'stomach' ? 0.35 + digest * 0.5 : 0);
  churn.filter.frequency.setTargetAtTime(70 + digest * 60, now, 0.5);
  // The lung: wind that rises as it fills and falls away as it empties.
  set(wind, where === 'lung' ? 0.08 + breath * 0.45 : 0);
  wind.filter.frequency.setTargetAtTime(450 + breath * 900, now, 0.2);
  if (where === 'stomach' && live && now > gurgleAt) {
    gurgle(now + 0.05, Math.random() * (0.3 + digest * 0.7));
    gurgleAt = now + (digest > 0.3 ? 0.8 : 2.2) + Math.random() * (digest > 0.3 ? 2 : 5);
  }
}

// ---------- outside: the interludes ----------
//
// In a scene from Marian's life the game's sound sinks behind flesh: the music and the body's
// beds drop to a dull murmur (her heart still comes through faintly), and a quiet room plays
// instead, itself a little muffled, as if heard through tissue. On the match cut back inside,
// the body returns hard. See docs/art-audio-direction.md, section 9.

let outBus: GainNode | null = null, hum: GainNode | null = null;

function outsideBus() {
  if (!ac || outBus) return;
  outBus = ac.createGain(); outBus.gain.value = 0.9;
  const dull = ac.createBiquadFilter(); dull.type = 'lowpass'; dull.frequency.value = 2400; dull.Q.value = 0.4;
  outBus.connect(dull).connect(ac.destination);
  // Room tone: a fridge's mains hum and the faint hiss of a quiet house.
  hum = ac.createGain(); hum.gain.value = 0; hum.connect(outBus);
  for (const [f, v] of [[50, 0.05], [100, 0.035], [150, 0.012]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f; g.gain.value = v; o.connect(g).connect(hum); o.start();
  }
  const air = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  air.buffer = noise; air.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5; g.gain.value = 0.05;
  air.connect(f).connect(g).connect(hum); air.start();
}

/** Starts or ends an interlude. `on` true: over about a second the game sinks and the room fades
 *  up. `on` false: the room cuts out and the body comes back hard, for the match cut. */
export function outside(on: boolean) {
  if (!ac || !muffle) return;
  outsideBus();
  const now = ac.currentTime, f = muffle.frequency;
  f.cancelScheduledValues(now); f.setValueAtTime(f.value, now);
  master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
  hum!.gain.cancelScheduledValues(now); hum!.gain.setValueAtTime(hum!.gain.value, now);
  if (on) {
    f.exponentialRampToValueAtTime(260, now + 1.2);
    master.gain.linearRampToValueAtTime(on && isOn() ? 0.35 : 0, now + 1.2);
    hum!.gain.linearRampToValueAtTime(isOn() ? 1 : 0, now + 1.5);
  } else {
    f.exponentialRampToValueAtTime(20000, now + 0.12);
    master.gain.linearRampToValueAtTime(isOn() ? 0.9 : 0, now + 0.12);
    hum!.gain.linearRampToValueAtTime(0, now + 0.08);
  }
}

function out(fn: (at: number, to: AudioNode) => void, delay = 0) {
  if (!ac || !on) return;
  outsideBus();
  fn(ac.currentTime + delay, outBus!);
}
function ping(at: number, to: AudioNode, freq: number, dur: number, vol: number) {
  const o = ac!.createOscillator(), g = ac!.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(to); o.start(at); o.stop(at + dur + 0.02);
}
function rustle(at: number, to: AudioNode, freq: number, dur: number, vol: number, q = 1) {
  const src = ac!.createBufferSource(), f = ac!.createBiquadFilter(), g = ac!.createGain();
  src.buffer = noise; src.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(to); src.start(at, Math.random()); src.stop(at + dur + 0.02);
}

/** The small sounds of the interludes. Each is quiet and domestic; none of them is music. */
export const room = {
  /** A spoon stirring and tapping the rim of the chipped mug. */
  spoon: () => out((t, to) => { for (let i = 0; i < 3; i++) rustle(t + i * 0.32, to, 1800, 0.25, 0.08, 3); ping(t + 1.05, to, 2650, 0.5, 0.06); ping(t + 1.05, to, 3980, 0.35, 0.03); ping(t + 1.3, to, 2650, 0.4, 0.04); }),
  /** An old dog's claws crossing a kitchen floor. */
  claws: () => out((t, to) => { for (let i = 0; i < 8; i++) rustle(t + i * 0.19 + Math.random() * 0.04, to, 3200 + Math.random() * 800, 0.03, 0.12, 4); }),
  /** A letter unfolded, or a brochure. */
  paper: () => out((t, to) => { rustle(t, to, 2200, 0.35, 0.12, 0.8); rustle(t + 0.4, to, 1600, 0.5, 0.1, 0.8); }),
  /** One long breath out. */
  sigh: () => out((t, to) => rustle(t, to, 700, 2.2, 0.16, 0.7)),
  /** A mug set down on a table. */
  set: () => out((t, to) => { ping(t, to, 180, 0.12, 0.2); rustle(t, to, 900, 0.08, 0.1, 2); }),
};

/** For the cut-scene score (src/cinema/score.ts): the context and the muffled room bus, once sound is on. */
export function outsideBusNow(): { ac: AudioContext; to: AudioNode; noise: AudioBuffer } | null {
  if (!ac || !on || !noise) return null;
  outsideBus();
  return { ac, to: outBus!, noise };
}
