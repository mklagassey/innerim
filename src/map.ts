// Grows a stretch of liver tissue: a tangle of blood-filled sinusoids between plates of
// hepatocytes, portal vessels around the outside and one central vein draining the middle.
import { CONFIG } from './config';

export interface Point { x: number; y: number }
export interface Layout {
  size: number;
  wall: Uint8Array; // 1 = hepatocyte
  vein: Point;
  portals: Point[];
  start: Point;
  glucose: Point[];
  kupffer: Point[];
  neutrophils: Point[];
  caches: Point[];
  patches: Point[];
  calms: Point[];
  acid?: Uint8Array; // stomach only: 1 = mucus, 2 = open acid
  rich?: Point[]; // stomach only: parietal cells worth stripping
  tumor?: Point[]; // liver only: a nodule of tumor cells
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generate(seed: number): Layout {
  const rng = mulberry32(seed);
  const N = CONFIG.map.size, c = CONFIG.map;
  const wall = new Uint8Array(N * N).fill(1); // solid tissue until blood finds a way through
  const clear = (cx: number, cy: number, r: number) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 2 && y >= 2 && x < N - 2 && y < N - 2 && Math.hypot(x - cx, y - cy) <= r + 0.3) wall[y * N + x] = 0;
  };
  const mid = Math.floor(N / 2);
  const vein = { x: mid, y: mid };
  clear(mid, mid, 2);
  // Sinusoids run inward from the edge of the lobule and converge on the central vein,
  // wandering between plates of hepatocytes on the way.
  const channel = (fx: number, fy: number) => {
    let x = fx, y = fy;
    while (Math.hypot(x - mid, y - mid) > 2) {
      const toward = rng() < c.pull;
      const horizontal = toward ? Math.abs(mid - x) > Math.abs(mid - y) === rng() < 0.75 : rng() < 0.5;
      const dir = toward ? 1 : rng() < 0.5 ? 1 : -1;
      if (horizontal) x += dir * Math.sign(mid - x || 1);
      else y += dir * Math.sign(mid - y || 1);
      x = Math.max(3, Math.min(N - 4, x));
      y = Math.max(3, Math.min(N - 4, y));
      wall[y * N + x] = 0;
      if (rng() < c.pools) clear(x, y, 1); // the odd wider pool
    }
  };
  const portals: Point[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (30 + 60 * k);
    const p = { x: Math.round(mid + Math.cos(a) * c.portalRing), y: Math.round(mid + Math.sin(a) * c.portalRing) };
    portals.push(p);
    clear(p.x, p.y, 2);
    channel(p.x, p.y);
  }
  for (let k = 0; k < c.channels; k++) {
    // Start anywhere in the lobule, favouring the outer tissue so the map fills out.
    const fx = 4 + Math.floor(rng() * (N - 8)), fy = 4 + Math.floor(rng() * (N - 8));
    if (Math.hypot(fx - mid, fy - mid) < 16) { k--; continue; }
    channel(fx, fy);
  }

  // Wall off any pocket the blood cannot reach.
  const reached = new Uint8Array(N * N);
  const queue = [vein];
  reached[vein.y * N + vein.x] = 1;
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy, i = y * N + x;
      if (!wall[i] && !reached[i]) { reached[i] = 1; queue.push({ x, y }); }
    }
  }
  for (let i = 0; i < N * N; i++) if (!reached[i]) wall[i] = 1;

  const start = portals[Math.floor(rng() * portals.length)];
  const far = (p: Point, q: Point, d: number) => Math.hypot(p.x - q.x, p.y - q.y) >= d;
  const pick = (ok: (p: Point) => boolean): Point => {
    for (let tries = 0; tries < 4000; tries++) {
      const p = { x: 2 + Math.floor(rng() * (N - 4)), y: 2 + Math.floor(rng() * (N - 4)) };
      if (!wall[p.y * N + p.x] && (ok(p) || tries > 3000)) return p;
    }
    return { ...vein };
  };
  const glucose: Point[] = [];
  for (let i = 0; i < c.glucosePatches; i++)
    glucose.push(pick((p) => far(p, start, 7) && far(p, vein, 6) && glucose.every((g) => far(p, g, 9))));
  const kupffer: Point[] = [pick((p) => !far(p, vein, 7) && far(p, vein, 4))];
  for (let i = 1; i < c.kupffer; i++) kupffer.push(pick((p) => far(p, start, 14) && kupffer.every((k) => far(p, k, 12))));
  const neutrophils: Point[] = [];
  for (let i = 0; i < c.neutrophils; i++) neutrophils.push(pick((p) => far(p, start, 16)));

  const caches: Point[] = [];
  for (let i = 0; i < CONFIG.items.caches; i++)
    caches.push(pick((p) => far(p, start, i === 0 ? 4 : 10) && (i > 0 || !far(p, start, 9)) && far(p, vein, 5) && caches.every((q) => far(p, q, 10))));
  const patches: Point[] = [];
  for (let i = 0; i < CONFIG.items.patches; i++) patches.push(pick((p) => far(p, start, 8) && patches.every((q) => far(p, q, 12))));
  const calms: Point[] = [];
  for (let i = 0; i < CONFIG.items.calms; i++) calms.push(pick((p) => far(p, start, 12) && calms.every((q) => far(p, q, 16))));

  // A tumor nodule: a knot of cells in the wall of some channel well away from the way in and the way out.
  const tumor: Point[] = [];
  for (let tries = 0; tries < 60 && !tumor.length; tries++) {
    const by = pick((p) => far(p, start, 18) && far(p, vein, 9));
    const seedTile = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: by.x + dx, y: by.y + dy })).find((p) => wall[p.y * N + p.x] && p.x > 5 && p.y > 5 && p.x < N - 6 && p.y < N - 6);
    if (!seedTile) continue;
    const grown = [seedTile];
    for (let k = 0; k < grown.length && grown.length < CONFIG.tumor.cells; k++)
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const p = { x: grown[k].x + dx, y: grown[k].y + dy };
        if (grown.length < CONFIG.tumor.cells && wall[p.y * N + p.x] && !far(p, seedTile, 2.3) && grown.every((q) => q.x !== p.x || q.y !== p.y)) grown.push(p);
      }
    if (grown.length >= CONFIG.tumor.cells - 2) tumor.push(...grown);
  }

  return { size: N, wall, vein, portals, start, glucose, kupffer, neutrophils, caches, patches, calms, tumor };
}

