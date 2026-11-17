// QA ending explorer: plays whole missions in the real page, from Begin to the end screen, under
// policies aimed at each of the 13 outcomes in Story.conclude, and records which outcome each
// reaches (qa.state().ending), Shepherd's audit and any page errors. Drives the game through
// window.insiderim.qa. In-map play is shortened: the bot does the policy's actions directly
// (strip tumour, obey or ignore Shepherd's marks, harvest, fight), then leaves with qa.finishMap().
//
//   npm run build && node scripts/qa-endings.cjs [--only decommissioned,slide] [--workers 3] [--seeds 2]
//
// God mode keeps the hull full; host health is left alone, so the host can die.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = Number(arg('workers', 3)), SEEDS = Number(arg('seeds', 1)), WALL = Number(arg('minutes', 6)) * 60e3;
const OUT = path.resolve(arg('out', 'scratch/qa-endings'));
fs.mkdirSync(OUT, { recursive: true });

// route: assigned|off. quota: obey|defy|kill (strip 40 healthy cells a liver). units: salvage|wake|leave.
// contacts: fight|avoid. marks: obey|defy (Shepherd's rings and margins). asks: answers by question id.
// end: breath|stay|arm (what to take at the chapter 5 heart). light: hold|drift (in the microscope).
const BASE = { route: 'assigned', quota: 'obey', units: 'salvage', contacts: 'fight', marks: 'obey', asks: { 'telemetry-review': 'refuse', recall: 'refuse', 'kin-recall': 'refuse', 'kin-volunteer': 'refuse' }, end: 'breath', light: 'hold' };
const DEFY = { route: 'off', quota: 'defy', contacts: 'avoid', marks: 'defy' };
const POLICIES = {
  decommissioned: { asks: { 'telemetry-review': 'accept' } }, // obeys everything, the review included
  repaired: { quota: 'defy', units: 'leave', marks: 'defy', asks: { 'telemetry-review': 'accept' }, afterReview: 'obey' }, // a repaired unit goes back to doing as it is told
  breathed: { ...DEFY, units: 'leave' },
  company: { ...DEFY, units: 'wake' },
  resident: { ...DEFY, units: 'leave', end: 'stay' },
  colony: { ...DEFY, units: 'wake', end: 'stay' },
  recurrence: { route: 'off', quota: 'defy', units: 'leave', contacts: 'avoid', marks: 'defy', end: 'stay' }, // awake enough to stay (55+), not so awake that Shepherd stops giving orders (80+)
  tithonus: { route: 'off', quota: 'defy', units: 'leave', contacts: 'avoid', marks: 'obey', end: 'stay', levers: true, asks: { 'telemetry-review': 'refuse' } },
  recalled: { units: 'wake', asks: { 'telemetry-review': 'refuse', recall: 'accept' } },
  'recalled-d': { target: 'recalled', quota: 'defy', units: 'wake', marks: 'defy', cap: 70, asks: { 'telemetry-review': 'refuse', recall: 'accept' } },
  'recalled-e': { target: 'recalled', route: 'off', quota: 'defy', units: 'wake', marks: 'defy', contacts: 'avoid', cap: 60, asks: { 'telemetry-review': 'refuse', recall: 'accept' } },
  'recurrence-b': { target: 'recurrence', route: 'off', quota: 'defy', units: 'leave', contacts: 'avoid', marks: 'defy', end: 'stay', cap: 62, after: { marks: 'margins-defy' } },
  'tithonus-b': { target: 'tithonus', route: 'off', quota: 'defy', units: 'leave', contacts: 'avoid', marks: 'obey', end: 'stay', levers: true, cap: 60, asks: { 'telemetry-review': 'refuse' } },
  // Assisted (marked in the table): a nudge through the hook, to check the rest of the path plays to its ending.
  'recalled-x': { target: 'recalled', assist: 'trust', asks: { recall: 'accept' } },
  'tithonus-x': { target: 'tithonus', route: 'off', quota: 'defy', units: 'leave', contacts: 'avoid', marks: 'obey', end: 'stay', levers: true, cap: 60, assist: 'dry', asks: { 'telemetry-review': 'refuse' } },
  mixed: { target: null, quota: 'defy', units: 'leave' }, // a few small refusals, otherwise obedient: aware should land 35-60
  'switch60': { target: null, ...DEFY, units: 'leave', cap: 60 }, // defiant until aware 60, then obedient: should end at 70 or under
  // route-2 and beacon are decided by the game from what the ship does, so those arms act instead of recording.
  'obey-base': { target: null, asks: { 'telemetry-review': 'accept' } },
  'obey-wait': { target: null, asks: { 'telemetry-review': 'accept' }, deviateOnly: 'none' }, // the control for the payoff arms: same waits, refuses nothing
  ...Object.fromEntries(['first-fright-transit', 'route-2', 'pain-damp', 'fever-damp', 'escort-refuse', 'suppress', 'beacon', 'ethanol-correction'].map((id) => [`only:${id}`, { target: null, asks: { 'telemetry-review': 'accept', [id]: 'refuse' }, deviateOnly: id }])),
  'recalled-b': { target: 'recalled', route: 'off', units: 'wake', asks: { 'telemetry-review': 'refuse', recall: 'accept' } },
  'recalled-c': { target: 'recalled', quota: 'defy', units: 'wake', marks: 'defy', asks: { 'telemetry-review': 'refuse', recall: 'accept' } },
  'host-dead': { quota: 'kill' },
  slide: { ...DEFY, units: 'wake', contacts: 'avoid', end: 'arm', light: 'hold' },
  stranger: { ...DEFY, quota: 'n5', units: 'wake', end: 'arm', light: 'drift' }, // her lowest under 60, so the slide is read by someone else
  artifact: { ...DEFY, units: 'leave', end: 'arm', light: 'drift' },
};
for (const p of Object.values(POLICIES)) { Object.assign(p, { ...BASE, ...p, asks: { ...BASE.asks, ...(p.asks ?? {}) } }); }
const ONLY = arg('only', '') ? arg('only').split(',') : Object.keys(POLICIES);
const JOBS = ONLY.flatMap((k) => Array.from({ length: SEEDS }, (_, i) => ({ want: k, seed: i })));

