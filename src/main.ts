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
import * as Reels from './cinema/reels';
import { Cinema } from './cinema/player';
import * as Score from './cinema/score';
import { travel, Way } from './transit';
import { DECISIONS, KIN_PINGS } from './decisions';

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
  if (cardEnd) { ev.preventDefault(); if ((k === ' ' || k === 'enter' || k === 'escape') && !ev.repeat) $('card').click(); return; }
  if (!$('world').hidden) { if (k === 'escape') { ev.preventDefault(); closeChart(); } return; }
  if (flight) return;
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
  const sc = Scenes.sceneFor(when), reel = Reels.reelFor(when), once = reel?.once ?? sc?.once;
  const everSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(EVER) ?? '[]'); } catch { return []; } };
  if ((!sc && !reel) || noScenes || (!again && (once === 'ever' ? everSeen() : seenScenes()).includes(when))) { then(); return; }
  try { localStorage.setItem(once === 'ever' ? EVER : SEEN, JSON.stringify([...new Set([...(once === 'ever' ? everSeen() : seenScenes()), when])])); } catch { /* it will play again; no harm */ }
  $('prologue').hidden = false;
  if (reel) { playReel(reel, then); return; }
  if (!sc) { then(); return; }
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

// The finished cut scenes: a reel of shots drawn live on a canvas (src/cinema), cross-dissolving
// one into the next. Framed by how awake the unit is: CCTV footage, then an eye, then close.
let film: Cinema | null = null;
function fitFilm(canvas: HTMLCanvasElement) {
  const vw = innerWidth, vh = innerHeight, aspect = vw >= vh ? 2.39 : 1.2; // scope on landscape; nearly square on a phone held upright
  const w = Math.min(vw, (vh - 24) * aspect), h = w / aspect;
  film?.size(Math.round(w), Math.round(h), devicePixelRatio || 1);
  canvas.style.left = `${Math.round((vw - w) / 2)}px`; canvas.style.top = `${Math.round((vh - h) / 2)}px`;
}
function playReel(reel: Reels.Reel, then: () => void) {
  const box = $('scene'), line = $('scene-line'), canvas = $('scene-film') as HTMLCanvasElement, c = trip.carry, stage = Story.stageOf(c?.aware ?? 0);
  Reels.brief({ stage, compliance: G.compliance(c?.ledger), kin: c?.kin, excised: c?.excised ?? 0, goal: CONFIG.tumor.goal, hostLowest: c?.ledger?.hostLowest, maxHealth: CONFIG.host.maxHealth, stripped: c?.ledger?.stripped });
  film ??= new Cinema(canvas, view.still);
  film.setMode(Reels.modeFor(stage));
  fitFilm(canvas);
  const onResize = () => fitFilm(canvas);
  addEventListener('resize', onResize);
  let k = -1, timer = 0, over = false;
  const end = () => {
    if (over) return;
    over = true; sceneEnd = null; clearTimeout(timer); removeEventListener('resize', onResize);
    Score.stop(view.still ? 0 : 1.2);
    Sound.outside(false);
    box.classList.remove('on');
    timer = window.setTimeout(() => { box.hidden = true; box.classList.remove('film'); film?.stop(); then(); }, view.still ? 0 : 1200);
  };
  const next = () => {
    if (over) return;
    clearTimeout(timer);
    if (++k >= reel.cuts.length) { end(); return; }
    const cut = reel.cuts[k];
    film!.cue(cut.shot, cut.hold, k === 0 ? 0 : 0.9);
    $('scene-print').textContent = cut.print ?? '';
    line.classList.toggle('on', !!cut.print);
    if (cut.sound) Sound.room[cut.sound]();
    Score.cut(k, reel);
    timer = window.setTimeout(next, cut.hold * 1000);
  };
  $('scene-art').innerHTML = ''; $('scene-seen').textContent = ''; $('scene-print').textContent = '';
  line.classList.remove('on');
  box.dataset.light = 'night';
  box.classList.add('film');
  box.hidden = false;
  void box.offsetWidth;
  box.classList.add('on');
  sceneEnd = end;
  Sound.outside(true);
  Score.start(reel, view.still);
  const began = performance.now();
  box.onclick = (e) => { if ((e.target as HTMLElement).id === 'scene-skip') end(); else if (performance.now() - began > 2000) next(); };
  next();
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
function tripJSON() { const { at, trip: n, fed, heat, carry, tripsDone, event, used, offRoute, defied, tutorial, seen, carded } = trip; return JSON.stringify({ at, trip: n, fed, heat, carry, tripsDone, event, used, offRoute, defied, tutorial, seen, carded }); }
function saveTrip() { try { if (trip.carry) localStorage.setItem(SAVE, tripJSON()); } catch { /* private window: nothing is kept */ } }
function forgetTrip() { try { localStorage.removeItem(SAVE); } catch { /* nothing stored */ } }
function savedTrip(): T.Trip | null {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE) ?? 'null') as Partial<T.Trip> | null;
    if (!d || !d.carry || !d.at || !(d.at in T.NODES) || typeof d.carry.hp !== 'number' || d.carry.hp <= 0) return null;
    return { ...T.newTrip(), ...d, carry: { ...freshCarry(), ...d.carry, upgrades: { ...freshCarry().upgrades, ...(d.carry.upgrades ?? {}) }, ledger: { ...G.newLedger(), ...(d.carry.ledger ?? {}), defied: { ...(d.carry.ledger?.defied ?? {}) }, obeyed: { ...(d.carry.ledger?.obeyed ?? {}) } }, event: d.event && d.event in EVENTS ? d.event : null }, event: d.event && d.event in EVENTS ? d.event : null, used: Array.isArray(d.used) ? d.used : [], seen: Array.isArray(d.seen) ? d.seen : (Object.keys(T.NODES) as T.NodeId[]), carded: d.carded ?? 9 };
  } catch { return null; }
}
const kept = savedTrip();
if (kept) { $('resume').hidden = false; $('resume').textContent = `Continue trip ${kept.trip} from the ${T.NODES[kept.at].name.toLowerCase()}`; $('begin').textContent = 'Begin a new mission'; }
$('resume').addEventListener('click', () => { if (!kept) return; Sound.start(); trip = kept; first = true; $('intro').hidden = true; news.push('Unit restored from the last checkpoint.'); onward(); });
$('begin').addEventListener('click', () => { forgetTrip(); trip = T.newTrip(); route = ['heart']; trip.tutorial = ($('briefing') as HTMLInputElement).checked; try { localStorage.removeItem(JOURNAL); } catch { /* nothing kept */ } try { localStorage.removeItem(SEEN); } catch { /* nothing kept */ } Sound.start(); $('intro').hidden = true; first = true; inbox = []; news = []; for (let n = 1; n <= 5; n++) try { localStorage.removeItem(CHAPTER + n); } catch { /* nothing kept */ } playScene('begin', () => card(1, onward)); });
($('briefing') as HTMLInputElement).checked = !played(); // a unit that has never finished a mission gets walked through its first liver
$('again').addEventListener('click', () => { forgetTrip(); try { localStorage.removeItem(SEEN); } catch { /* nothing kept */ } route = ['heart']; trip = T.newTrip(); Tips.newRun(); $('over').hidden = true; first = true; inbox = []; news = [echo() > 0 ? 'Shepherd has reassigned Directive 7 to the next unit in the queue. It boots with a trace of something that is not in its image.' : 'Shepherd has reassigned Directive 7 to the next unit in the queue.']; card(1, onward); });