/** A stretch of blood vessel for an encounter on the road: a winding tube that runs one way,
 *  from where the current carries you in (start) to where it carries you on (vein), with a
 *  few dead-end side branches to duck into and a patrol working the middle of it. */
export function generateVessel(seed: number, patrol: number): Layout {
  const rng = mulberry32(seed);
  const N = CONFIG.map.size, mid = Math.floor(N / 2);
  const wall = new Uint8Array(N * N).fill(1);
  const clear = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (x >= 2 && y >= 2 && x < N - 2 && y < N - 2 && Math.hypot(x - cx, y - cy) <= r + 0.3) wall[y * N + x] = 0;
  };
  const from = 8, to = N - 9, p1 = rng() * 6.28, p2 = rng() * 6.28, sway = 4 + rng() * 3;
  const cy = (x: number) => Math.round(mid + sway * Math.sin(x / 9 + p1) + 2.5 * Math.sin(x / 4 + p2));
  for (let x = from; x <= to; x++) clear(x, cy(x), 1.7 + 0.9 * (0.5 + 0.5 * Math.sin(x / 5 + p2)));
  clear(from, cy(from), 2.4); clear(to, cy(to), 2.4);

  // Dead-end side branches: out of the main current, so your scent stays put in them.
  const nooks: Point[] = [];
  for (let k = 0; k < 4; k++) {
    const x0 = from + 10 + Math.floor(((to - from - 20) * (k + rng() * 0.7)) / 4), dir = rng() < 0.5 ? 1 : -1, len = 6 + Math.floor(rng() * 4);
    let x = x0, y = cy(x0);
    for (let i = 0; i < len; i++) { y += dir; clear(x, y, 0.6); if (rng() < 0.35) x -= 1; clear(x, y, i === len - 1 ? 1.2 : 0.6); } // cleared before and after each sidestep, so a branch never closes to a corner the ship cannot pass
    nooks.push({ x, y });
  }
  // Clumps of stacked red cells stand in the stream here and there; the blood parts round them.
  for (let k = 0; k < 5; k++) {
    const x = from + 8 + Math.floor(rng() * (to - from - 16)), y = cy(x);
    if (!wall[(y - 2) * N + x] && !wall[(y + 2) * N + x]) { wall[y * N + x] = 1; if (rng() < 0.5) wall[y * N + x + 1] = 1; }
  }
  const start = { x: from, y: cy(from) }, vein = { x: to, y: cy(to) };
  wall[start.y * N + start.x] = 0; wall[vein.y * N + vein.x] = 0;

  const open = (p: Point) => !wall[p.y * N + p.x];
  const neutrophils: Point[] = [];
  for (let tries = 0; neutrophils.length < patrol && tries < 400; tries++) {
    const x = Math.floor(from + (to - from) * (0.45 + rng() * 0.35)), p = { x, y: cy(x) + Math.floor(rng() * 3) - 1 };
    if (open(p) && neutrophils.every((q) => q.x !== p.x || q.y !== p.y)) neutrophils.push(p);
  }
  return { size: N, wall, vein, portals: [start], start, glucose: nooks.slice(0, 3), kupffer: [], neutrophils, caches: [], patches: nooks.slice(3, 4), calms: [] };
}

