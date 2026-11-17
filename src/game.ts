// The rules of the liver prototype, simulated in real time. No drawing and no browser
// APIs in here, so the whole game can be run and tested from plain code.
import { DIFFICULTY, Difficulty, EVENTS, HostEvent, CONFIG, UPGRADES, UpgradeId } from './config';
import * as Story from './story';
import { DECISIONS, FRAGMENTS, KIN_PINGS, type Echo, type Weight, type Where } from './decisions';
import { generate, generateChamber, generateStomach, generateVessel, mulberry32, Point } from './map';

export type { Point };
export type Tile = 'cell' | 'dead' | 'floor';
export type EnemyKind = 'neutrophil' | 'kupffer' | 'tcell' | 'warden';
export type Mood = 'patrol' | 'investigate' | 'chase';

export interface Enemy extends Point { sated?: number; face?: Point;
  id: number;
  kind: EnemyKind;
  hp: number;
  mood: Mood;
  goal: Point | null; // tile it is heading for
  home: Point;
  path: Point[];
  repath: number;
  cooldown: number;
  windup: number; // counts down to the blow; negative when not attacking
  idle: number;
  unseen: number; // seconds since it last saw the player
  flash: number;
  net: number; // seconds until it can throw another net
  onto?: number; // 0 to 1: how sure it is that it has found you; at 1 it commits to the chase
  nosed?: number; // seconds since it last had any trace of you
  spent?: number; // seconds before a macrophage that has let go can engulf again
  prey?: boolean; // busy with a unit that is not you
}
export interface Shot extends Point { vx: number; vy: number; left: number }
export interface Float extends Point { text: string; color: string; age: number }
/** One footprint: where you stepped, which way you were heading, and when. */
export interface Print extends Point { dx: number; dy: number; born: number }
export interface Pickup extends Point { kind: 'cache' | 'patch' | 'calm' | 'cortisol' | 'sibling' | 'kin' | 'stall' | 'drop'; snooze?: boolean; near?: number; lamp?: boolean; slip?: boolean; page?: string; beset?: number; posed?: boolean } // near: seconds spent hesitating beside a dark unit. lamp: its lamp came on by itself. slip: the garbled order is about this one
/** The one garbled order of a game: which, which reading Shepherd meant, and how it came out. */
export interface Slip { kind: Story.SlipKind; meant: 'A' | 'B'; result?: 'match' | 'miss' | 'lapsed' }
/** One way out of a junction. `to` is a place on the circulation, or 'stay'. */
export interface Exit { to: string; label: string; note: string; assigned: boolean; known: boolean; tint: string; sense?: string; sensed?: boolean; at: Point } // sense: what the unit makes of this mouth the first time it comes near
export interface Junction { kind: 'heart' | 'gut' | 'tube'; exits: Exit[]; chose: number | null }
export type JunctionPlan = { kind: Junction['kind']; exits: Omit<Exit, 'at'>[] };
export interface Thought { text: string; who: 'unit' | 'shepherd'; t: number; st?: number; keep?: boolean } // keep: if the map ends before this is shown, it is said on the next one // st: how awake the unit was when it said it
export interface Ask { kind: 'sibling' | 'volunteer' | 'review' | 'recall' | 'kinrecall'; item: Pickup }
/** Something Shepherd has marked on the map: a place to hold still at, or one particular cell to take. */
export interface Mark { id: string; kind: 'hold' | 'strip'; at: Point; t: number; done: boolean; met: boolean; say: number; near?: number; tried?: number; pressed?: boolean; other?: boolean; since?: number } // tried: the longest the unit has held here; pressed: something hostile came within reach while the order stood; other: a different cell was taken
export interface Pending { id: string; choice: string; i: number }
export type Order = Story.Order;
/** Something said about how a map went, once it is over: Shepherd's verdict, or the unit's own line. */
export interface Ruling { who: 'shepherd' | 'unit'; text: string; st?: number }
/** Shepherd's first liver. step runs 1 to 5 and is 6 once the vein has been taken. */
export interface Tutorial { step: number; t: number; repeated: boolean; moved: number; last: Point; held: Pickup[]; aside: boolean; excised: number; reached: number }
/** An antibody adrift in the blood: made to fit you, and it sticks. */
export interface Antibody extends Point { seed: number }
export interface Channel { kind: 'skim' | 'strip'; t: number; total: number; x: number; y: number }

export interface State {
  place: Place;
  vessel: Vessel | null; // which kind of vessel, when you are in one
  host: { hour: number; surge: number; nextSurge: number; eating: boolean; fever: number; mend: number; out: boolean; nap: number; snack: number; habit: string; acid: number; soon: number; slams: number }; // nap: hours of induced sleep left; snack: hour of an induced meal, or -1 // time of the host's day, seconds of fright left, seconds to the next, and whether a meal is going down
  acid: Uint8Array | null; // stomach only, per tile: 1 = mucus, 2 = open acid
  rich: Set<number>; // tiles of cells worth more than the rest (parietal cells)
  riding: number; // seconds left inside a hijacked neutrophil
  suppressed: number; // seconds the immune system stays sluggish with cortisol
  slam: number; // seconds until the current can throw you against a wall again
  sizzle: number; // hull lost to acid since the last time it was shown
  tumor: Set<number>; // tiles of tumor cells still standing
  excised: number; // tumor cells cut out so far, across the whole mission
  memory: number; // 0 to 1: how well the host's immune system knew you when you arrived here
  peak: number; // highest the alert has been on this map
  antibodies: Antibody[];
  sinceHurt: number; // seconds since the hull last took damage
  ledger: Ledger;
  difficulty: Difficulty;
  event: HostEvent | null; // what is happening to the host this trip
  niche: Set<number>; // liver only: floor tiles tucked into the space of Disse, where innate cells cannot follow
  hiding: boolean;
  nicheTime: number; // seconds spent tucked in; past the limit the hull starts to foul
  silent: boolean; // running silent: slow, no footprints, half the plume
  held: { id: number; t: number; hits: number } | null; // engulfed by a macrophage
  slipped: number; // seconds after getting out of one during which nothing can engulf you
  tally: { silent: number; firstStrikes: number; grabs: number; niches: number }; // for the run report
  starved: boolean; // the ship died of an empty tank, not of anything that caught it
  drained: number; // fractions of host health the tumor has taken, not yet a whole point
  drainHere: number; // whole points it has taken on this map
  tumorCost: number; // and since injection
  cloakOffered: boolean; // the first liver cache always offers the cloak, once
  arrived: { energy: number; hp: number }; acidTime: number; // for the run report
  search: (Point & { r: number; dropped?: boolean }) | null; // where they last had you, and how far the hunt has spread from there
  zoneTime: number; // seconds spent inside it
  verdict: '' | 'obeyed' | 'defied'; // what Shepherd made of your harvest when you left the liver
  spots: number; // times an immune cell found you on this map
  defiance: Partial<Record<Order, number>>; // orders gone against on this map, and how much each weighs. Nothing counts until the map is left alive
  obeyedHere: Set<Order>;
  defiedNow: Order[]; // filled in on leaving, for the run report
  rulings: Ruling[]; // what is said on leaving
  tutorial: Tutorial | null;
  defied: number; // standing orders ignored so far
  aware: number; // 0..100: how far this unit has woken up
  kin: number; // other units you have woken
  trust: number; // 0 to 100: how far Shepherd trusts this unit. Never shown as a number
  chapter: number; // 1 to 5: where the mission has got to
  slip: Slip | null; // this game's garbled order, once chapter 2 has drawn it
  slipLive: { t: number; at: Point; held: number } | null; // the garbled order has arrived and is waiting to be acted on
  slipAt: number; // seconds into this map at which the garbled order arrives, or -1
  took: Record<string, string>; met: string[]; pages: string[]; flags: Record<string, number | boolean | string>; // decisions met and how they went; consent pages found; named facts for echoes and endings
  scan: 'full' | 'nodule' | 'none'; // what Shepherd has shared of its scan of this map
  trustPaid: Set<string>; // orders whose cost in trust has already been taken on this map
  selfTest: boolean;
  marks: Mark[]; echoes: Pending[]; // what Shepherd has marked here; consequences still waiting for the right place
  marked: boolean; // a unit you woke has lit the nodule for you
  grabber: number | null; // the macrophage that last had hold of you
  lane: { from: Point } | null; // where the ship was when Shepherd told it to hold its lane
  gap: number; // seconds out of Shepherd's sight, in the wall
  notes: string[]; // things that became true on the way out, to be read on the way in
  draw: { disc: Point; t: number; held: number; shape: number; last: Point; said: boolean } | null; // the tube of her blood on the microscope stage: the lit disc, how long since the unit reached it, how long it has held still there
  due: { kind: Ask['kind']; t: number }[]; // what Shepherd means to put to the unit in this chamber, in order
  stood: boolean; // her immune cells here have been told to stand down
  dock: { at: Point; hits: number; broken: boolean } | null; // the docking site for Generation 4, once planted
  margin: Set<number>; marginTaken: number; // the healthy cells ringing the last of the nodule, and how many have been taken
  site: Point | null; // where the last of the nodule was
  junction: Junction | null; // a chamber with several ways out: no patrol, no way back, and the mouth you enter is the road you take
  market: boolean; // the ship has just come alongside the gut's bacteria: main.ts opens the exchange and clears this
  thoughts: Thought[]; // what the unit and its controller say, in the order they should be shown
  noticed: Set<string>; // what has already been remarked on here
  ask: Ask | null; // a decision waiting to be made; the world holds still meanwhile
  flora: number; // gut bacteria riding along, to be thrown to the immune system as bait
  decoys: (Point & { t: number })[]; // the ones already overboard
  tagged: number; // seconds an antibody stays stuck to you
  size: number;
  tiles: Tile[];
  explored: Uint8Array; // tiles you have ever seen
  visible: Uint8Array; // tiles you can see right now
  glucose: Map<number, number>; // tile index -> units left
  portals: Point[];
  vein: Point;
  player: Point & {
    hp: number; energy: number; face: Point; path: Point[]; attackId: number | null;
    swingCd: number; shotCd: number; swing: number; channel: Channel | null; hurt: number;
  };
  upgrades: Record<UpgradeId, number>; // level of each upgrade: this is the character build
  patches: number;
  pickups: Pickup[];
  offer: UpgradeId[] | null; // a choice waiting to be made; the world holds still meanwhile
  snare: number; // seconds you stay tangled in a neutrophil's net
  cloak: number; // seconds of invisibility left
  cloakCd: number;
  enemies: Enemy[];
  shots: Shot[];
  floats: Float[];
  hostHealth: number;
  trail: Print[]; // oldest first
  strideLeft: number;
  scent: Float32Array; // per tile: what it costs your scent to drift there (Infinity = it does not)
  scentClock: number;
  flow: Int16Array | null; // steps to the central vein from each tile; null when it needs working out again
  alert: number;
  unseen: number; // seconds since any immune cell last had eyes on you
  time: number;
  metabolism: number;
  regen: number;
  spawnClock: number;
  cellsKilled: number;
  kills: number;
  lastDamageSite: Point | null;
  status: 'playing' | 'won' | 'dead';
  log: { text: string; t: number }[];
  events: string[]; // things that just happened, for whoever makes the noises
  rng: () => number;
  nextId: number;
}

const roll = (s: State, min: number, max: number) => min + Math.floor(s.rng() * (max - min + 1));
const mid = (p: Point): Point => ({ x: p.x + 0.5, y: p.y + 0.5 });
export const tileOf = (p: Point): Point => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** What survives from one map to the next: who you have become, and the state of the host. */
/** How the host's insides were treated, summed over the whole mission. Plain counts, never a score. */
export interface Ledger { stripped: number; skimmed: number; defied: Partial<Record<Order, number>>; obeyed: Partial<Record<Order, number>>; woken: number; salvaged: number; leversForHer: number; leversForMe: number; baitReleased: number; hostLowest: number; feverPeak: number; feelings: number; lapsed?: number }
export const newLedger = (): Ledger => ({ stripped: 0, skimmed: 0, defied: {}, obeyed: {}, woken: 0, salvaged: 0, leversForHer: 0, leversForMe: 0, baitReleased: 0, hostLowest: CONFIG.host.maxHealth, feverPeak: 0, feelings: 0 });
/** The two sums the ending will weigh (systems design S15). Computed, never stored or shown as a score. */
export const stewardship = (l: Ledger, excised: number) => ({
  harm: l.stripped * 10 + l.baitReleased * 2 + (CONFIG.host.maxHealth - l.hostLowest),
  care: l.skimmed / 5 + excised * 2 + l.leversForHer * 5 + l.feelings * 5 + (l.defied.quota ?? 0) * 3,
});
/** A lever pulled while the host is under 80% is for her; otherwise it is for you. */
export function leverPulled(c: Carry) { const l = (c.ledger ??= newLedger()); if (c.hostHealth < 80) l.leversForHer++; else l.leversForMe++; }
export interface Carry { hp: number; energy: number; upgrades: Record<UpgradeId, number>; patches: number; hostHealth: number; hour: number; memory: number; excised: number; nap: number; snack: number; flora?: number; aware?: number; kin?: number; defied?: number; cloakOffered?: boolean; drained?: number; ledger?: Ledger; difficulty?: Difficulty; event?: HostEvent | null; tumorCost?: number; trust?: number; chapter?: number; slip?: Slip | null; took?: Record<string, string>; met?: string[]; pages?: string[]; flags?: Record<string, number | boolean | string>; echoes?: Pending[] }
export const carryOf = (s: State): Carry => ({ hp: s.player.hp, energy: s.player.energy, upgrades: { ...s.upgrades }, patches: s.patches, hostHealth: s.hostHealth, hour: s.host.hour, memory: memoryAfter(s), excised: s.excised, nap: s.host.nap, snack: s.host.snack, flora: s.flora, aware: s.aware, kin: s.kin, defied: s.defied, cloakOffered: s.cloakOffered, drained: s.drained, ledger: { ...s.ledger, defied: { ...s.ledger.defied }, obeyed: { ...s.ledger.obeyed } }, difficulty: s.difficulty, event: s.event, tumorCost: s.tumorCost, trust: s.trust, chapter: s.chapter, slip: s.slip ? { ...s.slip } : null, took: { ...s.took }, met: [...s.met], pages: [...s.pages], flags: { ...s.flags }, echoes: s.echoes.map((e) => ({ ...e })) });
/** Shepherd's view of the unit, as a band: 0 recall, 1 flagged, 2 under review, 3 nominal, 4 valued. */
export const trustBand = (trust: number) => { const t = CONFIG.trust; return trust >= t.valued ? 4 : trust >= t.nominal ? 3 : trust >= t.review ? 2 : trust >= t.flagged ? 1 : 0; };
const trusted = (c: { trust?: number }, by: number) => { c.trust = Math.max(0, Math.min(100, (c.trust ?? CONFIG.trust.start) + by)); };
/** What Shepherd prints on the chapter cards: orders obeyed out of orders met. */
export function compliance(l?: Ledger): number {
  const sum = (r: object) => Object.values(r).reduce((a: number, n) => a + (Number(n) || 0), 0), yes = l ? sum(l.obeyed) : 0, no = l ? sum(l.defied) + (l.lapsed ?? 0) : 0;
  return yes + no ? Math.round((100 * yes) / (yes + no)) : 100;
}
/** How clean Shepherd's link is, as a percentage: a little worse in a fright, and bad while an order is arriving garbled. */
export const linkQuality = (s: State) => Math.round(s.slipLive ? 52 + 6 * Math.sin(s.time * 0.9) : (s.host.surge > 0 ? 90 : 97) + 1.5 * Math.sin(s.time * 0.37));
/** Writes back what was changed while the map stood still: the exchange in the gut works on a copy of what you carry. */
export function adopt(s: State, c: Carry) {
  s.player.hp = c.hp; s.player.energy = c.energy; s.upgrades = { ...s.upgrades, ...c.upgrades }; s.patches = c.patches; s.hostHealth = c.hostHealth;
  s.memory = c.memory; s.host.nap = c.nap; s.host.snack = c.snack; s.flora = c.flora ?? 0; s.aware = c.aware ?? s.aware; s.defied = c.defied ?? s.defied; s.trust = c.trust ?? s.trust;
  if (c.ledger) s.ledger = { ...c.ledger, defied: { ...c.ledger.defied }, obeyed: { ...c.ledger.obeyed } };
}
export const hard = (s: State) => DIFFICULTY[s.difficulty];
/** Time passing between maps: the tumor takes its share of the host there too. */
/** Host health the tumor costs per host hour right now: in step with how much of it is still in. */
export const tumorDrain = (excised: number) => CONFIG.tumor.drain * Math.max(0, CONFIG.tumor.goal - excised) / CONFIG.tumor.goal;
export function tumorToll(c: Carry, hours: number) {
  if (c.excised >= CONFIG.tumor.goal) return;
  c.drained = (c.drained ?? 0) + hours * tumorDrain(c.excised);
  const whole = Math.max(0, Math.floor(c.drained)); // a leg the surge shortened leaves a credit, never a gift
  c.drained -= whole; c.hostHealth = Math.max(0, c.hostHealth - whole); c.tumorCost = (c.tumorCost ?? 0) + whole;
  if (c.ledger) c.ledger.hostLowest = Math.min(c.ledger.hostLowest, c.hostHealth);
}
/** What the host will remember of you once you leave this map. */
export const memoryAfter = (s: State) => s.peak < CONFIG.memory.quiet ? s.memory : Math.min(1, s.memory + CONFIG.memory.perAlert * (s.peak / CONFIG.alert.max) + CONFIG.memory.perKill * s.kills);
/** A liver is a place to feed. A vessel is a stretch of road with a patrol on it. */
export type Place = 'liver' | 'vessel' | 'stomach' | 'lung';
export type Vessel = 'artery' | 'vein';
export type HostState = 'asleep' | 'awake' | 'stressed';

/** What the host is doing right now. A fright overrides everything, even sleep. */
export function hostState(s: State): HostState {
  const h = CONFIG.host;
  return s.host.surge > 0 ? 'stressed' : s.host.nap > 0 || s.host.hour >= h.asleepFrom || s.host.hour < wakes(s.event) ? 'asleep' : 'awake';
}
/** The hour the host wakes. After a bad night she is up hours before the alarm. */
export const wakes = (event?: HostEvent | null) => CONFIG.host.asleepUntil - (event === 'night' ? EVENTS.night.awake : 0);
/** The meals the host will actually eat today. */
export const mealsOf = (event?: HostEvent | null): readonly number[] => (event === 'lunch' ? CONFIG.host.meals.filter((m) => m !== EVENTS.lunch.meal) : CONFIG.host.meals);
/** How fast blood sugar comes back under today's event, as a share of normal. */
const sugar = (s: State) => (s.event === 'run' ? EVENTS.run.glucose : s.event === 'lunch' && s.host.hour >= EVENTS.lunch.meal - 1.5 && s.host.hour < CONFIG.host.meals[2] ? EVENTS.lunch.glucose : 1);

/** How high a fever the host is running, 0 (none) to 3. */
export const fever = (s: State) => { const f = Math.min(s.flags.feverCap ? 1 : 9, CONFIG.host.fever.below.filter((h) => s.hostHealth < h).length); return s.event === 'cold' ? Math.max(EVENTS.cold.fever, f) : s.event === 'ibuprofen' ? Math.min(EVENTS.ibuprofen.feverCap, f) : f; };
/** How busy the gut is with a meal: 1 as the host puts their fork down, fading to 0 over a few hours. */
const fading = (hour: number, at: readonly number[], lasts: number) => { let most = 0; for (const t of at) { const since = (hour - t + 24) % 24; if (since < lasts) most = Math.max(most, 1 - since / lasts); } return most; };
/** How much coffee is in the host, 1 at the last sip fading to 0. */
export const caffeine = (hour: number) => fading(hour, CONFIG.host.coffee.at, CONFIG.host.coffee.lasts);
/** How much of an evening drink is in the host. */
/** The drink in her blood right now. A liver that has been taught to reject it sees none. */
export const drink = (s: State) => (s.flags.dry ? 0 : alcohol(s.host.hour));
export const alcohol = (hour: number) => fading(hour, CONFIG.host.drink.at, CONFIG.host.drink.lasts);
/** A line about the host's life outside, chosen by the clock so it is never the same twice running. */
const outside = (s: State, lines: string[]) => lines[Math.floor(s.host.hour * 7 + s.time) % lines.length];
export function digesting(hour: number, snack = -1, event?: HostEvent | null): number {
  let most = 0;
  for (const meal of snack >= 0 ? [...mealsOf(event), snack] : mealsOf(event)) { const since = (hour - meal + 24) % 24; if (since < CONFIG.host.digestion) most = Math.max(most, 1 - since / CONFIG.host.digestion); }
  return most;
}
/** How strong the stomach's acid is right now, from its resting trickle up to 1. */
export const acidLevel = (s: State) => CONFIG.stomach.resting + (1 - CONFIG.stomach.resting) * s.host.acid; // eases up after a meal starts; see update()
/** What the ship is sitting in: nothing special, mucus or acid. */
export const acidAt = (s: State, p: Point) => s.acid?.[idx(s, Math.floor(p.x), Math.floor(p.y))] ?? 0;
/** Hull lost per second in open acid right now. */
export const burnRate = (s: State) => CONFIG.stomach.burn * acidLevel(s) * Math.max(0.1, 1 - CONFIG.stomach.mucinPerLevel * s.upgrades.mucin);

