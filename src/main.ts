// Input, the game loop and the heads-up display. All rules live in game.ts.
import { CONFIG, UPGRADES, UpgradeId } from './config';
import * as G from './game';
import { draw, nearestBloodCell, TH, TW, View } from './render';
import * as Tips from './tips';
import * as Sound from './audio';
import * as Stats from './stats';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;

let s = G.createGame();
let started = false;
const view: View = { w: 800, h: 600, zoom: 1, dpr: 1, time: 0, showMap: false, hover: null, hoverEnemy: null, mark: null };
const keys = new Set<string>();
let held = false, pointer: { x: number; y: number } | null = null, retarget = 0;

let sharpness = 2, slowFrames = 0; // drawing detail is dropped on machines that cannot keep up
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, sharpness);
  view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.dpr = dpr;
  view.zoom = Math.max(0.75, Math.min(1.5, Math.min(view.w, view.h) / 520));
}
new ResizeObserver(resize).observe(canvas);

/** Where in the liver a point on the screen is. */
function toWorld(px: number, py: number): G.Point {
  const sx = (px - view.w / 2) / view.zoom, sy = (py - view.h / 2) / view.zoom;
  return { x: s.player.x + (sx / (TW / 2) + sy / (TH / 2)) / 2, y: s.player.y + (sy / (TH / 2) - sx / (TW / 2)) / 2 };
}

// Keys move you in screen directions: up the screen is a diagonal through the tissue.
const KEY_DIRS: Record<string, [number, number]> = {
  w: [-1, -1], arrowup: [-1, -1], s: [1, 1], arrowdown: [1, 1], a: [-1, 1], arrowleft: [-1, 1], d: [1, -1], arrowright: [1, -1],
};
function heldDirection(): G.Point | null {
  let x = 0, y = 0;
  for (const k of keys) { const d = KEY_DIRS[k]; if (d) { x += d[0]; y += d[1]; } }
  return x || y ? { x, y } : null;
}

function aimPointer() {
  if (!pointer) return;
  const w = toWorld(pointer.x, pointer.y);
  view.hover = w;
  view.hoverEnemy = G.enemyNear(s, w, 0.9)?.id ?? null;
}
function walkToPointer() {
  if (!pointer) return;
  const w = toWorld(pointer.x, pointer.y);
  G.moveTo(s, w.x, w.y);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!started || s.status !== 'playing') return;
  canvas.setPointerCapture(ev.pointerId);
  const r = canvas.getBoundingClientRect();
  pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top };
  aimPointer();
  const w = toWorld(pointer.x, pointer.y);
  if (ev.button === 2 || ev.shiftKey) { G.shoot(s, w.x, w.y); return; }
  if (view.hoverEnemy !== null) { G.attack(s, view.hoverEnemy); return; }
  held = true;
  walkToPointer();
});
canvas.addEventListener('pointermove', (ev) => {
  const r = canvas.getBoundingClientRect();
  pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top };
});
const release = () => { held = false; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { if (!held) { pointer = null; view.hover = null; view.hoverEnemy = null; } });
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

const useE = () => { if (!G.leave(s)) G.startSkim(s); };
const toggleMap = () => { view.showMap = !view.showMap; $('map').setAttribute('aria-pressed', String(view.showMap)); };

window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'tab' || k === 'm') { ev.preventDefault(); if (!ev.repeat) toggleMap(); return; }
  if (tip) { if (k === 'enter' || k === ' ' || k === 'escape') { ev.preventDefault(); closeTip(); } return; }
  if (!started || s.status !== 'playing') return;
  if (KEY_DIRS[k]) { ev.preventDefault(); keys.add(k); }
  else if (ev.repeat) return;
  else if (k === 'e') useE();
  else if (k === 'f') G.startStrip(s);
  else if (k === ' ') { ev.preventDefault(); G.strike(s); }
  else if (s.offer && '123'.includes(k)) { const id = s.offer[Number(k) - 1]; if (id) G.choose(s, id); }
  else if (k === 'q' && view.hover) G.shoot(s, view.hover.x, view.hover.y);
  else if (k === 'h' || k === '1') G.usePatch(s);
  else if (k === 'c') G.cloak(s);
});
window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); release(); });