/** A patch of stomach lining: a wide lake of acid, a rim of mucus round its shore, and narrow
 *  gastric glands winding off into the wall. You come in down one gland and leave by another
 *  on the far side, so the lake is always in the way. */
export function generateStomach(seed: number): Layout {
  const rng = mulberry32(seed);
  const N = CONFIG.map.size, mid = Math.floor(N / 2);
  const wall = new Uint8Array(N * N).fill(1), lake = new Uint8Array(N * N);
  const at = (x: number, y: number) => y * N + x;
  const p1 = rng() * 6.28, p2 = rng() * 6.28;
  const shore = (a: number) => 1 + 0.16 * Math.sin(a * 3 + p1) + 0.1 * Math.sin(a * 5 + p2);
  for (let y = 3; y < N - 3; y++)
    for (let x = 3; x < N - 3; x++) {
      const dx = (x - mid) / 15, dy = (y - mid) / 10, a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) <= shore(a)) { wall[at(x, y)] = 0; lake[at(x, y)] = 1; }
    }
  // Glands: narrow, winding, each ending in a small chamber.
  const glands: Point[] = [], count = 10, turn = rng() * 6.28;
  for (let k = 0; k < count; k++) {
    const a = turn + (k / count) * Math.PI * 2 + (rng() - 0.5) * 0.25, len = 9 + Math.floor(rng() * 6);
    let x = mid + Math.cos(a) * 15 * shore(a) * 0.9, y = mid + Math.sin(a) * 10 * shore(a) * 0.9, bend = a;
    for (let i = 0; i < len + 6; i++) {
      bend += (rng() - 0.5) * 0.5 + (a - bend) * 0.3;
      x += Math.cos(bend); y += Math.sin(bend);
      const tx = Math.max(4, Math.min(N - 5, Math.round(x))), ty = Math.max(4, Math.min(N - 5, Math.round(y)));
      wall[at(tx, ty)] = 0; wall[at(tx + 1, ty)] = 0; // two wide, so nothing gets stuck on a diagonal
    }
    const g = { x: Math.max(5, Math.min(N - 6, Math.round(x))), y: Math.max(5, Math.min(N - 6, Math.round(y))) };
    for (let yy = g.y - 2; yy <= g.y + 2; yy++) for (let xx = g.x - 2; xx <= g.x + 2; xx++) if (Math.hypot(xx - g.x, yy - g.y) <= 1.8) wall[at(xx, yy)] = 0;
    glands.push(g);
  }
  // Acid fills the lake. Where it meets the wall, mucus keeps it off the cells (and off you).
  const acid = new Uint8Array(N * N);
  for (let y = 3; y < N - 3; y++)
    for (let x = 3; x < N - 3; x++) {
      if (!lake[at(x, y)]) continue;
      let rim = false;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (!lake[at(xx, yy)]) rim = true;
      acid[at(x, y)] = rim ? 1 : 2;
    }
  // In by one gland, out by the one most nearly opposite.
  const start = glands[0];
  const vein = glands.slice(1).sort((a, b) => Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(a.x - start.x, a.y - start.y))[0];
  const rest = glands.filter((g) => g !== start && g !== vein);
  // Parietal cells line the glands.
  const rich: Point[] = [];
  for (const g of rest) {
    const ring: Point[] = [];
    for (let yy = g.y - 3; yy <= g.y + 3; yy++) for (let xx = g.x - 3; xx <= g.x + 3; xx++) {
      if (!wall[at(xx, yy)] || xx < 3 || yy < 3 || xx > N - 4 || yy > N - 4) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !wall[at(xx + dx, yy + dy)])) ring.push({ x: xx, y: yy });
    }
    for (let i = 0; i < 2 && ring.length; i++) rich.push(ring.splice(Math.floor(rng() * ring.length), 1)[0]);
  }
  const open: Point[] = [];
  for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) if (acid[at(x, y)] === 2) open.push({ x, y });
  const glucose: Point[] = [];
  // Half the last meal has washed up on the mucus rim, where it is safe to feed. The rest is afloat in the acid.
  const rim: Point[] = [];
  for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) if (acid[at(x, y)] === 1 && !wall[at(x, y)]) rim.push({ x, y });
  for (let tries = 0; glucose.length < 2 && tries < 500 && rim.length; tries++) {
    const p = rim[Math.floor(rng() * rim.length)];
    if (glucose.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 9)) glucose.push(p);
  }
  for (let tries = 0; glucose.length < 4 && tries < 500; tries++) {
    const p = open[Math.floor(rng() * open.length)];
    if (glucose.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 7)) glucose.push(p); // the host's last meal, afloat in the acid
  }
  const neutrophils = rest.slice(0, CONFIG.stomach.neutrophils);
  return { size: N, wall, vein, portals: [start], start, glucose, kupffer: [], neutrophils, caches: rest.slice(4, 7), patches: rest.slice(7, 8), calms: [], acid, rich };
}
