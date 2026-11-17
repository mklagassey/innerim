import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, UPGRADES, UpgradeId } from '../src/config';
import { generate } from '../src/map';
import * as G from '../src/game';
import * as T from '../src/trip';
import { generateVessel } from '../src/map';

const quiet = (seed = 1) => { const s = G.createGame(seed); s.enemies = []; s.pickups = []; return s; };
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
  s.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep;
  assert.equal(G.leave(s), true);
  assert.equal(s.status, 'won');
});

test('a neutrophil hunts you down and can kill you; a strike kills it first', () => {
  const s = quiet(7);
  const t = G.tileOf(s.player);
  s.enemies.push({ id: 9, kind: 'neutrophil', x: t.x + 0.5, y: t.y + 1.4, hp: 8, mood: 'patrol', goal: null, home: t, path: [], repath: 0, cooldown: 0, windup: -1, idle: 0, unseen: 99, flash: 0, net: 9 });
  const fight = structuredClone({ ...s, rng: undefined }) as unknown as G.State;
  fight.rng = s.rng;
  s.player.hp = 3; s.patches = 0;
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
      if (s.offer) G.choose(s, s.offer[Math.floor(s.rng() * s.offer.length)]);
      if (r > 0.99) { G.usePatch(s); G.cloak(s); }
      G.update(s, 1 / 30, dir);
      const p = s.player;
      assert.ok(Number.isFinite(p.x + p.y) && G.open(s, Math.floor(p.x), Math.floor(p.y)), 'player in open tissue');
      for (const e of s.enemies) assert.ok(G.open(s, Math.floor(e.x), Math.floor(e.y)), 'enemy in open tissue');
      assert.ok(s.alert >= 0 && s.alert <= 100 && p.energy >= 0);
    }
  }
});

const foe = (s: G.State, dx: number, dy: number, kind: G.EnemyKind = 'neutrophil'): G.Enemy => {
  const e: G.Enemy = { id: s.nextId++, kind, x: s.player.x + dx, y: s.player.y + dy, hp: CONFIG.enemies[kind].hp, mood: 'patrol', goal: null, home: G.tileOf(s.player), path: [], repath: 0, cooldown: 0, windup: -1, idle: 0, unseen: 99, flash: 0, net: 9 };
  s.enemies.push(e);
  return e;
};

test('walking onto a cache pauses the world and offers three different upgrades', () => {
  const s = quiet(11);
  s.pickups.push({ x: s.player.x, y: s.player.y, kind: 'cache' });
  run(s, 0.1);
  assert.equal(s.offer?.length, 3);
  assert.equal(new Set(s.offer).size, 3);
  const t0 = s.time;
  run(s, 1);
  assert.equal(s.time, t0, 'nothing moves while you choose');
  const id = s.offer![0];
  assert.equal(G.choose(s, 'nope' as UpgradeId), false);
  assert.equal(G.choose(s, id), true);
  assert.equal(s.upgrades[id], 1);
  assert.equal(s.offer, null);
});

test('a maxed upgrade is never offered again', () => {
  const s = quiet(12);
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) s.upgrades[id] = UPGRADES[id].max;
  s.upgrades.atp = 0;
  s.pickups.push({ x: s.player.x, y: s.player.y, kind: 'cache' });
  run(s, 0.1);
  assert.deepEqual(s.offer, ['atp']);
});

test('upgrades change what the character can do', () => {
  const s = quiet(13);
  const base = { hp: G.maxHp(s), see: G.vision(s), run: G.speed(s) };
  s.upgrades.glycocalyx = 2; s.upgrades.retinol = 1; s.upgrades.atp = 3;
  assert.equal(G.maxHp(s), base.hp + 16);
  assert.equal(G.vision(s), base.see + 1.5);
  assert.ok(G.speed(s) > base.run * 1.25);
  s.upgrades.elastase = 3;
  const e = foe(s, 0.8, 0);
  G.strike(s, e);
  assert.equal(s.enemies.length, 0, 'three levels of elastase kill a neutrophil in one blow');
});

test('fibrin patches heal, up to full life', () => {
  const s = quiet(14);
  assert.equal(G.usePatch(s), false, 'no use at full life');
  s.player.hp = 10;
  assert.equal(G.usePatch(s), true);
  assert.equal(s.player.hp, 10 + CONFIG.items.patchHeal);
  assert.equal(s.patches, 0);
  assert.equal(G.usePatch(s), false);
});

test('the cloak hides you until it fades or you attack', () => {
  const s = quiet(15);
  assert.equal(G.cloak(s), false, 'needs the upgrade');
  s.upgrades.cd47 = 1;
  const e = foe(s, 1.5, 0);
  assert.equal(G.cloak(s), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy - CONFIG.cloak.energy);
  run(s, 2);
  assert.equal(e.mood, 'patrol', 'a neutrophil a step away does not notice');
  assert.equal(s.alert, 0);
  G.strike(s, e);
  assert.equal(G.cloaked(s), false);
  assert.equal(G.cloak(s), false, 'and it needs time to recover');
});

test('apoptosis mimic makes stripping quiet', () => {
  const loud = quiet(5), hush = quiet(5);
  hush.upgrades.apoptosis = 2;
  for (const s of [loud, hush]) { besideCell(s); G.startStrip(s); run(s, CONFIG.energy.strip.time + 0.1); }
  assert.ok(hush.alert < loud.alert - 10);
  assert.equal(loud.enemies.length, 1);
  assert.equal(hush.enemies.length, 0);
  assert.equal(hush.hostHealth, loud.hostHealth, 'the host pays the same either way');
});

test('a dead Kupffer cell leaves an upgrade behind', () => {
  const s = quiet(16);
  const k = foe(s, 0.9, 0, 'kupffer');
  k.hp = 1;
  G.strike(s, k);
  assert.equal(s.pickups.filter((i) => i.kind === 'cache').length, 1);
});

test('the cloak deploys by itself when you are first spotted, and confuses the hunter', () => {
  const s = quiet(21);
  s.upgrades.cd47 = 1;
  const e = foe(s, 1.1, 0);
  run(s, 0.6);
  assert.equal(G.cloaked(s), false, 'not at the first touch: it takes a moment to be sure');
  run(s, 0.75);
  assert.equal(G.cloaked(s), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy - CONFIG.cloak.energy);
  assert.equal(e.mood, 'patrol');
  assert.ok(e.idle > 1.5, 'it stands there confused');
  assert.equal(s.player.hp, G.maxHp(s));
  const plain = quiet(21);
  const e2 = foe(plain, 1.1, 0);
  run(plain, 1.4);
  assert.equal(e2.mood, 'chase', 'without the upgrade it just hunts you');
});

test('a fibrin patch applies itself when life runs low', () => {
  const s = quiet(22);
  s.player.hp = G.maxHp(s) * CONFIG.items.autoPatchBelow + 0.5; // any hit at all takes it under
  const e = foe(s, 0.6, 0);
  e.windup = 0.01;
  run(s, 0.1);
  assert.equal(s.patches, 0);
  assert.ok(s.player.hp > G.maxHp(s) * CONFIG.items.autoPatchBelow);
});

