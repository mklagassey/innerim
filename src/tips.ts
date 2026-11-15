// The first time you meet something, the game stops and tells you what it is.
// "Don't show again" is remembered in the browser between runs.
import { CONFIG } from './config';
import { State, glucoseHere, idx, stripTarget } from './game';

export interface Tip { id: string; title: string; kind: string; body: string }

export const TIPS: Tip[] = [
  { id: 'portal', kind: 'Vessel', title: 'Portal vessel',
    body: 'Blood enters the liver here, and so did you. When the immune alert rises, neutrophils ride in through portals like this one, always one you cannot see at the time.' },
  { id: 'cell', kind: 'Host cell', title: 'Hepatocyte',
    body: `A living liver cell, packed with mitochondria. Press F beside one to strip it: ${CONFIG.energy.strip.gain} energy at once. The cell dies, the host loses ${CONFIG.energy.strip.hostDamage} health, and the immune system comes looking. The gap it leaves can be walked through.` },
  { id: 'glucose', kind: 'Resource', title: 'Glucose-rich blood',
    body: 'Stand on the amber crystals and press E to skim energy. It is slow and it harms no one. A drained patch refills over time.' },
  { id: 'neutrophil', kind: 'Immune cell', title: 'Neutrophil',
    body: 'A first responder: fast, numerous and short-lived. You can tell one by its three-lobed nucleus. It sprays oxidants at close range. Click it to close in and strike, or right-click to shoot.' },
  { id: 'kupffer', kind: 'Immune cell', title: 'Kupffer cell',
    body: "The liver's resident macrophage. It is slow and tough, hits hard, and raises the alarm fast once it sees you. Kill one and it leaves an upgrade behind." },
  { id: 'cache', kind: 'Pickup', title: 'Vesicle',
    body: 'A bubble of cargo adrift in the blood. Walk into it to choose one upgrade from three.' },
  { id: 'patch', kind: 'Pickup', title: 'Fibrin patch',
    body: `A knot of clotting protein. Walk over it to pick it up, then press H to heal ${CONFIG.items.patchHeal} life.` },
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

/** What the player can see right now that they have not been told about yet. */
export function nextTip(s: State): Tip | null {
  const seen = (x: number, y: number) => s.visible[idx(s, Math.floor(x), Math.floor(y))] === 1;
  const here: Record<string, boolean> = {
    portal: s.time > 1.2 && s.portals.some((p) => seen(p.x, p.y)),
    cell: s.time > 4 && !!stripTarget(s),
    glucose: glucoseHere(s) > 0 || [...s.glucose.keys()].some((k) => s.visible[k] === 1),
    neutrophil: s.enemies.some((e) => e.kind === 'neutrophil' && seen(e.x, e.y)),
    kupffer: s.enemies.some((e) => e.kind === 'kupffer' && seen(e.x, e.y)),
    cache: s.pickups.some((i) => i.kind === 'cache' && seen(i.x, i.y)),
    patch: s.pickups.some((i) => i.kind === 'patch' && seen(i.x, i.y)),
    vein: seen(s.vein.x, s.vein.y),
  };
  for (const tip of TIPS) {
    if (!here[tip.id] || muted.has(tip.id) || shownThisRun.has(tip.id)) continue;
    shownThisRun.add(tip.id);
    return tip;
  }
  return null;
}
