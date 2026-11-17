// Keeps a tally of one run and, when the run ends, files a report in the page's shared
// database so the designer and Claude can look at real play instead of guessing.
import { CONFIG } from './config';
import * as G from './game';

export const BUILD = 'unit-14'; // bump when rules change so reports can be compared fairly

const COUNTED = ['strip', 'skim', 'swing', 'shot', 'hit', 'hurt', 'spot', 'surge', 'net', 'sniff', 'cloak', 'heal', 'calm', 'pickup', 'cache', 'upgrade', 'alarm', 'burn', 'tag', 'excise', 'slam', 'board'];

interface Tally {
  events: Record<string, number>;
  tierSeconds: number[]; // time spent at each alert tier
  chased: number; // seconds with something on your tail
  hiding: number; // seconds spent in "losing them"
  peakAlert: number;
  lowestLife: number;
  walked: number;
  firstStrip: number | null;
  firstSpotted: number | null;
  timeline: number[][]; // [seconds, life, energy, alert, host] every few seconds
  nextSample: number;
  lastHurtBy: string;
}

let t: Tally;
export function begin() {
  t = { events: {}, tierSeconds: CONFIG.alert.tiers.map(() => 0), chased: 0, hiding: 0, peakAlert: 0, lowestLife: Infinity,
    walked: 0, firstStrip: null, firstSpotted: null, timeline: [], nextSample: 0, lastHurtBy: '' };
}
begin();

