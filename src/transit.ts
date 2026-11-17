// The flight between two maps: a few seconds of being carried down a vessel. It covers the
// work of building the next map, and it is travel, not a menu. The drawing is art's
// (src/cinema/travel.ts); this keeps the signature main.ts calls. Nothing in it blinks: every
// change is eased, and with reduced motion it holds one still frame.
import { travel as fly } from './cinema/travel';

export type Way = 'artery' | 'vein' | 'portal' | 'airway';
export interface Frame { w: number; h: number; dpr: number; still: boolean; time: number; kick: number }

/** Draws the view down the vessel at `t` (0 at the start of the flight, 1 at the end). `w` and `h` are CSS pixels. */
export function travel(ctx: CanvasRenderingContext2D, way: Way, t: number, f: Frame) {
  // #transit fades itself in and out, so the flight draws no fade of its own
  fly(ctx, way, t, { w: Math.round(f.w * f.dpr), h: Math.round(f.h * f.dpr), dpr: f.dpr, still: f.still, time: f.time, kick: f.kick, edges: false });
}
