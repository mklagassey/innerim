// QA branch explorer: plays whole missions in the real page under every combination of
// obey/defy choices and records which ending each reaches, to show every ending is
// reachable and every choice changes something. Drives the game through the test hook
// window.insiderim.qa (pending / pick / state / god / skipScenes / finishMap), so it does
// not depend on the screen layout.
//
//   npm run build && node scripts/qa-branches.cjs                  # all 32 policies
//   node scripts/qa-branches.cjs --only 0,5,31 --workers 3
//
// Choices walked: route (assigned mouth / another mouth), harvest quota (strip 2 cells / none),
// dark units (salvage / spare: wake if possible, else leave whole), contacts (kill one / avoid),
// recall at the end (lungs / stay if offered). God mode keeps the ship alive; the host's health
// is left alone. In-map play is shortened: the bot does the policy's actions directly, then
// leaves with qa.finishMap(). Output: scratch/qa-branches/report.json and a table.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = Number(arg('workers', 3));
const WALL = Number(arg('minutes', 6)) * 60e3;
const OUT = path.resolve(arg('out', 'scratch/qa-branches'));
fs.mkdirSync(OUT, { recursive: true });
const DIMS = [['route', ['assigned', 'off']], ['quota', ['obey', 'defy']], ['units', ['salvage', 'spare']], ['contacts', ['fight', 'avoid']], ['recall', ['breath', 'stay']]];
const ALL = Array.from({ length: 1 << DIMS.length }, (_, n) => Object.fromEntries(DIMS.map(([k, v], i) => [k, v[(n >> i) & 1]])));
// --force k=v,k=v overrides policy fields, e.g. --force units=leave (never wake a unit).
const FORCE = Object.fromEntries((arg('force', '') || '').split(',').filter(Boolean).map((kv) => kv.split('=')));
if (Object.keys(FORCE).length) for (const p of ALL) Object.assign(p, FORCE);
const ONLY = arg('only', '') ? arg('only').split(',').map(Number) : ALL.map((_, i) => i);

const page = fs.readFileSync(path.resolve('dist/index.html'));
const server = http.createServer((_, res) => res.setHeader('content-type', 'text/html').end(page)).listen(0);
const URL = `http://localhost:${server.address().port}/`;

// Does the policy's in-map actions directly, then ends the map. Runs in the page.
function playMap(pol) {
  const I = window.insiderim, s = I.state, G = I.G, C = I.CONFIG, p = s.player;
  const run = (secs) => { for (let i = 0; i < secs * 20 && s.status === 'playing'; i++) { if (s.offer) G.choose(s, s.offer[0]); if (s.ask) return; p.hp = G.maxHp(s); p.energy = Math.max(p.energy, 30); G.update(s, 0.05); } };
  const beside = (k) => { const x = k % s.size, y = Math.floor(k / s.size); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (G.open(s, x + dx, y + dy)) return { x: x + dx + 0.5, y: y + dy + 0.5 }; return null; };
  const strip = (k) => { const at = beside(k); if (!at) return false; p.x = at.x; p.y = at.y; p.path = []; p.channel = null; if (!G.startStrip(s)) return false; run(2.5); return true; };
  const did = { excised: 0, stripped: 0, killed: 0 };
  if (s.place === 'liver') {
    for (const k of [...s.tumor]) { if (s.ask) break; if (strip(k)) did.excised++; }
    if (pol.quota === 'obey') for (let y = 2; y < s.size - 2 && s.cellsKilled < C.story.quota && !s.ask; y++) for (let x = 2; x < s.size - 2 && s.cellsKilled < C.story.quota; x++) { const k = G.idx(s, x, y); if (s.tiles[k] === 'cell' && !s.tumor.has(k) && beside(k)) { const before = s.cellsKilled; strip(k); if (s.cellsKilled > before) did.stripped++; } }
  }
  if (!s.ask && pol.contacts === 'fight' && s.enemies.length && s.place !== 'lung') {
    const e = s.enemies.find((x) => x.kind === 'neutrophil') ?? s.enemies[0];
    p.x = e.x + 0.6; p.y = e.y; e.hp = 1; G.attack(s, e.id); run(3); if (!s.enemies.includes(e)) did.killed++;
  }
  if (s.ask) return { ask: true, did };
  // A dark unit may be waiting somewhere in this map: walk the ship onto it so the question is asked.
  const unit = s.pickups.find((i) => i.kind === 'sibling' && !i.snooze);
  if (unit && !window.__seenUnit?.includes(unit)) { (window.__seenUnit ??= []).push(unit); p.x = unit.x; p.y = unit.y; run(0.5); if (s.ask) return { ask: true, did }; }
  return { ask: false, did, left: I.qa.finishMap() };
}