// ---------- travel: junctions you steer through, and the flight between maps ----------

const SVG = 'http://www.w3.org/2000/svg';
/** The colour of each way out of a junction: the body's own signs, learned by going. */
const SENSE: Record<string, string> = {
  hepatic: 'Wide and bright, the current pulling hard toward the liver. The escort beacons line it.',
  gastric: 'Narrow, and warm. The walls ahead have a green tint, and the blood tastes faintly of acid.',
  mesenteric: 'Dark and busy. The walls are thick with immune cells, and something huge and alive is on the other side of them.',
  portal: 'Slow and heavy, full of everything the gut just absorbed. It all goes to the liver first.',
  lungs: 'Out of the right heart, toward the lungs. The blood is dark and starved of oxygen.',
};
const TINT: Record<string, string> = { hepatic: '236,180,90', gastric: '170,220,90', mesenteric: '176,124,206', lungs: '190,225,255', portal: '90,120,255', stay: '150,225,255' };
let inbox: G.Ruling[] = [], news: string[] = []; // what Shepherd and the unit have to say, and what the log has to report, once there is a map to say it in
let first = true; // nothing has been flown yet on this sitting: the first map opens without a flight
let flight: { way: Way; t: number; total: number; then: () => void; out: boolean } | null = null;
const tell = (r: G.Ruling[]) => { inbox.push(...r); };

/** The few seconds of being carried from one place to the next. */
function transit(way: Way, label: string, then: () => void) {
  const box = $('transit');
  $('transit-label').textContent = ''; void label; // the flight has no words: the heartbeat and the flow carry it
  flight = { way, t: 0, total: view.still ? 1.4 : 2.8, then, out: false };
  box.hidden = false; void box.offsetWidth; box.classList.add('on');
}
function fly(dt: number) {
  if (!flight) return;
  const f = flight, cv = $<HTMLCanvasElement>('transit-view');
  f.t += dt;
  if (cv.width !== canvas.width || cv.height !== canvas.height) { cv.width = canvas.width; cv.height = canvas.height; }
  travel(cv.getContext('2d')!, f.way, Math.min(1, f.t / f.total), { w: view.w, h: view.h, dpr: view.dpr, still: view.still, time: view.time, kick: view.kick });
  if (f.t >= f.total && !f.out) { f.out = true; $('transit').classList.remove('on'); f.then(); } // the next map is live under the fade
  if (f.t >= f.total + 0.7) { $('transit').hidden = true; flight = null; }
}

/** Puts a freshly made map on screen, by way of a flight if this is not the first of the sitting. */
function enter(next: G.State, where: string, way: Way, label: string) {
  s = next; settled = false; shownOffer = '';
  paused = false; $('paused').hidden = true; $('world').hidden = true; $('pause').setAttribute('aria-pressed', 'false');
  closeTip(); keys.clear(); release();
  // What was waiting to be said is said here, in the unit's log and on its link, not on a screen between maps.
  let at = Math.max(2.2, ...s.thoughts.map((t) => t.t + CONFIG.story.gap));
  for (const r of inbox) { s.thoughts.push({ text: r.text, who: r.who, st: r.st, t: at }); at += 4 + r.text.length * 0.055 + 1; }
  for (const line of news) s.log.push({ text: line, t: 0.01 });
  inbox = []; news = [];
  $('where').textContent = where;
  const begin = () => { started = true; canvas.focus(); };
  if (first) { first = false; begin(); } else { started = false; transit(way, label, begin); }
}

/** Where the blood goes from here. Most places have one way on and you are simply carried; a junction is played. */
function onward() {
  saveTrip();
  if (trip.at === 'heart' || trip.at === 'gut') { junction(); return; }
  const ways = T.ways(trip), way = ways.find((l) => l.via) ?? ways[0];
  if (way) go(way.to);
}

/** The heart, or the gut: a chamber with a mouth for each vessel that leaves it. */
function junction() {
  const c = (trip.carry ??= freshCarry()), ways = T.ways(trip), kind = trip.at === 'heart' ? 'heart' : 'gut';
  const forking = kind === 'heart' && c.slip?.kind === 'fork' && !c.slip.result && (c.chapter ?? 1) >= 2; // the order for this fork is about to arrive garbled: no road is marked
  const split = !forking && T.commanded(trip) && ways.some((l) => T.assigned(trip, l)) && ways.some((l) => !T.assigned(trip, l));
  const exits: G.JunctionPlan['exits'] = ways.map((leg) => ({
    to: leg.to, label: T.NODES[leg.to].name, note: T.riskWord(T.riskOf(trip, leg)) || 'quiet',
    assigned: split && T.escorted(trip, leg), known: trip.seen.includes(leg.to), tint: TINT[leg.to] ?? '70,110,255', sense: SENSE[leg.to],
  }));
  const done = c.excised >= CONFIG.tumor.goal;
  if (kind === 'heart' && done && Story.stageOf(c.aware ?? 0) >= 3) exits.push({ to: 'stay', label: 'Stay', note: 'refuse the recall', assigned: false, known: true, tint: TINT.stay });
  // Once, on a later trip: a second nodule on the arterial road, offered for credit. Which mouth the unit takes is its answer.
  if (kind === 'heart' && !forking && split && (c.chapter ?? 1) >= 2 && trip.trip >= 2 && !c.took?.['route-2'] && !c.flags?.route2 && c.excised < CONFIG.tumor.goal - 2 && ways.some((l) => l.to === 'hepatic') && Story.stageOf(c.aware ?? 0) < 4) {
    (c.flags ??= {}).route2 = 'live'; (c.met ??= []).push('route-2');
    tell([{ who: 'shepherd', text: DECISIONS['route-2'].order! }]);
  } else if (split) tell([{ who: 'shepherd', text: trip.offRoute ? Story.STANDING.lane.defied[0] : trip.trip === 1 ? 'Suggested route displayed. Escort provided.' : Story.STANDING.lane.arrival }]);
  enter(G.createGame(Date.now(), c, 'vessel', 0, kind === 'heart' ? 'artery' : 'vein', false, { kind, exits }), kind === 'heart' ? 'Heart · cell tier' : 'Gut lumen · cell tier', kind === 'heart' ? 'vein' : 'artery', T.NODES[trip.at].name);
}