test('the alert drains slowly at first, then fast once you have been out of sight a while', () => {
  const s = G.createGame(7);
  s.enemies = [];
  s.alert = 24; // below the first tier, so no reinforcements arrive to spot you
  for (let i = 0; i < 60; i++) G.update(s, 0.05, { x: 0, y: 0 }); // 3 s
  assert.ok(!G.losingThem(s) && s.alert > 21, `slow at first: ${s.alert}`);
  for (let i = 0; i < 60; i++) G.update(s, 0.05, { x: 0, y: 0 }); // 3 s more, 2 of them past the threshold
  assert.ok(G.losingThem(s) && s.alert < 13, `fast later: ${s.alert}`);
});

test('interleukin-10 drops the alert, and waits for you when there is nothing to calm', () => {
  const s = G.createGame(7);
  s.enemies = [];
  s.pickups = [{ x: s.player.x, y: s.player.y, kind: 'calm' }];
  G.update(s, 0.05, { x: 0, y: 0 });
  assert.equal(s.pickups.length, 1, 'left alone at zero alert');
  s.alert = 60;
  G.update(s, 0.05, { x: 0, y: 0 });
  assert.equal(s.pickups.length, 0);
  assert.ok(s.alert < 31 && s.alert > 28, `alert ${s.alert}`);
});

// A straight corridor of floor from the vein outward, for testing the current.
function corridor() {
  const s = G.createGame(7);
  s.enemies = []; s.pickups = [];
  s.tiles.fill('cell');
  const y = s.vein.y;
  for (let x = s.vein.x; x <= s.vein.x + 30; x++) s.tiles[G.idx(s, x, y)] = 'floor';
  s.flow = null;
  s.player.x = s.vein.x + 15.5; s.player.y = y + 0.5; s.player.path = [];
  return s;
}

test('scent carries far downstream and hardly at all upstream', () => {
  const s = corridor(), y = s.player.y;
  G.update(s, 0.05);
  assert.ok(G.scentAt(s, { x: s.player.x - 6, y }) > 0, 'six tiles toward the vein smells of you');
  assert.equal(G.scentAt(s, { x: s.player.x + 6, y }), 0, 'six tiles upstream does not');
  assert.ok(G.scentAt(s, { x: s.player.x + 2, y }) > 0, 'right behind you does');
});

test('a cell downstream comes to investigate; one upstream at the same distance does not', () => {
  for (const [side, expected] of [[-6, 'investigate'], [6, 'patrol']] as const) {
    const s = corridor();
    const e = G.createGame(7).enemies.find((x) => x.kind === 'neutrophil')!;
    e.x = s.player.x + side; e.y = s.player.y; e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = 99;
    s.enemies = [e];
    run(s, 0.5);
    assert.equal(e.mood, expected, `side ${side}`);
  }
});

test('a cell that crosses your footprints follows them to you', () => {
  const s = corridor(), y = s.player.y;
  // Walk upstream, leaving a trail behind (downstream of where you end up, but too far to smell directly).
  s.upgrades.cd47 = 0;
  run(s, 2.6, { x: 1, y: 0 });
  assert.ok(s.trail.length >= 8, `prints laid: ${s.trail.length}`);
  s.scent.fill(Infinity); s.scentClock = 1e9; // judge the footprints alone
  const e = G.createGame(7).enemies.find((x) => x.kind === 'neutrophil')!;
  e.x = s.trail[0].x; e.y = y; e.mood = 'patrol'; e.goal = null; e.path = []; e.idle = 99;
  s.enemies = [e];
  const from = G.dist(e, s.player);
  run(s, 1.5);
  assert.ok(G.dist(e, s.player) < from - 2, `closed from ${from.toFixed(1)} to ${G.dist(e, s.player).toFixed(1)}`);
});

test('CD47 shortens both the plume and the trail', () => {
  const s = corridor(), y = s.player.y;
  G.update(s, 0.05);
  const plain = G.scentAt(s, { x: s.player.x - 6, y }), life = G.trailLife(s);
  s.upgrades.cd47 = 3; s.scentClock = 0;
  G.update(s, 0.05);
  assert.ok(plain > 0 && G.scentAt(s, { x: s.player.x - 6, y }) === 0);
  assert.ok(G.trailLife(s) < life * 0.5);
});

test('a character and the host carry over into the next map', () => {
  const a = G.createGame(5);
  a.upgrades.glycocalyx = 2; a.player.hp = 33; a.patches = 3; a.hostHealth = 70;
  const b = G.createGame(6, G.carryOf(a));
  assert.equal(b.upgrades.glycocalyx, 2);
  assert.equal(b.player.hp, 33);
  assert.equal(b.patches, 3);
  assert.equal(b.hostHealth, 70);
  assert.equal(b.player.energy, a.player.energy, 'what energy you have left comes too');
  b.upgrades.glycocalyx = 3;
  assert.equal(a.upgrades.glycocalyx, 2, 'the two maps do not share one build object');
});

test('every vessel map runs unbroken from where you enter to where you leave', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const patrol = 3 + (seed % 4), m = generateVessel(seed, patrol);
    assert.equal(m.neutrophils.length, patrol, `seed ${seed} patrol`);
    const s = G.createGame(seed, undefined, 'vessel', patrol);
    s.explored.fill(1);
    assert.ok(G.findPath(s, m.start, m.vein), `seed ${seed} has a way through`);
    for (const p of [...m.glucose, ...m.patches, ...m.neutrophils]) assert.ok(G.open(s, p.x, p.y), `seed ${seed} item on open floor`);
    assert.ok(G.dist(m.start, m.vein) > 50);
  }
});

test('a vessel lets you leave without paying, and has nothing to strip', () => {
  const s = G.createGame(3, undefined, 'vessel', 3);
  s.enemies = [];
  assert.equal(G.stripTarget(s), null);
  s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; s.player.energy = 1;
  assert.ok(G.leave(s));
  assert.equal(s.status, 'won');
  assert.equal(s.player.energy, 1);
});

test('leaving the liver costs the fare, and the change comes with you', () => {
  const s = G.createGame(3);
  s.enemies = [];
  s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; s.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep + 3;
  assert.ok(G.leave(s));
  assert.equal(G.carryOf(s).energy, CONFIG.energy.quotaKeep + 3);
});

test('the circulation runs one way: out by an artery, home by the veins', () => {
  const t = T.newTrip(1);
  assert.deepEqual(T.ways(t).map((l) => l.to).sort(), ['gastric', 'hepatic', 'mesenteric']);
  assert.equal(T.depart(t, 'liver'), null, 'no jumping straight to the liver');
  T.arrive(t, 'hepatic', null);
  assert.deepEqual(T.depart(t, 'liver'), { kind: 'arrive' }, 'the last step into the liver is never patrolled');
  T.arrive(t, 'liver', null);
  assert.deepEqual(T.depart(t, 'hvein'), { kind: 'liver' });
  assert.equal(T.arrive(t, 'hvein', null, 80), false);
  assert.ok(t.fed && t.heat === 0.8);
  const hot = T.riskOf(t, T.LEGS.find((l) => l.from === 'hvein')!);
  assert.ok(hot > 0.6, 'an alarm in the liver follows you down the vein');
  T.arrive(t, 'cava', null);
  assert.equal(T.arrive(t, 'heart', null), true, 'home: one trip done');
  assert.equal(t.trip, 2);
  assert.equal(t.heat, 0);
});

