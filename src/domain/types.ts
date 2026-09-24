export type Period = 1 | 2;
export type Side = 'left' | 'right';
export type ShotKind = 'shot_for' | 'shot_against';
export type Kind = ShotKind | 'faceoff';
export type ShotResult = 'goal' | 'save' | 'missed' | 'blocked';
export type FaceoffResult = 'won' | 'lost';
export type EventResult = ShotResult | FaceoffResult;
export type DotId = 'center' | 'off_top' | 'off_bottom' | 'def_top' | 'def_bottom';
export type Zone = 'off' | 'neutral' | 'def';
export type Role = 'shots_for' | 'shots_against' | 'faceoffs' | 'all';

export const SHOT_RESULTS: readonly ShotResult[] = ['goal', 'save', 'missed', 'blocked'];
export const FACEOFF_RESULTS: readonly FaceoffResult[] = ['won', 'lost'];

export interface Point {
  x: number;
  y: number;
}

/** One row of the `events` table. Coordinates are normalized: our attack goes right. */
export interface GameEvent {
  id: string;
  game_code: string;
  kind: Kind;
  period: Period;
  x: number | null;
  y: number | null;
  dot: DotId | null;
  result: EventResult;
  device_role: Role;
  recorded_at: string;
  deleted_at: string | null;
}

export interface Game {
  code: string;
  team_name: string;
  opponent: string;
  game_date: string; // YYYY-MM-DD
  home: boolean;
  created_at?: string;
}