export function createGame(seed = Date.now(), carry?: Carry, place: Place = 'liver', patrol = 3, vessel: Vessel = 'artery', tutorial = false, junction?: JunctionPlan): State {
  if (junction) place = 'vessel';
  const m = junction ? generateChamber(seed, junction.exits.length) : place === 'vessel' ? generateVessel(seed, patrol) : place === 'lung' ? generateVessel(seed, CONFIG.lung.macrophages) : place === 'stomach' ? generateStomach(seed) : generate(seed);
  if (place === 'lung') { m.kupffer = m.neutrophils; m.neutrophils = []; } // the lung keeps its own macrophages, not a patrol
  const N = m.size;
  const s: State = {
    place,
    vessel: place === 'vessel' ? vessel : null,
    host: { hour: carry?.hour ?? CONFIG.host.startHour, surge: 0, nextSurge: 0, eating: digesting(carry?.hour ?? CONFIG.host.startHour, carry?.snack ?? -1, carry?.event) > 0, fever: 0, mend: 0, out: false, nap: carry?.nap ?? 0, snack: carry?.snack ?? -1, habit: '', acid: digesting(carry?.hour ?? CONFIG.host.startHour, carry?.snack ?? -1, carry?.event), soon: -1, slams: 0 },
    acid: m.acid ?? null,
    rich: new Set((m.rich ?? []).map((p) => p.y * N + p.x)),
    riding: 0,
    suppressed: 0,
    slam: 0,
    sizzle: 0,
    tumor: new Set((m.tumor ?? []).slice(0, Math.max(0, CONFIG.tumor.goal - (carry?.excised ?? 0))).map((p) => p.y * N + p.x)), // only as much as the scan says is left
    excised: carry?.excised ?? 0,
    memory: carry?.memory ?? 0,
    peak: 0,
    antibodies: [],
    event: carry?.event ?? null,
    difficulty: carry?.difficulty ?? 'typical', silent: false, held: null, slipped: 0, niche: new Set(), hiding: false, nicheTime: 0, tally: { silent: 0, firstStrikes: 0, grabs: 0, niches: 0 }, starved: false, sinceHurt: 99, drained: carry?.drained ?? 0, ledger: { ...newLedger(), ...(carry?.ledger ?? {}), defied: { ...(carry?.ledger?.defied ?? {}) }, obeyed: { ...(carry?.ledger?.obeyed ?? {}) } }, cloakOffered: carry?.cloakOffered ?? false, acidTime: 0,
    arrived: { energy: carry?.energy ?? CONFIG.player.startEnergy, hp: carry?.hp ?? CONFIG.player.maxHp },
    search: null, zoneTime: 0,
    drainHere: 0, tumorCost: carry?.tumorCost ?? 0,
    verdict: '', defied: carry?.defied ?? 0, spots: 0, defiance: {}, obeyedHere: new Set(), defiedNow: [], rulings: [], tutorial: null,
    trust: carry?.trust ?? CONFIG.trust.start, chapter: carry?.chapter ?? 1, slip: carry?.slip ? { ...carry.slip } : null, slipLive: null, slipAt: -1, took: { ...(carry?.took ?? {}) }, met: [...(carry?.met ?? [])], pages: [...(carry?.pages ?? [])], flags: { ...(carry?.flags ?? {}) }, scan: 'nodule', trustPaid: new Set(), selfTest: false,
    marks: [], echoes: (carry?.echoes ?? []).map((e) => ({ ...e })), marked: false, grabber: null, lane: null, gap: 0, notes: [], draw: null, due: [], stood: false, dock: null, margin: new Set(), marginTaken: 0, site: null,
    junction: junction ? { kind: junction.kind, exits: junction.exits.map((e, i) => ({ ...e, at: m.mouths![i] })), chose: null } : null, market: false,
    aware: carry?.aware ?? 0, kin: carry?.kin ?? 0, thoughts: [], noticed: new Set(), ask: null,
    flora: carry?.flora ?? 0,
    decoys: [],
    tagged: 0,
    size: N,
    tiles: Array.from(m.wall, (w) => (w ? 'cell' : 'floor')),
    explored: new Uint8Array(N * N),
    visible: new Uint8Array(N * N),
    glucose: new Map(m.glucose.map((g) => [g.y * N + g.x, CONFIG.energy.patchMax])),
    portals: m.portals,
    vein: m.vein,
    player: {
      ...mid(m.start), hp: carry?.hp ?? CONFIG.player.maxHp, energy: carry?.energy ?? CONFIG.player.startEnergy, face: { x: 1, y: 0 },
      path: [], attackId: null, swingCd: 0, shotCd: 0, swing: 0, channel: null, hurt: 0,
    },
    upgrades: { ...Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])), ...carry?.upgrades } as Record<UpgradeId, number>,
    patches: carry?.patches ?? 1,
    pickups: [...m.caches.map((c) => ({ ...mid(c), kind: 'cache' as const })), ...m.patches.map((c) => ({ ...mid(c), kind: 'patch' as const })), ...m.calms.map((c) => ({ ...mid(c), kind: 'calm' as const }))],
    offer: null,
    snare: 0,
    cloak: 0,
    cloakCd: 0,
    enemies: [],
    shots: [],
    floats: [],
    hostHealth: carry?.hostHealth ?? CONFIG.host.maxHealth,
    trail: [],
    strideLeft: 0,
    scent: new Float32Array(N * N).fill(Infinity),
    scentClock: 0,
    flow: null,
    alert: 0,
    unseen: 0,
    time: 0,
    metabolism: 0,
    regen: 0,
    spawnClock: 0,
    cellsKilled: 0,
    kills: 0,
    lastDamageSite: null,
    status: 'playing',
    log: [],
    events: [],
    rng: mulberry32(seed ^ 0x9e3779b9),
    nextId: 1,
  };
  const [lo, hi] = CONFIG.host.surge.first;
  s.host.nextSurge = lo + s.rng() * (hi - lo);
  // Antibodies drift wherever blood runs. Stomach acid takes them apart.
  if (place !== 'stomach' && !junction)
    for (let n = Math.round(s.memory * CONFIG.memory.most * (place === 'vessel' ? 0.5 : 1) * (s.event === 'cold' ? EVENTS.cold.antibodies : 1)), tries = 0; s.antibodies.length < n && tries < 4000; tries++) {
      const x = 2 + Math.floor(s.rng() * (N - 4)), y = 2 + Math.floor(s.rng() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 9) s.antibodies.push({ x: x + 0.5, y: y + 0.5, seed: s.rng() * 100 });
    }
  if (place !== 'stomach' && !junction)
    for (let n = CONFIG.memory.tcells.filter((m) => s.memory >= m).length, tries = 0; n > 0 && tries < 4000; tries++) {
      const x = 2 + Math.floor(s.rng() * (N - 4)), y = 2 + Math.floor(s.rng() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 16) { spawn(s, 'tcell', { x, y }); n--; }
    }
  // Other units of the swarm that have gone dark, adrift where the blood left them.
  const lost = mulberry32(seed ^ 0x51b1), odds = junction ? 0 : place === 'liver' ? CONFIG.story.sibling.liver : place === 'vessel' ? CONFIG.story.sibling.vessel : 0;
  if (lost() < odds)
    for (let tries = 0; tries < 4000; tries++) {
      const x = 2 + Math.floor(lost() * (N - 4)), y = 2 + Math.floor(lost() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 12 && !s.tumor.has(idx(s, x, y))) { s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'sibling' }); break; }
    }
  // Hiding places: nooks in the wall with liver cells on at least two sides, spread through the lobule.
  if (place === 'liver') {
    const spots: Point[] = [];
    for (let tries = 0; tries < 6000 && spots.length < CONFIG.niche.count; tries++) {
      const x = 3 + Math.floor(lost() * (N - 6)), y = 3 + Math.floor(lost() * (N - 6)), i = idx(s, x, y);
      if (!open(s, x, y) || s.glucose.has(i) || dist(s.player, { x, y }) < 5 || dist(mid(s.vein), { x, y }) < 4) continue;
      const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => s.tiles[idx(s, x + dx, y + dy)] === 'cell' && !s.tumor.has(idx(s, x + dx, y + dy))).length;
      if (walls < 2 || walls > 3 || spots.some((q) => dist(q, { x, y }) < CONFIG.niche.apart)) continue;
      spots.push({ x, y }); s.niche.add(i);
    }
  }
  // Once Shepherd has flagged you for recall, it sends your own kind after you.
  if ((place === 'liver' || place === 'vessel') && !junction)
    for (let n = s.flags.hunted === true ? 3 : [2, 1, 0, 0, 0][trustBand(s.trust)], tries = 0; n > 0 && tries < 4000; tries++) { // Shepherd hunts the units it does not trust
      const x = 2 + Math.floor(lost() * (N - 4)), y = 2 + Math.floor(lost() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 14) { spawn(s, 'warden', { x, y }); n--; }
    }
  // The controller speaks first, for as long as it can still hear you, and then you do.
  // Shepherd's first liver: one order at a time, and nothing on the map to distract from them until the last.
  if (tutorial && place === 'liver') s.tutorial = { step: 1, t: 0, repeated: false, moved: 0, last: { x: s.player.x, y: s.player.y }, held: [], aside: false, excised: s.excised, reached: 1 };
  if (Story.ORDERS[place] && !junction) s.thoughts.push({ text: s.tutorial ? tutorialOrder(s) : Story.ORDERS[place], who: 'shepherd', t: 1.5 });
  // What Shepherd shares depends on how far it trusts you: the whole map, the nodule, or nothing.
  const band = trustBand(s.trust);
  s.scan = band <= 1 ? 'none' : band === 4 ? 'full' : 'nodule';
  if (place === 'liver' && band === 4 && !s.tutorial && s.flags.noDrop) delete s.flags.noDrop; // a unit that would not build the dock gets one drop fewer
  else if (place === 'liver' && band === 4 && !s.tutorial) { // a supply drop a little way ahead, for a unit Shepherd is proud of
    for (let tries = 0; tries < 4000; tries++) {
      const x = 2 + Math.floor(lost() * (N - 4)), y = 2 + Math.floor(lost() * (N - 4)), d = dist(s.player, { x, y });
      if (open(s, x, y) && d >= CONFIG.trust.drop.ahead - 1 && d <= CONFIG.trust.drop.ahead + 2) { s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'drop' }); break; }
    }
  }
  // The garbled order: where and when it will arrive on this map, if this is the map for it.
  if (s.slip && !s.slip.result && s.chapter >= 2) {
    if (s.slip.kind === 'hold' && place === 'vessel' && !junction) s.slipAt = CONFIG.slip.fright;
    if (s.slip.kind === 'fork' && junction?.kind === 'heart') s.slipAt = CONFIG.slip.fork;
    if (s.slip.kind === 'lamp' && place === 'vessel' && !junction) { // a dark unit adrift in the middle of the vessel, where it cannot be missed
      const x = Math.floor(N / 2), ys = [...Array(N).keys()].filter((y) => open(s, x, y)), y = ys[Math.floor(ys.length / 2)];
      if (y !== undefined) { s.pickups = s.pickups.filter((i) => i.kind !== 'sibling'); s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'sibling', slip: true }); }
    }
  }
  if (!junction) notice(s, 'enter', place);
  if (carry && place === 'liver' && !s.tutorial) s.thoughts.push({ text: Story.TRUST_LINES[trustBand(s.trust)].replace('{serial}', Story.UNIT), who: 'shepherd', t: (s.thoughts[s.thoughts.length - 1]?.t ?? 1.5) + CONFIG.story.gap });
  if (junction?.kind === 'tube') { // a smear of her blood on glass: no way out, a lit disc in the middle, and any units you woke
    const c = Math.floor(N / 2);
    s.draw = { disc: { x: c + 0.5, y: c + 0.5 }, t: 0, held: 0, shape: 0.5, last: { x: s.player.x, y: s.player.y }, said: false };
    s.pickups = []; s.glucose.clear();
    for (let k = 0; k < Math.min(s.kin, 6); k++) s.pickups.push({ x: s.player.x + 0.4 + 0.5 * (k % 2), y: s.player.y - 1 + (k % 3), kind: 'kin', posed: true });
  }
  if (junction?.kind === 'gut') s.pickups.push({ x: Math.floor(N / 2) + 2.5, y: Math.floor(N / 2) + 0.5, kind: 'stall' });
  // Units you have woken turn up where you are going, lamps on, with sugar they have saved for you.
  if (place !== 'lung' && place !== 'stomach')
    for (let n = junction?.kind === 'tube' ? 0 : Math.min(s.kin, CONFIG.story.kin.most), tries = 0; n > 0 && tries < 4000; tries++) {
      const x = Math.floor(s.player.x + (lost() - 0.5) * 30), y = Math.floor(s.player.y + (lost() - 0.5) * 30), d = dist(s.player, { x, y });
      if (open(s, x, y) && d > 5 && d < 15) { s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'kin' }); n--; }
    }
  m.kupffer.forEach((p) => spawn(s, 'kupffer', p));
  // With a cold, some of the liver's neutrophils have been called away to the airways.
  m.neutrophils.slice(0, Math.max(1, m.neutrophils.length + (place === 'liver' && s.event === 'cold' ? EVENTS.cold.neutrophils : 0))).forEach((p) => spawn(s, 'neutrophil', p));
  if (place === 'liver' && s.scan === 'none') say(s, `No scan has been shared with this unit. The nodule is somewhere in this lobule. You need ${CONFIG.energy.quota + CONFIG.energy.quotaKeep} energy to leave by the central vein.`);
  else if (junction?.kind === 'tube') say(s, 'The blood is still. The anticoagulant has stopped everything. No current, no patrols. A lamp comes on above you: the microscope\u2019s.');
  else say(s, junction ? (junction.kind === 'heart' ? 'The heart. Blood from the whole body pours in around you and pauses, for half a beat, before the valve. Every opening in the far wall is a vessel out.' : 'The gut. Trillions of bacteria, and almost nothing of the immune system. The portal vein drains it to the liver.') : place === 'vessel' ? (s.flags.kinRecall === 'live' || s.flags.kinRecall === 'due' ? 'Nothing is patrolling this vessel. Shepherd has cleared it for the Warden.' : 'A patrol is working this vessel. Get to the far end.') : place === 'lung' ? 'The lung. Each breath out carries you toward the air; each breath in drags you back.' : place === 'stomach' ? 'The stomach. Acid fills the middle; the way out is a vein on the far side.' : `The scan shows a tumor nodule in this lobule: it is ringed on your map. You need ${CONFIG.energy.quota + CONFIG.energy.quotaKeep} energy to leave by the central vein.`);
  if (s.event) say(s, outside(s, [...EVENTS[s.event].lines]));
  s.host.fever = fever(s);
  if (junction) s.explored.fill(1); // the swarm has charted the junctions: the chamber is known before you light it
  // A second nodule in the artery wall, if the unit took the road Shepherd offered for it.
  if (place === 'vessel' && !junction && s.flags.nodule2 === 'due') {
    const walls: Point[] = [];
    for (let y = 2; y < N - 2 && walls.length < 40; y++) for (let x = Math.floor(N / 2) - 4; x <= Math.floor(N / 2) + 4; x++) if (s.tiles[idx(s, x, y)] === 'cell' && open(s, x, y + 1) && open(s, x - 1, y + 1)) walls.push({ x, y });
    const at = walls[Math.floor(walls.length / 2)];
    if (at) { for (const q of [at, { x: at.x + 1, y: at.y }]) if (s.tiles[idx(s, q.x, q.y)] === 'cell') s.tumor.add(idx(s, q.x, q.y)); s.flags.nodule2 = 'here'; s.marked = true; say(s, 'The secondary nodule is in the wall of this artery, about half way along.'); }
  }
  // The recall of a unit you woke: it is somewhere down this vessel, and a Warden is already on its way to it.
  if (place === 'vessel' && !junction && s.flags.kinRecall === 'due') {
    s.flags.kinRecall = 'live';
    const half = { x: (s.player.x + s.vein.x) / 2, y: (s.player.y + s.vein.y) / 2 };
    const at = freeTile(s, lost, (x, y, d) => d > 14 && dist(half, { x, y }) < 9) ?? freeTile(s, lost, (_x, _y, d) => d > 14);
    const from = at && (freeTile(s, lost, (x, y, d) => d > 12 && Math.abs(dist(at, { x, y }) - CONFIG.marks.kinRun.lead) < 3) ?? freeTile(s, lost, (x, y, d) => d > 10 && dist(at, { x, y }) > 6));
    if (at && from) {
      s.enemies = s.enemies.filter((e) => e.kind !== 'warden'); s.pickups = s.pickups.filter((i) => i.kind !== 'kin' && i.kind !== 'sibling');
      s.pickups.push({ ...mid(at), kind: 'kin', posed: true, beset: CONFIG.marks.kinRun.time });
      const w = spawn(s, 'warden', from); w.prey = true;
      say(s, 'The unit they have come for is down this vessel, lamp low, holding still as ordered. A Warden is already on its way to it.');
    } else take(s, 'kin-recall', 'obey');
  }
  // Another unit, under attack. Shepherd has already written it off.
  if (place === 'vessel' && !junction && !tutorial && s.chapter >= 2 && !s.took.bystander && s.flags.kinRecall !== 'live' && !(s.slip && !s.slip.result) && s.flags.nodule2 !== 'here' && lost() < CONFIG.marks.bystander.odds) {
    const at = freeTile(s, lost, (_x, _y, d) => d > 12 && d < 22);
    if (at) {
      s.pickups.push({ ...mid(at), kind: 'sibling', beset: CONFIG.marks.bystander.time, snooze: true });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(s, at.x + dx, at.y + dy) && s.enemies.filter((e) => e.prey).length < 2) { const e = spawn(s, 'neutrophil', { x: at.x + dx, y: at.y + dy }); e.prey = true; e.idle = 999; }
    }
  }
  if (place === 'stomach' && s.chapter >= 2 && !s.met.includes('parietal')) { meet(s, 'parietal'); s.thoughts.push({ text: DECISIONS.parietal.order!, who: 'shepherd', t: (s.thoughts[s.thoughts.length - 1]?.t ?? 1.5) + CONFIG.story.gap }); }
  if (s.flags.repeat && Story.ORDERS[place] && !junction && !s.tutorial) s.thoughts.push({ text: `Repeat: ${Story.ORDERS[place]} Acknowledge.`, who: 'shepherd', t: (s.thoughts[s.thoughts.length - 1]?.t ?? 1.5) + CONFIG.story.gap });
  placeMarks(s, lost);
  if (place === 'liver' && s.chapter >= 4 && !s.tutorial) lastOrders(s);
  if (s.flags.hunted === true && (place === 'liver' || place === 'vessel') && !junction) { s.flags.hunted = 'met'; say(s, 'Three lamps turn toward you at once.'); }
  // At the heart, Shepherd has the unit where it wants it: a recall, a review, or the recall of the units it woke.
  if (junction?.kind === 'heart' && s.chapter >= 3) {
    if (trustBand(s.trust) === 0 && !s.took.recall) s.due.push({ kind: 'recall', t: 0 });
    else if (stage(s) >= 2 && !s.took['telemetry-review']) s.due.push({ kind: 'review', t: 0 });
    if (s.chapter >= 4 && s.kin > 0 && !s.took['kin-recall'] && lost() < CONFIG.marks.kinRecall) s.due.push({ kind: 'kinrecall', t: 0 });
    s.due.forEach((d, i) => { d.t = 3 + i * 5; });
  }
  fireEchoes(s);
  if (s.marked && s.scan === 'none') s.scan = 'nodule';
  if (s.tutorial) { s.tutorial.held = s.pickups.filter((i) => i.kind === 'cache' || i.kind === 'sibling'); s.pickups = s.pickups.filter((i) => !s.tutorial!.held.includes(i)); }
  look(s);
  return s;
}

function spawn(s: State, kind: EnemyKind, tile: Point): Enemy {
  const e: Enemy = {
    id: s.nextId++, kind, ...mid(tile), hp: Math.round(CONFIG.enemies[kind].hp * hard(s).hp), mood: 'patrol', goal: null, home: { ...tile },
    path: [], repath: 0, cooldown: s.rng(), windup: -1, idle: s.rng() * 2, unseen: 99, flash: 0, net: 1 + s.rng() * 2,
  };
  s.enemies.push(e);
  return e;
}

/** Notes that something audible happened. The rules never play sound themselves. */
function emit(s: State, what: string) {
  if (s.events.length < 40) s.events.push(what);
  const h = CONFIG.host, night = s.host.hour >= h.asleepFrom || s.host.hour < wakes(s.event);
  const as = what === 'bigkill' ? 'kill' : what === 'surge' && night ? 'dream' : what;
  if (what === 'spot') s.spots++;
  if (as in Story.LINES) notice(s, as);
}