test('patrols turn up about as often as the map says, and grow with each trip', () => {
  let met = 0;
  for (let seed = 1; seed <= 400; seed++) { const t = T.newTrip(seed); if (T.depart(t, 'hepatic')!.kind === 'patrol') met++; }
  assert.ok(met > 280 && met < 360, `hepatic artery patrols: ${met}/400`);
  const t = T.newTrip(2); t.rng = () => 0;
  const first = T.depart(t, 'hepatic') as { size: number };
  t.trip = 3;
  assert.ok((T.depart(t, 'hepatic') as { size: number }).size > first.size);
});

test('on the road a neutrophil nets you from a distance, and the net slows you', () => {
  const s = G.createGame(4, undefined, 'vessel', 1);
  const e = s.enemies[0];
  s.player.x = e.x - 3; s.player.y = e.y; s.player.path = [];
  e.mood = 'chase'; e.net = 0; e.cooldown = 9;
  const fast = G.speed(s);
  run(s, 0.3);
  assert.ok(s.snare > 0, 'snared');
  assert.ok(G.speed(s) < fast * 0.5);
  run(s, 2);
  assert.equal(s.snare, 0, 'it wears off');
  const liver = quiet(4); const f = foe(liver, 3, 0); f.mood = 'chase'; f.net = 0;
  run(liver, 0.5);
  assert.equal(liver.snare, 0, 'tissue neutrophils do not throw nets');
});

test('the host keeps a day: awake, asleep at night, and frightened now and then', () => {
  const s = quiet(3);
  assert.equal(G.hostState(s), 'awake');
  s.host.nextSurge = 0.5;
  run(s, 1);
  assert.equal(G.hostState(s), 'stressed');
  assert.ok(s.host.nextSurge > 60, 'the next fright is a good while off');
  run(s, CONFIG.host.surge.time + 1);
  assert.equal(G.hostState(s), 'awake', 'a fright passes');
  s.host.hour = CONFIG.host.asleepFrom - 0.01; s.host.nextSurge = 999;
  run(s, 1);
  assert.equal(G.hostState(s), 'asleep');
  s.host.nextSurge = 1;
  run(s, 1.5);
  assert.equal(G.hostState(s), 'asleep', 'frights come slower in sleep');
  run(s, 1.5);
  assert.equal(G.hostState(s), 'stressed', 'but a nightmare will do it');
  assert.match(s.log[s.log.length - 1].text, /dream|nightmare/i);
  const next = G.createGame(5, G.carryOf(s), 'vessel', 0, 'vein');
  assert.ok(Math.abs(next.host.hour - s.host.hour) < 1e-9, 'the clock carries from map to map');
});

test('a fright makes an artery far rougher than a vein, and drags a drifting ship along', () => {
  const artery = G.createGame(7, undefined, 'vessel', 0, 'artery'), vein = G.createGame(7, undefined, 'vessel', 0, 'vein');
  const calmA = G.currentStrength(artery), calmV = G.currentStrength(vein);
  assert.ok(calmA > calmV, 'arteries run faster than veins');
  artery.host.surge = 20; vein.host.surge = 20;
  assert.ok(G.currentStrength(artery) / calmA > G.currentStrength(vein) / calmV, 'and a fright hits them harder');
  assert.ok(G.currentStrength(vein) <= CONFIG.host.driftAbove, 'a vein never sweeps you away');
  const from = { x: artery.player.x, y: artery.player.y };
  const c = G.currentAt(artery, artery.player);
  assert.ok(Math.hypot(c.x, c.y) > 0.9, 'there is a current where you start');
  artery.host.nextSurge = 999; artery.enemies = [];
  run(artery, 1.5);
  const moved = { x: artery.player.x - from.x, y: artery.player.y - from.y };
  assert.ok(Math.hypot(moved.x, moved.y) > 0.5, 'engines off, the ship still moves');
  const calm = G.createGame(7, undefined, 'vessel', 0, 'artery'); calm.host.nextSurge = 999;
  run(calm, 1.5);
  assert.ok(G.dist(calm.player, from) < 0.01, 'a calm artery leaves a still ship where it is');
});

test('a frightened host floods the blood with sugar', () => {
  const calm = quiet(2), scared = quiet(2);
  calm.host.nextSurge = 999; scared.host.surge = 999;
  run(calm, 3); run(scared, 3);
  assert.ok(scared.regen > calm.regen * 3 || scared.pickups.length > calm.pickups.length);
});

test('meals: the gut is busy for a few hours after each one, and sugar comes back faster', () => {
  assert.equal(G.digesting(11), 0);
  assert.ok(G.digesting(12.6) > 0.9);
  assert.ok(G.digesting(14) > 0.4 && G.digesting(14) < 0.6);
  assert.equal(G.digesting(16), 0);
  const s = quiet(2); s.host.nextSurge = 999; s.host.hour = 12.49;
  run(s, 1);
  assert.ok(s.events.includes('meal') || s.host.eating, 'the meal is announced');
  const fasting = quiet(2); fasting.host.nextSurge = 999; fasting.host.hour = 9.9; // well clear of breakfast
  fasting.host.hour = 16;
  run(fasting, 3); const a = fasting.regen;
  const fed = quiet(2); fed.host.nextSurge = 999; fed.host.hour = 12.6;
  run(fed, 3);
  assert.ok(fed.regen > a * 2);
});

test('the stomach: acid eats the hull, mucus is safe and slow, and the way through exists', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = G.createGame(seed, undefined, 'stomach');
    assert.ok(s.acid, 'there is acid');
    assert.ok(G.findPath(s, G.tileOf(s.player), s.vein), `seed ${seed}: the vein can be reached`);
    assert.ok(s.rich.size >= 8, 'parietal cells to strip');
    assert.equal(G.acidAt(s, s.player), 0, 'you arrive on dry ground');
    for (const e of s.enemies) assert.equal(G.acidAt(s, e), 0);
  }
  const s = G.createGame(3, undefined, 'stomach'); s.enemies = []; s.host.nextSurge = 999;
  const N = s.size, tile = (kind: number) => { const i = s.acid!.indexOf(kind); return { x: (i % N) + 0.5, y: Math.floor(i / N) + 0.5 }; };
  s.host.hour = 16; // empty stomach
  Object.assign(s.player, tile(2), { path: [] });
  run(s, 2);
  const resting = 40 - s.player.hp;
  assert.ok(resting > 1 && resting < 4, `resting acid costs a little: ${resting}`);
  assert.equal(s.trail.length, 0, 'no wake in acid');
  s.player.hp = 40; s.host.hour = 12.6; s.host.acid = G.digesting(12.6); // just eaten, and the acid has come up
  run(s, 2);
  assert.ok(40 - s.player.hp > resting * 3, 'acid after a meal is far worse');
  s.upgrades.mucin = 3; const before = s.player.hp;
  run(s, 1);
  assert.ok(before - s.player.hp < 1, 'a mucin coat shrugs most of it off');
  const slow = G.createGame(3, undefined, 'stomach');
  const fast = G.speed(slow);
  Object.assign(slow.player, tile(1));
  assert.ok(G.speed(slow) < fast * 0.6, 'mucus slows you');
  const hp = slow.player.hp; slow.enemies = [];
  run(slow, 1);
  assert.equal(slow.player.hp, hp, 'and does not burn');
});

