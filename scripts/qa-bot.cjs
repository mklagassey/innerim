// QA bot: plays the real built page (dist/index.html) in headless Chromium, the way a
// player would reach every screen, and reports errors, stuck states, layout problems and
// frame times. Run after `npm run build`:
//
//   node scripts/qa-bot.cjs                 # desktop + phone, 2 missions each
//   node scripts/qa-bot.cjs --runs 4 --speed 6 --only phone
//
// It steers the ship through the page's debug hook (window.insiderim) but clicks every
// menu, info box, upgrade offer and choice through the DOM, so the UI is exercised.
// Output: scratch/qa/report.json and screenshots in scratch/qa/.
const { chromium, devices } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 2));
const SPEED = Number(arg('speed', 4)); // extra rule steps per frame-ish tick; 1 = real time
const ONLY = arg('only', '');
const WALL = Number(arg('minutes', 6)) * 60e3; // wall-clock limit per mission
const OUT = path.resolve(arg('out', 'scratch/qa'));
fs.mkdirSync(OUT, { recursive: true });

const page = fs.readFileSync(path.resolve('dist/index.html'));
const server = http.createServer((_, res) => res.setHeader('content-type', 'text/html').end(page)).listen(0);
const URL = `http://localhost:${server.address().port}/`;

const PROFILES = [
  { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
  { name: 'phone', use: { ...devices['iPhone 13'] } },
  { name: 'small-phone', use: { ...devices['Galaxy S8'] } },
].filter((p) => !ONLY || p.name === ONLY);

// One decision for the ship, run inside the page. Knows the map (it cheats), so it tests
// flow and stability, not exploring skill.
function step(speed) {
  const I = window.insiderim, s = I.state, G = I.G, C = I.CONFIG, p = s.player;
  if (s.status !== 'playing' || s.offer || s.ask) return { status: s.status };
  const mid = (t) => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const b = (window.__bot ??= { plan: 0, mapT: -1, place: '' });
  if (b.place !== s.place + s.size + s.vein.x) { b.place = s.place + s.size + s.vein.x; b.stuckAt = { x: p.x, y: p.y, t: s.time }; }
  if (p.hp < G.maxHp(s) * 0.4 && s.patches > 0) G.usePatch(s);
  const foe = G.enemyNear(s, p, 2.2);
  if (G.canLeave(s)) G.leave(s);
  else if (foe) { if (p.attackId !== foe.id) G.attack(s, foe.id); }
  else if (!p.channel && !p.path.length) {
    const quota = C.energy.quota + (C.energy.quotaKeep ?? 0) + 2;
    if (s.place === 'liver' && s.tumor.size && s.excised < C.tumor.goal) {
      // Cut the nodule out first: stand on an open tile beside the nearest tumor cell.
      let best = null, bd = Infinity;
      for (const i of s.tumor) {
        const t = { x: i % s.size, y: Math.floor(i / s.size) };
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (G.open(s, t.x + dx, t.y + dy)) {
          const d = G.dist(p, mid(t)); if (d < bd) { bd = d; best = { t, at: { x: t.x + dx, y: t.y + dy } }; }
        }
      }
      if (best && G.dist(p, mid(best.at)) < 0.7) {
        if (!G.startStrip(s)) G.moveTo(s, best.at.x + 0.5, best.at.y + 0.5);
      } else if (best) G.moveTo(s, best.at.x + 0.5, best.at.y + 0.5);
    } else if (s.place !== 'liver' || p.energy >= quota) G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5);
    else if (G.glucoseHere(s) > 0) G.startSkim(s);
    else {
      let best = null, bd = Infinity;
      for (const [k, v] of s.glucose) { const g = { x: (k % s.size) + 0.5, y: Math.floor(k / s.size) + 0.5 }; if (v > 0 && G.dist(p, g) < bd) { bd = G.dist(p, g); best = g; } }
      if (best) G.moveTo(s, best.x, best.y); else if (G.stripTarget(s)) G.startStrip(s); else G.moveTo(s, s.vein.x + 0.5, s.vein.y + 0.5);
    }
  }
  // Fast-forward: extra rule steps on top of the page's own loop.
  for (let i = 0; i < speed - 1 && s.status === 'playing' && !s.offer && !s.ask; i++) G.update(s, 0.05);
  return { status: s.status, place: s.place, t: s.time, hp: p.hp, energy: p.energy, alert: s.alert, host: s.hostHealth, excised: s.excised };
}

// Things a player would notice about the layout at this size.
function layout() {
  const vw = innerWidth, vh = innerHeight, bad = [];
  if (document.documentElement.scrollWidth > vw + 1) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide in ${vw}px)`);
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden]'); };
  for (const el of document.querySelectorAll('button, [role=button]')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), name = (el.id || el.textContent || '').trim().slice(0, 40);
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
      const scroller = el.closest('.veil'); // veils scroll, so off-screen there is fine
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) bad.push(`button off screen: "${name}"`);
    }
    if (matchMedia('(pointer: coarse)').matches && (r.height < 32 || r.width < 32) && el.tagName === 'BUTTON') bad.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: "${name}"`);
  }
  // HUD boxes that sit on top of each other.
  const hud = [...document.querySelectorAll('.hud')].filter(shown).map((el) => ({ el, r: el.getBoundingClientRect(), n: el.className.replace('hud ', '') + (el.id ? '#' + el.id : '') }));
  for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) {
    const a = hud[i].r, c = hud[j].r;
    const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    if (ox > 4 && oy > 4 && !hud[i].el.contains(hud[j].el) && !hud[j].el.contains(hud[i].el)) bad.push(`HUD overlap: ${hud[i].n} and ${hud[j].n} (${Math.round(ox)}x${Math.round(oy)})`);
  }
  return bad;
}