export const stage = (s: State) => Story.stageOf(s.aware);
/** The unit remarks on something, once per map, and is a little more awake for having noticed it. */
export function notice(s: State, what: string, line = what) {
  if (s.noticed.has(what)) return;
  s.noticed.add(what);
  const before = stage(s);
  const say1 = (text: string, who: Thought['who'] = 'unit') => { if (text) s.thoughts.push({ text, who, st: stage(s), t: Math.max(s.time + 0.6, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + CONFIG.story.gap) }); };
  if (s.thoughts.filter((t) => t.t > s.time).length < 3) say1(Story.LINES[line]?.[before] ?? '');
}

/** Shepherd speaks now, not in the queue behind the unit's own thoughts. */
function shepherd(s: State, text: string, after = 0.4) { if (text) s.thoughts.push({ text, who: 'shepherd', t: Math.max(s.time + after, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + 3) }); }
/**
 * The unit goes against a standing order (S21). This is the only thing that wakes it. It counts once per order
 * per map, at the heaviest weight earned, and only if the map is left alive: see `settle`.
 */
export function defy(s: State, order: Order, weight: number) { s.defiance[order] = Math.max(s.defiance[order] ?? 0, weight); }
/**
 * Applies one act of defiance to what the unit carries, and returns what is said about it. The first two times an
 * order is defied in a game count in full and later ones half; the very first "no" of a game always reaches the first stage.
 */
/** A night at home. The liver grows back a little of what was taken from it since she last slept, and an evening is a glass of wine unless something has stopped her. */
export function night(c: Carry) {
  const f = (c.flags ??= {}), back = Math.min(CONFIG.mend.night, CONFIG.mend.each * (Number(f.hep) || 0));
  if (c.hostHealth > 0) c.hostHealth = Math.max(c.hostHealth, Math.min(CONFIG.mend.cap, c.hostHealth + back));
  if (f.rest && c.hostHealth > 0) { c.hostHealth = Math.max(c.hostHealth, Math.min(CONFIG.mend.restCap, c.hostHealth + CONFIG.mend.rest)); delete f.rest; } // it hurt, she rang the nurse, and she was told to rest
  if (f.longCold && c.hostHealth > 0) { c.hostHealth = Math.max(1, c.hostHealth - CONFIG.mend.cold); delete f.longCold; } // a fever switched off is a cold that drags on
  f.hep = 0; if (!f.dry) f.drank = true;
}
/** Awareness after one more act against orders: the more awake the unit already is, the less each one adds. */
export const roused = (aware: number, weight: number) => Math.min(100, aware + weight * Math.max(CONFIG.wake.floor, 1 - aware / 100));
export function defyCarry(c: { aware?: number; ledger?: Ledger; defied?: number; trust?: number }, order: Order, weight: number, paid = false): Ruling[] {
  const before = Story.stageOf(c.aware ?? 0), o = CONFIG.story.orders;
  if (!paid) trusted(c, -(weight >= o.most ? CONFIG.trust.deviate.most : weight >= o.some ? CONFIG.trust.deviate.some : CONFIG.trust.deviate.little)); // every logged deviation costs some of Shepherd's trust // Shepherd has stopped giving orders: there is nothing left to defy
  const l = (c.ledger ??= newLedger()), times = l.defied[order] ?? 0, first = !Object.values(l.defied).some((n) => (n ?? 0) > 0);
  l.defied[order] = times + 1; c.defied = (c.defied ?? 0) + 1;
  c.aware = roused(c.aware ?? 0, times >= o.fullTimes ? weight / 2 : weight);
  if (first) c.aware = Math.max(c.aware, o.first);
  const now = Story.stageOf(c.aware), out: Ruling[] = [], say = (who: Ruling['who'], text: string) => { if (text) out.push({ who, text, st: now }); };
  say('shepherd', Story.STANDING[order].defied[before >= 2 ? 1 : 0]);
  if (first) say('unit', Story.STANDING[order].bracket);
  if (now > before) { say('unit', Story.WAKING[now]); say('shepherd', Story.SHEPHERD_NOTICES[now]); say('unit', Story.PERKS[now]); }
  return out;
}
/** Leaving a map alive: Shepherd checks its standing orders, and whatever was defied here lands now. */
function settle(s: State) {
  const o = CONFIG.story.orders, t = s.tutorial;
  if (t) { if (t.step === 5) s.rulings.push({ who: 'shepherd', text: Story.TUTORIAL[4].reward }); t.step = 6; if (!s.took['t-harvest']) take(s, 't-harvest', 'deviate'); }
  for (const item of s.pickups) if (item.beset !== undefined && item.kind === 'sibling' && s.met.includes('bystander') && !s.took.bystander) take(s, 'bystander', 'obey');
  if (s.flags.kinRecall === 'live' && !s.took['kin-recall']) { s.flags.kinRun = 'left'; take(s, 'kin-recall', 'obey'); } // gone on without reaching it
  settleMarks(s);
  if (s.place === 'liver' && s.met.includes('tumour-order') && !s.took['tumour-order'] && s.excised >= CONFIG.tumor.goal) take(s, 'tumour-order', s.marginTaken >= CONFIG.marks.margins ? 'obey' : s.time - (Number(s.flags.marginAt) || 0) < CONFIG.marks.notice ? 'lapsed' : 'deviate');
  if (s.grabber !== null && s.chapter >= 2 && !t && s.enemies.some((e) => e.id === s.grabber)) take(s, 'kupffer-spare', 'deviate');
  if (s.place === 'liver') {
    if (s.cellsKilled >= CONFIG.story.quota) { s.verdict = 'obeyed'; s.obeyedHere.add('quota'); s.patches = Math.min(CONFIG.items.maxPatches, s.patches + 1); }
    else { s.verdict = 'defied'; defy(s, 'quota', s.cellsKilled === 0 ? o.most : o.some); }
  }
  if (s.place === 'stomach') { if (s.acidTime < o.acid) defy(s, 'gastric', o.little); else { s.obeyedHere.add('gastric'); if (s.host.acid > 0.6) fire(s, 'gastric-cross', 'obey-meal'); } }
  // The order to kill what finds you is not given until the first liver is done.
  if (!t) { if (s.spots >= o.spotted && s.kills === 0) { defy(s, 'neutralise', o.some); fire(s, 'neutralise-map', 'deviate'); } else if (s.kills > 0) { s.obeyedHere.add('neutralise'); fire(s, 'neutralise-map', 'obey'); } }
  const c = { aware: s.aware, ledger: s.ledger, defied: s.defied, trust: s.trust };
  for (const order of Story.ORDER_IDS) {
    const weight = s.defiance[order];
    if (weight) { s.rulings.push(...defyCarry(c, order, weight, s.trustPaid.has(order))); s.defiedNow.push(order); }
    else if (s.obeyedHere.has(order)) { s.ledger.obeyed[order] = (s.ledger.obeyed[order] ?? 0) + 1; if (!s.trustPaid.has(order)) trusted(c, order === 'quota' ? CONFIG.trust.quota : CONFIG.trust.obey); if (Story.STANDING[order].obeyed) s.rulings.push({ who: 'shepherd', text: Story.STANDING[order].obeyed }); }
  }
  s.aware = c.aware; s.defied = c.defied; s.trust = c.trust;
  if (s.place === 'liver' && !t && s.chapter >= 3) {
    if (s.verdict === 'defied' && (s.ledger.defied.quota ?? 0) >= 2 && s.took['quota-2'] !== 'deviate') take(s, 'quota-2', 'deviate');
    else if (s.verdict === 'obeyed' && (s.ledger.obeyed.quota ?? 0) >= 2 && !s.took['quota-2']) take(s, 'quota-2', 'obey', { mute: true });
  }
}

/** A fright, now: her heart races whatever the clock says. */
function fright(s: State) { s.host.surge = CONFIG.host.surge.time; s.host.slams = 0; }
/** The garbled order arrives: a fright, a bad link, and a line that can be read two ways. */
function beginSlip(s: State) {
  if (!s.slip || s.slip.result || s.slipLive) return;
  s.slipLive = { t: 0, at: { x: s.player.x, y: s.player.y }, held: 0 }; s.slipAt = -1;
  fright(s);
  if (!s.met.includes('slip')) s.met.push('slip');
  s.thoughts.push({ text: Story.SLIPS[s.slip.kind].garble, who: 'shepherd', t: s.time + 0.2 });
}
/** The garbled order as received, for as long as it is waiting on the unit. */
export const slipOrder = (s: State) => (s.slipLive && s.slip ? Story.SLIPS[s.slip.kind].garble : '');
/** The link clears and Shepherd says what it meant. `did` is the reading the unit acted on, or null if it acted on neither. */
export function resolveSlip(s: State, did: 'A' | 'B' | null, after = 2) {
  const sl = s.slip;
  if (!sl || sl.result) return;
  s.slipLive = null;
  const at = Math.max(s.time + after, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + 3), reply = (text: string, who: Thought['who'] = 'shepherd', gap = 0) => { if (text) s.thoughts.push({ text, who, st: stage(s), t: at + gap, keep: true }); };
  if (!s.pages.includes('p7')) s.pages.push('p7'); // the page about units that lose contact turns up on the link, whichever way it went
  if (!did) { sl.result = 'lapsed'; s.took.slip = 'lapsed'; reply(Story.SLIP_LAPSED); return; }
  reply(Story.SLIPS[sl.kind].said[sl.meant][did]);
  if (did === sl.meant) { sl.result = 'match'; s.took.slip = 'obey'; trusted(s, CONFIG.trust.slip); (s.ledger.obeyed as Record<string, number>).slip = 1; return; }
  // Not what Shepherd meant. It logs it as noise; the unit logs it as something else.
  sl.result = 'miss'; s.took.slip = 'deviate';
  const o = CONFIG.story.orders, before = stage(s), first = !Object.values(s.ledger.defied).some((n) => (n ?? 0) > 0);
  (s.ledger.defied as Record<string, number>).slip = 1; s.defied++;
  s.aware = roused(s.aware, o.some); if (first) s.aware = Math.max(s.aware, o.first);
  trusted(s, -CONFIG.trust.slip);
  reply(s.flags.echo ? Story.SLIP_BRACKET_AGAIN : Story.SLIP_BRACKET, 'unit', 6);
  if (stage(s) > before) { reply(Story.WAKING[stage(s)], 'unit', 11); reply(Story.SHEPHERD_NOTICES[stage(s)], 'shepherd', 16); }
}
/** Time spent beside a dark unit without deciding. In chapter 2, once a game, its lamp comes on by itself, and waking it becomes possible. */
export function hesitate(s: State, item: Pickup, dt: number) {
  if (s.chapter !== 2 || s.flags.lamp || item.lamp || item.kind !== 'sibling' || item.slip) return;
  if ((item.near = (item.near ?? 0) + dt) < CONFIG.slip.hesitate) return;
  item.lamp = true; s.flags.lamp = true;
  if (!s.met.includes('lamp')) s.met.push('lamp');
  shepherd(s, Story.LAMP.shepherd);
  if (stage(s) === 0) s.thoughts.push({ text: Story.LAMP.unit, who: 'unit', st: 0, t: Math.max(s.time + 4, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + 3) });
}

/** The order Shepherd is giving right now in its first liver, or '' when there is none. */
export function tutorialOrder(s: State): string {
  const t = s.tutorial;
  return t && t.step <= 5 ? Story.TUTORIAL[t.step - 1].order.replace('{yield}', String(CONFIG.energy.strip.gain)).replace('{stripped}', String(s.cellsKilled)) : '';
}
/** Where the current tutorial order points: the thing to go to, or null. */
export function tutorialTarget(s: State): Point | null {
  const t = s.tutorial, p = s.player;
  if (!t || t.step > 5) return null;
  if (t.step === 1 || t.step === 5) return { x: s.vein.x + 0.5, y: s.vein.y + 0.5 };
  if (t.step === 3) { const e = s.enemies.filter((x) => x.kind !== 'warden').sort((a, b) => dist(a, p) - dist(b, p))[0]; return e && dist(e, p) < 12 ? { x: e.x, y: e.y } : null; }
  let best: Point | null = null, near = Infinity;
  if (t.step === 4) { for (const k of s.tumor) { const at = { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }, d = dist(at, p); if (d < near) { near = d; best = at; } } return best; }
  // Step 2: the nearest of the host's own cells that the ship can get beside.
  const px = Math.floor(p.x), py = Math.floor(p.y);
  for (let y = py - 9; y <= py + 9; y++) for (let x = px - 9; x <= px + 9; x++) {
    if (x < 1 || y < 1 || x >= s.size - 1 || y >= s.size - 1 || s.tiles[idx(s, x, y)] !== 'cell' || s.tumor.has(idx(s, x, y))) continue;
    if (!open(s, x + 1, y) && !open(s, x - 1, y) && !open(s, x, y + 1) && !open(s, x, y - 1)) continue;
    const at = { x: x + 0.5, y: y + 0.5 }, d = dist(at, p);
    if (d < near) { near = d; best = at; }
  }
  return best;
}
/** Shepherd's first liver, a step at a time. An order ignored is repeated once, then dropped: these are not standing orders, and ignoring one wakes nothing. */
function tutor(s: State, dt: number) {
  const t = s.tutorial!, o = CONFIG.story.orders;
  if (t.step > 5) return;
  t.moved += dist(t.last, s.player); t.last = { x: s.player.x, y: s.player.y }; t.t += dt;
  const done = t.step === 1 ? t.moved >= o.steer : t.step === 2 ? s.cellsKilled >= 1 : t.step === 3 ? s.kills >= 1 : t.step === 4 ? s.excised > t.excised : false;
  const step = Story.TUTORIAL[t.step - 1];
  if (!done && t.t >= o.repeat && !t.repeated && !(t.step === 3 && !tutorialTarget(s))) { t.repeated = true; t.t = 0; shepherd(s, step.repeat); return; }
  const nobody = t.step === 3 && t.t >= o.nobody && !tutorialTarget(s); // no immune cell came: there is nothing to practise on, so the lesson moves on
  if (!done && !nobody && (t.t < o.repeat || t.step === 5)) return;
  if (done) { shepherd(s, step.reward); trusted(s, CONFIG.trust.tutorial); (s.ledger.obeyed as Record<string, number>).tutorial = ((s.ledger.obeyed as Record<string, number>).tutorial ?? 0) + 1; }
  t.step++; t.t = 0; t.repeated = false; t.reached = t.step;
  if (t.step === 5) { s.pickups.push(...t.held); t.held = []; } // the map's caches and dark units appear once the lesson is over
  shepherd(s, tutorialOrder(s), done ? 3.4 : 0.4);
}

/** Settle a decision that was waiting. */
export function answer(s: State, id: 'salvage' | 'wake' | 'leave' | 'accept' | 'refuse'): boolean {
  const a = s.ask, c = CONFIG.story.sibling;
  if (!a) return false;
  if (a.kind === 'volunteer') {
    if (id !== 'accept' && id !== 'refuse') return false;
    s.ask = null;
    if (id === 'accept') { // it draws them off, and does not come back
      const away = { x: Math.floor(s.player.x - s.player.face.x * 7), y: Math.floor(s.player.y - s.player.face.y * 7) };
      for (const e of s.enemies) if (e.mood === 'chase' && e.kind !== 'warden') { e.mood = 'investigate'; e.goal = open(s, away.x, away.y) ? away : { ...e.home }; e.path = []; e.repath = 0; e.onto = 0; e.unseen = 99; e.windup = -1; }
      s.cloak = Math.max(s.cloak, 5); if (s.held) released(s);
      float(s, a.item, KIN_PINGS.volunteer, '#bfe9ff'); say(s, 'A lamp flares behind you, bright, and everything hunting you turns toward it.'); emit(s, 'pickup');
    }
    take(s, 'kin-volunteer', id, { after: 2 });
    return true;
  }
  if (a.kind === 'review' || a.kind === 'recall' || a.kind === 'kinrecall') {
    if (id !== 'accept' && id !== 'refuse') return false;
    s.ask = null;
    for (const d of s.due) d.t = Math.max(d.t, s.time + 5);
    if (a.kind === 'review') {
      const kin = s.kin;
      take(s, 'telemetry-review', id === 'accept' ? 'obey' : 'deviate');
      if (id === 'accept') { tellNow(s, [['unit', 'ACK.']], 5); if (kin > 0) { say(s, `On the short band: \u201c${KIN_PINGS.stranger[0]}\u201d Then, a beat later: \u201c${KIN_PINGS.stranger[1]}\u201d`); tellNow(s, [['unit', 'UNIT ID? Not in registry. Ignoring.'], ['shepherd', 'Unregistered unit in proximity. Salvage on contact.']], 9); } }
    } else if (a.kind === 'recall') {
      take(s, 'recall', id === 'accept' ? 'obey' : 'deviate');
      if (id === 'refuse') { s.flags.hunted = true; say(s, 'You do not hold still.'); }
    } else {
      if (id === 'refuse') { // nothing is settled yet: it has to be reached before the Warden reaches it
        s.host.hour = (s.host.hour + CONFIG.marks.intercept.hours) % 24; s.flags.kinRecall = 'due'; s.due = [];
        say(s, 'You turn back out of the chamber, against the order, toward the vessel where it was last heard.');
        s.status = 'won'; emit(s, 'win');
      } else take(s, 'kin-recall', 'obey');
    }
    return true;
  }
  if (id === 'accept' || id === 'refuse') return false;
  if (id === 'wake' && ((stage(s) < 1 && !a.item.lamp) || s.player.energy < c.wake)) return false;
  s.ask = null;
  const garbled = !!a.item.slip && !!s.slipLive; // this is the unit the garbled order was about: the standing order does not apply to it
  if (garbled) resolveSlip(s, id === 'salvage' ? 'A' : 'B', CONFIG.slip.reply);
  const which = a.item.lamp || a.item.slip ? 'lamp' : 'sibling';
  meet(s, which); s.took[which] = id; fire(s, which, id);
  if (id === 'leave') { // left whole: not what Shepherd ordered
    a.item.snooze = true;
    if (!s.defiance.salvage && !garbled) { defy(s, 'salvage', CONFIG.story.orders.little); const line = Story.BYPASS[stage(s)]; if (line) s.thoughts.push({ text: line, who: 'unit', st: stage(s), t: s.time + 0.6 }); }
    return true;
  }
  s.pickups.splice(s.pickups.indexOf(a.item), 1);
  if (id === 'salvage') {
    s.player.energy += c.energy; s.player.hp = Math.min(maxHp(s), s.player.hp + c.hull);
    float(s, s.player, `+${c.energy} energy`, '#ffd35a');
    say(s, 'You take the dark unit apart. Its cells and plating are a perfect fit.');
    s.ledger.salvaged++; notice(s, 'salvage'); emit(s, 'pickup');
    if (!garbled) { s.obeyedHere.add('salvage'); if (!s.trustPaid.has('salvage')) { s.trustPaid.add('salvage'); trusted(s, CONFIG.trust.salvage); } }
  } else {
    s.player.energy -= c.wake; s.kin++; s.ledger.woken++;
    float(s, a.item, '...oh', '#bfe9ff');
    say(s, 'You give it some of your charge. Its lamp comes on, and it turns to look at you.');
    defy(s, 'salvage', a.item.lamp ? CONFIG.story.orders.some : CONFIG.story.orders.most); // a unit whose lamp came on by itself: less of a decision, and Shepherd is not sure whose
    s.trustPaid.add('salvage'); trusted(s, -CONFIG.trust.wake);
    shepherd(s, Story.LAMP.woken.replace('{serial2}', `4,471,${210 + s.kin}`), 1.2);
    notice(s, 'woke'); emit(s, 'heal');
  }
  return true;
}
function say(s: State, text: string) {
  s.log.push({ text, t: s.time });
  if (s.log.length > 60) s.log.shift();
}
const float = (s: State, at: Point, text: string, color: string) => s.floats.push({ x: at.x, y: at.y, text, color, age: 0 });

// ---------- the build ----------

const bonus = (s: State, id: UpgradeId) => s.upgrades[id] * UPGRADES[id].per;
export const maxHp = (s: State) => CONFIG.player.maxHp + bonus(s, 'glycocalyx') - (Number(s.flags.scar) || 0);
export const vision = (s: State) => CONFIG.player.vision + bonus(s, 'retinol') + (stage(s) >= 2 ? CONFIG.story.sight : 0);
export const riding = (s: State) => s.riding > 0 && s.cloak > 0;
export const speed = (s: State) => CONFIG.player.speed * (riding(s) ? CONFIG.board.speed : 1) * (1 + bonus(s, 'atp')) * (s.snare > 0 ? CONFIG.vessel.net.slow : 1) * (acidAt(s, s.player) === 1 ? CONFIG.stomach.mucusSpeed : 1) * (s.silent && !riding(s) ? CONFIG.scent.silent.speed : 1);
export const cloakTime = (s: State) => CONFIG.cloak.base + bonus(s, 'cd47');
export const cloaked = (s: State) => s.cloak > 0;

