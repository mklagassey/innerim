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

  return { size: N, wall, vein, portals, start, glucose, kupffer, neutrophils, caches, patches, calms };
}
