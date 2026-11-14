// Input and the side panel. All rules live in game.ts.
import { CONFIG } from './config';
import * as G from './game';
import { draw, TILE, View } from './render';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;

let s = G.createGame();
let hover: G.Point | null = null;
let picked: G.Point | null = null;
let busy = false;
const view: View = { hoverPath: [], reach: 0, pick: [], picked: null, tween: new Map(), targetId: null };

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = s.width * TILE * dpr;
  canvas.height = s.height * TILE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function refresh() {
  const playing = s.status === 'playing' && !busy;
  view.pick = playing ? G.strippable(s) : [];
  if (picked && !view.pick.some((p) => p.x === picked!.x && p.y === picked!.y)) picked = null;
  view.picked = picked;
  view.hoverPath = [];
  view.targetId = null;
  let hint = '';
  if (playing && hover) {
    const e = G.enemyAt(s, hover.x, hover.y);
    if (e) {
      view.targetId = e.id;
      const near = Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) === 1;
      const chance = near ? CONFIG.player.strike.hit : G.shotChance(s, e);
      const who = e.kind === 'kupffer' ? 'Kupffer cell' : 'Neutrophil';
      hint = chance
        ? `${who}, ${e.hp} HP. ${near ? 'Strike' : 'Shoot'}: ${Math.round(chance * 100)}% to hit, ${near ? CONFIG.player.strike.ap : CONFIG.player.shot.ap} AP${near ? '' : ', 1 energy'}.`
        : `${who}, ${e.hp} HP. Out of range or out of sight.`;
    } else if (G.walkable(s, hover.x, hover.y)) {
      view.hoverPath = G.findPath(s, s.player, hover) ?? [];
      view.reach = s.player.ap;
      if (view.hoverPath.length) hint = `Move ${view.hoverPath.length} tile${view.hoverPath.length > 1 ? 's' : ''} (${Math.min(view.hoverPath.length, s.player.ap)} AP this turn).`;
    } else if (view.pick.some((p) => p.x === hover!.x && p.y === hover!.y)) {
      hint = `Living hepatocyte. Strip its mitochondria: +${CONFIG.energy.strip.gain} energy, host -${CONFIG.energy.strip.hostDamage}, alert +${CONFIG.energy.strip.alert}.`;
    } else if (s.tiles[hover.y]?.[hover.x] === 'cell') hint = 'Hepatocyte. Stand next to it to strip its mitochondria.';
  }
  if (!hint && playing) {
    if (s.player.ap === 0) hint = 'Out of action points. End your turn.';
    else if (G.canLeave(s)) hint = 'You have the energy. Ride the central vein out.';
    else if (G.glucoseHere(s)) hint = 'Glucose runs rich here. Skim it.';
  }
  $('hint').textContent = hint || ' ';
  draw(ctx, s, view);
  panel(playing);
}

function meter(id: string, value: number, max: number, text: string) {
  $(id + '-bar').style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  $(id + '-val').textContent = text;
}

function panel(playing: boolean) {
  const p = s.player;
  meter('hp', p.hp, CONFIG.player.maxHp, `${Math.max(0, p.hp)} / ${CONFIG.player.maxHp}`);
  meter('ap', p.ap, CONFIG.player.ap, `${p.ap} / ${CONFIG.player.ap}`);
  meter('energy', p.energy, CONFIG.energy.quota, `${p.energy} / ${CONFIG.energy.quota}`);
  meter('host', s.hostHealth, CONFIG.host.maxHealth, `${s.hostHealth}%`);
  meter('alert', s.alert, CONFIG.alert.max, G.alertTier(s).name);
  $('alert').dataset.tier = String(CONFIG.alert.tiers.findIndex((t) => t.name === G.alertTier(s).name));
  $('turn').textContent = `Turn ${s.turn}`;

  $<HTMLButtonElement>('skim').disabled = !playing || !G.canSkim(s);
  const strip = $<HTMLButtonElement>('strip');
  strip.disabled = !playing || view.pick.length === 0;
  strip.textContent = picked ? 'Confirm strip (M)' : 'Strip mitochondria (M)';
  $<HTMLButtonElement>('end').disabled = !playing;
  $<HTMLButtonElement>('leave').hidden = !(playing && G.canLeave(s));

  const log = $('log');
  log.replaceChildren(...s.log.slice(-9).map((line) => Object.assign(document.createElement('li'), { textContent: line })));
  log.scrollTop = log.scrollHeight;

  const over = $('over');
  over.hidden = s.status === 'playing';
  if (s.status !== 'playing') {
    $('over-title').textContent = s.status === 'won' ? 'You made it out of the liver' : 'The liver cleared you';
    const verdict = s.cellsKilled === 0 ? 'The host never felt a thing.'
      : s.cellsKilled <= 2 ? 'The host will have a rough afternoon.' : 'The host is going to need a doctor.';
    $('over-body').textContent =
      `${s.turn} turns. Host health ${s.hostHealth}%. ${s.cellsKilled} hepatocyte${s.cellsKilled === 1 ? '' : 's'} killed, ` +
      `${s.kills} immune cell${s.kills === 1 ? '' : 's'} destroyed. ${s.status === 'won' ? verdict : ''}`;
  }
}

