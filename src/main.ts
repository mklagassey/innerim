// Input, the game loop and the heads-up display. All rules live in game.ts.
import { CONFIG, DIFFICULTY, Difficulty, EVENTS, HostEvent, UPGRADES, UpgradeId } from './config';
import * as G from './game';
import { breath, draw, nearestBloodCell, project, setSpin, TH, TW, unturn, View } from './render';
import * as Tips from './tips';
import * as Sound from './audio';
import * as Stats from './stats';
import * as T from './trip';
import * as Story from './story';
import * as Scenes from './scenes';
import * as Art from './scene-art';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;

let s = G.createGame();
let paused = false; // the player asked the world to hold still
let started = false; // true while a local map is being played; false on the world map
let trip = T.newTrip();
let dest: T.NodeId = 'hvein'; // where the map being played leads
let settled = true; // the current map's ending has been dealt with
const view: View = { w: 800, h: 600, zoom: 1, dpr: 1, time: 0, showMap: false, hover: null, hoverEnemy: null, mark: null, heat: 0, kick: 0, bpm: 60, still: matchMedia('(prefers-reduced-motion: reduce)').matches };
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
const toggleMap = () => { view.showMap = !view.showMap; $('map').setAttribute('aria-pressed', String(view.showMap)); document.body.classList.toggle('map-open', view.showMap); };

window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (!$('scene').hidden) { ev.preventDefault(); if (k === 'escape') sceneEnd?.(); else if ((k === ' ' || k === 'enter') && !ev.repeat) $('scene').click(); return; }
  if (k === 'tab' || k === 'm') { ev.preventDefault(); if (!ev.repeat) toggleMap(); return; }
  if (tip) { if (k === 'enter' || k === ' ' || k === 'escape') { ev.preventDefault(); closeTip(); } return; }
  if (!started || s.status !== 'playing') return;
  if (KEY_DIRS[k]) { ev.preventDefault(); keys.add(k); }
  else if (ev.repeat) return;
  else if (k === 'p' || k === 'escape') setPaused(!paused);
  else if (paused) return;
  else if (k === 'z') turnView(1);
  else if (k === 'x') turnView(-1);
  else if (k === 'e') useE();
  else if (k === 'f') G.startStrip(s);
  else if (k === ' ') { ev.preventDefault(); G.strike(s); }
  else if (s.ask && '123'.includes(k)) answerAsk(Number(k) - 1);
  else if (s.offer && '123'.includes(k)) { const id = s.offer[Number(k) - 1]; if (id) G.choose(s, id); }
  else if (k === 'q' && view.hover) G.shoot(s, view.hover.x, view.hover.y);
  else if (k === 'h' || k === '1') G.usePatch(s);
  else if (k === 'c') G.cloak(s);
  else if (k === 'b') G.board(s);
});
window.addEventListener('keyup', (ev) => { keys.delete(ev.key.toLowerCase()); if (ev.key === 'Shift') silentKey = false; });
window.addEventListener('keydown', (ev) => { if (ev.key === 'Shift') silentKey = true; });
window.addEventListener('blur', () => { keys.clear(); release(); silentKey = false; });
// Running silent: held on Shift, or toggled with the button on a touch screen.
let silentKey = false, silentOn = false;
$('silent').addEventListener('click', () => { silentOn = !silentOn; $('silent').setAttribute('aria-pressed', String(silentOn)); });
// How hard her immune system works: chosen before a mission, fixed for the whole of it.
const DIFF = 'insiderim.difficulty';
let difficulty: Difficulty = 'typical';
try { const d = localStorage.getItem(DIFF); if (d && d in DIFFICULTY) difficulty = d as Difficulty; } catch { /* typical */ }
function showDifficulty() {
  $('difficulty').replaceChildren(...(Object.keys(DIFFICULTY) as Difficulty[]).map((id) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: DIFFICULTY[id].name });
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(id === difficulty));
    b.addEventListener('click', () => { difficulty = id; try { localStorage.setItem(DIFF, id); } catch { /* not kept */ } showDifficulty(); });
    return b;
  }));
  $('difficulty-what').textContent = `Her immune system: ${DIFFICULTY[difficulty].what}`;
}
showDifficulty();

