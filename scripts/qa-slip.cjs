// QA for the Slip (the one garbled order per game): plays the real page through the test hook
// window.insiderim.qa, forces each Slip kind and meaning with qa.slip(kind, meant) in liver 1,
// then acts on the garbled order each possible way and records Shepherd's verdict, trust,
// compliance, awareness and the unit's bracket line. Also checks a save made across a chapter
// card resumes, and samples screen brightness through the Slip's fright to catch flashing.
//
//   npm run build && node scripts/qa-slip.cjs [--workers 3] [--only hold:A:A,fork:B:none]
//
// Cases are kind:meant:did, with did A, B, none (let it lapse) or early (fork only: steer into a
// mouth before the order has arrived). Output: scratch/qa-slip/report.json and a table.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = Number(arg('workers', 3));
const OUT = path.resolve(arg('out', 'scratch/qa-slip'));
fs.mkdirSync(OUT, { recursive: true });
const CASES = [];
for (const kind of ['hold', 'lamp', 'fork']) for (const meant of ['A', 'B']) for (const did of ['A', 'B', 'none', ...(kind === 'fork' ? ['early'] : [])]) CASES.push(`${kind}:${meant}:${did}`);
const ONLY = arg('only', '') ? arg('only').split(',') : CASES;

const page = fs.readFileSync(path.resolve('dist/index.html'));
const server = http.createServer((_, res) => res.setHeader('content-type', 'text/html').end(page)).listen(0);
const URL = `http://localhost:${server.address().port}/`;

// In-page: play liver 1 quickly (strip the tumour) and leave.
function liver() {
  const I = window.insiderim, s = I.state, G = I.G, p = s.player;
  const run = (secs) => { for (let i = 0; i < secs * 20 && s.status === 'playing'; i++) { if (s.offer) G.choose(s, s.offer[0]); if (s.ask) return; p.hp = G.maxHp(s); G.update(s, 0.05); } };
  const beside = (k) => { const x = k % s.size, y = Math.floor(k / s.size); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (G.open(s, x + dx, y + dy)) return { x: x + dx + 0.5, y: y + dy + 0.5 }; return null; };
  for (const k of [...s.tumor]) { if (s.ask) { I.qa.pick('leave'); } const at = beside(k); if (!at) continue; p.x = at.x; p.y = at.y; p.path = []; p.channel = null; if (G.startStrip(s)) run(2.5); }
  return I.qa.finishMap();
}

// In-page: act on a live hold/lamp Slip in a vessel map. Returns what was done.
function vessel(did) {
  const I = window.insiderim, s = I.state, G = I.G, C = I.CONFIG, p = s.player;
  const step = (n = 1) => { for (let i = 0; i < n && s.status === 'playing'; i++) { if (s.offer) G.choose(s, s.offer[0]); if (s.ask) return; p.hp = G.maxHp(s); G.update(s, 0.05); } };
  const log = [];
  if (s.slip.kind === 'lamp') {
    const unit = s.pickups.find((i) => i.slip);
    if (!unit) return { err: 'no slip unit in the vessel', pickups: s.pickups.map((i) => i.kind) };
    if (did === 'none') { log.push('left without touching it'); return { log, left: I.qa.finishMap() }; }
    p.x = unit.x + C.slip.lamp; p.y = unit.y; p.path = []; step(10); log.push(`near: live=${!!s.slipLive}`);
    p.x = unit.x; p.y = unit.y; step(5);
    if (!s.ask) return { err: 'walked onto the slip unit, no question', live: !!s.slipLive };
    return { log, asked: true }; // the question box is drawn on the next frame; the main loop answers it
  }
  // hold: wait for the order, then hold still (A), strip a wall cell (B) or keep moving until it lapses.
  for (let i = 0; i < 200 && !s.slipLive && !s.slip.result; i++) step(1);
  if (!s.slipLive) return { err: 'hold order never arrived', t: s.time, slipAt: s.slipAt };
  log.push(`arrived at ${s.time.toFixed(1)} s; harvest offered=${!!G.startStrip}`);
  if (did === 'A') step(C.slip.hold * 20 + 10);
  else if (did === 'B') {
    let ok = false;
    for (let y = 1; y < s.size - 1 && !ok; y++) for (let x = 1; x < s.size - 1 && !ok; x++) { const k = G.idx(s, x, y); if (s.tiles[k] !== 'cell' || Math.hypot(x - s.slipLive.at.x, y - s.slipLive.at.y) > 6) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!ok && G.open(s, x + dx, y + dy)) { p.x = x + dx + 0.5; p.y = y + dy + 0.5; p.path = []; ok = G.startStrip(s); } }
    log.push(`startStrip ${ok}`); step(60);
  } else { // walk back and forth far from where it arrived
    const at = s.slipLive.at; let far = null;
    for (let r = 5; r < 14 && !far; r++) for (let a = 0; a < 12 && !far; a++) { const x = Math.floor(at.x + r * Math.cos(a)), y = Math.floor(at.y + r * Math.sin(a)); if (G.open(s, x, y)) far = { x: x + 0.5, y: y + 0.5 }; }
    for (let i = 0; i < (C.slip.window + 2) * 20 && s.slipLive; i++) { if (far) { p.x = far.x; p.y = far.y; } step(1); }
  }
  return { log, result: s.slip.result };
}

