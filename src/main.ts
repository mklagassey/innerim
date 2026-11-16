// Input, the game loop and the heads-up display. All rules live in game.ts.
import { CONFIG, UPGRADES, UpgradeId } from './config';
import * as G from './game';
import { draw, nearestBloodCell, project, setSpin, TH, TW, unturn, View } from './render';
import * as Tips from './tips';
import * as Sound from './audio';
import * as Stats from './stats';
import * as T from './trip';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;

let s = G.createGame();
let started = false; // true while a local map is being played; false on the world map
let trip = T.newTrip();
let dest: T.NodeId = 'hvein'; // where the map being played leads
let settled = true; // the current map's ending has been dealt with
const view: View = { w: 800, h: 600, zoom: 1, dpr: 1, time: 0, showMap: false, hover: null, hoverEnemy: null, mark: null, heat: 0, kick: 0, still: matchMedia('(prefers-reduced-motion: reduce)').matches };
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
  const d = unturn((sx / (TW / 2) + sy / (TH / 2)) / 2, (sy / (TH / 2) - sx / (TW / 2)) / 2);
  return { x: s.player.x + d.x, y: s.player.y + d.y };
}

// Keys move you in screen directions: up the screen is a diagonal through the tissue.
const KEY_DIRS: Record<string, [number, number]> = {
  w: [-1, -1], arrowup: [-1, -1], s: [1, 1], arrowdown: [1, 1], a: [-1, 1], arrowleft: [-1, 1], d: [1, -1], arrowright: [1, -1],
};
function heldDirection(): G.Point | null {
  let x = 0, y = 0;
  for (const k of keys) { const d = KEY_DIRS[k]; if (d) { x += d[0]; y += d[1]; } }
  return x || y ? unturn(x, y) : null; // keys mean screen directions whichever way the view is turned
}

// The view turns in quarter steps, and swings there instead of snapping.
let quarter = 0, spin = 0;
const turnView = (by: number) => { quarter += by; };

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
  else if (k === 'z') turnView(1);
  else if (k === 'x') turnView(-1);
  else if (k === 'e') useE();
  else if (k === 'f') G.startStrip(s);
  else if (k === ' ') { ev.preventDefault(); G.strike(s); }
  else if (s.offer && '123'.includes(k)) { const id = s.offer[Number(k) - 1]; if (id) G.choose(s, id); }
  else if (k === 'q' && view.hover) G.shoot(s, view.hover.x, view.hover.y);
  else if (k === 'h' || k === '1') G.usePatch(s);
  else if (k === 'c') G.cloak(s);
  else if (k === 'b') G.board(s);
});
window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); release(); });

