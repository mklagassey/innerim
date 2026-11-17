// Interludes: short scenes outside the game loop, the host's ordinary life seen from outside
// (docs/interludes.md, owned by the creative director). main.ts plays them. Slow fades, never a flash.
//
// Each beat is one held picture. `art` is inline SVG drawn by art and audio (viewBox 0 0 320 200);
// until a beat has art, `seen` is shown as a plain stage direction in its place. `print` is for
// words that would really be printed in the scene (a letter, a label), and is the only text the
// finished scenes carry.
export type Light = 'clinic' | 'day' | 'dusk' | 'night' | 'dawn';
export interface Beat { seen: string; print?: string; art?: string; hold: number; light?: Light }
export interface Scene { when: string; title: string; once: 'ever' | 'mission'; light: Light; beats: Beat[] }

// `when` keys: 'begin' (the cold open), 'home:N' (back at the heart after trip N).
export const SCENES: Scene[] = [
  { when: 'begin', title: 'More mornings', once: 'ever', light: 'night', beats: [
    { seen: 'Night, a hospital lab. A woman at a microscope, seen from behind. A chipped mug beside her.', hold: 5 },
    { seen: 'Her kitchen. An envelope, opened, on the table.', print: '“…not medically necessary at this time.”', hold: 5.5, light: 'dusk' },
    { seen: 'She pins the letter to the fridge with a magnet, next to a glossy brochure.', print: 'TITHONUS. More mornings.', hold: 5.5, light: 'dusk' },
    { seen: 'An old grey-muzzled dog watches her from its bed.', hold: 4, light: 'dusk' },
    { seen: 'A clinic. Her forearm, a gloved hand, a syringe.', print: 'H-O · GEN 3', hold: 5, light: 'clinic' },
    { seen: 'The plunger goes down. Inside the vein, a slow cloud of tiny lights pours into the dark red current: millions of them, and one among them, no different.', hold: 7, light: 'clinic' },
    { seen: '', print: 'HOST', hold: 3.5, light: 'night' },
  ] },
  { when: 'home:1', title: 'The plaster', once: 'mission', light: 'dawn', beats: [
    { seen: 'Morning, the kitchen. Coffee in the chipped mug.', hold: 4.5 },
    { seen: 'A small plaster on her forearm. She scratches at it without noticing. The dog nudges the leash on its hook.', hold: 5.5 },
    { seen: 'She lifts the mug. The artery surges.', hold: 4 },
  ] },
];

export const sceneFor = (when: string): Scene | null => SCENES.find((s) => s.when === when) ?? null;