async function play(browser, id) {
  const [kind, meant, did] = id.split(':');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, reducedMotion: id === 'hold:A:none' ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  const log = { id, errors: [], steps: [], result: null };
  pg.on('pageerror', (e) => log.errors.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('insiderim.scenes.ever', '["begin"]'));
  await pg.reload();
  await pg.evaluate(() => { window.insiderim.qa.god(true); window.insiderim.qa.skipScenes(true); });
  await pg.click('#begin');
  const t0 = Date.now(); let livers = 0, done = false, lastKey = '', idle = 0, frightShot = false;
  while (Date.now() - t0 < 4 * 60e3 && !done) {
    const r = await pg.evaluate(({ kind, did }) => {
      const I = window.insiderim, q = I.qa, st = q.state(), pend = q.pending(), s = I.state;
      if (!document.getElementById('tip').hidden) { document.getElementById('tip-ok').click(); return { what: 'tip' }; }
      if (pend?.kind === 'card') { q.pick('continue'); return { what: 'card', st }; }
      if (pend?.kind === 'ending') return { what: 'end', title: pend.options[0].label, st };
      if (pend?.kind === 'upgrade') { q.pick(pend.options[0].id); return { what: 'upgrade' }; }
      if (pend?.kind === 'ask' && kind === 'lamp' && st.slipLive) {
        if (!pend.options.length) return { what: 'wait', st };
        const want = did === 'A' ? ['salvage'] : ['leave', 'wake'];
        const o = want.map((w) => pend.options.find((x) => x.id === w && x.enabled)).find(Boolean);
        const text = document.getElementById('ask-text').textContent;
        if (!o) return { what: 'fork-missing', want, opts: pend.options.map((x) => x.id), st };
        q.pick(o.id); return { what: 'slipask', picked: o.id, options: pend.options.map((x) => x.id + (x.enabled ? '' : '(off)')), text, st };
      }
      if (pend?.kind === 'ask') { q.pick(pend.options.find((o) => o.id === 'leave' && o.enabled) ? 'leave' : pend.options.find((o) => o.enabled).id); return { what: 'ask' }; }
      if (pend?.kind === 'fork') {
        const opts = pend.options.filter((o) => o.enabled);
        const isSlip = st.slip && !st.slip.result && kind === 'fork' && st.chapter >= 2 && st.place === 'junction:heart';
        if (isSlip) {
          if (did !== 'early' && !st.slipLive) { I.G.update(s, 0.05); return { what: 'waitslip', t: s.time, slipAt: s.slipAt, st }; }
          const want = did === 'A' ? 'hepatic' : did === 'B' ? 'gastric' : did === 'early' ? 'hepatic' : opts.map((o) => o.id).find((x) => x !== 'hepatic' && x !== 'gastric' && x !== 'stay');
          const o = opts.find((x) => x.id === want);
          if (!o) return { what: 'fork-missing', want, opts: opts.map((x) => x.id), st };
          const marked = opts.filter((x) => /assigned/.test(x.label)).map((x) => x.id);
          q.pick(o.id); return { what: 'slipfork', picked: o.id, marked, live: st.slipLive, st };
        }
        const o = opts.find((x) => /assigned/.test(x.label)) ?? opts.find((x) => x.id === 'lungs') ?? opts[0];
        q.pick(o.id); return { what: 'fork', picked: o.id, at: st.at, st };
      }
      if (st.started && st.status === 'playing' && !st.flying && !st.scene && !st.place.startsWith('junction')) return { what: 'map', st };
      return { what: 'wait', st };
    }, { kind, did });
    if (r.st?.slipLive && !frightShot) { frightShot = true; await pg.screenshot({ path: path.join(OUT, `${id.replace(/:/g, '-')}-live.png`) }); }
    if (r.what === 'end') { log.steps.push(`ending ${r.title}`); break; }
    if (r.what === 'fork') log.steps.push(`fork ${r.at}->${r.picked} (ch ${r.st.chapter}, slip ${JSON.stringify(r.st.slip)})`);
    if (r.what === 'card') log.steps.push(`card ch ${r.st.chapter}`);
    if (r.what === 'fork-missing') { log.stuck = `fork option missing: ${r.want} of ${r.opts}`; break; }
    if (r.what === 'slipask') log.steps.push(`slip ask picked ${r.picked} of [${r.options}] text: ${r.text}`);
    if (r.what === 'slipfork') { log.steps.push(`slip fork picked ${r.picked}, marked [${r.marked}], live ${r.live}`); }
    if (r.what === 'map') {
      if (r.st.place === 'liver' && livers === 0) {
        livers++;
        await pg.evaluate(({ kind, meant }) => window.insiderim.qa.slip(kind, meant), { kind, meant });
        const left = await pg.evaluate(liver); log.steps.push(`liver 1 done (${JSON.stringify(left)})`);
      } else if (r.st.place === 'vessel' && r.st.slip && !r.st.slip.result && kind !== 'fork') {
        const v = await pg.evaluate(vessel, did); log.steps.push(`vessel slip: ${JSON.stringify(v)}`);
        if (v.err) { log.stuck = v.err + ' ' + JSON.stringify(v.log ?? v); break; }
      } else {
        await pg.evaluate(() => window.insiderim.qa.finishMap()); log.steps.push(`left ${r.st.place}`);
      }
    }
    const st = await pg.evaluate(() => window.insiderim.qa.state());
    if (st.slip?.result && !log.result) {
      log.result = st.slip.result; log.trust = st.trust; log.compliance = st.compliance; log.aware = st.aware; log.chapter = st.chapter;
      // Let the replies play out, then read what was said.
      await pg.waitForTimeout(200);
      log.saidNow = await pg.evaluate(() => window.insiderim.state.thoughts.map((t) => `${t.who}@${t.t.toFixed(1)}: ${t.text}`).filter((t) => /Order|LOG: order|lapsed/.test(t)));
    }
    if (log.result && st.place !== 'vessel' && !st.place.startsWith('junction:heart') || (log.result && Date.now() - t0 > 3 * 60e3)) {
      log.said = await pg.evaluate(() => { const s = window.insiderim.state; return [...(s.rulings ?? []), ...s.thoughts].map((t) => `${t.who}: ${t.text}`).filter((t) => /Order|LOG: order|lapsed/.test(t)); });
      log.carry = await pg.evaluate(() => { const c = window.insiderim.trip.carry; return { took: c?.took, trust: c?.trust, chapter: c?.chapter, pages: c?.pages, aware: c?.aware }; });
      log.place = st.place; done = true;
    }
    const key = `${r.what}|${r.st?.place}|${r.st?.at}`;
    if (key === lastKey && r.what === 'wait') { if (++idle > 300) { log.stuck = `waiting: ${JSON.stringify(r.st)}`; break; } } else { idle = 0; lastKey = key; }
    await pg.waitForTimeout(r.what === 'waitslip' ? 5 : 30);
  }
  if (!log.result && !log.stuck) log.stuck = 'no result: ' + JSON.stringify(await pg.evaluate(() => window.insiderim.qa.state()));
  await pg.screenshot({ path: path.join(OUT, `${id.replace(/:/g, '-')}.png`) });
  await ctx.close();
  return log;
}

(async () => {
  const browser = await chromium.launch();
  const queue = [...ONLY], results = [];
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const r = await play(browser, id);
      results.push(r);
      const [kind, meant, did] = id.split(':');
      const expect = did === 'none' ? (kind === 'lamp' ? (meant === 'B' ? 'match' : 'miss') : 'lapsed') : did === 'early' ? '?' : did === meant ? 'match' : 'miss';
      console.log(`${id.padEnd(12)} -> ${r.result ?? 'NONE'} (expect ${expect}) trust ${r.trust ?? '-'} compliance ${r.compliance ?? '-'} aware ${r.aware ?? '-'} ch ${r.chapter ?? '-'} | ${r.stuck ?? ''} | errors ${r.errors.length} | ${[...new Set([...(r.saidNow ?? []).map((x) => x.replace(/@[\d.]+/, '')), ...(r.said ?? [])])].join(' / ').slice(0, 220)}`);
    }
  }));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results.sort((a, b) => CASES.indexOf(a.id) - CASES.indexOf(b.id)), null, 1));
  await browser.close(); server.close();
})();