$('act-e').addEventListener('click', useE);
$('act-f').addEventListener('click', () => G.startStrip(s));
$('map').addEventListener('click', toggleMap);
$('turn-l').addEventListener('click', () => turnView(1));
$('turn-r').addEventListener('click', () => turnView(-1));
const showSound = () => { $('sound').textContent = Sound.isOn() ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(Sound.isOn())); };
$('sound').addEventListener('click', () => { Sound.setOn(!Sound.isOn()); showSound(); });
showSound();
$('act-h').addEventListener('click', () => G.usePatch(s));
$('act-q').addEventListener('click', () => G.shootNearest(s));
$('act-b').addEventListener('click', () => G.board(s));
$('act-c').addEventListener('click', () => G.cloak(s));
$('offer-list').addEventListener('click', (ev) => {
  const id = (ev.target as HTMLElement).closest('button')?.dataset.id as UpgradeId | undefined;
  if (id) { G.choose(s, id); keys.clear(); release(); }
});
$('tip-ok').addEventListener('click', closeTip);
function showNotes() {
  const notes = Tips.fieldNotes();
  $('notes-list').replaceChildren(...notes.flatMap((n) => [Object.assign(document.createElement('dt'), { textContent: `${n.title} \u00b7 ${n.kind}` }), Object.assign(document.createElement('dd'), { textContent: n.body })]));
  if (!notes.length) $('notes-list').append(Object.assign(document.createElement('dd'), { textContent: 'Nothing yet. Notes are added as you meet things.' }));
  $('notes').hidden = false; $('notes').scrollTop = 0;
  $('notes-close').focus({ preventScroll: true });
}
$('notes-close').addEventListener('click', () => { $('notes').hidden = true; });
$('tips-reset').addEventListener('click', () => { Tips.unmuteAll(); $('tips-reset').hidden = true; });
$('tips-reset').hidden = Tips.mutedCount() === 0;
// The trip so far is kept in the browser, so a reload or a phone that drops the tab does not cost you the mission.
const SAVE = 'insiderim.trip';
function saveTrip() {
  try {
    const { at, trip: n, fed, heat, carry, tripsDone } = trip;
    if (carry) localStorage.setItem(SAVE, JSON.stringify({ at, trip: n, fed, heat, carry, tripsDone }));
  } catch { /* private window: nothing is kept */ }
}
function forgetTrip() { try { localStorage.removeItem(SAVE); } catch { /* nothing stored */ } }
function savedTrip(): T.Trip | null {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE) ?? 'null') as Partial<T.Trip> | null;
    if (!d || !d.carry || !d.at || !(d.at in T.NODES) || typeof d.carry.hp !== 'number' || d.carry.hp <= 0) return null;
    return { ...T.newTrip(), ...d, carry: { hp: d.carry.hp, energy: d.carry.energy ?? 0, upgrades: d.carry.upgrades ?? ({} as G.Carry['upgrades']), patches: d.carry.patches ?? 0, hostHealth: d.carry.hostHealth ?? 100, hour: d.carry.hour ?? CONFIG.host.startHour, memory: d.carry.memory ?? 0, excised: d.carry.excised ?? 0 } };
  } catch { return null; }
}
const kept = savedTrip();
if (kept) { $('resume').hidden = false; $('resume').textContent = `Continue trip ${kept.trip} from the ${T.NODES[kept.at].name.toLowerCase()}`; $('begin').textContent = 'Begin a new mission'; }
$('resume').addEventListener('click', () => { if (!kept) return; Sound.start(); trip = kept; $('intro').hidden = true; openWorld('Back aboard', 'The ship comes back to life where you left it.'); });
$('begin').addEventListener('click', () => { forgetTrip(); Sound.start(); $('intro').hidden = true; openWorld('The bloodstream', 'You are in the heart, and it is about to throw you out. Pick a vessel. Blood only runs one way, so choose knowing you cannot turn back.'); });
$('again').addEventListener('click', () => { forgetTrip(); trip = T.newTrip(); Tips.newRun(); $('over').hidden = true; openWorld('The bloodstream', 'A new host, a new heart. Pick a vessel.'); });

// ---------- the world map ----------

