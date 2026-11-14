// Rough balance check: two simple bots play many livers, one skimming and one stripping.
// Run with: npx tsx scripts/sim.ts
import { CONFIG } from '../src/config';
import * as G from '../src/game';

type Bot = 'slow' | 'fast';
const VEIN = { x: 13, y: 7 };

function fightIfCornered(s: G.State): boolean {
  const near = s.enemies.filter((e) => Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) === 1);
  if (near.length && s.player.ap >= CONFIG.player.strike.ap) return G.attack(s, near[0].id);
  return false;
}

function walkToward(s: G.State, to: G.Point): boolean {
  const path = G.findPath(s, s.player, to);
  if (!path?.length) return false;
  return G.step(s, path[0].x - s.player.x, path[0].y - s.player.y);
}

function play(bot: Bot, seed: number) {
  const s = G.createGame(seed);
  while (s.status === 'playing' && s.turn < 300) {
    let acted = true;
    while (acted && s.status === 'playing' && s.player.ap > 0) {
      acted = false;
      if (G.canLeave(s)) { G.leave(s); break; }
      if (fightIfCornered(s)) { acted = true; continue; }
      if (s.player.energy >= CONFIG.energy.quota + 1) { acted = walkToward(s, VEIN); continue; }
      if (bot === 'fast') {
        // A sensible thief does the damage close to the exit.
        const close = G.distance(s.player, VEIN) <= (process.argv.includes('--greedy') ? 99 : 3);
        const cells = close ? G.strippable(s) : [];
        if (cells.length) { acted = G.strip(s, cells[0].x, cells[0].y); continue; }
        acted = walkToward(s, VEIN); // more cells line the way
        continue;
      }
      if (G.canSkim(s)) { acted = G.skim(s); continue; }
      if (G.glucoseHere(s) > 0) continue; // wait for AP
      let best: G.Point | null = null, bestLen = Infinity;
      for (const [k, v] of s.glucose) {
        if (!v) continue;
        const [x, y] = k.split(',').map(Number);
        const len = G.findPath(s, s.player, { x, y })?.length ?? Infinity;
        if (len < bestLen) { bestLen = len; best = { x, y }; }
      }
      acted = best ? walkToward(s, best) : walkToward(s, VEIN);
    }
    G.endTurn(s);
  }
  return s;
}

for (const bot of ['slow', 'fast'] as Bot[]) {
  const runs = Array.from({ length: 300 }, (_, i) => play(bot, i + 1));
  const won = runs.filter((r) => r.status === 'won');
  const avg = (f: (s: G.State) => number, of = won) => (of.reduce((a, r) => a + f(r), 0) / Math.max(1, of.length)).toFixed(1);
  console.log(`${bot}: won ${won.length}/300, turns ${avg((r) => r.turn)}, hp left ${avg((r) => r.player.hp)}, host ${avg((r) => r.hostHealth)}, peak-ish alert ${avg((r) => r.alert)}`);
}
if (process.argv.includes('--why')) {
  const s = play('fast', 1);
  console.log(s.status, 'turn', s.turn, 'energy', s.player.energy, 'at', s.player.x, s.player.y, 'killed', s.cellsKilled);
  console.log(s.log.slice(-8).join('\n'));
}