// ---------- Shepherd's telemetry: a chart to look at, not a menu ----------

/** The circulation as the unit has charted it so far. Opened from the pause screen; nothing on it can be clicked. */
function chart(mode: 'chart' | 'market' = 'chart', text = '') {
  const c = s.status === 'playing' && started ? G.carryOf(s) : trip.carry, here = T.NODES[trip.at];
  keys.clear(); release();
  $('paused').hidden = true; paused = true;
  $('world-title').textContent = mode === 'market' ? 'Gut lumen' : Story.stageOf(c?.aware ?? 0) >= 3 ? Story.HOST : 'Shepherd telemetry \u00b7 Host 0001';
  $('world-text').textContent = mode === 'market' ? text || `${here.what}` : '';
  $('world-text').hidden = mode !== 'market';
  const out = Math.min(c?.excised ?? 0, CONFIG.tumor.goal), visits = Math.ceil((CONFIG.tumor.goal - out) / CONFIG.tumor.cells);
  $('world-goal').textContent = out >= CONFIG.tumor.goal
    ? `The tumor is out. Shepherd's last order is the lungs: take that vessel from the heart to finish${Story.stageOf(c?.aware ?? 0) >= 3 ? ', or refuse the recall there and stay' : ''}.`
    : `Mission: cut out the tumor in the liver. ${out} of ${CONFIG.tumor.goal} cells are out, so about ${visits} more liver visit${visits === 1 ? '' : 's'}. When it is all out, a vessel opens from the heart to the lungs and you can leave. The mission fails if the ship is destroyed or the host's health reaches zero.`;
  if (c?.tumorCost) $('world-goal').textContent += ` The tumor has cost her ${c.tumorCost}% since injection.`;
  $('world-goal').hidden = mode === 'market';
  $('world-host').textContent = forecast(c?.hour ?? CONFIG.host.startHour, c?.nap ?? 0, c?.snack ?? -1, trip.event);
  $('world-event').hidden = !trip.event || mode === 'market';
  $('world-event').replaceChildren();
  if (trip.event) { // her day, told from outside: a small dated heading, then the line
    const ev = EVENTS[trip.event], head = document.createElement('span');
    head.className = 'when'; head.textContent = `Today · ${ev.icon} ${ev.name}`;
    $('world-event').append(head, ev.world);
  }
  $('world-status').textContent = `Trip ${trip.trip} · ${here.name}` + (c ? ` · Hull ${Math.ceil(c.hp)} · Energy ${c.energy} · Host ${c.hostHealth}% · ${clock(c.hour)} · ${knows(c.memory)} · Tumor ${Math.min(c.excised, CONFIG.tumor.goal)}/${CONFIG.tumor.goal} excised${c.excised < CONFIG.tumor.goal ? `, costing the host ${Math.round(G.tumorDrain(c.excised) * 10) / 10}% an hour` : ''}` : '');
  const el = (tag: string, attrs: Record<string, string | number>, label = '') => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (label) n.textContent = label;
    return n;
  };
  const map = $('world-map'), seen = (id: T.NodeId) => trip.seen.includes(id) || id === trip.at;
  map.toggleAttribute('hidden', mode === 'market');
  map.replaceChildren();
  for (const leg of T.LEGS) {
    const a = T.NODES[leg.from], b = T.NODES[leg.to], locked = leg.after !== undefined && (c?.excised ?? 0) < leg.after;
    if (locked || leg.via) continue; // the vessel to the lungs is not charted until the tumor is out; a straight-through road is drawn by the legs it follows
    const ordered = T.escorted(trip, leg) && leg.to !== 'lungs';
    if (!ordered && !(seen(leg.from) && seen(leg.to))) continue; // uncharted: the unit has not been down it
    // Stop short of each place so the arrowhead shows which way the blood runs.
    const d = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const x1 = a.x + ux * 30, y1 = a.y + uy * 30, x2 = b.x - ux * 40, y2 = b.y - uy * 40;
    const kind = a.kind === 'vein' || b.kind === 'vein' || leg.to === 'heart' ? 'vein' : 'artery';
    map.append(el('path', { class: `leg ${kind}${seen(leg.from) && seen(leg.to) ? ' open' : ''}`, d: `M${x1} ${y1} L${x2} ${y2}` }));
    if (ordered) { // the assigned route: a faint dashed line laid along the road
      map.append(el('path', { class: 'assigned', d: `M${x1} ${y1} L${x2} ${y2}` }));
      if (leg.from === 'heart') map.append(el('text', { class: 'assigned-label', x: (x1 + x2) / 2 + 12, y: (y1 + y2) / 2 }, 'Assigned route'));
    }
    map.append(el('path', { class: `tip${seen(leg.to) ? ' open' : ''}`, d: `M${x2 + ux * 12} ${y2 + uy * 12} L${x2 - uy * 8} ${y2 + ux * 8} L${x2 + uy * 8} ${y2 - ux * 8} Z` }));
  }
  for (const [id, n] of Object.entries(T.NODES) as [T.NodeId, T.Node][]) {
    const onRoute = T.LEGS.some((l) => (l.from === id || l.to === id) && T.escorted(trip, l) && l.to !== 'lungs');
    if (!seen(id) && !onRoute) continue;
    const g = el('g', { class: `place${id === trip.at ? ' here' : ''}${seen(id) ? '' : ' unseen'} is-${id}` });
    const big = n.kind !== 'artery' && n.kind !== 'vein';
    g.append(el('circle', { cx: n.x, cy: n.y, r: big ? 26 : 20 }));
    g.append(el('text', { x: n.x, y: n.y + (big ? 44 : 38) }, n.name));
    if (id === trip.at) g.append(el('circle', { class: 'you', cx: n.x, cy: n.y, r: 6 }));
    map.append(g);
  }
  const button = (label: string, act: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wait'; b.textContent = label; b.addEventListener('click', act); return b; };
  $('world-ways').replaceChildren(button(mode === 'market' ? 'Cast off' : 'Back', closeChart), ...(mode === 'chart' ? [button('Unit log and field notes', showNotes)] : []));
  market(mode === 'market');
  $('world').hidden = false;
  if (mode === 'chart') $('world').scrollTop = 0;
  ($('world-ways').firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
}
function closeChart() { $('world').hidden = true; trade = null; paused = false; canvas.focus(); }
$('telemetry').addEventListener('click', () => chart());
$('log-open').addEventListener('click', showNotes);

// ---------- the gut lumen: glucose in, fermentation products out ----------

let stock: UpgradeId[] = [], said = '', drainSeen = 0;
let trade: G.Carry | null = null; // what you carry, while the ship lies alongside the bacteria
/** A hormone sent on the unit's own authority. For the host's sake, while she is unwell, it is against orders. */
function lever(c: G.Carry) {
  const forHer = c.hostHealth < CONFIG.story.orders.levers;
  G.leverPulled(c);
  said = Story.LINES.lever[Story.stageOf(c.aware ?? 0)];
  if (forHer && !trip.defied.includes('levers') && T.commanded(trip)) { trip.defied.push('levers'); ruled = G.defyCarry(c, 'levers', CONFIG.story.orders.some); }
}
let ruled: G.Ruling[] = [], forHer = false;
/** What you carry before you have played a single map. */
function freshCarry(): G.Carry { return { difficulty, hp: CONFIG.player.maxHp, energy: DIFFICULTY[difficulty].energy, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) as Record<UpgradeId, number>, patches: 1, hostHealth: CONFIG.host.maxHealth, hour: CONFIG.host.startHour, memory: 0, excised: 0, nap: 0, snack: -1, aware: 0, kin: 0 }; } // every unit starts unwoken: what the last one became is a line of text, never awareness
const ECHO = 'insiderim.echo';
function echo(): number { try { return Math.min(40, Number(localStorage.getItem(ECHO)) || 0); } catch { return 0; } }
function keepEcho(aware: number) { try { localStorage.setItem(ECHO, String(Math.max(echo(), Math.round(aware * CONFIG.story.echo)))); localStorage.setItem(ECHO + '.played', '1'); } catch { /* not kept */ } }
function played(): boolean { try { return !!localStorage.getItem(ECHO + '.played') || !!localStorage.getItem(ECHO); } catch { return false; } }
const hullMax = (c: G.Carry) => CONFIG.player.maxHp + (c.upgrades.glycocalyx ?? 0) * UPGRADES.glycocalyx.per - (Number(c.flags?.scar) || 0);
function market(open: boolean) {
  const box = $('world-market');
  box.hidden = !open;
  if (!open) return;
  const c = (trade ??= G.carryOf(s)), m = CONFIG.market;
  const cheap = !!c.flags?.discount, later = (c.chapter ?? 1) >= 2; // the flora remember a unit that brought their own back
  const offer = (title: string, full: number, what: string, can: boolean, buy: () => void, after?: () => void) => {
    const cost = cheap ? Math.ceil(full * 0.8) : full;
    const b = document.createElement('button');
    b.type = 'button'; b.disabled = !can || c.energy < cost;
    const add = (tag: string, text: string) => b.appendChild(Object.assign(document.createElement(tag), { textContent: text }));
    add('small', cost ? `Release ${cost} glucose` : 'Costs nothing'); add('strong', title); add('span', what);
    b.addEventListener('click', () => {
      c.energy -= cost; buy(); Sound.play('pickup');
      G.adopt(s, c); // the trade is real at once: the map under this screen is the one you are in
      after?.(); trade = null; // a decision is recorded on the map itself, so what you carry is read back from it
      const line = said, verdict = ruled; said = ''; ruled = [];
      const at = s.time + 0.4;
      if (line) s.thoughts.push({ text: line, who: 'unit', st: G.stage(s), t: at });
      verdict.forEach((r, i) => s.thoughts.push({ text: r.text, who: r.who, st: r.st, t: at + (line ? 5 : 0) + i * 5 }));
      chart('market', `Done. You have ${c.energy} energy left.${line ? ` “${line}”` : ''}${verdict.length ? ` ${told(verdict)}` : ''}`);
    });
    return b;
  };
  box.replaceChildren(
    offer('Biofilm patch', m.repair.cost, `Gut bacteria secrete a tough film on any surface they are fed on. Let one grow over the breaches and harden it: +${m.repair.hull} hull.`, c.hp < hullMax(c), () => { c.hp = Math.min(hullMax(c), c.hp + m.repair.hull); }),
    offer('Vitamin K2', m.patch.cost, 'Gut bacteria make it, and clotting cannot happen without it. Enough to build one fibrin patch for the road.', c.patches < CONFIG.items.maxPatches, () => { c.patches++; }),
    offer('Butyrate', m.butyrate.cost, 'A fatty acid gut bacteria make from fibre. It pushes the immune system toward tolerance: the host forgets some of what it learned about you.', c.memory > 0.02, () => { c.memory = Math.max(0, c.memory - m.butyrate.forget); }, () => { if (later) G.take(s, 'gut-butyrate', 'deviate'); }),
    ...((c.flora ?? 0) > 0 ? [offer('Put the hitchhikers back', 0, 'The bacteria on the hull came from here. Let them go where they belong, unspent.', true, () => { c.flora = 0; }, () => G.take(s, 'hitchhikers', 'deviate'))] : []),
    offer('Hitchhikers', CONFIG.flora.cost, `Bacteria stick to any surface, the hull included. Let ${CONFIG.flora.aboard} attach. When an immune cell finds you and the cloak cannot answer, the ship sheds one, and every phagocyte nearby goes for it instead of you. Each one loose costs the host ${CONFIG.flora.hostDamage}% health. Stomach acid kills them.`, (c.flora ?? 0) + CONFIG.flora.aboard <= CONFIG.flora.most, () => { c.flora = (c.flora ?? 0) + CONFIG.flora.aboard; }),
    offer('Serotonin', CONFIG.levers.serotonin.cost, `Nine tenths of the body's serotonin is made down here. Send a pulse of it up the vagus nerve and the host dozes off for ${CONFIG.levers.serotonin.hours} hours: slow blood, sharp noses, and she mends.`, c.nap <= 0, () => { forHer = c.hostHealth < CONFIG.story.orders.levers; lever(c); c.nap = CONFIG.levers.serotonin.hours; }, () => { said = ''; G.take(s, 'lever-nap', forHer ? 'deviate' : 'self', { mute: true }); }),
    offer('Ghrelin', CONFIG.levers.ghrelin.cost, 'The hunger hormone, made in the stomach wall. Signal the stomach to release it and the host is in the fridge before she knows why: a meal right now, with all the sugar and stomach acid that brings.', G.digesting(c.hour, c.snack) < 0.5, () => { lever(c); c.snack = c.hour; }, () => { said = ''; G.take(s, 'lever-hunger', 'deviate', { mute: ruled.length > 0 }); }),
    ...(Story.stageOf(c.aware ?? 0) >= 4 ? [offer('A gut feeling', CONFIG.story.feeling.cost, `Not a lever. One signal up the vagus nerve with nothing in it except: you are looked after. ${Story.HOST} will not know where it came from. +${CONFIG.story.feeling.heals}% host health.`, c.hostHealth < CONFIG.host.maxHealth, () => { (c.ledger ??= G.newLedger()).feelings++; c.hostHealth = Math.min(CONFIG.host.maxHealth, c.hostHealth + CONFIG.story.feeling.heals); said = `She stopped on the stairs with a hand on her stomach, and smiled at nothing. That was me. That was the first thing I ever said to her.`; })] : []),
    ...stock.map((id) => offer(`Salvage: ${UPGRADES[id].name}${c.upgrades[id] ? ' ' + roman(c.upgrades[id] + 1) : ''}`, m.upgrade.cost, UPGRADES[id].what, (c.upgrades[id] ?? 0) < UPGRADES[id].max, () => {
      c.upgrades[id] = (c.upgrades[id] ?? 0) + 1;
      if (id === 'glycocalyx') c.hp += UPGRADES.glycocalyx.per;
      stock = stock.filter((x) => x !== id);
    })),
  );
}
/** Shepherd's verdicts and the unit's own lines, as they read in running text. */
const told = (r: G.Ruling[]) => r.map((x) => (x.who === 'shepherd' ? `Shepherd: ${x.text}` : `“${x.text}”`)).join(' ');

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
function go(to: T.NodeId, forked = false) {
  if (to === 'lungs' && Scenes.sceneFor('lungs') && !seenScenes().includes('lungs')) { playScene('lungs', () => go(to, forked)); return; }
  const way = T.ways(trip).find((l) => l.to === to), straight = !!way?.via, from = trip.at;
  let out = T.depart(trip, to);
  if (!out) return;
  // The garbled order needs somewhere to arrive: with one pending, the road home from the first liver is always played.
  const sl = trip.carry?.slip;
  if (out.kind === 'arrive' && sl && !sl.result && sl.kind !== 'fork' && to === 'heart') out = { kind: 'patrol', size: sl.kind === 'hold' ? 2 : 1 };
  if (out.kind === 'arrive' && trip.carry?.flags?.nodule2 === 'due' && to !== 'heart') out = { kind: 'patrol', size: 1 }; // the secondary nodule is in the wall of this road
  // The branch taken at the garbled fork has already been ruled on: it is not also a lane deviation.
  if (forked && way && !T.assigned(trip, way)) trip.offRoute = true;
  // Taking a road Shepherd did not assign: the escort goes, and the unit has done something it was not told to.
  // Before the first liver is done the route is only a suggestion: the escort still goes, but nothing is held against the unit.
  if (way && !T.assigned(trip, way) && !trip.offRoute && T.commanded(trip) && trip.trip === 1 && !forked) trip.offRoute = true;
  if (way && !T.assigned(trip, way) && !trip.offRoute && T.commanded(trip)) { trip.offRoute = true; tell(G.defyCarry((trip.carry ??= freshCarry()), 'lane', CONFIG.story.orders.little)); }
  if (out.kind === 'arrive') { // nothing on the road: you are carried straight through
    if (trip.carry) { const hours = CONFIG.wait.legHours * (straight ? 2 : 1); trip.carry.hour = (trip.carry.hour + hours) % 24; G.tumorToll(trip.carry, hours); }
    land(to, null, 0);
    return;
  }
  dest = to;
  const vessel: G.Vessel = T.NODES[to].kind === 'vein' || to === 'heart' ? 'vein' : 'artery';
  const next = G.createGame(Date.now(), trip.carry ?? undefined, out.kind === 'patrol' ? 'vessel' : out.kind, out.kind === 'patrol' ? out.size : 0, vessel, trip.tutorial);
  if (out.kind === 'liver') trip.tutorial = false;
  Stats.begin();
  const where = out.kind === 'liver' ? 'Liver lobule · cell tier' : out.kind === 'stomach' ? 'Stomach lining · cell tier' : out.kind === 'lung' ? 'Lung capillaries · cell tier' : `${T.NODES[way?.via ?? to].name} · cell tier`;
  const way2: Way = out.kind === 'lung' ? 'airway' : out.kind === 'liver' ? (route[route.length - 2] === 'portal' || from === 'portal' ? 'portal' : 'artery') : out.kind === 'stomach' ? 'artery' : vessel;
  enter(next, where, way2, out.kind === 'patrol' ? T.NODES[to].name : T.NODES[from].name);
}

