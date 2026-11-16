// The rules of the liver prototype, simulated in real time. No drawing and no browser
// APIs in here, so the whole game can be run and tested from plain code.
import { CONFIG, UPGRADES, UpgradeId } from './config';
import { generate, generateStomach, generateVessel, mulberry32, Point } from './map';

export type { Point };
export type Tile = 'cell' | 'dead' | 'floor';
export type EnemyKind = 'neutrophil' | 'kupffer' | 'tcell';
export type Mood = 'patrol' | 'investigate' | 'chase';

export interface Enemy extends Point { sated?: number;
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
}
export interface Shot extends Point { vx: number; vy: number; left: number }
export interface Float extends Point { text: string; color: string; age: number }
/** One footprint: where you stepped, which way you were heading, and when. */
export interface Print extends Point { dx: number; dy: number; born: number }
export interface Pickup extends Point { kind: 'cache' | 'patch' | 'calm' | 'cortisol' }
/** An antibody adrift in the blood: made to fit you, and it sticks. */
export interface Antibody extends Point { seed: number }
export interface Channel { kind: 'skim' | 'strip'; t: number; total: number; x: number; y: number }

export interface State {
  place: Place;
  vessel: Vessel | null; // which kind of vessel, when you are in one
  host: { hour: number; surge: number; nextSurge: number; eating: boolean; fever: number; mend: number; out: boolean; nap: number; snack: number; habit: string }; // nap: hours of induced sleep left; snack: hour of an induced meal, or -1 // time of the host's day, seconds of fright left, seconds to the next, and whether a meal is going down
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
export interface Carry { hp: number; energy: number; upgrades: Record<UpgradeId, number>; patches: number; hostHealth: number; hour: number; memory: number; excised: number; nap: number; snack: number; flora?: number }
export const carryOf = (s: State): Carry => ({ hp: s.player.hp, energy: s.player.energy, upgrades: { ...s.upgrades }, patches: s.patches, hostHealth: s.hostHealth, hour: s.host.hour, memory: memoryAfter(s), excised: s.excised, nap: s.host.nap, snack: s.host.snack, flora: s.flora });
/** What the host will remember of you once you leave this map. */
export const memoryAfter = (s: State) => Math.min(1, s.memory + CONFIG.memory.perAlert * (s.peak / CONFIG.alert.max) + CONFIG.memory.perKill * s.kills);
/** A liver is a place to feed. A vessel is a stretch of road with a patrol on it. */
export type Place = 'liver' | 'vessel' | 'stomach' | 'lung';
export type Vessel = 'artery' | 'vein';
export type HostState = 'asleep' | 'awake' | 'stressed';

/** What the host is doing right now. A fright overrides everything, even sleep. */
export function hostState(s: State): HostState {
  const h = CONFIG.host;
  return s.host.surge > 0 ? 'stressed' : s.host.nap > 0 || s.host.hour >= h.asleepFrom || s.host.hour < h.asleepUntil ? 'asleep' : 'awake';
}

/** How high a fever the host is running, 0 (none) to 3. */
export const fever = (s: State) => CONFIG.host.fever.below.filter((h) => s.hostHealth < h).length;
/** How busy the gut is with a meal: 1 as the host puts their fork down, fading to 0 over a few hours. */
const fading = (hour: number, at: readonly number[], lasts: number) => { let most = 0; for (const t of at) { const since = (hour - t + 24) % 24; if (since < lasts) most = Math.max(most, 1 - since / lasts); } return most; };
/** How much coffee is in the host, 1 at the last sip fading to 0. */
export const caffeine = (hour: number) => fading(hour, CONFIG.host.coffee.at, CONFIG.host.coffee.lasts);
/** How much of an evening drink is in the host. */
export const alcohol = (hour: number) => fading(hour, CONFIG.host.drink.at, CONFIG.host.drink.lasts);
/** A line about the host's life outside, chosen by the clock so it is never the same twice running. */
const outside = (s: State, lines: string[]) => lines[Math.floor(s.host.hour * 7 + s.time) % lines.length];
export function digesting(hour: number, snack = -1): number {
  let most = 0;
  for (const meal of snack >= 0 ? [...CONFIG.host.meals, snack] : CONFIG.host.meals) { const since = (hour - meal + 24) % 24; if (since < CONFIG.host.digestion) most = Math.max(most, 1 - since / CONFIG.host.digestion); }
  return most;
}
/** How strong the stomach's acid is right now, from its resting trickle up to 1. */
export const acidLevel = (s: State) => CONFIG.stomach.resting + (1 - CONFIG.stomach.resting) * digesting(s.host.hour, s.host.snack);
/** What the ship is sitting in: nothing special, mucus or acid. */
export const acidAt = (s: State, p: Point) => s.acid?.[idx(s, Math.floor(p.x), Math.floor(p.y))] ?? 0;
/** Hull lost per second in open acid right now. */
export const burnRate = (s: State) => CONFIG.stomach.burn * acidLevel(s) * Math.max(0.1, 1 - CONFIG.stomach.mucinPerLevel * s.upgrades.mucin);

export function createGame(seed = Date.now(), carry?: Carry, place: Place = 'liver', patrol = 3, vessel: Vessel = 'artery'): State {
  const m = place === 'vessel' ? generateVessel(seed, patrol) : place === 'lung' ? generateVessel(seed, CONFIG.lung.macrophages) : place === 'stomach' ? generateStomach(seed) : generate(seed);
  if (place === 'lung') { m.kupffer = m.neutrophils; m.neutrophils = []; } // the lung keeps its own macrophages, not a patrol
  const N = m.size;
  const s: State = {
    place,
    vessel: place === 'vessel' ? vessel : null,
    host: { hour: carry?.hour ?? CONFIG.host.startHour, surge: 0, nextSurge: 0, eating: digesting(carry?.hour ?? CONFIG.host.startHour, carry?.snack ?? -1) > 0, fever: CONFIG.host.fever.below.filter((h) => (carry?.hostHealth ?? 100) < h).length, mend: 0, out: false, nap: carry?.nap ?? 0, snack: carry?.snack ?? -1, habit: '' },
    acid: m.acid ?? null,
    rich: new Set((m.rich ?? []).map((p) => p.y * N + p.x)),
    riding: 0,
    suppressed: 0,
    slam: 0,
    sizzle: 0,
    tumor: new Set((m.tumor ?? []).map((p) => p.y * N + p.x)),
    excised: carry?.excised ?? 0,
    memory: carry?.memory ?? 0,
    peak: 0,
    antibodies: [],
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
  if (place !== 'stomach')
    for (let n = Math.round(s.memory * CONFIG.memory.most * (place === 'vessel' ? 0.5 : 1)), tries = 0; s.antibodies.length < n && tries < 4000; tries++) {
      const x = 2 + Math.floor(s.rng() * (N - 4)), y = 2 + Math.floor(s.rng() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 9) s.antibodies.push({ x: x + 0.5, y: y + 0.5, seed: s.rng() * 100 });
    }
  if (place !== 'stomach')
    for (let n = CONFIG.memory.tcells.filter((m) => s.memory >= m).length, tries = 0; n > 0 && tries < 4000; tries++) {
      const x = 2 + Math.floor(s.rng() * (N - 4)), y = 2 + Math.floor(s.rng() * (N - 4));
      if (open(s, x, y) && dist(s.player, { x, y }) > 16) { spawn(s, 'tcell', { x, y }); n--; }
    }
  m.kupffer.forEach((p) => spawn(s, 'kupffer', p));
  m.neutrophils.forEach((p) => spawn(s, 'neutrophil', p));
  say(s, place === 'vessel' ? 'A patrol is working this vessel. Get to the far end.' : place === 'lung' ? 'The lung. Each breath out carries you toward the air; each breath in drags you back.' : place === 'stomach' ? 'The stomach. Acid fills the middle; the way out is a vein on the far side.' : `The scan shows a tumor nodule in this lobule: it is ringed on your map. You need ${CONFIG.energy.quota} energy to leave by the central vein.`);
  look(s);
  return s;
}

function spawn(s: State, kind: EnemyKind, tile: Point): Enemy {
  const e: Enemy = {
    id: s.nextId++, kind, ...mid(tile), hp: CONFIG.enemies[kind].hp, mood: 'patrol', goal: null, home: { ...tile },
    path: [], repath: 0, cooldown: s.rng(), windup: -1, idle: s.rng() * 2, unseen: 99, flash: 0, net: 1 + s.rng() * 2,
  };
  s.enemies.push(e);
  return e;
}

/** Notes that something audible happened. The rules never play sound themselves. */
function emit(s: State, what: string) {
  if (s.events.length < 40) s.events.push(what);
}
function say(s: State, text: string) {
  s.log.push({ text, t: s.time });
  if (s.log.length > 60) s.log.shift();
}
const float = (s: State, at: Point, text: string, color: string) => s.floats.push({ x: at.x, y: at.y, text, color, age: 0 });

// ---------- the build ----------

const bonus = (s: State, id: UpgradeId) => s.upgrades[id] * UPGRADES[id].per;
export const maxHp = (s: State) => CONFIG.player.maxHp + bonus(s, 'glycocalyx');
export const vision = (s: State) => CONFIG.player.vision + bonus(s, 'retinol');
export const riding = (s: State) => s.riding > 0 && s.cloak > 0;
export const speed = (s: State) => CONFIG.player.speed * (riding(s) ? CONFIG.board.speed : 1) * (1 + bonus(s, 'atp')) * (s.snare > 0 ? CONFIG.vessel.net.slow : 1) * (acidAt(s, s.player) === 1 ? CONFIG.stomach.mucusSpeed : 1);
export const cloakTime = (s: State) => CONFIG.cloak.base + bonus(s, 'cd47');
export const cloaked = (s: State) => s.cloak > 0;

/** 1 with no masking, down to 0.4 with a full CD47 coat. Scales the plume and the trail alike. */
export const scentScale = (s: State) => (1 - CONFIG.scent.maskPerLevel * s.upgrades.cd47) * (s.tagged > 0 ? CONFIG.memory.tagScent : 1);
/** Seconds one of your footprints lasts. */
export const trailLife = (s: State) => CONFIG.scent.trailLife * scentScale(s);

/** Which way the blood is running at a spot, as a unit vector (or nothing, in a still corner). */
export function currentAt(s: State, at: Point): Point {
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
  return CONFIG.host.current[where] * CONFIG.host.push[hostState(s)][where] * (where === 'stomach' ? 1 : 1 + CONFIG.host.coffee.push * caffeine(s.host.hour));
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
  const reach = CONFIG.scent.reach * scentScale(s) * nose;
  return Math.max(0, 1 - s.scent[idx(s, t.x, t.y)] / reach);
}

/** The freshest of your footprints that a cell standing at `at` could pick up. */
function freshPrint(s: State, at: Point): Print | null {
  const life = trailLife(s);
  for (let k = s.trail.length - 1; k >= 0; k--) {
    const f = s.trail[k];
    if (s.time - f.born > life) break;
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
  if (offer.length) s.offer = offer;
}
/** Slap a fibrin patch on. */
export function usePatch(s: State): boolean {
  if (s.status !== 'playing' || s.patches <= 0 || s.player.hp >= maxHp(s)) return false;
  s.patches--;
  emit(s, 'heal');
  const before = s.player.hp;
  s.player.hp = Math.min(maxHp(s), before + CONFIG.items.patchHeal);
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
/** Throw a stowaway overboard. Innate immune cells cannot resist a real bacterium, but the host pays for it. */
export function bait(s: State): boolean {
  if (s.flora <= 0 || s.decoys.length || riding(s)) return false;
  s.flora--;
  s.decoys.push({ x: s.player.x, y: s.player.y, t: CONFIG.flora.lasts });
  s.hostHealth = Math.max(0, s.hostHealth - CONFIG.flora.hostDamage);
  float(s, s.player, 'Bait away', '#9be38a');
  say(s, s.place === 'liver' ? 'A stowaway goes overboard. Gut bacteria in the liver are exactly what these cells are here for.' : 'A stowaway goes overboard. Bacteria loose in the blood: the host will feel that.');
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
export const atVein = (s: State) => dist(s.player, mid(s.vein)) < 1.6;
/** Out of a liver you pay the fare in energy. Along a vessel the current simply takes you. */
export const canLeave = (s: State) => atVein(s) && (s.place !== 'liver' || s.player.energy >= CONFIG.energy.quota);

/** The nearest living hepatocyte within arm's reach, if any. */
export function stripTarget(s: State): Point | null {
  if (s.place === 'vessel' || s.place === 'lung') return null; // vessel walls are not worth eating
  const p = tileOf(s.player);
  let best: Point | null = null, bestD: number = CONFIG.energy.strip.reach;
  for (let y = p.y - 1; y <= p.y + 1; y++)
    for (let x = p.x - 1; x <= p.x + 1; x++) {
      if (x < 2 || y < 2 || x >= s.size - 2 || y >= s.size - 2 || s.tiles[idx(s, x, y)] !== 'cell') continue;
      if (s.place === 'stomach' && !s.rich.has(idx(s, x, y))) continue; // only the parietal cells are worth it here
      const d = dist(s.player, mid({ x, y }));
      if (d < bestD) { bestD = d; best = { x, y }; }
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
  const prev = new Int32Array(N * N).fill(-1);
  prev[startI] = startI;
  const queue = [startI];
  let best = startI, bestD = Math.hypot(from.x + 0.5 - x, from.y + 0.5 - y);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head], cx = cur % N, cy = Math.floor(cur / N);
    const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
    if (d < bestD - 0.01) { bestD = d; best = cur; }
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx, ny = cy + dy;
      const ok = (ax: number, ay: number) => open(s, ax, ay) && s.explored[idx(s, ax, ay)] === 1;
      if (!ok(nx, ny) || prev[idx(s, nx, ny)] !== -1) continue;
      if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      prev[idx(s, nx, ny)] = cur;
      queue.push(idx(s, nx, ny));
    }
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
  const swept = s.antibodies.filter((a) => dist(a, p) <= c.reach);
  if (swept.length) { s.antibodies = s.antibodies.filter((a) => !swept.includes(a)); float(s, swept[0], 'cleared', '#b8c8ff'); }
  for (const e of [...s.enemies]) {
    const d = dist(e, p);
    if (d > c.reach + CONFIG.enemies[e.kind].radius) continue;
    if (d > 0.3 && ((e.x - p.x) * p.face.x + (e.y - p.y) * p.face.y) / d < c.arc) continue;
    hurtEnemy(s, e, roll(s, c.min, c.max) + bonus(s, 'elastase'));
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
  say(s, s.place === 'liver' ? 'You slip into the central vein and ride the current back toward the heart.' : s.place === 'lung' ? 'Through the wall of the last air sac, and out on a breath.' : s.place === 'stomach' ? 'You slip into the gastric vein. It drains to the liver.' : 'The current takes you on.');
  return true;
}

function finishChannel(s: State, ch: Channel) {
  const p = s.player, i = idx(s, ch.x, ch.y);
  if (ch.kind === 'skim') {
    const left = s.glucose.get(i) ?? 0;
    if (left <= 0) return;
    emit(s, 'skim');
    s.glucose.set(i, left - 1);
    p.energy += CONFIG.energy.skim.gain;
    float(s, p, `+${CONFIG.energy.skim.gain} energy`, '#e8b530');
    if (left - 1 > 0) p.channel = { ...ch, t: 0 }; // keep sipping until the patch runs dry
    return;
  }
  const base = s.rich.has(i) ? { ...CONFIG.energy.strip, ...CONFIG.stomach.parietal } : CONFIG.energy.strip, rich = s.rich.has(i);
  // A liver busy with a drink has less to spare.
  const c = s.place === 'liver' ? { ...base, hostDamage: Math.round(base.hostDamage * (1 + CONFIG.host.drink.liver * alcohol(s.host.hour))) } : base;
  if (s.tiles[i] !== 'cell') return;
  if (s.tumor.delete(i)) {
    // The job you came to do. A tumor hides itself from the immune system, so cutting it out makes little stir.
    const t = CONFIG.tumor;
    s.tiles[i] = 'dead'; s.flow = null;
    p.energy += t.gain; s.excised++;
    s.hostHealth = Math.min(CONFIG.host.maxHealth, s.hostHealth + t.heal);
    float(s, p, `+${t.gain} energy`, '#e8b530');
    emit(s, 'excise');
    say(s, s.excised >= t.goal ? `Tumor cell excised: ${s.excised} of ${t.goal}. That is all of it. Get the crew home.` : `Tumor cell excised: ${s.excised} of ${t.goal}.${s.tumor.size ? '' : ' This nodule is gone.'}`);
    raiseAlert(s, t.alert);
    return;
  }
  s.rich.delete(i);
  s.tiles[i] = 'dead';
  s.flow = null; // a new gap for the blood to run through
  p.energy += c.gain;
  s.hostHealth = Math.max(0, s.hostHealth - c.hostDamage);
  s.cellsKilled++;
  s.lastDamageSite = { x: ch.x, y: ch.y };
  float(s, p, `+${c.gain} energy`, '#e8b530');
  emit(s, 'strip');
  say(s, rich ? 'The parietal cell dies. It was stuffed with mitochondria.' : 'The hepatocyte dies and leaks danger signals.');
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
  e.flash = 0.15;
  emit(s, e.hp <= 0 ? (e.kind === 'kupffer' ? 'bigkill' : 'kill') : 'hit');
  if (dmg) float(s, e, String(dmg), '#ffffff');
  if (e.hp <= 0) {
    s.enemies = s.enemies.filter((o) => o !== e);
    s.kills++;
    // A Kupffer cell is full of what it has eaten; neutrophils sometimes leave a clot behind.
    if (e.kind === 'kupffer') s.pickups.push({ x: e.x, y: e.y, kind: 'cache' });
    else if (s.rng() < CONFIG.items.patchDrop) s.pickups.push({ x: e.x, y: e.y, kind: 'patch' });
    if (s.player.attackId === e.id) s.player.attackId = null;
    raiseAlert(s, CONFIG.alert.perKill);
    return;
  }
  e.mood = 'chase';
  e.unseen = 0;
  e.goal = tileOf(s.player);
}

function hurtPlayer(s: State, dmg: number, by: EnemyKind) {
  const p = s.player;
  p.hp -= dmg;
  p.hurt = 0.25;
  emit(s, 'hurt');
  float(s, p, `-${dmg}`, '#ff5a4d');
  // A patch seals a bad wound without being asked.
  if (p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
  if (p.hp <= 0) {
    p.hp = 0;
    s.status = 'dead';
    emit(s, 'dead');
    say(s, by === 'kupffer' ? 'The Kupffer cell engulfs and digests you.' : by === 'tcell' ? 'The killer T cell punches holes in the hull until there is no hull.' : 'The neutrophils dissolve you where you stand.');
  }
}

/** True once the immune cells have lost you for long enough that the alert is draining fast. */
export const losingThem = (s: State) => s.alert > 0 && s.unseen >= CONFIG.alert.loseAfter;

export function alertTier(s: State) {
  const tiers = CONFIG.alert.tiers;
  let tier: (typeof tiers)[number] = tiers[0];
  for (const t of tiers) if (s.alert >= t.from) tier = t;
  return tier;
}
function raiseAlert(s: State, by: number) {
  const before = alertTier(s).name;
  s.alert = Math.max(0, Math.min(CONFIG.alert.max, s.alert + by));
  s.peak = Math.max(s.peak, s.alert);
  const after = alertTier(s).name;
  if (by > 0 && after !== before) { say(s, `Immune alert: ${after}.`); emit(s, 'alarm'); }
}

/** Neutrophils ride in through portal vessels the player cannot see. */
function arrive(s: State, count: number) {
  for (let i = 0; i < count && s.enemies.length < CONFIG.alert.maxEnemies; i++) {
    const hidden = s.portals.filter((p) => !s.visible[idx(s, p.x, p.y)] && dist(mid(p), s.player) > 8);
    if (!hidden.length) return;
    hidden.sort((a, b) => dist(mid(a), s.player) - dist(mid(b), s.player));
    // Mostly from the nearer vessels, so a response shows up while it still matters.
    const e = spawn(s, 'neutrophil', hidden[Math.floor(s.rng() * Math.min(3, hidden.length))]);
    e.mood = 'investigate';
    e.goal = s.lastDamageSite ? { ...s.lastDamageSite } : tileOf(s.player);
    e.idle = 0;
  }
}

// ---------- one tick of the world ----------

/** Advance the game by dt seconds. `dir` is a walking direction held on the keyboard, if any. */
export function update(s: State, dt: number, dir: Point | null = null) {
  if (s.status !== 'playing' || s.offer) return;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  const p = s.player, pc = CONFIG.player;
  p.swingCd -= dt; p.shotCd -= dt; p.swing -= dt; p.hurt -= dt;
  s.snare = Math.max(0, s.snare - dt);
  const rode = riding(s);
  s.cloak = Math.max(0, s.cloak - dt); s.cloakCd = Math.max(0, s.cloakCd - dt);
  s.riding = Math.max(0, s.riding - dt); s.suppressed = Math.max(0, s.suppressed - dt);
  if (rode && !riding(s)) { s.riding = 0; emit(s, 'kill'); say(s, 'The neutrophil comes apart around you.'); }
  if (s.upgrades.clotting && p.hp < maxHp(s)) p.hp = Math.min(maxHp(s), p.hp + bonus(s, 'clotting') * dt);

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
  const tipsy = alcohol(s.host.hour);
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
    if ((along.x || along.y) && (p.x - from.x) * c.x + (p.y - from.y) * c.y < want * 0.6 && s.slam <= 0) {
      s.slam = CONFIG.host.slam.every;
      p.hp -= CONFIG.host.slam.damage; p.hurt = 0.25;
      float(s, p, `-${CONFIG.host.slam.damage}`, '#ff5a4d');
      emit(s, 'slam');
      if (p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
      if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; emit(s, 'dead'); say(s, 'The current dashes the ship against the vessel wall.'); return; }
    }
  }

  // The host's day goes on around you.
  const was = hostState(s), h = CONFIG.host;
  s.host.hour = (s.host.hour + dt / h.secondsPerHour) % 24;
  s.host.nap = Math.max(0, s.host.nap - dt / h.secondsPerHour);
  if (s.host.snack >= 0 && (s.host.hour - s.host.snack + 24) % 24 >= h.digestion) s.host.snack = -1;
  if (s.host.surge > 0) s.host.surge = Math.max(0, s.host.surge - dt);
  else if ((s.host.nextSurge -= dt * (was === 'awake' ? 1 + h.coffee.jumpy * caffeine(s.host.hour) : h.dreams)) <= 0) { // asleep, the frights are nightmares, and rarer
    s.host.surge = h.surge.time;
    s.host.nextSurge = h.surge.every[0] + s.rng() * (h.surge.every[1] - h.surge.every[0]);
  }
  if (s.place === 'lung' && breathingOut(s) !== s.host.out) { s.host.out = breathingOut(s); emit(s, s.host.out ? 'exhale' : 'inhale'); }
  const eating = digesting(s.host.hour, s.host.snack) > 0;
  if (eating && !s.host.eating) {
    say(s, `${outside(s, s.host.hour < 10 ? ['Breakfast: toast, eaten standing up.', 'Breakfast, and the news.', 'Cereal, straight from the box.'] : s.host.hour < 16 ? ['Lunch at the desk again.', 'A sandwich in the car.', 'Lunch with someone who talks a lot.'] : ['Dinner. Seconds.', 'Takeaway on the sofa.', 'Dinner, late, and too much of it.'])} ${s.place === 'stomach' ? 'The stomach floods with acid.' : 'Sugar will be pouring into the blood for a while.'}`);
    emit(s, 'meal');
  }
  s.host.eating = eating;
  const habit = alcohol(s.host.hour) > 0 ? 'drink' : caffeine(s.host.hour) > 0 ? 'coffee' : '';
  if (habit !== s.host.habit) {
    if (habit === 'coffee') { say(s, `${outside(s, ['The first coffee of the day.', 'Another coffee. A big one.', 'Coffee, black, too fast.'])} The blood runs quicker and the host is jumpy.`); emit(s, 'wake'); }
    if (habit === 'drink') { say(s, `${outside(s, ['A drink after work. Then another.', 'Somebody opened a bottle.', 'One for the road, they said.'])} Immune cells go sluggish, and the ship is hard to hold straight.`); emit(s, 'meal'); }
    s.host.habit = habit;
  }
  // Sleep is when the host mends.
  if (was === 'asleep' && s.hostHealth < h.maxHealth && (s.host.mend += dt) >= h.sleepHeals) { s.host.mend = 0; s.hostHealth++; }
  if (fever(s) !== s.host.fever) {
    say(s, fever(s) > s.host.fever ? `The host's temperature is climbing: ${h.fever.degrees[fever(s)]}\u00b0. Immune cells quicken.` : fever(s) ? 'The fever eases a little.' : 'The fever breaks.');
    if (fever(s) > s.host.fever) emit(s, 'fever');
    s.host.fever = fever(s);
  }
  const now = hostState(s);
  if (now !== was) {
    if (now === 'stressed') {
      s.host.nap = 0;
      say(s, `${was === 'asleep' ? outside(s, ['In the dream, they are falling.', 'A nightmare: their teeth are coming loose.', 'They dream of being chased, and their legs will not move.', 'In the dream there is an exam, and they never studied.', 'They dream of something small moving in their blood.']) : outside(s, ['A car horn, very close.', 'They missed a stair in the dark.', 'A phone rings at the wrong hour.', 'Someone said their name, sharply.', 'A dog, off its lead.', 'A door slammed somewhere in the house.'])} ${s.vessel === 'artery' ? 'The artery clenches and the blood tears through it.' : was === 'asleep' ? 'Their heart pounds, though they never wake.' : 'Their heart is pounding.'}`);
      emit(s, 'surge');
      // Adrenaline first, cortisol after: droplets of it turn up in the blood around you.
      for (let n = CONFIG.cortisol.drops, tries = 0; n > 0 && tries < 600; tries++) {
        const x = Math.floor(p.x + (s.rng() - 0.5) * 28), y = Math.floor(p.y + (s.rng() - 0.5) * 28), d = dist(p, { x, y });
        if (open(s, x, y) && d > 5 && d < 14 && s.acid?.[idx(s, x, y)] !== 2) { s.pickups.push({ x: x + 0.5, y: y + 0.5, kind: 'cortisol' }); n--; }
      }
      if (s.place === 'vessel') arrive(s, 1); // adrenaline shakes neutrophils loose into the blood
    } else if (was === 'stressed') say(s, 'The fright passes. The blood slows.');
    else if (now === 'asleep') { say(s, `${s.host.nap > 0 ? 'Their eyelids are heavy. A nap on the sofa.' : outside(s, ['Lights out.', 'They fell asleep with the television on.', 'Bed, finally.'])} The blood slows, and the immune system goes to work.`); emit(s, 'sleep'); }
    else { say(s, outside(s, ['An alarm clock. They hit snooze, but they are awake.', 'They wake before the alarm.', 'Awake, and not happy about it.'])); emit(s, 'wake'); }
  }

  // Footprints: one every stride, unless the cloak is hiding you. Old ones fade away.
  const stepped = dist(before, p);
  if (stepped > 0 && !cloaked(s) && acidAt(s, p) !== 2) {
    s.strideLeft -= stepped;
    if (s.strideLeft <= 0) { s.strideLeft = CONFIG.scent.stride; s.trail.push({ x: p.x, y: p.y, dx: p.face.x, dy: p.face.y, born: s.time }); }
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
    if (s.flora > 0) { s.flora = 0; say(s, 'The stowaways do not survive the acid. Few things do.'); }
    const lost = burnRate(s) * dt;
    p.hp -= lost; s.sizzle += lost;
    if (s.sizzle >= 1) { float(s, p, `-${Math.floor(s.sizzle)}`, '#c8f05a'); s.sizzle -= Math.floor(s.sizzle); p.hurt = 0.2; emit(s, 'burn'); }
    if (p.hp > 0 && p.hp <= maxHp(s) * CONFIG.items.autoPatchBelow) usePatch(s);
    if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; emit(s, 'dead'); say(s, 'The acid eats through the hull.'); return; }
  }

  for (const item of [...s.pickups]) {
    if (dist(item, p) > 0.75) continue;
    if (item.kind === 'patch') {
      if (s.patches >= CONFIG.items.maxPatches) continue;
      s.patches++;
      float(s, p, 'Fibrin patch', '#7be08a');
      emit(s, 'pickup');
    } else if (item.kind === 'cortisol') {
      s.suppressed = CONFIG.cortisol.time;
      float(s, p, 'Cortisol', '#ffd9a0');
      say(s, 'Cortisol. For a little while the immune system has orders to stand down.');
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
    if (enemyActs(s, e, dt)) seen = true;
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
  if (!seen) raiseAlert(s, -(losingThem(s) ? CONFIG.alert.shake : CONFIG.alert.decay) * dt);

  const en = CONFIG.energy;
  s.regen += dt * CONFIG.host.glucose[hostState(s)] * (1 + CONFIG.host.fedGlucose * digesting(s.host.hour, s.host.snack));
  if (s.regen >= en.patchRegen) {
    s.regen = 0;
    for (const [k, v] of s.glucose) if (v < en.patchMax) s.glucose.set(k, v + 1);
  }
  s.metabolism += dt * (1 + CONFIG.host.fever.burn * fever(s));
  if (s.metabolism >= en.metabolism) {
    s.metabolism = 0;
    if (p.energy > 0) p.energy--;
    else {
      say(s, 'You are running on empty and starting to break down.');
      hurtPlayer(s, en.starveDamage, 'neutrophil');
      if (s.status !== 'playing') return;
    }
  }
  const tier = alertTier(s);
  s.spawnClock = tier.spawnEvery ? s.spawnClock + dt : 0;
  if (tier.spawnEvery && s.spawnClock >= tier.spawnEvery) { s.spawnClock = 0; arrive(s, tier.spawnCount); }

  for (const f of s.floats) f.age += dt;
  s.floats = s.floats.filter((f) => f.age < 0.9);
}

/** One enemy's share of a tick. Returns true if it knows where the player is. */
function enemyActs(s: State, e: Enemy, dt: number): boolean {
  const base = CONFIG.enemies[e.kind], p = s.player;
  // In open vessels they ride the same current you do, and they are better at it.
  const hot = (1 + CONFIG.host.fever.speed * fever(s)) * (s.suppressed > 0 ? CONFIG.cortisol.slow : 1) * (1 - CONFIG.host.drink.immune * alcohol(s.host.hour));
  const c = s.place === 'vessel' ? { ...base, speed: base.speed * hot, chaseSpeed: base.chaseSpeed * CONFIG.vessel.chaseBoost * hot, cooldown: base.cooldown * CONFIG.vessel.cooldown } : { ...base, speed: base.speed * hot, chaseSpeed: base.chaseSpeed * hot };
  e.cooldown -= dt; e.repath -= dt; e.flash -= dt;
  if (acidAt(s, e) === 2) { // acid is no kinder to them
    e.hp -= CONFIG.stomach.enemyBurn * acidLevel(s) * dt; e.flash = 0.1;
    if (e.hp <= 0) { hurtEnemy(s, e, 0); return false; }
  }
  if ((e.sated ?? 0) > 0) { e.sated! -= dt; e.windup = -1; return false; } // busy digesting, or milling about where the meal was
  // Thrown bait: a real bacterium in the blood outranks a strange ship. Only T cells, which want you in particular, ignore it.
  const lure = e.kind === 'tcell' ? undefined : s.decoys.find((b) => dist(b, e) <= CONFIG.flora.lure);
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
  const through = cloaked(s) && e.kind === 'tcell' && d <= CONFIG.memory.tcellSight && sees(s, tileOf(e), tileOf(p));
  const whiff = through ? 1 : cloaked(s) ? 0 : scentAt(s, e, c.nose * CONFIG.host.nose[hostState(s)] * (s.suppressed > 0 ? CONFIG.cortisol.nose : 1));
  const found = through || (!cloaked(s) && (s.scent[idx(s, Math.floor(e.x), Math.floor(e.y))] <= CONFIG.scent.contact || (d <= CONFIG.scent.touch && sees(s, tileOf(e), tileOf(p)))));
  const print = cloaked(s) ? null : freshPrint(s, e);
  // Once it is after you, any trace of scent keeps it on you.
  const saw = found || (e.mood === 'chase' && whiff > 0);
  if (saw) {
    // The cloak answers a first sighting on its own, if it is ready and you can pay for it.
    if (e.mood !== 'chase' && e.kind !== 'tcell' && cloak(s)) {
      e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = CONFIG.cloak.confusion + s.rng();
      float(s, e, '?', '#78f0e1');
      return false;
    }
    // Failing that, a stowaway goes over the side.
    if (e.mood !== 'chase' && e.kind !== 'tcell' && bait(s)) return false;
    if (e.mood !== 'chase') { float(s, e, '!', '#ff5a4d'); emit(s, 'spot'); }
    e.mood = 'chase'; e.unseen = 0; e.goal = tileOf(p);
    raiseAlert(s, (e.kind === 'kupffer' ? CONFIG.alert.seenByKupffer : CONFIG.alert.seenByNeutrophil) * dt);
  } else {
    e.unseen += dt;
    const goTo = (t: Point) => { if (!e.goal || e.goal.x !== t.x || e.goal.y !== t.y) { e.goal = t; e.repath = Math.min(e.repath, 0.25); } };
    if (whiff > 0 && e.mood !== 'chase') {
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

  // A blow in progress lands or whiffs depending on whether you got out of the way.
  if (e.windup >= 0) {
    e.windup -= dt;
    if (e.windup < 0) {
      e.cooldown = c.cooldown;
      if (d <= c.reach + 0.35) hurtPlayer(s, roll(s, c.min, c.max), e.kind);
    }
    return saw;
  }
  if (saw && d <= c.reach && e.cooldown <= 0) { e.windup = c.windup; return saw; }

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
  } else follow(s, e, e.mood === 'patrol' ? c.speed : c.chaseSpeed, dt, c.radius);
  return saw;
}
