// Draws the liver as a stained tissue slide: pink hepatocytes with purple nuclei,
// pale sinusoids between them. Placeholder shapes only.
import { CONFIG } from './config';
import { State, Point, key } from './game';

export const TILE = 32;
const C = {
  slide: '#fbf1f5', cell: '#eaa0bd', cellEdge: '#d87fa4', nucleus: '#5a3391',
  dead: '#cfc3d3', deadBits: '#8d7f99', glucose: '#d9a400', blood: '#c2392f',
  vein: '#3f5fb5', player: '#0c8f8a', playerEdge: '#075e5b', neutrophil: '#b9a5e6',
  kupffer: '#c9862f', ink: '#2a1840', path: 'rgba(12,143,138,0.28)', pick: '#0c8f8a',
  danger: '#c2392f', white: '#ffffff',
};

export interface View {
  hoverPath: Point[];
  reach: number; // how many path tiles the player can afford
  pick: Point[]; // hepatocytes that can be stripped right now
  picked: Point | null;
  tween: Map<number, Point>; // enemy id -> drawn position while the world's turn animates
  targetId: number | null;
}

export function draw(ctx: CanvasRenderingContext2D, s: State, v: View) {
  const T = TILE;
  ctx.fillStyle = C.slide;
  ctx.fillRect(0, 0, s.width * T, s.height * T);

  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const t = s.tiles[y][x], px = x * T, py = y * T;
      if (t === 'cell') {
        ctx.fillStyle = C.cell;
        round(ctx, px + 1, py + 1, T - 2, T - 2, 7); ctx.fill();
        ctx.strokeStyle = C.cellEdge; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.nucleus;
        // Nuclei sit a little off-centre, differently in each cell, like real tissue.
        const ox = ((x * 7 + y * 3) % 5) - 2, oy = ((x * 5 + y * 11) % 5) - 2;
        dot(ctx, px + T / 2 + ox, py + T / 2 + oy, 5);
      } else if (t === 'dead') {
        ctx.fillStyle = C.dead;
        round(ctx, px + 2, py + 2, T - 4, T - 4, 7); ctx.fill();
        ctx.fillStyle = C.deadBits;
        for (let i = 0; i < 5; i++) dot(ctx, px + 7 + ((i * 11 + x * 3) % 18), py + 7 + ((i * 7 + y * 5) % 18), 1.6);
      } else if (t === 'portal' || t === 'vein') {
        ctx.strokeStyle = t === 'portal' ? C.blood : C.vein;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, T / 2 - 5, 0, Math.PI * 2); ctx.stroke();
        label(ctx, t === 'portal' ? 'P' : 'V', px + T / 2, py + T / 2, ctx.strokeStyle as string, 12);
      }
      const g = s.glucose.get(key(x, y));
      if (g !== undefined) {
        for (let i = 0; i < CONFIG.energy.patchMax; i++) {
          ctx.fillStyle = i < g ? C.glucose : 'rgba(217,164,0,0.18)';
          hex(ctx, px + 8 + i * 8, py + (i % 2 ? 21 : 11), 4.5);
        }
      }
    }
  }

  v.hoverPath.forEach((p, i) => {
    ctx.fillStyle = i < v.reach ? C.path : 'rgba(42,24,64,0.08)';
    ctx.fillRect(p.x * T + 4, p.y * T + 4, T - 8, T - 8);
  });
  for (const p of v.pick) {
    const on = v.picked && v.picked.x === p.x && v.picked.y === p.y;
    ctx.strokeStyle = on ? C.danger : C.pick;
    ctx.lineWidth = on ? 3 : 2;
    ctx.setLineDash(on ? [] : [4, 3]);
    round(ctx, p.x * T + 2, p.y * T + 2, T - 4, T - 4, 7); ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const e of s.enemies) {
    const at = v.tween.get(e.id) ?? e;
    const cx = at.x * T + T / 2, cy = at.y * T + T / 2;
    if (e.kind === 'neutrophil') {
      ctx.fillStyle = C.neutrophil; dot(ctx, cx, cy, 11);
      ctx.strokeStyle = C.nucleus; ctx.lineWidth = 1; ctx.stroke();
      // The three-lobed nucleus is how you tell a neutrophil on a real slide.
      ctx.fillStyle = C.nucleus;
      dot(ctx, cx - 4, cy + 2, 3.2); dot(ctx, cx, cy - 3, 3.2); dot(ctx, cx + 4, cy + 2, 3.2);
    } else {
      ctx.fillStyle = C.kupffer; star(ctx, cx, cy, 14, 9, 7); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = C.ink; dot(ctx, cx, cy, 4);
    }
    const max = CONFIG.enemies[e.kind].hp;
    ctx.fillStyle = 'rgba(42,24,64,0.25)'; ctx.fillRect(cx - 11, cy + 13, 22, 3);
    ctx.fillStyle = C.danger; ctx.fillRect(cx - 11, cy + 13, 22 * (e.hp / max), 3);
    if (e.mood !== 'patrol') label(ctx, e.mood === 'chase' ? '!' : '?', cx + 11, cy - 11, C.danger, 14);
    if (v.targetId === e.id) {
      ctx.strokeStyle = C.danger; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const px = s.player.x * T + T / 2, py = s.player.y * T + T / 2;
  ctx.fillStyle = C.player; round(ctx, px - 9, py - 9, 18, 18, 4); ctx.fill();
  ctx.strokeStyle = C.playerEdge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.white; dot(ctx, px, py, 3);
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function hex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) ctx.lineTo(x + r * Math.cos((Math.PI / 3) * i), y + r * Math.sin((Math.PI / 3) * i));
  ctx.closePath(); ctx.fill();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, r: number, n: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R, a = (Math.PI / n) * i;
    ctx.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
  }
  ctx.closePath();
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}