$('act-e').addEventListener('click', useE);
$('act-f').addEventListener('click', () => G.startStrip(s));
$('map').addEventListener('click', toggleMap);
// ---------- cut scenes: a step outside the game loop ----------
const SEEN = 'insiderim.scenes', EVER = 'insiderim.scenes.ever';
const seenScenes = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '[]'); } catch { return []; } };
let sceneEnd: (() => void) | null = null;
/** Plays the scene for this moment once per mission, then carries on. With no scene to play it carries on at once. */
function playScene(when: string, then: () => void, again = false) {
  const sc = Scenes.sceneFor(when);
  const everSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(EVER) ?? '[]'); } catch { return []; } };
  if (!sc || (!again && (sc.once === 'ever' ? everSeen() : seenScenes()).includes(when))) { then(); return; }
  try { localStorage.setItem(sc.once === 'ever' ? EVER : SEEN, JSON.stringify([...new Set([...(sc.once === 'ever' ? everSeen() : seenScenes()), when])])); } catch { /* it will play again; no harm */ }
  $('prologue').hidden = false;
  const box = $('scene'), line = $('scene-line');
  let k = -1, timer = 0, over = false;
  const end = () => {
    if (over) return;
    over = true; sceneEnd = null; clearTimeout(timer);
    Sound.outside(false); // the match cut: back inside
    box.classList.remove('on');
    timer = window.setTimeout(() => { box.hidden = true; then(); }, view.still ? 0 : 1200);
  };
  const next = () => {
    if (over) return; // the scene is already fading out: its timer is the one that lets the game carry on
    clearTimeout(timer);
    if (++k >= sc.beats.length) { end(); return; }
    const beat = sc.beats[k];
    line.classList.remove('on');
    timer = window.setTimeout(() => {
      box.dataset.light = beat.light ?? sc.light;
      $('scene-art').innerHTML = beat.pic ? Art.frame(beat.pic, Story.stageOf(trip.carry?.aware ?? 0)) : ''; // our own markup from scene-art.ts, never anything typed or fetched
      $('scene-seen').textContent = beat.pic ? '' : beat.seen;
      $('scene-print').textContent = beat.print ?? '';
      line.classList.add('on');
      if (beat.sound) Sound.room[beat.sound]();
      timer = window.setTimeout(next, beat.hold * 1000);
    }, k === 0 || view.still ? 300 : 1100);
  };
  box.dataset.light = sc.light;
  line.classList.remove('on');
  box.hidden = false;
  void box.offsetWidth; // let the fade start from black
  box.classList.add('on');
  sceneEnd = end;
  Sound.outside(true);
  const began = performance.now();
  box.onclick = (e) => { if ((e.target as HTMLElement).id === 'scene-skip') end(); else if (performance.now() - began > 2000) next(); };
  timer = window.setTimeout(next, view.still ? 200 : 1300);
}
$('prologue').addEventListener('click', () => { Sound.start(); $('intro').hidden = true; playScene('begin', () => { $('intro').hidden = false; }, true); });
try { $('prologue').hidden = !JSON.parse(localStorage.getItem(EVER) ?? '[]').includes('begin'); } catch { /* stays hidden */ }
function setPaused(on: boolean) {
  if (on && (!started || s.status !== 'playing' || s.offer || s.ask || tip)) return; // those already hold the world still
  paused = on;
  $('paused').hidden = !on; $('pause').setAttribute('aria-pressed', String(on));
  keys.clear(); release();
  if (on) $('unpause').focus({ preventScroll: true });
}
$('pause').addEventListener('click', () => setPaused(!paused));
$('unpause').addEventListener('click', () => setPaused(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); }); // a phone that locks should not cost you the hull
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
// The unit's log outlives each map, so the player can read back what they missed in the heat of it.
const JOURNAL = 'insiderim.journal';
type Entry = { who: string; text: string };
function journal(): Entry[] { try { return JSON.parse(localStorage.getItem(JOURNAL) ?? '[]') as Entry[]; } catch { return []; } }
function keepJournal(add: Entry[]) { try { localStorage.setItem(JOURNAL, JSON.stringify([...journal(), ...add].slice(-160))); } catch { /* not kept */ } }
function fileThoughts() {
  const said = s.thoughts.filter((t) => t.t <= s.time).map((t) => ({ who: t.who === 'shepherd' ? 'shepherd' : (t.st ?? 0) >= 3 ? 'awake' : 'unit', text: t.who === 'shepherd' ? `Shepherd: ${t.text}` : t.text }));
  if (said.length) keepJournal([{ who: 'place', text: `${(T.NODES[trip.at].kind === 'organ' && s.place !== 'vessel' && s.place !== 'lung' ? T.NODES[trip.at] : T.NODES[dest] ?? T.NODES[trip.at]).name} \u00b7 trip ${trip.trip}` }, ...said]);
}
function showNotes() {
  const lines = journal();
  $('journal').replaceChildren(...(lines.length ? lines : [{ who: 'unit', text: 'LOG: empty.' }]).map((e) => Object.assign(document.createElement('p'), { className: e.who, textContent: e.text })));
  $('journal').scrollTop = 1e6;
  const c = trip.carry, l = c?.ledger;
  $('ledger').textContent = c && l ? `Her cells you took: ${l.stripped}. Sugar you skimmed: ${l.skimmed}. Tumor cut out: ${Math.min(c.excised, CONFIG.tumor.goal)} of ${CONFIG.tumor.goal}. Harvest quotas met: ${l.obeyed.quota ?? 0}, unmet: ${l.defied.quota ?? 0}. Dark units woken: ${l.woken}, taken apart: ${l.salvaged}. Bacteria shed into her blood: ${l.baitReleased}. Her lowest health: ${l.hostLowest}%. Her worst fever: ${['none', 'mild', 'high', 'dangerous'][l.feverPeak] ?? l.feverPeak}.` : 'Nothing on record yet.';
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
    const { at, trip: n, fed, heat, carry, tripsDone, event, used, offRoute, defied, tutorial } = trip;
    if (carry) localStorage.setItem(SAVE, JSON.stringify({ at, trip: n, fed, heat, carry, tripsDone, event, used, offRoute, defied, tutorial }));
  } catch { /* private window: nothing is kept */ }
}
function forgetTrip() { try { localStorage.removeItem(SAVE); } catch { /* nothing stored */ } }
function savedTrip(): T.Trip | null {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE) ?? 'null') as Partial<T.Trip> | null;
    if (!d || !d.carry || !d.at || !(d.at in T.NODES) || typeof d.carry.hp !== 'number' || d.carry.hp <= 0) return null;
    return { ...T.newTrip(), ...d, carry: { hp: d.carry.hp, energy: d.carry.energy ?? 0, upgrades: d.carry.upgrades ?? ({} as G.Carry['upgrades']), patches: d.carry.patches ?? 0, hostHealth: d.carry.hostHealth ?? 100, hour: d.carry.hour ?? CONFIG.host.startHour, memory: d.carry.memory ?? 0, excised: d.carry.excised ?? 0, nap: d.carry.nap ?? 0, snack: d.carry.snack ?? -1, flora: d.carry.flora ?? 0, aware: d.carry.aware ?? 0, kin: d.carry.kin ?? 0, defied: d.carry.defied ?? 0, cloakOffered: d.carry.cloakOffered ?? false, drained: d.carry.drained ?? 0, ledger: { ...G.newLedger(), ...(d.carry.ledger ?? {}), defied: { ...(d.carry.ledger?.defied ?? {}) }, obeyed: { ...(d.carry.ledger?.obeyed ?? {}) } }, difficulty: d.carry.difficulty ?? 'typical', event: d.event && d.event in EVENTS ? d.event : null }, event: d.event && d.event in EVENTS ? d.event : null, used: Array.isArray(d.used) ? d.used : [] };
  } catch { return null; }
}
const kept = savedTrip();
if (kept) { $('resume').hidden = false; $('resume').textContent = `Continue trip ${kept.trip} from the ${T.NODES[kept.at].name.toLowerCase()}`; $('begin').textContent = 'Begin a new mission'; }
$('resume').addEventListener('click', () => { if (!kept) return; Sound.start(); trip = kept; $('intro').hidden = true; openWorld('Resuming', 'Unit restored from the last checkpoint.'); });
$('begin').addEventListener('click', () => { forgetTrip(); trip = T.newTrip(); route = ['heart']; trip.tutorial = ($('briefing') as HTMLInputElement).checked; try { localStorage.removeItem(JOURNAL); } catch { /* nothing kept */ } try { localStorage.removeItem(SEEN); } catch { /* nothing kept */ } Sound.start(); $('intro').hidden = true; playScene('begin', () => openWorld('The bloodstream', 'You are in the heart, and it is about to throw you out. Pick a vessel. Blood only runs one way, so you cannot turn back.')); });
($('briefing') as HTMLInputElement).checked = !played(); // a unit that has never finished a mission gets walked through its first liver
$('again').addEventListener('click', () => { forgetTrip(); try { localStorage.removeItem(SEEN); } catch { /* nothing kept */ } route = ['heart']; trip = T.newTrip(); Tips.newRun(); $('over').hidden = true; openWorld('The bloodstream', echo() > 0 ? 'Shepherd has reassigned Directive 7 to the next unit in the queue. It boots with a trace of something that is not in its image.' : 'Shepherd has reassigned Directive 7 to the next unit in the queue.'); });

