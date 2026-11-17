// The cut scenes' sound: a room tone for each place, and one piano motif that the story earns.
// (art-audio-direction.md, section 9.) Everything is synthesised; nothing is louder than her
// kitchen would be. The motif is stated three times in the whole game:
//   first in The letter (three notes, unresolved), slower in The same heart (four notes),
//   and in full only in The scan, where it resolves on her long breath out.
import { outsideBusNow } from '../audio';
import type { Reel, Tone } from './reels';

type Bus = NonNullable<ReturnType<typeof outsideBusNow>>;
let bed: GainNode | null = null, timers: number[] = [], live: AudioScheduledSourceNode[] = [];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** A soft upright piano note: a few slightly stretched partials, each decaying faster the higher it is, and a felt hammer. */
function piano(b: Bus, at: number, midi: number, vel: number, len = 3.5) {
  const { ac, to } = b, f0 = hz(midi), out = ac.createGain(), tone = ac.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 900 + vel * 2200; // soft playing is darker
  out.gain.value = 0.11 * vel; out.connect(tone).connect(to);
  [1, 2, 3, 4, 5, 6].forEach((n, i) => {
    const o = ac.createOscillator(), g = ac.createGain(), f = f0 * n * (1 + 0.0004 * n * n); // string stiffness stretches the partials
    o.frequency.value = f; o.type = 'sine';
    const amp = [1, 0.5, 0.28, 0.14, 0.08, 0.04][i], dec = len / (1 + i * 0.9);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(amp, at + 0.006); g.gain.exponentialRampToValueAtTime(amp * 0.4, at + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
    o.connect(g).connect(out); o.start(at); o.stop(at + dec + 0.05); live.push(o);
  });
  // the felt hammer: a short dull thump
  const src = ac.createBufferSource(), hf = ac.createBiquadFilter(), hg = ac.createGain();
  src.buffer = b.noise; hf.type = 'lowpass'; hf.frequency.value = 600; hg.gain.setValueAtTime(0.0001, at); hg.gain.exponentialRampToValueAtTime(0.05 * vel, at + 0.003); hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(hf).connect(hg).connect(out); src.start(at, Math.random()); src.stop(at + 0.08); live.push(src);
}

// The motif: up a fourth and a step, a lean on the sixth, then home. A minor, nothing showy.
const PHRASE = [64, 69, 71, 72, 71, 69]; // E4 A4 B4 C5 B4 A4
const BASS = [45, 41, 48, 45]; // A2 F2 C3 A2, under the full statement only

function motif(b: Bus, kind: 'first' | 'slow' | 'full') {
  const t0 = b.ac.currentTime + 0.4;
  if (kind === 'first') PHRASE.slice(0, 3).forEach((m, i) => piano(b, t0 + i * 1.15, m, 0.42 - i * 0.04)); // it stops on the step, unresolved
  else if (kind === 'slow') PHRASE.slice(0, 4).forEach((m, i) => piano(b, t0 + i * 1.7, m, 0.38, 4.5));
  else {
    PHRASE.forEach((m, i) => piano(b, t0 + i * 1.05 + (i === 3 ? 0.35 : 0), m, 0.5 - Math.abs(i - 3) * 0.04, 4)); // a breath before the high note
    BASS.forEach((m, i) => piano(b, t0 + i * 1.6, m, 0.36, 5));
    piano(b, t0 + 6.9, 57, 0.3, 6); piano(b, t0 + 6.9, 64, 0.26, 6); // and it lands, on her breath out
  }
}

/** Room tones: the small continuous sounds of each place, quiet under everything. */
function loop(b: Bus, type: BiquadFilterType, freq: number, q: number, vol: number, to: AudioNode) {
  const s = b.ac.createBufferSource(), f = b.ac.createBiquadFilter(), g = b.ac.createGain();
  s.buffer = b.noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f).connect(g).connect(to); s.start(0, Math.random() * 2); live.push(s);
  return g;
}
function hum(b: Bus, f: number, vol: number, to: AudioNode) { const o = b.ac.createOscillator(), g = b.ac.createGain(); o.frequency.value = f; g.gain.value = vol; o.connect(g).connect(to); o.start(); live.push(o); }
function chirp(b: Bus, at: number, to: AudioNode) {
  // a garden bird, far off through the window glass: two or three quick downward whistles
  const n = 2 + Math.floor(Math.random() * 2), base = 3200 + Math.random() * 1400;
  for (let i = 0; i < n; i++) {
    const o = b.ac.createOscillator(), g = b.ac.createGain(), t = at + i * 0.13;
    o.frequency.setValueAtTime(base * 1.15, t); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(to); o.start(t); o.stop(t + 0.12); live.push(o);
  }
}
function tick(b: Bus, at: number, to: AudioNode, f = 2400, vol = 0.02) {
  const s = b.ac.createBufferSource(), fl = b.ac.createBiquadFilter(), g = b.ac.createGain();
  s.buffer = b.noise; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 6;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  s.connect(fl).connect(g).connect(to); s.start(at, Math.random()); s.stop(at + 0.04); live.push(s);
}
function car(b: Bus, at: number, to: AudioNode) {
  // a car passing in the street outside: a broad swell of tyre noise, there and gone in four seconds
  const s = b.ac.createBufferSource(), f = b.ac.createBiquadFilter(), g = b.ac.createGain();
  s.buffer = b.noise; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(300, at); f.frequency.linearRampToValueAtTime(900, at + 2); f.frequency.linearRampToValueAtTime(250, at + 4);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05, at + 2); g.gain.exponentialRampToValueAtTime(0.0001, at + 4.2);
  s.connect(f).connect(g).connect(to); s.start(at, Math.random()); s.stop(at + 4.3); live.push(s);
}