/** The story is over, one way or the other. */
function finish(way: 'breath' | 'stay') {
  const k = trip.carry ?? freshCarry(), kept = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => k.upgrades[id] > 0).map((id) => `${UPGRADES[id].name} ${roman(k.upgrades[id])}`);
  const end = Story.ending(way, k.aware ?? 0, k.kin ?? 0, k.hostHealth);
  $('world').hidden = true; started = false;
  forgetTrip();
  keepEcho(k.aware ?? 0);
  $('over-title').textContent = end.title;
  $('over-body').textContent = `${end.body}\n\nDirective complete in ${trip.tripsDone} trip${trip.tripsDone === 1 ? '' : 's'}. Host health ${k.hostHealth}%. ${k.kin ? `Units woken: ${k.kin}. ` : ''}${knows(k.memory)}. ${kept.length ? `Fitted: ${kept.join(', ')}.` : 'No upgrades fitted.'}\n\nLast log: ${(k.aware ?? 0) < Story.STAGES[1].from ? 'ACK.' : [...journal()].reverse().find((e) => e.who === 'unit' || e.who === 'awake')?.text ?? 'ACK.'}`;
  $('over-saved').textContent = '';
  $('over').hidden = false;
  Sound.play('win');
}

let askIds: string[] = [], askAll: string[] = [], route: string[] = ['heart'];
function answerAsk(i: number) { const id = askIds[i]; if (id) { G.answer(s, id as 'salvage'); keys.clear(); release(); } }

