import type { Period, Point, Side } from '../domain/types';

/** True when, on this device and in this period, our team attacks toward the right of the screen. */
export function attacksRight(defendP1: Side, period: Period): boolean {
  const p1 = defendP1 === 'left';
  return period === 1 ? p1 : !p1;
}

/** Converts screen ↔ normalized (our attack right). A 180° rotation; applying it twice is a no-op. */
export function orient(p: Point, attackRight: boolean): Point {
  return attackRight ? { x: p.x, y: p.y } : { x: 1 - p.x, y: 1 - p.y };
}

/** Team name shown on each end: the team defending that end. */
export function endLabels(us: string, them: string, attackRight: boolean): { left: string; right: string } {
  return attackRight ? { left: us, right: them } : { left: them, right: us };
}