// ---------- actions ----------

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function walk(path: G.Point[]) {
  busy = true;
  for (const p of path) {
    if (!G.step(s, p.x - s.player.x, p.y - s.player.y)) break;
    draw(ctx, s, { ...view, hoverPath: [], pick: [] });
    await wait(45);
  }
  busy = false;
  refresh();
}

async function endTurn() {
  if (busy || s.status !== 'playing') return;
  busy = true;
  picked = null;
  const before = new Map(s.enemies.map((e) => [e.id, { x: e.x, y: e.y }]));
  G.endTurn(s);
  // Slide every immune cell from where it was to where it ended up, so you can read the turn.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = reduce ? 0 : 10;
  for (let f = 1; f <= frames; f++) {
    view.tween = new Map(s.enemies.map((e) => {
      const b = before.get(e.id) ?? e, t = f / frames;
      return [e.id, { x: b.x + (e.x - b.x) * t, y: b.y + (e.y - b.y) * t }];
    }));
    draw(ctx, s, { ...view, hoverPath: [], pick: [] });
    await wait(22);
  }
  view.tween = new Map();
  busy = false;
  refresh();
}

function stripAction() {
  if (busy) return;
  const options = G.strippable(s);
  if (!options.length) return;
  if (!picked) {
    // First press chooses a cell, second press does it: this is the one choice worth a pause.
    picked = options[0];
  } else {
    G.strip(s, picked.x, picked.y);
    picked = null;
  }
  refresh();
}

function act(fn: () => unknown) {
  if (busy || s.status !== 'playing') return;
  fn();
  refresh();
}

function tileAt(ev: MouseEvent): G.Point {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor(((ev.clientX - r.left) / r.width) * s.width), y: Math.floor(((ev.clientY - r.top) / r.height) * s.height) };
}

canvas.addEventListener('mousemove', (ev) => { hover = tileAt(ev); if (!busy) refresh(); });
canvas.addEventListener('mouseleave', () => { hover = null; if (!busy) refresh(); });
canvas.addEventListener('click', (ev) => {
  if (busy || s.status !== 'playing') return;
  const t = tileAt(ev);
  hover = t;
  const e = G.enemyAt(s, t.x, t.y);
  if (e) return act(() => G.attack(s, e.id));
  if (G.strippable(s).some((p) => p.x === t.x && p.y === t.y)) {
    if (picked && picked.x === t.x && picked.y === t.y) return stripAction();
    picked = t;
    return refresh();
  }
  picked = null;
  const path = G.findPath(s, s.player, t);
  if (path?.length) void walk(path.slice(0, s.player.ap));
  else refresh();
});

$('skim').addEventListener('click', () => act(() => G.skim(s)));
$('strip').addEventListener('click', stripAction);
$('end').addEventListener('click', () => void endTurn());
$('leave').addEventListener('click', () => act(() => G.leave(s)));
$('again').addEventListener('click', () => { s = G.createGame(); picked = null; hover = null; refresh(); });

const MOVES: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};
window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (MOVES[k]) { ev.preventDefault(); picked = null; act(() => G.step(s, ...MOVES[k])); }
  else if (k === ' ' || k === 'Enter') { ev.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); void endTurn(); }
  else if (k === 'g') act(() => G.skim(s));
  else if (k === 'm') stripAction();
  else if (k === 'Tab' && picked) {
    ev.preventDefault();
    const o = G.strippable(s);
    picked = o[(o.findIndex((p) => p.x === picked!.x && p.y === picked!.y) + 1) % o.length];
    refresh();
  } else if (k === 'Escape') { picked = null; refresh(); }
  else if (k === 'v') act(() => G.leave(s));
});

// Lets a script (or a curious player) poke at the live game from the console.
(window as unknown as { insiderim: unknown }).insiderim = { get state() { return s; }, G, CONFIG, refresh };

sizeCanvas();
refresh();
document.fonts?.ready.then(refresh);