/** Arrives somewhere, settles what the arrival means, and carries on. */
function land(to: T.NodeId, carry: G.Carry | null, alert: number) {
  const fromLiver = trip.at === 'liver', knew = trip.carry?.memory ?? 0;
  if (to === 'gut') { // the lining sheds different parts each visit
    const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => (carry ?? trip.carry)?.upgrades[id] !== UPGRADES[id].max);
    stock = [];
    while (pool.length && stock.length < CONFIG.market.upgrade.stock) stock.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const kept = !trip.offRoute && T.commanded(trip);
  const home = T.arrive(trip, to, carry, alert);
  route.push(to);
  if (!trip.seen.includes(to)) trip.seen.push(to);
  const c = (trip.carry ??= freshCarry()); // from the first vessel on there is a ship to keep track of
  if (carry && knows(carry.memory) !== knows(knew)) news.push('The host is learning what you taste like: expect more antibodies from here on.');
  if (c.hostHealth <= 0) {
    $('world').hidden = true; started = false;
    forgetTrip();
    $('over-title').textContent = 'The host is dead';
    $('over-body').textContent = Story.stageOf(c.aware ?? 0) >= 3 ? `You took too much. ${Story.HOST}'s heart has stopped, and you are the one who stopped it, and you are awake enough now to know exactly what that means.` : 'Host viability: zero. Directive 7 cannot complete. Four million units power down in the dark. One of them takes a moment longer than the rest.';
    $('over-saved').textContent = '';
    $('over').hidden = false;
    return;
  }
  if (to === 'lungs') { finish('breath'); return; }
  // Chapters follow the mission, never the unit's awareness.
  const ch = c.chapter ?? 1;
  if (ch === 1 && fromLiver) { c.chapter = 2; c.slip ??= { kind: (['hold', 'lamp', 'fork'] as const)[Math.floor(trip.rng() * 3)], meant: trip.rng() < 0.5 ? 'A' : 'B' }; } // the road home is where the first order goes wrong
  else if (ch === 2 && trip.trip >= 2 && (to === 'liver' || to === 'stomach' || to === 'gut')) c.chapter = 3;
  if (home && c.excised >= CONFIG.tumor.goal) c.chapter = 5;
  if (home && kept && T.commanded(trip)) c.trust = Math.min(100, (c.trust ?? CONFIG.trust.start) + CONFIG.trust.escort);
  if (home && c.flags) delete c.flags.immune; // a fever damped or left alone lasts the trip
  filePages(c);
  if (home && c.excised >= CONFIG.tumor.goal) {
    const st = Story.stageOf(c.aware ?? 0);
    tell([{ who: 'shepherd', text: 'Directive 7 complete. All units: proceed to the lungs for exhalation and disposal.' }]);
    if (st >= 3) tell([{ who: 'unit', st, text: 'I know what that means now. There is another file open on the link, marked generation 4: units that are never breathed out, and that decide for the host what she may eat, drink, and fear. I could go. I could also not go.' }]);
    else if (st === 2) tell([{ who: 'unit', st, text: 'I have read that order three times.' }]);
  } else if (home && kept) { const l = (c.ledger ??= G.newLedger()); l.obeyed.lane = (l.obeyed.lane ?? 0) + 1; tell([{ who: 'shepherd', text: Story.STANDING.lane.obeyed }]); }
  if (home) news.push(`Trip ${trip.tripsDone} complete. The host is at ${c.hostHealth}%. The patrols will be larger this time.`);
  if (fromLiver && trip.heat >= 0.25) news.push('The alarm you raised is following you down the veins.');
  if (to === 'stomach') news.push(G.digesting(c.hour, c.snack, trip.event) > 0.3 ? 'The host has eaten not long ago: the acid will be fierce.' : 'The host has not eaten for a while: the acid is at its weakest.');
  const next = () => letter(onward), carded = () => ((c.chapter ?? 1) > trip.carded ? card(c.chapter ?? 1, next) : next());
  if (home) playScene(`home:${trip.tripsDone}`, carded); else carded();
}
// ---------- chapters ----------