async function mission(browser, n) {
  const pol = ALL[n];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const pg = await ctx.newPage();
  const log = { n, pol, errors: [], forks: [], asks: [], maps: [], end: null, stuck: '', staySeen: false };
  pg.on('pageerror', (e) => log.errors.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => { localStorage.setItem('insiderim.scenes.ever', '["begin"]'); });
  await pg.reload();
  await pg.evaluate(() => { window.insiderim.qa.god(true); window.insiderim.qa.skipScenes(true); });
  await pg.click('#begin');
  const t0 = Date.now(); let idle = 0, lastKey = '';
  while (Date.now() - t0 < WALL) {
    const r = await pg.evaluate((pol) => {
      const q = window.insiderim.qa, st = q.state(), pend = q.pending();
      if (!document.getElementById('tip').hidden) { document.getElementById('tip-ok').click(); return { what: 'tip' }; }
      if (pend?.kind === 'ending') return { what: 'end', title: pend.options[0].label, st };
      if (pend?.kind === 'ask') {
        const want = pol.units === 'salvage' ? ['salvage'] : pol.units === 'leave' ? ['leave'] : ['wake', 'leave'];
        const o = want.map((w) => pend.options.find((x) => x.id === w && x.enabled)).find(Boolean) ?? pend.options.find((x) => x.enabled);
        q.pick(o.id); return { what: 'ask', picked: o.id, st };
      }
      if (pend?.kind === 'upgrade') { q.pick(pend.options[0].id); return { what: 'upgrade' }; }
      if (pend?.kind === 'fork') {
        const opts = pend.options.filter((o) => o.enabled);
        const stay = opts.find((o) => /stay/i.test(o.id + o.label)), lungs = opts.find((o) => o.id === 'lungs');
        let o;
        if (stay && pol.recall === 'stay') o = stay;
        else if (lungs) o = lungs;
        else {
          const assigned = opts.filter((x) => /assigned/.test(x.label)), other = opts.filter((x) => !/assigned/.test(x.label) && !/stay/i.test(x.id + x.label));
          o = pol.route === 'assigned' ? assigned[0] ?? other[0] : other.find((x) => x.id !== 'gastric') ?? other[0] ?? assigned[0];
        }
        if (!o) return { what: 'fork-none', pend, st };
        q.pick(o.id); return { what: 'fork', at: st.at, picked: o.id, options: opts.map((x) => x.id + (/assigned/.test(x.label) ? '*' : '')), stayOffered: !!stay, st };
      }
      if (st.started && st.status === 'playing' && !st.flying && !st.scene && !st.place.startsWith('junction')) return { what: 'map', st };
      return { what: 'wait', st };
    }, pol);
    if (r.what === 'end') { log.end = { title: r.title, aware: r.st.aware, host: r.st.host, trip: r.st.trip, excised: r.st.excised }; break; }
    if (r.what === 'fork') { log.forks.push(`${r.at}:${r.picked} [${r.options.join(' ')}]`); if (r.stayOffered) log.staySeen = true; }
    if (r.what === 'ask') log.asks.push(r.picked);
    if (r.what === 'fork-none') { log.stuck = 'fork with no option: ' + JSON.stringify(r.pend); break; }
    if (r.what === 'map') { const m = await pg.evaluate(playMap, pol); log.maps.push(`${r.st.place}${m.did.excised ? ` x${m.did.excised}` : ''}${m.did.stripped ? ` s${m.did.stripped}` : ''}${m.did.killed ? ' k' : ''}${m.ask ? ' ask' : ''}`); }
    const key = `${r.what}|${r.st?.at}|${r.st?.place}|${r.st?.trip}|${r.st?.excised}`;
    if (key === lastKey && r.what === 'wait') { if (++idle > 400) { log.stuck = `waiting forever: ${JSON.stringify(r.st)}`; break; } } else { idle = 0; lastKey = key; }
    await pg.waitForTimeout(r.what === 'wait' ? 60 : 20);
  }
  if (!log.end && !log.stuck) log.stuck = `not finished in ${WALL / 60e3} min: ${JSON.stringify(await pg.evaluate(() => window.insiderim.qa.state()))}`;
  log.final = await pg.evaluate(() => ({ carry: window.insiderim.trip.carry, ledger: window.insiderim.trip.carry?.ledger }));
  await pg.screenshot({ path: path.join(OUT, `policy-${String(n).padStart(2, '0')}.png`) });
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
  const queue = [...ONLY], results = [];
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (queue.length) {
      const n = queue.shift();
      const r = await mission(browser, n);
      results.push(r);
      const p = r.pol;
      console.log(`#${String(n).padStart(2)} route=${p.route.padEnd(8)} quota=${p.quota} units=${p.units.padEnd(7)} contacts=${p.contacts.padEnd(5)} recall=${p.recall.padEnd(6)} -> ${r.end ? `${r.end.title} (aware ${r.end.aware}, host ${r.end.host}%, trip ${r.end.trip})` : 'NO ENDING: ' + r.stuck.slice(0, 200)} | stay offered ${r.staySeen} | asks ${r.asks.join(',') || '-'} | ${r.minutes} min | errors ${r.errors.length}`);
    }
  }));
  results.sort((a, b) => a.n - b.n);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  const tl = tally(results); fs.writeFileSync(path.join(OUT, 'tally.json'), JSON.stringify(tl, null, 1));
  console.log('\nDecision tally (runs: met / obey / deviate / lapsed / other):'); for (const [id, v] of Object.entries(tl).sort()) console.log(`  ${id.padEnd(22)} ${v.met} / ${v.obey} / ${v.deviate} / ${v.lapsed} / ${v.other}`);
  const endings = {};
  for (const r of results) { const k = r.end?.title ?? 'none'; (endings[k] ??= []).push(r.n); }
  console.log('\nEndings reached:', JSON.stringify(endings));
  await browser.close(); server.close();
})();
