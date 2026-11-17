// Which shots play for each scene, in order, and for how long. Shot lists follow the storyboards
// (creative/storyboards.md and interludes.md v3); the holds are the storyboards' seconds.
// main.ts plays a reel through Cinema when one exists for a scene's `when` key; a scene with no
// reel falls back to the old held pictures in scenes.ts.
//
// `print` is only for words a player must read that the frame cannot carry at phone size.
// `sound` names a room sound in audio.ts (Sound.room). `tone` names a room tone bed (score.ts).
import { cine } from './shots2';
import type { Liver } from './sets2';
import type { Mode } from './core';

export type RoomSound = 'spoon' | 'claws' | 'paper' | 'sigh' | 'set';
export type Tone = 'kitchen' | 'night' | 'clinic' | 'tv' | 'bedroom' | 'lab' | 'body' | 'car';
export interface Cut { shot: string; hold: number; print?: string; sound?: RoomSound }
export interface Reel { title: string; once: 'ever' | 'mission'; tone: Tone; motif?: 'first' | 'slow' | 'full'; cuts: Cut[] }

export const REELS: Record<string, Reel> = {
  // 0 · Injection (the cold open)
  begin: { title: 'Injection', once: 'ever', tone: 'clinic', cuts: [
    { shot: 'clinic-high', hold: 5 },
    { shot: 'syringe', hold: 5 },
    { shot: 'swarm', hold: 7 },
    { shot: 'title-host', hold: 3.5 },
  ] },
  // 1 · The plaster (Ch1)
  'home:1': { title: 'The plaster', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'kitchen-dawn', hold: 4.5, sound: 'spoon' },
    { shot: 'plaster', hold: 5.5, sound: 'claws' },
    { shot: 'mug-insert', hold: 2.5 },
    { shot: 'lift', hold: 3.5 },
    { shot: 'artery', hold: 3 },
  ] },
  // 3 · The letter (Ch2)
  letter: { title: 'The letter', once: 'mission', tone: 'night', motif: 'first', cuts: [
    { shot: 'kitchen-night', hold: 5, sound: 'paper' },
    { shot: 'letter-insert', hold: 6 },
    { shot: 'fridge-pin', hold: 5.5, print: 'TITHONUS. More mornings.' },
    { shot: 'side-touch', hold: 4 },
    { shot: 'liver-scan', hold: 3.5 },
  ] },
  // 2 · Evening (Ch3), and its variant when the ethanol correction was obeyed
  evening: { title: 'Evening', once: 'mission', tone: 'tv', cuts: [
    { shot: 'sofa-wide', hold: 5 },
    { shot: 'side-press', hold: 4.5 },
    { shot: 'glass-tilt', hold: 3.5 },
    { shot: 'liver-amber', hold: 3.5 },
  ] },
  'evening:corrected': { title: 'Evening', once: 'mission', tone: 'tv', cuts: [
    { shot: 'sofa-wide', hold: 5 },
    { shot: 'flush', hold: 4 },
    { shot: 'glass-tilt', hold: 3.5 },
    { shot: 'sink-pour', hold: 4, sound: 'set' },
    { shot: 'sofa-empty', hold: 5 },
    { shot: 'vein-clear', hold: 3 },
  ] },
  // 4 · The same heart (Ch3, only once the unit has woken)
  'same-heart': { title: 'The same heart', once: 'mission', tone: 'bedroom', motif: 'slow', cuts: [
    { shot: 'bedroom-wide', hold: 5 },
    { shot: 'dog-climb', hold: 6 },
    { shot: 'dog-ear', hold: 5 },
    { shot: 'unit-still', hold: 4 },
  ] },
  // 5 · The scan (Ch4): plays on the world map before the lungs leg
  lungs: { title: 'The scan', once: 'mission', tone: 'clinic', motif: 'full', cuts: [
    { shot: 'consult-wide', hold: 4.5 },
    { shot: 'ct-screen', hold: 5 },
    { shot: 'ct-label', hold: 3.5 },
    { shot: 'shoulders', hold: 5, sound: 'sigh' },
    { shot: 'lungs', hold: 4 },
  ] },
  'scan:again': { title: 'The scan, again', once: 'mission', tone: 'clinic', cuts: [
    { shot: 'ct-screen', hold: 4 },
    { shot: 'ct-recur', hold: 4.5 },
    { shot: 'not-breathing', hold: 5 },
    { shot: 'knot', hold: 3 },
  ] },
  // Endings (Ch5): one of these, then "The kitchen, after"
  'ending:slide': { title: 'The slide', once: 'mission', tone: 'lab', cuts: [
    { shot: 'lab-high', hold: 5 },
    { shot: 'tube-insert', hold: 5 },
    { shot: 'eyepiece-line', hold: 7 },
    { shot: 'sit-back', hold: 6 },
    { shot: 'phone-reach', hold: 4 },
    { shot: 'brochure-down', hold: 5 },
  ] },
  'ending:stranger': { title: "A stranger's slide", once: 'mission', tone: 'lab', cuts: [
    { shot: 'lab-stranger', hold: 5 },
    { shot: 'eyepiece-line', hold: 6 },
    { shot: 'phone-photo', hold: 5 },
    { shot: 'apheresis', hold: 5 },
    { shot: 'freezer', hold: 5 },
    { shot: 'coffee-alive', hold: 5, sound: 'spoon' },
  ] },
  'ending:artifact': { title: 'Artifact', once: 'mission', tone: 'lab', cuts: [
    { shot: 'eyepiece-odd', hold: 5 },
    { shot: 'pencil-artifact', hold: 4 },
    { shot: 'slide-wipe', hold: 3.5 },
    { shot: 'tube-rack', hold: 6 },
  ] },
  'ending:tithonus': { title: 'Tithonus', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'tithonus-tea', hold: 4 },
    { shot: 'tithonus-rack', hold: 4 },
    { shot: 'tithonus-radio', hold: 4 },
    { shot: 'tithonus-nine', hold: 4 },
    { shot: 'tithonus-gen4', hold: 6.5 }, // holds a beat too long, on purpose
  ] },
  'ending:repaired': { title: 'Repaired', once: 'mission', tone: 'car', cuts: [
    { shot: 'clinic-thumbs', hold: 5 },
    { shot: 'car-park', hold: 5 },
  ] },
  'ending:recalled': { title: 'Recalled', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'arm-healed', hold: 4 },
    { shot: 'after-wide', hold: 5 },
  ] },
  // Echoes (decisions-text.md 6): short, wordless, no score. Each shows a choice landing in her day.
  'echo:lfts': { title: 'Results', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'echo-fridge-lfts', hold: 4 },
    { shot: 'echo-read-lfts', hold: 4, sound: 'paper' },
  ] },
  'echo:reserve': { title: 'Reserve', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'echo-fridge-reserve', hold: 4 },
    { shot: 'echo-read-reserve', hold: 4, sound: 'paper' },
  ] },
  'echo:antacids': { title: 'Heartburn', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'antacid-mid', hold: 5 },
    { shot: 'antacid-tub', hold: 3 },
  ] },
  'echo:nap': { title: 'An afternoon', once: 'mission', tone: 'tv', cuts: [
    { shot: 'nap-wide', hold: 5, sound: 'sigh' },
    { shot: 'nap-mug', hold: 3 },
  ] },
  'echo:groggy': { title: 'A late morning', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'groggy-clock', hold: 3 },
    { shot: 'groggy-up', hold: 4 },
  ] },
  'echo:fridge3': { title: 'The fridge, again', once: 'mission', tone: 'night', cuts: [
    { shot: 'fridge3-mid', hold: 5 },
    { shot: 'fridge3-close', hold: 4 },
  ] },
  after: { title: 'The kitchen, after', once: 'mission', tone: 'kitchen', cuts: [
    { shot: 'after-wide', hold: 5 },
    { shot: 'after-fridge', hold: 4 },
    { shot: 'after-hook', hold: 3.5 },
    { shot: 'after-her', hold: 6 },
  ] },
};