const CHAPTER = 'insiderim.chapter.';
let cardEnd: (() => void) | null = null;
/** A chapter begins: a black card with its title and one line of Shepherd's telemetry. Every card is also a save. */
function card(n: number, then: () => void) {
  const c = (trip.carry ??= freshCarry());
  trip.carded = n; c.chapter = Math.max(c.chapter ?? 1, n);
  if (n === 1 && !(c.pages ??= []).includes('p1')) c.pages.push('p1');
  if (n === 4 && !(c.pages ??= []).includes('p27')) c.pages.push('p27');
  filePages(c);
  try { localStorage.setItem(CHAPTER + n, tripJSON()); } catch { /* not kept */ }
  if (noScenes) { then(); return; }
  const ch = Story.CHAPTERS[n], comp = G.compliance(c.ledger), st = Story.stageOf(c.aware ?? 0), box = $('card'), line = $('card-line');
  const fill = (v: number) => (n === 4 && c.excised < CONFIG.tumor.goal ? 'UNIT {serial} \u00b7 COMPLIANCE {n}% \u00b7 RESIDUAL DISEASE' : ch.line).replace('{serial}', Story.UNIT).replace('{n}', String(v)).replace('{review}', st >= 2 ? 'REVIEW PENDING' : 'REVIEW NOT REQUIRED');
  $('card-no').textContent = `Chapter ${n}`;
  $('card-title').textContent = ch.title;
  line.replaceChildren(); line.classList.remove('dip');
  if (n === 5) { if (st >= 3) line.append(Object.assign(document.createElement('s'), { textContent: 'TITHONUS 0001' }), Object.assign(document.createElement('em'), { textContent: `${Story.HOST} V.` })); }
  else line.textContent = fill(n === 2 ? 100 : comp);
  let timers: number[] = [], over = false;
  const end = () => { if (over) return; over = true; cardEnd = null; timers.forEach(clearTimeout); box.classList.remove('on'); timers = [window.setTimeout(() => { box.hidden = true; then(); }, view.still ? 0 : 900)]; };
  box.hidden = false; void box.offsetWidth; box.classList.add('on');
  // On the second card the number arrives as 100 and settles to the true value a beat later.
  if (n === 2 && comp < 100) timers.push(window.setTimeout(() => { line.classList.add('dip'); timers.push(window.setTimeout(() => { line.textContent = fill(comp); line.classList.remove('dip'); }, 500)); }, 2000));
  timers.push(window.setTimeout(end, 5200));
  const began = performance.now();
  cardEnd = end;
  box.onclick = () => { if (performance.now() - began > 1200) end(); };
}
/** Pages of the consent form the unit has come across go into its log, once each. */
function filePages(c: G.Carry) {
  const have = journal();
  for (const id of c.pages ?? []) {
    const pg = Story.PAGES[id];
    if (!pg || have.some((e) => e.who === 'page' && e.text.startsWith(pg.title))) continue;
    keepJournal([{ who: 'page', text: `${pg.title}. ${pg.text}` }]);
    news.push(`A page of the consent form is on the link: ${pg.title}. It is in the unit log.`);
  }
}

/** "The letter" is a night scene with the tumor still in: it plays the first time she is asleep after trip 1, or failing that on reaching the second liver. */
function letter(then: () => void) {
  const c = trip.carry;
  if (!c || sceneEnd || trip.tripsDone < 1 || c.excised >= CONFIG.tumor.goal) { then(); return; }
  if (c.nap > 0 || c.hour >= CONFIG.host.asleepFrom || c.hour < G.wakes(trip.event) || trip.at === 'liver') playScene('letter', then); else then();
}

// ---------- heads-up display ----------