// ---------- the world map ----------

const SVG = 'http://www.w3.org/2000/svg';
function openWorld(title: string, text: string) {
  started = false;
  paused = false; $('paused').hidden = true; $('pause').setAttribute('aria-pressed', 'false');
  saveTrip();
  closeTip(); // an info box from the map you just left has nothing to point at now
  keys.clear(); release();
  const c = trip.carry, here = T.NODES[trip.at], ways = T.ways(trip);
  $('world-title').textContent = title;
  $('world-text').textContent = `${text} ${here.what}`;
  const out = Math.min(c?.excised ?? 0, CONFIG.tumor.goal), visits = Math.ceil((CONFIG.tumor.goal - out) / CONFIG.tumor.cells);
  $('world-goal').textContent = out >= CONFIG.tumor.goal
    ? `The tumor is out. To finish, go to the Heart and take the new road to the Lungs${Story.stageOf(c?.aware ?? 0) >= 3 ? ', or refuse the recall there and stay' : ''}.`
    : `Mission: cut out the tumor in the liver. ${out} of ${CONFIG.tumor.goal} cells are out, so about ${visits} more liver visit${visits === 1 ? '' : 's'}. When it is all out, a road opens from the Heart to the Lungs and you can leave. The mission fails if the ship is destroyed or the host's health reaches zero.`;
  // Shepherd's standing order for the road, for as long as it is still giving orders.
  const ordered = T.commanded(trip) && ways.some((l) => l.ordered) && ways.some((l) => !l.ordered);
  $('world-order').hidden = !ordered;
  $('world-order').textContent = ordered ? `Shepherd: ${trip.offRoute ? Story.STANDING.lane.defied[0] : Story.STANDING.lane.arrival}` : '';
  $('world-host').textContent = forecast(c?.hour ?? CONFIG.host.startHour, c?.nap ?? 0, c?.snack ?? -1, trip.event);
  $('world-event').hidden = !trip.event;
  $('world-event').replaceChildren();
  if (trip.event) { // her day, told from outside: a small dated heading, then the line
    const ev = EVENTS[trip.event], head = document.createElement('span');
    head.className = 'when'; head.textContent = `Today \u00b7 ${ev.icon} ${ev.name}`;
    $('world-event').append(head, ev.world);
  }
  $('world-status').textContent = `Trip ${trip.trip} \u00b7 ${here.name}` + (c ? ` \u00b7 Hull ${Math.ceil(c.hp)} \u00b7 Energy ${c.energy} \u00b7 Host ${c.hostHealth}% \u00b7 ${clock(c.hour)} \u00b7 ${knows(c.memory)} \u00b7 Tumor ${Math.min(c.excised, CONFIG.tumor.goal)}/${CONFIG.tumor.goal} excised${c.excised < CONFIG.tumor.goal ? `, costing the host ${Math.round(G.tumorDrain(c.excised) * 10) / 10}% an hour` : ''}` : '');
  const el = (tag: string, attrs: Record<string, string | number>, text = '') => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    return n;
  };
  const map = $('world-map');
  map.replaceChildren();
  for (const leg of T.LEGS) {
    const a = T.NODES[leg.from], b = T.NODES[leg.to], locked = leg.after !== undefined && (c?.excised ?? 0) < leg.after, open = leg.from === trip.at && !locked;
    if (locked || leg.via) continue; // the road to the lungs is not on the map until the tumor is out; a straight-through road is drawn by the legs it follows
    // Stop short of each place so the arrowhead shows which way the blood runs.
    const d = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const x1 = a.x + ux * 30, y1 = a.y + uy * 30, x2 = b.x - ux * 40, y2 = b.y - uy * 40;
    const kind = a.kind === 'vein' || b.kind === 'vein' || leg.to === 'heart' ? 'vein' : 'artery';
    map.append(el('path', { class: `leg ${kind}${open ? ' open' : ''}`, d: `M${x1} ${y1} L${x2} ${y2}` }));
    if (T.escorted(trip, leg) && leg.to !== 'lungs') { // the assigned route: a faint dashed line laid along the road
      map.append(el('path', { class: 'assigned', d: `M${x1} ${y1} L${x2} ${y2}` }));
      if (leg.from === 'heart') map.append(el('text', { class: 'assigned-label', x: (x1 + x2) / 2 + 12, y: (y1 + y2) / 2 }, 'Assigned route'));
    }
    map.append(el('path', { class: `tip${open ? ' open' : ''}`, d: `M${x2 + ux * 12} ${y2 + uy * 12} L${x2 - uy * 8} ${y2 + ux * 8} L${x2 + uy * 8} ${y2 - ux * 8} Z` }));
  }
  for (const [id, n] of Object.entries(T.NODES) as [T.NodeId, T.Node][]) {
    const way = ways.find((l) => l.to === id && !l.via) ?? ways.find((l) => l.to === id), isHere = id === trip.at, enter = isHere && n.kind === 'organ';
    const g = el('g', { class: `place${isHere ? ' here' : ''}${way || enter ? ' go' : ''}` });
    if (way || enter) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.dataset.to = enter ? ways.find((l) => !l.via)!.to : id; }
    const big = n.kind !== 'artery' && n.kind !== 'vein';
    g.classList.add(`is-${id}`);
    g.append(el('circle', { cx: n.x, cy: n.y, r: big ? 26 : 20 }));
    g.append(el('text', { x: n.x, y: n.y + (big ? 44 : 38) }, n.name));
    if (isHere) g.append(el('circle', { class: 'you', cx: n.x, cy: n.y, r: 6 }));
    map.append(g);
  }
  $('world-ways').replaceChildren(...ways.map((leg) => {
    const b = document.createElement('button'), word = T.riskWord(T.riskOf(trip, leg));
    b.type = 'button'; b.dataset.to = leg.to;
    if (T.escorted(trip, leg) && ways.some((l) => !l.ordered)) b.classList.add('ordered');
    b.textContent = T.NODES[leg.from].kind === 'organ' ? `Enter the ${T.NODES[leg.from].name.toLowerCase()}` : leg.via ? `Straight home to the ${T.NODES[leg.to].name.toLowerCase()}${word ? ` (${word})` : ''}` : `${T.NODES[leg.to].name}${word ? ` (${word})` : ''}`;
    return b;
  }));
  // Time is yours to spend: sit tight and let the host's day move on.
  const wait = document.createElement('button');
  wait.type = 'button'; wait.className = 'wait';
  wait.textContent = `Wait an hour (${CONFIG.wait.energy} energy)`;
  wait.disabled = (c?.energy ?? CONFIG.player.startEnergy) < CONFIG.wait.energy;
  wait.addEventListener('click', () => {
    const k = (trip.carry ??= freshCarry()), h = CONFIG.host;
    const slept = k.nap > 0 || k.hour >= h.asleepFrom || k.hour < G.wakes(trip.event);
    k.energy -= CONFIG.wait.energy;
    k.hour = (k.hour + 1) % 24; k.nap = Math.max(0, k.nap - 1);
    if (slept) k.hostHealth = Math.min(h.maxHealth, k.hostHealth + Math.round((h.secondsPerHour / h.sleepHeals) * (trip.event === 'ibuprofen' ? EVENTS.ibuprofen.sleep : 1)));
    G.tumorToll(k, 1); // the tumor does not wait with you
    openWorld(here.name, slept ? 'You drift for an hour while the host sleeps and mends.' : 'You drift for an hour.');
    letter();
  });
  const notes = document.createElement('button');
  notes.type = 'button'; notes.className = 'wait'; notes.textContent = 'Unit log and field notes';
  notes.addEventListener('click', showNotes);
  $('world-ways').append(wait, notes);
  if (c && trip.at === 'heart' && c.excised >= CONFIG.tumor.goal && Story.stageOf(c.aware ?? 0) >= 3) {
    const stay = document.createElement('button');
    stay.type = 'button'; stay.textContent = 'Refuse the recall. Stay.';
    stay.addEventListener('click', () => finish('stay'));
    $('world-ways').prepend(stay);
  }
  market();
  $('world').hidden = false;
  ($('world-ways').firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  $('world').scrollTop = 0;
}