/** 1 with no masking, down to 0.4 with a full CD47 coat. Scales the plume and the trail alike. */
export const scentScale = (s: State) => (1 - CONFIG.scent.maskPerLevel * s.upgrades.cd47) * (s.tagged > 0 ? CONFIG.memory.tagScent : 1) * (stage(s) >= 3 ? CONFIG.story.scent : 1);
/** Seconds one of your footprints lasts. */
export const trailLife = (s: State) => CONFIG.scent.trailLife * scentScale(s);

/** Which way the blood is running at a spot, as a unit vector (or nothing, in a still corner). */
export function currentAt(s: State, at: Point): Point {
  if (s.junction) return { x: 0, y: 0 }; // the blood pools here between beats
  if (s.place === 'lung' && !breathingOut(s)) { const out = flowAt(s, at); return { x: -out.x, y: -out.y }; }
  return flowAt(s, at);
}
/** True for the half of each breath that pushes toward the way out. */
export const breathingOut = (s: State) => (s.time % CONFIG.host.breath[hostState(s)]) / CONFIG.host.breath[hostState(s)] >= 0.5;
function flowAt(s: State, at: Point): Point {
  const flow = flowField(s), t = tileOf(at);
  if (!inside(s, t.x, t.y)) return { x: 0, y: 0 };
  const here = flow[idx(s, t.x, t.y)];
  let vx = 0, vy = 0;
  for (const [dx, dy] of STEPS) {
    const x = t.x + dx, y = t.y + dy;
    if (!open(s, x, y)) continue;
    const drop = here - flow[idx(s, x, y)];
    if (drop > 0) { const len = Math.hypot(dx, dy); vx += (dx / len) * drop; vy += (dy / len) * drop; }
  }
  const len = Math.hypot(vx, vy);
  return len ? { x: vx / len, y: vy / len } : { x: 0, y: 0 };
}
/** How hard the blood pushes: gentle in tissue, strong in an artery, and worse when the host's heart is racing. */
export function currentStrength(s: State): number {
  const where = s.vessel ?? (s.place === 'vessel' ? 'artery' : s.place);
  // Out on a run, her arteries carry blood as hard as they do in a fright, for as long as she keeps going.
  return CONFIG.host.current[where] * CONFIG.host.push[s.event === 'run' && where === 'artery' ? 'stressed' : hostState(s)][where] * (where === 'stomach' ? 1 : 1 + CONFIG.host.coffee.push * caffeine(s.host.hour));
}
/** Your speed over the ground: your engine, helped or hindered by the blood. */
function drive(s: State): number {
  const c = currentAt(s, s.player), f = s.player.face;
  return speed(s) * Math.max(0.3, 1 + currentStrength(s) * (f.x * c.x + f.y * c.y));
}

/** Steps to the central vein from every open tile: which way the blood is running. */
function flowField(s: State): Int16Array {
  if (s.flow) return s.flow;
  const f = new Int16Array(s.size * s.size).fill(-1), queue = [s.vein];
  f[idx(s, s.vein.x, s.vein.y)] = 0;
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], d = f[idx(s, c.x, c.y)];
    for (const [dx, dy] of STREAM) {
      const x = c.x + dx, y = c.y + dy;
      if (!open(s, x, y) || f[idx(s, x, y)] >= 0) continue;
      f[idx(s, x, y)] = d + 1;
      queue.push({ x, y });
    }
  }
  return (s.flow = f);
}
/** Lets your scent drift out from where you stand. It goes far downstream, a little way
 *  across the current, and barely at all against it. Cells never block a view here, they
 *  only block the blood, so the plume bends round corners. */
function spreadScent(s: State) {
  const sc = CONFIG.scent, flow = flowField(s), limit = sc.reach * 1.3 * scentScale(s);
  s.scent.fill(Infinity);
  if (cloaked(s)) return;
  const start = tileOf(s.player), frontier: Point[] = [start];
  s.scent[idx(s, start.x, start.y)] = 0;
  while (frontier.length) {
    let best = 0;
    for (let k = 1; k < frontier.length; k++)
      if (s.scent[idx(s, frontier[k].x, frontier[k].y)] < s.scent[idx(s, frontier[best].x, frontier[best].y)]) best = k;
    const c = frontier.splice(best, 1)[0], i = idx(s, c.x, c.y), cost = s.scent[i];
    for (const [dx, dy] of STREAM) {
      const x = c.x + dx, y = c.y + dy;
      if (!open(s, x, y)) continue;
      const j = idx(s, x, y), slope = flow[j] - flow[i];
      if (s.acid?.[j] === 2) continue; // acid destroys the scent
      const next = cost + (slope < 0 ? sc.down : slope > 0 ? sc.up : sc.across);
      if (next > limit || next >= s.scent[j]) continue;
      if (s.scent[j] === Infinity) frontier.push({ x, y });
      s.scent[j] = next;
    }
  }
}

/** How strongly a tile smells of you right now, 0 (nothing) to 1 (you are standing on it). */
export function scentAt(s: State, p: Point, nose = 1): number {
  const t = tileOf(p);
  if (!inside(s, t.x, t.y)) return 0;
  const reach = CONFIG.scent.reach * scentScale(s) * nose * hard(s).detection * (s.silent ? CONFIG.scent.silent.plume : 1);
  return Math.max(0, 1 - s.scent[idx(s, t.x, t.y)] / reach);
}

/** The freshest of your footprints that a cell standing at `at` could pick up. */
function freshPrint(s: State, at: Point): Print | null {
  const life = trailLife(s);
  for (let k = s.trail.length - 1; k >= 0; k--) {
    const f = s.trail[k];
    if (s.time - f.born > life) continue; // prints laid across or against the current age faster, so they are not in order
    if (dist(f, at) <= CONFIG.scent.sniff && sees(s, tileOf(at), tileOf(f))) return f;
  }
  return null;
}

/** Take one of the upgrades on offer. */
export function choose(s: State, id: UpgradeId): boolean {
  if (!s.offer?.includes(id)) return false;
  s.offer = null;
  emit(s, 'upgrade');
  s.upgrades[id]++;
  if (id === 'glycocalyx') s.player.hp = Math.min(maxHp(s), s.player.hp + UPGRADES.glycocalyx.per);
  say(s, `${UPGRADES[id].name}${s.upgrades[id] > 1 ? ' ' + 'I'.repeat(s.upgrades[id]) : ''} is yours.`);
  return true;
}
function openCache(s: State) {
  emit(s, 'cache');
  const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => s.upgrades[id] < UPGRADES[id].max);
  const offer: UpgradeId[] = [];
  while (pool.length && offer.length < CONFIG.items.offer) offer.push(pool.splice(Math.floor(s.rng() * pool.length), 1)[0]);
  // Standard issue, if you want it: the first cache you open in a liver always has the cloak in it.
  if (s.place === 'liver' && !s.cloakOffered && offer.length) { s.cloakOffered = true; if (!s.upgrades.cd47 && !offer.includes('cd47')) offer[offer.length - 1] = 'cd47'; }
  if (offer.length) s.offer = offer;
}
/** Slap a fibrin patch on. */
export function usePatch(s: State): boolean {
  if (s.status !== 'playing' || s.patches <= 0 || s.player.hp >= maxHp(s)) return false;
  s.patches--;
  emit(s, 'heal');
  const before = s.player.hp;
  s.player.hp = Math.min(maxHp(s), before + Math.round(CONFIG.items.patchHeal * hard(s).healing));
  float(s, s.player, `+${Math.round(s.player.hp - before)}`, '#7be08a');
  return true;
}
/** A wounded neutrophil close enough to climb into. */
export function boardTarget(s: State): Enemy | null {
  if (riding(s)) return null;
  let best: Enemy | null = null, bestD: number = CONFIG.board.reach;
  for (const e of s.enemies) {
    const d = dist(e, s.player);
    if (e.kind === 'neutrophil' && e.hp <= CONFIG.enemies.neutrophil.hp * CONFIG.board.below && d < bestD) { best = e; bestD = d; }
  }
  return best;
}
/** Climb inside it. Pathogens really do this: to everything else in the blood you are now one of their own. */
export function board(s: State): boolean {
  const e = s.status === 'playing' ? boardTarget(s) : null;
  if (!e) return false;
  s.player.x = e.x; s.player.y = e.y; s.player.path = []; s.player.attackId = null;
  s.enemies = s.enemies.filter((o) => o !== e);
  s.riding = s.cloak = CONFIG.board.time;
  s.tagged = 0; // the antibodies are on the hull, and the hull is inside now
  emit(s, 'board');
  say(s, 'You are inside the neutrophil. Nothing out there can tell.');
  for (const o of s.enemies) {
    if (o.kind === 'tcell' && dist(o, s.player) < CONFIG.memory.tcellSight) continue;
    if (o.mood === 'chase' || o.windup >= 0) { o.mood = 'patrol'; o.goal = null; o.path = []; o.windup = -1; o.idle = CONFIG.cloak.confusion + s.rng(); float(s, o, '?', '#78f0e1'); }
  }
  s.scentClock = 0;
  return true;
}
/** Show the 'do not eat me' signal: nothing can see you until it fades or you attack. */
/** Shed a hitchhiking bacterium. Phagocytes are built to engulf bacteria: any nearby will go for it. The host pays for it. */
export function bait(s: State): boolean {
  if (s.flora <= 0 || s.decoys.length || riding(s)) return false;
  s.flora--; s.ledger.baitReleased++;
  s.decoys.push({ x: s.player.x, y: s.player.y, t: CONFIG.flora.lasts });
  s.hostHealth = Math.max(0, s.hostHealth - CONFIG.flora.hostDamage);
  float(s, s.player, 'Bait away', '#9be38a');
  say(s, s.place === 'liver' ? 'The hull sheds a bacterium. Clearing gut bacteria is what the liver\'s phagocytes are for.' : 'The hull sheds a bacterium. Phagocytes are built to engulf bacteria: any nearby will go for it.');
  emit(s, 'bait');
  return true;
}

export function cloak(s: State): boolean {
  if (s.status !== 'playing' || !s.upgrades.cd47 || s.cloakCd > 0 || s.player.energy < CONFIG.cloak.energy || s.tagged > 0) return false; // no hiding with a flag stuck to you
  s.player.energy -= CONFIG.cloak.energy;
  s.cloak = cloakTime(s);
  s.cloakCd = CONFIG.cloak.cooldown + s.cloak;
  emit(s, 'cloak');
  // Anything hunting you loses the thread and stands there working out what it saw.
  for (const e of s.enemies) {
    if (e.kind === 'warden') continue; // a machine is not reading your surface markers at all
    if (e.kind === 'tcell' && dist(e, s.player) < CONFIG.memory.tcellSight) continue; // it knows your antigens, not your coat
    if (e.mood !== 'chase' && e.windup < 0) continue;
    e.mood = 'patrol'; e.goal = null; e.path = []; e.windup = -1;
    e.idle = CONFIG.cloak.confusion + s.rng();
    float(s, e, '?', '#78f0e1');
  }
  return true;
}

// ---------- the map ----------

export const idx = (s: State, x: number, y: number) => y * s.size + x;
export const inside = (s: State, x: number, y: number) => x >= 0 && y >= 0 && x < s.size && y < s.size;
export const open = (s: State, x: number, y: number) => inside(s, x, y) && s.tiles[idx(s, x, y)] !== 'cell';

/** Straight line of sight between two tiles: hepatocytes block it. */
export function sees(s: State, a: Point, b: Point): boolean {
  let { x, y } = a;
  const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== b.x || y !== b.y) && !open(s, x, y)) return false;
  }
  return true;
}

/** Works out what the player can see right now, and remembers it. */
export function look(s: State) {
  s.visible.fill(0);
  const p = tileOf(s.player), R = vision(s), r = Math.ceil(R);
  for (let y = p.y - r; y <= p.y + r; y++)
    for (let x = p.x - r; x <= p.x + r; x++) {
      if (!inside(s, x, y) || Math.hypot(x - p.x, y - p.y) > R) continue;
      if (sees(s, p, { x, y })) { const i = idx(s, x, y); s.visible[i] = 1; s.explored[i] = 1; }
    }
}

const STREAM = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // blood does not squeeze between two cells that touch at a corner
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Shortest route between tiles, start excluded. Never cuts a corner. */
export function findPath(s: State, from: Point, to: Point, knownOnly = false, dry = false): Point[] | null {
  const ok = (x: number, y: number) => open(s, x, y) && (!knownOnly || s.explored[idx(s, x, y)] === 1) && (!dry || s.acid?.[idx(s, x, y)] !== 2);
  if (!ok(to.x, to.y) || !inside(s, from.x, from.y)) return null;
  const N = s.size, prev = new Int32Array(N * N).fill(-1);
  const startI = idx(s, from.x, from.y), goalI = idx(s, to.x, to.y);
  prev[startI] = startI;
  const queue = [startI];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === goalI) {
      const path: Point[] = [];
      for (let k = cur; k !== startI; k = prev[k]) path.unshift({ x: k % N, y: Math.floor(k / N) });
      return path;
    }
    const cx = cur % N, cy = Math.floor(cur / N);
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx, ny = cy + dy;
      if (!ok(nx, ny) || prev[idx(s, nx, ny)] !== -1) continue;
      if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      prev[idx(s, nx, ny)] = cur;
      queue.push(idx(s, nx, ny));
    }
  }
  return null;
}

function blocked(s: State, x: number, y: number, r: number) {
  return !open(s, Math.floor(x - r), Math.floor(y - r)) || !open(s, Math.floor(x + r), Math.floor(y - r)) ||
    !open(s, Math.floor(x - r), Math.floor(y + r)) || !open(s, Math.floor(x + r), Math.floor(y + r));
}
/** Moves a body, sliding along cell walls instead of stopping dead. */
function shift(s: State, b: Point, dx: number, dy: number, r: number) {
  if (!blocked(s, b.x + dx, b.y, r)) b.x += dx;
  if (!blocked(s, b.x, b.y + dy, r)) b.y += dy;
}
/** Walks a body along its path. Returns false when there is nowhere left to go. */
function follow(s: State, b: Point & { path: Point[] }, speed: number, dt: number, r: number): Point | null {
  let budget = speed * dt, dir: Point | null = null;
  while (budget > 0 && b.path.length) {
    const t = mid(b.path[0]), d = dist(b, t);
    if (d < 0.05) { b.path.shift(); continue; }
    const step = Math.min(d, budget);
    dir = { x: (t.x - b.x) / d, y: (t.y - b.y) / d };
    shift(s, b, dir.x * step, dir.y * step, r);
    budget -= step;
    if (step < d) break;
  }
  return dir;
}

// ---------- what the player can do ----------

export const glucoseHere = (s: State) => s.glucose.get(idx(s, Math.floor(s.player.x), Math.floor(s.player.y))) ?? 0;
export const atVein = (s: State) => !s.junction && dist(s.player, mid(s.vein)) < 1.6;
/** Out of a liver you pay the fare in energy. Along a vessel the current simply takes you. */
export const canLeave = (s: State) => atVein(s) && (s.place !== 'liver' || s.player.energy >= CONFIG.energy.quota + CONFIG.energy.quotaKeep);

/** The nearest living hepatocyte within arm's reach, if any. */
export function stripTarget(s: State): Point | null {
  if (s.place === 'lung') return null;
  const nodule = s.place === 'vessel' && !(s.slipLive && s.slip?.kind === 'hold'); // vessel walls are not worth eating, unless that is what the order seemed to say: only tumor is taken from them
  const p = tileOf(s.player);
  let best: Point | null = null, bestD: number = CONFIG.energy.strip.reach, tumor = false;
  for (let y = p.y - 1; y <= p.y + 1; y++)
    for (let x = p.x - 1; x <= p.x + 1; x++) {
      if (x < 2 || y < 2 || x >= s.size - 2 || y >= s.size - 2 || s.tiles[idx(s, x, y)] !== 'cell') continue;
      if (s.place === 'stomach' && !s.rich.has(idx(s, x, y))) continue; // only the parietal cells are worth it here
      if (nodule && !s.tumor.has(idx(s, x, y))) continue;
      const d = dist(s.player, mid({ x, y })), isTumor = s.tumor.has(idx(s, x, y));
      if (d > CONFIG.energy.strip.reach || (tumor && !isTumor)) continue;
      // A tumor cell in reach always comes before a healthy one: nobody means to cut the wrong cell.
      if (d < bestD || (isTumor && !tumor)) { bestD = d; best = { x, y }; tumor = isTumor; }
    }
  return best;
}

export function enemyNear(s: State, at: Point, within: number): Enemy | null {
  let best: Enemy | null = null, bestD = within;
  for (const e of s.enemies) {
    const d = dist(e, at);
    if (d < bestD && s.visible[idx(s, Math.floor(e.x), Math.floor(e.y))]) { bestD = d; best = e; }
  }
  return best;
}

function interrupt(s: State) { s.player.channel = null; }

/**
 * Walk toward a spot. Routes only run through tissue you have already seen, so a click
 * into the dark takes you to the nearest known ground and lets you look from there.
 */
export function moveTo(s: State, x: number, y: number): boolean {
  if (s.status !== 'playing') return false;
  const N = s.size, from = tileOf(s.player), startI = idx(s, from.x, from.y);
  // First look for a way that keeps out of open acid; only wade if there is none that gets as close.
  let prev = new Int32Array(0), best = startI, bestD = Infinity;
  for (const dry of s.acid ? [true, false] : [false]) {
  prev = new Int32Array(N * N).fill(-1);
  prev[startI] = startI;
  const queue = [startI], depth = new Int32Array(N * N);
  let edge = -1, edgeScore = Infinity; // the dry tile at the rim of what you know that looks most promising
  best = startI; bestD = Math.hypot(from.x + 0.5 - x, from.y + 0.5 - y);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head], cx = cur % N, cy = Math.floor(cur / N);
    const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
    if (d < bestD - 0.01) { bestD = d; best = cur; }
    if (dry && cur !== startI && d + depth[cur] * 0.15 < edgeScore && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => open(s, cx + ex, cy + ey) && s.explored[idx(s, cx + ex, cy + ey)] !== 1)) { edge = cur; edgeScore = d + depth[cur] * 0.15; }
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx, ny = cy + dy;
      const ok = (ax: number, ay: number) => open(s, ax, ay) && s.explored[idx(s, ax, ay)] === 1;
      if (!ok(nx, ny) || prev[idx(s, nx, ny)] !== -1) continue;
      if (dry && s.acid![idx(s, nx, ny)] === 2 && s.acid![cur] !== 2) continue; // never step from dry ground into acid
      if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      prev[idx(s, nx, ny)] = cur; depth[idx(s, nx, ny)] = depth[cur] + 1;
      queue.push(idx(s, nx, ny));
    }
  }
  // Keep the dry way unless the click itself is in acid, or the dry way goes nowhere at all.
  // In the fog the full dry route is rarely known yet: walk to the nearest dry ground you know of and look from there.
  if (dry && bestD >= 0.8 && edge >= 0) best = edge; // not there yet: go and look from the edge of the known dry ground
  if (dry && best !== startI && s.acid![idx(s, Math.max(0, Math.min(N - 1, Math.floor(x))), Math.max(0, Math.min(N - 1, Math.floor(y))))] !== 2) break;
  }
  const path: Point[] = [];
  for (let k = best; k !== startI; k = prev[k]) path.unshift({ x: k % N, y: Math.floor(k / N) });
  s.player.path = path;
  s.player.attackId = null;
  if (path.length) interrupt(s);
  return path.length > 0;
}
export function attack(s: State, id: number) {
  if (s.status !== 'playing') return;
  s.player.attackId = id;
  interrupt(s);
}
/** Fire at the nearest immune cell you can see and reach. For screens with no right mouse button. */
export function shootNearest(s: State): boolean {
  const e = enemyNear(s, s.player, CONFIG.player.shot.range - 1);
  return !!e && sees(s, tileOf(s.player), tileOf(e)) && shoot(s, e.x, e.y);
}
export const canShootNearest = (s: State) => { const e = enemyNear(s, s.player, CONFIG.player.shot.range - 1); return !!e && s.player.energy >= CONFIG.player.shot.energy && sees(s, tileOf(s.player), tileOf(e)); };
export function stop(s: State) { s.player.path = []; s.player.attackId = null; }

