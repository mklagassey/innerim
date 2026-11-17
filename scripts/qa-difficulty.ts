// Difficulty check: two bots play whole round trips in fast-forward (as scripts/sim.ts does) on each
// difficulty, with no god mode. "attack" goes straight for the tumour and fights anything near it;
// "stealth" runs silent, cloaks when it can, and backs off from immune cells instead of fighting.
// Neither defies an order: both answer dark units with salvage and strip only tumour, skimming glucose for fare.
// Reports deaths per seed, the cause, the host at the end and the peak alert per map.
//   npx tsx scripts/qa-difficulty.ts [seeds=20] [trips=2]
import { CONFIG, DIFFICULTY, UPGRADES, UpgradeId, Difficulty } from '../src/config';
import * as G from '../src/game';
import * as T from '../src/trip';

type Bot = 'attack' | 'stealth';
const DT = 1 / 20, CAP = 420;
const SEEDS = Number(process.argv[2] ?? 20), TRIPS = Number(process.argv[3] ?? 2);
const ROUTE: T.NodeId[] = ['hepatic', 'liver', 'hvein', 'heart'];
const fresh = (d: Difficulty): G.Carry => ({ difficulty: d, hp: CONFIG.player.maxHp, energy: DIFFICULTY[d].energy, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>, patches: 1, hostHealth: CONFIG.host.maxHealth, hour: CONFIG.host.startHour, memory: 0, excised: 0, nap: 0, snack: -1, aware: 0, kin: 0 });

function away(s: G.State, from: G.Point): G.Point | null {
  let best: G.Point | null = null, bestD = -1;
  for (let y = 2; y < s.size - 2; y++) for (let x = 2; x < s.size - 2; x++) {
    if (!G.open(s, x, y)) continue;
    const here = { x: x + 0.5, y: y + 0.5 }, d = G.dist(here, from), me = G.dist(here, s.player);
    if (me < 8 && d > bestD) { bestD = d; best = here; }
  }
  return best;
}

function play(bot: Bot, s: G.State) {
  let plan = 0, peak = s.alert, lost = 0, hp = s.player.hp;
  const need = () => CONFIG.energy.quota + CONFIG.energy.quotaKeep;
  while (s.status === 'playing' && s.time < CAP && s.hostHealth > 0) {
    s.explored.fill(1);
    if (s.offer) G.choose(s, s.offer[0]);
    if (s.ask) { if (!G.answer(s, 'salvage')) G.answer(s, 'accept') || G.answer(s, 'leave'); }
    const p = s.player, vein = { x: s.vein.x + 0.5, y: s.vein.y + 0.5 };
    peak = Math.max(peak, s.alert);
    if (p.hp < G.maxHp(s) * 0.4 && s.patches > 0) G.usePatch(s); // by hand, as a player would where autoPatch is off
    if (bot === 'stealth') { s.silent = true; const near = G.enemyNear(s, p, 5); if (near) { try { G.cloak(s); } catch { /* none */ } } }
    const foe = G.enemyNear(s, p, bot === 'attack' ? 4 : 1.6);
    if (G.canLeave(s)) G.leave(s);
    else if (foe && bot === 'attack') { if (p.attackId !== foe.id) G.attack(s, foe.id); }
    else if (foe && bot === 'stealth') { // in contact: fleeing a cell that has you does not work, so strike back
      if (p.attackId !== foe.id) G.attack(s, foe.id);
    } else if (bot === 'stealth' && G.enemyNear(s, p, 4) && !p.channel && (plan -= DT) <= 0) { plan = 1; const e = G.enemyNear(s, p, 4)!; const a = away(s, e); if (a) G.moveTo(s, a.x, a.y); }
    else if (!p.channel && (plan -= DT) <= 0) {
      plan = 0.4;
      const fed = s.place !== 'liver' || p.energy >= need();
      const target = G.stripTarget(s);
      if (s.tumor.size && target && s.tumor.has(G.idx(s, target.x, target.y))) G.startStrip(s);
      else if (s.tumor.size) {
        let best: G.Point | null = null, bestD = Infinity;
        for (const k of s.tumor) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = (k % s.size) + dx, y = Math.floor(k / s.size) + dy; if (G.open(s, x, y) && G.dist({ x: x + 0.5, y: y + 0.5 }, p) < bestD) { bestD = G.dist({ x: x + 0.5, y: y + 0.5 }, p); best = { x: x + 0.5, y: y + 0.5 }; } }
        if (best && bestD > 0.3) G.moveTo(s, best.x, best.y); else s.tumor.clear();
      } else if (fed) G.moveTo(s, vein.x, vein.y);
      else if (G.glucoseHere(s) > 0) G.startSkim(s);
      else { let best: G.Point | null = null, bestD = Infinity; for (const [k, v] of s.glucose) { const g = { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }; if (v > 0 && G.dist(p, g) < bestD) { bestD = G.dist(p, g); best = g; } } if (best) G.moveTo(s, best.x, best.y); else G.moveTo(s, vein.x, vein.y); }
    }
    G.update(s, DT);
    if (s.player.hp < hp) lost += hp - s.player.hp; hp = s.player.hp;
  }
  const last = s.log[s.log.length - 1]?.text ?? '';
  const cause = s.status === 'won' ? '' : s.hostHealth <= 0 ? 'host died' : s.status !== 'dead' ? `stuck in ${s.place}` : s.starved ? 'ran dry' : /acid/i.test(last) ? 'acid' : /Kupffer/.test(last) ? 'macrophage' : /T cell/.test(last) ? 'T cell' : /neutrophil/i.test(last) ? 'neutrophils' : /arden/.test(last) ? 'warden' : /wall/.test(last) ? 'wall' : `other: ${last.slice(0, 50)}`;
  return { cause: cause && `${cause} (${s.place})`, peak, lost };
}

