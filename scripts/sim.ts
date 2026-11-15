// Rough balance check: two simple bots play many livers in fast-forward, one skimming
// glucose and one stripping cells. Run with: npx tsx scripts/sim.ts
import { CONFIG } from '../src/config';
import * as G from '../src/game';

type Bot = 'slow' | 'fast';
const DT = 1 / 20;
const near = Number(process.argv[2] ?? 14); // how close to the exit the thief starts stripping

/** Cheats by knowing the map, so it measures the fight and the economy, not the exploring. */
function play(bot: Bot, seed: number) {
  const s = G.createGame(seed);
  let plan = 0;
  while (s.status === 'playing' && s.time < 150) {
    s.explored.fill(1);
    if (s.offer) G.choose(s, s.offer[0]); // takes whatever is offered first, so the clock keeps running
    const p = s.player;
    const foe = G.enemyNear(s, p, 2.2);
    if (G.canLeave(s)) G.leave(s);
    else if (foe) { if (p.attackId !== foe.id) G.attack(s, foe.id); }
    else if (!p.channel && (plan -= DT) <= 0) {
      plan = 0.4;
      if (p.energy >= CONFIG.energy.quota + (bot === 'slow' ? 1 : 0)) G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5);
      else if (bot === 'fast' && p.energy < CONFIG.energy.quota && G.dist(p, s.vein) < near && G.stripTarget(s)) G.startStrip(s);
      else if (bot === 'fast') {
        G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5);
      } else if (G.glucoseHere(s) > 0) G.startSkim(s);
      else {
        let best: G.Point | null = null, bestD = Infinity;
        for (const [k, v] of s.glucose) {
          const g = { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 };
          if (v > 0 && G.dist(p, g) < bestD) { bestD = G.dist(p, g); best = g; }
        }
        if (best) G.moveTo(s, best.x, best.y);
      }
    }
    G.update(s, DT);
  }
  return s;
}

for (const bot of ['slow', 'fast'] as Bot[]) {
  const runs = Array.from({ length: 60 }, (_, i) => play(bot, i + 1));
  const won = runs.filter((r) => r.status === 'won');
  const avg = (f: (s: G.State) => number) => (won.reduce((a, r) => a + f(r), 0) / Math.max(1, won.length)).toFixed(0);
  console.log(`${bot}: won ${won.length}/60, seconds ${avg((r) => r.time)}, life left ${avg((r) => r.player.hp)}, host ${avg((r) => r.hostHealth)}, kills ${avg((r) => r.kills)}`);
}