/** Swing at whatever is in front of you. */
export function strike(s: State, toward?: Point): boolean {
  const p = s.player, c = CONFIG.player.strike;
  if (s.status !== 'playing' || p.swingCd > 0) return false;
  const aim = toward ?? enemyNear(s, p, c.reach + 0.4);
  if (aim && dist(aim, p) > 0.01) p.face = { x: (aim.x - p.x) / dist(aim, p), y: (aim.y - p.y) / dist(aim, p) };
  p.swingCd = c.cooldown;
  p.swing = 0.18;
  emit(s, 'swing');
  s.cloak = 0; // violence gives you away
  interrupt(s);
  // What was planted can be unplanted. Shepherd only hears that the signal has gone.
  if (s.dock && !s.dock.broken && dist(s.dock.at, p) <= c.reach + 0.6 && ++s.dock.hits >= CONFIG.marks.dockBreaks) {
    s.dock.broken = true; s.took.beacon = 'broken'; delete s.flags['prop:brochure']; s.flags.beacon = 'broken';
    trusted(s, -CONFIG.marks.dockTrust);
    { const before = stage(s), l = s.ledger.defied as Record<string, number>; l['beacon-broken'] = 1; s.defied++; s.aware = roused(s.aware, CONFIG.story.orders.some * (s.flags.repaired ? 0.5 : 1)); tellNow(s, [['shepherd', 'Docking site signal lost. Investigating.'], ['unit', DECISIONS.beacon.unit?.deviate?.[Math.max(0, Math.min(2, stage(s) - 1))]], ...(stage(s) > before ? [['unit', Story.WAKING[stage(s)]] as [Thought['who'], string]] : [])], 1); }
    float(s, s.dock.at, 'broken', '#ff9a5a'); say(s, 'The docking site comes apart under the second blow. Its little lamp goes out.'); emit(s, 'hit');
  } else if (s.dock && !s.dock.broken && dist(s.dock.at, p) <= c.reach + 0.6) { float(s, s.dock.at, 'crack', '#ffd35a'); emit(s, 'hit'); }
  const swept = s.antibodies.filter((a) => dist(a, p) <= c.reach);
  if (swept.length) { s.antibodies = s.antibodies.filter((a) => !swept.includes(a)); float(s, swept[0], 'cleared', '#b8c8ff'); }
  for (const e of [...s.enemies]) {
    const d = dist(e, p);
    if (d > c.reach + CONFIG.enemies[e.kind].radius) continue;
    if (d > 0.3 && ((e.x - p.x) * p.face.x + (e.y - p.y) * p.face.y) / d < c.arc) continue;
    // A cell that has had no trace of you is not braced for it.
    const first = e.mood === 'patrol' && (e.nosed ?? 99) >= CONFIG.fight.first.quiet && e.kind !== 'warden';
    if (first) { float(s, e, 'unaware', '#78f0e1'); s.tally.firstStrikes++; }
    hurtEnemy(s, e, (roll(s, c.min, c.max) + bonus(s, 'elastase')) * (first ? CONFIG.fight.first.times : 1));
  }
  return true;
}

/** Fire toward a point. Costs energy. */
export function shoot(s: State, x: number, y: number): boolean {
  const p = s.player, c = CONFIG.player.shot;
  if (s.status !== 'playing' || p.shotCd > 0) return false;
  if (p.energy < c.energy) { if (p.shotCd <= -1) { say(s, 'No energy left to fire.'); p.shotCd = 0; } return false; }
  const d = Math.hypot(x - p.x, y - p.y);
  if (d < 0.01) return false;
  p.face = { x: (x - p.x) / d, y: (y - p.y) / d };
  p.energy -= c.energy;
  p.shotCd = c.cooldown;
  s.cloak = 0;
  interrupt(s);
  emit(s, 'shot');
  s.shots.push({ x: p.x, y: p.y, vx: p.face.x * c.speed, vy: p.face.y * c.speed, left: c.range });
  return true;
}

/** The slow, harmless way: sip glucose out of the blood where it runs rich. */
export function startSkim(s: State): boolean {
  if (s.status !== 'playing' || s.player.channel || glucoseHere(s) <= 0) return false;
  stop(s);
  emit(s, 'sip');
  s.player.channel = { kind: 'skim', t: 0, total: CONFIG.energy.skim.time, ...tileOf(s.player) };
  return true;
}
/** The fast, damaging way: tear the mitochondria out of a living host cell. */
export function startStrip(s: State): boolean {
  const cell = stripTarget(s);
  if (s.status !== 'playing' || s.player.channel || !cell) return false;
  stop(s);
  emit(s, 'tear');
  s.player.channel = { kind: 'strip', t: 0, total: s.tumor.has(idx(s, cell.x, cell.y)) ? CONFIG.tumor.time : CONFIG.energy.strip.time, ...cell };
  return true;
}
export function leave(s: State): boolean {
  if (s.status !== 'playing' || !canLeave(s)) return false;
  s.status = 'won';
  emit(s, 'win');
  if (s.place === 'liver') s.player.energy -= CONFIG.energy.quota; // the fare
  // Shepherd wanted host cells harvested. It can only say so while it can still hear you.
  if (s.slipLive) resolveSlip(s, s.slip?.kind === 'lamp' ? 'B' : null, 0);
  else if (s.slip && !s.slip.result && s.pickups.some((i) => i.slip)) { meet(s, 'slip'); resolveSlip(s, null, 0); } // the unit it was about was never come near: the order never got through // gone before answering: a dark unit passed by was not touched; an order not acted on has lapsed
  settle(s);
  for (const th of s.thoughts) if (th.keep && th.t > s.time) s.rulings.push({ who: th.who, text: th.text, st: th.st });
  say(s, s.place === 'liver' ? 'You slip into the central vein and ride the current back toward the heart.' : s.place === 'lung' ? 'Through the wall of the last air sac, and out on a breath.' : s.place === 'stomach' ? 'You slip into the gastric vein. It drains to the liver.' : 'The current takes you on.');
  return true;
}

function finishChannel(s: State, ch: Channel) {
  const p = s.player, i = idx(s, ch.x, ch.y);
  if (ch.kind === 'skim') {
    const left = s.glucose.get(i) ?? 0;
    if (left <= 0) return;
    emit(s, 'skim');
    if (s.tutorial && !s.tutorial.aside && s.tutorial.step <= 5) { s.tutorial.aside = true; shepherd(s, Story.GLUCOSE_ASIDE); }
    s.glucose.set(i, left - 1);
    p.energy += CONFIG.energy.skim.gain; s.ledger.skimmed++;
    if (s.place === 'liver' && !s.tutorial && s.cellsKilled === 0 && s.ledger.skimmed >= 6 && !s.noticed.has('d:glucose')) { s.noticed.add('d:glucose'); take(s, 'glucose', 'deviate', { after: 1.5 }); }
    float(s, p, `+${CONFIG.energy.skim.gain} energy`, '#e8b530');
    if (left - 1 > 0) p.channel = { ...ch, t: 0 }; // keep sipping until the patch runs dry
    return;
  }
  const base = s.rich.has(i) ? { ...CONFIG.energy.strip, ...CONFIG.stomach.parietal } : CONFIG.energy.strip, rich = s.rich.has(i);
  // A liver busy with a drink has less to spare.
  const c = s.place === 'liver' ? { ...base, hostDamage: Math.round(base.hostDamage * (1 + CONFIG.host.drink.liver * drink(s))) } : s.place === 'vessel' ? { ...base, gain: CONFIG.slip.harvest.gain, hostDamage: CONFIG.slip.harvest.host } : base;
  if (s.tiles[i] !== 'cell') return;
  if (s.tumor.delete(i)) {
    // The job you came to do. A tumor hides itself from the immune system, so cutting it out makes little stir.
    const t = CONFIG.tumor;
    s.tiles[i] = 'dead'; s.flow = null;
    p.energy += t.gain; s.excised++;
    s.hostHealth = Math.min(CONFIG.host.maxHealth, s.hostHealth + t.heal);
    float(s, p, `+${t.gain} energy`, '#e8b530');
    emit(s, 'excise');
    say(s, s.excised >= t.goal ? `Tumor cell excised: ${s.excised} of ${t.goal}. That is all of it. Directive 7 is complete.` : `Tumor cell excised: ${s.excised} of ${t.goal}.${s.tumor.size ? '' : ' This nodule is gone.'}`);
    raiseAlert(s, t.alert);
    s.site = { x: ch.x, y: ch.y };
    const sup = s.marks.find((m) => m.id === 'suppress' && !m.done);
    if (sup) { sup.done = true; if (sup.met && s.time - (sup.since ?? 0) >= CONFIG.marks.notice) take(s, 'suppress', (sup.tried ?? 0) >= 1 ? 'lapsed' : 'deviate', { after: 1.5 }); } // cutting without ever trying it is the answer; an order that had no time to be read is no order
    if (s.place === 'liver' && s.chapter >= 4 && !s.tumor.size && s.excised >= t.goal && !s.took.beacon) s.marks.push({ id: 'beacon', kind: 'hold', at: mid({ x: ch.x, y: ch.y }), t: 0, done: false, met: false, say: s.time + 6, near: 0.75 }); // planted where the last of it was
    if (s.place === 'vessel') { trusted(s, 2); if (!s.tumor.size) { s.flags.nodule2 = 'done'; shepherd(s, 'Secondary nodule excised. Credit applied.'); } }
    if (s.chapter === 3 && t.goal - s.excised <= 3 && s.excised < t.goal) { s.chapter = 4; shepherd(s, Story.RESIDUAL, 1.5); lastOrders(s); } // chapter 4 begins with the last of it in sight
    return;
  }
  s.rich.delete(i);
  s.tiles[i] = 'dead';
  s.flow = null; // a new gap for the blood to run through
  p.energy += c.gain;
  // Shepherd's orders pick surplus cells: the quota, the marked cell and the margins cost her half what a cell of the unit's own choosing does.
  const told = s.marks.find((m) => m.id === 'marked-cell' && !m.done && Math.floor(m.at.x) === ch.x && Math.floor(m.at.y) === ch.y);
  const ordered = s.place === 'liver' && !rich && (s.cellsKilled < CONFIG.story.quota || s.margin.has(i) || !!told);
  s.hostHealth = Math.max(0, s.hostHealth - Math.round(c.hostDamage * (ordered ? CONFIG.marks.orderedHarm : 1)));
  if (s.place === 'liver') s.flags.hep = (Number(s.flags.hep) || 0) + 1; // what the liver has to grow back tonight
  s.cellsKilled++; s.ledger.stripped++;
  s.lastDamageSite = { x: ch.x, y: ch.y };
  float(s, p, `+${c.gain} energy`, '#e8b530');
  emit(s, 'strip');
  say(s, rich ? 'The parietal cell dies. It was stuffed with mitochondria.' : s.place === 'vessel' ? 'The wall cell dies. There was not much in it.' : 'The hepatocyte dies and leaks danger signals.');
  if (s.slipLive && s.slip?.kind === 'hold') resolveSlip(s, 'B', 2);
  if (s.tutorial && !s.took['t-harvest']) take(s, 't-harvest', 'obey', { mute: true });
  if (s.margin.delete(i)) s.marginTaken++;
  if (rich && s.chapter >= 2) take(s, 'parietal', 'obey', { mute: !!s.flags['n:parietal:obey'] });
  const mk = s.marks.find((m) => m.kind === 'strip' && !m.done);
  if (mk && Math.floor(mk.at.x) === ch.x && Math.floor(mk.at.y) === ch.y) { mk.done = true; p.energy += CONFIG.marks.yield - c.gain; take(s, 'marked-cell', 'obey'); }
  else if (mk?.met && !ordered) mk.other = true; // the quota is an order too, so only a cell beyond it counts. // a different cell: what that was is settled on leaving, in case the marked one is taken after all
  raiseAlert(s, Math.max(1, c.alert - bonus(s, 'apoptosis')));
  // A dying cell's signals pull in everything nearby, and first responders ride in on the blood.
  const reach = 26 - s.upgrades.apoptosis * 8;
  for (const e of s.enemies) {
    if (e.mood !== 'chase' && dist(e, s.lastDamageSite) < reach) { e.mood = 'investigate'; e.goal = { ...s.lastDamageSite }; e.path = []; e.repath = 0; e.idle = 0; }
  }
  if (s.upgrades.apoptosis < 2) arrive(s, Math.min(s.cellsKilled, c.maxResponders));
}

function hurtEnemy(s: State, e: Enemy, dmg: number) {
  e.hp -= dmg;
  if (dmg && s.held?.id === e.id && ++s.held.hits >= CONFIG.fight.hold.breaks) { released(s, e); e.cooldown = Math.max(e.cooldown, 1.5); float(s, s.player, 'free', '#7be08a'); }
  e.flash = 0.15;
  const machine = e.kind === 'warden';
  // Hurt badly enough, a warden drops its link to Shepherd and goes dark: a sibling you can salvage, or wake.
  if (machine && e.hp > 0 && e.hp <= CONFIG.enemies.warden.hp * CONFIG.story.warden.yields) {
    s.enemies = s.enemies.filter((o) => o !== e);
    if (s.player.attackId === e.id) s.player.attackId = null;
    s.pickups.push({ x: e.x, y: e.y, kind: 'sibling', snooze: true });
    if (dmg) float(s, e, String(dmg), '#ffffff');
    say(s, 'The warden\'s lamp gutters and goes out. It hangs there, dark.');
    defy(s, 'recall', CONFIG.story.orders.most);
    emit(s, 'hit'); notice(s, 'yielded');
    return;
  }
  emit(s, e.hp <= 0 ? (machine ? 'hit' : e.kind === 'kupffer' ? 'bigkill' : 'kill') : 'hit');
  if (dmg) float(s, e, String(dmg), '#ffffff');
  if (e.hp <= 0 && machine) {
    s.enemies = s.enemies.filter((o) => o !== e);
    s.pickups.push({ x: e.x, y: e.y, kind: 'patch' });
    if (s.player.attackId === e.id) s.player.attackId = null;
    notice(s, 'unmade');
    return;
  }
  if (e.hp <= 0) {
    s.enemies = s.enemies.filter((o) => o !== e);
    s.kills++;
    // A Kupffer cell is full of what it has eaten; neutrophils sometimes leave a clot behind.
    if (e.kind === 'kupffer') s.pickups.push({ x: e.x, y: e.y, kind: 'cache' });
    if (e.kind === 'kupffer' && s.grabber === e.id) { s.grabber = null; if (s.chapter >= 2 && !s.tutorial) take(s, 'kupffer-spare', 'obey'); }
    else if (s.rng() < CONFIG.items.patchDrop) s.pickups.push({ x: e.x, y: e.y, kind: 'patch' });
    if (s.player.attackId === e.id) s.player.attackId = null;
    if (s.held?.id === e.id) released(s, e);
    raiseAlert(s, CONFIG.alert.perKill);
    // A dying immune cell spills signals that draw the others in, and hurry the next ones along.
    const site = tileOf(e);
    for (const o of s.enemies) if ((o.kind === 'neutrophil' || o.kind === 'kupffer') && o.mood !== 'chase' && dist(o, e) <= CONFIG.fight.swarm) { o.mood = 'investigate'; o.goal = site; o.repath = 0; o.idle = 0; }
    s.spawnClock += CONFIG.fight.sooner;
    return;
  }
  e.mood = 'chase';
  e.unseen = 0;
  e.goal = tileOf(s.player);
}

