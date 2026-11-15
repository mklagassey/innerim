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
    body: 'A first responder: fast, numerous and short-lived. You can tell one by its three-lobed nucleus. It sprays oxidants at close range. Click it to close in and strike, or right-click to shoot.' },
  { id: 'kupffer', kind: 'Immune cell', title: 'Kupffer cell',
    body: "The liver's resident macrophage. It is slow and tough, hits hard, and raises the alarm fast once it sees you. Kill one and it leaves an upgrade behind." },
  { id: 'cache', kind: 'Pickup', title: 'Vesicle',
    body: 'A bubble of cargo adrift in the blood. Walk into it to choose one upgrade from three.' },
  { id: 'patch', kind: 'Pickup', title: 'Fibrin patch',
    body: `A knot of clotting protein. Walk over it to pick it up. When your life runs low, one seals the wound on its own and heals ${CONFIG.items.patchHeal}. Press H to use one sooner.` },
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
