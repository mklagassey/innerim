// Input, the game loop and the heads-up display. All rules live in game.ts.
import { CONFIG, UPGRADES, UpgradeId } from './config';
import * as G from './game';
import { draw, TH, TW, View } from './render';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;

let s = G.createGame();
let started = false;
const view: View = { w: 800, h: 600, zoom: 1, time: 0, showMap: false, hover: null, hoverEnemy: null };
const keys = new Set<string>();
let held = false, pointer: { x: number; y: number } | null = null, retarget = 0;

function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
$('act-h').addEventListener('click', () => G.usePatch(s));
$('act-c').addEventListener('click', () => G.cloak(s));
$('offer-list').addEventListener('click', (ev) => {
  const id = (ev.target as HTMLElement).closest('button')?.dataset.id as UpgradeId | undefined;
  if (id) { G.choose(s, id); keys.clear(); release(); }
});
$('begin').addEventListener('click', () => { started = true; $('intro').hidden = true; canvas.focus(); });
$('again').addEventListener('click', () => { s = G.createGame(); shownOffer = ''; keys.clear(); release(); $('over').hidden = true; });

// ---------- heads-up display ----------

const last: Record<string, string> = {};
let shownOffer = '';
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
  set('alert-val', 'text', tier.name);
  set('alert', 'tier', String(CONFIG.alert.tiers.findIndex((t) => t.name === tier.name)));

  const playing = started && s.status === 'playing';
  const leaving = G.canLeave(s), sip = G.glucoseHere(s) > 0, harvesting = !!p.channel;
  set('act-e', 'hidden', playing && !harvesting && (leaving || sip) ? '0' : '1');
  set('act-e', 'text', leaving ? 'E  Ride the central vein out' : 'E  Skim glucose');
  set('act-f', 'hidden', playing && !harvesting && G.stripTarget(s) ? '0' : '1');
  set('need', 'hidden', playing && G.atVein(s) && !leaving ? '0' : '1');
  set('act-h', 'hidden', playing && s.patches > 0 ? '0' : '1');
  set('act-h', 'text', `H  Fibrin patch \u00d7${s.patches}`);
  set('act-c', 'hidden', playing && s.upgrades.cd47 > 0 ? '0' : '1');
  set('act-c', 'text', G.cloaked(s) ? `Unseen ${s.cloak.toFixed(0)}s` : s.cloakCd > 0 ? `Cloak ${Math.ceil(s.cloakCd)}s` : 'C  Cloak');
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
  }
}

// ---------- loop ----------

let then = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - then) / 1000);
  then = now;
  view.time += dt;
  if (started && s.status === 'playing') {
    if (held) { retarget -= dt; if (retarget <= 0) { retarget = 0.12; walkToPointer(); } }
    G.update(s, dt, heldDirection());
  }
  aimPointer();
  draw(ctx, s, view);
  hud();
  requestAnimationFrame(frame);
}

// Lets a script (or a curious player) poke at the live game from the console.
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, G, CONFIG, view, toWorld };

resize();
requestAnimationFrame(frame);