$('act-e').addEventListener('click', useE);
$('act-f').addEventListener('click', () => G.startStrip(s));
$('map').addEventListener('click', toggleMap);
const showSound = () => { $('sound').textContent = Sound.isOn() ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(Sound.isOn())); };
$('sound').addEventListener('click', () => { Sound.setOn(!Sound.isOn()); showSound(); });
showSound();
$('act-h').addEventListener('click', () => G.usePatch(s));
$('act-c').addEventListener('click', () => G.cloak(s));
$('offer-list').addEventListener('click', (ev) => {
  const id = (ev.target as HTMLElement).closest('button')?.dataset.id as UpgradeId | undefined;
  if (id) { G.choose(s, id); keys.clear(); release(); }
});
$('tip-ok').addEventListener('click', closeTip);
$('tips-reset').addEventListener('click', () => { Tips.unmuteAll(); $('tips-reset').hidden = true; });
$('tips-reset').hidden = Tips.mutedCount() === 0;
$('begin').addEventListener('click', () => { started = true; Sound.start(); $('intro').hidden = true; canvas.focus(); });
$('again').addEventListener('click', () => { s = G.createGame(); Stats.begin(); shownOffer = ''; Tips.newRun(); keys.clear(); release(); $('over').hidden = true; });

// ---------- heads-up display ----------

const last: Record<string, string> = {};
let shownOffer = '';
let tip: Tips.Tip | null = null;

function showTip(next: Tips.Tip, at: G.Point) {
  tip = next;
  view.mark = at;
  // Keep the box off the thing it is pointing at.
  const markY = view.h / 2 + (at.x - s.player.x + at.y - s.player.y) * (TH / 2) * view.zoom;
  const markX = view.w / 2 + (at.x - s.player.x - (at.y - s.player.y)) * (TW / 2) * view.zoom;
  $('tip').classList.toggle('high', markY > view.h * 0.5);
  $('tip').classList.toggle('right', markX < view.w * 0.5);
  Sound.play('tip');
  keys.clear(); release();
  $('tip-kind').textContent = next.kind;
  $('tip-title').textContent = next.title;
  $('tip-body').textContent = next.body;
  $<HTMLInputElement>('tip-mute').checked = false;
  $('tip').hidden = false;
  $('tip-ok').focus();
}
function closeTip() {
  if (!tip) return;
  if ($<HTMLInputElement>('tip-mute').checked) Tips.mute(tip.id);
  tip = null;
  view.mark = null;
  $('tip').hidden = true;
  canvas.focus();
}
const roman = (n: number) => 'I'.repeat(n);
function set(id: string, prop: 'text' | 'height' | 'width' | 'hidden' | 'tier', value: string) {
  if (last[id + prop] === value) return;
  last[id + prop] = value;
  const el = $(id);
  if (prop === 'text') el.textContent = value;
  else if (prop === 'hidden') el.hidden = value === '1';
  else if (prop === 'tier') el.dataset.tier = value;
  else el.style[prop] = value;
}