const SVG = 'http://www.w3.org/2000/svg';
function openWorld(title: string, text: string) {
  started = false;
  saveTrip();
  closeTip(); // an info box from the map you just left has nothing to point at now
  keys.clear(); release();
  const c = trip.carry, here = T.NODES[trip.at], ways = T.ways(trip);
  $('world-title').textContent = title;
  $('world-text').textContent = `${text} ${here.what}`;
  $('world-host').textContent = forecast(c?.hour ?? CONFIG.host.startHour);
  $('world-status').textContent = `Trip ${trip.trip} \u00b7 ${here.name}` + (c ? ` \u00b7 Hull ${Math.ceil(c.hp)} \u00b7 Energy ${c.energy} \u00b7 Host ${c.hostHealth}% \u00b7 ${clock(c.hour)} \u00b7 ${knows(c.memory)} \u00b7 Tumor ${Math.min(c.excised, CONFIG.tumor.goal)}/${CONFIG.tumor.goal} excised` : '');
  const el = (tag: string, attrs: Record<string, string | number>, text = '') => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    return n;
  };
  const map = $('world-map');
  map.replaceChildren();
  for (const leg of T.LEGS) {
    const a = T.NODES[leg.from], b = T.NODES[leg.to], open = leg.from === trip.at;
    // Stop short of each place so the arrowhead shows which way the blood runs.
    const d = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const x1 = a.x + ux * 30, y1 = a.y + uy * 30, x2 = b.x - ux * 40, y2 = b.y - uy * 40;
    const kind = a.kind === 'vein' || b.kind === 'vein' || leg.to === 'heart' ? 'vein' : 'artery';
    map.append(el('path', { class: `leg ${kind}${open ? ' open' : ''}`, d: `M${x1} ${y1} L${x2} ${y2}` }));
    map.append(el('path', { class: `tip${open ? ' open' : ''}`, d: `M${x2 + ux * 12} ${y2 + uy * 12} L${x2 - uy * 8} ${y2 + ux * 8} L${x2 + uy * 8} ${y2 - ux * 8} Z` }));
  }
  for (const [id, n] of Object.entries(T.NODES) as [T.NodeId, T.Node][]) {
    const way = ways.find((l) => l.to === id), isHere = id === trip.at, enter = isHere && n.kind === 'organ';
    const g = el('g', { class: `place${isHere ? ' here' : ''}${way || enter ? ' go' : ''}` });
    if (way || enter) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.dataset.to = enter ? ways[0].to : id; }
    const big = n.kind !== 'artery' && n.kind !== 'vein';
    g.append(el('circle', { cx: n.x, cy: n.y, r: big ? 26 : 20 }));
    g.append(el('text', { x: n.x, y: n.y + (big ? 44 : 38) }, n.name));
    if (isHere) g.append(el('circle', { class: 'you', cx: n.x, cy: n.y, r: 6 }));
    map.append(g);
  }
  $('world-ways').replaceChildren(...ways.map((leg) => {
    const b = document.createElement('button'), word = T.riskWord(T.riskOf(trip, leg));
    b.type = 'button'; b.dataset.to = leg.to;
    b.textContent = T.NODES[leg.from].kind === 'organ' ? `Enter the ${T.NODES[leg.from].name.toLowerCase()}` : `${T.NODES[leg.to].name}${word ? ` (${word})` : ''}`;
    return b;
  }));
  // Time is yours to spend: sit tight and let the host's day move on.
  const wait = document.createElement('button');
  wait.type = 'button'; wait.className = 'wait';
  wait.textContent = `Wait an hour (${CONFIG.wait.energy} energy)`;
  wait.disabled = (c?.energy ?? CONFIG.player.startEnergy) < CONFIG.wait.energy;
  wait.addEventListener('click', () => {
    const k = (trip.carry ??= freshCarry()), h = CONFIG.host;
    const slept = k.hour >= h.asleepFrom || k.hour < h.asleepUntil;
    k.energy -= CONFIG.wait.energy;
    k.hour = (k.hour + 1) % 24;
    if (slept) k.hostHealth = Math.min(h.maxHealth, k.hostHealth + Math.round(h.secondsPerHour / h.sleepHeals));
    openWorld(here.name, slept ? 'You drift for an hour while the host sleeps and mends.' : 'You drift for an hour.');
  });
  const notes = document.createElement('button');
  notes.type = 'button'; notes.className = 'wait'; notes.textContent = 'Field notes';
  notes.addEventListener('click', showNotes);
  $('world-ways').append(wait, notes);
  market();
  $('world').hidden = false;
  ($('world-ways').firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  $('world').scrollTop = 0;
}

// ---------- the gut flora market ----------

