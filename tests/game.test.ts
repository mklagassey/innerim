import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config';
import { KUPFFER_STARTS, LIVER_MAP, NEUTROPHIL_STARTS, START } from '../src/map';
import * as G from '../src/game';

const quiet = (seed = 1) => {
  const s = G.createGame(seed);
  s.enemies = []; // most rule tests want an empty liver
  return s;
};

test('map is a rectangle and every open tile is reachable from the start', () => {
  const s = quiet();
  assert.ok(LIVER_MAP.every((r) => r.length === LIVER_MAP[0].length));
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++)
      if (G.walkable(s, x, y) && !(x === START.x && y === START.y))
        assert.ok(G.findPath(s, START, { x, y }), `unreachable ${x},${y}`);
  for (const p of [START, ...KUPFFER_STARTS, ...NEUTROPHIL_STARTS]) assert.ok(G.walkable(s, p.x, p.y), `start in wall ${p.x},${p.y}`);
  assert.equal(s.portals.length, 4);
  assert.equal(s.glucose.size, 5);
});

test('moving costs action points and hepatocytes block the way', () => {
  const s = quiet();
  assert.equal(G.step(s, 0, -1), false);
  assert.equal(G.step(s, 1, 0), true);
  assert.equal(s.player.ap, CONFIG.player.ap - 1);
});

test('skimming is slow and harmless', () => {
  const s = quiet();
  s.player.x = 10; s.player.y = 1;
  assert.equal(G.skim(s), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy + 1);
  assert.equal(s.hostHealth, 100);
  assert.equal(s.alert, 0);
  assert.equal(G.glucoseHere(s), CONFIG.energy.patchMax - 1);
});

test('stripping is fast, kills the cell, hurts the host and raises the alarm', () => {
  const s = G.createGame(1);
  const [cell] = G.strippable(s);
  assert.ok(cell);
  assert.equal(G.strip(s, cell.x, cell.y), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy + CONFIG.energy.strip.gain);
  assert.equal(s.hostHealth, 100 - CONFIG.energy.strip.hostDamage);
  assert.equal(s.alert, CONFIG.energy.strip.alert);
  assert.equal(s.tiles[cell.y][cell.x], 'dead');
  assert.ok(G.walkable(s, cell.x, cell.y), 'a dead cell opens a path');
  assert.ok(s.enemies.every((e) => e.mood === 'investigate' && e.target!.x === cell.x));
});

test('a louder liver sends more neutrophils', () => {
  const count = (alert: number) => {
    const s = quiet(3);
    s.player.energy = 99;
    for (let i = 0; i < 12; i++) { s.alert = alert; s.enemies = s.enemies.slice(0, 0).concat(s.enemies); G.endTurn(s); }
    return s.enemies.length + s.kills;
  };
  assert.equal(count(0), 0);
  assert.ok(count(30) > 0);
  assert.ok(count(90) > count(30));
});

test('you can only leave by the central vein with enough energy', () => {
  const s = quiet();
  s.player.x = 13; s.player.y = 7;
  assert.equal(G.leave(s), false);
  s.player.energy = CONFIG.energy.quota;
  assert.equal(G.leave(s), true);
  assert.equal(s.status, 'won');
});

test('an adjacent neutrophil hurts you and can kill you', () => {
  const s = quiet(5);
  s.enemies.push({ id: 99, kind: 'neutrophil', x: 2, y: 1, hp: 6, mood: 'patrol', target: null });
  s.player.hp = 1;
  for (let i = 0; i < 10 && s.status === 'playing'; i++) G.endTurn(s);
  assert.equal(s.status, 'dead');
});

test('shots need line of sight and spend energy', () => {
  const s = quiet(2);
  s.enemies.push({ id: 7, kind: 'neutrophil', x: 4, y: 1, hp: 6, mood: 'patrol', target: null });
  s.enemies.push({ id: 8, kind: 'neutrophil', x: 3, y: 3, hp: 6, mood: 'patrol', target: null });
  assert.ok(G.shotChance(s, s.enemies[0]) > 0);
  assert.equal(G.shotChance(s, s.enemies[1]), 0);
  assert.equal(G.attack(s, 7), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy - 1);
  assert.equal(G.attack(s, 8), false);
});

test('a bot playing randomly never breaks the game', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = G.createGame(seed);
    for (let i = 0; i < 400 && s.status === 'playing'; i++) {
      const r = s.rng();
      const cells = G.strippable(s);
      if (r < 0.1 && cells.length) G.strip(s, cells[0].x, cells[0].y);
      else if (r < 0.3) G.skim(s);
      else if (r < 0.5 && s.enemies[0]) G.attack(s, s.enemies[0].id);
      else if (r < 0.9) G.step(s, [1, -1, 0, 0][i % 4], [0, 0, 1, -1][i % 4]);
      else G.endTurn(s);
      if (s.player.ap === 0) G.endTurn(s);
      assert.ok(s.alert >= 0 && s.alert <= 100 && s.player.ap >= 0 && s.player.energy >= 0);
    }
  }
});