test('the stomach: only parietal cells are worth stripping, and immune cells dissolve in acid', () => {
  const s = G.createGame(5, undefined, 'stomach'); s.enemies = []; s.host.nextSurge = 999;
  const N = s.size, k = [...s.rich][0], cell = { x: k % N, y: Math.floor(k / N) };
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy })).find((p) => G.open(s, p.x, p.y))!;
  Object.assign(s.player, { x: side.x + 0.5, y: side.y + 0.5, path: [] });
  const energy = s.player.energy, host = s.hostHealth;
  assert.ok(G.startStrip(s));
  run(s, 1.2);
  assert.equal(s.player.energy, energy + CONFIG.stomach.parietal.gain);
  assert.equal(s.hostHealth, host - CONFIG.stomach.parietal.hostDamage);
  assert.equal(G.leave(s), false, 'not at the vein yet');
  Object.assign(s.player, { x: s.vein.x + 0.5, y: s.vein.y + 0.5 });
  assert.ok(G.canLeave(s), 'no fare to leave the stomach');
  const t = G.createGame(5, undefined, 'stomach'); t.host.nextSurge = 999; t.host.hour = 12.6; t.host.acid = 1;
  const i = t.acid!.indexOf(2), e = t.enemies[0];
  t.enemies = [e]; e.x = (i % N) + 0.5; e.y = Math.floor(i / N) + 0.5;
  Object.assign(t.player, { x: 5, y: 5 });
  run(t, 3);
  assert.equal(t.enemies.length, 0, 'the acid got it');
});

test('the stomach is a detour on the way to the liver', () => {
  const t = T.newTrip(1); t.rng = () => 0.99;
  assert.deepEqual(T.depart(t, 'gastric'), { kind: 'arrive' });
  T.arrive(t, 'gastric', null);
  T.arrive(t, 'stomach', null);
  assert.deepEqual(T.depart(t, 'portal'), { kind: 'stomach' });
  T.arrive(t, 'portal', null);
  assert.equal(t.fed, false, 'the stomach does not count as feeding');
  assert.deepEqual(T.ways(t).map((l) => l.to), ['liver']);
});

test('the host remembers: alarms on one map mean antibodies on the next', () => {
  const a = quiet(4);
  assert.equal(a.antibodies.length, 0, 'a host that has never met you has none');
  assert.equal(G.carryOf(a).memory, 0, 'and a quiet visit teaches it nothing');
  a.peak = 100; a.kills = 4;
  const carry = G.carryOf(a);
  assert.ok(carry.memory > 0.15 && carry.memory < 0.2);
  const b = G.createGame(9, carry);
  assert.ok(b.antibodies.length >= 2, `antibodies waiting: ${b.antibodies.length}`);
  assert.ok(b.antibodies.every((x) => G.dist(x, b.player) > 9), 'none on top of you at the start');
  assert.equal(G.createGame(9, carry, 'stomach').antibodies.length, 0, 'acid takes them apart');
  assert.ok(G.createGame(9, { ...carry, memory: 1 }).antibodies.length > b.antibodies.length);
});

test('an antibody that sticks makes you reek, blocks the cloak, and wears off', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.upgrades.cd47 = 1; s.player.energy = 10;
  const calm = G.scentScale(s);
  s.antibodies.push({ x: s.player.x + 0.3, y: s.player.y, seed: 1 });
  run(s, 0.1);
  assert.ok(s.tagged > 0 && s.antibodies.length === 0);
  assert.ok(G.scentScale(s) > calm * 1.5);
  assert.equal(G.cloak(s), false, 'no cloak while tagged');
  run(s, CONFIG.memory.tagTime + 0.5);
  assert.equal(s.tagged, 0);
  assert.equal(G.scentScale(s), calm);
  s.antibodies.push({ x: s.player.x + 0.9, y: s.player.y, seed: 1 });
  G.strike(s);
  assert.equal(s.antibodies.length, 0, 'a strike clears them');
});

test('hurt the host and they run a fever; sleep mends them', () => {
  const s = quiet(6); s.host.nextSurge = 999;
  assert.equal(G.fever(s), 0);
  s.hostHealth = 55; s.excised = CONFIG.tumor.goal; // tumor out, so nothing but the fever is in play
  assert.equal(G.fever(s), 2);
  const cool = quiet(6); cool.host.nextSurge = 999;
  cool.player.energy = 10; s.player.energy = 10;
  run(cool, 30); run(s, 30);
  assert.ok(s.player.energy < cool.player.energy, 'a fever burns your energy faster');
  assert.equal(s.hostHealth, 55, 'no mending by day');
  s.host.hour = 1;
  run(s, CONFIG.host.sleepHeals * 3 + 0.5);
  assert.equal(s.hostHealth, 58, 'sleep mends');
  const hot = G.createGame(6, { ...G.carryOf(s), hostHealth: 30 });
  assert.equal(G.fever(hot), 3, 'and it follows you from map to map');
});

test('the fire button picks the nearest immune cell in view', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.player.energy = 5;
  assert.equal(G.canShootNearest(s), false);
  const f = foe(s, 3, 0);
  G.look(s);
  assert.ok(G.canShootNearest(s));
  assert.ok(G.shootNearest(s));
  assert.equal(s.player.energy, 4);
  run(s, 0.5);
  assert.ok(f.hp < CONFIG.enemies[f.kind].hp, 'and hits it');
});

test('the tumor: every liver has a nodule, and cutting it out helps the host and counts toward the mission', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = G.createGame(seed);
    assert.ok(g.tumor.size >= CONFIG.tumor.cells - 2, `seed ${seed}: nodule of ${g.tumor.size}`);
    for (const k of g.tumor) assert.equal(g.tiles[k], 'cell');
  }
  assert.equal(G.createGame(3, undefined, 'vessel').tumor.size, 0);
  const s = quiet(5); s.host.nextSurge = 999; s.hostHealth = 70;
  const N = s.size;
  const k = [...s.tumor].find((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G.open(s, (t % N) + dx, Math.floor(t / N) + dy)))!;
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: (k % N) + dx, y: Math.floor(k / N) + dy })).find((p) => G.open(s, p.x, p.y))!;
  Object.assign(s.player, { x: side.x + 0.5, y: side.y + 0.5, path: [] });
  // Stand so that the tumor cell is the nearest one.
  s.player.x += ((k % N) - side.x) * 0.2; s.player.y += (Math.floor(k / N) - side.y) * 0.2;
  const target = G.stripTarget(s)!;
  assert.ok(s.tumor.has(target.y * N + target.x), 'the tumor cell is in reach');
  const energy = s.player.energy, left = s.tumor.size;
  assert.ok(G.startStrip(s));
  run(s, CONFIG.tumor.time + 0.2);
  assert.equal(s.tumor.size, left - 1);
  assert.equal(s.excised, 1);
  assert.equal(s.hostHealth, 70, 'cutting it out stops the loss; it does not heal on the spot');
  assert.equal(s.player.energy, energy + CONFIG.tumor.gain);
  assert.equal(s.cellsKilled, 0, 'and it does not count as harm');
  assert.ok(s.alert < 10, 'hardly any alarm');
  assert.equal(G.createGame(8, G.carryOf(s)).excised, 1, 'progress carries from map to map');
});