let stock: UpgradeId[] = [];
/** What you carry before you have played a single map. */
const freshCarry = (): G.Carry => ({ hp: CONFIG.player.maxHp, energy: CONFIG.player.startEnergy, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>, patches: 1, hostHealth: CONFIG.host.maxHealth, hour: CONFIG.host.startHour, memory: 0, excised: 0 });
const hullMax = (c: G.Carry) => CONFIG.player.maxHp + (c.upgrades.glycocalyx ?? 0) * UPGRADES.glycocalyx.per;
function market() {
  const box = $('world-market'), open = T.NODES[trip.at].kind === 'town';
  box.hidden = !open;
  if (!open) return;
  const c = (trip.carry ??= freshCarry()), m = CONFIG.market;
  const offer = (title: string, cost: number, what: string, can: boolean, buy: () => void) => {
    const b = document.createElement('button');
    b.type = 'button'; b.disabled = !can || c.energy < cost;
    const add = (tag: string, text: string) => b.appendChild(Object.assign(document.createElement(tag), { textContent: text }));
    add('small', `${cost} energy`); add('strong', title); add('span', what);
    b.addEventListener('click', () => { c.energy -= cost; buy(); Sound.play('pickup'); saveTrip(); openWorld('Gut flora', `Done. You have ${c.energy} energy left.`); });
    return b;
  };
  box.replaceChildren(
    offer('Biofilm repair', m.repair.cost, `They knit a film over the breaches: +${m.repair.hull} hull.`, c.hp < hullMax(c), () => { c.hp = Math.min(hullMax(c), c.hp + m.repair.hull); }),
    offer('Fibrin patch', m.patch.cost, 'One patch for the road.', c.patches < CONFIG.items.maxPatches, () => { c.patches++; }),
    offer('Butyrate', m.butyrate.cost, 'What gut bacteria make from fibre. It teaches the immune system tolerance: the host forgets some of what it learned about you.', c.memory > 0.02, () => { c.memory = Math.max(0, c.memory - m.butyrate.forget); }),
    ...stock.map((id) => offer(`${UPGRADES[id].name}${c.upgrades[id] ? ' ' + roman(c.upgrades[id] + 1) : ''}`, m.upgrade.cost, UPGRADES[id].what, (c.upgrades[id] ?? 0) < UPGRADES[id].max, () => {
      c.upgrades[id] = (c.upgrades[id] ?? 0) + 1;
      if (id === 'glycocalyx') c.hp += UPGRADES.glycocalyx.per;
      stock = stock.filter((x) => x !== id);
    })),
  );
}

/** What the host is up to and what is coming, so a trip can be timed. */
function forecast(hour: number): string {
  const h = CONFIG.host, asleep = hour >= h.asleepFrom || hour < h.asleepUntil, fed = G.digesting(hour);
  const until = (meal: number) => ((meal - hour + 24) % 24) || 24;
  const next = [...h.meals].sort((a, b) => until(a) - until(b))[0];
  const state = asleep ? `The host is asleep until ${clock(h.asleepUntil)}: slow blood, sharp noses, and they are mending.` : `The host is awake until ${clock(h.asleepFrom)}.`;
  const gut = fed > 0.5 ? 'They have just eaten: sugar is plentiful and stomach acid is at its worst.' : fed > 0 ? 'They are still digesting: extra sugar, strong acid.' : 'Their stomach is empty: acid is weak, sugar is ordinary.';
  return `${clock(hour)}. ${state} ${gut} Next meal ${clock(next)}.`;
}

/** Sets out for a place: straight there, or by way of whatever is in between. */
function go(to: T.NodeId) {
  const out = T.depart(trip, to);
  if (!out) return;
  if (out.kind === 'arrive') { if (trip.carry) trip.carry.hour = (trip.carry.hour + CONFIG.wait.legHours) % 24; land(to, null, 0, to === 'liver' ? 'The vessel narrows and branches. You are at the edge of the liver.' : to === 'gut' ? 'The artery opens into the wall of the gut. Nothing here wants you dead.' : to === 'stomach' ? `The artery ends in the wall of the stomach. ${G.digesting(trip.carry?.hour ?? CONFIG.host.startHour) > 0.3 ? 'The host has eaten not long ago: the acid will be fierce.' : 'The host has not eaten for a while: the acid is at its weakest.'}` : 'The vessel was quiet.'); return; }
  dest = to;
  const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
  s = G.createGame(Date.now(), trip.carry ?? undefined, out.kind === 'patrol' ? 'vessel' : out.kind, out.kind === 'patrol' ? out.size : 0, vessel);
  settled = false;
  Stats.begin(); shownOffer = '';
  $('world').hidden = true;
  $('where').textContent = out.kind === 'liver' ? 'Liver lobule \u00b7 cell tier' : out.kind === 'stomach' ? 'Stomach lining \u00b7 cell tier' : out.kind === 'lung' ? 'Lung capillaries \u00b7 cell tier' : `${T.NODES[to].name} \u00b7 cell tier`;
  started = true;
  canvas.focus();
}

