import type { DotId, Point, Zone } from '../domain/types';

/** Faceoff dots in the normalized frame (our attack right, y=0 is the top board). */
export const DOTS: Record<DotId, Point> = {
  center: { x: 0.5, y: 0.5 },
  off_top: { x: 0.8, y: 0.27 },
  off_bottom: { x: 0.8, y: 0.73 },
  def_top: { x: 0.2, y: 0.27 },
  def_bottom: { x: 0.2, y: 0.73 },
};

export const DOT_IDS = Object.keys(DOTS) as DotId[];

export function dotZone(d: DotId): Zone {
  if (d === 'center') return 'neutral';
  return d.startsWith('off') ? 'off' : 'def';
}