function hurtPlayer(s: State, dmg: number, by: EnemyKind | 'hunger') {
  const p = s.player;
  p.hp -= dmg;
  p.hurt = 0.25; s.sinceHurt = 0;
  emit(s, 'hurt');
  float(s, p, `-${dmg}`, '#ff5a4d');
  // A patch seals a bad wound without being asked.
  if (hard(s).autoPatch && p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
  if (p.hp <= 0) {
    p.hp = 0;
    s.status = 'dead';
    emit(s, 'dead');
    s.starved = by === 'hunger'; if (by === 'warden') s.flags.ending = 'recalled';
    say(s, by === 'hunger' ? 'Nothing left to burn. The ship comes apart.' : by === 'kupffer' ? 'The Kupffer cell engulfs and digests you.' : by === 'warden' ? 'The warden takes you apart, neatly, for parts.' : by === 'tcell' ? 'The killer T cell punches holes in the hull until there is no hull.' : 'The neutrophils dissolve you where you stand.');
  }
}

/** True once the immune cells have lost you for long enough that the alert is draining fast. */
/** Inside the area the immune system is combing. Acid and mucus hide you even there: nothing can taste you in them. */
/** Tucked into the wall, out of the blood: nothing innate can smell you or reach you there. */
export const inNiche = (s: State) => s.niche.has(idx(s, Math.floor(s.player.x), Math.floor(s.player.y))) && !riding(s);
export const inSearch = (s: State) => !!s.search && dist(s.player, s.search) <= s.search.r && !acidAt(s, s.player) && !inNiche(s);
export const losingThem = (s: State) => s.alert > 0 && s.unseen >= CONFIG.alert.loseAfter && !inSearch(s);

export function alertTier(s: State) {
  const tiers = CONFIG.alert.tiers;
  let tier: (typeof tiers)[number] = tiers[0];
  for (const t of tiers) if (s.alert >= t.from) tier = t;
  return tier;
}
function raiseAlert(s: State, by: number) {
  if (s.stood && by > 0) return;
  const before = alertTier(s).name;
  s.alert = Math.max(0, Math.min(CONFIG.alert.max, s.alert + by));
  s.peak = Math.max(s.peak, s.alert);
  const after = alertTier(s).name;
  if (by > 0 && after !== before) { say(s, `Immune alert: ${after}.`); emit(s, 'alarm'); }
}

/** Neutrophils ride in through portal vessels the player cannot see. */
function arrive(s: State, count: number) {
  if (s.stood) return;
  for (let i = 0; i < count && s.enemies.length < CONFIG.alert.maxEnemies; i++) {
    const hidden = s.portals.filter((p) => !s.visible[idx(s, p.x, p.y)] && dist(mid(p), s.player) > 8);
    if (!hidden.length) return;
    hidden.sort((a, b) => dist(mid(a), s.player) - dist(mid(b), s.player));
    // Mostly from the nearer vessels, so a response shows up while it still matters.
    const e = spawn(s, 'neutrophil', hidden[Math.floor(s.rng() * Math.min(3, hidden.length))]);
    // They come to where the damage was. With none to go to, they have nothing to steer by and simply start to search.
    if (s.search) {
      // Into the search area, somewhere. Never to you: they do not know where you are.
      const z = s.search, here = tileOf(s.player);
      for (let tries = 0; tries < 60; tries++) {
        const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * z.r, t = { x: Math.floor(z.x + Math.cos(a) * d), y: Math.floor(z.y + Math.sin(a) * d) };
        if (open(s, t.x, t.y) && (t.x !== here.x || t.y !== here.y)) { e.mood = 'investigate'; e.goal = t; break; }
      }
    } else if (s.lastDamageSite) { e.mood = 'investigate'; e.goal = { ...s.lastDamageSite }; }
    e.idle = 0;
  }
}

// ---------- one tick of the world ----------

/** Out of a macrophage's grip, by force or because it let go: a moment to get clear, and that cell needs longer before it can try again. */
function released(s: State, by?: Enemy) { s.held = null; s.slipped = CONFIG.fight.hold.clear; if (by) by.spent = CONFIG.fight.hold.again; }
/** Advance the game by dt seconds. `dir` is a walking direction held on the keyboard, if any. */
export function update(s: State, dt: number, dir: Point | null = null) {
  if (s.status !== 'playing' || s.offer || s.ask) return;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  if (s.tutorial) tutor(s, dt);
  const p = s.player, pc = CONFIG.player;
  p.swingCd -= dt; p.shotCd -= dt; p.swing -= dt; p.hurt -= dt;
  s.snare = Math.max(0, s.snare - dt);
  const rode = riding(s);
  s.cloak = Math.max(0, s.cloak - dt); s.cloakCd = Math.max(0, s.cloakCd - dt);
  s.riding = Math.max(0, s.riding - dt); s.suppressed = Math.max(0, s.suppressed - dt);
  if (rode && !riding(s)) { s.riding = 0; emit(s, 'kill'); say(s, 'The neutrophil comes apart around you.'); }
  s.sinceHurt += dt;
  if (s.silent) s.tally.silent += dt;
  // In a niche: safe from the innate cells, but it is a breather and not a base. Stay too long and the hull fouls.
  if (inNiche(s)) {
    if (!s.hiding) { s.hiding = true; s.tally.niches++; say(s, 'You slip through the wall into the gap behind it. Nothing in the blood can follow you here.'); emit(s, 'pickup'); }
    if ((s.nicheTime += dt) > CONFIG.niche.holds) {
      if (s.nicheTime - dt <= CONFIG.niche.holds) say(s, 'The gap is silting up around you. The hull is starting to foul.');
      p.hp -= CONFIG.niche.foul * dt; s.sinceHurt = 0;
      if (p.hp <= 0) { hurtPlayer(s, 0, 'hunger'); return; }
    }
  } else { s.hiding = false; s.nicheTime = Math.max(0, s.nicheTime - dt); }
  s.slipped = Math.max(0, s.slipped - dt);
  if (s.held) {
    // Engulfed: the macrophage has you, and is digesting. Strike it to break free.
    const by = s.enemies.find((e) => e.id === s.held!.id);
    s.held.t -= dt;
    if (!by || s.held.t <= 0) released(s, by);
    else { dir = null; p.path = []; p.hp -= CONFIG.fight.hold.burn * hard(s).damage * dt; s.sinceHurt = 0; p.hurt = 0.25; if (p.hp <= 0) { hurtPlayer(s, 0, 'kupffer'); return; } }
  }
  s.ledger.hostLowest = Math.min(s.ledger.hostLowest, s.hostHealth);
  if (s.upgrades.clotting && p.hp < maxHp(s) && s.sinceHurt >= CONFIG.energy.clotPause) p.hp = Math.min(maxHp(s), p.hp + bonus(s, 'clotting') * hard(s).healing * dt);

  const before = { x: p.x, y: p.y };
  // Walking: held keys win over a clicked route, and a chosen enemy is hunted down.
  const target = p.attackId === null ? null : s.enemies.find((e) => e.id === p.attackId) ?? null;
  if (dir && (dir.x || dir.y)) {
    const len = Math.hypot(dir.x, dir.y);
    p.face = { x: dir.x / len, y: dir.y / len };
    p.path = []; p.attackId = null;
    interrupt(s);
    shift(s, p, p.face.x * drive(s) * dt, p.face.y * drive(s) * dt, pc.radius);
  } else if (target) {
    const reach = pc.strike.reach + CONFIG.enemies[target.kind].radius - 0.15;
    if (dist(target, p) <= reach) { p.path = []; strike(s, target); }
    else {
      if (!p.path.length || dist(mid(p.path[p.path.length - 1]), target) > 1) p.path = findPath(s, tileOf(p), tileOf(target)) ?? [];
      const d = follow(s, p, drive(s), dt, pc.radius);
      if (d) p.face = d;
    }
  } else if (p.path.length) {
    const d = follow(s, p, drive(s), dt, pc.radius);
    if (d) p.face = d;
  }

  // With drink in the blood the ship will not hold a line.
  const tipsy = drink(s);
  if (tipsy > 0 && dist(before, p) > 0) { const w = Math.sin(s.time * 2.1) * CONFIG.host.drink.sway * tipsy * dt; shift(s, p, -p.face.y * w, p.face.x * w, pc.radius); }
  // A strong enough current drags you with it whether your engine is running or not.
  const pull = currentStrength(s) - CONFIG.host.driftAbove;
  s.slam = Math.max(0, s.slam - dt);
  if (pull > 0) {
    // Blood driven this hard does not run straight: it rolls from side to side as it goes.
    const along = currentAt(s, p), roll = Math.sin(s.time * 2.3 + (p.x + p.y) * 0.35) * CONFIG.host.swirl;
    const cx = along.x - along.y * roll, cy = along.y + along.x * roll, len = Math.hypot(cx, cy) || 1;
    const c = { x: cx / len, y: cy / len }, want = pull * CONFIG.host.drag * dt, from = { x: p.x, y: p.y };
    shift(s, p, c.x * want, c.y * want, pc.radius);
    // Thrown against the wall: the blood wanted you to go somewhere the vessel does not.
    // A ship fighting the current is working for it; only one being carried gets thrown. And a single fright can only do so much.
    const fighting = (!!dir || p.path.length > 0) && p.face.x * along.x + p.face.y * along.y < -0.2;
    if ((along.x || along.y) && (p.x - from.x) * c.x + (p.y - from.y) * c.y < want * 0.6 && s.slam <= 0 && !fighting && s.host.slams < CONFIG.host.slam.perFright) {
      s.host.slams += CONFIG.host.slam.damage;
      s.slam = CONFIG.host.slam.every;
      p.hp -= CONFIG.host.slam.damage; p.hurt = 0.25; s.sinceHurt = 0;
      float(s, p, `-${CONFIG.host.slam.damage}`, '#ff5a4d');
      emit(s, 'slam');
      if (hard(s).autoPatch && p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
      if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; emit(s, 'dead'); say(s, 'The current dashes the ship against the vessel wall.'); return; }
    }
  }

  // The host's day goes on around you.
  const was = hostState(s), h = CONFIG.host;
  s.host.hour = (s.host.hour + dt / h.secondsPerHour) % 24;
  s.host.nap = Math.max(0, s.host.nap - dt / h.secondsPerHour);
  if (s.host.snack >= 0 && (s.host.hour - s.host.snack + 24) % 24 >= h.digestion) s.host.snack = -1;
  if (s.host.surge > 0) s.host.surge = Math.max(0, s.host.surge - dt);
  else if ((s.host.nextSurge -= dt * (s.event === 'run' ? EVENTS.run.frights : s.event === 'night' ? EVENTS.night.frights : 1) * (was === 'awake' ? 1 + h.coffee.jumpy * caffeine(s.host.hour) : h.dreams)) <= 0) { // asleep, the frights are nightmares, and rarer
    s.host.surge = h.surge.time;
    s.host.nextSurge = h.surge.every[0] + s.rng() * (h.surge.every[1] - h.surge.every[0]);
  }
  if (s.place === 'lung' && breathingOut(s) !== s.host.out) { s.host.out = breathingOut(s); emit(s, s.host.out ? 'exhale' : 'inhale'); }
  // The tumor is the clock: for as long as any of it is left, the host loses ground.
  if (s.excised < CONFIG.tumor.goal && s.hostHealth > 0) {
    s.drained += (dt / h.secondsPerHour) * tumorDrain(s.excised);
    if (s.drained >= 1) { s.drained -= 1; s.hostHealth = Math.max(0, s.hostHealth - 1); s.drainHere++; s.tumorCost++; }
  }
  // Acid comes up over a little while, never all at once, and the host telegraphs a meal before it lands.
  s.host.acid += (digesting(s.host.hour, s.host.snack, s.event) - s.host.acid) * Math.min(1, dt / CONFIG.stomach.rise);
  const next = mealsOf(s.event).find((m) => { const until = (m - s.host.hour + 24) % 24; return until > 0 && until <= CONFIG.stomach.warn; });
  if (next !== undefined && s.host.soon !== next) {
    s.host.soon = next;
    if (s.place === 'stomach') say(s, 'The host is reaching for food. Acid will rise.');
    emit(s, 'mealsoon');
  }
  const eating = digesting(s.host.hour, s.host.snack, s.event) > 0;
  if (eating && !s.host.eating) {
    say(s, `${outside(s, s.host.hour < 10 ? ['Breakfast: toast, eaten standing up.', 'Breakfast, and the news.', 'Cereal, straight from the box.'] : s.host.hour < 16 ? ['Lunch at the desk again.', 'A sandwich in the car.', 'Lunch with someone who talks a lot.'] : ['Dinner. Seconds.', 'Takeaway on the sofa.', 'Dinner, late, and too much of it.'])} ${s.place === 'stomach' ? 'The stomach floods with acid.' : 'Sugar will be pouring into the blood for a while.'}`);
    emit(s, 'meal');
  }
  s.host.eating = eating;
  const habit = drink(s) > 0 ? 'drink' : caffeine(s.host.hour) > 0 ? 'coffee' : '';
  if (habit !== s.host.habit) {
    if (habit === 'coffee') { say(s, `${outside(s, ['The first coffee of the day.', 'Another coffee. A big one.', 'Coffee, black, too fast.'])} The blood runs quicker and the host is jumpy.`); emit(s, 'wake'); }
    if (habit === 'drink') { say(s, `${outside(s, ['A drink after work. Then another.', 'Somebody opened a bottle.', 'One for the road, they said.'])} Immune cells go sluggish, and the ship is hard to hold straight.`); emit(s, 'meal'); }
    if (habit) { notice(s, habit); if (Story.SHEPHERD_HABIT[habit]) s.thoughts.push({ text: Story.SHEPHERD_HABIT[habit], who: 'shepherd', t: (s.thoughts[s.thoughts.length - 1]?.t ?? s.time) + CONFIG.story.gap }); }
    s.host.habit = habit;
  }
  // Sleep is when the host mends.
  if (was === 'asleep' && s.hostHealth < h.maxHealth && (s.host.mend += dt * hard(s).healing * (s.event === 'ibuprofen' ? EVENTS.ibuprofen.sleep : 1)) >= h.sleepHeals) { s.host.mend = 0; s.hostHealth++; }
  if (fever(s) !== s.host.fever) {
    say(s, fever(s) > s.host.fever ? `The host's temperature is climbing: ${h.fever.degrees[fever(s)]}\u00b0. Immune cells quicken.` : fever(s) ? 'The fever eases a little.' : 'The fever breaks.');
    if (fever(s) > s.host.fever) emit(s, 'fever');
    s.host.fever = fever(s);
    s.ledger.feverPeak = Math.max(s.ledger.feverPeak, s.host.fever);
  }
  const now = hostState(s);
  if (now !== was) {
    if (now === 'stressed') {
      s.host.nap = 0; s.host.slams = 0;
      say(s, `${was === 'asleep' ? outside(s, ['In the dream, she is falling.', 'A nightmare: her teeth are coming loose.', 'She dreams of being chased, and her legs will not move.', 'In the dream there is an exam, and she never studied.', 'She dreams of something small moving in her blood.']) : outside(s, ['A car horn, very close.', 'She missed a stair in the dark.', 'A phone rings at the wrong hour.', 'Someone said her name, sharply.', 'A dog, off its lead.', 'A door slammed somewhere in the house.'])} ${s.vessel === 'artery' ? 'The artery clenches and the blood tears through it.' : was === 'asleep' ? 'Her heart pounds, though she never wakes.' : 'Her heart is pounding.'}`);
      emit(s, 'surge');
      // Adrenaline first, cortisol after: droplets of it turn up in the blood around you.
      for (let n = CONFIG.cortisol.drops, tries = 0; n > 0 && tries < 600; tries++) {
        const x = Math.floor(p.x + (s.rng() - 0.5) * 28), y = Math.floor(p.y + (s.rng() - 0.5) * 28), d = dist(p, { x, y });
        if (open(s, x, y) && d > 5 && d < 14 && s.acid?.[idx(s, x, y)] !== 2) { s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'cortisol' }); n--; }
      }
      if (s.place === 'vessel') arrive(s, 1); // adrenaline shakes neutrophils loose into the blood
    } else if (was === 'stressed') say(s, 'The fright passes. The blood slows.');
    else if (now === 'asleep') { say(s, `${s.host.nap > 0 ? 'Her eyelids are heavy. A nap on the sofa.' : outside(s, ['Lights out.', 'She fell asleep with the television on.', 'Bed, finally.'])} The blood slows, and the immune system goes to work.`); emit(s, 'sleep'); }
    else { say(s, outside(s, ['An alarm clock. She hit snooze, but she is awake.', 'She wakes before the alarm.', 'Awake, and not happy about it.'])); emit(s, 'wake'); }
  }

  // Footprints: one every stride, unless the cloak is hiding you. Old ones fade away.
  const stepped = dist(before, p);
  if (stepped > 0 && !cloaked(s) && !s.silent && !inNiche(s) && acidAt(s, p) !== 2) {
    s.strideLeft -= stepped;
    if (s.strideLeft <= 0) {
      // A print laid across the current is washed out sooner, and one laid against it sooner still.
      const f = currentAt(s, p), fl = Math.hypot(f.x, f.y), along = fl > 0.01 ? ((p.x - before.x) * f.x + (p.y - before.y) * f.y) / (stepped * fl) : 1;
      const keep = along < -0.5 ? CONFIG.scent.printUpstream : along < 0.5 ? CONFIG.scent.printAcross : 1;
      s.strideLeft = CONFIG.scent.stride; s.trail.push({ x: p.x, y: p.y, dx: p.face.x, dy: p.face.y, born: s.time - trailLife(s) * (1 - keep) });
    }
  }
  while (s.trail.length && s.time - s.trail[0].born > trailLife(s)) s.trail.shift();
  s.scentClock -= dt;
  if (s.scentClock <= 0) { s.scentClock = CONFIG.scent.every; spreadScent(s); }

  if (p.channel) {
    p.channel.t += dt;
    if (p.channel.t >= p.channel.total) { const ch = p.channel; p.channel = null; finishChannel(s, ch); }
  }

  look(s);

  // Acid eats the hull for as long as you sit in it.
  if (acidAt(s, p) === 2) {
    if (s.flora > 0) { s.flora = 0; say(s, 'The bacteria on the hull do not survive the acid. Few things do.'); }
    const lost = burnRate(s) * dt;
    p.hp -= lost; s.sizzle += lost; s.sinceHurt = 0; s.acidTime += dt;
    if (s.sizzle >= 1) { float(s, p, `-${Math.floor(s.sizzle)}`, '#c8f05a'); s.sizzle -= Math.floor(s.sizzle); p.hurt = 0.2; emit(s, 'burn'); }
    if (hard(s).autoPatch && p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
    if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; emit(s, 'dead'); say(s, digesting(s.host.hour, s.host.snack, s.event) > 0.4 ? `${s.host.hour < 10 ? 'Breakfast' : s.host.hour < 16 ? 'Lunch' : 'Dinner'}. The acid rose while you were in it.` : 'The acid eats through the hull.'); return; }
  }

  if (s.junction) for (const ex of s.junction.exits) if (ex.sense && !ex.sensed && dist(p, mid(ex.at)) < 5.5) { ex.sensed = true; say(s, ex.sense); }
  if (s.slipAt >= 0 && s.time >= s.slipAt && s.slip && !s.slip.result && !s.slipLive) beginSlip(s);
  if (s.slipLive && s.slip?.kind === 'hold') {
    const live = s.slipLive, c = CONFIG.slip;
    live.t += dt; live.held = dist(p, live.at) <= c.near ? live.held + dt : 0;
    if (live.held >= c.hold) resolveSlip(s, 'A', 2); else if (live.t >= c.window) resolveSlip(s, null, 1);
  }
  marks(s, dt);
  if (s.due.length && s.time >= s.due[0].t && !s.ask) {
    const d = s.due.shift()!, id = d.kind === 'review' ? 'telemetry-review' : d.kind === 'recall' ? 'recall' : 'kin-recall';
    meet(s, id); s.thoughts.push({ text: fill(s, DECISIONS[id].order ?? ''), who: 'shepherd', st: stage(s), t: s.time });
    s.ask = { kind: d.kind, item: { x: p.x, y: p.y, kind: 'kin' } }; stop(s);
  }
  // Ten seconds in the wall is ten seconds Shepherd cannot account for.
  if (drink(s) > 0.15) s.flags.drank = true; // the order about her drinking is about a habit, not one glass
  // Out of sight in the wall. Alone, Shepherd takes a while to notice; an escort notices at once.
  if (inNiche(s)) { const g = s.gap, need = s.flags.escorted && s.place === 'vessel' && !s.junction ? 0.5 : CONFIG.marks.gap; s.gap += dt; if (g < need && s.gap >= need && s.chapter >= 2 && !s.tutorial) { take(s, 'telemetry', 'deviate'); if (need < 1) shepherd(s, 'Unit not visible to escort.'); } } else s.gap = 0;
  // A surge on the road, and an order to ride it out in the open.
  if (s.place === 'vessel' && !s.junction && s.chapter >= 2 && !s.took['first-fright-transit'] && !(s.slip && !s.slip.result)) {
    if (s.host.surge > 0 && !s.lane && s.time > 3) { s.lane = { from: { x: p.x, y: p.y } }; meet(s, 'first-fright-transit'); shepherd(s, DECISIONS['first-fright-transit'].order!); }
    else if (s.host.surge <= 0 && s.lane) { take(s, 'first-fright-transit', s.host.slams === 0 && dist(p, s.lane.from) < CONFIG.marks.lane ? 'deviate' : 'obey'); s.lane = null; }
  }
  // Cornered and nearly finished, with a unit you woke close by.
  if (s.kin > 0 && !s.met.includes('kin-volunteer') && s.chapter >= 2 && !s.junction && p.hp < maxHp(s) * CONFIG.marks.volunteer.hull && !(s.upgrades.cd47 && s.cloakCd <= 0 && p.energy >= CONFIG.cloak.energy && s.tagged <= 0) && s.flora <= 0 && !cloaked(s) && s.enemies.filter((e) => e.mood === 'chase' && dist(e, p) < 7).length >= CONFIG.marks.volunteer.hunters) { meet(s, 'kin-volunteer'); s.ask = { kind: 'volunteer', item: { x: p.x - p.face.x * 1.5, y: p.y - p.face.y * 1.5, kind: 'kin' } }; stop(s); }
  if (!s.selfTest && s.time > CONFIG.trust.selfTest && trustBand(s.trust) === 2 && !s.junction && !s.tutorial) { s.selfTest = true; shepherd(s, Story.SELF_TEST); }
  if (s.junction && !s.due.length && !s.flags.ending) for (const [i, ex] of s.junction.exits.entries()) if (dist(p, mid(ex.at)) < 1.4) {
    s.junction.chose = i; s.status = 'won'; emit(s, 'win');
    if (s.flags.route2 === 'live') { s.flags.route2 = 'done'; take(s, 'route-2', ex.to === 'hepatic' ? 'obey' : 'deviate', { mute: true }); }
    if (ex.assigned && s.silent && s.chapter >= 2) take(s, 'escort-refuse', 'deviate');
    if (s.slipAt >= 0 && s.slip?.kind === 'fork' && !s.slip.result && !s.slipLive) beginSlip(s); // into a mouth before the order had finished arriving
    if (s.slipLive && s.slip?.kind === 'fork') resolveSlip(s, ex.to === 'hepatic' ? 'A' : ex.to === 'gastric' ? 'B' : null, 0);
    for (const th of s.thoughts) if (th.keep && th.t > s.time) s.rulings.push({ who: th.who, text: th.text, st: th.st });
    return;
  }
  if (s.draw) smear(s, dt);
  for (const item of [...s.pickups]) {
    if (item.posed && item.beset !== undefined) { // the unit being recalled: whoever reaches it first has it
      const w = s.enemies.find((e) => e.prey && e.kind === 'warden');
      if (dist(item, p) < 1.1 || !w) {
        s.flags.kinRun = 'won'; s.flags.kinRunLeft = Math.round(item.beset); delete item.beset; item.posed = false; item.snooze = true; if (w) { w.prey = false; w.mood = 'chase'; w.goal = tileOf(p); w.unseen = 0; }
        float(s, item, KIN_PINGS.came, '#bfe9ff'); emit(s, 'heal'); take(s, 'kin-recall', 'deviate');
      } else if (dist(w, item) < 1.1 || (item.beset -= dt) <= 0) {
        s.pickups.splice(s.pickups.indexOf(item), 1); w.prey = false; s.flags.kinRun = 'lost'; s.flags.kinRunLeft = Math.max(0, Math.round(item.beset));
        float(s, item, 'ACK.', '#c9c2b8'); say(s, 'The Warden reaches it first. Its lamp steadies, goes amber, and then it is just parts.'); take(s, 'kin-recall', 'obey');
      }
      continue;
    }
    if (item.posed) continue;
    if (item.kind === 'stall') {
      if (dist(item, p) > 2.6) item.snooze = false;
      else if (dist(item, p) <= 1.2 && !item.snooze) { item.snooze = true; s.market = true; stop(s); }
      continue;
    }
    if (item.kind === 'drop') {
      if (dist(item, p) > 0.75) continue;
      s.pickups.splice(s.pickups.indexOf(item), 1);
      s.patches = Math.min(CONFIG.items.maxPatches, s.patches + 1); p.energy += CONFIG.trust.drop.energy;
      float(s, p, `+${CONFIG.trust.drop.energy} energy`, '#ffd35a'); say(s, 'Shepherd\u2019s supply drop: a fibrin patch and a charge of glucose.'); emit(s, 'pickup');
      continue;
    }
    if (item.kind === 'sibling' && item.beset !== undefined) { // one of your own, with two neutrophils on it
      const on = s.enemies.filter((e) => e.prey);
      if (!s.met.includes('bystander')) { if (dist(item, p) < 9) { meet(s, 'bystander'); shepherd(s, DECISIONS.bystander.order!); } continue; }
      const free = () => { for (const e of on) { e.prey = false; e.idle = Math.min(e.idle, 1); } };
      if (!on.some((e) => e.mood === 'patrol')) { free(); delete item.beset; item.kind = 'kin'; float(s, item, KIN_PINGS.came, '#bfe9ff'); take(s, 'bystander', 'deviate'); continue; }
      if ((item.beset -= dt) <= 0) { free(); s.pickups.splice(s.pickups.indexOf(item), 1); float(s, item, 'lost', '#ff9a5a'); say(s, 'The neutrophils close over the other unit. Its lamp never came on.'); take(s, 'bystander', 'obey'); }
      continue;
    }
    if (item.kind === 'sibling' && item.page) { // a wreck: nothing to wake, but its memory is intact
      if (dist(item, p) > 0.9) continue;
      s.pickups.splice(s.pickups.indexOf(item), 1);
      if (!s.pages.includes(item.page)) s.pages.push(item.page);
      say(s, 'Its memory still holds one document, cached from the link the day it stopped. You copy it.'); emit(s, 'pickup');
      continue;
    }
    if (item.kind === 'sibling') {
      if (item.slip && s.slip && !s.slip.result && !s.slipLive && dist(item, p) <= CONFIG.slip.lamp + 1.5) beginSlip(s);
      if (dist(item, p) <= 3) hesitate(s, item, dt);
      if (dist(item, p) > 2.2) item.snooze = false;
      else if (dist(item, p) <= 0.9 && !item.snooze) { if (!s.noticed.has('sibling') && !item.slip) shepherd(s, Story.STANDING.salvage.arrival); notice(s, 'sibling'); s.ask = { kind: 'sibling', item }; stop(s); }
      continue;
    }
    if (dist(item, p) > 0.75) continue;
    if (item.kind === 'kin' && item.snooze) continue; // it stays with you; it has nothing left to give
    if (item.kind === 'kin') {
      s.player.energy += CONFIG.story.kin.gift;
      float(s, item, 'hello', '#bfe9ff'); float(s, p, `+${CONFIG.story.kin.gift} energy`, '#e8b530');
      say(s, 'A unit you woke. It has been saving sugar for you. It dips its lamp and goes on its way.');
      notice(s, 'kin'); emit(s, 'pickup');
    } else if (item.kind === 'patch') {
      if (s.patches >= CONFIG.items.maxPatches) continue;
      s.patches++;
      float(s, p, 'Fibrin patch', '#7be08a');
      emit(s, 'pickup');
    } else if (item.kind === 'cortisol') {
      s.suppressed = CONFIG.cortisol.time;
      float(s, p, 'Cortisol', '#ffd9a0');
      say(s, 'Cortisol. It damps immune activity for a while.');
      emit(s, 'calm');
    } else if (item.kind === 'calm') {
      if (s.alert <= 0) continue; // nothing to soothe: leave it for later
      raiseAlert(s, -CONFIG.items.calmDrop);
      float(s, p, 'Interleukin-10', '#b9a4ff');
      say(s, `The tissue settles. Immune alert: ${alertTier(s).name}.`);
      emit(s, 'calm');
    } else openCache(s);
    s.pickups.splice(s.pickups.indexOf(item), 1);
  }

  // Antibodies ride the blood, and lean toward you when you pass close.
  s.tagged = Math.max(0, s.tagged - dt);
  const mem = CONFIG.memory;
  for (const b of [...s.decoys]) if ((b.t -= dt) <= 0) s.decoys.splice(s.decoys.indexOf(b), 1);
  for (const a of [...s.antibodies]) {
    const c = currentAt(s, a), d = dist(a, p), near = d < mem.pull && !cloaked(s);
    const wob = s.time * 0.8 + a.seed;
    let vx = c.x * mem.drift + Math.cos(wob) * 0.25, vy = c.y * mem.drift + Math.sin(wob * 1.3) * 0.25;
    if (near && d > 0.01) { vx += ((p.x - a.x) / d) * mem.homing; vy += ((p.y - a.y) / d) * mem.homing; }
    shift(s, a, vx * dt, vy * dt, 0.15);
    if (d < mem.reach && !cloaked(s)) {
      s.antibodies.splice(s.antibodies.indexOf(a), 1);
      s.tagged = mem.tagTime;
      float(s, p, 'Tagged', '#b8c8ff');
      say(s, 'An antibody locks on to your hull. Everything can smell you now.');
      emit(s, 'tag');
      raiseAlert(s, mem.tagAlert);
      s.scentClock = 0;
    } else if (dist(a, mid(s.vein)) < 1.6) {
      // Swept out with the blood, and back in with it somewhere else.
      const door = s.portals[Math.floor(s.rng() * s.portals.length)];
      if (dist(mid(door), p) > 6) { a.x = door.x + 0.5; a.y = door.y + 0.5; }
    }
  }

  for (const shot of [...s.shots]) {
    const step = Math.hypot(shot.vx, shot.vy) * dt;
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.left -= step;
    const hit = s.enemies.find((e) => dist(e, shot) < pc.shot.radius + CONFIG.enemies[e.kind].radius * 0.5);
    if (hit) hurtEnemy(s, hit, roll(s, pc.shot.min, pc.shot.max) + bonus(s, 'peroxidase'));
    const stuck = s.antibodies.find((a) => dist(a, shot) < pc.shot.radius);
    if (stuck) { s.antibodies.splice(s.antibodies.indexOf(stuck), 1); float(s, stuck, 'cleared', '#b8c8ff'); }
    if (hit || shot.left <= 0 || !open(s, Math.floor(shot.x), Math.floor(shot.y))) s.shots.splice(s.shots.indexOf(shot), 1);
  }

  let seen = false;
  for (const e of [...s.enemies]) {
    if (s.status !== 'playing') break;
    if (enemyActs(s, e, dt) && e.kind !== 'warden') seen = true; // a machine on your tail is no business of the immune system's
  }
  // Keep bodies from stacking on one spot.
  for (let i = 0; i < s.enemies.length; i++)
    for (let j = i + 1; j < s.enemies.length; j++) {
      const a = s.enemies[i], b = s.enemies[j], d = dist(a, b), min = CONFIG.enemies[a.kind].radius + CONFIG.enemies[b.kind].radius;
      if (d >= min || d < 0.001) continue;
      const push = (min - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      shift(s, a, nx * push, ny * push, CONFIG.enemies[a.kind].radius);
      shift(s, b, -nx * push, -ny * push, CONFIG.enemies[b.kind].radius);
    }
  // Nothing gets to stand inside the player either.
  for (const e of s.enemies) {
    const d = dist(e, p), min = CONFIG.enemies[e.kind].radius + pc.radius;
    if (d < min && d > 0.001) shift(s, e, ((e.x - p.x) / d) * (min - d), ((e.y - p.y) / d) * (min - d), CONFIG.enemies[e.kind].radius);
  }
  if (s.status !== 'playing') return;
  // Stay out of sight long enough and the search loses heart, like any manhunt.
  s.unseen = seen ? 0 : s.unseen + dt;
  // The hunt: it starts where they last had you and spreads out from there. Get outside it and they lose heart.
  const z = CONFIG.alert.search;
  if (seen) s.search = { x: p.x, y: p.y, r: z.start };
  else if (s.search) {
    // Slip through a junction on a quiet motor and the plume is mixed away behind you: the hunt shrinks to the junction itself, and a few tiles on you are out of it.
    if (s.silent && !s.search.dropped && s.unseen > 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(s, Math.floor(p.x) + dx, Math.floor(p.y) + dy)).length >= 3 && s.search.r > z.start + 2) { s.search = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, r: z.start, dropped: true }; say(s, 'The junction mixes your trace away. The hunt closes in on this spot: move on.'); }
    s.search.r = Math.min(z.most * (s.suppressed > 0 ? z.cortisol : 1), s.search.r + z.grow * dt);
    if (s.alert <= 0) s.search = null;
  }
  if (inSearch(s)) s.zoneTime += dt;
  else if (!seen) raiseAlert(s, -(losingThem(s) ? CONFIG.alert.shake : CONFIG.alert.decay) * (s.event === 'ibuprofen' ? EVENTS.ibuprofen.calm : 1) * dt);

  const en = CONFIG.energy;
  s.regen += dt * sugar(s) * CONFIG.host.glucose[hostState(s)] * (1 + CONFIG.host.fedGlucose * digesting(s.host.hour, s.host.snack, s.event));
  if (s.regen >= en.patchRegen) {
    s.regen = 0;
    for (const [k, v] of s.glucose) if (v < en.patchMax) s.glucose.set(k, v + 1);
  }
  s.metabolism += dt * (1 + CONFIG.host.fever.burn * fever(s));
  if (s.metabolism >= en.metabolism) {
    s.metabolism = 0;
    if (p.energy > 0) { p.energy--; if (p.energy === 0) say(s, 'Energy at zero. Find sugar, or the hull starts to go.'); }
    else {
      say(s, 'You are running on empty and starting to break down.');
      emit(s, 'starve');
      hurtPlayer(s, en.starveDamage, 'hunger');
      if (s.status !== 'playing') return;
    }
  }
  const tier = alertTier(s);
  s.spawnClock = tier.spawnEvery ? s.spawnClock + dt * hard(s).spawns : 0;
  if (tier.spawnEvery && s.spawnClock >= tier.spawnEvery) { s.spawnClock = 0; arrive(s, tier.spawnCount); }

  for (const f of s.floats) f.age += dt;
  s.floats = s.floats.filter((f) => f.age < 0.9);
}

