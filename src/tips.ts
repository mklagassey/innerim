// The first time you meet something, the game stops and tells you what it is.
// "Don't show again" is remembered in the browser between runs.
import { CONFIG } from './config';
import { Point, State, dist, idx, stripTarget } from './game';

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
    body: `A knot of clotting protein. Walk over it to pick it up. When your life runs low, one seals the wound on its own and heals ${CONFIG.items.patchHeal}. Press H to use one sooner.` },
  { id: 'calm', kind: 'Pickup', title: 'Interleukin-10',
    body: `The body's own stand-down signal. Walk through it to drop the immune alert by ${CONFIG.items.calmDrop}. It stays put while the alert is empty, so remember where you saw it. Keeping off their noses for a few seconds also makes the alert drain quickly.` },
  { id: 'trail', kind: 'Danger', title: 'Your scent',
    body: 'Your ship sheds a scent. The yellow haze is how far it carries: a long way downstream toward the central vein, hardly at all upstream. Immune cells that catch it come looking, and any that cross the dark wake behind you will follow it to you until it fades. Approach from downstream and they will not know you are there. CD47 upgrades shorten both.' },
  { id: 'road', kind: 'On the road', title: 'A patrol in the vessel',
    body: 'Neutrophils are working this stretch. The current runs from where you came in to the far end, and it carries your scent ahead of you. Fight through, slip past, or wait in a side branch, where your scent stays out of the main stream. Reach the far end and the blood takes you on.' },
  { id: 'net', kind: 'Danger', title: 'Neutrophil net',
    body: 'In open blood a neutrophil that cannot reach you spits out its own DNA as a sticky web. It slows you to a crawl for a moment, which is usually long enough for the rest to arrive. Kill the thrower, break its line to you, or be gone before they know you are there.' },
  { id: 'surge', kind: 'The host', title: 'A fright',
    body: 'Something out in the world has scared the host, and adrenaline is doing what it does. Their heart races, arteries clench and the blood in them runs hard enough to drag you along, veins much less so. The liver dumps sugar into the blood, so glucose comes back fast for a while. It passes in under half a minute.' },
  { id: 'sleep', kind: 'The host', title: 'The host is asleep',
    body: 'The host has a day of their own, and the clock next to Host health at the top keeps it. While they sleep the blood runs slow and easy, but sugar is scarce because they are fasting, and the immune system does its best work at night: everything smells you from further off.' },
  { id: 'vein', kind: 'Vessel', title: 'Central vein',
    body: `Blood drains out of the liver here, and it is your way out too. Stand on it with ${CONFIG.energy.quota} energy and press E.` },
];

const KEY = 'insiderim.tips.muted';
function loadMuted(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
const muted = loadMuted();
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
    cache: nearest(s.pickups.filter((i) => i.kind === 'cache')),
    patch: nearest(s.pickups.filter((i) => i.kind === 'patch')),
    trail: s.trail.length >= 7 ? s.trail[s.trail.length - 5] : null,
    calm: nearest(s.pickups.filter((i) => i.kind === 'calm')),
    vein: nearest([mid(s.vein)]),
    ...extra,
  };
  for (const tip of TIPS) {
    const at = here[tip.id];
    if (!at || muted.has(tip.id) || shownThisRun.has(tip.id)) continue;
    shownThisRun.add(tip.id);
    return { tip, at: { x: at.x, y: at.y } };
  }
  return null;
}
