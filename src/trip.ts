// The world map: the host's circulation as a handful of places joined by one-way vessels.
// A trip is heart -> liver -> heart. Blood only runs one way, so the road out is not the
// road back. No DOM here: main.ts draws this and plays the local maps it asks for.
import { Carry } from './game';
import { mulberry32 } from './map';
import { CONFIG, EVENTS, HostEvent } from './config';
import { Order, stageOf } from './story';

const TUMOR_GOAL = CONFIG.tumor.goal;

export type NodeId = 'heart' | 'hepatic' | 'mesenteric' | 'gastric' | 'stomach' | 'gut' | 'portal' | 'liver' | 'hvein' | 'cava' | 'lungs';

export interface Node { name: string; x: number; y: number; kind: 'heart' | 'artery' | 'vein' | 'organ' | 'town'; what: string }
// Positions are on a 640 x 380 drawing.
export const NODES: Record<NodeId, Node> = {
  heart: { name: 'Heart', x: 320, y: 58, kind: 'heart', what: 'Everything leaves from here and everything comes back.' },
  hepatic: { name: 'Hepatic artery', x: 318, y: 172, kind: 'artery', what: 'The direct road to the liver. Fast blood, heavy patrols.' },
  mesenteric: { name: 'Mesenteric artery', x: 200, y: 148, kind: 'artery', what: 'Feeds the gut. The long way round.' },
  gut: { name: 'Gut lumen', x: 140, y: 222, kind: 'town', what: 'Trillions of bacteria live here, tolerated by the immune system. Release glucose and they ferment it; collect what they and the gut wall make.' },
  gastric: { name: 'Gastric artery', x: 150, y: 76, kind: 'artery', what: 'Feeds the stomach.' },
  stomach: { name: 'Stomach', x: 52, y: 176, kind: 'organ', what: 'A lake of acid, worst after the host has eaten. The cells that make the acid are the richest in the body.' },
  portal: { name: 'Portal vein', x: 172, y: 326, kind: 'vein', what: 'Carries everything the gut absorbed to the liver. Slow and quiet.' },
  liver: { name: 'Liver', x: 320, y: 290, kind: 'organ', what: 'Sugar in the blood and mitochondria in the cells. Feed here.' },
  hvein: { name: 'Hepatic vein', x: 482, y: 262, kind: 'vein', what: 'Where the central veins of the liver drain.' },
  cava: { name: 'Vena cava', x: 540, y: 132, kind: 'vein', what: 'The great vein home to the heart.' },
  lungs: { name: 'Lungs', x: 585, y: 44, kind: 'organ', what: 'The way out: one breath from the open air.' },
};

/** One vessel between two places. `risk` is the chance a patrol is working it. */
export interface Leg { from: NodeId; to: NodeId; risk: number; after?: number; via?: NodeId; ordered?: boolean } // via: passes through this place without stopping. ordered: on the route Shepherd assigns // after: only once this many tumor cells are out
export const LEGS: Leg[] = [
  { from: 'heart', to: 'hepatic', risk: 0.6, ordered: true },
  { from: 'heart', to: 'mesenteric', risk: 0.3 },
  { from: 'mesenteric', to: 'gut', risk: 0.25 },
  { from: 'gut', to: 'portal', risk: 0 },
  { from: 'heart', to: 'gastric', risk: 0.45 },
  { from: 'gastric', to: 'stomach', risk: 0 },
  { from: 'stomach', to: 'portal', risk: 0 }, // travelled by playing the stomach and leaving by its vein
  { from: 'hepatic', to: 'liver', risk: 0, ordered: true },
  { from: 'portal', to: 'liver', risk: 0 },
  { from: 'liver', to: 'hvein', risk: 0, ordered: true }, // travelled by playing the liver and leaving by its central vein
  { from: 'hvein', to: 'heart', risk: 0.3, via: 'cava', ordered: true }, // straight home: one roll, at the worse of the two risks
  { from: 'hvein', to: 'cava', risk: 0.3, ordered: true },
  { from: 'cava', to: 'heart', risk: 0.2, ordered: true },
  { from: 'heart', to: 'lungs', risk: 0, after: TUMOR_GOAL, ordered: true }, // travelled by playing the lung and being breathed out
];