function mission(d: Difficulty, bot: Bot, seed: number) {
  const t = T.newTrip(seed); let n = 0; const peaks: number[] = [];
  for (let round = 0; round < TRIPS; round++) for (const to of ROUTE) {
    const o = T.depart(t, to);
    if (!o) return { cause: `no way to ${to}`, host: t.carry?.hostHealth ?? 0, peaks };
    t.carry ??= fresh(d);
    if (o.kind === 'arrive') { t.carry.hour = (t.carry.hour + CONFIG.wait.legHours) % 24; G.tumorToll(t.carry, CONFIG.wait.legHours); T.arrive(t, to, null, 0); continue; }
    const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
    const g = G.createGame(seed * 1000 + ++n, t.carry, o.kind === 'patrol' ? 'vessel' : o.kind, o.kind === 'patrol' ? o.size : 0, vessel);
    const r = play(bot, g); peaks.push(r.peak);
    if (r.cause) return { cause: r.cause, host: g.hostHealth, peaks };
    T.arrive(t, to, G.carryOf(g), g.alert);
    if (t.carry.hostHealth <= 0) return { cause: 'host died', host: 0, peaks };
  }
  return { cause: '', host: t.carry?.hostHealth ?? 0, peaks };
}

/** Escort pair: the same seeds on the assigned route, with and without the escort, at trust 60. Hull lost and patrols met per escorted-eligible leg. */
function escortPair(d: Difficulty, bot: Bot, noEscort: boolean) {
  let legs = 0, patrols = 0, lost = 0, deaths = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t = T.newTrip(seed); let n = 0;
    t.carry = { ...fresh(d), trust: 60, flags: noEscort ? { noEscort: true } : {} };
    outer: for (let round = 0; round < TRIPS; round++) for (const to of ROUTE) {
      const leg = T.ways(t).find((l) => l.to === to), eligible = !!leg && T.assigned(t, leg) && !!leg.risk && to !== 'liver' && t.at !== 'liver';
      const o = T.depart(t, to);
      if (!o) break outer;
      if (eligible) legs++;
      if (o.kind === 'arrive') { t.carry!.hour = (t.carry!.hour + CONFIG.wait.legHours) % 24; G.tumorToll(t.carry!, CONFIG.wait.legHours); T.arrive(t, to, null, 0); continue; }
      const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
      const g = G.createGame(seed * 1000 + ++n, t.carry!, o.kind === 'patrol' ? 'vessel' : o.kind, o.kind === 'patrol' ? o.size : 0, vessel);
      const r = play(bot, g);
      if (eligible && o.kind === 'patrol') { patrols++; lost += r.lost; }
      if (r.cause) { if (!/^stuck/.test(r.cause)) deaths++; break outer; }
      T.arrive(t, to, G.carryOf(g), g.alert);
      t.carry!.flags = { ...(t.carry!.flags ?? {}), ...(noEscort ? { noEscort: true } : {}) }; t.carry!.trust = Math.max(60, t.carry!.trust ?? 60);
    }
  }
  return { legs, patrols, lost, deaths };
}
if (process.env.ESCORT) {
  for (const bot of ['attack', 'stealth'] as Bot[]) {
    const on = escortPair('typical', bot, false), off = escortPair('typical', bot, true);
    const f = (r: ReturnType<typeof escortPair>) => `legs ${r.legs}, patrols ${r.patrols} (${(r.patrols / r.legs).toFixed(2)}/leg), hull lost ${(r.lost / r.legs).toFixed(1)}/leg (${r.patrols ? (r.lost / r.patrols).toFixed(1) : '-'} per patrol), deaths ${r.deaths}`;
    console.log(`typical ${bot.padEnd(7)} escorted: ${f(on)}\n                declined: ${f(off)}\n                refusing costs ${((off.lost / off.legs) - (on.lost / on.legs)).toFixed(1)} hull per leg`);
  }
  process.exit(0);
}
const med = (v: number[]) => { const a = [...v].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const peakOf: Record<string, number> = {};
for (const d of (process.env.LEVELS ? process.env.LEVELS.split(',') : Object.keys(DIFFICULTY)) as Difficulty[]) for (const bot of ['attack', 'stealth'] as Bot[]) {
  const runs = Array.from({ length: SEEDS }, (_, i) => mission(d, bot, i + 1));
  const dead = runs.filter((r) => r.cause && !/^stuck|^no way/.test(r.cause)), stuck = runs.filter((r) => /^stuck|^no way/.test(r.cause));
  const causes: Record<string, number> = {}; for (const r of runs) if (r.cause) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
  const peak = med(runs.flatMap((r) => r.peaks)), peakMax = med(runs.map((r) => Math.max(...r.peaks)));
  peakOf[`${d}/${bot}`] = peakMax;
  console.log(`${d.padEnd(10)} ${bot.padEnd(7)} deaths ${dead.length}/${SEEDS} (${Math.round((100 * dead.length) / SEEDS)}%) stuck ${stuck.length} | host at end median ${med(runs.filter((r) => !r.cause).map((r) => r.host))}% | alert peak per map median ${peak.toFixed(2)}, per mission median ${peakMax.toFixed(2)} | ${Object.entries(causes).map(([c, k]) => `${c} ${k}`).join(', ') || '-'}`);
}
for (const bot of ['attack', 'stealth']) console.log(`Suppressed vs Typical alert peak (${bot}): ${Math.round(100 * (1 - peakOf[`suppressed/${bot}`] / peakOf[`typical/${bot}`]))}% lower`);
console.log('Targets (decisions.md 11.6): Suppressed 0 deaths, alert peaks ~30% under Typical; Vigilant attack bot dies 10-25%, stealth under 10%.');
