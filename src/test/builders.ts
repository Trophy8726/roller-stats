import type { DotId, FaceoffResult, Game, GameEvent, Kind, OpenShotResult, ShotKind, ShotResult, StateKind, StateResult } from '../domain/types';

let seq = 0;
const at = () => new Date(Date.UTC(2026, 8, 24, 18, 0, ++seq)).toISOString();

function blank(kind: Kind, result: GameEvent['result'], opts: Partial<GameEvent>): GameEvent {
  return {
    id: `e${++seq}`, game_code: 'AB23', kind, period: 1, x: null, y: null, dot: null, result, device_role: 'all',
    recorded_at: at(), deleted_at: null, goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...opts,
  };
}

export function shotEv(kind: ShotKind, result: ShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, { x: 0.5, y: 0.5, ...opts });
}
export function faceoffEv(dot: DotId, result: FaceoffResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank('faceoff', result, { dot, ...opts });
}
export function penaltyEv(kind: ShotKind, result: OpenShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, { penalty_shot: true, ...opts });
}
export function ownGoalEv(kind: 'own_goal_for' | 'own_goal_against', opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, 'goal', opts);
}
export function shootoutEv(kind: 'shootout_for' | 'shootout_against', result: OpenShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, opts);
}
export function noteEv(text: string, opts: Partial<GameEvent> = {}): GameEvent {
  return blank('note', 'note', { note: text, ...opts });
}
export function stateEv(kind: StateKind, result: StateResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, opts);
}

export function gameFx(opts: Partial<Game> = {}): Game {
  return {
    code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true,
    venue: 'home', competition: 'championnat', sheet_side: null, overtime_possible: true, ...opts,
  };
}