test('the long way round goes through the gut', () => {
  const t = T.newTrip(1); t.rng = () => 0.99;
  T.arrive(t, 'mesenteric', null);
  assert.deepEqual(T.ways(t).map((l) => l.to), ['gut']);
  T.arrive(t, 'gut', null);
  assert.deepEqual(T.depart(t, 'portal'), { kind: 'arrive' }, 'no patrols among the flora');
});

test('killer T cells come once the host knows you, and see through the cloak up close', () => {
  const carry = (memory: number) => ({ ...G.carryOf(quiet(2)), memory });
  const count = (g: G.State) => g.enemies.filter((e) => e.kind === 'tcell').length;
  assert.equal(count(G.createGame(3, carry(0.3))), 0);
  assert.equal(count(G.createGame(3, carry(0.6))), 1);
  assert.equal(count(G.createGame(3, carry(0.9))), 2);
  assert.equal(count(G.createGame(3, carry(0.9), 'stomach')), 0);
  const s = quiet(4); s.host.nextSurge = 999; s.upgrades.cd47 = 1; s.player.energy = 10;
  const t = foe(s, 1, 0, 'tcell'), n = foe(s, -2, 0);
  t.mood = 'chase'; n.mood = 'chase'; t.cooldown = 9;
  assert.ok(G.open(s, Math.floor(t.x), Math.floor(t.y)) && G.open(s, Math.floor(n.x), Math.floor(n.y)));
  assert.ok(G.cloak(s));
  assert.equal(n.mood, 'patrol', 'the neutrophil loses you');
  assert.equal(t.mood, 'chase', 'the T cell does not');
  const far = G.dist(t, s.player);
  run(s, 0.4);
  assert.ok(G.dist(t, s.player) < far, 'and it keeps coming');
});

test('a frightened artery throws a drifting ship against its walls, but not to death', () => {
  let lost = 0;
  for (const seed of [1, 2, 3, 4]) {
    const s = G.createGame(seed, undefined, 'vessel', 0, 'artery'); s.host.nextSurge = 999; s.host.surge = 15;
    run(s, 15);
    assert.equal(s.status, 'playing');
    lost += 40 - s.player.hp;
    const v = G.createGame(seed, undefined, 'vessel', 0, 'vein'); v.host.nextSurge = 999; v.host.surge = 15;
    run(v, 15);
    assert.equal(v.player.hp, 40, 'a vein never does');
  }
  assert.ok(lost / 4 > 3 && lost / 4 < 24, `average hull lost drifting: ${lost / 4}`);
});

test('the lungs open only when the tumor is out, and breathing pushes both ways', () => {
  const t = T.newTrip(1);
  assert.ok(!T.ways(t).some((l) => l.to === 'lungs'));
  t.carry = { ...G.carryOf(quiet(2)), excised: CONFIG.tumor.goal };
  assert.ok(T.ways(t).some((l) => l.to === 'lungs'));
  assert.deepEqual(T.depart(t, 'lungs'), { kind: 'lung' });
  const s = G.createGame(3, undefined, 'lung'); s.host.nextSurge = 999;
  assert.equal(s.enemies.filter((e) => e.kind === 'kupffer').length, CONFIG.lung.macrophages);
  assert.equal(s.enemies.filter((e) => e.kind === 'neutrophil').length, 0);
  s.enemies = [];
  const period = CONFIG.host.breath.awake, x0 = s.player.x;
  assert.equal(G.breathingOut(s), false, 'a breath in comes first');
  const inward = G.currentAt(s, { x: s.player.x + 6, y: s.player.y });
  run(s, period / 2 + 0.1);
  assert.ok(G.breathingOut(s));
  const outward = G.currentAt(s, { x: x0 + 6, y: s.player.y });
  assert.ok(inward.x * outward.x + inward.y * outward.y < -0.9, 'the current turns round with the breath');
  const x1 = s.player.x;
  run(s, period / 2 - 0.2);
  assert.ok(s.player.x > x1 + 1, `a breath out carries an idle ship toward the exit: ${x0} ${x1} ${s.player.x}`);
});

test('boarding: a wounded neutrophil can be worn, and the rest lose you', () => {
  const s = quiet(4); s.host.nextSurge = 999;
  const a = foe(s, 1, 0), b = foe(s, -2, 0);
  assert.equal(G.boardTarget(s), null, 'a healthy one will not have you');
  assert.equal(G.board(s), false);
  a.hp = 3; b.mood = 'chase';
  assert.equal(G.boardTarget(s), a);
  assert.ok(G.board(s));
  assert.equal(s.enemies.length, 1);
  assert.ok(G.riding(s) && G.cloaked(s));
  assert.equal(b.mood, 'patrol', 'its friend loses you');
  assert.ok(G.speed(s) < CONFIG.player.speed);
  assert.equal(s.kills, 0, 'and nobody counts it as a kill');
  run(s, 1);
  assert.equal(s.trail.length, 0, 'no wake from inside');
  G.strike(s);
  assert.equal(G.riding(s), false, 'striking tears it open');
  const t = quiet(4); t.host.nextSurge = 999; foe(t, 1, 0).hp = 2;
  G.board(t); t.enemies = [];
  run(t, CONFIG.board.time + 0.5);
  assert.equal(G.riding(t), false, 'it does not last');
});

test('cortisol: a fright leaves droplets, and one makes the immune system sluggish', () => {
  const s = quiet(4); s.host.nextSurge = 0.1;
  run(s, 0.5);
  const drops = s.pickups.filter((i) => i.kind === 'cortisol');
  assert.equal(drops.length, CONFIG.cortisol.drops);
  s.pickups = [{ x: s.player.x, y: s.player.y, kind: 'cortisol' }];
  run(s, 0.1);
  assert.ok(s.suppressed > CONFIG.cortisol.time - 1);
  const calm = quiet(4); calm.host.nextSurge = 999; calm.host.surge = 0;
  s.host.surge = 0; s.pickups = [];
  const far = (g: G.State) => { const e = foe(g, 2, 0); e.mood = 'chase'; e.cooldown = 99; g.player.x -= 0; return e; };
  const slow = far(s), quick = far(calm);
  // Both run from the same spot toward a player who steps away.
  for (const g of [s, calm]) { g.player.x += 0; }
  s.player.hp = calm.player.hp = 999;
  const sx = slow.x, qx = quick.x;
  for (let i = 0; i < 30; i++) { G.update(s, 1 / 60, { x: -1, y: 0 }); G.update(calm, 1 / 60, { x: -1, y: 0 }); }
  assert.ok(Math.abs(slow.x - sx) + Math.abs(slow.y - (s.player.y)) >= 0);
  assert.ok(G.dist(slow, { x: sx, y: slow.y }) < G.dist(quick, { x: qx, y: quick.y }) + 1e-9, 'the dosed one covers less ground');
});

