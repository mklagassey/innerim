// QA acceptance checks against systems-design "Done when" lines.
import { CONFIG, UPGRADES } from '../src/config';
import * as G from '../src/game';
const up = () => Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as any;
const carry = (o: Partial<G.Carry> = {}): G.Carry => ({ hp: 40, energy: CONFIG.player.startEnergy, upgrades: up(), patches: 0, hostHealth: 100, hour: 11, memory: 0, excised: 0, nap: 0, snack: -1, aware: 0, kin: 0, ...o });
const mid = (i: number, N: number) => ({ x: (i % N) + 0.5, y: Math.floor(i / N) + 0.5 });
const out: string[] = [];

// S1a: standing in full-strength acid, no patches.
{
  const s = G.createGame(1, carry({ hour: 19.5, patches: 0 }), 'stomach');
  s.enemies = [];
  let acidTile = -1; for (let i = 0; i < s.acid!.length; i++) if (s.acid![i] === 2) { acidTile = i; break; }
  Object.assign(s.player, mid(acidTile, s.size));
  while (s.status === 'playing' && s.time < 60) { (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, 0.05)); s.player.x = mid(acidTile, s.size).x; s.player.y = mid(acidTile, s.size).y; }
  console.log(`S1a full acid, 40 hull, no patch: dead after ${s.time.toFixed(1)} s (want >= 8), acid level ${G.acidLevel(s).toFixed(2)}`);
  const s2 = G.createGame(1, carry({ hour: 19.5, patches: 1 }), 'stomach'); s2.enemies = [];
  while (s2.status === 'playing' && s2.time < 60) { (s2.offer && G.choose(s2, s2.offer[0]), s2.ask && G.answer(s2, "leave" as any), G.update(s2, 0.05)); Object.assign(s2.player, mid(acidTile, s2.size)); }
  console.log(`S1a same with 1 patch (auto-patch): dead after ${s2.time.toFixed(1)} s`);
}
// S1 rim glucose count + rim bot surviving a meal mid-visit.
{
  let rimCounts: number[] = [], dead = 0, lost = 0, acidSecs = 0, unreachable = 0; const N = 15;
  for (let seed = 1; seed <= N; seed++) {
    const s = G.createGame(seed, carry({ hour: 18.4, patches: 1 }), 'stomach');
    const rim = [...s.glucose.keys()].filter((k) => s.acid![k] === 1);
    rimCounts.push(rim.length);
    let re = 0;
    while (s.status === 'playing' && s.time < 200) {
      if (s.offer) G.choose(s, s.offer[0]);
      const p = s.player; const left = rim.filter((k) => (s.glucose.get(k) ?? 0) > 0);
      if (G.canLeave(s)) G.leave(s);
      else if (!p.channel && (re -= 0.05) <= 0) {
        re = 0.4;
        // stay on the rim until the meal (19:00) has landed and ~30 s have passed, then go
        if (left.length && s.host.hour < 19.8) {
          let best = left[0], bd = Infinity; for (const k of left) { const d = G.dist(p, mid(k, s.size)); if (d < bd) { bd = d; best = k; } }
          if (bd < 0.5 && G.glucoseHere(s) > 0) G.startSkim(s); else if (!G.moveTo(s, mid(best, s.size).x, mid(best, s.size).y)) unreachable++;
        } else if (s.host.hour >= 19.8 || !left.length) { if (!p.path.length) G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5); }
      }
      if (G.acidAt(s, s.player) === 2) acidSecs += 0.05;
      (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, 0.05));
    }
    if (s.status !== 'won') dead++; lost += 40 - s.player.hp;
  }
  const hist: Record<number, number> = {}; for (const c of rimCounts) hist[c] = (hist[c] ?? 0) + 1;
  console.log(`S1b rim-glucose patches per stomach (count: maps) ${JSON.stringify(hist)} (want 2)`);
  console.log(`S1b rim bot entering 18:24, meal 19:00, then walks out with click-to-move: died ${dead}/${N}, avg hull lost ${(lost / N).toFixed(1)}, avg s in open acid ${(acidSecs / N).toFixed(1)}`);
}
// S1 direct crossing at various hours (what a click on the exit does).
for (const hour of [11, 13, 15.5, 19.3]) {
  let lost = 0, dead = 0, acid = 0; const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const s = G.createGame(seed, carry({ hour, patches: 1 }), 'stomach'); G.moveTo(s, s.vein.x + .5, s.vein.y + .5);
    while (s.status === 'playing' && s.time < 120) { if (s.offer) G.choose(s, s.offer[0]); if (G.canLeave(s)) G.leave(s); if (!s.player.path.length) G.moveTo(s, s.vein.x + .5, s.vein.y + .5); if (G.acidAt(s, s.player) === 2) acid += .05; (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, .05)); }
    if (s.status !== 'won') dead++; lost += 40 - s.player.hp;
  }
  console.log(`S1c click-the-exit crossing at ${hour}:00: died ${dead}/${N}, avg hull lost ${(lost / N).toFixed(1)}, avg s in open acid ${(acid / N).toFixed(1)}`);
}
// S2: trip 1 gastric route: start energy, through a patrolled gastric artery (vessel), arrive at stomach.
{
  let starve = 0, e = 0, hp = 0, dead = 0; const N = 15;
  for (let seed = 1; seed <= N; seed++) {
    const s = G.createGame(seed, carry({ energy: CONFIG.player.startEnergy, patches: 1 }), 'vessel', 3, 'artery');
    let re = 0;
    while (s.status === 'playing' && s.time < 240) {
      if (s.offer) G.choose(s, s.offer[0]);
      const p = s.player, foe = G.enemyNear(s, p, 2.2);
      if (G.canLeave(s)) G.leave(s);
      else if (foe) { if (p.attackId !== foe.id) G.attack(s, foe.id); }
      else if (!p.channel && (re -= .05) <= 0) { re = .4; if (G.glucoseHere(s) > 0) G.startSkim(s); else G.moveTo(s, s.vein.x + .5, s.vein.y + .5); }
      (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, .05));
    }
    if (s.status !== 'won') dead++; if (s.player.energy <= 0) starve++; e += s.player.energy; hp += s.player.hp;
  }
  console.log(`S2 trip-1 gastric artery (patrol 3), start energy ${CONFIG.player.startEnergy}: died ${dead}/${N}, arrived at 0 energy ${starve}/${N}, avg energy on arrival ${(e / N).toFixed(1)}, avg hull ${(hp / N).toFixed(1)}`);
}
// S3: one fright in an artery, idle ship, no enemies.
{
  let worst = 0, tot = 0; const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const s = G.createGame(seed, carry({ patches: 0 }), 'vessel', 0, 'artery'); s.enemies = []; (s as any).antibodies = [];
    for (let i = 0; i < 20; i++) (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, .05));
    s.host.nextSurge = 0.001; const hp0 = s.player.hp; let t = 0;
    while (s.status === 'playing' && t < CONFIG.host.surge.time + 3) { (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, .05)); t += .05; s.host.nextSurge = Math.max(s.host.nextSurge, 999); }
    const l = hp0 - s.player.hp; worst = Math.max(worst, l); tot += l;
  }
  console.log(`S3 idle ship through one artery fright: worst hull lost ${worst.toFixed(1)} (want <= 6), avg ${(tot / N).toFixed(1)}`);
}
// S7: T cell 3 tiles away from a cloaked ship should not find it.
{
  let found = 0; const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const s = G.createGame(seed, carry({ memory: 0.9, upgrades: { ...up(), cd47: 1 } }));
    const t = s.enemies.find((e) => e.kind === 'tcell'); if (!t) continue;
    s.enemies = [t]; G.cloak(s); s.cloak = 99;
    t.x = s.player.x + 3; t.y = s.player.y; if (!G.open(s, Math.floor(t.x), Math.floor(t.y))) { t.x = s.player.x; t.y = s.player.y + 3; }
    for (let i = 0; i < 40; i++) { (s.offer && G.choose(s, s.offer[0]), s.ask && G.answer(s, "leave" as any), G.update(s, .05)); s.cloak = 99; }
    if (t.mood === 'chase') found++;
  }
  console.log(`S7 T cell starting 3 tiles from a cloaked ship, 2 s: chased ${found}/${N} (want 0, unless it bumped into you)`);
}
console.log(out.join('\n'));
