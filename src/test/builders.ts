import type { DotId, FaceoffResult, Game, GameEvent, ShotKind, ShotResult } from '../domain/types';

let seq = 0;
const at = () => new Date(Date.UTC(2026, 8, 24, 18, 0, ++seq)).toISOString();

export function shotEv(kind: ShotKind, result: ShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return { id: `e${++seq}`, game_code: 'AB23', kind, period: 1, x: 0.5, y: 0.5, dot: null, result, device_role: 'all', recorded_at: at(), deleted_at: null, ...opts };
}

export function faceoffEv(dot: DotId, result: FaceoffResult, opts: Partial<GameEvent> = {}): GameEvent {
  return { id: `e${++seq}`, game_code: 'AB23', kind: 'faceoff', period: 1, x: null, y: null, dot, result, device_role: 'all', recorded_at: at(), deleted_at: null, ...opts };
}

export function gameFx(opts: Partial<Game> = {}): Game {
  return { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true, ...opts };
}