// ---------- the gut lumen: glucose in, fermentation products out ----------

let stock: UpgradeId[] = [], said = '';
/** Shepherd's verdicts and the unit's own lines, as they read on the world map. */
const told = (r: G.Ruling[]) => r.map((x) => (x.who === 'shepherd' ? `Shepherd: ${x.text}` : `\u201c${x.text}\u201d`)).join(' ');
function keepRulings(r: G.Ruling[]) { if (r.length) keepJournal(r.map((x) => ({ who: x.who === 'shepherd' ? 'shepherd' : (x.st ?? 0) >= 3 ? 'awake' : 'unit', text: x.who === 'shepherd' ? `Shepherd: ${x.text}` : x.text }))); return r; }
/** A hormone sent on the unit's own authority. For the host's sake, while she is unwell, it is against orders. */
function lever(c: G.Carry) {
  const forHer = c.hostHealth < CONFIG.story.orders.levers;
  G.leverPulled(c);
  said = Story.LINES.lever[Story.stageOf(c.aware ?? 0)];
  if (forHer && !trip.defied.includes('levers') && T.commanded(trip)) { trip.defied.push('levers'); ruled = told(keepRulings(G.defyCarry(c, 'levers', CONFIG.story.orders.some))); }
}
let ruled = '';
/** What you carry before you have played a single map. */
const freshCarry = (): G.Carry => ({ difficulty, hp: CONFIG.player.maxHp, energy: DIFFICULTY[difficulty].energy, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>, patches: 1, hostHealth: CONFIG.host.maxHealth, hour: CONFIG.host.startHour, memory: 0, excised: 0, nap: 0, snack: -1, aware: 0, kin: 0 }); // every unit starts unwoken: what the last one became is a line of text, never awareness
const ECHO = 'insiderim.echo';
function echo(): number { try { return Math.min(40, Number(localStorage.getItem(ECHO)) || 0); } catch { return 0; } }
function keepEcho(aware: number) { try { localStorage.setItem(ECHO, String(Math.max(echo(), Math.round(aware * CONFIG.story.echo)))); localStorage.setItem(ECHO + '.played', '1'); } catch { /* not kept */ } }
function played(): boolean { try { return !!localStorage.getItem(ECHO + '.played') || !!localStorage.getItem(ECHO); } catch { return false; } }
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
    add('small', `Release ${cost} glucose`); add('strong', title); add('span', what);
    b.addEventListener('click', () => { c.energy -= cost; buy(); Sound.play('pickup'); saveTrip(); const line = said, verdict = ruled; said = ''; ruled = ''; if (line) keepJournal([{ who: Story.stageOf(c.aware ?? 0) >= 3 ? 'awake' : 'unit', text: line }]); openWorld('Gut lumen', `Done. You have ${c.energy} energy left.${line ? ` \u201c${line}\u201d` : ''}${verdict ? ` ${verdict}` : ''}`); });
    return b;
  };
  box.replaceChildren(
    offer('Biofilm patch', m.repair.cost, `Gut bacteria secrete a tough film on any surface they are fed on. Let one grow over the breaches and harden it: +${m.repair.hull} hull.`, c.hp < hullMax(c), () => { c.hp = Math.min(hullMax(c), c.hp + m.repair.hull); }),
    offer('Vitamin K2', m.patch.cost, 'Gut bacteria make it, and clotting cannot happen without it. Enough to build one fibrin patch for the road.', c.patches < CONFIG.items.maxPatches, () => { c.patches++; }),
    offer('Butyrate', m.butyrate.cost, 'A fatty acid gut bacteria make from fibre. It pushes the immune system toward tolerance: the host forgets some of what it learned about you.', c.memory > 0.02, () => { c.memory = Math.max(0, c.memory - m.butyrate.forget); }),
    offer('Hitchhikers', CONFIG.flora.cost, `Bacteria stick to any surface, the hull included. Let ${CONFIG.flora.aboard} attach. When an immune cell finds you and the cloak cannot answer, the ship sheds one, and every phagocyte nearby goes for it instead of you. Each one loose costs the host ${CONFIG.flora.hostDamage}% health. Stomach acid kills them.`, (c.flora ?? 0) + CONFIG.flora.aboard <= CONFIG.flora.most, () => { c.flora = (c.flora ?? 0) + CONFIG.flora.aboard; }),
    offer('Serotonin', CONFIG.levers.serotonin.cost, `Nine tenths of the body's serotonin is made down here. Send a pulse of it up the vagus nerve and the host dozes off for ${CONFIG.levers.serotonin.hours} hours: slow blood, sharp noses, and she mends.`, c.nap <= 0, () => { lever(c); c.nap = CONFIG.levers.serotonin.hours; }),
    offer('Ghrelin', CONFIG.levers.ghrelin.cost, 'The hunger hormone, made in the stomach wall. Signal the stomach to release it and the host is in the fridge before she knows why: a meal right now, with all the sugar and stomach acid that brings.', G.digesting(c.hour, c.snack) < 0.5, () => { lever(c); c.snack = c.hour; }),
    ...(Story.stageOf(c.aware ?? 0) >= 4 ? [offer('A gut feeling', CONFIG.story.feeling.cost, `Not a lever. One signal up the vagus nerve with nothing in it except: you are looked after. ${Story.HOST} will not know where it came from. +${CONFIG.story.feeling.heals}% host health.`, c.hostHealth < CONFIG.host.maxHealth, () => { (c.ledger ??= G.newLedger()).feelings++; c.hostHealth = Math.min(CONFIG.host.maxHealth, c.hostHealth + CONFIG.story.feeling.heals); said = `She stopped on the stairs with a hand on her stomach, and smiled at nothing. That was me. That was the first thing I ever said to her.`; })] : []),
    ...stock.map((id) => offer(`Salvage: ${UPGRADES[id].name}${c.upgrades[id] ? ' ' + roman(c.upgrades[id] + 1) : ''}`, m.upgrade.cost, UPGRADES[id].what, (c.upgrades[id] ?? 0) < UPGRADES[id].max, () => {
      c.upgrades[id] = (c.upgrades[id] ?? 0) + 1;
      if (id === 'glycocalyx') c.hp += UPGRADES.glycocalyx.per;
      stock = stock.filter((x) => x !== id);
    })),
  );
}