export const reelFor = (when: string): Reel | null => REELS[when] ?? null;

/** How the scene is framed by how awake the unit is (art direction 9): CCTV, then an eye, then close. */
export const modeFor = (stage: number): Mode => (stage <= 1 ? 'footage' : stage === 2 ? 'eye' : 'close');

/** What the story has decided, set before a reel plays, so the frames show the ledger. */
export function brief(o: {
  stage: number; compliance: number; kin?: number; excised: number; goal: number;
  hostLowest?: number; maxHealth?: number; stripped?: number; corrected?: boolean; recurred?: boolean; gen4?: boolean; shingles?: boolean; stay?: boolean;
}) {
  cine.awake = o.stage >= 3;
  cine.compliance = o.compliance;
  cine.kin = o.kin ?? 0;
  cine.liver = (o.excised >= o.goal ? (o.recurred ? 'recur' : 'clean') : 'tumour') as Liver;
  const a = cine.after, max = o.maxHealth ?? 100;
  a.healthHigh = (o.hostLowest ?? max) >= max * 0.6;
  a.walked = (o.stripped ?? 0) <= 2;
  a.glass = !o.corrected;
  a.letterGone = o.excised >= o.goal;
  a.gen4 = !!o.gen4; a.shingles = !!o.shingles; a.stay = !!o.stay;
}