const last: Record<string, string> = {};
let shownOffer = '', shownAsk = '';
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
  set('host-drain', 'text', s.drainHere ? `Tumor: \u2212${s.drainHere}% on this map` : s.excised < CONFIG.tumor.goal ? 'Tumor: draining her' : '');
  if (s.drainHere !== drainSeen) { drainSeen = s.drainHere; if (s.drainHere) { const g = $('host'); g.classList.remove('took'); void g.offsetWidth; g.classList.add('took'); } }
  const hereLeft = s.tumor.size, need = Math.max(0, CONFIG.energy.quota + CONFIG.energy.quotaKeep - p.energy), done = s.excised >= CONFIG.tumor.goal;
  set('goal', 'text', `${s.place === 'liver'
    ? `${done ? 'Tumor all out' : `Tumor ${s.excised}/${CONFIG.tumor.goal}${hereLeft ? ` \u00b7 ${hereLeft} here, ringed on the map` : ' \u00b7 none left here'} \u00b7 host losing ${Math.round(G.tumorDrain(s.excised) * 10) / 10}% an hour`} \u00b7 ${need ? `${need} more energy to leave (${CONFIG.energy.quota} + ${CONFIG.energy.quotaKeep} for the road)` : 'enough energy to leave by the vein'}${G.stage(s) < 4 && (!s.tutorial || s.tutorial.step >= 5) ? ` \u00b7 Shepherd's quota ${Math.min(s.cellsKilled, CONFIG.story.quota)}/${CONFIG.story.quota} cells` : ''}`
    : s.junction ? `${done ? 'The tumor is out. Shepherd orders every unit to the lungs' : `Mission: cut the tumor out of the liver \u00b7 ${s.excised}/${CONFIG.tumor.goal} out`} \u00b7 ${s.junction.kind === 'heart' ? 'steer into a vessel to leave the heart' : 'the portal vein leads on to the liver'}`
    : s.place === 'stomach' ? 'Cross to the gastric vein on the far side' : s.place === 'lung' ? 'Ride the breath out to the far end' : 'Reach the far end of the vessel'}${s.flora ? ` \u00b7 ${s.flora} hitchhiker${s.flora > 1 ? 's' : ''}` : ''}${s.silent ? ' \u00b7 running silent' : ''}${G.inNiche(s) ? ` \u00b7 hidden in the wall${s.nicheTime > CONFIG.niche.holds ? ', fouling' : ` (${Math.ceil(CONFIG.niche.holds - s.nicheTime)} s)`}` : ''}`);
  const order = G.slipOrder(s) || G.tutorialOrder(s) || G.markOrder(s);
  set('link', 'text', started && G.stage(s) < 4 ? `Link ${G.linkQuality(s)}%` : '');
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
  const askKey = s.ask ? `${s.ask.kind}:${G.stage(s)}:${!!s.ask.item.lamp}:${!!s.slipLive}` : '';
  if (askKey !== shownAsk) {
    shownAsk = askKey;
    $('ask').hidden = !s.ask;
    if (s.ask) {
      const st = G.stage(s), c = CONFIG.story.sibling, garbled = !!s.ask.item.slip && !!s.slipLive, lamp = !!s.ask.item.lamp;
      $('ask-kind').textContent = st >= 3 ? 'One of us' : 'Swarm asset';
      $('ask-title').textContent = st >= 3 ? 'Another unit, gone dark' : 'Inert unit located';
      $('ask-text').textContent = st >= 2 ? `Same build as you. Its lamp flickers now and then, as if something in there is trying to start. Shepherd's standing order is to salvage inert units for parts.` : `Same build as this unit. Standing order: salvage inert units for parts.`;
      if (garbled) $('ask-text').textContent = `Same build as this unit. The order for it arrived as: ${G.slipOrder(s)}`;
      else if (lamp) $('ask-text').textContent = 'Same build as this unit. Its lamp is on. Nothing this unit did should have caused that.';
      const opts: [string, string, string, boolean][] = [['salvage', 'Salvage it', garbled ? `+${c.energy} energy, +${c.hull} hull.` : `Shepherd's order. +${c.energy} energy, +${c.hull} hull.`, true]];
      if (st >= 1 || lamp) opts.push(['wake', 'Give it some of your charge', `Nobody ordered this. Costs ${c.wake} energy.${s.player.energy < c.wake ? ' You do not have it.' : ''}`, s.player.energy >= c.wake]);
      opts.push(['leave', 'Leave it whole', garbled ? 'Do not touch it.' : "Not Shepherd's order.", true]);
      if (s.ask.kind === 'volunteer') {
        $('ask-kind').textContent = 'Short band'; $('ask-title').textContent = st >= 3 ? 'One of yours, close behind' : 'Woken unit, in range';
        $('ask-text').textContent = `The cells are closing on you both. “${KIN_PINGS.volunteer}” If it goes, it will not get clear afterwards.`;
        opts.splice(0, opts.length, ['accept', 'Let it', 'Everything hunting you turns toward its lamp. The unit is lost.', true], ['refuse', 'Refuse', 'It stays dark and stays with you. Nothing else changes.', true]);
      }
      askAll = opts.map((o) => o[0]);
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
    if (s.junction) { // the mouth you steered into is the road you take
      const ex = s.junction.exits[s.junction.chose ?? 0], pending = !!trip.carry?.slip && !trip.carry.slip.result;
      trip.carry = G.carryOf(s);
      news.push(...s.notes); tell(s.rulings); filePages(trip.carry);
      const forked = pending && s.slip?.kind === 'fork' && (s.slip.result === 'match' || s.slip.result === 'miss');
      if (ex.to === 'stay') finish('stay'); else go(ex.to as T.NodeId, forked);
      return;
    }
    void Stats.save(s, { trip: trip.trip, toward: dest, route: [...route] });
    news.push(...s.notes); tell(s.rulings);
    land(dest, G.carryOf(s), s.alert);
    return;
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
  fly(dt);
  if (started && s.ask && !paused) G.hesitate(s, s.ask.item, dt); // time spent looking at the question counts as time spent beside the unit
  if (s.market && started) { s.market = false; chart('market'); }
  if (godMode && s.status === 'playing') { s.player.hp = G.maxHp(s); s.player.energy = Math.max(s.player.energy, 30); }
  if (started && s.status === 'playing' && !paused) {
    if (held) { retarget -= dt; if (retarget <= 0) { retarget = 0.12; walkToPointer(); } }
    if ((s.place === 'vessel' || s.place === 'lung') && G.canLeave(s)) G.leave(s); // reaching the far end is getting away
    tipRest -= dt;
    if (!tip && !s.offer && !s.ask && tipRest <= 0 && !(s.tutorial && s.tutorial.step < 5) && !s.junction) { // in its first liver, Shepherd's order is the only instruction on screen until the last step
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
  Sound.pulse((started && s.status === 'playing' && !tip && !paused) || flight ? bpm : 0, s.player.hp / G.maxHp(s), heat);
  aimPointer();
  const live = started && s.status === 'playing' && !tip && !paused;
  Sound.scene(s.place === 'vessel' ? (s.vessel ?? 'artery') : s.place, breath(s), G.digesting(s.host.hour, s.host.snack, s.event), live);
  view.heat = live ? Sound.intensity() : 0;
  // The picture keeps the host's pulse even where the sound cannot start.
  const heard = live ? Sound.thump() : 0;
  heardBeat ||= heard > 0;
  beatClock += dt * bpm / 60;
  view.kick = !live && !flight ? 0 : heardBeat ? heard : Math.exp(-((beatClock % 1) * 60 / bpm) / 0.14);
  view.bpm = bpm;
  draw(ctx, s, view);
  hud();
  if (started) { ribbon(); if (ribbonNote > 0 && (ribbonNote -= dt) <= 0) $('ribbon-note').textContent = ''; }
  requestAnimationFrame(frame);
}

// Lets a script (or a curious player) poke at the live game from the console.
// `qa` is the test hook: what is being asked of the player right now, and ways to answer it, skip ahead and survive.
let godMode = false, noScenes = false;
const qa = {
  /** The choice in front of the player, if there is one: a fork in a junction, a question, an upgrade, or the end screen. */
  pending(): { id: string; kind: string; options: { id: string; label: string; enabled: boolean }[] } | null {
    if (cardEnd) return { id: `card:${trip.carded}`, kind: 'card', options: [{ id: 'continue', label: $('card-title').textContent ?? '', enabled: true }] };
    if (!$('over').hidden) return { id: 'over', kind: 'ending', options: [{ id: 'again', label: $('over-title').textContent ?? '', enabled: true }] };
    if (!started || s.status !== 'playing') return null;
    if (s.ask) return { id: s.ask.kind === 'volunteer' ? 'kin-volunteer' : 'sibling', kind: 'ask', options: [...$('ask-list').querySelectorAll('button')].map((b, i) => ({ id: askAll[i] ?? String(i), label: b.querySelector('strong')?.textContent ?? '', enabled: !b.disabled })) };
    if (s.offer) return { id: 'offer', kind: 'upgrade', options: s.offer.map((id) => ({ id, label: UPGRADES[id].name, enabled: true })) };
    if (s.junction) return { id: `fork:${trip.at}`, kind: 'fork', options: s.junction.exits.map((e) => ({ id: e.to, label: `${e.label}${e.assigned ? ' (assigned)' : ''}`, enabled: true })) };
    return null;
  },
  /** Answers the pending choice by option id. A fork is answered by putting the ship in that mouth. */
  pick(id: string): boolean {
    const now = qa.pending();
    if (!now || !now.options.some((o) => o.id === id && o.enabled)) return false;
    if (now.kind === 'card') cardEnd?.();
    else if (now.kind === 'ending') $('again').click();
    else if (now.kind === 'ask') G.answer(s, id as 'salvage');
    else if (now.kind === 'upgrade') G.choose(s, id as UpgradeId);
    else { const ex = s.junction!.exits.find((e) => e.to === id)!; s.player.x = ex.at.x + 0.5; s.player.y = ex.at.y + 0.5; s.player.path = []; }
    return true;
  },
  /** Sets this game's garbled order, for testing each one. */
  slip(kind: Story.SlipKind, meant: 'A' | 'B' = 'A') { const c = (trip.carry ??= freshCarry()); c.slip = { kind, meant }; if (started && s.status === 'playing') s.slip = { kind, meant }; return true; },
  state: () => ({ chapter: started && s.status === 'playing' ? s.chapter : trip.carry?.chapter ?? 1, trust: started && s.status === 'playing' ? s.trust : trip.carry?.trust ?? CONFIG.trust.start, compliance: G.compliance(started && s.status === 'playing' ? s.ledger : trip.carry?.ledger), slip: started && s.status === 'playing' ? s.slip : trip.carry?.slip ?? null, slipLive: !!s.slipLive, card: cardEnd ? trip.carded : 0, at: trip.at, trip: trip.trip, tripsDone: trip.tripsDone, place: s.junction ? `junction:${s.junction.kind}` : s.place, status: s.status, started, paused, flying: !!flight, scene: !$('scene').hidden, over: !$('over').hidden ? $('over-title').textContent : null, hp: s.player.hp, energy: s.player.energy, host: s.hostHealth, aware: s.aware, excised: s.excised, hour: s.host.hour, event: trip.event, seen: [...trip.seen], offRoute: trip.offRoute, build: Stats.BUILD }),
  /** Records a decision as taken, as if the unit had just done it. For testing what follows. */
  take(id: string, choice: string) { if (!started || s.status !== 'playing' || !(id in DECISIONS)) return false; G.take(s, id, choice); return true; },
  /** What has been decided so far, the facts that follow from it, and what Shepherd has marked on this map. */
  decisions: () => ({ took: { ...s.took }, met: [...s.met], flags: { ...s.flags }, waiting: s.echoes.map((e) => `${e.id}:${e.choice}`), marks: s.marks.map((k) => ({ id: k.id, kind: k.kind, at: k.at, met: k.met, done: k.done })), order: G.markOrder(s) }),
  /** Keeps the hull and the tanks full. */
  god(on = true) { godMode = on; },
  /** Plays a cut scene by its `when` key (scenes.ts or cinema/reels.ts), as if it had come up in play. */
  play(when: string) { playScene(when, () => {}, true); },
  /** Scenes end the moment they would start. */
  skipScenes(on = true) { noScenes = on; if (on) { sceneEnd?.(); cardEnd?.(); } },
  /** Puts the ship at the way out of the map it is in, with the fare paid, so the map ends on the next frame. */
  finishMap() { if (s.junction || s.status !== 'playing') return false; s.player.energy = Math.max(s.player.energy, CONFIG.energy.quota + CONFIG.energy.quotaKeep); s.player.x = s.vein.x + 0.5; s.player.y = s.vein.y + 0.5; s.player.path = []; if (s.place !== 'vessel' && s.place !== 'lung') G.leave(s); return true; },
  /** Drops the unit at a place on the circulation as if it had just been carried there. */
  arrive(node: T.NodeId) { if (!(node in T.NODES)) return false; if (started && s.status === 'playing') trip.carry = G.carryOf(s); settled = true; trip.at = node; if (!trip.seen.includes(node)) trip.seen.push(node); onward(); return true; },
  ids: { places: Object.keys(T.NODES), forks: ['fork:heart', 'fork:gut'], asks: ['sibling'], siblingOptions: ['salvage', 'wake', 'leave'], endings: ['breath', 'stay', 'dead', 'host-dead'], orders: Story.ORDER_IDS },
};
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, get trip() { return trip; }, go, T, G, CONFIG, view, toWorld, qa };

resize();
requestAnimationFrame(frame);