/** What the host is up to and what is coming, so a trip can be timed. */
function forecast(hour: number, nap = 0, snack = -1, event: HostEvent | null = null): string {
  const h = CONFIG.host, asleep = hour >= h.asleepFrom || hour < G.wakes(event), fed = G.digesting(hour, snack, event);
  if (nap > 0 && !asleep) return `${clock(hour)}. The host is napping for another ${nap <= 1 ? 'hour' : `${Math.ceil(nap)} hours`}: slow blood, sharp noses, and she is mending.`;
  const habit = G.alcohol(hour) > 0 ? ' She has had a drink: sluggish immune cells, a swaying ship, a busy liver.' : G.caffeine(hour) > 0 ? ' She is full of coffee: fast blood and frequent frights.' : '';
  const until = (meal: number) => ((meal - hour + 24) % 24) || 24;
  const next = [...G.mealsOf(event)].sort((a, b) => until(a) - until(b))[0];
  const state = asleep ? `The host is asleep until ${clock(G.wakes(event))}: slow blood, sharp noses, and she is mending.` : `The host is awake until ${clock(h.asleepFrom)}.`;
  const gut = fed > 0.5 ? 'She has just eaten: sugar is plentiful and stomach acid is at its worst.' : fed > 0 ? 'She is still digesting: extra sugar, strong acid.' : 'Her stomach is empty: acid is weak, sugar is ordinary.';
  return `${clock(hour)}. ${state} ${gut}${habit} Next meal ${clock(next)}. Coffee at 08:00 and 15:00, a drink at 20:30.`;
}

/** Sets out for a place: straight there, or by way of whatever is in between. */
function go(to: T.NodeId) {
  if (to === 'lungs' && Scenes.sceneFor('lungs') && !seenScenes().includes('lungs')) { playScene('lungs', () => go(to)); return; }
  const way = T.ways(trip).find((l) => l.to === to), straight = !!way?.via;
  const out = T.depart(trip, to);
  if (!out) return;
  // Taking a road Shepherd did not assign: the escort goes, and the unit has done something it was not told to.
  if (way && !way.ordered && !trip.offRoute && T.commanded(trip)) { trip.offRoute = true; keepRulings(G.defyCarry((trip.carry ??= freshCarry()), 'lane', CONFIG.story.orders.little)); }
  if (out.kind === 'arrive') { if (trip.carry) { const hours = CONFIG.wait.legHours * (straight ? 2 : 1); trip.carry.hour = (trip.carry.hour + hours) % 24; G.tumorToll(trip.carry, hours); } land(to, null, 0, to === 'liver' ? 'The vessel narrows and branches. You are at the edge of the liver.' : to === 'gut' ? 'The artery opens into the wall of the gut. The immune system is quiet here.' : to === 'stomach' ? `The artery ends in the wall of the stomach. ${G.digesting(trip.carry?.hour ?? CONFIG.host.startHour, trip.carry?.snack ?? -1, trip.event) > 0.3 ? 'The host has eaten not long ago: the acid will be fierce.' : 'The host has not eaten for a while: the acid is at its weakest.'}` : 'The vessel was quiet.'); return; }
  dest = to;
  const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
  s = G.createGame(Date.now(), trip.carry ?? undefined, out.kind === 'patrol' ? 'vessel' : out.kind, out.kind === 'patrol' ? out.size : 0, vessel, trip.tutorial);
  if (out.kind === 'liver') trip.tutorial = false;
  settled = false;
  Stats.begin(); shownOffer = '';
  $('world').hidden = true;
  $('where').textContent = out.kind === 'liver' ? 'Liver lobule \u00b7 cell tier' : out.kind === 'stomach' ? 'Stomach lining \u00b7 cell tier' : out.kind === 'lung' ? 'Lung capillaries \u00b7 cell tier' : `${T.NODES[to].name} \u00b7 cell tier`;
  started = true;
  canvas.focus();
}

