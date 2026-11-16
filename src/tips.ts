// The first time you meet something, the game stops and tells you what it is.
// "Don't show again" is remembered in the browser between runs.
import { CONFIG } from './config';
import { Point, State, boardTarget, dist, idx, stripTarget } from './game';

export interface Tip { id: string; title: string; kind: string; body: string }

export const TIPS: Tip[] = [
  { id: 'portal', kind: 'Vessel', title: 'Portal vessel',
    body: 'Blood enters the liver here, and so did you. When the immune alert rises, neutrophils ride in through portals like this one, always one you cannot see at the time.' },
  { id: 'cell', kind: 'Host cell', title: 'Hepatocyte',
    body: `A living liver cell, packed with mitochondria. Press F beside one to strip it: ${CONFIG.energy.strip.gain} energy at once. The cell dies, the host loses ${CONFIG.energy.strip.hostDamage} health, and the immune system comes looking. The gap it leaves can be walked through.` },
  { id: 'glucose', kind: 'Resource', title: 'Glucose-rich blood',
    body: 'Stand on the amber crystals and press E to skim energy. It is slow and it harms no one. A drained patch refills over time.' },
  { id: 'rbc', kind: 'Blood', title: 'Red blood cells',
    body: 'Harmless, and useful: they drift with the blood, and in a liver all blood drains toward the central vein. When you are lost, follow them.' },
  { id: 'neutrophil', kind: 'Immune cell', title: 'Neutrophil',
    body: 'A first responder: fast, numerous and short-lived. You can tell one by its three-lobed nucleus. It has no eyes: it tastes the blood for you, so walls hide nothing, but which way the blood runs matters a great deal. It sprays oxidants at close range. Click it to close in and strike, or right-click to shoot.' },
  { id: 'kupffer', kind: 'Immune cell', title: 'Kupffer cell',
    body: "The liver's resident macrophage. It is slow and tough, hits hard, and raises the alarm fast once it finds you, and has a keener nose than a neutrophil. Kill one and it leaves an upgrade behind." },
  { id: 'cache', kind: 'Pickup', title: 'Vesicle',
    body: 'A bubble of cargo adrift in the blood. Walk into it to choose one upgrade from three.' },
  { id: 'patch', kind: 'Pickup', title: 'Fibrin patch',
    body: `A knot of clotting protein. Walk over it to pick it up. When your hull runs low, one seals the breach on its own and repairs ${CONFIG.items.patchHeal}. Press H to use one sooner.` },
  { id: 'calm', kind: 'Pickup', title: 'Interleukin-10',
    body: `The body's own stand-down signal. Walk through it to drop the immune alert by ${CONFIG.items.calmDrop}. It stays put while the alert is empty, so remember where you saw it. Keeping off their noses for a few seconds also makes the alert drain quickly.` },
  { id: 'trail', kind: 'Danger', title: 'Your scent',
    body: 'Your ship sheds a scent. The yellow haze is how far it carries: a long way downstream toward the central vein, hardly at all upstream. Immune cells that catch it come looking, and any that cross the dark wake behind you will follow it to you until it fades. Approach from downstream and they will not know you are there. CD47 upgrades shorten both.' },
  { id: 'road', kind: 'On the road', title: 'A patrol in the vessel',
    body: 'Neutrophils are working this stretch. The current runs from where you came in to the far end, and it carries your scent ahead of you. Fight through, slip past, or wait in a side branch, where your scent stays out of the main stream. Reach the far end and the blood takes you on.' },
  { id: 'net', kind: 'Danger', title: 'Neutrophil net',
    body: 'In open blood a neutrophil that cannot reach you spits out its own DNA as a sticky web. It slows you to a crawl for a moment, which is usually long enough for the rest to arrive. Kill the thrower, break its line to you, or be gone before they know you are there.' },
  { id: 'surge', kind: 'The host', title: 'A fright',
    body: 'Something out in the world has scared the host, and adrenaline is doing what it does. Their heart races, arteries clench and the blood in them runs hard enough to sweep you along and throw you against the walls at the bends, so steer with it. Veins barely notice. The liver dumps sugar into the blood, so glucose comes back fast for a while. It passes in under half a minute.' },
  { id: 'sleep', kind: 'The host', title: 'The host is asleep',
    body: 'The host has a day of their own, and the clock next to Host health at the top keeps it. While they sleep the blood runs slow and easy, but sugar is scarce because they are fasting, and the immune system does its best work at night: everything smells you from further off.' },
  { id: 'fever', kind: 'The host', title: 'Fever',
    body: 'You have hurt the host enough that their body is turning up the heat. A fever makes every immune cell faster and makes your ship burn through its energy quicker, and it climbs again at 60% and 40% host health. The host only mends while asleep, about ten points an hour, so damage done by day stays with you until night.' },
  { id: 'meal', kind: 'The host', title: 'The host has eaten',
    body: 'For the next few hours of their day the gut is busy. Sugar from the meal pours into the portal vein and on to the liver, so glucose refills much faster. The stomach makes acid to match, so it is the worst time to be in there.' },
  { id: 'stomach', kind: 'Place', title: 'The stomach',
    body: 'The green lake is hydrochloric acid, and it eats your hull for as long as you are in it. It also dissolves your scent and your wake, and immune cells will not follow you in. The pale rim round the shore is mucus: safe, but slow going. Scraps of the last meal float in the acid if you want to skim them. The way out is a vein down one of the glands on the far side.' },
  { id: 'mucus', kind: 'Place', title: 'Mucus',
    body: 'The stomach coats itself in alkaline slime so that it does not digest its own wall. In it the acid cannot touch you, but you move at about half speed.' },
  { id: 'parietal', kind: 'Host cell', title: 'Parietal cell',
    body: `The amber cells make the acid, which takes so much power that they are the most mitochondria-rich cells in the body. Press F beside one to strip it: ${CONFIG.stomach.parietal.gain} energy for ${CONFIG.stomach.parietal.hostDamage} host health. The other cells of the stomach wall are not worth the trouble.` },
  { id: 'tumor', kind: 'The mission', title: 'Tumor cell',
    body: `This is what you were sent in for. The dark cells are tumor. Press F beside one to cut it out: the host gains ${CONFIG.tumor.heal} health and you get ${CONFIG.tumor.gain} energy, less than from a healthy cell because tumors burn sugar instead of running on mitochondria. Tumors hide from the immune system, so it raises little alarm. Each nodule has about ${CONFIG.tumor.cells} cells and the scan counted ${CONFIG.tumor.goal} in all, so it will take more than one trip.` },
  { id: 'lung', kind: 'Place', title: 'The lung',
    body: 'The last stretch. These capillaries are wrapped round air sacs, and every breath squeezes them. While the host breathes out the blood surges toward the far end and takes you with it. While they breathe in it drags you back. Ride the breath out and hold what you can on the breath in: side branches are a good place to wait. The clock at the top says which way the breath is going. A frightened host breathes fast, a sleeping one slow.' },
  { id: 'dust', kind: 'Immune cell', title: 'Alveolar macrophage',
    body: 'A dust cell: the lung\'s own macrophage, which spends its life eating whatever is breathed in. It is the same kind of slow, heavy hitter as a Kupffer cell in the liver, and it leaves an upgrade behind if you kill it.' },
  { id: 'tcell', kind: 'Immune cell', title: 'Killer T cell',
    body: 'The host knows you well enough now to send an assassin made for you. It is faster than your ship, it hits very hard, and within a few tiles the CD47 cloak does not fool it, because it reads what you are and not what you are wearing. It does wind up slowly before each blow, and it cannot follow you into acid. Kill it, or do not be found. Butyrate from the gut flora makes the host forget.' },
  { id: 'board', kind: 'Trick', title: 'Board it',
    body: `This neutrophil is hurt badly enough that you can force your way inside. Press B. For ${CONFIG.board.time} seconds you wear it: no scent, no wake, and antibodies slide off. Everything in the blood takes you for one of its own, except a killer T cell up close. You move a little slower, and striking or firing tears it open. Real pathogens do exactly this.` },
  { id: 'cortisol', kind: 'Pickup', title: 'Cortisol',
    body: `After adrenaline comes cortisol, the slower stress hormone, and its job is to tell the immune system to stand down so the body can deal with the emergency. Fly through an amber droplet and for ${CONFIG.cortisol.time} seconds every immune cell is slow and dull-nosed. A frightened host is a dangerous road and a quiet liver.` },
  { id: 'antibody', kind: 'Danger', title: 'Antibody',
    body: `The host has met you before and remembers. These pale Y shapes were made to fit your hull exactly. They drift with the blood and lean toward you when you pass close. If one sticks, your scent carries much further for ${CONFIG.memory.tagTime} seconds and the cloak will not work. Steer round them, or clear them with a strike or a shot. The more alarm you raise on a trip, the more of them there will be on the next map.` },
  { id: 'vein', kind: 'Vessel', title: 'Central vein',
    body: `Blood drains out of the liver here, and it is your way out too. Stand on it with ${CONFIG.energy.quota} energy and press E.` },
];