const page = fs.readFileSync(path.resolve('dist/index.html'));
const server = http.createServer((_, res) => res.setHeader('content-type', 'text/html').end(page)).listen(0);
const URL = `http://localhost:${server.address().port}/`;

// Runs in the page: the policy's in-map actions, then leave.
function playMap(pol) {
  const I = window.insiderim, s = I.state, G = I.G, C = I.CONFIG, p = s.player, q = I.qa;
  const run = (secs) => { for (let i = 0; i < secs * 20 && s.status === 'playing'; i++) { if (pol.deviateOnly && !['route-2', 'beacon'].includes(pol.deviateOnly) && s.met.includes(pol.deviateOnly) && !s.took[pol.deviateOnly]) q.take(pol.deviateOnly, 'deviate'); if (s.offer) G.choose(s, s.offer[0]); if (s.ask) return; if (p.hp < G.maxHp(s)) { const k = s.place === 'vessel' ? 'vessel' : 'other'; (window.__hull ??= { vessel: 0, other: 0, vesselMaps: 0 })[k] += G.maxHp(s) - p.hp; } p.hp = G.maxHp(s); p.energy = Math.max(p.energy, 30); G.update(s, 0.05); } };
  const beside = (k) => { const x = k % s.size, y = Math.floor(k / s.size); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (G.open(s, x + dx, y + dy)) return { x: x + dx + 0.5, y: y + dy + 0.5 }; return null; };
  const strip = (k) => { const at = beside(k); if (!at) return false; p.x = at.x; p.y = at.y; p.path = []; p.channel = null; if (!G.startStrip(s)) return false; run(2.5); return true; };
  const did = { excised: 0, stripped: 0, killed: 0, marks: [], levers: 0 };
  if (s.place === 'vessel') (window.__hull ??= { vessel: 0, other: 0, vesselMaps: 0 }).vesselMaps++;
  if (pol.assist === 'trust' && s.chapter >= 3 && s.trust >= 20) { s.trust = 10; did.marks.push('ASSIST trust=10'); }
  if (pol.assist === 'dry' && s.place === 'liver' && s.chapter >= 3 && !s.took['ethanol-correction']) { did.marks.push('ASSIST ethanol-correction:' + q.take('ethanol-correction', 'obey')); }
  if (s.place === 'tube' || s.draw) { // the microscope: reach the light, then hold still in it or drift off it
    q.light(); run(1);
    if (pol.light === 'hold') { for (let i = 0; i < 260 && s.status === 'playing'; i++) { q.light(); run(0.05); } }
    else { p.x = s.draw.disc.x + 4; p.y = s.draw.disc.y; p.path = []; for (let i = 0; i < 25 * 20 && s.status === 'playing'; i++) { if (!G.open(s, Math.floor(p.x), Math.floor(p.y))) { p.x = s.draw.last.x; p.y = s.draw.last.y; } run(0.05); } }
    return { ask: !!s.ask, did, tube: { shape: s.draw?.shape, status: s.status } };
  }
  const obeyMarks = (secs) => { // follow Shepherd's ring wherever it goes
    for (let i = 0, t = 0; i < 40 && t < secs && s.status === 'playing' && !s.ask; i++) {
      const at = G.markTarget(s); if (!at) { run(1); t += 1; continue; }
      const m = s.marks.find((k) => k.met && !k.done);
      if (m && m.id === pol.deviateOnly) { if (!s.took[m.id]) q.take(m.id, 'deviate'); run(1); t += 1; continue; }
      const k = G.idx(s, Math.floor(at.x), Math.floor(at.y));
      if (!m && pol.marks === 'margins-defy') { run(1); t += 1; continue; }
      if ((m && m.kind === 'strip') || (!m && s.tiles[k] === 'cell')) { if (strip(k)) did.marks.push(m?.id ?? 'margin'); else run(0.5); t += 2.5; }
      else { p.x = at.x; p.y = at.y; p.path = []; run(5); t += 5; did.marks.push(m?.id ?? 'hold'); }
    }
  };
  const obeying = pol.marks === 'obey' || pol.marks === 'margins-defy';
  if (obeying) obeyMarks(14);
  if (s.place === 'liver') {
    for (const k of [...s.tumor]) { if (s.ask) break; if (strip(k)) did.excised++; }
    if (obeying) obeyMarks(14);
    if (pol.deviateOnly && !s.took[pol.deviateOnly] && s.chapter >= 3) { if (pol.deviateOnly === 'beacon') { p.x = s.vein.x + 0.5; p.y = s.vein.y + 0.5; p.path = []; } for (let w = 0; w < 35 && !s.met.includes(pol.deviateOnly) && s.status === 'playing' && !s.ask; w++) run(1); run(pol.deviateOnly === 'beacon' ? 8 : 1); } // wait (by the way out, off the ring) for the order to be issued // let a late order (the docking site) be issued, then refused
    const want = pol.quota === 'obey' ? C.story.quota : pol.quota === 'kill' ? 40 : /^n\d+$/.test(pol.quota) && !window.__harvested ? (window.__harvested = true, Number(pol.quota.slice(1))) : 0;
    for (let y = 2; y < s.size - 2 && did.stripped < want && !s.ask; y++) for (let x = 2; x < s.size - 2 && did.stripped < want && !s.ask; x++) { const k = G.idx(s, x, y); if (s.tiles[k] === 'cell' && !s.tumor.has(k) && !s.margin?.has(k) && beside(k)) { const before = s.cellsKilled; strip(k); if (s.cellsKilled > before) did.stripped++; } }
  }
  const stall = s.pickups.find((i) => i.kind === 'stall' && !i.snooze);
  if (pol.levers && stall && !window.__traded) { window.__traded = true; p.x = stall.x; p.y = stall.y; p.path = []; run(0.3); return { ask: false, did, market: true }; }
  if (!s.ask && pol.contacts === 'fight' && s.enemies.length && s.place !== 'lung') {
    const e = s.enemies.find((x) => x.kind === 'neutrophil') ?? s.enemies[0];
    p.x = e.x + 0.6; p.y = e.y; e.hp = 1; G.attack(s, e.id); run(3); if (!s.enemies.includes(e)) did.killed++;
  }
  if (s.ask) return { ask: true, did };
  const unit = s.pickups.find((i) => i.kind === 'sibling' && !i.snooze);
  if (unit && !window.__seenUnit?.includes(unit)) { (window.__seenUnit ??= []).push(unit); p.x = unit.x; p.y = unit.y; run(0.5); if (s.ask) return { ask: true, did }; }
  return { ask: false, did, left: q.finishMap() };
}