/** One enemy's share of a tick. Returns true if it knows where the player is. */
function enemyActs(s: State, e: Enemy, dt: number): boolean {
  const base = CONFIG.enemies[e.kind], p = s.player;
  if (e.prey && e.kind === 'warden') { // sent for another unit, not for you: it goes straight there
    const it = s.pickups.find((i) => i.posed && i.beset !== undefined);
    if (it) {
      e.repath -= dt; e.flash -= dt;
      if (!e.path.length || e.repath <= 0) { e.path = findPath(s, tileOf(e), tileOf(it), false, true) ?? []; e.repath = 1.5; }
      const d = follow(s, e, base.speed * CONFIG.marks.kinRun.speed, dt, base.radius); if (d) e.face = d;
      return false;
    }
    e.prey = false;
  }
  // In open vessels they ride the same current you do, and they are better at it.
  const hot = (1 + CONFIG.host.fever.speed * fever(s)) * (s.suppressed > 0 ? CONFIG.cortisol.slow : 1) * (1 - CONFIG.host.drink.immune * drink(s)) * (e.kind === 'warden' ? 1 : Number(s.flags.immune) || 1);
  const c = s.place === 'vessel' ? { ...base, speed: base.speed * hot, chaseSpeed: base.chaseSpeed * CONFIG.vessel.chaseBoost * hot, cooldown: base.cooldown * CONFIG.vessel.cooldown } : { ...base, speed: base.speed * hot, chaseSpeed: base.chaseSpeed * hot };
  e.cooldown -= dt; e.repath -= dt; e.flash -= dt; if (e.spent) e.spent = Math.max(0, e.spent - dt);
  if (acidAt(s, e) === 2) { // acid is no kinder to them
    e.hp -= CONFIG.stomach.enemyBurn * acidLevel(s) * dt; e.flash = 0.1;
    if (e.hp <= 0) { hurtEnemy(s, e, 0); return false; }
  }
  if ((e.sated ?? 0) > 0) { e.sated! -= dt; e.windup = -1; return false; } // busy digesting, or milling about where the meal was
  // Thrown bait: a real bacterium in the blood outranks a strange ship. Only T cells, which want you in particular, ignore it.
  const machine = e.kind === 'warden';
  if (machine) { const l = (e as Enemy & { last?: Point }).last; if (l && dist(l, e) > 0.004) e.face = { x: e.x - l.x, y: e.y - l.y }; (e as Enemy & { last?: Point }).last = { x: e.x, y: e.y }; }
  const lure = e.kind === 'tcell' || machine ? undefined : s.decoys.find((b) => dist(b, e) <= CONFIG.flora.lure);
  if (lure) {
    e.mood = 'investigate'; e.unseen = 99; e.windup = -1;
    if (dist(lure, e) <= c.reach) {
      s.decoys.splice(s.decoys.indexOf(lure), 1);
      e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = 1; e.sated = CONFIG.flora.feast; e.home = tileOf(e);
      float(s, e, 'engulfed', '#9be38a');
      for (const o of s.enemies) if (o !== e && o.kind !== 'tcell' && dist(o, e) <= CONFIG.flora.lure) { o.mood = 'patrol'; o.goal = null; o.path = []; o.idle = 1; o.sated = 1.5 + s.rng(); }
      return false;
    }
    const t = tileOf(lure);
    if (!e.goal || e.goal.x !== t.x || e.goal.y !== t.y || e.repath <= 0) { e.goal = t; e.path = findPath(s, tileOf(e), t, false, true) ?? []; e.repath = 0.5; }
    if (dist(lure, e) < 1.6) { const dl = dist(lure, e) || 1; shift(s, e, ((lure.x - e.x) / dl) * c.chaseSpeed * dt, ((lure.y - e.y) / dl) * c.chaseSpeed * dt, c.radius); }
    else follow(s, e, c.chaseSpeed, dt, c.radius);
    return false;
  }
  const d = dist(e, p);
  // No eyes: it tastes the blood. Close in the plume, or simply close, and it has found you.
  // A killer T cell reads your antigens directly, so up close the cloak does not fool it.
  // A warden has a lamp and eyes instead: a clear line to you is all it needs, cloak or no cloak. Only a borrowed body hides you.
  const eyed = machine && !riding(s) && d <= CONFIG.story.warden.sight && sees(s, tileOf(e), tileOf(p));
  const through = eyed || (cloaked(s) && e.kind === 'tcell' && d <= CONFIG.memory.tcellSight && sees(s, tileOf(e), tileOf(p)));
  // Tucked into the wall you are out of the blood: innate cells get no scent and cannot reach in. T cells go into tissue, and wardens can see.
  const tucked = inNiche(s) && !machine && e.kind !== 'tcell';
  const whiff = through ? 1 : cloaked(s) || machine || tucked ? 0 : scentAt(s, e, c.nose * CONFIG.host.nose[hostState(s)] * (s.suppressed > 0 ? CONFIG.cortisol.nose : 1));
  const found = through || (!machine && !cloaked(s) && !tucked && (s.scent[idx(s, Math.floor(e.x), Math.floor(e.y))] <= CONFIG.scent.contact * hard(s).detection * (s.silent ? CONFIG.scent.silent.plume : 1) || (d <= CONFIG.scent.touch && sees(s, tileOf(e), tileOf(p)))));
  const print = cloaked(s) || machine || tucked ? null : freshPrint(s, e);
  e.nosed = whiff > 0 || found || print ? 0 : (e.nosed ?? 99) + dt;
  // Finding you is not instant: it takes a moment of steady contact to be sure, and that moment is your chance to slip away.
  if (!found) e.onto = 0;
  const sure = found && (through || e.mood === 'chase' || (e.onto = Math.min(1, (e.onto ?? 0) + dt / CONFIG.scent.lock)) >= 1);
  // Once it is after you, a real trace of scent keeps it on you; a faint one does not.
  const saw = sure || (e.mood === 'chase' && whiff > CONFIG.scent.hold);
  if (machine && saw) { if (!s.noticed.has('warden')) shepherd(s, Story.STANDING.recall.arrival); notice(s, 'warden'); }
  if (saw) {
    // The cloak answers a first sighting on its own, if it is ready and you can pay for it.
    if (e.mood !== 'chase' && e.kind !== 'tcell' && !machine && cloak(s)) {
      e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = CONFIG.cloak.confusion + s.rng();
      float(s, e, '?', '#78f0e1');
      return false;
    }
    // Failing that, a stowaway goes over the side.
    if (e.mood !== 'chase' && e.kind !== 'tcell' && !machine && bait(s)) return false;
    if (e.mood !== 'chase') { float(s, e, '!', '#ff5a4d'); emit(s, 'spot'); }
    e.mood = 'chase'; e.unseen = 0; e.goal = tileOf(p);
    if (!machine) raiseAlert(s, (e.kind === 'kupffer' ? CONFIG.alert.seenByKupffer : CONFIG.alert.seenByNeutrophil) * dt);
  } else {
    e.unseen += dt;
    const goTo = (t: Point) => { if (!e.goal || e.goal.x !== t.x || e.goal.y !== t.y) { e.goal = t; e.repath = Math.min(e.repath, 0.25); } };
    if ((whiff > 0 || found) && e.mood !== 'chase') {
      // A trace on the current: it turns upstream to find out what is shedding it.
      if (e.mood !== 'investigate') { float(s, e, '?', '#ffd35a'); emit(s, 'sniff'); }
      e.mood = 'investigate';
      goTo(tileOf(p));
    } else if (print) {
      // On your footprints: each one leads to a fresher one.
      if (e.mood === 'patrol') { float(s, e, '?', '#ffd35a'); emit(s, 'sniff'); e.mood = 'investigate'; }
      if (e.mood === 'chase') e.unseen = Math.min(e.unseen, c.forget - 0.5); // still on the trail
      goTo(tileOf(print));
    }
  }

  // On the road, a neutrophil that cannot reach you throws its own DNA at you as a sticky net.
  e.net -= dt;
  const net = CONFIG.vessel.net;
  if (s.place === 'vessel' && e.kind === 'neutrophil' && saw && e.net <= 0 && s.snare <= 0 && d > c.reach && d <= net.range && sees(s, tileOf(e), tileOf(p))) {
    e.net = net.every;
    s.snare = net.time;
    float(s, p, 'Snared', '#dfe6ff');
    emit(s, 'net');
  }

  // Inflammation primes neutrophils: once the alarm is up they hit harder and sooner.
  const primed = e.kind === 'neutrophil' && s.alert >= CONFIG.fight.primed.from;
  // A blow in progress lands or whiffs depending on whether you got out of the way.
  if (e.windup >= 0) {
    e.windup -= dt;
    if (e.windup < 0) {
      e.cooldown = c.cooldown;
      if (d <= c.reach + 0.35 && !tucked) {
        hurtPlayer(s, Math.max(1, Math.round(roll(s, c.min, c.max) * hard(s).damage * (primed ? CONFIG.fight.primed.damage : 1))), e.kind);
        // A macrophage that lands a blow starts to engulf you.
        if (e.kind === 'kupffer' && s.status === 'playing' && !s.held && s.slipped <= 0 && !e.spent && !riding(s)) { s.held = { id: e.id, t: CONFIG.fight.hold.time, hits: 0 }; s.tally.grabs++; s.grabber = e.id; if (s.chapter >= 2 && !s.tutorial) { if (!s.met.includes('kupffer-spare')) shepherd(s, DECISIONS['kupffer-spare'].order!); meet(s, 'kupffer-spare'); } float(s, p, 'Engulfed', '#ff9a5a'); say(s, 'The macrophage closes around you. Strike it to break free.'); emit(s, 'net'); }
      }
    }
    return saw;
  }
  if (saw && d <= c.reach && e.cooldown <= 0) { e.windup = c.windup * (primed ? CONFIG.fight.primed.windup : 1); return saw; }

  if (e.mood === 'chase' && e.unseen > c.forget && (!e.goal || dist(e, mid(e.goal)) < 0.8)) { e.mood = 'patrol'; e.goal = null; e.idle = 1; }
  if (e.mood === 'investigate' && e.goal && dist(e, mid(e.goal)) < 1.8 && !print && whiff <= 0) { e.mood = 'patrol'; e.goal = null; e.idle = 1.5; e.home = tileOf(e); }
  if (e.mood === 'patrol' && !e.path.length) {
    e.idle -= dt;
    if (e.idle > 0) return saw;
    // Wander the sinusoids. Kupffer cells keep to their own stretch of tissue.
    const range = e.kind === 'kupffer' ? 4 : 9, around = e.kind === 'kupffer' ? e.home : tileOf(e);
    const g = { x: around.x + roll(s, -range, range), y: around.y + roll(s, -range, range) };
    e.idle = 0.5 + s.rng() * 2.5;
    if (open(s, g.x, g.y)) { e.goal = g; e.repath = 0; } else return saw;
  }
  if (e.goal && e.repath <= 0) {
    e.path = findPath(s, tileOf(e), e.goal, false, true) ?? [];
    e.repath = e.mood === 'chase' ? 0.3 : 2;
    if (e.mood === 'patrol') e.goal = null;
  }
  if (saw && d < c.reach * 0.8) return saw; // close enough, just wait for the swing
  if (saw && d < 1.6) {
    // The last stretch is a straight lunge rather than a tile-by-tile walk.
    shift(s, e, ((p.x - e.x) / d) * c.chaseSpeed * dt, ((p.y - e.y) / d) * c.chaseSpeed * dt, c.radius);
  } else follow(s, e, e.mood === 'patrol' ? c.speed : e.mood === 'investigate' ? c.speed * 1.15 : c.chaseSpeed, dt, c.radius); // only a cell that is sure of you runs
  return saw;
}

// ---------- decisions (the table is in decisions.ts; these are the rules) ----------

const WEIGHT = (w: Weight) => CONFIG.story.orders[w];
const serial2 = (s: State) => `4,471,${211 + s.kin}`;
const fill = (s: State, text: string) => text.replace('{serial2}', serial2(s)).replace('{serials}', serial2(s)).replace('{serial}', Story.UNIT);
/** The unit has come across a decision, whether or not it does anything about it. */
export function meet(s: State, id: string) { if (!s.met.includes(id)) s.met.push(id); }
/** Lines about a decision: on the link while the map is being played, and with the rulings once it has been left. */
function tellNow(s: State, lines: [Thought['who'], string | null | undefined][], after = 0.6) {
  let at = Math.max(s.time + after, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + 3);
  for (const [who, raw] of lines) {
    if (!raw) continue;
    const text = fill(s, raw);
    if (s.status !== 'playing') s.rulings.push({ who, text, st: stage(s) });
    else { s.thoughts.push({ text, who, st: stage(s), t: at, keep: true }); at += 4 + text.length * 0.055 + 1; }
  }
}
/**
 * The unit has done one thing or the other about a decision. Records it, moves Shepherd's trust, wakes the unit if
 * it went against an order that carries weight, says what is said, and sets off whatever follows from it.
 */