function hud() {
  const p = s.player, pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  set('hp-fill', 'height', pct(p.hp, G.maxHp(s)));
  set('hp-val', 'text', String(Math.ceil(p.hp)));
  set('energy-fill', 'height', pct(p.energy, CONFIG.energy.quota));
  set('energy-val', 'text', `${p.energy}/${CONFIG.energy.quota}`);
  set('host-fill', 'width', pct(s.hostHealth, CONFIG.host.maxHealth));
  set('host-val', 'text', `${s.hostHealth}%`);
  set('alert-fill', 'width', pct(s.alert, CONFIG.alert.max));
  const tier = G.alertTier(s);
  const losing = G.losingThem(s);
  set('alert-val', 'text', losing ? `${tier.name} \u00b7 losing them` : tier.name);
  $('alert').classList.toggle('losing', losing);
  set('alert', 'tier', String(CONFIG.alert.tiers.findIndex((t) => t.name === tier.name)));

  const playing = started && s.status === 'playing';
  const leaving = G.canLeave(s), sip = G.glucoseHere(s) > 0, harvesting = !!p.channel;
  set('act-e', 'hidden', playing && !harvesting && (leaving || sip) ? '0' : '1');
  set('act-e', 'text', leaving ? 'E  Ride the central vein out' : 'E  Skim glucose');
  set('act-f', 'hidden', playing && !harvesting && G.stripTarget(s) ? '0' : '1');
  set('need', 'hidden', playing && G.atVein(s) && !leaving ? '0' : '1');
  set('act-h', 'hidden', playing && s.patches > 0 ? '0' : '1');
  set('act-h', 'text', `Fibrin patch \u00d7${s.patches}`);
  set('act-c', 'hidden', playing && s.upgrades.cd47 > 0 ? '0' : '1');
  set('act-c', 'text', G.cloaked(s) ? `Unseen ${s.cloak.toFixed(0)}s` : s.cloakCd > 0 ? `Cloak ${Math.ceil(s.cloakCd)}s` : s.player.energy < CONFIG.cloak.energy ? 'Cloak needs 2 energy' : 'Cloak ready');
  const owned = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => s.upgrades[id] > 0);
  set('build', 'text', owned.map((id) => `${UPGRADES[id].name} ${roman(s.upgrades[id])}`).join('\n'));
  const tracks = owned.reduce<Record<string, number>>((a, id) => ({ ...a, [UPGRADES[id].track]: (a[UPGRADES[id].track] ?? 0) + s.upgrades[id] }), {});
  const lead = Object.entries(tracks).sort((a, b) => b[1] - a[1])[0];
  set('style', 'text', lead ? `${lead[0]} build` : 'No upgrades yet');

  // The upgrade choice: built once per offer so the buttons stay clickable.
  const key = s.offer ? s.offer.join() : '';
  if (key !== shownOffer) {
    shownOffer = key;
    $('offer').hidden = !s.offer;
    $('offer-list').replaceChildren(...(s.offer ?? []).map((id, i) => {
      const u = UPGRADES[id], b = document.createElement('button');
      b.type = 'button'; b.dataset.id = id; b.dataset.track = u.track;
      const add = (tag: string, text: string) => b.appendChild(Object.assign(document.createElement(tag), { textContent: text }));
      add('small', `${i + 1} \u00b7 ${u.track}`);
      add('strong', `${u.name}${s.upgrades[id] ? ' ' + roman(s.upgrades[id] + 1) : ''}`);
      add('span', u.what);
      add('em', u.real);
      return b;
    }));
  }

  set('log', 'text', s.log.filter((m) => s.time - m.t < 7).slice(-3).map((m) => m.text).join('\n'));

  if (s.status !== 'playing' && $('over').hidden) {
    $('over').hidden = false;
    $('over-title').textContent = s.status === 'won' ? 'You made it out' : 'The liver cleared you';
    const verdict = s.cellsKilled === 0 ? 'The host never felt a thing.'
      : s.cellsKilled <= 2 ? 'The host will have a rough afternoon.' : 'The host is going to need a doctor.';
    const seen = Math.round((s.explored.reduce((a, b) => a + b, 0) / s.tiles.filter((t) => t !== 'cell').length) * 50);
    $('over-body').textContent =
      `${Math.round(s.time)} seconds inside. Host health ${s.hostHealth}%. ${s.cellsKilled} hepatocyte${s.cellsKilled === 1 ? '' : 's'} killed, ` +
      `${s.kills} immune cell${s.kills === 1 ? '' : 's'} destroyed, roughly ${Math.min(100, seen)}% of the tissue mapped. ${s.status === 'won' ? verdict : ''}`;
    $('over-saved').textContent = 'Filing the run report\u2026';
    void Stats.save(s).then((ok) => { $('over-saved').textContent = ok ? 'Run report filed.' : 'Run report not filed: open the game from its Claude link, signed in, to record runs.'; });
  }
}

// ---------- loop ----------

let then = performance.now(), walked = 0;
function frame(now: number) {
  const raw = (now - then) / 1000;
  const dt = Math.min(0.05, raw);
  then = now;
  slowFrames = raw > 1 / 30 && raw < 0.25 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
  if (slowFrames > 90 && sharpness > 1) { sharpness = 1; slowFrames = 0; resize(); }
  view.time += dt;
  if (started && s.status === 'playing') {
    if (held) { retarget -= dt; if (retarget <= 0) { retarget = 0.12; walkToPointer(); } }
    if (!tip && !s.offer) { const next = Tips.nextTip(s, { rbc: s.time > 9 ? nearestBloodCell(s) : null }); if (next) showTip(next.tip, next.at); }
    if (!tip) {
      const was = { x: s.player.x, y: s.player.y };
      G.update(s, dt, heldDirection());
      const moved = G.dist(was, s.player);
      walked += moved;
      Stats.track(s, dt, moved);
      if (walked > 0.95) { walked = 0; Sound.play('step'); }
    }
  }
  for (const e of s.events) Sound.play(e);
  s.events.length = 0;
  // The host's pulse quickens as the immune alert climbs.
  const tier = CONFIG.alert.tiers.findIndex((t) => t.name === G.alertTier(s).name);
  // The score follows the same heart: it thickens with the alert and when something is on your tail.
  const near = s.enemies.filter((e) => G.dist(e, s.player) < 10);
  const chasers = near.filter((e) => e.mood === 'chase').length;
  const heat = Math.max(tier / 3, chasers ? 0.5 + 0.17 * Math.min(3, chasers) : near.some((e) => e.mood === 'investigate') ? 0.3 : 0);
  const bpm = Math.max([58, 76, 98, 124][tier], chasers ? 96 : 0);
  Sound.pulse(started && s.status === 'playing' && !tip ? bpm : 0, s.player.hp / G.maxHp(s), heat);
  aimPointer();
  draw(ctx, s, view);
  hud();
  requestAnimationFrame(frame);
}

// Lets a script (or a curious player) poke at the live game from the console.
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, G, CONFIG, view, toWorld };

resize();
requestAnimationFrame(frame);
