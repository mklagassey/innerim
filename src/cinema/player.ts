// Plays shots on a canvas: one shot at a time, cross-dissolving into the next, with the film
// look over both. main.ts drives it from scenes.ts beats (see playScene).
import { Stage, Mode, finish, borrow, giveBack } from './core';
import { SHOTS, ShotDef, shotCam } from './shots';
import { SHOTS2, CARDS } from './shots2';
Object.assign(SHOTS, SHOTS2, CARDS);

export interface Frame { name: string; mode: Mode; t: number; p: number; still: boolean; caption?: string }

/** Draw one frame of one shot into ctx (w x h pixels). */
export function renderShot(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame) {
  const def: ShotDef | undefined = SHOTS[f.name];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  if (!def) { ctx.restore(); return; }
  const st = new Stage(ctx, w, h, f.mode, f.still);
  st.t = f.t; st.p = f.p;
  st.cam = shotCam(def, f.mode, f.still ? 0.5 : f.p);
  st.dof = f.mode === 'close' ? Math.max(0.8, def.dof ?? 0) : f.mode === 'footage' ? 0 : def.dof ?? 0;
  def.draw(st);
  finish(ctx, w, h, def.look, f.mode, f.t, f.still, f.mode === 'footage' ? (f.caption ?? def.burn) : undefined);
  ctx.restore();
}

export const shotLabel = (name: string) => SHOTS[name]?.label ?? '';
export const hasShot = (name: string) => name in SHOTS;

/**
 * A live player: `cue` a shot and it dissolves in over `fade` seconds from whatever was showing.
 * The canvas keeps its own animation frame loop while a scene is up.
 */
export class Cinema {
  private cur: { name: string; start: number; hold: number } | null = null;
  private prev: { name: string; start: number; hold: number } | null = null;
  private fadeStart = 0; private fade = 0.9;
  private raf = 0; private mode: Mode = 'eye'; private dpr = 1;
  constructor(public canvas: HTMLCanvasElement, public still = false) {}
  setMode(m: Mode) { this.mode = m; }
  size(cssW: number, cssH: number, dpr: number) {
    this.dpr = Math.min(2, dpr);
    const w = Math.round(cssW * this.dpr), h = Math.round(cssH * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.canvas.style.width = `${cssW}px`; this.canvas.style.height = `${cssH}px`;
  }
  cue(name: string, hold: number, fade = 0.9) {
    const now = performance.now() / 1000;
    this.prev = this.cur; this.cur = { name, start: now, hold }; this.fadeStart = now; this.fade = this.still ? 0 : fade;
    if (!this.raf) this.loop();
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.cur = this.prev = null; }
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const ctx = this.canvas.getContext('2d')!, w = this.canvas.width, h = this.canvas.height, now = performance.now() / 1000;
    if (!this.cur) return;
    const frame = (s: { name: string; start: number; hold: number }) => {
      const t = now - s.start;
      return { name: s.name, mode: this.mode, t, p: Math.min(1, t / (s.hold + this.fade)), still: this.still };
    };
    const a = this.fade > 0 ? Math.min(1, (now - this.fadeStart) / this.fade) : 1;
    if (this.prev && a < 1) {
      const off = borrow(w, h), og = off.getContext('2d')!;
      renderShot(og, w, h, frame(this.prev));
      renderShot(ctx, w, h, frame(this.cur));
      ctx.save(); ctx.globalAlpha = 1 - a; ctx.drawImage(off, 0, 0); ctx.restore();
      giveBack(off);
    } else renderShot(ctx, w, h, frame(this.cur));
  };
}