const KEY = 'insiderim.tips.muted';
function loadMuted(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
const muted = loadMuted();
const NOTES = 'insiderim.tips.seen';
const noted: Set<string> = (() => { try { return new Set(JSON.parse(localStorage.getItem(NOTES) ?? '[]') as string[]); } catch { return new Set<string>(); } })();
/** Every info box the player has ever been shown, in the order they are listed, for reading again. */
export const fieldNotes = (): Tip[] => TIPS.filter((t) => noted.has(t.id) || muted.has(t.id));
let shownThisRun = new Set<string>();

export const newRun = () => { shownThisRun = new Set(); };
export function mute(id: string) {
  muted.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...muted])); } catch { /* private window: it just will not be remembered */ }
}
export function unmuteAll() {
  muted.clear();
  shownThisRun = new Set();
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
export const mutedCount = () => muted.size;
/** The nearest parietal cell in view, for pointing at. */
export function nearestRich(s: State): Point | null {
  let best: Point | null = null, bestD = 99;
  for (const k of s.rich) {
    if (!s.visible[k]) continue;
    const at = { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }, d = dist(at, s.player);
    if (d < bestD) { bestD = d; best = at; }
  }
  return best;
}

/** What the player can see right now that they have not been told about yet, and where it is. */
export function nextTip(s: State, extra: Record<string, Point | null> = {}): { tip: Tip; at: Point } | null {
  const seen = (p: Point) => s.visible[idx(s, Math.floor(p.x), Math.floor(p.y))] === 1;
  const mid = (p: Point) => ({ x: p.x + 0.5, y: p.y + 0.5 });
  const nearest = (ps: Point[]) => ps.filter(seen).sort((a, b) => dist(a, s.player) - dist(b, s.player))[0] ?? null;
  const cell = stripTarget(s);
  const glucose = [...s.glucose.keys()].map((k) => mid({ x: k % s.size, y: Math.floor(k / s.size) }));
  const here: Record<string, Point | null> = {
    portal: s.time > 1.2 ? nearest(s.portals.map(mid)) : null,
    cell: s.time > 4 && cell ? mid(cell) : null,
    glucose: nearest(glucose),
    neutrophil: nearest(s.enemies.filter((e) => e.kind === 'neutrophil')),
    kupffer: nearest(s.enemies.filter((e) => e.kind === 'kupffer')),
    tcell: nearest(s.enemies.filter((e) => e.kind === 'tcell')),
    cache: nearest(s.pickups.filter((i) => i.kind === 'cache')),
    patch: nearest(s.pickups.filter((i) => i.kind === 'patch')),
    trail: s.trail.length >= 7 ? s.trail[s.trail.length - 5] : null,
    calm: nearest(s.pickups.filter((i) => i.kind === 'calm')),
    cortisol: nearest(s.pickups.filter((i) => i.kind === 'cortisol')),
    board: boardTarget(s),
    antibody: nearest(s.antibodies),
    tumor: nearest([...s.tumor].map((k) => ({ x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }))),
    vein: nearest([mid(s.vein)]),
    ...extra,
  };
  for (const tip of TIPS) {
    const at = here[tip.id];
    if (!at || muted.has(tip.id) || shownThisRun.has(tip.id)) continue;
    shownThisRun.add(tip.id);
    noted.add(tip.id);
    try { localStorage.setItem(NOTES, JSON.stringify([...noted])); } catch { /* not kept */ }
    return { tip, at: { x: at.x, y: at.y } };
  }
  return null;
}
