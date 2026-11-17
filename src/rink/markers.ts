import type { GameEvent, MarkResult, Period } from '../domain/types';
import type { RinkMarker } from './Rink';

export type PeriodFilter = 'all' | Period;
export type SideFilter = 'for' | 'against' | 'both';
export type TurnoverFilter = 'lost' | 'recovered' | 'both';

export function filterShotMarkers(events: GameEvent[], period: PeriodFilter, side: SideFilter): RinkMarker[] {
  return events
    .filter(
      (e) =>
        !e.deleted_at &&
        (e.kind === 'shot_for' || e.kind === 'shot_against') &&
        e.x !== null &&
        e.y !== null &&
        (period === 'all' || e.period === period) &&
        (side === 'both' || (side === 'for' ? e.kind === 'shot_for' : e.kind === 'shot_against')),
    )
    .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result as MarkResult }));
}

export function filterTurnoverMarkers(events: GameEvent[], period: PeriodFilter, which: TurnoverFilter): RinkMarker[] {
  return events
    .filter(
      (e) =>
        !e.deleted_at &&
        e.kind === 'turnover' &&
        e.x !== null &&
        e.y !== null &&
        (period === 'all' || e.period === period) &&
        (which === 'both' || e.result === which),
    )
    .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result as MarkResult }));
}
