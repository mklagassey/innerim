// Pictures for the interludes (src/scenes.ts): paper cut-outs in lamplight.
// Rules in docs/art-audio-direction.md, section 9: flat shapes, 2 or 3 tones and one warm light,
// Marian only from behind, in profile against the light, or as hands. At most one slow moving
// thing per picture (under 0.5 Hz), no flashing. Words never go in the picture: they are `print`.
//
// Every picture is viewBox 0 0 320 200. The motifs are drawn the same way every time: the mug has
// its chip on the left of the rim, the dog is a grey-muzzled mutt with one ear folded.

const BODIES = new Map<string, { body: string; label: string }>();
const svg = (body: string, label: string) => {
  const out = `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${body}</svg>`;
  BODIES.set(out, { body, label });
  return out;
};

/** A soft pool of light: the only gradient a picture is allowed. */
const pool = (id: string, cx: number, cy: number, r: number, color: string, a = 0.55) =>
  `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${a}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#${id})"/>`;

/** The chipped lab mug, at (x, y) = bottom centre, about 22 units tall. */
const mug = (x: number, y: number, fill: string, rim: string) =>
  `<g transform="translate(${x} ${y})"><path d="M-10 0 L-11 -21 L11 -21 L10 0 Z" fill="${fill}"/><path d="M11 -17 q8 0 8 7 q0 7 -8 7" fill="none" stroke="${fill}" stroke-width="3"/><path d="M-11 -21 L11 -21" stroke="${rim}" stroke-width="1.2"/><path d="M-11 -21.6 l3 0 l-1.4 2.6 z" fill="#0b0809"/></g>`;

/** Steam that rises and fades, slowly. */
const steam = (x: number, y: number, color: string) =>
  `<g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.45">` +
  [0, 1].map((k) => `<path d="M${x - 3 + k * 6} ${y} q-4 -8 0 -14 q4 -6 0 -14"><animate attributeName="opacity" values="0;0.8;0" dur="5s" begin="${k * 2.5}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -6" dur="5s" begin="${k * 2.5}s" repeatCount="indefinite"/></path>`).join('') + '</g>';

/** The dog lying in its bed, seen side on, breathing slowly. Head up if `watching`. */
const dog = (x: number, y: number, body: string, muzzle: string, watching: boolean) =>
  `<g transform="translate(${x} ${y})">` +
  `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1.04;1 1" dur="4.2s" repeatCount="indefinite" additive="sum"/>` +
  `<path d="M-38 0 q0 -22 30 -24 q30 -2 38 10 q6 10 0 14 z" fill="${body}"/></g>` +
  (watching
    ? `<path d="M22 -12 q6 -16 18 -18 q10 -1 14 6 l6 4 q2 4 -3 5 l-10 1 q-6 6 -16 6 z" fill="${body}"/><path d="M54 -18 l6 4 q2 4 -3 5 l-8 1 q-2 -6 5 -10 z" fill="${muzzle}"/><path d="M36 -27 q-6 2 -4 12 q4 -2 7 -8 z" fill="${body}"/><circle cx="48" cy="-20" r="1.3" fill="#e8d8b8"/>`
    : `<path d="M22 -6 q10 -10 26 -6 q8 2 6 7 q-6 4 -20 3 z" fill="${body}"/><path d="M48 -10 q8 2 6 7 l-8 0 z" fill="${muzzle}"/>`) +
  `<path d="M-38 0 q-10 -2 -12 -8" fill="none" stroke="${body}" stroke-width="4" stroke-linecap="round"/></g>`;

// Palettes, from the style guide.
const NIGHT = { bg: '#0d0a12', mid: '#241c2c', dark: '#07050a', lamp: '#e8b36a' };
const DUSK = { bg: '#1a0f0c', mid: '#3a2219', dark: '#0b0605', lamp: '#d9874a' };
const DAWN = { bg: '#18120e', mid: '#4a3324', dark: '#0c0806', lamp: '#f0c48a' };
const CLINIC = { bg: '#0e1416', mid: '#2c3a3e', dark: '#070b0c', lamp: '#cfe0e4' };

