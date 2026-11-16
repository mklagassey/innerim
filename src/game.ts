// The rules of the liver prototype, simulated in real time. No drawing and no browser
// APIs in here, so the whole game can be run and tested from plain code.
import { CONFIG, UPGRADES, UpgradeId } from './config';
import { generate, generateVessel, mulberry32, Point } from './map';

export type { Point };
export type Tile = 'cell' | 'dead' | 'floor';
export type EnemyKind = 'neutrophil' | 'kupffer';
export type Mood = 'patrol' | 'investigate' | 'chase';

export interface Enemy extends Point {
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
export interface Pickup extends Point { kind: 'cache' | 'patch' | 'calm' }
export interface Channel { kind: 'skim' | 'strip'; t: number; total: number; x: number; y: number }

export interface State {
  place: Place;
  vessel: Vessel | null; // which kind of vessel, when you are in one
  host: { hour: number; surge: number; nextSurge: number }; // time of the host's day, seconds of fright left, seconds to the next
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
export interface Carry { hp: number; energy: number; upgrades: Record<UpgradeId, number>; patches: number; hostHealth: number; hour: number }
export const carryOf = (s: State): Carry => ({ hp: s.player.hp, energy: s.player.energy, upgrades: { ...s.upgrades }, patches: s.patches, hostHealth: s.hostHealth, hour: s.host.hour });
/** A liver is a place to feed. A vessel is a stretch of road with a patrol on it. */
export type Place = 'liver' | 'vessel';
export type Vessel = 'artery' | 'vein';
export type HostState = 'asleep' | 'awake' | 'stressed';

/** What the host is doing right now. A fright overrides everything, even sleep. */
export function hostState(s: State): HostState {
  const h = CONFIG.host;
  return s.host.surge > 0 ? 'stressed' : s.host.hour >= h.asleepFrom || s.host.hour < h.asleepUntil ? 'asleep' : 'awake';
}

export function createGame(seed = Date.now(), carry?: Carry, place: Place = 'liver', patrol = 3, vessel: Vessel = 'artery'): State {
  const m = place === 'vessel' ? generateVessel(seed, patrol) : generate(seed);
  const N = m.size;
  const s: State = {
    place,
    vessel: place === 'vessel' ? vessel : null,
    host: { hour: carry?.hour ?? CONFIG.host.startHour, surge: 0, nextSurge: 0 },
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
    upgrades: carry ? { ...carry.upgrades } : Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>,
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
  m.kupffer.forEach((p) => spawn(s, 'kupffer', p));
  m.neutrophils.forEach((p) => spawn(s, 'neutrophil', p));
  say(s, place === 'vessel' ? 'A patrol is working this vessel. Get to the far end.' : `Find ${CONFIG.energy.quota} energy, then find the central vein.`);
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
export const speed = (s: State) => CONFIG.player.speed * (1 + bonus(s, 'atp')) * (s.snare > 0 ? CONFIG.vessel.net.slow : 1);
export const cloakTime = (s: State) => CONFIG.cloak.base + bonus(s, 'cd47');
export const cloaked = (s: State) => s.cloak > 0;

/** 1 with no masking, down to 0.4 with a full CD47 coat. Scales the plume and the trail alike. */
export const scentScale = (s: State) => 1 - CONFIG.scent.maskPerLevel * s.upgrades.cd47;
/** Seconds one of your footprints lasts. */
export const trailLife = (s: State) => CONFIG.scent.trailLife * scentScale(s);

/** Which way the blood is running at a spot, as a unit vector (or nothing, in a still corner). */
export function currentAt(s: State, at: Point): Point {
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
  const where = s.vessel ?? 'liver';
  return CONFIG.host.current[where] * CONFIG.host.push[hostState(s)][where];
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
/** Show the 'do not eat me' signal: nothing can see you until it fades or you attack. */
export function cloak(s: State): boolean {
  if (s.status !== 'playing' || !s.upgrades.cd47 || s.cloakCd > 0 || s.player.energy < CONFIG.cloak.energy) return false;
  s.player.energy -= CONFIG.cloak.energy;
  s.cloak = cloakTime(s);
  s.cloakCd = CONFIG.cloak.cooldown + s.cloak;
  emit(s, 'cloak');
  // Anything hunting you loses the thread and stands there working out what it saw.
  for (const e of s.enemies) {
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
export function findPath(s: State, from: Point, to: Point, knownOnly = false): Point[] | null {
  const ok = (x: number, y: number) => open(s, x, y) && (!knownOnly || s.explored[idx(s, x, y)] === 1);
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
export const canLeave = (s: State) => atVein(s) && (s.place === 'vessel' || s.player.energy >= CONFIG.energy.quota);

/** The nearest living hepatocyte within arm's reach, if any. */
export function stripTarget(s: State): Point | null {
  if (s.place !== 'liver') return null; // vessel walls are not worth eating
  const p = tileOf(s.player);
  let best: Point | null = null, bestD: number = CONFIG.energy.strip.reach;
  for (let y = p.y - 1; y <= p.y + 1; y++)
    for (let x = p.x - 1; x <= p.x + 1; x++) {
      if (x < 2 || y < 2 || x >= s.size - 2 || y >= s.size - 2 || s.tiles[idx(s, x, y)] !== 'cell') continue;
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
  s.player.channel = { kind: 'strip', t: 0, total: CONFIG.energy.strip.time, ...cell };
  return true;
}
export function leave(s: State): boolean {
  if (s.status !== 'playing' || !canLeave(s)) return false;
  s.status = 'won';
  emit(s, 'win');
  if (s.place === 'liver') s.player.energy -= CONFIG.energy.quota; // the fare
  say(s, s.place === 'liver' ? 'You slip into the central vein and ride the current back toward the heart.' : 'The current takes you on.');
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
  const c = CONFIG.energy.strip;
  if (s.tiles[i] !== 'cell') return;
  s.tiles[i] = 'dead';
  s.flow = null; // a new gap for the blood to run through
  p.energy += c.gain;
  s.hostHealth = Math.max(0, s.hostHealth - c.hostDamage);
  s.cellsKilled++;
  s.lastDamageSite = { x: ch.x, y: ch.y };
  float(s, p, `+${c.gain} energy`, '#e8b530');
  emit(s, 'strip');
  say(s, 'The hepatocyte dies and leaks danger signals.');
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
  float(s, e, String(dmg), '#ffffff');
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
    say(s, by === 'kupffer' ? 'The Kupffer cell engulfs and digests you.' : 'The neutrophils dissolve you where you stand.');
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
  s.cloak = Math.max(0, s.cloak - dt); s.cloakCd = Math.max(0, s.cloakCd - dt);
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

  // A strong enough current drags you with it whether your engine is running or not.
  const pull = currentStrength(s) - CONFIG.host.driftAbove;
  if (pull > 0) { const c = currentAt(s, p); shift(s, p, c.x * pull * 2.4 * dt, c.y * pull * 2.4 * dt, pc.radius); }

  // The host's day goes on around you.
  const was = hostState(s), h = CONFIG.host;
  s.host.hour = (s.host.hour + dt / h.secondsPerHour) % 24;
  if (s.host.surge > 0) s.host.surge = Math.max(0, s.host.surge - dt);
  else if (was === 'awake' && (s.host.nextSurge -= dt) <= 0) {
    s.host.surge = h.surge.time;
    s.host.nextSurge = h.surge.every[0] + s.rng() * (h.surge.every[1] - h.surge.every[0]);
  }
  const now = hostState(s);
  if (now !== was) {
    if (now === 'stressed') {
      say(s, s.vessel === 'artery' ? 'Something has frightened the host. The artery clenches and the blood tears through it.' : 'Something has frightened the host. Their heart is pounding.');
      emit(s, 'surge');
      if (s.place === 'vessel') arrive(s, 1); // adrenaline shakes neutrophils loose into the blood
    } else if (was === 'stressed') say(s, 'The fright passes. The blood slows.');
    else if (now === 'asleep') { say(s, 'The host has fallen asleep. The blood slows, and the immune system goes to work.'); emit(s, 'sleep'); }
    else { say(s, 'The host is waking up.'); emit(s, 'wake'); }
  }

  // Footprints: one every stride, unless the cloak is hiding you. Old ones fade away.
  const stepped = dist(before, p);
  if (stepped > 0 && !cloaked(s)) {
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

  for (const item of [...s.pickups]) {
    if (dist(item, p) > 0.75) continue;
    if (item.kind === 'patch') {
      if (s.patches >= CONFIG.items.maxPatches) continue;
      s.patches++;
      float(s, p, 'Fibrin patch', '#7be08a');
      emit(s, 'pickup');
    } else if (item.kind === 'calm') {
      if (s.alert <= 0) continue; // nothing to soothe: leave it for later
      raiseAlert(s, -CONFIG.items.calmDrop);
      float(s, p, 'Interleukin-10', '#b9a4ff');
      say(s, `The tissue settles. Immune alert: ${alertTier(s).name}.`);
      emit(s, 'calm');
    } else openCache(s);
    s.pickups.splice(s.pickups.indexOf(item), 1);
  }

  for (const shot of [...s.shots]) {
    const step = Math.hypot(shot.vx, shot.vy) * dt;
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.left -= step;
    const hit = s.enemies.find((e) => dist(e, shot) < pc.shot.radius + CONFIG.enemies[e.kind].radius * 0.5);
    if (hit) hurtEnemy(s, hit, roll(s, pc.shot.min, pc.shot.max) + bonus(s, 'peroxidase'));
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
  s.regen += dt * CONFIG.host.glucose[hostState(s)];
  if (s.regen >= en.patchRegen) {
    s.regen = 0;
    for (const [k, v] of s.glucose) if (v < en.patchMax) s.glucose.set(k, v + 1);
  }
  s.metabolism += dt;
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
  const c = s.place === 'vessel' ? { ...base, chaseSpeed: base.chaseSpeed * CONFIG.vessel.chaseBoost, cooldown: base.cooldown * CONFIG.vessel.cooldown } : base;
  e.cooldown -= dt; e.repath -= dt; e.flash -= dt;
  const d = dist(e, p);
  // No eyes: it tastes the blood. Close in the plume, or simply close, and it has found you.
  const whiff = cloaked(s) ? 0 : scentAt(s, e, c.nose * CONFIG.host.nose[hostState(s)]);
  const found = !cloaked(s) && (s.scent[idx(s, Math.floor(e.x), Math.floor(e.y))] <= CONFIG.scent.contact || (d <= CONFIG.scent.touch && sees(s, tileOf(e), tileOf(p))));
  const print = cloaked(s) ? null : freshPrint(s, e);
  // Once it is after you, any trace of scent keeps it on you.
  const saw = found || (e.mood === 'chase' && whiff > 0);
  if (saw) {
    // The cloak answers a first sighting on its own, if it is ready and you can pay for it.
    if (e.mood !== 'chase' && cloak(s)) {
      e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = CONFIG.cloak.confusion + s.rng();
      float(s, e, '?', '#78f0e1');
      return false;
    }
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
    e.path = findPath(s, tileOf(e), e.goal) ?? [];
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
