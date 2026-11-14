// The rules of the liver prototype. No drawing and no browser APIs in here, so the
// whole game can be played and tested from plain code.
import { CONFIG } from './config';
import { KUPFFER_STARTS, LIVER_MAP, NEUTROPHIL_STARTS, START } from './map';

export type Tile = 'cell' | 'dead' | 'sinusoid' | 'portal' | 'vein';
export type EnemyKind = 'neutrophil' | 'kupffer';
export type Mood = 'patrol' | 'investigate' | 'chase';
export interface Point { x: number; y: number }

export interface Enemy extends Point {
  id: number;
  kind: EnemyKind;
  hp: number;
  mood: Mood;
  target: Point | null;
}

export interface State {
  width: number;
  height: number;
  tiles: Tile[][];
  glucose: Map<string, number>; // patch position -> units left
  portals: Point[];
  player: Point & { hp: number; ap: number; energy: number };
  enemies: Enemy[];
  hostHealth: number;
  alert: number;
  turn: number;
  cellsKilled: number;
  kills: number;
  lastDamageSite: Point | null;
  status: 'playing' | 'won' | 'dead';
  log: string[];
  rng: () => number;
  nextId: number;
}

export const key = (x: number, y: number) => `${x},${y}`;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roll = (s: State, min: number, max: number) => min + Math.floor(s.rng() * (max - min + 1));

export function createGame(seed = Date.now()): State {
  const tiles: Tile[][] = [];
  const glucose = new Map<string, number>();
  const portals: Point[] = [];
  LIVER_MAP.forEach((row, y) => {
    tiles.push(
      [...row].map((ch, x) => {
        if (ch === '#') return 'cell';
        if (ch === 'P') { portals.push({ x, y }); return 'portal'; }
        if (ch === 'V') return 'vein';
        if (ch === 'g') glucose.set(key(x, y), CONFIG.energy.patchMax);
        return 'sinusoid';
      }),
    );
  });
  const s: State = {
    width: LIVER_MAP[0].length,
    height: LIVER_MAP.length,
    tiles,
    glucose,
    portals,
    player: { ...START, hp: CONFIG.player.maxHp, ap: CONFIG.player.ap, energy: CONFIG.player.startEnergy },
    enemies: [],
    hostHealth: CONFIG.host.maxHealth,
    alert: 0,
    turn: 1,
    cellsKilled: 0,
    kills: 0,
    lastDamageSite: null,
    status: 'playing',
    log: [],
    rng: mulberry32(seed),
    nextId: 1,
  };
  KUPFFER_STARTS.forEach((p) => spawn(s, 'kupffer', p));
  NEUTROPHIL_STARTS.forEach((p) => spawn(s, 'neutrophil', p));
  say(s, `You ride the portal blood into the liver. Gather ${CONFIG.energy.quota} energy, then reach the central vein.`);
  return s;
}

function spawn(s: State, kind: EnemyKind, at: Point): Enemy {
  const e: Enemy = { id: s.nextId++, kind, x: at.x, y: at.y, hp: CONFIG.enemies[kind].hp, mood: 'patrol', target: null };
  s.enemies.push(e);
  return e;
}

function say(s: State, msg: string) {
  s.log.push(msg);
  if (s.log.length > 200) s.log.shift();
}

// ---------- queries ----------

export const inBounds = (s: State, x: number, y: number) => x >= 0 && y >= 0 && x < s.width && y < s.height;
export const walkable = (s: State, x: number, y: number) => inBounds(s, x, y) && s.tiles[y][x] !== 'cell';
export const enemyAt = (s: State, x: number, y: number) => s.enemies.find((e) => e.x === x && e.y === y);
const occupied = (s: State, x: number, y: number) => (s.player.x === x && s.player.y === y) || !!enemyAt(s, x, y);
const adjacent = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function alertTier(s: State) {
  const tiers = CONFIG.alert.tiers;
  let tier: (typeof tiers)[number] = tiers[0];
  for (const t of tiers) if (s.alert >= t.from) tier = t;
  return tier;
}

/** Straight line of sight: hepatocytes block it, everything else is open. */
export function lineOfSight(s: State, a: Point, b: Point): boolean {
  let { x, y } = a;
  const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== b.x || y !== b.y) && !walkable(s, x, y)) return false;
  }
  return true;
}