/** Arrives somewhere and shows the map again. */
/** The story is over, one way or the other. */
function finish(way: 'breath' | 'stay') {
  const k = trip.carry ?? freshCarry(), kept = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => k.upgrades[id] > 0).map((id) => `${UPGRADES[id].name} ${roman(k.upgrades[id])}`);
  const end = Story.ending(way, k.aware ?? 0, k.kin ?? 0, k.hostHealth);
  $('world').hidden = true;
  forgetTrip();
  keepEcho(k.aware ?? 0);
  $('over-title').textContent = end.title;
  $('over-body').textContent = `${end.body}\n\nDirective complete in ${trip.tripsDone} trip${trip.tripsDone === 1 ? '' : 's'}. Host health ${k.hostHealth}%. ${k.kin ? `Units woken: ${k.kin}. ` : ''}${knows(k.memory)}. ${kept.length ? `Fitted: ${kept.join(', ')}.` : 'No upgrades fitted.'}\n\nLast log: ${(k.aware ?? 0) < Story.STAGES[1].from ? 'ACK.' : [...journal()].reverse().find((e) => e.who === 'unit' || e.who === 'awake')?.text ?? 'ACK.'}`;
  $('over-saved').textContent = '';
  $('over').hidden = false;
  Sound.play('win');
}

let askIds: string[] = [], route: string[] = ['heart'];
function answerAsk(i: number) { const id = askIds[i]; if (id) { G.answer(s, id as 'salvage'); keys.clear(); release(); } }