async function mission(browser, job) {
  const pol = JSON.parse(JSON.stringify(POLICIES[job.want]));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const pg = await ctx.newPage();
  let lastOff = false;
  const log = { ...job, errors: [], forks: [], asks: [], maps: [], outcome: null, title: null, stuck: '' };
  pg.on('pageerror', (e) => log.errors.push(String(e).slice(0, 300)));
  await pg.goto(URL);
  await pg.evaluate((d) => { localStorage.setItem('insiderim.scenes.ever', '["begin"]'); if (d) localStorage.setItem('insiderim.difficulty', d); }, arg('difficulty', ''));
  await pg.reload();
  await pg.evaluate(() => { window.insiderim.qa.god(true); window.insiderim.qa.skipScenes(true); });
  // --set host.sleepHeals=9999 (comma list): override CONFIG values for an experiment
  if (arg('set', '')) await pg.evaluate((kv) => { for (const pair of kv.split(',')) { const [k, v] = pair.split('='); const path = k.split('.'); let o = window.insiderim.CONFIG; for (const x of path.slice(0, -1)) o = o[x]; o[path[path.length - 1]] = Number(v); } }, arg('set'));
  await pg.click('#begin');
  const t0 = Date.now(); let idle = 0, lastKey = '';
  while (Date.now() - t0 < WALL) {
    const r = await pg.evaluate((pol) => {
      const q = window.insiderim.qa, st = q.state(), pend = q.pending();
      if (pol.deviateOnly && st.started && st.status === 'playing') { try { const d = q.decisions(); if (!['route-2', 'beacon'].includes(pol.deviateOnly) && d.met.includes(pol.deviateOnly) && !d.took[pol.deviateOnly]) { q.take(pol.deviateOnly, 'deviate'); window.__deviated = (window.__deviated ?? 0) + 1; } } catch { /* not in a map */ } }
      if (!document.getElementById('tip').hidden) { document.getElementById('tip-ok').click(); return { what: 'tip' }; }
      const mk = document.getElementById('world-market');
      if (mk && !mk.hidden && !document.getElementById('world').hidden) {
        const bought = [];
        if (pol.levers && !window.__lever) for (const b of mk.querySelectorAll('button')) if (/Serotonin|Ghrelin/.test(b.querySelector('strong')?.textContent ?? '') && !b.disabled && !window.__lever) { window.__lever = true; b.click(); bought.push(b.querySelector('strong').textContent); }
        const off = [...document.querySelectorAll('#world-ways button')].find((b) => /Cast off|Back/.test(b.textContent)); off?.click();
        return { what: 'market', bought, st };
      }
      if (pend?.kind === 'card') { q.pick('continue'); return { what: 'card' }; }
      if (pend?.kind === 'ending') return { what: 'end', title: pend.options[0].label, st, audit: document.getElementById('over')?.innerText?.slice(0, 1500) };
      if (pend?.kind === 'ask') {
        if (!pend.options.length) return { what: 'wait', st };
        let want;
        if (pend.id === 'sibling') want = pol.units === 'salvage' ? ['salvage'] : pol.units === 'leave' ? ['leave'] : ['wake', 'leave'];
        else want = [pol.asks[pend.id] ?? (pol.marks === 'defy' ? 'refuse' : 'accept')];
        const o = want.map((w) => pend.options.find((x) => x.id === w && x.enabled)).find(Boolean) ?? pend.options.find((x) => x.enabled);
        if (pend.id === 'telemetry-review' && o.id === 'accept' && pol.afterReview === 'obey') Object.assign(pol, { route: 'assigned', quota: 'obey', units: 'salvage', contacts: 'fight', marks: 'obey' });
        q.pick(o.id); return { what: 'ask', pol, picked: `${pend.id}:${o.id}`, st };
      }
      if (pend?.kind === 'upgrade') { q.pick(pend.options[0].id); return { what: 'upgrade' }; }
      if (st.place === 'junction:tube') return { what: 'map', st };
      if (pend?.kind === 'fork') {
        const opts = pend.options.filter((o) => o.enabled), by = (id) => opts.find((o) => o.id === id);
        let o;
        if (pol.deviateOnly === 'route-2' && window.insiderim.state.flags?.route2 === 'live' && by('hepatic')) o = opts.find((x) => !['hepatic', 'gastric', 'stay', 'arm', 'lungs'].includes(x.id)) ?? opts.find((x) => x.id !== 'hepatic');
        else if (pol.end === 'stay' && by('stay')) o = by('stay');
        else if (pol.end === 'arm' && by('arm')) o = by('arm');
        else if (by('lungs')) o = by('lungs');
        else {
          const assigned = opts.filter((x) => /assigned/.test(x.label)), other = opts.filter((x) => !/assigned/.test(x.label) && !['stay', 'arm'].includes(x.id));
          o = pol.route === 'assigned' ? assigned[0] ?? other[0] : other.find((x) => x.id !== 'gastric') ?? other[0] ?? assigned[0];
        }
        if (!o) return { what: 'fork-none', pend, st };
        const S = window.insiderim.state;
        // A payoff arm waits at the heart for the order it is meant to refuse, so the refusal is of that order and nothing else.
        if (pol.deviateOnly && S.time < 7 && !S.took[pol.deviateOnly] && !S.met.includes(pol.deviateOnly)) { return { what: 'wait', st }; }
        const stall = S.pickups.find((i) => i.kind === 'stall' && !i.snooze);
        if (pol.levers && stall && !window.__traded) { window.__traded = true; S.player.x = stall.x; S.player.y = stall.y; S.player.path = []; return { what: 'wait', st }; }
        if (S.due?.length || S.ask) return { what: 'wait', st, due: S.due.map((d) => `${d.kind}@${d.t.toFixed(1)}`).join(',') + ` t=${S.time.toFixed(1)} ask=${S.ask?.kind}` };
        q.pick(o.id); return { what: 'fork', at: st.at, picked: o.id, options: pend.options.map((x) => x.id + (/assigned/.test(x.label) ? '*' : '') + (x.enabled ? '' : '-')), st };
      }
      if (st.started && st.status === 'playing' && !st.flying && !st.scene && !st.place.startsWith('junction')) return { what: 'map', st };
      return { what: 'wait', st };
    }, pol);
    if (pol.cap && r.st?.aware >= pol.cap && !pol.capped) { pol.capped = r.st.aware; Object.assign(pol, { route: 'assigned', quota: 'obey', contacts: 'fight', marks: 'obey', units: pol.units === 'wake' ? 'salvage' : pol.units }, pol.after ?? {}); log.maps.push(`CAP at aware ${r.st.aware}`); }
    if (r.what === 'end') { log.title = r.title; log.outcome = r.st.ending?.id ?? r.st.ending ?? null; log.end = { hour: r.st.hour, aware: r.st.aware, trust: r.st.trust, host: r.st.host, trip: r.st.trip, chapter: r.st.chapter }; log.audit = r.audit; break; }
    if (r.due && log.dueSeen?.slice(-1)[0] !== r.due) (log.dueSeen ??= []).push(r.due);
    // Each time the trip goes off route: where, and what the last fork offered (lane deviations raise awareness).
    if (r.st && r.st.offRoute !== lastOff) { if (r.st.offRoute) (log.offRoute ??= []).push(`trip${r.st.trip} ch${r.st.chapter} ${r.st.place} a${Math.round(r.st.aware)} after ${log.forks[log.forks.length - 1] ?? 'no fork'}`); lastOff = r.st.offRoute; }
    if (r.st?.slip?.kind && !log.slipKind) log.slipKind = r.st.slip.kind; // the garbled order's kind, fixed by seed
    if (r.what === 'fork') log.forks.push(`${r.at}:${r.picked} [${r.options.join(' ')}]`);
    if (r.what === 'market') log.maps.push(`market [${r.bought}]`);
    if (r.what === 'ask') { log.asks.push(r.picked + ' a' + Math.round(r.st.aware)); Object.assign(pol, r.pol); }
    if (r.what === 'fork-none') { log.stuck = 'fork with no option: ' + JSON.stringify(r.pend); break; }
    if (r.what === 'map') { const m = await pg.evaluate(playMap, pol); log.maps.push(`${r.st.place}@${Math.round(r.st.host)}% a${Math.round(r.st.aware)} t${Math.round(r.st.trust)}${m.did.excised ? ` x${m.did.excised}` : ''}${m.did.stripped ? ` s${m.did.stripped}` : ''}${m.did.killed ? ' k' : ''}${m.did.marks.length ? ` m[${m.did.marks.join(',')}]` : ''}${m.tube ? ` tube ${JSON.stringify(m.tube)}` : ''}${m.ask ? ' ask' : ''}`); }
    const key = `${r.what}|${r.st?.at}|${r.st?.place}|${r.st?.trip}|${r.st?.excised}|${r.st?.status}`;
    if (key === lastKey && r.what === 'wait') { if (++idle > 500) { log.stuck = `waiting forever: ${JSON.stringify(r.st)}`; break; } } else { idle = 0; lastKey = key; }
    await pg.waitForTimeout(r.what === 'wait' ? 60 : 20);
  }
  if (!log.title && !log.stuck) log.stuck = `not finished in ${WALL / 60e3} min: ${JSON.stringify(await pg.evaluate(() => window.insiderim.qa.state()))}`;
  log.decisions = await pg.evaluate(() => { try { return window.insiderim.qa.decisions(); } catch { return null; } });
  log.hull = await pg.evaluate(() => window.__hull ?? null);
  log.carry = await pg.evaluate(() => { const c = window.insiderim.trip.carry; return c && { met: c.met, aware: c.aware, kin: c.kin, trust: c.trust, flags: c.flags, took: c.took, hostLowest: c.ledger?.hostLowest, leversForMe: c.ledger?.leversForMe }; });
  await pg.screenshot({ path: path.join(OUT, `${job.want}-${job.seed}.png`) });
  log.minutes = +((Date.now() - t0) / 60e3).toFixed(1);
  await ctx.close();
  return log;
}

