// Interludes: short scenes outside the game loop, the host's ordinary life seen from outside
// (docs/interludes.md, owned by the creative director). main.ts plays them. Slow fades, never a flash.
//
// Each beat is one held picture. `pic` names one drawn by art and audio (scene-art.ts), framed by how awake the unit is;
// until a beat has one, `seen` is shown as a plain stage direction in its place. `print` is for
// words that would really be printed in the scene (a letter, a label), and is the only text the
// finished scenes carry.
import { Picture } from './scene-art';

export type Light = 'clinic' | 'day' | 'dusk' | 'night' | 'dawn';
export type RoomSound = 'spoon' | 'claws' | 'paper' | 'sigh' | 'set';
export interface Beat { seen: string; print?: string; pic?: Picture; hold: number; light?: Light; sound?: RoomSound }
export interface Scene { when: string; title: string; once: 'ever' | 'mission'; light: Light; beats: Beat[] }

// `when` keys: 'begin' (the cold open), 'home:N' (back at the heart after trip N).
export const SCENES: Scene[] = [
  { when: 'begin', title: 'Injection', once: 'ever', light: 'clinic', beats: [
    { seen: 'A clinic, shot wide and high like a ceiling camera. A woman in a chair, sleeve rolled up. We never see her face.', pic: 'chair', hold: 5, light: 'clinic' },
    { seen: 'Her forearm, a gloved hand, a syringe.', print: 'H-O · GEN 3 · TITHONUS 0001', pic: 'clinic', hold: 5, light: 'clinic' },
    { seen: 'The plunger goes down. Inside the vein, a slow cloud of tiny lights pours into the dark red current: millions of them, and one among them, no different.', pic: 'swarm', hold: 7, light: 'night' },
    { seen: '', print: 'HOST', hold: 3.5, light: 'night' },
  ] },
  { when: 'home:1', title: 'The plaster', once: 'mission', light: 'dawn', beats: [
    { seen: 'Morning, the kitchen. Coffee in the chipped mug.', pic: 'coffee', sound: 'spoon', hold: 4.5 },
    { seen: 'A small plaster on her forearm. She scratches at it without noticing. The dog nudges the leash on its hook.', pic: 'plaster', sound: 'claws', hold: 5.5 },
    { seen: 'She lifts the mug. The artery surges.', pic: 'lift', hold: 4 },
  ] },
  { when: 'home:2', title: 'The letter', once: 'mission', light: 'night', beats: [
    { seen: 'Night. The kitchen light is the only one on in the house. She takes the letter down from the fridge.', pic: 'fridge', sound: 'paper', hold: 5 },
    { seen: 'The letter, close enough to read at last.', print: '“…not medically necessary at this time.”', pic: 'letter', hold: 5.5 },
    { seen: 'She looks at the brochure still on the fridge, then pins them both back up, side by side.', print: 'TITHONUS. More mornings.', pic: 'fridge', hold: 5.5 },
    { seen: 'She touches her right side, under the ribs. The liver, and the ringed knot on the scan.', pic: 'side', hold: 4.5 },
  ] },
];

export const sceneFor = (when: string): Scene | null => SCENES.find((s) => s.when === when) ?? null;
