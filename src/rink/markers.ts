import type { GameEvent } from '../domain/types';
import type { RinkMarker } from './Rink';

export type PeriodFilter = 'all' | 1 | 2;
export type SideFilter = 'for' | 'against' | 'both';

export function filterShotMarkers(events: GameEvent[], period: PeriodFilter, side: SideFilter): RinkMarker[] {
  return events
    .filter(
      (e) =>
        !e.deleted_at &&
        e.kind !== 'faceoff' &&
        e.x !== null &&
        e.y !== null &&
        (period === 'all' || e.period === period) &&
        (side === 'both' || (side === 'for' ? e.kind === 'shot_for' : e.kind === 'shot_against')),
    )
    .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result }));
}