test('habits: coffee quickens the blood, a drink fades in the evening', () => {
  assert.equal(G.caffeine(7), 0);
  assert.ok(G.caffeine(8.1) > 0.9 && G.caffeine(10) < G.caffeine(8.1));
  assert.equal(G.alcohol(12), 0);
  assert.ok(G.alcohol(21) > 0);
  const a = G.createGame(4, undefined, 'vessel'), b = G.createGame(4, undefined, 'vessel');
  a.host.hour = 8.2; b.host.hour = 11.5;
  assert.ok(G.currentStrength(a) > G.currentStrength(b));
});

test('levers: a nap puts the host to sleep until a fright, a snack starts digestion', () => {
  const s = quiet(4); s.host.hour = 14; s.host.nextSurge = 999; s.host.nap = 2;
  assert.equal(G.hostState(s), 'asleep');
  assert.equal(G.carryOf(s).nap, 2);
  s.host.nextSurge = 0; s.host.nap = 0; run(s, 0.1); s.host.nap = 2; run(s, 0.1);
  assert.equal(G.hostState(s), 'stressed');
  assert.equal(G.digesting(16), 0);
  assert.ok(G.digesting(16.2, 16) > 0.9);
  const t = quiet(4); t.host.hour = 16; t.host.snack = 16; t.host.nextSurge = 999;
  assert.equal(G.carryOf(t).snack, 16);
  run(t, 1);
  assert.ok(t.host.eating);
});

test('stowaways: a gut bacterium goes overboard when you are found, and the innate cells take it', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.flora = 2;
  const e = foe(s, 1.2, 0), health = s.hostHealth;
  run(s, 1.4);
  assert.equal(s.flora, 1);
  assert.ok(s.decoys.length <= 1); // it may already have been engulfed
  assert.equal(s.hostHealth, health - CONFIG.flora.hostDamage, 'the host pays');
  assert.notEqual(e.mood, 'chase');
  const hp = s.player.hp;
  run(s, 3);
  assert.equal(s.decoys.length, 0, 'it gets eaten');
  assert.equal(s.player.hp, hp, 'and you are left alone while they digest');
  assert.equal(G.carryOf(s).flora, 1);
  const t = quiet(4); t.host.nextSurge = 999; t.flora = 1;
  const k = foe(t, 1.1, 0, 'tcell');
  run(t, 1.4);
  assert.equal(t.flora, 1, 'a T cell is after you, not bacteria');
  assert.equal(k.mood, 'chase');
});

test('story: the unit wakes by noticing things, once per map, and its voice changes', async () => {
  const Story = await import('../src/story');
  const s = quiet(4); s.host.nextSurge = 999;
  assert.equal(G.stage(s), 0);
  assert.equal(s.thoughts[0].who, 'shepherd');
  assert.equal(s.thoughts[1].text, Story.LINES.liver[0]);
  const a = s.aware;
  G.notice(s, 'strip'); G.notice(s, 'strip');
  assert.equal(s.aware, a + Story.GAIN.strip, 'the second time is nothing new');
  assert.equal(s.thoughts[2].text, Story.LINES.strip[0]);
  assert.ok(s.thoughts[2].t >= s.thoughts[1].t + CONFIG.story.gap, 'one thought at a time');
  s.aware = Story.STAGES[2].from - 1; const sight = G.vision(s);
  G.notice(s, 'kill');
  assert.equal(G.stage(s), 2);
  assert.equal(G.vision(s), sight + CONFIG.story.sight);
  assert.ok(s.thoughts.some((t) => t.text === Story.WAKING[2]) && s.thoughts.some((t) => t.who === 'shepherd' && /self-test/.test(t.text)));
  assert.equal(G.carryOf(s).aware, s.aware);
  const next = G.createGame(5, { ...G.carryOf(s), aware: 90 }, 'vessel');
  assert.ok(next.thoughts.every((t) => t.who === 'unit'), 'Shepherd cannot hear a unit that far gone');
  for (const [k, v] of Object.entries(Story.LINES)) assert.equal(v.length, 5, k);
  assert.match(Story.ending('stay', 90, 2, 90).title, /colony/);
  assert.equal(Story.ending('breath', 0, 0, 90).title, 'Decommissioned');
});

test('story: a dark sibling can be salvaged, woken or left, and waking needs a mind', () => {
  const s = quiet(4); s.host.nextSurge = 999;
  const put = () => { const it: G.Pickup = { x: s.player.x, y: s.player.y, kind: 'sibling' }; s.pickups = [it]; run(s, 0.1); return it; };
  put();
  assert.ok(s.ask, 'the world waits for an answer');
  const t = s.time; run(s, 1); assert.equal(s.time, t);
  assert.equal(G.answer(s, 'wake'), false, 'a dormant unit cannot think of it');
  assert.ok(G.answer(s, 'leave'));
  run(s, 0.5);
  assert.equal(s.ask, null, 'it does not ask again while you sit on it');
  s.aware = 40; s.player.energy = 5; s.pickups = [];
  put();
  assert.ok(G.answer(s, 'wake'));
  assert.equal(s.kin, 1); assert.equal(s.player.energy, 5 - CONFIG.story.sibling.wake); assert.equal(s.pickups.length, 0);
  put(); const e = s.player.energy;
  assert.ok(G.answer(s, 'salvage'));
  assert.equal(s.player.energy, e + CONFIG.story.sibling.energy);
  const next = G.createGame(6, G.carryOf(s), 'vessel');
  const friend = next.pickups.find((i) => i.kind === 'kin');
  assert.ok(friend, 'the one you woke is waiting further on');
  next.enemies = []; next.player.x = friend!.x; next.player.y = friend!.y; const had = next.player.energy;
  run(next, 0.1);
  assert.equal(next.player.energy, had + CONFIG.story.kin.gift);
});

test('story: wardens come for a woken unit, hunt by sight alone, and can be made to stop', () => {
  const calm = G.createGame(4, { ...G.carryOf(quiet(4)), aware: 0 });
  assert.equal(calm.enemies.filter((e) => e.kind === 'warden').length, 0);
  const hunted = G.createGame(4, { ...G.carryOf(quiet(4)), aware: 60 });
  assert.equal(hunted.enemies.filter((e) => e.kind === 'warden').length, 1);
  const s = quiet(4); s.host.nextSurge = 999; s.aware = 60; s.cloak = 5;
  const w = foe(s, 2, 0, 'warden'), alert = s.alert;
  run(s, 0.2);
  assert.equal(w.mood, 'chase', 'the cloak means nothing to a machine');
  assert.equal(s.alert, alert, 'and the immune system is none the wiser');
  assert.ok(s.noticed.has('warden'));
  const far = quiet(4); far.host.nextSurge = 999; far.scent.fill(0);
  const blind = foe(far, 2, 0, 'warden'); far.riding = 5; far.cloak = 5;
  run(far, 0.3);
  assert.notEqual(blind.mood, 'chase', 'a borrowed body hides you, and it cannot smell');
  w.hp = CONFIG.enemies.warden.hp; s.player.attackId = null;
  s.player.hp = 999;
  while (s.enemies.includes(w) && s.time < 30) { s.player.swingCd = 0; G.strike(s, w); run(s, 0.05); }
  assert.ok(!s.enemies.includes(w));
  assert.ok(s.pickups.some((i) => i.kind === 'sibling'), 'it goes dark instead of dying');
  assert.equal(s.kills, 0);
});

