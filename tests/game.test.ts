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
  s.player.energy = CONFIG.energy.quota;
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
  assert.equal(G.maxHp(s), base.hp + 24);
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
  run(s, 0.2);
  assert.equal(G.cloaked(s), true);
  assert.equal(s.player.energy, CONFIG.player.startEnergy - CONFIG.cloak.energy);
  assert.equal(e.mood, 'patrol');
  assert.ok(e.idle > 1.5, 'it stands there confused');
  assert.equal(s.player.hp, G.maxHp(s));
  const plain = quiet(21);
  const e2 = foe(plain, 1.1, 0);
  run(plain, 0.2);
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
  s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; s.player.energy = CONFIG.energy.quota + 3;
  assert.ok(G.leave(s));
  assert.equal(G.carryOf(s).energy, 3);
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
  s.host.nextSurge = 0;
  run(s, 2);
  assert.equal(G.hostState(s), 'asleep', 'nothing frightens a sleeping host');
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
  s.player.hp = 40; s.host.hour = 12.6; // just eaten
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
  const t = G.createGame(5, undefined, 'stomach'); t.host.nextSurge = 999; t.host.hour = 12.6;
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
