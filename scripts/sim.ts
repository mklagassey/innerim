// Balance check: simple bots play whole round trips (heart to liver and home) in fast-forward,
// on each of the three routes, carrying the ship from map to map the way the game does.
// Run with: npx tsx scripts/sim.ts [runs=60] [trips=1]
// The bots cheat by knowing the map, so this measures the fights and the economy, not the exploring.
import { CONFIG } from '../src/config';
import * as G from '../src/game';
import * as T from '../src/trip';
import { UPGRADES, UpgradeId } from '../src/config';

type Bot = 'skim' | 'strip';
const DT = 1 / 20, CAP = 420; // seconds a bot may spend in one map before it counts as stuck
const RUNS = Number(process.argv[2] ?? 60), TRIPS = Number(process.argv[3] ?? 1);

const ROUTES: Record<string, T.NodeId[]> = {
  hepatic: ['hepatic', 'liver', 'hvein', 'cava', 'heart'],
  mesenteric: ['mesenteric', 'gut', 'portal', 'liver', 'hvein', 'cava', 'heart'],
  gastric: ['gastric', 'stomach', 'portal', 'liver', 'hvein', 'cava', 'heart'],
};

const freshCarry = (): G.Carry => ({ hp: CONFIG.player.maxHp, energy: CONFIG.player.startEnergy, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>, patches: 1, hostHealth: CONFIG.host.maxHealth, hour: CONFIG.host.startHour, memory: 0, excised: 0, nap: 0, snack: -1, aware: 0, kin: 0 });

const mid = (s: G.State, k: number) => ({ x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 });

/** The nearest open tile beside a living cell that is far from any immune cell and from where we last did damage. */
function quietCell(s: G.State, avoid: G.Point | null): G.Point | null {
  let best: G.Point | null = null, bestD = Infinity;
  for (let y = 2; y < s.size - 2; y++)
    for (let x = 2; x < s.size - 2; x++) {
      if (!G.open(s, x, y)) continue;
      const here = { x: x + 0.5, y: y + 0.5 }, d = G.dist(here, s.player);
      if (d >= bestD) continue;
      if (!['cell'].includes(s.tiles[G.idx(s, x + 1, y)] as string) && s.tiles[G.idx(s, x - 1, y)] !== 'cell' && s.tiles[G.idx(s, x, y + 1)] !== 'cell' && s.tiles[G.idx(s, x, y - 1)] !== 'cell') continue;
      if (avoid && G.dist(here, avoid) < 7) continue;
      if (G.enemyNear(s, here, 10)) continue;
      best = here; bestD = d;
    }
  return best;
}

/** A spot a few tiles across the current from here: scent travels downstream, so that is the way out of it. */
function acrossCurrent(s: G.State): G.Point | null {
  const f = G.currentAt(s, s.player), len = Math.hypot(f.x, f.y) || 1;
  for (const side of [1, -1])
    for (let far = 9; far >= 4; far--) {
      const x = Math.floor(s.player.x + (-f.y / len) * far * side), y = Math.floor(s.player.y + (f.x / len) * far * side);
      if (x > 1 && y > 1 && x < s.size - 2 && y < s.size - 2 && G.open(s, x, y) && !G.enemyNear(s, { x, y }, 6)) return { x: x + 0.5, y: y + 0.5 };
    }
  return null;
}

/** Plays one local map to its end. */
function play(bot: Bot, s: G.State): { s: G.State; cause: string } {
  let plan = 0, lastSite: G.Point | null = null, flee = 0, killed = s.cellsKilled;
  const need = () => CONFIG.energy.quota + CONFIG.energy.quotaKeep;
  while (s.status === 'playing' && s.time < CAP && s.hostHealth > 0) {
    s.explored.fill(1);
    if (s.offer) G.choose(s, s.offer[0]);
    if (s.ask) G.answer(s, 'leave');
    const p = s.player, vein = { x: s.vein.x + 0.5, y: s.vein.y + 0.5 };
    if (s.cellsKilled > killed) { killed = s.cellsKilled; lastSite = { x: p.x, y: p.y }; flee = 6; plan = 0; }
    flee -= DT;
    const foe = G.enemyNear(s, p, 2.2);
    if (G.canLeave(s)) G.leave(s);
    else if (foe) { if (p.attackId !== foe.id) G.attack(s, foe.id); }
    else if (!p.channel && (plan -= DT) <= 0) {
      plan = 0.4;
      const fed = s.place !== 'liver' || p.energy >= need();
      if (fed) G.moveTo(s, vein.x, vein.y);
      else if (bot === 'strip') {
        if (flee > 0) { const away = acrossCurrent(s); if (away) { G.moveTo(s, away.x, away.y); plan = flee; flee = 0; } }
        else if (G.stripTarget(s) && !G.enemyNear(s, p, 10)) G.startStrip(s);
        else { const at = quietCell(s, lastSite) ?? quietCell(s, null); if (at) G.moveTo(s, at.x, at.y); else G.moveTo(s, vein.x, vein.y); }
      } else if (G.glucoseHere(s) > 0) G.startSkim(s);
      else {
        let best: G.Point | null = null, bestD = Infinity;
        for (const [k, v] of s.glucose) { const g = mid(s, k); if (v > 0 && G.dist(p, g) < bestD) { bestD = G.dist(p, g); best = g; } }
        if (best) G.moveTo(s, best.x, best.y);
      }
    }
    G.update(s, DT);
  }
  const last = s.log[s.log.length - 1]?.text ?? '';
  const cause = s.status === 'won' ? '' : s.hostHealth <= 0 ? 'host died' : s.status !== 'dead' ? `stuck in ${s.place}`
    : /acid/i.test(last) ? 'acid' : /Kupffer/.test(last) ? 'macrophage' : /T cell/.test(last) ? 'T cell' : /neutrophil/i.test(last) ? 'neutrophils' : /warden/.test(last) ? 'warden' : /wall/.test(last) ? 'slammed into a wall' : `other in ${s.place}`;
  return { s, cause: cause && s.status === 'dead' ? `${cause} (${s.place})` : cause };
}