const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Shortest walking route, not counting the start tile. Other bodies block unless ignored. */
export function findPath(s: State, from: Point, to: Point, ignoreBodies = false): Point[] | null {
  if (!walkable(s, to.x, to.y)) return null;
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]]);
  const queue: Point[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) {
      const path: Point[] = [];
      let k: string | null = key(cur.x, cur.y);
      while (k && k !== key(from.x, from.y)) {
        const [px, py] = k.split(',').map(Number);
        path.unshift({ x: px, y: py });
        k = prev.get(k) ?? null;
      }
      return path;
    }
    for (const d of DIRS) {
      const nx = cur.x + d.x, ny = cur.y + d.y, nk = key(nx, ny);
      if (prev.has(nk) || !walkable(s, nx, ny)) continue;
      const isGoal = nx === to.x && ny === to.y;
      if (!ignoreBodies && !isGoal && occupied(s, nx, ny)) continue;
      prev.set(nk, key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

export const glucoseHere = (s: State) => s.glucose.get(key(s.player.x, s.player.y)) ?? 0;
export const canSkim = (s: State) => s.status === 'playing' && glucoseHere(s) > 0 && s.player.ap >= CONFIG.energy.skim.ap;

/** Living hepatocytes next to the player: the cells you could strip for mitochondria. */
export function strippable(s: State): Point[] {
  if (s.status !== 'playing' || s.player.ap < CONFIG.energy.strip.ap) return [];
  return DIRS.map((d) => ({ x: s.player.x + d.x, y: s.player.y + d.y })).filter(
    (p) => inBounds(s, p.x, p.y) && s.tiles[p.y][p.x] === 'cell',
  );
}

export function shotChance(s: State, e: Enemy): number {
  const c = CONFIG.player.shot;
  const d = distance(s.player, e);
  if (d > c.range || !lineOfSight(s, s.player, e)) return 0;
  return Math.max(0.1, c.hit - Math.max(0, d - c.falloffFrom) * c.falloffPerTile);
}

export const canLeave = (s: State) =>
  s.tiles[s.player.y][s.player.x] === 'vein' && s.player.energy >= CONFIG.energy.quota;

// ---------- player actions (each returns true if it happened) ----------

export function step(s: State, dx: number, dy: number): boolean {
  if (s.status !== 'playing' || s.player.ap < CONFIG.player.moveCost) return false;
  const x = s.player.x + dx, y = s.player.y + dy;
  if (!walkable(s, x, y) || enemyAt(s, x, y)) return false;
  s.player.x = x;
  s.player.y = y;
  s.player.ap -= CONFIG.player.moveCost;
  if (s.tiles[y][x] === 'vein' && s.player.energy < CONFIG.energy.quota) {
    say(s, `The central vein. You need ${CONFIG.energy.quota} energy to ride it out, and you have ${s.player.energy}.`);
  }
  return true;
}

export function attack(s: State, enemyId: number): boolean {
  const e = s.enemies.find((en) => en.id === enemyId);
  if (!e || s.status !== 'playing') return false;
  const melee = adjacent(s.player, e);
  const w = melee ? CONFIG.player.strike : CONFIG.player.shot;
  const chance = melee ? CONFIG.player.strike.hit : shotChance(s, e);
  if (s.player.ap < w.ap || chance === 0) return false;
  if (!melee) {
    if (s.player.energy < CONFIG.player.shot.energy) { say(s, 'No energy left to fire.'); return false; }
    s.player.energy -= CONFIG.player.shot.energy;
  }
  s.player.ap -= w.ap;
  const name = e.kind === 'kupffer' ? 'Kupffer cell' : 'neutrophil';
  if (s.rng() > chance) {
    say(s, `You ${melee ? 'swing at' : 'fire at'} the ${name} and miss.`);
  } else {
    const dmg = roll(s, w.min, w.max);
    e.hp -= dmg;
    if (e.hp <= 0) {
      s.enemies = s.enemies.filter((en) => en !== e);
      s.kills++;
      raiseAlert(s, CONFIG.alert.perKill);
      say(s, `You destroy the ${name}. Its spilled contents put the tissue on edge.`);
    } else {
      say(s, `You ${melee ? 'strike' : 'shoot'} the ${name} for ${dmg}.`);
    }
  }
  // Being attacked gets anyone's attention.
  if (e.hp > 0) { e.mood = 'chase'; e.target = { x: s.player.x, y: s.player.y }; }
  return true;
}

/** The slow, harmless way: sip glucose out of the blood where it runs rich. */
export function skim(s: State): boolean {
  if (!canSkim(s)) return false;
  const k = key(s.player.x, s.player.y);
  s.glucose.set(k, s.glucose.get(k)! - 1);
  s.player.ap -= CONFIG.energy.skim.ap;
  s.player.energy += CONFIG.energy.skim.gain;
  say(s, `You skim glucose from the blood. +${CONFIG.energy.skim.gain} energy.`);
  return true;
}

/** The fast, damaging way: tear the mitochondria out of a living host cell. */
export function strip(s: State, x: number, y: number): boolean {
  if (!strippable(s).some((p) => p.x === x && p.y === y)) return false;
  const c = CONFIG.energy.strip;
  s.tiles[y][x] = 'dead';
  s.player.ap -= c.ap;
  s.player.energy += c.gain;
  s.hostHealth = Math.max(0, s.hostHealth - c.hostDamage);
  s.cellsKilled++;
  s.lastDamageSite = { x, y };
  raiseAlert(s, c.alert);
  // A dying cell leaks danger signals, and every immune cell in the lobule homes in on them.
  for (const e of s.enemies) {
    if (e.mood !== 'chase') { e.mood = 'investigate'; e.target = { x, y }; }
  }
  say(s, `You strip the hepatocyte's mitochondria. +${c.gain} energy. The cell dies and leaks danger signals.`);
  // First responders answer every dead cell, and each new death brings a bigger wave.
  arrive(s, Math.min(s.cellsKilled, c.maxResponders));
  return true;
}

export function leave(s: State): boolean {
  if (s.status !== 'playing' || !canLeave(s)) return false;
  s.status = 'won';
  say(s, 'You slip into the central vein and ride the current back toward the heart.');
  return true;
}

function raiseAlert(s: State, by: number) {
  const before = alertTier(s).name;
  s.alert = Math.max(0, Math.min(CONFIG.alert.max, s.alert + by));
  const after = alertTier(s).name;
  if (by > 0 && after !== before) say(s, `Immune alert rises: ${after}.`);
}

// ---------- the world's turn ----------

export function endTurn(s: State): void {
  if (s.status !== 'playing') return;
  let seen = false;
  for (const e of [...s.enemies]) {
    if (s.status !== 'playing') break;
    if (enemyActs(s, e)) seen = true;
  }
  if (s.status !== 'playing') return;

  if (!seen) raiseAlert(s, -CONFIG.alert.decayPerTurn);
  s.turn++;

  const en = CONFIG.energy;
  if (s.turn % en.patchRegenEvery === 0) {
    for (const [k, v] of s.glucose) if (v < en.patchMax) s.glucose.set(k, v + 1);
  }
  if (s.turn % en.metabolismEvery === 0) {
    if (s.player.energy > 0) s.player.energy--;
    else {
      s.player.hp -= en.starveDamage;
      say(s, 'You are running on empty and starting to break down.');
      if (s.player.hp <= 0) { s.status = 'dead'; say(s, 'You starve, one more speck for the liver to clear.'); return; }
    }
  }

  const tier = alertTier(s);
  if (tier.spawnEvery && s.turn % tier.spawnEvery === 0) {
    arrive(s, tier.spawnCount);
  }
  s.player.ap = CONFIG.player.ap;
}

/** Neutrophils come in with the blood, through portals away from the player. */
function arrive(s: State, count: number) {
  let arrived = 0;
  for (let i = 0; i < count && s.enemies.length < CONFIG.alert.maxEnemies; i++) {
    const open = s.portals.filter((p) => !occupied(s, p.x, p.y) && distance(p, s.player) > 4);
    if (!open.length) break;
    const e = spawn(s, 'neutrophil', open[Math.floor(s.rng() * open.length)]);
    e.mood = 'investigate';
    e.target = s.lastDamageSite ?? { x: s.player.x, y: s.player.y };
    arrived++;
  }
  if (arrived) say(s, `${arrived} neutrophil${arrived > 1 ? 's pour' : ' pours'} in through the portal vessels.`);
}

/** One enemy's turn. Returns true if it could see the player at any point. */
function enemyActs(s: State, e: Enemy): boolean {
  const c = CONFIG.enemies[e.kind];
  const name = e.kind === 'kupffer' ? 'Kupffer cell' : 'neutrophil';
  let ap: number = c.ap;
  let saw = false;
  const look = () => {
    if (distance(e, s.player) <= c.sight && lineOfSight(s, e, s.player)) {
      if (e.mood !== 'chase') say(s, `A ${name} spots you.`);
      e.mood = 'chase';
      e.target = { x: s.player.x, y: s.player.y };
      saw = true;
    }
  };
  look();
  if (saw) raiseAlert(s, e.kind === 'kupffer' ? CONFIG.alert.seenByKupffer : CONFIG.alert.seenByNeutrophil);

  while (ap > 0) {
    if (adjacent(e, s.player)) {
      if (ap < c.attackAp) break;
      ap -= c.attackAp;
      if (s.rng() <= c.hit) {
        const dmg = roll(s, c.min, c.max);
        s.player.hp -= dmg;
        say(s, e.kind === 'kupffer' ? `The Kupffer cell tries to engulf you. -${dmg} HP.` : `A neutrophil sprays you with oxidants. -${dmg} HP.`);
        if (s.player.hp <= 0) {
          s.status = 'dead';
          say(s, 'You are engulfed and digested. The host never knew you were there.');
          return true;
        }
      } else say(s, `The ${name} lunges and misses.`);
      continue;
    }
    if (!e.target || (e.x === e.target.x && e.y === e.target.y)) {
      // Lost the trail or reached the spot: go back to wandering the sinusoids.
      e.mood = 'patrol';
      e.target = randomSinusoid(s);
    }
    const path = findPath(s, e, e.target) ?? findPath(s, e, e.target, true);
    const next = path?.[0];
    if (!next || occupied(s, next.x, next.y)) {
      if (!next) e.target = null;
      break;
    }
    e.x = next.x;
    e.y = next.y;
    ap--;
    look();
  }
  return saw;
}

function randomSinusoid(s: State): Point {
  for (;;) {
    const x = Math.floor(s.rng() * s.width), y = Math.floor(s.rng() * s.height);
    if (walkable(s, x, y)) return { x, y };
  }
}
