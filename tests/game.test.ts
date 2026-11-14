import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config';
import { generate } from '../src/map';
import * as G from '../src/game';

const quiet = (seed = 1) => { const s = G.createGame(seed); s.enemies = []; return s; };
const run = (s: G.State, seconds: number, dir: G.Point | null = null) => { for (let t = 0; t < seconds; t += 1 / 60) G.update(s, 1 / 60, dir); };
/** Stands the player on open tissue right beside a living hepatocyte. */
const besideCell = (s: G.State) => {
  for (let y = 6; y < s.size - 6; y++)
    for (let x = 6; x < s.size - 6; x++)
      if (G.open(s, x, y) && s.tiles[G.idx(s, x + 1, y)] === 'cell') return put(s, { x, y });
};
const put = (s: G.State, t: G.Point) => { s.player.x = t.x + 0.5; s.player.y = t.y + 0.5; G.look(s); };

test('every generated liver connects the start, the vein, the portals and the glucose', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = quiet(seed), m = generate(seed);
    const from = G.tileOf(s.player);
    for (const p of [m.vein, ...m.portals, ...m.glucose, ...m.kupffer, ...m.neutrophils])
      assert.ok(G.findPath(s, from, p), `seed ${seed}: cannot reach ${p.x},${p.y}`);
    assert.equal(m.glucose.length, CONFIG.map.glucosePatches);
  }
});

test('you only see what is around you, and remember where you have been', () => {
  const s = quiet(2);
  const seenAtStart = s.explored.reduce((a, b) => a + b, 0);
  assert.ok(seenAtStart > 5 && seenAtStart < 200);
  assert.equal(s.explored[G.idx(s, s.vein.x, s.vein.y)], 0, 'the vein starts hidden');
  G.moveTo(s, s.vein.x, s.vein.y);
  assert.ok(s.player.path.every((q) => s.explored[G.idx(s, q.x, q.y)] === 1), 'routes never run through unseen tissue');
  const there = G.tileOf(s.player);
  put(s, s.vein);
  assert.equal(s.visible[G.idx(s, there.x, there.y)], 0, 'the start is out of sight now');
  assert.equal(s.explored[G.idx(s, there.x, there.y)], 1, 'but still on the map');
});

test('walking slides along walls and never ends up inside a cell', () => {
  const s = quiet(3);
  for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }]) {
    run(s, 2, dir);
    assert.ok(G.open(s, Math.floor(s.player.x), Math.floor(s.player.y)));
  }
});

test('skimming is slow and harmless', () => {
  const s = quiet(4);
  const [k] = [...s.glucose.keys()];
  put(s, { x: k % s.size, y: Math.floor(k / s.size) });
  assert.equal(G.startSkim(s), true);
  run(s, CONFIG.energy.skim.time * CONFIG.energy.patchMax + 0.3);
  assert.equal(s.player.energy, CONFIG.player.startEnergy + CONFIG.energy.patchMax);
  assert.equal(s.hostHealth, 100);
  assert.equal(s.alert, 0);
  assert.equal(G.glucoseHere(s), 0);
});

test('stripping is fast, kills the cell, hurts the host and brings a response', () => {
  const s = quiet(5);
  besideCell(s);
  const cell = G.stripTarget(s);
  assert.ok(cell);
  assert.equal(G.startStrip(s), true);
  run(s, CONFIG.energy.strip.time + 0.1);
  assert.equal(s.player.energy, CONFIG.player.startEnergy + CONFIG.energy.strip.gain);
  assert.equal(s.hostHealth, 100 - CONFIG.energy.strip.hostDamage);
  assert.ok(s.alert >= CONFIG.energy.strip.alert - 1);
  assert.equal(s.tiles[G.idx(s, cell!.x, cell!.y)], 'dead');
  assert.ok(G.open(s, cell!.x, cell!.y), 'a dead cell opens a path');
  assert.equal(s.enemies.length, 1, 'a neutrophil answers the first dead cell');
  assert.equal(s.enemies[0].mood, 'investigate');
});

test('moving interrupts a harvest', () => {
  const s = quiet(5);
  besideCell(s);
  assert.equal(G.startStrip(s), true);
  run(s, 0.2, { x: -1, y: 0 });
  assert.equal(s.player.channel, null);
  assert.equal(s.cellsKilled, 0);
});

test('you leave only by the central vein with enough energy', () => {
  const s = quiet(6);
  put(s, s.vein);
  assert.equal(G.leave(s), false);
  s.player.energy = CONFIG.energy.quota;
  assert.equal(G.leave(s), true);
  assert.equal(s.status, 'won');
});

test('a neutrophil hunts you down and can kill you; a strike kills it first', () => {
  const s = quiet(7);
  const t = G.tileOf(s.player);
  s.enemies.push({ id: 9, kind: 'neutrophil', x: t.x + 0.5, y: t.y + 1.4, hp: 8, mood: 'patrol', goal: null, home: t, path: [], repath: 0, cooldown: 0, windup: -1, idle: 0, unseen: 99, flash: 0 });
  const fight = structuredClone({ ...s, rng: undefined }) as unknown as G.State;
  fight.rng = s.rng;
  s.player.hp = 3;
  run(s, 8);
  assert.equal(s.status, 'dead');
  G.attack(fight, 9);
  run(fight, 4);
  assert.equal(fight.enemies.length, 0);
  assert.equal(fight.kills, 1);
});

test('shots cost energy and stop at walls', () => {
  const s = quiet(8);
  assert.equal(G.shoot(s, s.player.x + 5, s.player.y), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy - 1);
  run(s, 2);
  assert.equal(s.shots.length, 0);
  s.player.energy = 0;
  assert.equal(G.shoot(s, s.player.x + 5, s.player.y), false);
});

test('a louder liver sends more neutrophils', () => {
  const count = (alert: number) => {
    const s = quiet(3);
    s.player.energy = 999;
    for (let t = 0; t < 40; t += 1 / 30) { s.alert = alert; G.update(s, 1 / 30); if (s.status !== 'playing') break; }
    return s.enemies.length + s.kills;
  };
  assert.equal(count(0), 0);
  assert.ok(count(30) > 0);
  assert.ok(count(90) > count(30));
});

test('a bot mashing buttons never breaks the game', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = G.createGame(seed);
    let dir: G.Point | null = null;
    for (let i = 0; i < 3000 && s.status === 'playing'; i++) {
      const r = s.rng();
      if (r < 0.02) dir = { x: Math.round(s.rng() * 2 - 1), y: Math.round(s.rng() * 2 - 1) };
      else if (r < 0.03) { dir = null; G.startStrip(s); }
      else if (r < 0.04) { dir = null; G.startSkim(s); }
      else if (r < 0.06) G.strike(s);
      else if (r < 0.07) G.shoot(s, s.player.x + s.rng() - 0.5, s.player.y + s.rng() - 0.5);
      else if (r < 0.08 && s.enemies[0]) G.attack(s, s.enemies[0].id);
      G.update(s, 1 / 30, dir);
      const p = s.player;
      assert.ok(Number.isFinite(p.x + p.y) && G.open(s, Math.floor(p.x), Math.floor(p.y)), 'player in open tissue');
      for (const e of s.enemies) assert.ok(G.open(s, Math.floor(e.x), Math.floor(e.y)), 'enemy in open tissue');
      assert.ok(s.alert >= 0 && s.alert <= 100 && p.energy >= 0);
    }
  }
});