interface Stop { hp: number; energy: number }
interface Run { home: boolean; cause: string; stops: Record<string, Stop>; host: number; liverTime: number; liverHost: number }

/** One or more round trips along a fixed route. */
function trip(bot: Bot, route: T.NodeId[], seed: number): Run {
  const t = T.newTrip(seed);
  const out: Run = { home: false, cause: '', stops: {}, host: CONFIG.host.maxHealth, liverTime: 0, liverHost: 0 };
  let n = 0;
  for (let round = 0; round < TRIPS; round++) {
    for (const to of route) {
      const o = T.depart(t, to);
      if (!o) { out.cause = `no way to ${to}`; return out; }
      if (o.kind === 'arrive') {
        if (t.carry) { t.carry.hour = (t.carry.hour + CONFIG.wait.legHours) % 24; G.tumorToll(t.carry, CONFIG.wait.legHours); }
        T.arrive(t, to, null, 0);
      } else {
        const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
        const g = G.createGame(seed * 1000 + ++n, t.carry ?? undefined, o.kind === 'patrol' ? 'vessel' : o.kind, o.kind === 'patrol' ? o.size : 0, vessel);
        const host0 = g.hostHealth, r = play(bot, g);
        if (g.place === 'liver' && round === 0) { out.liverTime = g.time; out.liverHost = host0 - g.hostHealth; }
        if (r.cause) { out.cause = r.cause; out.host = g.hostHealth; return out; }
        T.arrive(t, to, G.carryOf(g), g.alert);
      }
      t.carry ??= freshCarry();
      if (round === 0) out.stops[to] = { hp: t.carry.hp, energy: t.carry.energy };
      out.host = t.carry.hostHealth;
      if (t.carry.hostHealth <= 0) { out.cause = 'host died'; return out; }
    }
  }
  out.home = true;
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x: number) => (Number.isNaN(x) ? '-' : x.toFixed(0));
const liver: Record<string, Record<Bot, { time: number; host: number }>> = {};
for (const [name, route] of Object.entries(ROUTES)) {
  for (const bot of ['skim', 'strip'] as Bot[]) {
    const runs = Array.from({ length: RUNS }, (_, i) => trip(bot, route, i + 1));
    const home = runs.filter((r) => r.home), reached = runs.filter((r) => r.liverTime && r.stops.hvein);
    const causes: Record<string, number> = {};
    for (const r of runs) if (r.cause) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
    (liver[name] ??= {} as never)[bot] = { time: mean(reached.map((r) => r.liverTime)), host: mean(reached.map((r) => r.liverHost)) };
    console.log(`\n${name} / ${bot}: home ${home.length}/${RUNS} (${Math.round((100 * home.length) / RUNS)}%), host at end ${f(mean(home.map((r) => r.host)))}%`);
    console.log('  hull/energy at ' + route.map((to) => { const at = runs.filter((r) => r.stops[to]); return `${to} ${f(mean(at.map((r) => r.stops[to].hp)))}/${f(mean(at.map((r) => r.stops[to].energy)))} (n=${at.length})`; }).join(', '));
    console.log(`  liver: ${f(mean(reached.map((r) => r.liverTime)))} s, host change ${f(-mean(reached.map((r) => r.liverHost)))}`);
    console.log('  lost to: ' + (Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(', ') || 'nothing'));
  }
}
console.log('\nTargets: skim home >= 90% on every route; strip finishes the liver >= 40% faster at <= 25 extra host damage.');
for (const [name, b] of Object.entries(liver)) console.log(`  ${name}: strip is ${f(100 * (1 - b.strip.time / b.skim.time))}% faster in the liver, ${f(b.strip.host - b.skim.host)} extra host damage`);