function every(ms: () => number, fn: () => void) { const go = () => { fn(); timers.push(window.setTimeout(go, ms())); }; timers.push(window.setTimeout(go, ms())); }

function tone(b: Bus, kind: Tone, to: AudioNode) {
  const now = () => b.ac.currentTime + 0.02;
  if (kind === 'kitchen') { every(() => 1800 + Math.random() * 3600, () => chirp(b, now(), to)); every(() => 2600 + Math.random() * 3000, () => tick(b, now(), to, 3400, 0.01)); } // birds; the kettle ticking as it cools
  if (kind === 'night') { every(() => 1000, () => tick(b, now(), to, 2000, 0.012)); every(() => 9000 + Math.random() * 7000, () => car(b, now(), to)); } // a clock; a car now and then
  if (kind === 'clinic' || kind === 'lab') { hum(b, 100, 0.012, to); hum(b, 120, 0.006, to); loop(b, 'lowpass', 260, 0.7, 0.04, to); } // fluorescent tubes; air handling
  if (kind === 'lab') every(() => 1000, () => tick(b, now(), to, 1800, 0.008));
  if (kind === 'tv') {
    // a television in the next room's register: speech-shaped murmur, never words
    const g = loop(b, 'bandpass', 520, 1.4, 0.0, to);
    every(() => 180 + Math.random() * 220, () => { const t = now(); g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(Math.random() < 0.25 ? 0.002 : 0.012 + Math.random() * 0.02, t, 0.04); });
  }
  if (kind === 'bedroom') { every(() => 7000 + Math.random() * 6000, () => car(b, now(), to)); every(() => 1000, () => tick(b, now(), to, 1600, 0.006)); }
  if (kind === 'car') { loop(b, 'lowpass', 400, 0.5, 0.05, to); every(() => 2500 + Math.random() * 3000, () => chirp(b, now(), to)); }
}

export function start(reel: Reel, still: boolean) {
  stop(0);
  const b = outsideBusNow(); if (!b) return;
  bed = b.ac.createGain(); bed.gain.value = 0; bed.connect(b.to);
  bed.gain.setTargetAtTime(1, b.ac.currentTime, still ? 0.01 : 0.6);
  tone(b, reel.tone, bed);
}
/** Each cut: the motif comes in where the story has earned it. */
export function cut(k: number, reel: Reel) {
  const b = outsideBusNow(); if (!b || !reel.motif) return;
  if ((reel.motif === 'first' && k === 1) || (reel.motif === 'slow' && k === 1) || (reel.motif === 'full' && k === 2)) motif(b, reel.motif);
}
export function stop(fade: number) {
  timers.forEach(clearTimeout); timers = [];
  const b = outsideBusNow(), g = bed, srcs = live;
  bed = null; live = [];
  if (!b || !g) { srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); return; }
  g.gain.setTargetAtTime(0, b.ac.currentTime, Math.max(0.01, fade / 3));
  window.setTimeout(() => { srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); g.disconnect(); }, fade * 1000 + 300);
}