export interface Trip {
  at: NodeId;
  trip: number; // which round trip this is, from 1
  fed: boolean; // been through the liver on this trip
  heat: number; // 0 to 1: how stirred up you left the immune system; it follows you down the veins
  carry: Carry | null; // null until the first local map has been played
  tripsDone: number;
  event: HostEvent | null; // what is happening to the host on this trip
  used: HostEvent[]; // no event comes round twice in a game
  offRoute: boolean; // left Shepherd's assigned route on this trip, and lost its escort
  defied: Order[]; // orders gone against from the world map on this trip: each counts once
  tutorial: boolean; // Shepherd will walk the unit through the next liver
  rng: () => number;
}

export const newTrip = (seed = Date.now()): Trip => ({ at: 'heart', trip: 1, fed: false, heat: 0, carry: null, tripsDone: 0, event: null, used: [], offRoute: false, defied: [], tutorial: false, rng: mulberry32(seed) });

/** The chance of a patrol on a leg right now. An alarm you raised in the liver makes the way home worse. */
export const riskOf = (t: Trip, leg: Leg) => (leg.risk === 0 ? 0 : Math.max(0, Math.min(0.95, leg.risk + t.heat * 0.5) - (escorted(t, leg) ? CONFIG.story.orders.escort : 0)));
/** Shepherd is still giving this unit orders. Past the last stage it has lost the unit, and says nothing. */
export const commanded = (t: Trip) => stageOf(t.carry?.aware ?? 0) < 4;
/** Shepherd escorts units that keep to the route it assigned: the reward for doing as you are told. */
export const escorted = (t: Trip, leg: Leg) => assigned(t, leg) && !t.offRoute && commanded(t);
/** Is this leg on the route Shepherd has assigned right now? Once the tumor is out the only order is the lungs. */
export const assigned = (t: Trip, leg: Leg) => !!leg.ordered && ((t.carry?.excised ?? 0) < TUMOR_GOAL || leg.to === 'lungs');
export const riskWord = (r: number) => (r === 0 ? '' : r < 0.35 ? 'lightly patrolled' : r < 0.6 ? 'patrolled' : 'heavily patrolled');

/** Vessels you could take from where you are. */
export const ways = (t: Trip): Leg[] => LEGS.filter((l) => l.from === t.at && (l.after === undefined || (t.carry?.excised ?? 0) >= l.after));

export type Outcome =
  | { kind: 'arrive' } // nothing on the road
  | { kind: 'patrol'; size: number } // a vessel map to get through first
  | { kind: 'liver' } // the liver itself has to be played
  | { kind: 'stomach' }
  | { kind: 'lung' };

/** Sets out along a leg. The caller plays whatever comes back, then calls `arrive`. */
export function depart(t: Trip, to: NodeId): Outcome | null {
  const leg = ways(t).find((l) => l.to === to);
  if (!leg) return null;
  if (leg.from === 'liver' || leg.from === 'stomach') return { kind: leg.from };
  if (leg.to === 'lungs') return { kind: 'lung' };
  if (t.tutorial && escorted(t, leg)) return { kind: 'arrive' }; // nothing reaches a unit on its way to its first lesson
  if (t.rng() < riskOf(t, leg)) return { kind: 'patrol', size: Math.max(2, Math.min(6, 2 + t.trip + (leg.risk >= 0.6 ? 1 : 0)) - (escorted(t, leg) ? 1 : 0)) }; // an escorted unit meets a smaller patrol
  return { kind: 'arrive' };
}

/** You got there. Returns true when that completes a round trip. */
export function arrive(t: Trip, to: NodeId, carry: Carry | null, alert = 0): boolean {
  const from = t.at;
  t.at = to;
  if (carry) t.carry = carry;
  if (from === 'liver') { t.fed = true; t.heat = Math.max(0, Math.min(1, alert / 100)); }
  else t.heat *= 0.5; // the fuss dies down with distance
  if (to === 'heart' && t.fed) {
    t.fed = false; t.heat = 0; t.tripsDone++; t.trip++; t.offRoute = false; t.defied = [];
    // The first trip is plain, to learn the rules. Every one after it finds the host having a different sort of day.
    const left = (Object.keys(EVENTS) as HostEvent[]).filter((e) => !(t.used ??= []).includes(e));
    t.event = left.length ? left[Math.floor(t.rng() * left.length)] : null;
    if (t.event) t.used.push(t.event);
    if (t.carry) t.carry.event = t.event;
    return true;
  }
  return false;
}