test('story: leaving the liver without harvesting defies Shepherd, and meeting the quota is rewarded', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep;
  s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5;
  const a = s.aware;
  assert.ok(G.leave(s));
  assert.equal(s.verdict, 'defied');
  assert.equal(s.aware, a + CONFIG.story.defy);
  assert.equal(G.carryOf(s).defied, 1);
  const o = quiet(4); o.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep; o.player.x = o.vein.x + 0.5; o.player.y = o.vein.y + 0.5; o.cellsKilled = CONFIG.story.quota;
  const patches = o.patches;
  assert.ok(G.leave(o));
  assert.equal(o.verdict, 'obeyed');
  assert.equal(o.patches, patches + 1);
});

test('unit-3: the stomach has food on the mucus rim, acid eases up, and a full-strength bath takes 8 s to kill', async () => {
  const { generateStomach } = await import('../src/map');
  for (const seed of [1, 2, 3, 4, 5]) {
    const m = generateStomach(seed);
    assert.ok(m.glucose.filter((g) => m.acid![g.y * m.size + g.x] === 1).length >= 2, `rim glucose, seed ${seed}`);
  }
  assert.ok(CONFIG.player.maxHp / CONFIG.stomach.burn >= 8);
  const s = G.createGame(3, undefined, 'stomach'); s.enemies = []; s.host.nextSurge = 999;
  s.host.hour = CONFIG.host.meals[1] - 0.01;
  const before = G.acidLevel(s);
  run(s, 2);
  assert.ok(G.digesting(s.host.hour) > 0.9, 'lunch has landed');
  assert.ok(G.acidLevel(s) < before + 0.2, 'but the acid is only starting to rise');
  run(s, CONFIG.stomach.rise);
  assert.ok(G.acidLevel(s) > before + 0.3, 'and a rise-time later it is well up');
  const w = G.createGame(3, undefined, 'stomach'); w.enemies = []; w.host.nextSurge = 999; w.host.hour = CONFIG.host.meals[1] - 0.5;
  run(w, 0.2);
  assert.ok(w.log.some((l) => /reaching for food/.test(l.text)), 'a warning before the meal');
});

test('unit-3: reinforcements never head for the player tile, slams are capped per fright, and the vein wants a reserve', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.alert = CONFIG.alert.max;
  run(s, 20);
  const here = { x: Math.floor(s.player.x), y: Math.floor(s.player.y) };
  assert.ok(s.enemies.length > 0, 'they did come');
  assert.ok(s.enemies.every((e) => e.mood !== 'investigate' || !e.goal || e.goal.x !== here.x || e.goal.y !== here.y));
  assert.ok(CONFIG.host.slam.perFright <= 6 && CONFIG.host.slam.damage === 1);
  const v = G.createGame(7, undefined, 'vessel', 0, 'artery'); v.enemies = []; v.antibodies = []; v.host.nextSurge = 0.1;
  const hp = v.player.hp; v.player.energy = 99;
  run(v, CONFIG.host.surge.time - 1);
  assert.ok(hp - v.player.hp <= CONFIG.host.slam.perFright, `one fright cost ${hp - v.player.hp} hull`);
  const l = quiet(4); l.player.x = l.vein.x + 0.5; l.player.y = l.vein.y + 0.5; l.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep - 1;
  assert.equal(G.canLeave(l), false);
  l.player.energy++;
  assert.ok(G.canLeave(l));
});

test('unit-4: the hunt is an area; inside it the alert holds, outside it drains, and arrivals go into it but never to you', () => {
  const s = quiet(4); s.host.nextSurge = 999; s.alert = 40; s.scent.fill(999);
  const e = foe(s, 1, 0); run(s, 1.4);
  assert.ok(s.search, 'contact marks the spot');
  s.enemies = []; s.trail = [];
  const held = s.alert;
  run(s, 3);
  assert.ok(s.search!.r > CONFIG.alert.search.start + 1.5, 'the hunt spreads');
  assert.ok(G.inSearch(s));
  assert.equal(s.alert, held, 'and the alert holds while you sit in it');
  assert.ok(s.zoneTime > 2.5);
  s.search!.x += 40; // as good as far away
  assert.equal(G.inSearch(s), false);
  run(s, CONFIG.alert.loseAfter + 2);
  assert.ok(s.alert < held - 5, 'outside, they lose heart');
  run(s, 30);
  assert.equal(s.alert, 0); assert.equal(s.search, null, 'and in the end they stop looking');
  void e;
});

test('the tumor costs the host by the hour until it is all out', () => {
  const s = quiet(6); s.host.nextSurge = 999; s.host.hour = 12; s.player.energy = 30;
  const h0 = s.hostHealth;
  run(s, CONFIG.host.secondsPerHour * 2 + 0.5);
  assert.equal(s.hostHealth, h0 - 2 * CONFIG.tumor.drain);
  assert.equal(G.tumorDrain(CONFIG.tumor.goal / 2), CONFIG.tumor.drain / 2, 'half the tumor, half the cost');
  s.excised = CONFIG.tumor.goal;
  run(s, CONFIG.host.secondsPerHour + 0.5);
  assert.equal(s.hostHealth, h0 - 2 * CONFIG.tumor.drain, 'and stops once it is gone');
});

test('clotting waits a moment after a hit before it mends', () => {
  const s = quiet(6); s.host.nextSurge = 999; s.player.energy = 30;
  s.upgrades.clotting = 1; s.player.hp = 10; s.sinceHurt = 0;
  run(s, CONFIG.energy.clotPause - 0.5);
  assert.equal(s.player.hp, 10, 'nothing yet');
  run(s, 5.5);
  assert.ok(Math.abs(s.player.hp - (10 + 5 * 0.15)) < 0.05, 'then 0.15 a second');
});

test('the first liver cache always offers the cloak, once', () => {
  for (const seed of [11, 12, 13, 14, 15]) {
    const s = quiet(seed);
    s.pickups.push({ x: s.player.x, y: s.player.y, kind: 'cache' });
    run(s, 0.1);
    assert.ok(s.offer?.includes('cd47'), 'seed ' + seed);
    assert.equal(new Set(s.offer).size, 3);
    assert.equal(G.carryOf(s).cloakOffered, true);
    assert.equal(G.createGame(seed + 1, G.carryOf(s)).cloakOffered, true, 'and the next map remembers');
  }
});