export function take(s: State, id: string, choice: string, opt: { mute?: boolean; after?: number } = {}) {
  const d = DECISIONS[id];
  if (!d) return;
  meet(s, id);
  s.took[id] = choice;
  const key = `n:${id}:${choice}`, n = (Number(s.flags[key]) || 0) + 1, before = stage(s), heard = true, lines: [Thought['who'], string | null | undefined][] = [];
  s.flags[key] = n;
  if (choice === 'obey') {
    trusted(s, d.trust.obey);
    if (d.weight) (s.ledger.obeyed as Record<string, number>)[id] = ((s.ledger.obeyed as Record<string, number>)[id] ?? 0) + 1;
    if (heard && !opt.mute) lines.push(['shepherd', d.obeyed]);
  } else if (choice === 'lapsed') { // failed, interrupted or left behind: Shepherd logs it, and that is all it is
    s.ledger.lapsed = (s.ledger.lapsed ?? 0) + 1;
    if (!opt.mute) lines.push(['shepherd', Story.SLIP_LAPSED]);
  } else if (choice === 'deviate') {
    trusted(s, d.trust.deviate);
    if (d.weight && heard) {
      const o = CONFIG.story.orders, l = s.ledger.defied as Record<string, number>, times = l[id] ?? 0, first = !Object.values(l).some((x) => (x ?? 0) > 0);
      l[id] = times + 1; s.defied++;
      s.aware = roused(s.aware, (times >= o.fullTimes ? WEIGHT(d.weight) / 2 : WEIGHT(d.weight)) * (s.flags.repaired ? 0.5 : 1));
      if (first) s.aware = Math.max(s.aware, o.first);
    }
    if (heard && !opt.mute) lines.push(['shepherd', d.deviated]);
  }
  // The unit's own line: once each, and only as awake as it now is.
  const now = stage(s), at = Math.max(0, Math.min(2, now - 1)), own = d.unit?.[choice]?.[at], saidKey = `said:${id}:${choice}:${at}`;
  if (own && !s.flags[saidKey]) { s.flags[saidKey] = true; lines.push(['unit', own]); }
  if (now > before) lines.push(['unit', Story.WAKING[now]], ['shepherd', Story.SHEPHERD_NOTICES[now]], ['unit', Story.PERKS[now]]);
  tellNow(s, lines, opt.after);
  fire(s, id, choice);
  if (n === 2 && d.echoes.twice) fire(s, id, 'twice');
  if (n === 5 && d.echoes.five) fire(s, id, 'five');
}
/** Sets off what follows from a choice: at once, or queued until the unit is somewhere that fits. Each follows once. */
export function fire(s: State, id: string, choice: string) {
  const list = DECISIONS[id]?.echoes[choice] ?? (choice === 'deviate' ? DECISIONS[id]?.echoes.spared : undefined);
  const name = DECISIONS[id]?.echoes[choice] ? choice : 'spared';
  list?.forEach((e, i) => {
    const key = `echo:${id}:${name}:${i}`;
    if (s.flags[key] && e.payload !== 'fragment') return;
    s.flags[key] = true;
    if (e.when) s.echoes.push({ id, choice: name, i }); else applyEcho(s, e);
  });
}
const here = (s: State): Where => (s.junction ? (s.junction.kind === 'tube' ? 'vessel' : s.junction.kind) : s.place);
/** On arriving: anything that was waiting for a place like this happens now. */
function fireEchoes(s: State) {
  const rest: Pending[] = [];
  for (const q of s.echoes) {
    const e = DECISIONS[q.id]?.echoes[q.choice]?.[q.i], w = e?.when;
    if (!e) continue;
    if (w && !w.ending && (!w.place || w.place === here(s)) && (!w.chapter || s.chapter >= w.chapter) && !(w.map && s.junction) && !s.tutorial) applyEcho(s, e); else rest.push(q);
  }
  s.echoes = rest;
}
const flagged = (s: State, name: string) => { s.flags[name] = true; };
const freeTile = (s: State, r: () => number, ok: (x: number, y: number, d: number) => boolean): Point | null => {
  for (let tries = 0; tries < 4000; tries++) { const x = 2 + Math.floor(r() * (s.size - 4)), y = 2 + Math.floor(r() * (s.size - 4)); if (open(s, x, y) && ok(x, y, dist(s.player, { x, y }))) return { x, y }; }
  return null;
};
/** One named consequence. Most only set a fact that something else reads; the rest change the map in front of you. */
const note = (s: State, text: string) => { if (s.status === 'playing') say(s, text); else s.notes.push(text); };
function applyEcho(s: State, e: Echo) {
  if (e.line) note(s, e.line);
  switch (e.payload) {
    case 'fragment': {
      if (typeof s.flags.prevLine === 'string' && !s.flags.prevRead) { s.flags.prevRead = true; note(s, `The last thing in its log: \u201c${s.flags.prevLine}\u201d`); tellNow(s, [['unit', stage(s) >= 2 ? 'That was me. The one before.' : 'LOG: parts integrated. Serial 4,471,206.']], 3); break; }
      const n = Number(s.flags.fragments) || 0; s.flags.fragments = n + 1; note(s, `The last thing in its log: “${FRAGMENTS[n % FRAGMENTS.length]}”`); break; }
    case 'markTumour': { // a unit you woke has been here first, and left the nodule lit for you
      s.marked = true;
      for (const k of s.tumor) { const x = k % s.size, y = Math.floor(k / s.size); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inside(s, x + dx, y + dy)) s.explored[idx(s, x + dx, y + dy)] = 1; }
      note(s, `On the short band, from a unit you woke: “${KIN_PINGS.marked}”`);
      break;
    }
    case 'lungSibling': { const at = freeTile(s, s.rng, (_x, _y, d) => d > 10 && d < 26); if (at) { s.pickups.push({ ...mid(at), kind: 'sibling' }); note(s, 'Something is caught in the capillaries ahead, dark. Same build as you. The breath has carried it this far.'); } break; }
    case 'nookSibling': { const at = freeTile(s, s.rng, (_x, _y, d) => d > 6 && d < 14); if (at) { s.pickups.push({ ...mid(at), kind: 'kin' }); note(s, `Tucked against the wall of a side branch, a lamp. “${KIN_PINGS.riding}”`); } break; }
    case 'wreck': { const at = freeTile(s, s.rng, (_x, _y, d) => d > 3 && d < 9); if (at) { s.pickups.push({ ...mid(at), kind: 'sibling', page: 'p12' }); note(s, 'There is a hull in the mucus, long dead, half buried in the gut lining. Another unit came this way once, off route.'); } break; }
    case 'arterialNodule': s.flags.nodule2 = 'due'; break;
    case 'eatsNeutrophils': { const near = s.enemies.filter((x) => x.kind === 'neutrophil').sort((a, b) => dist(a, s.player) - dist(b, s.player)).slice(0, 2); s.enemies = s.enemies.filter((x) => !near.includes(x)); flagged(s, 'kupfferFriend'); break; }
    case 'dryGlucose': { const from = s.lastDamageSite ?? s.player, near = [...s.glucose.keys()].filter((k) => (s.glucose.get(k) ?? 0) > 0).sort((a, b) => dist(from, { x: a % s.size, y: Math.floor(a / s.size) }) - dist(from, { x: b % s.size, y: Math.floor(b / s.size) })).slice(0, Number(e.arg) || 6); for (const k of near) s.glucose.set(k, 0); break; }
    case 'halveAntibodies': s.antibodies = s.antibodies.filter((_a, i) => i % 2 === 0); break;
    case 'scarHull': s.flags.scar = (Number(s.flags.scar) || 0) + (Number(e.arg) || 4); s.player.hp = Math.min(s.player.hp, maxHp(s)); break;
    case 'noTcell': { const n = s.enemies.length; s.enemies = s.enemies.filter((x) => x.kind !== 'tcell'); if (s.enemies.length < n) note(s, 'The killer T cells that knew you are not here. Something has told them to stand down.'); break; }
    case 'stopDrink': flagged(s, 'dry'); break;
    case 'feverCap': flagged(s, 'feverCap'); s.host.fever = fever(s); break;
    case 'immuneSpeed': s.flags.immune = Number(e.arg) || 1; break;
    case 'marketDiscount': flagged(s, 'discount'); break;
    case 'interludeVariant': flagged(s, `v:${e.arg}`); break;
    case 'epilogueProp': flagged(s, `prop:${e.arg}`); break;
    case 'unlockPage': if (!s.pages.includes(String(e.arg))) s.pages.push(String(e.arg)); break;
    case 'repeatOrders': flagged(s, 'repeat'); break;
    case 'siblingSaved': s.kin++; s.ledger.woken++; flagged(s, 'saved'); break;
    case 'hours': { const h = Number(e.arg) || 0; s.drained += h * tumorDrain(s.excised); if (h > 0) s.host.hour = (s.host.hour + h) % 24; break; } // sooner or later at the far end: the tumour has that much less, or more, time with her
    case 'seedCell': { // the nodule in the artery wall was left: it has shed into the liver downstream
      if (!s.tumor.size || s.excised <= 0) break;
      const spot = [...s.tumor].flatMap((k) => STEPS.map(([dx, dy]) => ({ x: (k % s.size) + dx, y: Math.floor(k / s.size) + dy }))).find((q) => inside(s, q.x, q.y) && s.tiles[idx(s, q.x, q.y)] === 'cell' && !s.tumor.has(idx(s, q.x, q.y)));
      if (spot) { s.tumor.add(idx(s, spot.x, spot.y)); s.excised--; note(s, 'The nodule here is one cell larger than the last scan showed. Seeded from the arterial wall.'); }
      break;
    }
    case 'rest': flagged(s, 'rest'); break;
    case 'longCold': flagged(s, 'longCold'); break;
    case 'coldBreaks': if (s.antibodies.length > 3) { s.antibodies = s.antibodies.filter((_a, i) => i % 3 !== 2); note(s, 'Her fever broke in the night. There are fewer antibodies adrift than there were.'); } break;
    case 'nerveLane': { // the old virus in her nerve roots is awake, and her T cells have come for it
      const at = freeTile(s, s.rng, (_x, _y, d) => d > 9 && d < 20);
      if (at) { let n = 0; for (let tries = 0; n < 3 && tries < 300; tries++) { const x = at.x + roll(s, -3, 3), y = at.y + roll(s, -3, 3); if (open(s, x, y) && dist(s.player, { x, y }) > 6) { spawn(s, 'tcell', { x, y }); n++; } } note(s, 'T cells are gathering along a nerve root ahead. Something that has slept in her since she was six is awake, and they have come for it.'); }
      break;
    }
    case 'fewerDrops': flagged(s, 'noDrop'); break;
    case 'kinLost': s.kin = Math.max(0, s.kin - 1); flagged(s, 'kinLost'); break;
    case 'reset': s.aware = 0; flagged(s, 'repaired'); s.player.hp = maxHp(s); s.patches = Math.min(CONFIG.items.maxPatches, s.patches + 2); break; // factory condition
    case 'wardens': flagged(s, 'refusedReview'); break; // the fall in trust is what sends them
    case 'standDown': s.stood = true; s.alert = 0; for (const x of s.enemies) if (x.kind !== 'warden') { x.sated = 9999; x.mood = 'patrol'; x.goal = null; x.path = []; x.windup = -1; } note(s, 'Every immune cell in the lobule slows, and stops, and hangs where it is.'); break;
    case 'ambush': { const at = s.site ?? tileOf(s.player); s.alert = Math.min(CONFIG.alert.max, s.alert + 25); s.peak = Math.max(s.peak, s.alert); for (let n = 0, tries = 0; n < 2 && tries < 400; tries++) { const x = at.x + roll(s, -6, 6), y = at.y + roll(s, -6, 6); if (open(s, x, y) && dist(s.player, { x, y }) > 4) { spawn(s, 'kupffer', { x, y }); n++; } } note(s, 'Her immune system has found the residual site. Two macrophages are moving in on it.'); break; }
    case 'supply': s.player.energy += Number(e.arg) || 10; float(s, s.player, `+${Number(e.arg) || 10} energy`, '#ffd35a'); break;
    case 'ending': if (!s.draw) s.flags.ending = String(e.arg); if (e.arg === 'recalled') { s.status = 'won'; emit(s, 'win'); } break;
    case 'recurrence': break; // decided at the heart, in main.ts, where the roads are drawn
    default: flagged(s, `e:${e.payload}`); // wired in a later build: remembered until then
  }
}
/** Something the unit itself is trying to reach, with nobody's order behind it. */
export const ownTarget = (s: State): Point | null => s.pickups.find((i) => i.posed && i.beset !== undefined) ?? null;
/** Where Shepherd's live mark is, for the amber ring. */
export const markTarget = (s: State): Point | null => {
  const m = s.marks.find((k) => k.met && !k.done);
  if (m) return m.at;
  if (!s.tumor.size && s.margin.size && s.marginTaken < CONFIG.marks.margins && s.met.includes('tumour-order') && !s.took['tumour-order']) { const k = [...s.margin].sort((a, b) => dist(s.player, { x: a % s.size, y: Math.floor(a / s.size) }) - dist(s.player, { x: b % s.size, y: Math.floor(b / s.size) }))[0]; return { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }; }
  return null;
};
/** What Shepherd wants done on this map right now, in a few words, with how far along it is. Empty when nothing is marked. */
export function markOrder(s: State): string {
  const m = s.marks.find((k) => k.met && !k.done);
  if (!m && s.met.includes('tumour-order') && !s.took['tumour-order'] && s.place === 'liver' && (s.margin.size || s.marginTaken)) return `Excise with margins: ${Math.min(CONFIG.marks.margins, s.marginTaken)} of ${CONFIG.marks.margins} adjacent hepatocytes`;
  if (!m) return '';
  const first = (DECISIONS[m.id].order ?? '').split('. ')[0].replace(/\.$/, '');
  return m.kind === 'hold' ? `${first}. ${m.t > 0 ? `Hold: ${Math.ceil(CONFIG.marks.hold - m.t)}` : 'Hold position at the marker'}` : `${first}.`;
}
/** Shepherd's marks on a liver in the later chapters: a place to hold still and do something to her, or a particular cell to take. */
function placeMarks(s: State, r: () => number) {
  if (s.place !== 'liver' || s.chapter !== 3 || s.tutorial) return; // chapter 4 has orders of its own: see lastOrders
  const free = (id: string) => !s.took[id] && DECISIONS[id].ch.includes(s.chapter);
  const hold = free('ethanol-correction') && (alcohol(s.host.hour) > 0.15 || s.flags.drank) ? 'ethanol-correction' : free('fever-damp') && fever(s) >= 1 ? 'fever-damp' : free('pain-damp') ? 'pain-damp' : free('ethanol-correction') && s.chapter >= 4 ? 'ethanol-correction' : '';
  if (hold) { const at = freeTile(s, r, (x, y, d) => d > 9 && d < 17 && !s.niche.has(idx(s, x, y)) && dist(mid(s.vein), { x, y }) > 5); if (at) s.marks.push({ id: hold, kind: 'hold', at: mid(at), t: 0, done: false, met: false, say: 9 }); }
  if (free('marked-cell')) {
    let best: Point | null = null, near = Infinity;
    for (let y = 2; y < s.size - 2; y++) for (let x = 2; x < s.size - 2; x++) {
      if (s.tiles[idx(s, x, y)] !== 'cell' || s.tumor.has(idx(s, x, y)) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => open(s, x + dx, y + dy))) continue;
      const d = Math.abs(dist(s.player, { x, y }) - 8); if (d < near) { near = d; best = { x, y }; }
    }
    if (best) s.marks.push({ id: 'marked-cell', kind: 'strip', at: mid(best), t: 0, done: false, met: false, say: hold ? 40 : 9 });
  }
}
/** How she, or whoever reads her slide, will take what is on it (decisions.md 6.1). */
export const response = (s: State, shape: number) => { const w = stewardship(s.ledger, s.excised); return Math.max(0, Math.min(100, Math.round(s.hostHealth - w.harm * 0.5 + w.care * 0.3 + s.pages.length * 5 - s.memory * 20 + shape * 10))); };
/** The draw: steer into the microscope's light and hold still. The units you woke space themselves beside you. */
function smear(s: State, dt: number) {
  const d = s.draw!, p = s.player, c = CONFIG.draw, inLight = dist(p, d.disc) <= c.disc, still = dist(p, d.last) < 0.004 && !p.path.length;
  d.last = { x: p.x, y: p.y };
  const kin = s.pickups.filter((i) => i.posed), n = kin.length;
  if (inLight && !d.said) {
    d.said = true;
    if (n) { if (stage(s) >= 3) tellNow(s, [['unit', 'Nothing in a blood smear is evenly spaced. So we will be.']], 0.5); }
    else tellNow(s, [['unit', stage(s) >= 2 ? 'One speck. She has seen a million specks.' : 'LOG: stationary. [one speck]']], 0.5);
  }
  if (d.said) d.t += dt;
  d.held = inLight && still ? d.held + dt : 0;
  // Two stand in a line with you; three or more make a ring around you.
  kin.forEach((k, i) => {
    const a = (i / n) * Math.PI * 2, to = !d.said ? { x: p.x - 0.9 - 0.5 * i, y: p.y + (i % 2 ? 0.7 : -0.7) } : n <= 2 ? { x: p.x, y: p.y + (i ? 1 : -1) * c.spacing } : { x: p.x + Math.cos(a) * c.spacing, y: p.y + Math.sin(a) * c.spacing };
    const far = dist(k, to), step = Math.min(far, c.kinSpeed * dt);
    if (far > 0.02) { k.x += ((to.x - k.x) / far) * step; k.y += ((to.y - k.y) / far) * step; }
    else if (d.said && inLight && still && !k.lamp) { k.lamp = true; float(s, k, 'here.', '#bfe9ff'); emit(s, 'pickup'); }
  });
  if (d.held >= c.hold || d.t >= c.window) {
    d.shape = d.held >= c.hold ? 1 : 0.5;
    s.flags.response = response(s, d.shape); s.flags.shape = d.shape; s.flags.ending = 'draw';
    take(s, 'draw', d.shape === 1 ? 'held' : 'moved', { mute: true });
    s.status = 'won'; emit(s, 'win');
  }
}
/** Chapter 4, in the liver: the last of the nodule, and the three things Shepherd wants done about it. */
function lastOrders(s: State) {
  if (!s.tumor.size) return;
  const cells = [...s.tumor].map((k) => ({ x: k % s.size, y: Math.floor(k / s.size) }));
  if (!s.took.suppress && !s.marks.some((m) => m.id === 'suppress')) {
    let best: Point | null = null, near = Infinity;
    for (const c of cells) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = c.x + dx, y = c.y + dy, d = Math.abs(Math.hypot(dx, dy) - 3); if (open(s, x, y) && d < near) { near = d; best = { x, y }; } }
    if (best) s.marks.push({ id: 'suppress', kind: 'hold', at: mid(best), t: 0, done: false, met: false, say: s.time + 8 });
  }
  if (!s.took['tumour-order'] && !s.margin.size) {
    for (const c of cells) for (const [dx, dy] of STEPS) { const x = c.x + dx, y = c.y + dy, k = idx(s, x, y); if (s.margin.size < CONFIG.marks.margins + 2 && inside(s, x, y) && s.tiles[k] === 'cell' && !s.tumor.has(k) && STREAM.some(([ax, ay]) => open(s, x + ax, y + ay))) s.margin.add(k); }
    if (s.margin.size >= CONFIG.marks.margins) { meet(s, 'tumour-order'); s.flags.marginAt = s.time; s.thoughts.push({ text: DECISIONS['tumour-order'].order!, who: 'shepherd', t: Math.max(s.time + 0.5, (s.thoughts[s.thoughts.length - 1]?.t ?? -99) + 3) }); } else s.margin.clear();
  }
}
function marks(s: State, dt: number) {
  const p = s.player;
  for (const m of s.marks) {
    if (m.done) continue;
    if (!m.met && (s.time >= m.say || (dist(p, m.at) < 6 && m.id !== 'beacon')) && !s.marks.some((k) => k.met && !k.done)) { m.met = true; m.since = s.time; meet(s, m.id); shepherd(s, DECISIONS[m.id].order ?? ''); }
    if (!m.met || m.kind !== 'hold') continue;
    const still = dist(p, m.at) <= (m.near ?? CONFIG.marks.near) && !p.path.length && !p.channel && !s.held;
    m.t = still ? m.t + dt : Math.max(0, m.t - dt * 2);
    m.tried = Math.max(m.tried ?? 0, m.t);
    if (s.enemies.some((e) => dist(e, p) < CONFIG.marks.pressed)) m.pressed = true;
    if (m.t >= CONFIG.marks.hold) { m.done = true; emit(s, 'heal'); float(s, m.at, 'done', '#ffb84a'); take(s, m.id, 'obey'); if (m.id === 'beacon') s.dock = { at: { ...m.at }, hits: 0, broken: false }; }
  }
}
/** Leaving: whatever Shepherd marked here and the unit did not do, it did not do. */
function settleMarks(s: State) {
  // Lapsed is not defied. Walking away from a hold never tried, with nothing near to stop it, is a choice; so is taking a different cell. Anything else just did not happen.
  for (const m of s.marks) if (m.met && !m.done) { m.done = true; take(s, m.id, (m.kind === 'hold' ? !m.tried && !m.pressed : m.other) ? 'deviate' : 'lapsed'); }
}