export const ART = {
  /** Her right side: in profile against the window, two fingers pressed under her ribs, where the liver is. */
  side: svg(
    `<rect width="320" height="200" fill="${DUSK.bg}"/>` +
    `<rect x="150" y="10" width="130" height="150" fill="#5a2c18"/>` + pool('sd', 215, 80, 150, DUSK.lamp, 0.45) +
    `<rect x="213" y="10" width="3" height="150" fill="${DUSK.bg}"/><rect x="150" y="82" width="130" height="3" fill="${DUSK.bg}"/>` +
    `<path d="M0 170 L320 162 L320 200 L0 200 Z" fill="${DUSK.mid}"/>` +
    // her in profile, facing right, a dark shape against the lit window: head, neck, shoulder, the curve of her back
    `<path d="M150 40 q14 -4 22 6 q6 8 4 16 l6 8 l-6 2 q0 8 -6 10 q-4 2 -8 0 l0 10 q26 8 28 40 l4 50 l-70 0 l2 -50 q2 -34 18 -46 q-6 -8 -6 -20 q0 -20 12 -26 z" fill="${DUSK.dark}"/>` +
    // hair gathered at the back of her head
    `<circle cx="146" cy="50" r="9" fill="${DUSK.dark}"/>` +
    // her right arm, bent, two fingers pressed under the ribs at the front
    `<path d="M150 104 q-6 26 8 40 q12 8 22 2 l2 -6 q-12 2 -20 -4 q-8 -10 -4 -32 z" fill="${DUSK.dark}"/>` +
    // the hand: flat against the front of her, just below the ribs, fingers slightly spread
    `<path d="M176 132 q8 -4 14 -2 q4 2 2 6 l-2 6 q-2 4 -8 4 q-6 0 -8 -4 z" fill="${DUSK.dark}"/>` +
    // window light along the forearm and the knuckles, so the hand reads against her body
    `<path d="M158 142 q12 8 22 2" fill="none" stroke="${DUSK.lamp}" stroke-opacity="0.45" stroke-width="1.2"/>` +
    `<path d="M178 131 q7 -4 12 -2 q4 2 2 6" fill="none" stroke="${DUSK.lamp}" stroke-opacity="0.6" stroke-width="1.2"/>` +
    // the window light catching the edge of her profile
    `<path d="M176 62 l6 8 l-6 2 q0 8 -6 10" fill="none" stroke="${DUSK.lamp}" stroke-opacity="0.5" stroke-width="1.2"/>` +
    mug(266, 162, DUSK.dark, DUSK.lamp),
    'A woman in profile against an evening window, two fingers pressed under her right ribs.'),
  /** A clinic seen from a ceiling camera: a woman in a chair, sleeve rolled up, face turned away. */
  chair: svg(
    `<rect width="320" height="200" fill="${CLINIC.bg}"/>` + pool('ch', 170, 90, 150, CLINIC.lamp, 0.32) +
    // floor tiles seen from above and the chair from high up: a clinical, observed angle
    `<path d="M0 90 L320 70 L320 200 L0 200 Z" fill="${CLINIC.mid}"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${k * 56 - 20} 200 L${k * 46 + 10} 80" stroke="#22302f" stroke-width="1"/>`).join('') +
    `<path d="M0 130 L320 112" stroke="#22302f" stroke-width="1"/><path d="M0 165 L320 150" stroke="#22302f" stroke-width="1"/>` +
    // trolley with a tray
    `<rect x="226" y="98" width="46" height="6" fill="#5a6c72"/><rect x="230" y="104" width="3" height="34" fill="#3a4c52"/><rect x="266" y="104" width="3" height="34" fill="#3a4c52"/><rect x="242" y="90" width="5" height="8" fill="#a9c6cc"/>` +
    // the reclining chair, and her in it: shoulders, the back of her head, one arm out on the rest, sleeve rolled
    `<path d="M120 150 l70 -12 l10 22 l-70 12 z" fill="#1d2729"/><path d="M110 120 l30 -6 l14 36 l-30 6 z" fill="#1d2729"/>` +
    `<path d="M126 136 q-4 -20 10 -26 q14 -4 22 8 q10 14 20 22 l-12 12 q-22 4 -36 -4 z" fill="${CLINIC.dark}"/><circle cx="132" cy="114" r="9" fill="${CLINIC.dark}"/>` +
    `<path d="M176 140 l46 -10 l2 6 l-46 10 z" fill="${CLINIC.dark}"/><rect x="170" y="139" width="8" height="8" fill="#8fa7ae" transform="rotate(-12 174 143)"/>` +
    // the nurse, standing, gloved hands at her arm
    `<path d="M214 60 q12 -6 20 4 q6 10 0 30 l6 40 l-30 4 l2 -40 q-8 -24 2 -38 z" fill="#3e5258"/><circle cx="222" cy="52" r="8" fill="#2b3a3e"/><path d="M212 108 q-2 14 6 22 l6 -2 q-6 -8 -4 -20 z" fill="#8fb7c4"/>`,
    'A clinic seen from high in a corner. A woman in a reclining chair, sleeve rolled up, her face turned away. A nurse beside her.'),

  /** Night, a hospital lab: Marian from behind at a microscope, the mug beside her. */
  lab: svg(
    `<rect width="320" height="200" fill="${NIGHT.bg}"/>` + pool('labL', 196, 92, 120, NIGHT.lamp, 0.45) +
    // bench and the lamp over it
    `<rect x="0" y="132" width="320" height="68" fill="${NIGHT.mid}"/><rect x="0" y="128" width="320" height="6" fill="#3a2e40"/>` +
    `<path d="M222 40 l-30 28 l4 4 l30 -28 z" fill="${NIGHT.mid}"/><path d="M178 66 l26 -6 l2 12 l-24 6 z" fill="${NIGHT.mid}"/>` +
    // microscope
    `<path d="M168 128 l26 0 l-2 -6 l-22 0 z M180 122 l0 -14 l8 0 l0 14 z M176 108 l14 -26 l7 4 l-12 24 z M190 80 l10 -8 l4 4 l-10 8 z" fill="${NIGHT.dark}"/>` +
    // Marian, from behind: shoulders, hair gathered up, one elbow on the bench
    `<path d="M92 200 q-6 -46 14 -66 q14 -12 34 -10 q20 2 30 18 q10 16 8 58 z" fill="${NIGHT.dark}"/>` +
    `<path d="M120 126 q-8 -20 6 -32 q16 -10 28 4 q8 12 -2 28 q-10 8 -32 0 z" fill="${NIGHT.dark}"/><circle cx="140" cy="90" r="9" fill="${NIGHT.dark}"/>` +
    `<path d="M164 140 q10 -10 14 -14 l6 4 q-6 8 -14 16 z" fill="${NIGHT.dark}"/>` +
    // a rim of lamplight on her shoulder
    `<path d="M150 124 q16 2 24 16" fill="none" stroke="${NIGHT.lamp}" stroke-opacity="0.35" stroke-width="1.5"/>` +
    mug(238, 130, NIGHT.dark, NIGHT.lamp),
    'A lab at night. A woman, seen from behind, bent over a microscope. A chipped mug beside her.'),

  /** Her kitchen at dusk: an opened envelope on the table. */
  letter: svg(
    `<rect width="320" height="200" fill="${DUSK.bg}"/>` +
    // window, dusk outside
    `<rect x="196" y="22" width="92" height="74" fill="#5a2c18"/>` + pool('dusk', 242, 60, 120, DUSK.lamp, 0.4) +
    `<rect x="240" y="22" width="3" height="74" fill="${DUSK.bg}"/><rect x="196" y="58" width="92" height="3" fill="${DUSK.bg}"/>` +
    // table
    `<path d="M0 132 L320 120 L320 200 L0 200 Z" fill="${DUSK.mid}"/>` +
    // envelope and the letter half out of it, lit by the window
    `<path d="M104 150 l64 -10 l8 26 l-64 10 z" fill="#c9a07a"/><path d="M104 150 l36 8 l28 -18" fill="none" stroke="#8a6448" stroke-width="1"/>` +
    `<path d="M132 138 l58 -9 l9 34 l-58 9 z" fill="#ead6bc"/>` +
    [0, 1, 2, 3].map((k) => `<path d="M${140 + k * 0.6} ${146 + k * 6} l${36 - (k === 3 ? 14 : 0)} -5.4" stroke="#8c7a68" stroke-width="1.4"/>`).join('') +
    mug(66, 140, DUSK.dark, DUSK.lamp),
    'A kitchen table at dusk. An opened envelope, a letter half out of it.'),

  /** The fridge: the letter pinned under a magnet beside the glossy brochure, her hand still at the magnet. */
  fridge: svg(
    `<rect width="320" height="200" fill="${DUSK.bg}"/>` + pool('fr', 150, 80, 150, DUSK.lamp, 0.25) +
    `<rect x="70" y="0" width="170" height="200" rx="8" fill="${DUSK.mid}"/><rect x="226" y="40" width="5" height="60" rx="2" fill="${DUSK.dark}"/>` +
    // letter, slightly crooked, and the magnet
    `<g transform="rotate(-4 120 90)"><rect x="92" y="52" width="58" height="76" fill="#ead6bc"/>` +
    [0, 1, 2, 3, 4, 5].map((k) => `<rect x="99" y="${66 + k * 8}" width="${k === 5 ? 22 : 44}" height="2" fill="#8c7a68"/>`).join('') + `</g>` +
    `<circle cx="120" cy="56" r="6" fill="#a8382c"/>` +
    // the brochure: glossy, a sunrise on its cover
    `<rect x="160" y="58" width="50" height="68" fill="#e9d2a6"/><circle cx="185" cy="98" r="14" fill="#e8a04a"/><rect x="160" y="98" width="50" height="28" fill="#c97c3c"/><rect x="166" y="66" width="38" height="5" fill="#5a3a2a"/>` +
    // her hand and forearm reaching in from the left, fingers on the magnet
    `<path d="M0 86 q60 -18 104 -30 q10 -2 14 2 q2 4 -4 6 q4 2 2 6 q-2 3 -8 2 q-40 10 -108 34 z" fill="${DUSK.dark}"/>`,
    'A fridge door. A letter pinned under a magnet, a hand still pressing it. Beside it, a glossy brochure with a sunrise.'),

  /** The old dog in its bed, watching her. */
  dog: svg(
    `<rect width="320" height="200" fill="${DUSK.bg}"/>` + pool('dg', 200, 120, 130, DUSK.lamp, 0.3) +
    `<rect x="0" y="150" width="320" height="50" fill="${DUSK.mid}"/>` +
    `<ellipse cx="160" cy="156" rx="78" ry="16" fill="#2a1712"/><path d="M82 156 q0 -20 18 -22 l120 0 q18 2 18 22" fill="#2a1712"/>` +
    dog(150, 152, DUSK.dark, '#6b6460', true),
    'An old dog with a grey muzzle lies in its bed, head up, watching.'),

  /** A clinic: her forearm laid out, a gloved hand with a syringe, the vial on the tray. */
  clinic: svg(
    `<rect width="320" height="200" fill="${CLINIC.bg}"/>` + pool('cl', 160, 70, 160, CLINIC.lamp, 0.3) +
    `<rect x="0" y="120" width="320" height="80" fill="${CLINIC.mid}"/>` +
    // her forearm across the frame, palm up, from the right
    `<path d="M320 112 L120 124 q-14 2 -16 10 q2 8 16 8 L320 140 Z" fill="${CLINIC.dark}"/><path d="M104 134 q-12 -2 -22 4 q4 6 20 4 z" fill="${CLINIC.dark}"/>` +
    // a tourniquet band
    `<rect x="236" y="111" width="10" height="31" fill="#4a6a74"/>` +
    // the gloved hand and syringe, from above
    `<g transform="rotate(32 196 98)"><rect x="168" y="94" width="40" height="8" rx="1" fill="#d8e6ea"/><rect x="208" y="97" width="16" height="2" fill="#d8e6ea"/><rect x="152" y="96" width="16" height="4" fill="#9ab"/>` +
    // the gloved hand: the back of the hand above the barrel, fingers curled under it, thumb on the plunger
    `<path d="M150 70 q8 -18 34 -16 q14 2 16 14 l0 26 l-40 0 q-14 -8 -10 -24 z" fill="#8fb7c4"/>` +
    [0, 1, 2].map((k) => `<rect x="${172 + k * 9}" y="92" width="8" height="16" rx="4" fill="#7ea6b4"/>`).join('') +
    `<path d="M152 84 q-8 4 -4 14 l8 0 q2 -8 4 -12 z" fill="#7ea6b4"/></g>` +
    // the vial on a steel tray
    `<rect x="36" y="150" width="70" height="8" rx="2" fill="#5a6c72"/><rect x="58" y="128" width="14" height="22" rx="2" fill="#a9c6cc"/><rect x="58" y="128" width="14" height="5" fill="#3a4c52"/><rect x="58" y="138" width="14" height="7" fill="#e9eef0"/>`,
    'A clinic. A forearm laid out, a gloved hand bringing a syringe to it. A small vial on a steel tray.'),

  /** The match cut: inside the vein, a slow cloud of tiny lights pours into the dark red current. */
  swarm: svg(
    `<rect width="320" height="200" fill="#1a0306"/>` + pool('vn', 80, 100, 220, '#7a0f1a', 0.7) +
    // the vessel wall, soft and dark at top and bottom
    `<path d="M0 0 L320 0 L320 34 q-80 14 -160 6 q-80 -8 -160 8 Z" fill="#0d0204"/><path d="M0 200 L320 200 L320 168 q-80 -12 -160 -4 q-80 8 -160 -6 Z" fill="#0d0204"/>` +
    // red cells drifting
    [[230, 70, 10], [270, 130, 12], [120, 150, 9], [300, 90, 8], [180, 120, 11]].map(([x, y, r]) =>
      `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="#8c1420"/><ellipse cx="${x}" cy="${y}" rx="${r * 0.45}" ry="${r * 0.22}" fill="#5e0c15"/><animateTransform attributeName="transform" type="translate" values="0 0;-26 2" dur="14s" repeatCount="indefinite"/></g>`).join('') +
    // the lights: pouring in from the needle on the left, spreading as they go. One a little apart.
    `<g fill="#bfefff">` + Array.from({ length: 70 }, (_, i) => {
      const t = i / 70, x = 14 + t * 250 + ((i * 37) % 11), y = 100 + Math.sin(i * 2.3) * (6 + t * 46), r = 0.8 + ((i * 13) % 5) * 0.18;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${(0.35 + ((i * 7) % 6) * 0.1).toFixed(2)}"/>`;
    }).join('') +
    `<animateTransform attributeName="transform" type="translate" values="-6 0;6 0" dur="9s" repeatCount="indefinite"/></g>` +
    `<circle cx="196" cy="126" r="1.6" fill="#e9fbff"/>`,
    'Inside a vein: a slow cloud of tiny lights pouring into the dark red current. Millions of them, and one among them.'),

  /** Morning, the kitchen: coffee steaming in the chipped mug. */
  coffee: svg(
    `<rect width="320" height="200" fill="${DAWN.bg}"/>` +
    `<rect x="40" y="18" width="110" height="80" fill="#5a3e28"/>` + pool('dw', 95, 60, 150, DAWN.lamp, 0.45) +
    `<rect x="93" y="18" width="3" height="80" fill="${DAWN.bg}"/><rect x="40" y="56" width="110" height="3" fill="${DAWN.bg}"/>` +
    `<path d="M0 138 L320 128 L320 200 L0 200 Z" fill="${DAWN.mid}"/>` +
    mug(184, 140, DAWN.dark, DAWN.lamp) + steam(183, 112, DAWN.lamp),
    'Morning in the kitchen. Coffee steaming in the chipped mug.'),

  /** The plaster on her forearm, her fingers at it; behind, the dog nudges the leash on its hook. */
  plaster: svg(
    `<rect width="320" height="200" fill="${DAWN.bg}"/>` + pool('pl', 160, 90, 170, DAWN.lamp, 0.35) +
    // the leash on its hook by the door, and the dog's head nosing it
    `<rect x="246" y="20" width="60" height="150" fill="${DAWN.mid}"/><rect x="232" y="56" width="6" height="4" fill="#7a5a3c"/>` +
    `<path d="M235 60 q-4 30 4 48 q4 10 -2 18" fill="none" stroke="#7a3428" stroke-width="2.4"/>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;-3 -2;0 0" dur="3.6s" repeatCount="indefinite"/>` +
    `<path d="M320 150 q-40 -6 -58 -22 q-8 -8 -2 -14 l12 -2 q10 -10 22 -4 q10 4 26 6 z" fill="${DAWN.dark}"/><path d="M260 114 l-6 -2 q-4 4 0 8 l8 0 z" fill="#6b6460"/></g>` +
    // her forearm and the plaster, her other hand's fingers scratching at it
    `<path d="M0 132 L180 118 q14 -1 16 8 q-2 9 -16 10 L0 160 Z" fill="${DAWN.dark}"/>` +
    `<rect x="112" y="122" width="18" height="10" rx="3" fill="#d6b48e" transform="rotate(-5 121 127)"/>` +
    // her other hand coming down from above, three fingertips resting on the plaster
    `<path d="M168 20 q-6 40 -18 70 q-4 10 -14 14 l-16 2 q-6 -4 -2 -10 l10 -6 q6 -30 8 -70 z" fill="${DAWN.dark}"/>` +
    [0, 1, 2].map((k) => `<rect x="${110 + k * 7}" y="${100 + k * 1.5}" width="6" height="${20 - k * 2}" rx="3" fill="${DAWN.dark}" transform="rotate(${-8 + k * 4} ${113 + k * 7} ${100 + k * 1.5})"/>`).join(''),
    'A forearm with a small plaster; fingers scratch at it. Behind, an old dog nudges a leash hanging on its hook.'),

  /** She lifts the mug: the match cut into the surging artery. */
  lift: svg(
    `<rect width="320" height="200" fill="${DAWN.bg}"/>` + pool('lf', 170, 70, 160, DAWN.lamp, 0.4) +
    `<path d="M0 168 L320 160 L320 200 L0 200 Z" fill="${DAWN.mid}"/>` +
    // her hand round the mug, raised toward the top of the frame
    `<g><animateTransform attributeName="transform" type="translate" values="0 10;0 0" dur="3.5s" fill="freeze"/>` +
    `<path d="M210 200 q-10 -60 -30 -100 l-20 6 q16 40 22 94 z" fill="${DAWN.dark}"/>` +
    // the mug catches the window light; her fingers wrap round it
    mug(170, 104, '#7a5638', DAWN.lamp) +
    [0, 1, 2].map((k) => `<rect x="157" y="${86 + k * 6}" width="22" height="5" rx="2.5" fill="${DAWN.dark}"/>`).join('') +
    `<path d="M178 84 q8 6 6 20 l-6 2 z" fill="${DAWN.dark}"/>` + steam(169, 76, DAWN.lamp) + `</g>`,
    'A hand lifts the chipped mug toward her, steam rising.'),
};

