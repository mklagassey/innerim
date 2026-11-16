// The world map: the host's circulation as a handful of places joined by one-way vessels.
// A trip is heart -> liver -> heart. Blood only runs one way, so the road out is not the
// road back. No DOM here: main.ts draws this and plays the local maps it asks for.
import { Carry } from './game';
import { mulberry32 } from './map';

export type NodeId = 'heart' | 'hepatic' | 'mesenteric' | 'gastric' | 'stomach' | 'portal' | 'liver' | 'hvein' | 'cava';

export interface Node { name: string; x: number; y: number; kind: 'heart' | 'artery' | 'vein' | 'organ'; what: string }
// Positions are on a 640 x 380 drawing.
export const NODES: Record<NodeId, Node> = {
  heart: { name: 'Heart', x: 320, y: 58, kind: 'heart', what: 'Everything leaves from here and everything comes back.' },
  hepatic: { name: 'Hepatic artery', x: 300, y: 168, kind: 'artery', what: 'The direct road to the liver. Fast blood, heavy patrols.' },
  mesenteric: { name: 'Mesenteric artery', x: 178, y: 192, kind: 'artery', what: 'Feeds the gut. The long way round.' },
  gastric: { name: 'Gastric artery', x: 150, y: 76, kind: 'artery', what: 'Feeds the stomach.' },
  stomach: { name: 'Stomach', x: 52, y: 176, kind: 'organ', what: 'A lake of acid, worst after the host has eaten. The cells that make the acid are the richest in the body.' },
  portal: { name: 'Portal vein', x: 130, y: 292, kind: 'vein', what: 'Carries everything the gut absorbed to the liver. Slow and quiet.' },
  liver: { name: 'Liver', x: 320, y: 290, kind: 'organ', what: 'Sugar in the blood and mitochondria in the cells. Feed here.' },
  hvein: { name: 'Hepatic vein', x: 482, y: 262, kind: 'vein', what: 'Where the central veins of the liver drain.' },
  cava: { name: 'Vena cava', x: 540, y: 132, kind: 'vein', what: 'The great vein home to the heart.' },
};

/** One vessel between two places. `risk` is the chance a patrol is working it. */
export interface Leg { from: NodeId; to: NodeId; risk: number }
export const LEGS: Leg[] = [
  { from: 'heart', to: 'hepatic', risk: 0.8 },
  { from: 'heart', to: 'mesenteric', risk: 0.3 },
  { from: 'mesenteric', to: 'portal', risk: 0.25 },
  { from: 'heart', to: 'gastric', risk: 0.45 },
  { from: 'gastric', to: 'stomach', risk: 0 },
  { from: 'stomach', to: 'portal', risk: 0 }, // travelled by playing the stomach and leaving by its vein
  { from: 'hepatic', to: 'liver', risk: 0 },
  { from: 'portal', to: 'liver', risk: 0 },
  { from: 'liver', to: 'hvein', risk: 0 }, // travelled by playing the liver and leaving by its central vein
  { from: 'hvein', to: 'cava', risk: 0.3 },
  { from: 'cava', to: 'heart', risk: 0.2 },
];

export interface Trip {
  at: NodeId;
  trip: number; // which round trip this is, from 1
  fed: boolean; // been through the liver on this trip
  heat: number; // 0 to 1: how stirred up you left the immune system; it follows you down the veins
  carry: Carry | null; // null until the first local map has been played
  tripsDone: number;
  rng: () => number;
}

export const newTrip = (seed = Date.now()): Trip => ({ at: 'heart', trip: 1, fed: false, heat: 0, carry: null, tripsDone: 0, rng: mulberry32(seed) });

/** The chance of a patrol on a leg right now. An alarm you raised in the liver makes the way home worse. */
export const riskOf = (t: Trip, leg: Leg) => (leg.risk === 0 ? 0 : Math.min(0.95, leg.risk + t.heat * 0.5));
export const riskWord = (r: number) => (r === 0 ? '' : r < 0.35 ? 'lightly patrolled' : r < 0.6 ? 'patrolled' : 'heavily patrolled');

/** Vessels you could take from where you are. */
export const ways = (t: Trip): Leg[] => LEGS.filter((l) => l.from === t.at);

export type Outcome =
  | { kind: 'arrive' } // nothing on the road
  | { kind: 'patrol'; size: number } // a vessel map to get through first
  | { kind: 'liver' } // the liver itself has to be played
  | { kind: 'stomach' };

/** Sets out along a leg. The caller plays whatever comes back, then calls `arrive`. */
export function depart(t: Trip, to: NodeId): Outcome | null {
  const leg = ways(t).find((l) => l.to === to);
  if (!leg) return null;
  if (leg.from === 'liver' || leg.from === 'stomach') return { kind: leg.from };
  if (t.rng() < riskOf(t, leg)) return { kind: 'patrol', size: Math.min(6, 2 + t.trip + (leg.risk >= 0.6 ? 1 : 0)) };
  return { kind: 'arrive' };
}

/** You got there. Returns true when that completes a round trip. */
export function arrive(t: Trip, to: NodeId, carry: Carry | null, alert = 0): boolean {
  const from = t.at;
  t.at = to;
  if (carry) t.carry = carry;
  if (from === 'liver') { t.fed = true; t.heat = Math.max(0, Math.min(1, alert / 100)); }
  else t.heat *= 0.5; // the fuss dies down with distance
  if (to === 'heart' && t.fed) { t.fed = false; t.heat = 0; t.tripsDone++; t.trip++; return true; }
  return false;
}