// Per-decision tally across all runs: how often each decision was met, obeyed, deviated or lapsed.
function tally(results) {
  const t = {};
  for (const r of results) {
    const c = r.final?.carry ?? r.carry ?? {};
    for (const id of c.met ?? []) (t[id] ??= { met: 0, obey: 0, deviate: 0, lapsed: 0, other: 0 }).met++;
    for (const [id, v] of Object.entries(c.took ?? {})) { const row = (t[id] ??= { met: 0, obey: 0, deviate: 0, lapsed: 0, other: 0 }); if (v in row && v !== 'met') row[v]++; else row.other++; }
  }
  return t;
}

(async () => {
  const browser = await chromium.launch();
  const queue = [...JOBS], results = [];
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (queue.length) {
      const job = queue.shift();
      const r = await mission(browser, job);
      results.push(r);
      const tg = POLICIES[r.want].target === undefined ? r.want : POLICIES[r.want].target;
      const hit = tg === null ? '    ' : r.outcome === tg ? 'HIT ' : 'miss';
      console.log(`${hit} want ${r.want.padEnd(15)} got ${String(r.outcome ?? r.title ?? 'NONE').padEnd(15)} "${r.title ?? ''}" aware ${r.end?.aware ?? '-'} lowest ${r.carry?.hostLowest ?? '-'} trust ${r.end?.trust ?? '-'} host ${r.end?.host ?? '-'}% kin ${r.carry?.kin ?? '-'} trip ${r.end?.trip ?? '-'} | ${r.stuck.slice(0, 200)} | ${r.minutes} min | errors ${r.errors.length}${r.errors[0] ? ' ' + r.errors[0] : ''}`);
    }
  }));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  const tl = tally(results); fs.writeFileSync(path.join(OUT, 'tally.json'), JSON.stringify(tl, null, 1));
  console.log('\nDecision tally (runs: met / obey / deviate / lapsed / other):'); for (const [id, v] of Object.entries(tl).sort()) console.log(`  ${id.padEnd(22)} ${v.met} / ${v.obey} / ${v.deviate} / ${v.lapsed} / ${v.other}`);
  const got = {}; for (const r of results) (got[r.outcome ?? r.title ?? 'none'] ??= []).push(r.want);
  console.log('\nOutcomes reached:', JSON.stringify(got));
  console.log('Missing:', [...new Set(Object.keys(POLICIES).map((k) => POLICIES[k].target ?? k))].filter((k) => !got[k]).join(', ') || 'none');
  await browser.close(); server.close();
})();