/** Arrives somewhere and shows the map again. */
function land(to: T.NodeId, carry: G.Carry | null, alert: number, how: string) {
  const fromLiver = trip.at === 'liver', knew = trip.carry?.memory ?? 0;
  if (to === 'gut') { // a fresh stall each visit
    const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => (carry ?? trip.carry)?.upgrades[id] !== UPGRADES[id].max);
    stock = [];
    while (pool.length && stock.length < CONFIG.market.upgrade.stock) stock.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const home = T.arrive(trip, to, carry, alert);
  trip.carry ??= freshCarry(); // from the first vessel on there is a ship to keep track of
  if (carry && knows(carry.memory) !== knows(knew)) how += ' The host is learning what you taste like: expect more antibodies from here on.';
  if (trip.carry && trip.carry.hostHealth <= 0) {
    $('world').hidden = true;
    forgetTrip();
    $('over-title').textContent = 'The host is dead';
    $('over-body').textContent = 'You took too much. The heart you were riding back to has stopped, and you are still ten micrometres tall.';
    $('over-saved').textContent = '';
    $('over').hidden = false;
    return;
  }
  if (home && trip.carry && trip.carry.excised >= CONFIG.tumor.goal) { openWorld('The tumor is gone', 'All of it is out. One road is left: the heart will throw you at the lungs, and from there you leave on a breath. You can also stay and keep working, if you think you should.'); return; }
  if (to === 'lungs' && trip.carry) {
    const k = trip.carry, kept = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => k.upgrades[id] > 0).map((id) => `${UPGRADES[id].name} ${roman(k.upgrades[id])}`);
    const grade = k.hostHealth >= 95 ? 'Textbook. The patient will never know you were there.' : k.hostHealth >= 75 ? 'A clean job. The patient will feel off for a day or two.' : k.hostHealth >= 50 ? 'It worked, but the patient will have a rough week.' : 'The tumor is gone. So is a good part of the liver.';
    $('world').hidden = true;
    forgetTrip();
    $('over-title').textContent = 'Breathed out';
    $('over-body').textContent = `Mission complete in ${trip.tripsDone} trip${trip.tripsDone === 1 ? '' : 's'}. ${grade} Host health ${k.hostHealth}%. ${knows(k.memory)}. Hull ${Math.ceil(k.hp)}. ${kept.length ? `Fitted: ${kept.join(', ')}.` : 'No upgrades fitted.'}`;
    $('over-saved').textContent = '';
    $('over').hidden = false;
    Sound.play('win');
    return;
  }
  if (home) openWorld(`Trip ${trip.tripsDone} complete`, `You are back in the heart, fed.${trip.carry ? ` The host is at ${trip.carry.hostHealth}%.` : ''} What you carry and what you did to the host both come with you. The patrols will be larger this time.`);
  else if (fromLiver) openWorld('Out of the liver', `${how}${trip.heat >= 0.25 ? ' The alarm you raised is following you down the veins: expect company on the way home.' : ' You left quietly, and the way home should be calm.'}`);
  else openWorld(T.NODES[to].name, how);
}

const pickWay = (ev: Event) => { const to = (ev.target as Element).closest<HTMLElement | SVGElement>('[data-to]')?.dataset.to as T.NodeId | undefined; if (to) go(to); };
$('world-ways').addEventListener('click', pickWay);
$('world-map').addEventListener('click', pickWay);
$('world-map').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickWay(ev); } });

// ---------- heads-up display ----------

const last: Record<string, string> = {};
let shownOffer = '';
let tip: Tips.Tip | null = null, tipRest = 0;