async function mission(browser, prof, run) {
  const ctx = await browser.newContext({ ...prof.use });
  const pg = await ctx.newPage();
  const log = { profile: prof.name, run, errors: [], warnings: [], layout: new Set(), places: [], screens: [], end: null, frames: [], stuck: [] };
  pg.on('pageerror', (e) => log.errors.push(String(e.stack || e)));
  pg.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); else if (m.type() === 'warning') log.warnings.push(m.text()); });
  await pg.goto(URL);
  // Frame-time sampler: real rAF intervals while maps are being played.
  await pg.evaluate(() => { const f = (window.__frames = []); let t = performance.now(); const tick = (n) => { if (window.insiderim?.state?.status === 'playing') f.push(n - t); t = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const shot = async (tag) => { const f = `${prof.name}-r${run}-${String(log.screens.length).padStart(2, '0')}-${tag}.png`; await pg.screenshot({ path: path.join(OUT, f) }); log.screens.push(f); };
  const vis = (id) => pg.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.hidden; }, id);
  for (const l of await pg.evaluate(layout)) log.layout.add('intro: ' + l);
  await shot('intro');
  await pg.click('#begin');
  const t0 = Date.now(); let lastPlace = '', lastProgress = Date.now(), lastKey = '', seen = new Set();
  const rnd = (() => { let x = 1234 + run * 77 + prof.name.length; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  while (Date.now() - t0 < WALL) {
    if (await vis('over')) {
      log.end = await pg.evaluate(() => ({ title: document.getElementById('over-title').textContent, body: document.getElementById('over-body').textContent, trip: window.insiderim.trip.trip, carry: window.insiderim.trip.carry }));
      for (const l of await pg.evaluate(layout)) log.layout.add('over: ' + l);
      await shot('over');
      break;
    }
    if (await vis('tip')) {
      const title = await pg.textContent('#tip-title');
      if (!seen.has('tip:' + title)) { seen.add('tip:' + title); for (const l of await pg.evaluate(layout)) log.layout.add(`tip "${title}": ` + l); if (seen.size < 6) await shot('tip'); }
      await pg.click('#tip-ok'); continue;
    }
    if (await vis('offer')) { for (const l of await pg.evaluate(layout)) log.layout.add('offer: ' + l); await pg.click('#offer-list button'); continue; }
    if (await vis('ask')) { for (const l of await pg.evaluate(layout)) log.layout.add('ask: ' + l); await pg.locator('#ask-list button:not([disabled])').first().click(); continue; }
    if (await vis('world')) {
      const where = await pg.textContent('#world-status');
      if (!seen.has('world:' + where.split('·')[1])) { seen.add('world:' + where.split('·')[1]); for (const l of await pg.evaluate(layout)) log.layout.add('world: ' + l); await shot('world'); }
      const ways = pg.locator('#world-ways button[data-to]');
      const n = await ways.count();
      if (!n) { log.stuck.push('world map with no way onward: ' + where); break; }
      // Mostly the first way; sometimes another, to visit the stomach, gut and veins.
      await ways.nth(rnd() < 0.6 ? 0 : Math.floor(rnd() * n)).click();
      lastProgress = Date.now();
      continue;
    }
    const st = await pg.evaluate(step, SPEED);
    if (st.status === 'playing' && st.place) {
      const key = `${st.place}`;
      if (key !== lastPlace) {
        lastPlace = key; log.places.push(key);
        await pg.waitForTimeout(400); for (const l of await pg.evaluate(layout)) log.layout.add(`${key} HUD: ` + l); await shot(key);
      }
      const k2 = `${st.place}|${Math.round(st.energy)}|${st.excised}|${Math.round(st.t / 20)}`;
      if (k2 !== lastKey) { lastKey = k2; lastProgress = Date.now(); }
    }
    if (Date.now() - lastProgress > 45e3) {
      log.stuck.push(`no progress for 45 s in ${lastPlace}: ` + JSON.stringify(await pg.evaluate(() => { const s = window.insiderim.state; return { t: s.time, p: s.player, vein: s.vein, ch: s.player.channel, status: s.status }; })).slice(0, 400));
      await shot('stuck'); break;
    }
    await pg.waitForTimeout(60);
  }
  if (!log.end && !log.stuck.length) log.stuck.push(`mission not finished in ${WALL / 60e3} min (trip ${await pg.evaluate(() => window.insiderim.trip.trip)}, places ${log.places.length})`);
  const fr = await pg.evaluate(() => window.__frames.slice(5));
  fr.sort((a, b) => a - b);
  const q = (x) => fr.length ? +fr[Math.floor(x * (fr.length - 1))].toFixed(1) : null;
  log.frames = { n: fr.length, median_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), over33: fr.filter((x) => x > 33.4).length };
  log.layout = [...log.layout];
  log.minutes = +((Date.now() - t0) / 60e3).toFixed(1);
  await ctx.close();
  return log;
}

(async () => {
  const browser = await chromium.launch();
  const all = [];
  for (const prof of PROFILES) for (let r = 1; r <= RUNS; r++) {
    const l = await mission(browser, prof, r);
    console.log(`${prof.name} #${r}: ${l.end ? l.end.title : 'UNFINISHED'} | ${l.minutes} min | maps ${l.places.join(' > ')} | errors ${l.errors.length} | stuck ${l.stuck.length} | frames p50 ${l.frames.median_ms} p95 ${l.frames.p95_ms} ms | layout ${l.layout.length}`);
    all.push(l);
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(all, null, 1));
  await browser.close(); server.close();
})();