/** Where each picture's close-up sits: her hands, or the object that matters. */
const FOCUS: Partial<Record<keyof typeof ART, [number, number]>> = {
  side: [176, 140], chair: [180, 140], lab: [190, 120], letter: [160, 150], fridge: [130, 80], dog: [196, 132], clinic: [190, 110],
  swarm: [190, 110], coffee: [184, 122], plaster: [130, 118], lift: [172, 92],
};

/**
 * The same picture framed for how awake the unit is (interludes v2, the camera comes closer):
 * - stages 0 and 1: wide, high and still, like trial footage. The scene sits small in a dark
 *   frame, drained of colour, with camera corner marks: observed, not felt.
 * - stage 2: at her height, the picture as drawn.
 * - stage 3 and on: close on her hands, or on the object that matters.
 * The inside-the-body picture (swarm) is never framed as footage.
 */
export function frame(key: keyof typeof ART, stage: number): string {
  const art = BODIES.get(ART[key]);
  if (!art) return ART[key];
  const id = `${key}${stage}`;
  if (stage >= 3 && FOCUS[key]) {
    const [fx, fy] = FOCUS[key]!, w = 176, h = 110, x = Math.max(0, Math.min(320 - w, fx - w / 2)), y = Math.max(0, Math.min(200 - h, fy - h / 2));
    return `<svg viewBox="${x} ${y} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Close: ${art.label}">${art.body}</svg>`;
  }
  if (stage <= 1 && key !== 'swarm') {
    const mark = (x: number, y: number, dx: number, dy: number) => `<path d="M${x + dx * 14} ${y} L${x} ${y} L${x} ${y + dy * 10}" fill="none" stroke="#8d9a9c" stroke-width="1.4" opacity="0.75"/>`;
    // The view box crops the empty black margin around the footage so the picture reads on a phone; the camera distance is in the scale below, not in the empty space.
    return `<svg class="footage" viewBox="44 22 232 156" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="From a distance, as if on a camera: ${art.label}">` +
      `<defs><filter id="${id}f"><feColorMatrix type="saturate" values="0.35"/></filter>` +
      `<radialGradient id="${id}m" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="${id}k"><rect x="70" y="44" width="179" height="112" fill="url(#${id}m)"/></mask></defs>` +
      `<rect width="320" height="200" fill="#060505"/>` +
      `<g mask="url(#${id}k)"><g filter="url(#${id}f)" transform="translate(70 44) scale(0.56)" opacity="0.95">${art.body}</g></g>` +
      mark(58, 34, 1, 1) + mark(262, 34, -1, 1) + mark(58, 166, 1, -1) + mark(262, 166, -1, -1) +
      `<circle cx="252" cy="44" r="2.2" fill="#9a3a32" opacity="0.7"/></svg>`;
  }
  return ART[key];
}
export type Picture = keyof typeof ART;