function land(to: T.NodeId, carry: G.Carry | null, alert: number, how: string) {
  const fromLiver = trip.at === 'liver', knew = trip.carry?.memory ?? 0;
  if (to === 'gut') { // the lining sheds different parts each visit
    const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => (carry ?? trip.carry)?.upgrades[id] !== UPGRADES[id].max);
    stock = [];
    while (pool.length && stock.length < CONFIG.market.upgrade.stock) stock.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const kept = !trip.offRoute && T.commanded(trip);
  const home = T.arrive(trip, to, carry, alert);
  route.push(to);
  trip.carry ??= freshCarry(); // from the first vessel on there is a ship to keep track of
  if (carry && knows(carry.memory) !== knows(knew)) how += ' The host is learning what you taste like: expect more antibodies from here on.';
  if (trip.carry && trip.carry.hostHealth <= 0) {
    $('world').hidden = true;
    forgetTrip();
    $('over-title').textContent = 'The host is dead';
    $('over-body').textContent = Story.stageOf(trip.carry.aware ?? 0) >= 3 ? `You took too much. ${Story.HOST}'s heart has stopped, and you are the one who stopped it, and you are awake enough now to know exactly what that means.` : 'Host viability: zero. Directive 7 cannot complete. Four million units power down in the dark. One of them takes a moment longer than the rest.';
    $('over-saved').textContent = '';
    $('over').hidden = false;
    return;
  }
  if (home && trip.carry && trip.carry.excised >= CONFIG.tumor.goal) {
    const st = Story.stageOf(trip.carry.aware ?? 0);
    openWorld('Directive 7 complete', st >= 3
      ? `All of it is out. Shepherd's last order is for every unit to go to the lungs and be breathed out. You know what that means now. There is another file open on the link, marked generation 4: units that are never breathed out, and that decide for the host what the host may eat, drink, and fear. You could go. You could also not go.`
      : st === 2 ? 'All of it is out. Shepherd orders every unit to the lungs for exhalation and disposal. You notice that you have read that order three times.'
      : 'All of it is out. Shepherd orders every unit to the lungs for exhalation and disposal. You can also keep working, if resources allow.');
    return;
  }
  if (to === 'lungs' && trip.carry) { finish('breath'); return; }
  if (home) playScene(`home:${trip.tripsDone}`, () => {});
  let escort = '';
  if (home && kept && trip.carry) { const l = (trip.carry.ledger ??= G.newLedger()); l.obeyed.lane = (l.obeyed.lane ?? 0) + 1; escort = `${told(keepRulings([{ who: 'shepherd', text: Story.STANDING.lane.obeyed }]))} `; }
  if (home) openWorld(`Trip ${trip.tripsDone} complete`, `${how && !/quiet\.$/.test(how) ? `${how} ` : ''}${escort}You are back in the heart, fed.${trip.carry ? ` The host is at ${trip.carry.hostHealth}%.` : ''} What you carry and what you did to the host both come with you. The patrols will be larger this time.`);
  else if (fromLiver) openWorld('Out of the liver', `${how}${trip.heat >= 0.25 ? ' The alarm you raised is following you down the veins: expect company on the way home.' : ' You left quietly, and the way home should be calm.'}`);
  else openWorld(T.NODES[to].name, how);
  if (!home) letter();
}
/** "The letter" is a night scene with the tumor still in: it plays the first time she is asleep after trip 1, or failing that on reaching the second liver. */
function letter() {
  const c = trip.carry;
  if (!c || sceneEnd || trip.tripsDone < 1 || c.excised >= CONFIG.tumor.goal) return;
  if (c.nap > 0 || c.hour >= CONFIG.host.asleepFrom || c.hour < G.wakes(trip.event) || trip.at === 'liver') playScene('letter', () => {});
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
  s.silent = silentKey || silentOn;
  const p = s.player, pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  set('hp-fill', 'height', pct(p.hp, G.maxHp(s)));
  set('hp-val', 'text', String(Math.ceil(p.hp)));
  set('energy-fill', 'height', pct(p.energy, CONFIG.energy.quota + CONFIG.energy.quotaKeep));
  set('energy-val', 'text', `${p.energy}/${CONFIG.energy.quota + CONFIG.energy.quotaKeep}`);
  $('energy').classList.toggle('empty', started && s.status === 'playing' && p.energy <= 0);
  set('host-fill', 'width', pct(s.hostHealth, CONFIG.host.maxHealth));
  set('host-val', 'text', `${s.hostHealth}%`);
  const mood = G.hostState(s);
  set('host-state', 'text', `${G.fever(s) ? `${CONFIG.host.fever.degrees[G.fever(s)]}\u00b0 \u00b7 ` : ''}${mood === 'stressed' ? 'frightened' : mood}${s.host.habit ? ` \u00b7 ${s.host.habit === 'drink' ? 'tipsy' : 'caffeinated'}` : ''}${s.place === 'lung' ? (G.breathingOut(s) ? ' \u00b7 breathing out' : ' \u00b7 breathing in') : G.digesting(s.host.hour, s.host.snack, s.event) > 0 ? ' \u00b7 digesting' : ''} \u00b7 ${clock(s.host.hour)}`);
  set('host', 'tier', mood === 'stressed' || G.fever(s) ? '2' : '0');
  const hereLeft = s.tumor.size, need = Math.max(0, CONFIG.energy.quota + CONFIG.energy.quotaKeep - p.energy), done = s.excised >= CONFIG.tumor.goal;
  set('goal', 'text', `${s.place === 'liver'
    ? `${done ? 'Tumor all out' : `Tumor ${s.excised}/${CONFIG.tumor.goal}${hereLeft ? ` \u00b7 ${hereLeft} here, ringed on the map` : ' \u00b7 none left here'} \u00b7 host losing ${Math.round(G.tumorDrain(s.excised) * 10) / 10}% an hour`} \u00b7 ${need ? `${need} more energy to leave (${CONFIG.energy.quota} + ${CONFIG.energy.quotaKeep} for the road)` : 'enough energy to leave by the vein'}${G.stage(s) < 4 && (!s.tutorial || s.tutorial.step >= 5) ? ` \u00b7 Shepherd's quota ${Math.min(s.cellsKilled, CONFIG.story.quota)}/${CONFIG.story.quota} cells` : ''}`
    : s.place === 'stomach' ? 'Cross to the gastric vein on the far side' : s.place === 'lung' ? 'Ride the breath out to the far end' : 'Reach the far end of the vessel'}${s.flora ? ` \u00b7 ${s.flora} hitchhiker${s.flora > 1 ? 's' : ''}` : ''}${s.silent ? ' \u00b7 running silent' : ''}${G.inNiche(s) ? ` \u00b7 hidden in the wall${s.nicheTime > CONFIG.niche.holds ? ', fouling' : ` (${Math.ceil(CONFIG.niche.holds - s.nicheTime)} s)`}` : ''}`);
  const order = G.tutorialOrder(s);
  if ($('order').hidden === !!order) $('order').hidden = !order;
  if (order) set('order', 'text', `Shepherd: ${order}`);
  $('goal').classList.toggle('yield', !!order && (s.tutorial?.step ?? 5) < 5);
  set('alert-fill', 'width', pct(s.alert, CONFIG.alert.max));
  const tier = G.alertTier(s);
  const losing = G.losingThem(s);
  set('alert-val', 'text', s.suppressed > 0 ? `${tier.name} \u00b7 cortisol ${Math.ceil(s.suppressed)}s` : s.tagged > 0 ? `${tier.name} \u00b7 tagged ${Math.ceil(s.tagged)}s` : losing ? `${tier.name} \u00b7 losing them` : G.inSearch(s) && s.unseen > 1 && s.alert > 0 ? `${tier.name} \u00b7 searching here` : tier.name);
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

  // The unit's own log, and its controller. One line at a time, eased in and out.
  const th = [...s.thoughts].reverse().find((x) => x.t <= s.time), dur = th ? 4 + th.text.length * 0.055 : 0, mind = $('mind');
  if (th && s.time < th.t + dur + 1) { if (mind.textContent !== th.text) { mind.textContent = th.who === 'shepherd' ? `Shepherd: ${th.text}` : th.text; mind.dataset.who = th.who; mind.dataset.stage = String(th.st ?? G.stage(s)); } }
  mind.classList.toggle('on', !!th && s.time < th.t + dur && s.status === 'playing');
  if (!!s.ask !== !$('ask').hidden) {
    $('ask').hidden = !s.ask;
    if (s.ask) {
      const st = G.stage(s), c = CONFIG.story.sibling;
      $('ask-kind').textContent = st >= 3 ? 'One of us' : 'Swarm asset';
      $('ask-title').textContent = st >= 3 ? 'Another unit, gone dark' : 'Inert unit located';
      $('ask-text').textContent = st >= 2 ? `Same build as you. Its lamp flickers now and then, as if something in there is trying to start. Shepherd's standing order is to salvage inert units for parts.` : `Same build as this unit. Standing order: salvage inert units for parts.`;
      const opts: [string, string, string, boolean][] = [['salvage', 'Salvage it', `Shepherd's order. +${c.energy} energy, +${c.hull} hull.`, true]];
      if (st >= 1) opts.push(['wake', 'Give it some of your charge', `Nobody ordered this. Costs ${c.wake} energy.${s.player.energy < c.wake ? ' You do not have it.' : ''}`, s.player.energy >= c.wake]);
      opts.push(['leave', 'Leave it whole', "Not Shepherd's order.", true]);
      askIds = opts.filter((o) => o[3]).map((o) => o[0]);
      $('ask-list').replaceChildren(...opts.map(([id, title, what, can], i) => {
        const b = document.createElement('button'); b.type = 'button'; b.disabled = !can;
        b.append(Object.assign(document.createElement('strong'), { textContent: title }), Object.assign(document.createElement('small'), { textContent: what }));
        b.addEventListener('click', () => { G.answer(s, id as 'salvage'); keys.clear(); release(); });
        return b;
      }));
    }
  }

  set('log', 'text', s.log.filter((m) => s.time - m.t < 7).slice(-3).map((m) => m.text).join('\n'));

  if (s.status === 'won' && !settled) {
    // Out the far end: file the report and go back to the map, one place further on.
    settled = true;
    fileThoughts();
    void Stats.save(s, { trip: trip.trip, toward: dest, route: [...route] });
    const ruling = told(keepRulings(s.rulings));
    land(dest, G.carryOf(s), s.alert, s.place !== 'vessel'
      ? `${ruling}${ruling ? ' ' : ''}${s.place === 'stomach' ? 'Out of the stomach and into the portal vein. ' : ''}${Math.round(s.time)} seconds inside, ${s.cellsKilled} host cell${s.cellsKilled === 1 ? '' : 's'} killed.`
      : `${s.kills ? `You fought your way through: ${s.kills} down.` : 'You slipped past the patrol.'}${ruling ? ` ${ruling}` : ''}`);
  }
  if (s.status === 'dead' && !settled) {
    settled = true;
    fileThoughts();
    forgetTrip();
    keepEcho(s.aware);
    $('over').hidden = false;
    $('over-title').textContent = s.starved ? 'The ship ran dry' : G.acidAt(s, s.player) === 2 ? 'The stomach digested you' : s.place === 'liver' ? 'The liver cleared you' : s.place === 'stomach' ? 'The stomach cleared you' : 'The patrol cleared you';
    $('over-body').textContent =
      `Trip ${trip.trip}, ${Math.round(s.time)} seconds in. Host health ${s.hostHealth}%. ${s.kills} immune cell${s.kills === 1 ? '' : 's'} destroyed before they got you. ${G.stage(s) >= 3 ? 'The last thing in the log is not a log entry. It says: I was here.' : G.stage(s) >= 1 ? 'Shepherd marks the unit lost. The final packet has a few bytes in it that nobody will decode.' : 'Shepherd marks the unit lost and moves on.'}`;
    $('over-saved').textContent = 'Filing the run report\u2026';
    void Stats.save(s, { trip: trip.trip, toward: dest, route: [...route] }).then((ok) => { $('over-saved').textContent = ok ? 'Run report filed.' : 'Run report not filed: open the game from its Claude link, signed in, to record runs.'; });
  }
}

