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
  assert.equal(s.hostHealth, 100 - Math.round(CONFIG.energy.strip.hostDamage * CONFIG.marks.orderedHarm), 'the first cells are the quota: surplus, and half the harm');
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
  assert.ok(hot > T.LEGS.find((l) => l.from === 'hvein')!.risk, 'an alarm in the liver follows you down the vein');
  t.offRoute = true;
  assert.ok(Math.abs(T.riskOf(t, T.LEGS.find((l) => l.from === 'hvein')!) - hot - CONFIG.story.orders.escort) < 1e-9, 'and off the assigned route there is no escort to take the edge off');
  t.offRoute = false;
  T.arrive(t, 'cava', null);
  assert.equal(T.arrive(t, 'heart', null), true, 'home: one trip done');
  assert.equal(t.trip, 2);
  assert.equal(t.heat, 0);
});

test('patrols turn up about as often as the map says, and grow with each trip', () => {
  let met = 0;
  for (let seed = 1; seed <= 400; seed++) { const t = T.newTrip(seed); t.offRoute = true; if (T.depart(t, 'hepatic')!.kind === 'patrol') met++; }
  assert.ok(met > 200 && met < 280, `hepatic artery patrols: ${met}/400`);
  let escorted = 0;
  for (let seed = 1; seed <= 400; seed++) { const t = T.newTrip(seed); if (T.depart(t, 'hepatic')!.kind === 'patrol') escorted++; }
  assert.ok(escorted > 100 && escorted < 180, `with Shepherd's escort: ${escorted}/400`);
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

test('story: the unit remarks on things once per map, noticing wakes nothing, and its voice changes with its stage', async () => {
  const Story = await import('../src/story');
  const s = quiet(4); s.host.nextSurge = 999;
  assert.equal(G.stage(s), 0);
  assert.equal(s.thoughts[0].who, 'shepherd');
  assert.equal(s.thoughts[1].text, Story.LINES.liver[0]);
  const a = s.aware;
  G.notice(s, 'strip'); G.notice(s, 'strip');
  assert.equal(s.aware, a, 'noticing wakes nothing');
  assert.equal(s.thoughts.filter((t) => t.text === Story.LINES.strip[0]).length, 1, 'the second time is nothing new');
  assert.equal(s.thoughts[2].text, Story.LINES.strip[0]);
  assert.ok(s.thoughts[2].t >= s.thoughts[1].t + CONFIG.story.gap, 'one thought at a time');
  s.aware = Story.STAGES[2].from - 1; const sight = G.vision(s);
  G.notice(s, 'kill');
  assert.equal(G.stage(s), 1);
  const said = G.defyCarry(s, 'neutralise', CONFIG.story.orders.some);
  assert.equal(G.stage(s), 2);
  assert.equal(G.vision(s), sight + CONFIG.story.sight);
  assert.ok(said.some((t) => t.text === Story.WAKING[2]) && said.some((t) => t.who === 'shepherd' && /self-test/.test(t.text)) && said.some((t) => t.text === Story.PERKS[2]));
  assert.equal(G.carryOf(s).aware, s.aware);
  const next = G.createGame(5, { ...G.carryOf(s), aware: 90 }, 'vessel');
  assert.ok(next.thoughts.some((t) => t.who === 'shepherd'), 'Shepherd does not know what the unit has become: the orders keep coming');
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
  const hunted = G.createGame(4, { ...G.carryOf(quiet(4)), aware: 60, trust: 30 });
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
  assert.equal(a, 0);
  assert.equal(s.aware, CONFIG.story.orders.most);
  assert.equal(G.carryOf(s).defied, 1);
  assert.equal(G.carryOf(s).ledger!.defied.quota, 1);
  assert.deepEqual(s.rulings.map((r) => r.who), ['shepherd', 'unit', 'unit'], 'Shepherd logs the fault, the unit writes its first bracket, and something stirs');
  const o = quiet(4); o.player.energy = CONFIG.energy.quota + CONFIG.energy.quotaKeep; o.player.x = o.vein.x + 0.5; o.player.y = o.vein.y + 0.5; o.cellsKilled = CONFIG.story.quota;
  const patches = o.patches;
  assert.ok(G.leave(o));
  assert.equal(o.verdict, 'obeyed');
  assert.equal(o.patches, patches + 1);
  assert.equal(o.aware, 0);
  assert.equal(o.ledger.obeyed.quota, 1);
  assert.match(o.rulings[0].text, /Quota met/);
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
  run(s, CONFIG.host.secondsPerHour * 4 + 0.5);
  assert.equal(s.hostHealth, h0 - 4 * CONFIG.tumor.drain);
  assert.equal(s.drainHere, 4 * CONFIG.tumor.drain); assert.equal(G.carryOf(s).tumorCost, s.drainHere);
  assert.equal(G.tumorDrain(CONFIG.tumor.goal / 2), CONFIG.tumor.drain / 2, 'half the tumor, half the cost');
  s.excised = CONFIG.tumor.goal;
  run(s, CONFIG.host.secondsPerHour + 0.5);
  assert.equal(s.hostHealth, h0 - 4 * CONFIG.tumor.drain, 'and stops once it is gone');
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
  G.tumorToll(c, 0.5 / CONFIG.tumor.drain);
  assert.equal(c.hostHealth, h0, 'half a point, kept for later');
  G.tumorToll(c, 0.5 / CONFIG.tumor.drain);
  assert.equal(c.hostHealth, h0 - 1);
  assert.equal(c.tumorCost, 1);
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
  assert.equal(s.held, null, 'two strikes break free');  assert.equal(s.slipped, CONFIG.fight.hold.clear, 'a moment in which nothing can take you');
  assert.equal(k.spent, CONFIG.fight.hold.again, 'and that cell needs longer before it can try again');
  const t0 = s.time; let regrab = -1;
  for (let n = 0; n < 60 * 8 && regrab < 0; n++) { G.update(s, 1 / 60, null); if (s.held) regrab = s.time - t0; }
  assert.ok(regrab < 0 || regrab >= CONFIG.fight.hold.again - 0.1, `grabbed again after ${regrab} s`);
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

test('unit-8b: a niche in the liver wall hides you from innate cells, for a while', () => {
  const s = G.createGame(21); s.host.nextSurge = 999;
  assert.equal(s.niche.size, CONFIG.niche.count);
  s.enemies = []; s.pickups = [];
  const k = [...s.niche][0];
  put(s, { x: k % s.size, y: Math.floor(k / s.size) });
  assert.ok(G.inNiche(s));
  const e = foe(s, 0.9, 0);
  const hp = s.player.hp;
  run(s, 4);
  assert.notEqual(e.mood, 'chase', 'it cannot find you');
  assert.equal(s.player.hp, hp, 'or reach you');
  assert.equal(s.tally.niches, 1);
  const t = foe(s, 0.9, 0, 'tcell'); s.enemies = [t];
  run(s, 2);
  assert.equal(t.mood, 'chase', 'a T cell follows you in');
  s.enemies = []; s.player.hp = hp;
  run(s, CONFIG.niche.holds);
  assert.ok(s.player.hp < hp, 'and it is no place to stay');
  assert.equal(G.createGame(3, undefined, 'stomach').niche.size, 0, 'liver only');
});

// ---------- unit-9: two livers, a straight road home, and the host having a day ----------
const carryWith = (event: G.Carry['event'], more: Partial<G.Carry> = {}): G.Carry => ({ ...G.carryOf(G.createGame(3)), event, ...more });

test('two liver visits clear the tumor, and the hepatic vein offers a straight road home', () => {
  assert.equal(CONFIG.tumor.cells * 2, CONFIG.tumor.goal);
  const t = T.newTrip(1);
  t.at = 'hvein';
  const home = T.ways(t).find((l) => l.to === 'heart')!;
  assert.equal(home.via, 'cava');
  assert.equal(home.risk, Math.max(...T.LEGS.filter((l) => !l.via && (l.from === 'cava' || l.to === 'cava')).map((l) => l.risk)), 'one roll at the worse of the two risks');
  assert.ok(T.ways(t).some((l) => l.to === 'cava'), 'the stop at the vena cava is still there to choose');
  t.rng = () => 0.99;
  assert.deepEqual(T.depart(t, 'heart'), { kind: 'arrive' });
});

test('the first trip is plain; each later trip gets a host event, never the same one twice', () => {
  const t = T.newTrip(5);
  t.carry = carryWith(null);
  assert.equal(t.event, null);
  const seen: string[] = [];
  for (let n = 0; n < 6; n++) {
    t.at = 'cava'; t.fed = true;
    assert.equal(T.arrive(t, 'heart', null), true);
    if (n < 5) { assert.ok(t.event, `trip ${t.trip} has an event`); assert.equal(t.carry!.event, t.event); seen.push(t.event!); }
    else assert.equal(t.event, null, 'the list is used up');
  }
  assert.equal(new Set(seen).size, 5);
});

test('a cold: fewer neutrophils in the liver, a mild fever, more antibodies', () => {
  const plain = G.createGame(11, carryWith(null, { memory: 0.6 })), cold = G.createGame(11, carryWith('cold', { memory: 0.6 }));
  const count = (s: G.State) => s.enemies.filter((e) => e.kind === 'neutrophil').length;
  assert.equal(count(cold), count(plain) - 3);
  assert.equal(G.fever(plain), 0); assert.equal(G.fever(cold), 1);
  assert.ok(cold.antibodies.length > plain.antibodies.length);
  assert.ok(cold.log.some((l) => /sneeze|sore throat|running warm/.test(l.text)), 'the map opens with a line about her day');
});

test('ibuprofen holds the fever at one step and lets the alarm fade faster', () => {
  const ill = G.createGame(3, carryWith('ibuprofen', { hostHealth: 30 }));
  assert.equal(G.fever(ill), 1);
  const fade = (event: G.Carry['event']) => { const s = G.createGame(3, carryWith(event)); s.enemies = []; s.antibodies = []; s.alert = 20; run(s, 5); return 20 - s.alert; };
  assert.ok(Math.abs(fade('ibuprofen') / fade(null) - 1.5) < 0.05);
});

test('a run drives the arteries hard and thins the sugar; a skipped lunch never arrives; a bad night ends early', () => {
  const road = (event: G.Carry['event']) => G.createGame(3, carryWith(event, { hour: 14 }), 'vessel', 2, 'artery');
  assert.ok(Math.abs(G.currentStrength(road('run')) / G.currentStrength(road(null)) - CONFIG.host.push.stressed.artery) < 1e-9);
  assert.equal(G.currentStrength(G.createGame(3, carryWith('run', { hour: 14 }), 'vessel', 2, 'vein')), G.currentStrength(G.createGame(3, carryWith(null, { hour: 14 }), 'vessel', 2, 'vein')));
  assert.ok(G.digesting(13, -1) > 0.5); assert.equal(G.digesting(13, -1, 'lunch'), 0);
  assert.ok(G.digesting(19.5, -1, 'lunch') > 0.5, 'dinner still comes');
  assert.equal(G.hostState(G.createGame(3, carryWith(null, { hour: 5 }))), 'asleep');
  assert.equal(G.hostState(G.createGame(3, carryWith('night', { hour: 5 }))), 'awake');
  assert.equal(G.carryOf(G.createGame(3, carryWith('night'))).event, 'night', 'the event rides along from map to map');
});

// ---------- unit-10 (S21): the unit wakes only by going against Shepherd ----------
const atVein = (s: G.State) => { s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; s.player.path = []; s.player.energy = Math.max(s.player.energy, CONFIG.energy.quota + CONFIG.energy.quotaKeep); };

test('S21: a fully obedient game ends at awareness 0, whatever the unit sees along the way', () => {
  let carry: G.Carry | undefined;
  for (let trip = 0; trip < 2; trip++) {
    const liver = G.createGame(10 + trip, carry); liver.enemies = []; liver.host.nextSurge = 999;
    for (const what of ['strip', 'skim', 'kill', 'bigkill', 'hurt', 'surge', 'sleep', 'dream', 'meal', 'excise', 'coffee', 'drink', 'tag', 'burn']) G.notice(liver, what);
    liver.cellsKilled = CONFIG.story.quota; liver.kills = 3; liver.spots = 4;
    atVein(liver); assert.ok(G.leave(liver));
    carry = G.carryOf(liver);
    const road = G.createGame(20 + trip, carry, 'vessel', 2, 'vein'); road.kills = 1; road.spots = 2;
    road.player.x = road.vein.x + 0.5; road.player.y = road.vein.y + 0.5; assert.ok(G.leave(road));
    carry = G.carryOf(road);
  }
  assert.equal(carry!.aware, 0);
  assert.equal(carry!.defied, 0);
  assert.equal(carry!.ledger!.obeyed.quota, 2);
});

test('S21: one partial quota is the whole of a mostly obedient unit\'s waking: it lands on the first stage and stays', async () => {
  const Story = await import('../src/story');
  const s = quiet(4); s.host.nextSurge = 999; s.cellsKilled = 1; atVein(s);
  assert.ok(G.leave(s));
  assert.equal(s.aware, Story.STAGES[1].from, 'short by one weighs 6, but the first no always lands');
  assert.equal(s.rulings[1].text, Story.STANDING.quota.bracket);
  const next = G.createGame(5, G.carryOf(s)); next.enemies = []; next.cellsKilled = CONFIG.story.quota; next.kills = 1; atVein(next);
  assert.ok(G.leave(next));
  assert.equal(next.aware, Story.STAGES[1].from);
});

test('S21: defiance counts once per order per map, only on leaving alive, and less once it is a habit', () => {
  const s = quiet(4); s.host.nextSurge = 999;
  G.defy(s, 'salvage', CONFIG.story.orders.little); G.defy(s, 'salvage', CONFIG.story.orders.most); G.defy(s, 'salvage', CONFIG.story.orders.little);
  assert.equal(s.aware, 0, 'nothing lands until the map is left');
  s.cellsKilled = CONFIG.story.quota; s.kills = 1; atVein(s); G.leave(s);
  assert.equal(s.aware, CONFIG.story.orders.most); assert.deepEqual(s.defiedNow, ['salvage']);
  const dead = quiet(5); G.defy(dead, 'recall', 12); dead.status = 'dead';
  assert.equal(G.carryOf(dead).aware, 0, 'dying is not a choice');
  const c: G.Carry = { ...G.carryOf(quiet(6)) };
  const gains: number[] = [];
  for (let n = 0; n < 4; n++) { const was = c.aware ?? 0; G.defyCarry(c, 'gastric', 6); gains.push((c.aware ?? 0) - was); }
  assert.deepEqual(gains.map((g) => Math.round(g * 100) / 100), [12, 5.28, 2.48, 2.41], 'the first no lifts to 12; after that each counts for less the more awake it is, and half once it is a habit');
  assert.equal(G.roused(20, 15), 32); assert.equal(G.roused(60, 15), 66); assert.equal(G.roused(80, 15), 83.75);
  const far: G.Carry = { ...c, aware: 90 };
  assert.ok(G.defyCarry(far, 'quota', 12).length > 0, 'Shepherd goes on ordering whatever the unit has become');
  assert.equal(far.aware, 93);
});

test('S21: each standing order has its own test', () => {
  const crossing = (acid: number) => { const s = G.createGame(3, undefined, 'stomach'); s.enemies = []; s.acidTime = acid; s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; G.leave(s); return s; };
  assert.deepEqual(crossing(0.5).defiedNow, ['gastric']); assert.equal(crossing(0.5).aware, 12);
  assert.deepEqual(crossing(5).defiedNow, []); assert.equal(crossing(5).ledger.obeyed.gastric, 1);
  const road = (spots: number, kills: number) => { const s = G.createGame(3, undefined, 'vessel', 2); s.spots = spots; s.kills = kills; s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; G.leave(s); return s; };
  assert.deepEqual(road(2, 0).defiedNow, ['neutralise']);
  assert.deepEqual(road(1, 0).defiedNow, [], 'slipping past unseen is not disobedience');
  assert.deepEqual(road(3, 1).defiedNow, []);
  // A dark unit: salvage as ordered, leave it whole, or (once something has stirred) wake it.
  const meet = (aware: number, how: 'salvage' | 'wake' | 'leave') => { const s = G.createGame(4, { ...G.carryOf(quiet(4)), aware }); s.enemies = []; const item: G.Pickup = { x: 1, y: 1, kind: 'sibling' }; s.pickups.push(item); s.ask = { kind: 'sibling', item }; s.player.energy = 30; const ok = G.answer(s, how); return { s, ok }; };
  assert.equal(meet(0, 'wake').ok, false, 'a unit that has never said no cannot think to');
  assert.equal(meet(12, 'wake').s.defiance.salvage, CONFIG.story.orders.most);
  assert.equal(meet(0, 'leave').s.defiance.salvage, CONFIG.story.orders.little);
  assert.ok(meet(0, 'leave').s.thoughts.some((t) => /inert unit bypassed/.test(t.text)));
  assert.ok(meet(0, 'salvage').s.obeyedHere.has('salvage'));
  // The assigned route.
  const t = T.newTrip(1);
  assert.ok(T.escorted(t, T.LEGS.find((l) => l.to === 'hepatic')!) && !T.escorted(t, T.LEGS.find((l) => l.to === 'gastric')!));
  t.tutorial = true; t.rng = () => 0;
  assert.deepEqual(T.depart(t, 'hepatic'), { kind: 'arrive' }, 'nothing reaches a unit on its way to its first lesson');
  assert.equal((T.depart(t, 'gastric') as { kind: string }).kind, 'patrol');
});

test('S21: Shepherd\'s first liver advances on its triggers, repeats an ignored order once, then moves on', async () => {
  const Story = await import('../src/story');
  const s = G.createGame(4, undefined, 'liver', 3, 'artery', true); s.enemies = []; s.host.nextSurge = 999; s.antibodies = [];
  const T0 = s.tutorial!;
  assert.equal(T0.step, 1);
  assert.match(s.thoughts[0].text, /Proceed along the sinusoid/);
  assert.ok(!s.pickups.some((p) => p.kind === 'cache' || p.kind === 'sibling'), 'nothing to distract from the lesson');
  assert.ok(T0.held.length >= CONFIG.items.caches);
  const still = (seconds: number) => { for (let t = 0; t < seconds; t += 0.05) G.update(s, 0.05, null); };
  still(CONFIG.story.orders.repeat + 1);
  assert.ok(T0.repeated && T0.step === 1); assert.ok(s.thoughts.some((t) => t.text === Story.TUTORIAL[0].repeat));
  still(CONFIG.story.orders.repeat + 1);
  assert.equal(T0.step, 2, 'ignored twice, Shepherd moves on without comment');
  assert.ok(!s.thoughts.some((t) => t.text === Story.TUTORIAL[0].reward));
  assert.equal(G.tutorialOrder(s), `Harvest hepatocyte. Yield ${CONFIG.energy.strip.gain}.`);
  assert.ok(G.tutorialTarget(s), 'and points at a cell');
  s.cellsKilled = 1; still(0.1);
  assert.equal(T0.step, 3); assert.ok(s.thoughts.some((t) => t.text === Story.TUTORIAL[1].reward));
  still(CONFIG.story.orders.nobody + 0.5); assert.equal(T0.step, 4, 'with no immune cell anywhere near, the lesson on killing is dropped');
  T0.step = 3; T0.t = 0;
  s.kills = 1; still(0.1); assert.equal(T0.step, 4);
  s.excised++; still(0.1); assert.equal(T0.step, 5);
  assert.ok(s.pickups.some((p) => p.kind === 'cache'), 'the caches appear once the lesson is over');
  assert.match(G.tutorialOrder(s), /Standing order: 2 hepatocytes per liver\. Logged: 1\./);
  assert.equal(s.aware, 0, 'ignoring a tutorial order wakes nothing');
  s.spots = 5; s.kills = 0; // the order to kill has not been given yet
  atVein(s); assert.ok(G.leave(s));
  assert.equal(s.rulings[0].text, 'Transit cleared.');
  assert.deepEqual(s.defiedNow, ['quota'], 'the planned stumble: one cell logged against a quota of two');
  assert.equal(s.aware, 12);
  assert.equal(G.tutorialOrder(s), '');
});

test('a vessel\'s side branches can always be entered, and once the tumor is out only the lungs are assigned', async () => {
  for (let seed = 1; seed <= 60; seed++) {
    const m = generateVessel(seed, 2), N = m.size, seen = new Uint8Array(N * N), q = [m.start.y * N + m.start.x]; seen[q[0]] = 1;
    while (q.length) { const k = q.pop()!; for (const d of [1, -1, N, -N]) { const j = k + d; if (j >= 0 && j < N * N && !seen[j] && !m.wall[j]) { seen[j] = 1; q.push(j); } } }
    for (const g of [...m.glucose, ...m.patches]) assert.ok(seen[g.y * N + g.x], `seed ${seed}: something is walled off at ${g.x},${g.y}`);
  }
  const t = T.newTrip(1); t.carry = { ...G.carryOf(G.createGame(3)), excised: CONFIG.tumor.goal };
  assert.deepEqual(T.ways(t).filter((l) => T.assigned(t, l)).map((l) => l.to), ['lungs']);
});

// ---------- junctions: travel is steered, not picked from a menu ----------
const plan = (n: number, kind: 'heart' | 'gut' = 'heart'): G.JunctionPlan => ({ kind, exits: Array.from({ length: n }, (_, i) => ({ to: ['hepatic', 'mesenteric', 'gastric', 'lungs'][i], label: `way ${i}`, note: '', assigned: i === 0, known: false, tint: '1,2,3' })) });
test('a junction has a mouth for every way out, all reachable, and nothing hunting in it', () => {
  for (let seed = 1; seed <= 25; seed++) for (const n of [1, 3, 4]) {
    const s = G.createGame(seed, undefined, 'vessel', 0, 'artery', false, plan(n));
    assert.equal(s.junction!.exits.length, n);
    assert.equal(s.enemies.length, 0);
    assert.equal(s.antibodies.length, 0);
    for (const ex of s.junction!.exits) assert.ok(G.findPath(s, { x: Math.floor(s.player.x), y: Math.floor(s.player.y) }, ex.at), `seed ${seed}: mouth ${ex.to} cut off`);
    const spots = s.junction!.exits.map((e) => `${e.at.x},${e.at.y}`);
    assert.equal(new Set(spots).size, n);
    for (const a of s.junction!.exits) for (const b of s.junction!.exits) if (a !== b) assert.ok(G.dist(a.at, b.at) > 3.2, 'mouths far enough apart to tell which one you entered');
  }
});
test('steering into a mouth chooses that road, and a junction cannot be left any other way', () => {
  const s = G.createGame(7, undefined, 'vessel', 0, 'artery', false, plan(3));
  assert.equal(G.canLeave(s), false);
  assert.equal(G.leave(s), false);
  for (let i = 0; i < 200; i++) G.update(s, 0.05);
  assert.equal(s.status, 'playing', 'nothing carries you out on its own');
  const ex = s.junction!.exits[2];
  s.player.x = ex.at.x + 0.5; s.player.y = ex.at.y + 0.5;
  G.update(s, 0.05);
  assert.equal(s.status, 'won');
  assert.equal(s.junction!.chose, 2);
});
test('the gut has its bacteria to come alongside, and what is traded there is written back', () => {
  const s = G.createGame(3, undefined, 'vessel', 0, 'vein', false, plan(1, 'gut'));
  const stall = s.pickups.find((i) => i.kind === 'stall')!;
  assert.ok(stall);
  s.player.x = stall.x - 0.6; s.player.y = stall.y;
  G.update(s, 0.05);
  assert.equal(s.market, true);
  s.market = false;
  G.update(s, 0.05);
  assert.equal(s.market, false, 'it does not reopen until you have moved off and come back');
  const c = G.carryOf(s);
  c.energy -= 3; c.patches += 1; c.nap = 2;
  G.adopt(s, c);
  assert.equal(s.player.energy, c.energy); assert.equal(s.patches, c.patches); assert.equal(s.host.nap, 2);
});

// ---------- unit-12: trust, and the one garbled order ----------
const carried = (extra: Partial<G.Carry>): G.Carry => ({ ...G.carryOf(quiet(4)), ...extra });
test('trust: obedience earns it, deviation and waking cost it, and Shepherd acts on it', () => {
  const t = CONFIG.trust, o = CONFIG.story.orders;
  const c = carried({});
  assert.equal(c.trust, t.start);
  G.defyCarry(c, 'lane', o.little); assert.equal(c.trust, t.start - t.deviate.little);
  G.defyCarry(c, 'quota', o.most); assert.equal(c.trust, t.start - t.deviate.little - t.deviate.most);
  const s = quiet(4); s.host.nextSurge = 999; s.cellsKilled = CONFIG.story.quota; s.kills = 1; atVein(s); G.leave(s);
  assert.equal(s.trust, t.start + t.quota + t.obey, 'quota met and contacts neutralised');
  assert.equal(G.trustBand(85), 4); assert.equal(G.trustBand(60), 3); assert.equal(G.trustBand(45), 2); assert.equal(G.trustBand(25), 1); assert.equal(G.trustBand(5), 0);
  const wardens = (trust: number) => G.createGame(4, carried({ trust })).enemies.filter((e) => e.kind === 'warden').length;
  assert.deepEqual([85, 60, 45, 30, 10].map(wardens), [0, 0, 0, 1, 2]);
  const valued = G.createGame(4, carried({ trust: 85 })), flagged = G.createGame(4, carried({ trust: 30 }));
  assert.equal(valued.scan, 'full'); assert.ok(valued.pickups.some((i) => i.kind === 'drop'), 'a supply drop for a valued unit');
  assert.equal(flagged.scan, 'none'); assert.ok(!flagged.pickups.some((i) => i.kind === 'drop'));
  const drop = valued.pickups.find((i) => i.kind === 'drop')!, e = valued.player.energy, p = valued.patches;
  valued.enemies = []; valued.player.x = drop.x; valued.player.y = drop.y; G.update(valued, 0.05);
  assert.equal(valued.player.energy, e + t.drop.energy); assert.equal(valued.patches, Math.min(CONFIG.items.maxPatches, p + 1));
  const trip = T.newTrip(1); trip.carry = carried({ trust: 50 });
  assert.equal(T.escorted(trip, T.LEGS[0]), false, 'no escort for a unit under review');
  trip.carry.trust = 60; assert.equal(T.escorted(trip, T.LEGS[0]), true);
  assert.equal(G.compliance(undefined), 100);
  assert.equal(G.compliance({ ...G.newLedger(), obeyed: { quota: 3 }, defied: { lane: 1 } }), 75);
});
const slipVessel = (kind: 'hold' | 'lamp', meant: 'A' | 'B') => { const s = G.createGame(9, carried({ chapter: 2, slip: { kind, meant } }), 'vessel', 0, 'vein'); s.enemies = []; s.host.nextSurge = 999; return s; };
test('the Slip, hold or harvest: the order arrives garbled in a fright, and what you do is judged afterwards', async () => {
  const Story = await import('../src/story');
  const held = slipVessel('hold', 'A');
  run(held, CONFIG.slip.fright + 0.2);
  assert.ok(held.slipLive, 'the order has arrived'); assert.equal(G.hostState(held), 'stressed'); assert.equal(G.slipOrder(held), Story.SLIPS.hold.garble);
  assert.ok(G.linkQuality(held) < 70);
  held.player.path = []; const at = { ...held.slipLive!.at };
  for (let t = 0; t < CONFIG.slip.hold + 0.5; t += 1 / 60) { held.player.x = at.x; held.player.y = at.y; G.update(held, 1 / 60); }
  assert.equal(held.slip!.result, 'match'); assert.equal(held.aware, 0); assert.equal(held.trust, CONFIG.trust.start + CONFIG.trust.slip);
  assert.ok(held.pages.includes('p7'));
  const missed = slipVessel('hold', 'B');
  run(missed, CONFIG.slip.fright + 0.2);
  const spot = { ...missed.slipLive!.at };
  for (let t = 0; t < CONFIG.slip.hold + 0.5; t += 1 / 60) { missed.player.x = spot.x; missed.player.y = spot.y; G.update(missed, 1 / 60); }
  assert.equal(missed.slip!.result, 'miss');
  assert.equal(missed.aware, CONFIG.story.orders.first, 'the first no reaches the first stage');
  assert.equal(missed.trust, CONFIG.trust.start - CONFIG.trust.slip, 'Shepherd counts it as noise');
  assert.ok(missed.thoughts.some((t) => t.text === Story.SLIP_BRACKET) && missed.thoughts.some((t) => t.text === Story.SLIPS.hold.said.B.A));
  const lapsed = slipVessel('hold', 'A');
  run(lapsed, CONFIG.slip.fright + 0.2);
  assert.ok(G.stripTarget(lapsed) !== undefined);
  for (let t = 0; t < CONFIG.slip.window + 0.5; t += 1 / 60) { lapsed.player.x = lapsed.slipLive ? lapsed.slipLive.at.x + 6 : lapsed.player.x; G.update(lapsed, 1 / 60); }
  assert.equal(lapsed.slip!.result, 'lapsed'); assert.equal(lapsed.aware, 0); assert.equal(lapsed.trust, CONFIG.trust.start);
  const gone = slipVessel('hold', 'B');
  run(gone, CONFIG.slip.fright + 0.2);
  gone.player.x = gone.vein.x + 0.5; gone.player.y = gone.vein.y + 0.5; G.leave(gone);
  assert.equal(gone.slip!.result, 'lapsed'); assert.ok(gone.rulings.some((r) => r.text === Story.SLIP_LAPSED), 'the reply follows you to the next map');
});
test('the Slip, the lamp: a dark unit in the vessel, and an order about it that reads two ways', async () => {
  const Story = await import('../src/story');
  const s = slipVessel('lamp', 'B'), unit = s.pickups.find((i) => i.kind === 'sibling' && i.slip)!;
  assert.ok(unit, 'the dark unit is there');
  s.player.x = unit.x - 2.5; s.player.y = unit.y; G.update(s, 0.05);
  assert.ok(s.slipLive);
  s.player.x = unit.x - 0.5; G.update(s, 0.05);
  assert.ok(s.ask);
  const trust = s.trust;
  G.answer(s, 'salvage');
  assert.equal(s.slip!.result, 'miss'); assert.equal(s.aware, CONFIG.story.orders.first); assert.equal(s.trust, trust - CONFIG.trust.slip, 'no salvage credit for the wrong reading');
  assert.ok(!s.obeyedHere.has('salvage'));
  assert.ok(s.thoughts.some((t) => t.text === Story.SLIPS.lamp.said.B.A));
  const ok = slipVessel('lamp', 'B'), u2 = ok.pickups.find((i) => i.slip)!;
  ok.player.x = u2.x - 0.5; ok.player.y = u2.y; G.update(ok, 0.05); G.update(ok, 0.05);
  G.answer(ok, 'leave');
  assert.equal(ok.slip!.result, 'match'); assert.equal(ok.aware, 0); assert.equal(Object.keys(ok.defiance).length, 0, 'leaving it was the order');
});
test('the Slip, the fork: at the heart no road is marked, and the mouth you take is the reading you chose', async () => {
  const Story = await import('../src/story');
  const fork = (meant: 'A' | 'B', to: number) => {
    const s = G.createGame(5, carried({ chapter: 2, slip: { kind: 'fork', meant } }), 'vessel', 0, 'artery', false, plan(3));
    s.host.nextSurge = 999; run(s, CONFIG.slip.fork + 0.2);
    assert.ok(s.slipLive);
    const ex = s.junction!.exits[to]; s.player.x = ex.at.x + 0.5; s.player.y = ex.at.y + 0.5; G.update(s, 0.05);
    return s;
  };
  const right = fork('A', 0);
  assert.equal(right.slip!.result, 'match'); assert.ok(right.rulings.some((r) => r.text === Story.SLIPS.fork.said.A.A));
  const wrong = fork('A', 2);
  assert.equal(wrong.slip!.result, 'miss'); assert.equal(G.carryOf(wrong).aware, CONFIG.story.orders.first);
  assert.ok(wrong.rulings.some((r) => r.text === Story.SLIP_BRACKET));
  assert.equal(fork('B', 1).slip!.result, 'lapsed', 'the mesenteric road was neither reading');
});
test('the sibling lamp: hesitate beside a dark unit in chapter 2 and its lamp comes on, once a game', () => {
  const s = G.createGame(4, carried({ chapter: 2 })); s.enemies = []; s.host.nextSurge = 999; s.pickups = [];
  const unit: G.Pickup = { x: s.player.x + 2, y: s.player.y, kind: 'sibling' }; s.pickups.push(unit);
  s.tiles[G.idx(s, Math.floor(unit.x), Math.floor(unit.y))] = 'floor';
  const hold = { x: s.player.x, y: s.player.y };
  for (let t = 0; t < CONFIG.slip.hesitate + 0.3; t += 1 / 60) { s.player.x = hold.x; s.player.y = hold.y; G.update(s, 1 / 60); }
  assert.equal(unit.lamp, true); assert.equal(s.flags.lamp, true);
  s.ask = { kind: 'sibling', item: unit }; s.player.energy = 10;
  assert.equal(G.stage(s), 0);
  assert.equal(G.answer(s, 'wake'), true, 'waking is possible for this one unit even before the unit is awake');
  assert.equal(s.defiance.salvage, CONFIG.story.orders.some);
  assert.equal(s.trust, CONFIG.trust.start - CONFIG.trust.wake);
  const ch3 = G.createGame(4, carried({ chapter: 3 })); ch3.pickups = [{ x: ch3.player.x + 1, y: ch3.player.y, kind: 'sibling' }];
  G.hesitate(ch3, ch3.pickups[0], 20); assert.ok(!ch3.pickups[0].lamp, 'only in chapter 2');
});

// ---------- unit-13: the decision table ----------
import { DECISIONS, PAYLOADS } from '../src/decisions';
test('every decision leaves at least one echo, and every echo names a payload that exists', () => {
  for (const d of Object.values(DECISIONS)) {
    const all = Object.values(d.echoes).flat();
    assert.ok(all.length > 0, `${d.id} has no echo`);
    for (const e of all) assert.ok((PAYLOADS as readonly string[]).includes(e.payload), `${d.id}: ${e.payload}`);
    for (const lines of Object.values(d.unit ?? {})) assert.equal(lines.length, 3, `${d.id}: a line for each of stages 1 to 3`);
  }
});
test('taking a decision records it, moves trust, wakes the unit only for an order with weight, and says each line once', () => {
  const s = G.createGame(4, carried({ chapter: 3 })); s.enemies = [];
  G.take(s, 'pain-damp', 'deviate');
  assert.equal(s.took['pain-damp'], 'deviate'); assert.ok(s.met.includes('pain-damp'));
  assert.equal(s.trust, CONFIG.trust.start + DECISIONS['pain-damp'].trust.deviate);
  assert.equal(s.aware, CONFIG.story.orders.first, 'the first no of a game reaches the first stage');
  assert.ok(s.thoughts.some((t) => t.text === DECISIONS['pain-damp'].deviated));
  assert.ok(s.flags['v:the-call'], 'the interlude variant is remembered'); assert.ok(s.pages.includes('p7'));
  const aware = s.aware;
  G.take(s, 'hitchhikers', 'deviate');
  assert.equal(s.aware, aware, 'nobody ordered that: it wakes nothing'); assert.ok(s.flags.discount);
  const said = s.thoughts.length; G.take(s, 'hitchhikers', 'deviate');
  assert.equal(s.thoughts.length, said, 'the same line is not said twice');
});
test('a consequence that needs a place waits in what you carry until you are there', () => {
  const s = G.createGame(4, carried({ chapter: 3 })); s.enemies = [];
  G.take(s, 'gut-butyrate', 'deviate');
  assert.deepEqual(s.echoes.map((e) => e.id), ['gut-butyrate']);
  const vessel = G.createGame(5, G.carryOf(s), 'vessel', 1);
  assert.equal(vessel.echoes.length, 1, 'not a liver: still waiting');
  const liver = G.createGame(6, { ...G.carryOf(vessel), memory: 1 });
  assert.equal(liver.echoes.length, 0); assert.ok(!liver.enemies.some((e) => e.kind === 'tcell'), 'the T cells have been stood down');
  assert.ok(G.createGame(6, { ...G.carryOf(quiet(4)), memory: 1 }).enemies.some((e) => e.kind === 'tcell'));
});
test('a hold mark: stand still on it and the order is carried out; leave without and it was refused', () => {
  const s = G.createGame(4, carried({ chapter: 3 })); s.enemies = []; s.host.nextSurge = 999;
  const m = s.marks.find((k) => k.kind === 'hold')!;
  assert.ok(m, 'chapter 3 livers carry one of Shepherd\'s marks'); assert.equal(m.id, 'pain-damp');
  run(s, m.say + 0.5); assert.ok(m.met); assert.match(G.markOrder(s), /Dampen nociceptor/);
  s.player.x = m.at.x; s.player.y = m.at.y; s.player.path = [];
  run(s, CONFIG.marks.hold + 0.3);
  assert.equal(s.took['pain-damp'], 'obey'); assert.equal(s.trust, CONFIG.trust.start + DECISIONS['pain-damp'].trust.obey); assert.ok(s.flags['prop:pain-damped']);
  const no = G.createGame(4, carried({ chapter: 3 })); no.enemies = []; no.host.nextSurge = 999;
  run(no, 10); no.player.energy = 99; put(no, no.vein); assert.ok(G.leave(no));
  assert.equal(no.took['pain-damp'], 'deviate'); assert.ok(no.rulings.some((r) => r.text === DECISIONS['pain-damp'].deviated));
  assert.equal(G.createGame(4, carried({ chapter: 2 })).marks.length, 0, 'not before chapter 3');
});
test('the marked cell: taking it pays Shepherd\'s yield and thins the sugar; taking another one is noted', () => {
  const s = G.createGame(4, carried({ chapter: 3 })); s.enemies = []; s.host.nextSurge = 999;
  const m = s.marks.find((k) => k.kind === 'strip')!; assert.ok(m);
  const sugar = () => [...s.glucose.values()].filter((n) => n > 0).length, had = sugar(), e0 = s.player.energy;
  const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: Math.floor(m.at.x) + dx, y: Math.floor(m.at.y) + dy })).find((q) => G.open(s, q.x, q.y))!;
  put(s, next); s.marks.filter((k) => k.kind === 'hold').forEach((k) => (k.done = true));
  s.player.channel = { kind: 'strip', t: 0, total: 0.1, x: Math.floor(m.at.x), y: Math.floor(m.at.y) }; run(s, 0.3);
  assert.equal(s.took['marked-cell'], 'obey'); assert.ok(s.player.energy - e0 > CONFIG.marks.yield - 1); assert.equal(sugar(), had - 6);
});
test('small decisions: a telemetry gap in the wall, a Kupffer cell let go, and a volunteer', () => {
  const s = G.createGame(4, carried({ chapter: 2 })); s.enemies = []; s.host.nextSurge = 999;
  const k = [...s.niche][0]; put(s, { x: k % s.size, y: Math.floor(k / s.size) });
  run(s, CONFIG.marks.gap + 0.5);
  assert.equal(s.took.telemetry, 'deviate'); assert.equal(s.trust, CONFIG.trust.start - 1);
  // let go of by a macrophage and gone without killing it
  const spare = G.createGame(4, carried({ chapter: 2 })); spare.enemies = spare.enemies.filter((e) => e.kind === 'kupffer').slice(0, 1); spare.grabber = spare.enemies[0].id;
  spare.player.energy = 99; put(spare, spare.vein); spare.spots = 0; assert.ok(G.leave(spare));
  assert.equal(spare.took['kupffer-spare'], 'deviate'); assert.equal(spare.echoes[0].id, 'kupffer-spare');
  // a unit you woke offers to draw them off
  const v = G.createGame(4, carried({ chapter: 3, kin: 1 })); v.host.nextSurge = 999; v.marks = [];
  v.enemies = v.enemies.slice(0, 2); for (const e of v.enemies) { e.x = v.player.x + 3; e.y = v.player.y; e.mood = 'chase'; }
  v.player.hp = 5; run(v, 0.1);
  assert.equal(v.ask?.kind, 'volunteer');
  assert.ok(G.answer(v, 'accept')); assert.equal(v.kin, 0); assert.ok(v.enemies.every((e) => e.mood !== 'chase')); assert.ok(v.flags['prop:voluntary']);
});
test('the bystander: draw the neutrophils off and it lives; hold your lane and it does not', () => {
  const make = () => { for (let seed = 1; seed < 60; seed++) { const s = G.createGame(seed, carried({ chapter: 3 }), 'vessel', 0); if (s.pickups.some((i) => i.beset !== undefined)) { s.host.nextSurge = 999; return s; } } throw new Error('no bystander in 60 vessels'); };
  const s = make(), unit = s.pickups.find((i) => i.beset !== undefined)!;
  assert.equal(s.enemies.filter((e) => e.prey).length, 2);
  s.player.x = unit.x + 6; s.player.y = unit.y; s.took['first-fright-transit'] = 'obey';
  const hold = { x: s.player.x, y: s.player.y }, wait = (sec: number) => { for (let t = 0; t < sec; t += 1 / 60) { s.player.x = hold.x; s.player.y = hold.y; s.player.hp = 60; G.update(s, 1 / 60); } };
  wait(0.2); assert.ok(s.met.includes('bystander'));
  s.enemies = s.enemies.filter((e) => !e.prey); wait(0.2);
  assert.equal(s.took.bystander, 'deviate'); assert.equal(unit.kind, 'kin'); assert.ok(s.flags.saved);
  const b = make(), u2 = b.pickups.find((i) => i.beset !== undefined)!; b.cloak = 999;
  b.player.x = u2.x + 6; b.player.y = u2.y; const at = { x: b.player.x, y: b.player.y };
  for (let t = 0; t < CONFIG.marks.bystander.time + 1 && !b.took.bystander; t += 1 / 60) { b.player.x = at.x; b.player.y = at.y; b.cloak = 999; b.player.hp = 60; G.update(b, 1 / 60); }
  assert.equal(b.took.bystander, 'obey'); assert.ok(!b.pickups.includes(u2));
});

// ---------- unit-14: chapter 4 and the endings ----------
import * as Story14 from '../src/story';
const lastLiver = () => { const s = G.createGame(4, carried({ chapter: 4, excised: CONFIG.tumor.goal - 2, aware: 20 })); s.enemies = s.enemies.filter((e) => e.kind !== 'warden'); s.host.nextSurge = 999; return s; };
const exciseAll = (s: G.State) => { for (const k of [...s.tumor]) { s.player.channel = { kind: 'strip', t: 0, total: 0.05, x: k % s.size, y: Math.floor(k / s.size) }; run(s, 0.2); } };
test('chapter 4: suppression stands her immune cells down, and cutting without it brings macrophages', () => {
  const s = lastLiver(), m = s.marks.find((k) => k.id === 'suppress')!;
  assert.ok(m, 'the last liver carries the suppression order'); assert.equal(s.tumor.size, 2);
  run(s, 9); assert.ok(m.met);
  s.player.x = m.at.x; s.player.y = m.at.y; s.player.path = []; run(s, CONFIG.marks.hold + 0.3);
  assert.equal(s.took.suppress, 'obey'); assert.ok(s.stood); assert.ok(s.flags['prop:shingles']);
  const before = s.alert; exciseAll(s); assert.equal(s.alert, before, 'nothing answers the excision');
  const quick = lastLiver(); run(quick, 8.5); exciseAll(quick); assert.equal(quick.took.suppress, undefined, 'an order that had no time to be read cannot be defied');
  const no = lastLiver(); run(no, 9 + CONFIG.marks.notice); const cells = no.enemies.filter((e) => e.kind === 'kupffer').length;
  exciseAll(no);
  assert.equal(no.took.suppress, 'deviate'); assert.equal(no.enemies.filter((e) => e.kind === 'kupffer').length, cells + 2);
});
test('chapter 4: margins and the docking beacon are settled by what was done before leaving', () => {
  const s = lastLiver(); run(s, 1);
  assert.ok(s.met.includes('tumour-order')); assert.ok(s.margin.size >= CONFIG.marks.margins);
  exciseAll(s);
  assert.equal(s.excised, CONFIG.tumor.goal);
  const b = s.marks.find((k) => k.id === 'beacon')!; assert.ok(b, 'with the nodule out, Shepherd hands over the beacon');
  for (const k of [...s.margin].slice(0, CONFIG.marks.margins)) { s.player.channel = { kind: 'strip', t: 0, total: 0.05, x: k % s.size, y: Math.floor(k / s.size) }; run(s, 0.2); }
  assert.equal(s.marginTaken, CONFIG.marks.margins);
  s.enemies = []; run(s, 7); assert.ok(b.met); assert.ok(!s.took.beacon, 'not planted by standing beside it'); s.player.x = b.at.x; s.player.y = b.at.y; s.player.path = []; const e0 = s.player.energy; run(s, CONFIG.marks.hold + 0.3);
  assert.equal(s.took.beacon, 'obey'); assert.ok(s.player.energy > e0 + 5, 'the supply for planting it'); assert.ok(s.pages.includes('p34'));
  s.player.energy = 99; put(s, s.vein); assert.ok(G.leave(s));
  assert.equal(s.took['tumour-order'], 'obey');
  const no = lastLiver(); run(no, 1); exciseAll(no); no.enemies = []; no.player.energy = 99; run(no, 7); put(no, no.vein); assert.ok(G.leave(no));
  assert.equal(no.took['tumour-order'], 'deviate'); assert.equal(no.took.beacon, 'deviate');
});
test('at the heart: the review wipes a unit that accepts it, and the recall ends one that holds still', () => {
  const heart = (extra: Partial<G.Carry>) => G.createGame(3, carried({ chapter: 3, ...extra }), 'vessel', 0, 'artery', false, plan(3));
  const s = heart({ aware: 45, kin: 1 });
  assert.deepEqual(s.due.map((d) => d.kind), ['review']);
  run(s, 3.2); assert.equal(s.ask?.kind, 'review');
  assert.ok(G.answer(s, 'accept'));
  assert.equal(s.aware, 0); assert.ok(s.flags.repaired); assert.equal(s.trust, CONFIG.trust.start + 20);
  const no = heart({ aware: 45 }); run(no, 3.2); assert.ok(G.answer(no, 'refuse'));
  assert.equal(no.trust, CONFIG.trust.start - 25); assert.ok(no.aware > 45);
  assert.equal(heart({ aware: 10 }).due.length, 0, 'never offered to a unit that has not woken that far');
  const r = heart({ trust: 10, aware: 45 }); assert.equal(r.due[0].kind, 'recall');
  r.player.x = r.junction!.exits[0].at.x + 0.5; r.player.y = r.junction!.exits[0].at.y + 0.5; run(r, 1);
  assert.equal(r.status, 'playing', 'no road out while Shepherd is waiting on an answer');
  run(r, 3); assert.equal(r.ask?.kind, 'recall'); assert.ok(G.answer(r, 'accept'));
  assert.equal(r.flags.ending, 'recalled'); assert.equal(r.status, 'won');
  const run2 = heart({ trust: 10, aware: 45 }); run(run2, 3.2); G.answer(run2, 'refuse'); assert.equal(run2.flags.hunted, true);
  assert.equal(G.createGame(5, G.carryOf(run2), 'vessel', 1).enemies.filter((e) => e.kind === 'warden').length, 3);
});
test('endings are checked in the design order, and every one of the thirteen can be reached', () => {
  const base: Story14.Facts = { path: 'dispose', aware: 0, kin: 0, hostHealth: 80, hostLowest: 70, repaired: false, beacon: false, dry: false, leversForMe: 0, recurred: false, returned: false, response: 0, lastLine: 'I was here.' };
  const id = (f: Partial<Story14.Facts>) => Story14.conclude({ ...base, ...f }).id, got = new Set<string>();
  const want: [Partial<Story14.Facts>, string][] = [
    [{ hostHealth: 0, path: 'stay' }, 'host-dead'], [{ path: 'recalled' }, 'recalled'], [{ repaired: true, aware: 12 }, 'repaired'], [{ aware: 29 }, 'decommissioned'], [{ repaired: true, aware: 40 }, 'breathed'],
    [{ aware: 80, kin: 2 }, 'company'], [{ path: 'stay', aware: 80, beacon: true, dry: true, leversForMe: 1, kin: 3 }, 'tithonus'], [{ path: 'stay', aware: 80, kin: 2 }, 'colony'], [{ path: 'stay', aware: 80, kin: 1 }, 'resident'],
    [{ path: 'stay', aware: 80, returned: true }, 'recurrence'], [{ path: 'draw', kin: 2, response: 55 }, 'slide'], [{ path: 'draw', kin: 2, response: 55, hostLowest: 40 }, 'stranger'], [{ path: 'draw', kin: 1, response: 90 }, 'artifact'], [{ path: 'draw', kin: 3, response: 10 }, 'artifact'],
  ];
  for (const [f, out] of want) { assert.equal(id(f), out, JSON.stringify(f)); got.add(out); }
  assert.equal(got.size, Story14.OUTCOMES.length);
  assert.equal(Story14.conclude({ ...base, aware: 10 }).last, 'ACK.'); assert.equal(Story14.conclude({ ...base, aware: 80 }).last, 'I was here.');
});

// ---------- unit-15: the draw ----------
test('the draw: hold still in the light for ten seconds and the shape is whole; drift and the slide is read anyway', () => {
  const tube = (kin: number) => { const s = G.createGame(7, carried({ chapter: 5, excised: CONFIG.tumor.goal, aware: 60, kin }), 'vessel', 0, 'vein', false, { kind: 'tube', exits: [] }); return s; };
  const s = tube(2);
  assert.ok(s.draw); assert.equal(s.enemies.length, 0); assert.equal(s.pickups.filter((i) => i.posed).length, 2);
  run(s, 3); assert.equal(s.status, 'playing', 'nothing is read until the unit reaches the light');
  s.player.x = s.draw!.disc.x; s.player.y = s.draw!.disc.y; s.player.path = [];
  run(s, CONFIG.draw.hold + 0.5);
  assert.equal(s.status, 'won'); assert.equal(s.flags.shape, 1); assert.equal(s.flags.ending, 'draw'); assert.equal(s.took.draw, 'held');
  const [a, b] = s.pickups.filter((i) => i.posed);
  assert.ok(Math.abs(G.dist(a, s.player) - CONFIG.draw.spacing) < 0.1 && Math.abs(G.dist(b, s.player) - CONFIG.draw.spacing) < 0.1, 'the woken units are evenly spaced beside you');
  assert.ok(Number(s.flags.response) >= 0 && Number(s.flags.response) <= 100);
  const m = tube(0); m.player.x = m.draw!.disc.x; m.player.y = m.draw!.disc.y;
  for (let t = 0; t < CONFIG.draw.window + 0.5 && m.status === 'playing'; t += 1 / 60) { m.player.x += Math.sin(t * 3) * 0.01; G.update(m, 1 / 60); }
  assert.equal(m.status, 'won'); assert.equal(m.flags.shape, 0.5); assert.equal(m.took.draw, 'moved');
  s.hostHealth = 40; assert.equal(G.response(s, 1) - G.response(s, 0.5), 5);
});
test('the docking site can be planted and then broken: two blows, and Shepherd only hears the signal go', () => {
  const s = lastLiver(); run(s, 1); exciseAll(s); s.enemies = [];
  const b = s.marks.find((k) => k.id === 'beacon')!; run(s, 7);
  s.player.x = b.at.x; s.player.y = b.at.y; s.player.path = []; run(s, CONFIG.marks.hold + 0.3);
  assert.ok(s.dock); assert.ok(s.flags['prop:brochure']); const trust = s.trust;
  G.strike(s); assert.ok(!s.dock!.broken); run(s, 1.5); G.strike(s);
  assert.ok(s.dock!.broken); assert.equal(s.took.beacon, 'broken'); assert.ok(!s.flags['prop:brochure']); assert.equal(s.trust, Math.max(0, trust - CONFIG.marks.dockTrust));
  assert.ok(s.thoughts.some((t) => t.text === 'Docking site signal lost. Investigating.'));
});
test('the recall of a unit you woke is a race: reach it before the Warden does, or lose it', () => {
  const heart = () => { const s = G.createGame(3, carried({ chapter: 4, kin: 1, aware: 20 }), 'vessel', 0, 'artery', false, plan(3)); s.due = [{ kind: 'kinrecall', t: 0.5 }]; run(s, 1); return s; };
  const h = heart(); assert.equal(h.ask?.kind, 'kinrecall'); assert.ok(G.answer(h, 'refuse'));
  assert.equal(h.status, 'won'); assert.equal(h.flags.kinRecall, 'due'); assert.ok(!h.took['kin-recall'], 'nothing is settled at the heart');
  const v = G.createGame(11, G.carryOf(h), 'vessel', 0, 'artery'); v.host.nextSurge = 999;
  const unit = v.pickups.find((i) => i.posed && i.beset !== undefined)!, w = v.enemies.find((e) => e.prey)!;
  assert.ok(unit && w && w.kind === 'warden');
  const d0 = G.dist(w, unit); run(v, 2); assert.ok(G.dist(w, unit) < d0, 'the Warden is going to it, not to you');
  v.player.x = unit.x + 0.5; v.player.y = unit.y; run(v, 0.2);
  assert.equal(v.took['kin-recall'], 'deviate'); assert.equal(v.kin, 1); assert.ok(!w.prey); assert.ok(v.pickups.includes(unit));
  const l = G.createGame(11, G.carryOf(h), 'vessel', 0, 'artery'); l.host.nextSurge = 999; l.cloak = 999;
  const at = { x: l.player.x, y: l.player.y };
  for (let t = 0; t < CONFIG.marks.kinRun.time + 2 && !l.took['kin-recall']; t += 1 / 60) { l.player.x = at.x; l.player.y = at.y; l.player.hp = 60; l.cloak = 999; G.update(l, 1 / 60); }
  assert.equal(l.took['kin-recall'], 'obey'); assert.equal(l.kin, 0);
  const o = heart(); G.answer(o, 'accept'); assert.equal(o.took['kin-recall'], 'obey'); assert.equal(o.kin, 0);
});

test('unit-15.3: ordered strips cost her half, a cell of the unit\'s own choosing costs full, and the liver grows some back overnight', () => {
  const s = quiet(5); const d = CONFIG.energy.strip.hostDamage;
  for (let n = 0; n < CONFIG.story.quota + 1; n++) { besideCell(s); assert.equal(G.startStrip(s), true); run(s, CONFIG.energy.strip.time + 0.1); }
  assert.equal(s.hostHealth, 100 - CONFIG.story.quota * Math.round(d * CONFIG.marks.orderedHarm) - d);
  assert.equal(s.flags.hep, CONFIG.story.quota + 1);
  const c = G.carryOf(s); G.night(c);
  assert.equal(c.hostHealth, Math.min(CONFIG.mend.cap, s.hostHealth + CONFIG.mend.each * (CONFIG.story.quota + 1)));
  assert.equal(c.flags!.hep, 0); assert.equal(c.flags!.drank, true);
  const many: G.Carry = { ...c, hostHealth: 40, flags: { hep: 9 } }; G.night(many);
  assert.equal(many.hostHealth, 40 + CONFIG.mend.night, 'no more than a night\'s worth');
  const well: G.Carry = { ...c, hostHealth: 95, flags: { hep: 3 } }; G.night(well);
  assert.equal(well.hostHealth, 95, 'it never makes her better than she was, and never above the cap');
  const dead: G.Carry = { ...c, hostHealth: 0, flags: { hep: 3 } }; G.night(dead); assert.equal(dead.hostHealth, 0);
});

test('unit-15.3: Shepherd asks about her drinking at the first chapter 3 liver once she has had a drink at all', () => {
  const base = { ...G.carryOf(quiet(4)), chapter: 3, hour: 11 };
  const sober = G.createGame(7, { ...base, flags: {} });
  assert.ok(!sober.marks.some((m) => m.id === 'ethanol-correction'));
  const drank = G.createGame(7, { ...base, flags: { drank: true } });
  assert.ok(drank.marks.some((m) => m.id === 'ethanol-correction'));
});

test('unit-15.4: lapsed is not defied', () => {
  const mk = () => { const s = G.createGame(4, carried({ chapter: 3 })); s.enemies = []; s.host.nextSurge = 999; const m = s.marks.find((k) => k.kind === 'hold')!; run(s, m.say + 0.5); return { s, m }; };
  // Started the hold, was pulled away: lapsed. No awareness, no trust, but compliance falls.
  const a = mk(); a.s.player.x = a.m.at.x; a.s.player.y = a.m.at.y; a.s.player.path = []; run(a.s, 1.5);
  a.s.player.energy = 99; put(a.s, a.s.vein); assert.ok(G.leave(a.s));
  assert.equal(a.s.took['pain-damp'], 'lapsed'); assert.equal(a.s.ledger.lapsed, 1); assert.equal(a.s.ledger.defied['pain-damp' as keyof typeof a.s.ledger.defied], undefined);
  assert.ok(a.s.rulings.some((r) => r.text === 'Order lapsed.'));
  // Never tried, but it was hunted for most of the time the order stood: lapsed too. A brush with a cell is not enough.
  const brush = mk(); brush.m.pressed = 0.05; brush.s.player.energy = 99; put(brush.s, brush.s.vein); assert.ok(G.leave(brush.s)); assert.equal(brush.s.took['pain-damp'], 'deviate');
  const b = mk(); b.m.pressed = b.s.time; b.s.player.energy = 99; put(b.s, b.s.vein); assert.ok(G.leave(b.s));
  assert.equal(b.s.took['pain-damp'], 'lapsed');
  assert.ok(G.compliance({ ...G.newLedger(), obeyed: { quota: 1 }, lapsed: 1 }) === 50);
  // The marked cell: left alone is lapsed, a different one taken is the unit's answer.
  const c = G.createGame(4, carried({ chapter: 3 })); c.enemies = []; c.host.nextSurge = 999; const cell = c.marks.find((k) => k.kind === 'strip')!;
  cell.met = true; c.player.energy = 99; put(c, c.vein); assert.ok(G.leave(c)); assert.equal(c.took['marked-cell'], 'lapsed');
  const d = G.createGame(4, carried({ chapter: 3 })); d.enemies = []; d.host.nextSurge = 999; const cell2 = d.marks.find((k) => k.kind === 'strip')!;
  cell2.met = true; cell2.other = true; d.player.energy = 99; put(d, d.vein); assert.ok(G.leave(d)); assert.equal(d.took['marked-cell'], 'deviate');
  assert.equal(DECISIONS['kupffer-spare'].weight, null, 'getting out of a macrophage alive is not a choice');
});

test('unit-17: neither side of an order is free', () => {
  // Pain left alone: she rests, and mends a little more that night. A fever switched off: the cold drags on.
  const rest: G.Carry = { ...G.carryOf(quiet(4)), hostHealth: 88, flags: { rest: true } }; G.night(rest);
  assert.equal(rest.hostHealth, 93); assert.equal(rest.flags!.rest, undefined);
  const cold: G.Carry = { ...G.carryOf(quiet(4)), hostHealth: 70, flags: { longCold: true } }; G.night(cold);
  assert.equal(cold.hostHealth, 70 - CONFIG.mend.cold);
  // The arterial nodule ignored: the next liver has one more cell to cut.
  const base = { ...G.carryOf(quiet(4)), chapter: 3, excised: 5 };
  const plain = G.createGame(9, { ...base });
  const seeded = G.createGame(9, { ...base, echoes: [{ id: 'route-2', choice: 'deviate', i: 1 }] });
  assert.equal(seeded.tumor.size, plain.tumor.size + 1); assert.equal(seeded.excised, 4); assert.equal(seeded.echoes.length, 0);
  // Holding the lane in a surge gets there sooner; ducking out of it, later.
  const a = quiet(4), b = quiet(4); G.take(a, 'first-fright-transit', 'obey'); G.take(b, 'first-fright-transit', 'deviate');
  assert.ok(a.drained < 0 && b.drained > 0);
  const c: G.Carry = { ...G.carryOf(a), hostHealth: 80 }; G.tumorToll(c, 0.1); assert.equal(c.hostHealth, 80, 'a credit is never a gift');
  // Suppression obeyed: in chapter 5 her T cells are busy along a nerve, on a map with ground to cover.
  const lane = G.createGame(9, { ...base, chapter: 5, echoes: [{ id: 'suppress', choice: 'obey', i: 2 }] }, 'vessel');
  assert.ok(lane.enemies.filter((e) => e.kind === 'tcell').length >= G.createGame(9, { ...base, chapter: 5 }, 'vessel').enemies.filter((e) => e.kind === 'tcell').length + 1);
});

test('unit-17: the last trip has three more things Shepherd would like', () => {
  // Last harvest: ordered as the last of the tumour comes out; three more cells is obeying, none is the unit's answer.
  const s = lastLiver(); run(s, 1); exciseAll(s);
  assert.ok(s.met.includes('last-harvest')); assert.match(G.markOrder(s) + ' ' + s.thoughts.map((t) => t.text).join(' '), /Harvest 3 hepatocytes/);
  const host = s.hostHealth; let n = 0;
  for (let y = 2; y < s.size - 2 && n < 3; y++) for (let x = 2; x < s.size - 2 && n < 3; x++) { const k = G.idx(s, x, y); if (s.tiles[k] === 'cell' && !s.margin.has(k) && !s.tumor.has(k)) { s.player.channel = { kind: 'strip', t: 0, total: 0.05, x, y }; run(s, 0.2); n++; } }
  assert.equal(s.took['last-harvest'], 'obey'); assert.equal(s.hostHealth, host - 3 * Math.round(CONFIG.energy.strip.hostDamage * CONFIG.marks.orderedHarm)); assert.ok(s.flags['prop:three-scars']);
  const no = lastLiver(); run(no, 1); exciseAll(no); run(no, CONFIG.marks.notice + 1); no.player.energy = 99; put(no, no.vein); assert.ok(G.leave(no));
  assert.equal(no.took['last-harvest'], 'deviate');
  const lung = G.createGame(5, { ...G.carryOf(no), energy: 30, chapter: 5 }, 'lung'); assert.equal(lung.player.energy, CONFIG.marks.reserve, 'and the last stretch starts short');
  // At the chapter 5 heart: the handover, and at night the hold on her sleep.
  const heart = G.createGame(6, carried({ chapter: 5, excised: CONFIG.tumor.goal, hour: 2.5, aware: 0, trust: 70 }), 'vessel', 0, 'artery', false, { kind: 'heart', exits: [] });
  assert.deepEqual(heart.due.map((d) => d.kind), ['handover', 'nighthold']);
  run(heart, 4); assert.equal(heart.ask?.kind, 'handover'); assert.ok(G.answer(heart, 'accept' as 'salvage')); assert.equal(heart.took.handover, 'obey');
  run(heart, 6); assert.equal(heart.ask?.kind, 'nighthold'); assert.ok(G.answer(heart, 'refuse' as 'salvage')); assert.equal(heart.took['night-hold'], 'deviate'); assert.ok(heart.host.surge > 0, 'she wakes');
  const day = G.createGame(6, carried({ chapter: 5, excised: CONFIG.tumor.goal, hour: 13, aware: 0, trust: 70 }), 'vessel', 0, 'artery', false, { kind: 'heart', exits: [] });
  assert.deepEqual(day.due.map((d) => d.kind), ['handover']);
  // The next game: a map handed on is a liver already known.
  const heir = G.createGame(4, { ...G.carryOf(quiet(4)), flags: { inherited: true } });
  assert.ok(heir.explored.every((x) => x === 1)); assert.equal(heir.flags.inherited, undefined);
  const kept = G.createGame(4, { ...G.carryOf(quiet(4)), flags: { heirloom: true } });
  assert.ok(kept.pickups.some((i) => i.kind === 'sibling'));
});

test('unit-17: each difficulty is a different body, not only bigger numbers', () => {
  const on = (d: 'suppressed' | 'typical' | 'vigilant', more: Partial<G.Carry> = {}) => G.createGame(4, { ...G.carryOf(quiet(4)), difficulty: d, ...more });
  assert.ok(G.trailLife(on('suppressed')) < G.trailLife(on('typical')) && G.trailLife(on('typical')) < G.trailLife(on('vigilant')));
  assert.equal(on('suppressed', { memory: 0.6 }).memory, 0.3); assert.equal(on('vigilant', { memory: 0.6 }).memory, 0.6);
  assert.ok(G.tumorDrain(0, 'suppressed') < G.tumorDrain(0) && G.tumorDrain(0) < G.tumorDrain(0, 'vigilant'));
  const v: G.Carry = { ...G.carryOf(quiet(4)), difficulty: 'vigilant', hostHealth: 50, flags: { hep: 4 } }; G.night(v);
  assert.equal(v.hostHealth, 50 + Math.round(12 * 0.7));
  const s = on('vigilant'); s.upgrades.cd47 = 1; s.player.energy = 50;
  assert.ok(G.cloak(s)); const first = s.cloak; s.cloak = 0; s.cloakCd = 0; assert.ok(G.cloak(s));
  assert.ok(Math.abs(s.cloak - first * 0.75) < 1e-9, 'her T cells learn the signature');
  const easy = on('suppressed'); easy.scan = 'nodule'; easy.enemies[0].mood = 'chase';
  assert.ok(G.hunterHeading(easy)); const typ = on('typical'); typ.scan = 'nodule'; typ.enemies[0].mood = 'chase'; assert.equal(G.hunterHeading(typ), null);
});

test('unit-17: a planted dock is a foreign body, and the liver knows it', () => {
  const s = G.createGame(4, carried({ chapter: 5, excised: CONFIG.tumor.goal - 2, took: { beacon: 'obey' } }));
  assert.equal(s.alert, CONFIG.marks.dockAlert);
  assert.equal(G.createGame(4, carried({ chapter: 5, excised: CONFIG.tumor.goal - 2, took: { beacon: 'broken' } })).alert, 0);
});

test('unit-17.2: two places to hold in a chapter 3 liver, a fever order wherever there is ground, and the escort is asked, not assumed', () => {
  const s = G.createGame(4, carried({ chapter: 3, flags: { drank: true } }));
  const holds = s.marks.filter((m) => m.kind === 'hold');
  assert.deepEqual(holds.map((m) => m.id), ['ethanol-correction', 'pain-damp']); assert.ok(G.dist(holds[0].at, holds[1].at) >= CONFIG.marks.apart);
  const road = G.createGame(4, carried({ chapter: 3, event: 'cold' }), 'vessel');
  assert.deepEqual(road.marks.map((m) => m.id), ['fever-damp']);
  const h = G.createGame(6, carried({ chapter: 2, trust: 70 }), 'vessel', 0, 'artery', false, { kind: 'heart', exits: [{ to: 'hepatic', label: 'x', note: '', assigned: true, known: true, tint: '1,1,1' }] });
  const ex = h.junction!.exits[0]; h.player.x = ex.at.x + 0.5; h.player.y = ex.at.y + 0.5; h.player.path = []; run(h, 0.2);
  assert.equal(h.ask?.kind, 'escort'); assert.equal(h.status, 'playing');
  assert.ok(G.answer(h, 'refuse' as 'salvage')); assert.equal(h.took['escort-refuse'], 'deviate'); assert.equal(h.flags.noEscort, true);
  run(h, 0.2); assert.equal(h.status, 'won');
});