/** Call once per simulated step, before the event queue is emptied. */
export function track(s: G.State, dt: number, moved: number) {
  for (const e of s.events) {
    if (COUNTED.includes(e)) t.events[e] = (t.events[e] ?? 0) + 1;
    if (e === 'strip' && t.firstStrip === null) t.firstStrip = Math.round(s.time);
    if (e === 'spot' && t.firstSpotted === null) t.firstSpotted = Math.round(s.time);
    if (e === 'hurt') {
      const near = s.enemies.filter((x) => G.dist(x, s.player) < 2.5).sort((a, b) => G.dist(a, s.player) - G.dist(b, s.player))[0];
      t.lastHurtBy = near ? near.kind : 'starvation';
    }
    if (e === 'burn') t.lastHurtBy = 'acid';
    if (e === 'slam') t.lastHurtBy = 'artery wall';
  }
  if (s.offer) return; // the world is holding still for an upgrade choice
  const tier = CONFIG.alert.tiers.findIndex((x) => x.name === G.alertTier(s).name);
  t.tierSeconds[tier] += dt;
  if (s.enemies.some((e) => e.mood === 'chase')) t.chased += dt;
  if (G.losingThem(s)) t.hiding += dt;
  t.peakAlert = Math.max(t.peakAlert, s.alert);
  t.lowestLife = Math.min(t.lowestLife, s.player.hp);
  t.walked += moved;
  if (s.time >= t.nextSample && t.timeline.length < 240) {
    t.timeline.push([Math.round(s.time), Math.round(s.player.hp), s.player.energy, Math.round(s.alert), Math.round(s.hostHealth)]);
    t.nextSample = s.time + 5;
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

export function report(s: G.State, extra: Record<string, unknown> = {}) {
  const open = s.tiles.filter((x) => x !== 'cell').length;
  let explored = 0;
  for (let i = 0; i < s.tiles.length; i++) if (s.explored[i] && s.tiles[i] !== 'cell') explored++;
  return {
    build: BUILD,
    place: s.place,
    ...extra,
    at: new Date().toISOString(),
    result: s.status,
    endedBy: s.status === 'dead' ? t.lastHurtBy || 'unknown' : 'left by the vein',
    seconds: Math.round(s.time),
    life: Math.round(s.player.hp), maxLife: G.maxHp(s), lowestLife: Math.round(Math.max(0, t.lowestLife)),
    energy: s.player.energy, quota: CONFIG.energy.quota,
    hostHealth: Math.round(s.hostHealth), fever: G.fever(s),
    cellsStripped: s.cellsKilled, tumorExcised: s.excised, tumorLeftHere: s.tumor.size, skims: t.events.skim ?? 0,
    immuneKills: s.kills, awareness: Math.round(s.aware), awarenessStage: G.stage(s), unitsWoken: s.kin, harvestVerdict: s.verdict, chapter: s.chapter, trust: Math.round(s.trust), compliance: G.compliance(s.ledger), slip: s.slip ? `${s.slip.kind}:${s.slip.meant}:${s.slip.result ?? 'pending'}` : 'none', took: { ...s.took }, met: [...s.met], pages: [...s.pages], difficulty: s.difficulty, hostEvent: s.event ?? 'none', defiedOrders: [...s.defiedNow], tumourDrainThisMap: s.drainHere, tutorialStep: s.tutorial?.reached ?? 0, secondsSilent: Math.round(s.tally.silent), firstStrikes: s.tally.firstStrikes, timesEngulfed: s.tally.grabs, nichesUsed: s.tally.niches, ledger: { ...s.ledger, excised: s.excised, memoryPeak: Math.round(G.memoryAfter(s) * 100) / 100, ...G.stewardship(s.ledger, s.excised) }, energyOnArrival: s.arrived.energy, hullOnArrival: Math.round(s.arrived.hp), acidAtDeath: s.status === 'dead' ? Math.round(G.acidLevel(s) * 100) / 100 : null, secondsInAcid: Math.round(s.acidTime), slamDamage: (t.events.slam ?? 0) * CONFIG.host.slam.damage, secondsInSearchZone: Math.round(s.zoneTime), searchZone: s.search ? { x: Math.round(s.search.x), y: Math.round(s.search.y), r: Math.round(s.search.r * 10) / 10 } : null,
    hostFrights: t.events.surge ?? 0, hostHourAtEnd: Math.round(s.host.hour * 10) / 10,
    timesSnared: t.events.net ?? 0, hullLostToAcid: t.events.burn ?? 0, wallSlams: t.events.slam ?? 0, neutrophilsBoarded: t.events.board ?? 0,
    timesSniffed: t.events.sniff ?? 0, timesTagged: t.events.tag ?? 0, immuneMemoryBefore: round(s.memory * 100), immuneMemoryAfter: round(G.memoryAfter(s) * 100),
    timesSpotted: t.events.spot ?? 0, timesHurt: t.events.hurt ?? 0,
    swings: t.events.swing ?? 0, shots: t.events.shot ?? 0, hitsLanded: t.events.hit ?? 0,
    cloaks: t.events.cloak ?? 0, patchesUsed: t.events.heal ?? 0, patchesLeft: s.patches, calmsUsed: t.events.calm ?? 0,
    upgrades: Object.fromEntries(Object.entries(s.upgrades).filter(([, level]) => level > 0)),
    peakAlert: Math.round(t.peakAlert), alertAtEnd: Math.round(s.alert),
    secondsPerTier: Object.fromEntries(CONFIG.alert.tiers.map((tier, i) => [tier.name, Math.round(t.tierSeconds[i])])),
    secondsChased: Math.round(t.chased), secondsLosingThem: Math.round(t.hiding),
    firstStripAt: t.firstStrip, firstSpottedAt: t.firstSpotted,
    tilesWalked: Math.round(t.walked), mappedPercent: round((explored / open) * 100),
    enemiesAliveAtEnd: s.enemies.length,
    timeline: JSON.stringify(t.timeline), // [seconds, life, energy, alert, host]
  };
}

type Db = { collection(path: string): { add(data: Record<string, unknown>): Promise<unknown> } };

/** Files the report. Resolves true when it was stored, false when this page has nowhere to store it. */
export async function save(s: G.State, extra: Record<string, unknown> = {}): Promise<boolean> {
  const data = report(s, extra);
  try {
    const claude = (window as unknown as { claude?: { use(name: string): Promise<Db | null> } }).claude;
    const db = await claude?.use('db');
    if (!db) return false;
    await db.collection('runs').add(data);
    return true;
  } catch {
    return false;
  }
}