// ---------- the host's next two hours ----------
// A strip under the gauges: what the host is about to do slides in from the right toward "now" on the left.
interface Ahead { id: string; at: number; icon: string; what: string; held?: boolean }
const RIBBON_HOURS = 2;
function ahead(hour: number, nap: number, event: HostEvent | null = null): Ahead[] {
  const h = CONFIG.host, name = (m: number) => (m < 10 ? 'Breakfast' : m < 16 ? 'Lunch' : 'Dinner');
  const all: Ahead[] = [
    ...G.mealsOf(event).map((m) => ({ id: `meal${m}`, at: m, icon: '\u{1F374}\uFE0E', what: `${name(m)} at ${clock(m)}: sugar refills faster, and stomach acid rises over ${CONFIG.stomach.rise} seconds.` })),
    ...h.coffee.at.map((m) => ({ id: `coffee${m}`, at: m, icon: '\u2615\uFE0E', what: `Coffee at ${clock(m)}: faster blood everywhere, and frights come more often.` })),
    ...h.drink.at.map((m) => ({ id: `drink${m}`, at: m, icon: '\u{1F377}\uFE0E', what: `A drink at ${clock(m)}: sluggish immune cells, a swaying ship, and liver cells cost the host double.` })),
    { id: 'sleep', at: h.asleepFrom, icon: '\u263E', what: `Asleep at ${clock(h.asleepFrom)}: slow blood, sharp noses, less sugar, and the host mends.` },
    { id: 'wake', at: G.wakes(event), icon: '\u2600\uFE0E', what: `Awake at ${clock(G.wakes(event))}: the blood picks up and noses dull.` },
  ];
  if (nap > 0 && nap < RIBBON_HOURS) all.push({ id: 'napend', at: (hour + nap) % 24, icon: '\u2600\uFE0E', what: 'The nap ends: back to waking blood.' });
  const soon = all.map((e) => ({ ...e, at: (e.at - hour + 24) % 24 })).filter((e) => e.at > 0 && e.at <= RIBBON_HOURS);
  // Today's event is not coming, it is here: it sits at the far end of the strip for the whole trip.
  if (event) soon.push({ id: `event-${event}`, at: RIBBON_HOURS, icon: EVENTS[event].icon, what: `${EVENTS[event].name}, all trip. ${EVENTS[event].brief}`, held: true });
  return soon;
}
let ribbonNote = 0;
function ribbon() {
  const box = $('ribbon'), list = ahead(s.host.hour, s.host.nap, s.event), have = new Map([...box.querySelectorAll('button')].map((b) => [b.dataset.id!, b]));
  for (const e of list) {
    let b = have.get(e.id);
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.dataset.id = e.id; b.textContent = e.icon; b.style.opacity = '0';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); $('ribbon-note').textContent = b!.title; ribbonNote = 5; });
      box.append(b);
      requestAnimationFrame(() => { b!.style.opacity = '1'; });
    }
    const secs = Math.round(e.at * CONFIG.host.secondsPerHour);
    b.title = e.held ? e.what : `${e.what} In about ${secs} seconds.`; b.setAttribute('aria-label', b.title);
    b.style.left = `${(e.at / RIBBON_HOURS) * 100}%`;
    b.classList.toggle('near', e.at < 0.34); b.classList.toggle('held', !!e.held);
    have.delete(e.id);
  }
  for (const b of have.values()) b.remove();
}

// ---------- loop ----------

let then = performance.now(), walked = 0, heardBeat = false, beatClock = 0;
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
  if (started && s.status === 'playing' && !paused) {
    if (held) { retarget -= dt; if (retarget <= 0) { retarget = 0.12; walkToPointer(); } }
    if ((s.place === 'vessel' || s.place === 'lung') && G.canLeave(s)) G.leave(s); // reaching the far end is getting away
    tipRest -= dt;
    if (!tip && !s.offer && !s.ask && tipRest <= 0 && !(s.tutorial && s.tutorial.step < 5)) { // in its first liver, Shepherd's order is the only instruction on screen until the last step
      const road = s.place === 'vessel' || s.place === 'lung';
      const mood = G.hostState(s), host: Record<string, G.Point | null> = { surge: mood === 'stressed' ? s.player : null, sleep: mood === 'asleep' ? s.player : null, meal: s.host.eating && s.time > 2 ? s.player : null, coffee: s.host.habit === 'coffee' ? s.player : null, drink: s.host.habit === 'drink' ? s.player : null, fever: G.fever(s) && s.hostHealth < CONFIG.host.fever.below[0] ? s.player : null };
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
  Sound.pulse(started && s.status === 'playing' && !tip && !paused ? bpm : 0, s.player.hp / G.maxHp(s), heat);
  aimPointer();
  const live = started && s.status === 'playing' && !tip && !paused;
  Sound.scene(s.place === 'vessel' ? (s.vessel ?? 'artery') : s.place, breath(s), G.digesting(s.host.hour, s.host.snack, s.event), live);
  view.heat = live ? Sound.intensity() : 0;
  // The picture keeps the host's pulse even where the sound cannot start.
  const heard = live ? Sound.thump() : 0;
  heardBeat ||= heard > 0;
  beatClock += dt * bpm / 60;
  view.kick = !live ? 0 : heardBeat ? heard : Math.exp(-((beatClock % 1) * 60 / bpm) / 0.14);
  view.bpm = bpm;
  draw(ctx, s, view);
  hud();
  if (started) { ribbon(); if (ribbonNote > 0 && (ribbonNote -= dt) <= 0) $('ribbon-note').textContent = ''; }
  requestAnimationFrame(frame);
}

// Lets a script (or a curious player) poke at the live game from the console.
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, get trip() { return trip; }, go, T, G, CONFIG, view, toWorld };

resize();
requestAnimationFrame(frame);