test('the tumor takes its share on the road between maps too', () => {
  const c = G.carryOf(quiet(6));
  const h0 = c.hostHealth;
  G.tumorToll(c, 0.25);
  assert.equal(c.hostHealth, h0, 'a quarter hour is half a point, kept for later');
  G.tumorToll(c, 0.25);
  assert.equal(c.hostHealth, h0 - 1);
  assert.equal(G.createGame(7, { ...c, drained: 0.75 }).drained, 0.75, 'and the fraction follows you into the next map');
  c.excised = CONFIG.tumor.goal;
  G.tumorToll(c, 5);
  assert.equal(c.hostHealth, h0 - 1);
});

test('the ledger keeps plain counts of how the host was treated, across maps', () => {
  const s = quiet(6); s.host.nextSurge = 999;
  besideCell(s); s.player.energy = 0;
  G.startStrip(s); run(s, CONFIG.energy.strip.time + 0.2);
  assert.equal(s.ledger.stripped, 1);
  assert.equal(s.ledger.hostLowest, s.hostHealth);
  s.flora = 1; G.bait(s);
  assert.equal(s.ledger.baitReleased, 1);
  const c = G.carryOf(s);
  c.hostHealth = 70; G.leverPulled(c); c.hostHealth = 95; G.leverPulled(c);
  assert.deepEqual([c.ledger!.leversForHer, c.ledger!.leversForMe], [1, 1]);
  const next = G.createGame(7, c);
  assert.equal(next.ledger.stripped, 1, 'and it follows the unit');
  const w = G.stewardship(next.ledger, 4);
  assert.equal(w.harm, 10 + 2 + (100 - next.ledger.hostLowest));
  assert.equal(w.care, 8 + 5);
});

test('a click across the stomach walks round the acid when there is a dry way', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = G.createGame(seed, undefined, 'stomach');
    s.explored.fill(1);
    assert.ok(G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5));
    const wet = s.player.path.filter((t) => s.acid![G.idx(s, t.x, t.y)] === 2).length;
    assert.equal(wet, 0, 'seed ' + seed + ' wades through ' + wet + ' acid tiles');
    const end = s.player.path[s.player.path.length - 1];
    assert.ok(G.dist({ x: end.x + 0.5, y: end.y + 0.5 }, { x: s.vein.x + 0.5, y: s.vein.y + 0.5 }) < 1, 'and still gets there');
  }
});

test('beside a tumor cell and a healthy one, the tumor is what gets cut', () => {
  const s = quiet(6);
  besideCell(s);
  const p = { x: Math.floor(s.player.x), y: Math.floor(s.player.y) };
  // A healthy cell sits right beside us at x+1; make a diagonal neighbour tumor, which is further away.
  const far = G.idx(s, p.x + 1, p.y + 1);
  s.tiles[far] = 'cell'; s.tumor.add(far);
  s.player.x = p.x + 0.8; s.player.y = p.y + 0.6;
  const t = G.stripTarget(s)!;
  assert.ok(s.tumor.has(G.idx(s, t.x, t.y)), 'picked the tumor cell');
});

test('in the fog, repeated clicks on the stomach exit get there without wading', () => {
  for (const seed of [1, 4, 10]) {
    const s = G.createGame(seed, undefined, 'stomach'); s.enemies = []; s.host.nextSurge = 999; s.player.energy = 99;
    let wet = 0;
    while (s.status === 'playing' && s.time < 120) {
      if (G.canLeave(s)) { G.leave(s); break; }
      if (!s.player.path.length) G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5);
      if (G.acidAt(s, s.player) === 2) wet++;
      G.update(s, 1 / 30);
    }
    assert.equal(s.status, 'won', 'seed ' + seed + ' reaches the vein');
    assert.ok(wet <= 3, 'seed ' + seed + ' stays dry bar a clipped corner, was ' + wet + ' frames');
  }
});

test('unit-8 stealth: a cell needs a moment of contact to be sure, and running silent sheds less', () => {
  const s = quiet(21); s.host.nextSurge = 999;
  const e = foe(s, 1.1, 0);
  run(s, 0.6);
  assert.ok(e.onto! > 0.3 && e.onto! < 1, 'the ring is filling');
  assert.notEqual(e.mood, 'chase');
  s.scent.fill(999); e.x += 6; // out of contact before it is sure
  run(s, 0.1);
  assert.equal(e.onto, 0, 'and it drops when contact is lost');
  const loud = G.scentAt(s, { x: s.player.x + 2, y: s.player.y }), pace = G.speed(s);
  s.silent = true;
  assert.equal(G.speed(s), pace * CONFIG.scent.silent.speed);
  assert.ok(G.scentAt(s, { x: s.player.x + 2, y: s.player.y }) <= loud);
  s.enemies = []; s.trail = [];
  run(s, 2, { x: 1, y: 0 });
  assert.equal(s.trail.length, 0, 'no footprints while silent');
});

test('unit-8 stealth: an unaware cell takes a first strike three times as hard, and a quiet map teaches nothing', () => {
  const s = quiet(21); s.host.nextSurge = 999; s.scent.fill(999);
  const e = foe(s, 0.8, 0); e.nosed = 99; e.mood = 'patrol';
  const hp = e.hp;
  G.strike(s, e);
  const lost = hp - Math.max(0, e.hp);
  assert.ok(lost >= Math.min(hp, CONFIG.player.strike.min * 3), 'lost ' + lost);
  assert.equal(s.tally.firstStrikes, 1);
  const q = quiet(4); q.peak = 20; q.kills = 3; q.memory = 0.2;
  assert.equal(G.memoryAfter(q), 0.2);
  q.peak = 40;
  assert.ok(G.memoryAfter(q) > 0.2);
});

test('unit-8 fights: a macrophage that lands a blow holds you until you strike it twice', () => {
  const s = quiet(21); s.host.nextSurge = 999; s.scent.fill(999);
  const k = foe(s, 0.8, 0); k.kind = 'kupffer'; k.hp = 999;
  s.held = { id: k.id, t: CONFIG.fight.hold.time, hits: 0 };
  const at = { x: s.player.x, y: s.player.y }, hp = s.player.hp;
  run(s, 0.5, { x: -1, y: 0 });
  assert.ok(G.dist(at, s.player) < 0.05, 'cannot move');
  assert.ok(s.player.hp < hp, 'and it is digesting you');
  G.strike(s, k); s.player.swingCd = 0; G.strike(s, k);
  assert.equal(s.held, null, 'two strikes break free');
});

test('unit-8 fights: a kill draws the neighbours and difficulty scales the enemy', () => {
  const s = quiet(21); s.host.nextSurge = 999; s.scent.fill(999);
  const a = foe(s, 0.8, 0), b = foe(s, 5, 0);
  a.hp = 1; a.mood = 'chase';
  G.strike(s, a);
  assert.equal(s.enemies.includes(a), false);
  assert.equal(b.mood, 'investigate', 'the neighbour comes to look');
  const hard = G.createGame(21, { ...G.carryOf(s), difficulty: 'vigilant' });
  const easy = G.createGame(21, { ...G.carryOf(s), difficulty: 'suppressed' });
  const hpOf = (g: G.State) => g.enemies.find((e) => e.kind === 'neutrophil')!.hp;
  assert.ok(hpOf(hard) > hpOf(easy));
  assert.equal(G.hard(hard).autoPatch, false);
});