function showTip(next: Tips.Tip, at: G.Point) {
  tip = next;
  view.mark = at;
  // Keep the box off the thing it is pointing at.
  const a = project(at.x, at.y), c = project(s.player.x, s.player.y);
  const markY = view.h / 2 + (a.y - c.y) * view.zoom, markX = view.w / 2 + (a.x - c.x) * view.zoom;
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
  tipRest = 6; // a few seconds of actual play before the next thing is explained
  view.mark = null;
  $('tip').hidden = true;
  canvas.focus();
}
const roman = (n: number) => 'I'.repeat(n);
/** How well the host's immune system knows you, in words. */
const knows = (m: number) => (m < 0.04 ? 'The host does not know you' : m < 0.3 ? 'A few antibodies about' : m < 0.65 ? 'Antibodies in the blood' : 'The host knows you well');
const clock = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 6) * 10).padStart(2, '0')}`;
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
  const mood = G.hostState(s);
  set('host-state', 'text', `${G.fever(s) ? `${CONFIG.host.fever.degrees[G.fever(s)]}\u00b0 \u00b7 ` : ''}${mood === 'stressed' ? 'frightened' : mood}${s.place === 'lung' ? (G.breathingOut(s) ? ' \u00b7 breathing out' : ' \u00b7 breathing in') : G.digesting(s.host.hour) > 0 ? ' \u00b7 digesting' : ''} \u00b7 ${clock(s.host.hour)}`);
  set('host', 'tier', mood === 'stressed' || G.fever(s) ? '2' : '0');
  const hereLeft = s.tumor.size, need = Math.max(0, CONFIG.energy.quota - p.energy), done = s.excised >= CONFIG.tumor.goal;
  set('goal', 'text', s.place === 'liver'
    ? `${done ? 'Tumor all out' : `Tumor ${s.excised}/${CONFIG.tumor.goal}${hereLeft ? ` \u00b7 ${hereLeft} here, ringed on the map` : ' \u00b7 none left here'}`} \u00b7 ${need ? `${need} more energy to leave` : 'enough energy to leave by the vein'}`
    : s.place === 'stomach' ? 'Cross to the gastric vein on the far side' : s.place === 'lung' ? 'Ride the breath out to the far end' : 'Reach the far end of the vessel');
  set('alert-fill', 'width', pct(s.alert, CONFIG.alert.max));
  const tier = G.alertTier(s);
  const losing = G.losingThem(s);
  set('alert-val', 'text', s.suppressed > 0 ? `${tier.name} \u00b7 cortisol ${Math.ceil(s.suppressed)}s` : s.tagged > 0 ? `${tier.name} \u00b7 tagged ${Math.ceil(s.tagged)}s` : losing ? `${tier.name} \u00b7 losing them` : tier.name);
  $('alert').classList.toggle('losing', losing);
  set('alert', 'tier', String(CONFIG.alert.tiers.findIndex((t) => t.name === tier.name)));

  const playing = started && s.status === 'playing';
  const leaving = G.canLeave(s), sip = G.glucoseHere(s) > 0, harvesting = !!p.channel;
  set('act-e', 'hidden', playing && !harvesting && (leaving || sip) ? '0' : '1');
  set('act-e', 'text', leaving ? (s.place === 'stomach' ? 'E  Leave by the gastric vein' : 'E  Ride the central vein out') : 'E  Skim glucose');
  const cell = G.stripTarget(s);
  set('act-f', 'hidden', playing && !harvesting && cell ? '0' : '1');
  set('act-f', 'text', cell && s.tumor.has(G.idx(s, cell.x, cell.y)) ? 'F  Cut out tumor cell' : 'F  Strip mitochondria');
  set('need', 'hidden', playing && G.atVein(s) && !leaving ? '0' : '1');
  set('act-h', 'hidden', playing && s.patches > 0 ? '0' : '1');
  set('act-q', 'hidden', playing && G.canShootNearest(s) ? '0' : '1');
  set('act-b', 'hidden', playing && G.boardTarget(s) ? '0' : '1');
  set('act-h', 'text', `Fibrin patch \u00d7${s.patches}`);
  set('act-c', 'hidden', playing && (s.upgrades.cd47 > 0 || G.riding(s)) ? '0' : '1');
  set('act-c', 'text', G.riding(s) ? `Inside ${s.cloak.toFixed(0)}s` : G.cloaked(s) ? `Unseen ${s.cloak.toFixed(0)}s` : s.cloakCd > 0 ? `Cloak ${Math.ceil(s.cloakCd)}s` : s.player.energy < CONFIG.cloak.energy ? 'Cloak needs 2 energy' : 'Cloak ready');
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

  if (s.status === 'won' && !settled) {
    // Out the far end: file the report and go back to the map, one place further on.
    settled = true;
    void Stats.save(s, { trip: trip.trip, toward: dest });
    land(dest, G.carryOf(s), s.alert, s.place !== 'vessel'
      ? `${s.place === 'stomach' ? 'Out of the stomach and into the portal vein. ' : ''}${Math.round(s.time)} seconds inside, ${s.cellsKilled} host cell${s.cellsKilled === 1 ? '' : 's'} killed.`
      : s.kills ? `You fought your way through: ${s.kills} down.` : 'You slipped past the patrol.');
  }
  if (s.status === 'dead' && !settled) {
    settled = true;
    forgetTrip();
    $('over').hidden = false;
    $('over-title').textContent = G.acidAt(s, s.player) === 2 ? 'The stomach digested you' : s.place === 'liver' ? 'The liver cleared you' : s.place === 'stomach' ? 'The stomach cleared you' : 'The patrol cleared you';
    $('over-body').textContent =
      `Trip ${trip.trip}, ${Math.round(s.time)} seconds in. Host health ${s.hostHealth}%. ${s.kills} immune cell${s.kills === 1 ? '' : 's'} destroyed before they got you.`;
    $('over-saved').textContent = 'Filing the run report\u2026';
    void Stats.save(s, { trip: trip.trip, toward: dest }).then((ok) => { $('over-saved').textContent = ok ? 'Run report filed.' : 'Run report not filed: open the game from its Claude link, signed in, to record runs.'; });
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
  const aim = quarter * (Math.PI / 2);
  spin = Math.abs(aim - spin) < 0.002 ? aim : spin + (aim - spin) * (view.still ? 1 : 1 - Math.exp(-dt * 9));
  setSpin(spin);
  if (started && s.status === 'playing') {
    if (held) { retarget -= dt; if (retarget <= 0) { retarget = 0.12; walkToPointer(); } }
    if ((s.place === 'vessel' || s.place === 'lung') && G.canLeave(s)) G.leave(s); // reaching the far end is getting away
    tipRest -= dt;
    if (!tip && !s.offer && tipRest <= 0) {
      const road = s.place === 'vessel' || s.place === 'lung';
      const mood = G.hostState(s), host: Record<string, G.Point | null> = { surge: mood === 'stressed' ? s.player : null, sleep: mood === 'asleep' ? s.player : null, meal: s.host.eating && s.time > 2 ? s.player : null, fever: G.fever(s) ? s.player : null };
      if (s.place === 'lung') Object.assign(host, { road: null, kupffer: null, lung: s.time > 0.6 ? s.player : null, dust: s.enemies.filter((e) => e.kind === 'kupffer' && s.visible[G.idx(s, Math.floor(e.x), Math.floor(e.y))]).sort((a, b) => G.dist(a, s.player) - G.dist(b, s.player))[0] ?? null });
      if (s.place === 'stomach') Object.assign(host, { portal: null, vein: null, cell: null, stomach: s.time > 0.8 ? s.player : null, mucus: G.acidAt(s, s.player) === 1 ? s.player : null, parietal: Tips.nearestRich(s) });
      const next = Tips.nextTip(s, road ? { portal: null, cell: null, vein: null, rbc: null, road: s.time > 0.6 ? s.player : null, net: s.snare > 0 ? s.player : null, ...host } : { ...host, rbc: s.time > 9 ? nearestBloodCell(s) : null });
      if (next) showTip(next.tip, next.at);
    }
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
  const bpm = Math.max([58, 80, 108, 132][tier], chasers ? 100 : 0, CONFIG.host.bpm[G.hostState(s)]) - (G.hostState(s) === 'asleep' && !tier && !chasers ? 10 : 0);
  Sound.pulse(started && s.status === 'playing' && !tip ? bpm : 0, s.player.hp / G.maxHp(s), heat);
  aimPointer();
  const live = started && s.status === 'playing' && !tip;
  view.heat = live ? Sound.intensity() : 0;
  view.kick = live ? Sound.thump() : 0;
  draw(ctx, s, view);
  hud();
  requestAnimationFrame(frame);
}

// Lets a script (or a curious player) poke at the live game from the console.
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, get trip() { return trip; }, go, T, G, CONFIG, view, toWorld };

resize();
requestAnimationFrame(frame);
