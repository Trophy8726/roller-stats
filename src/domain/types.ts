export type Period = 1 | 2 | 3; // 3 = prolongation (extra time)
export type Side = 'left' | 'right';
export type ShotKind = 'shot_for' | 'shot_against';
export type OwnGoalKind = 'own_goal_for' | 'own_goal_against';
export type ShootoutKind = 'shootout_for' | 'shootout_against';
export type StateKind = 'state_our_goalie' | 'state_their_net' | 'state_strength';
export type Kind = ShotKind | 'faceoff' | OwnGoalKind | ShootoutKind | 'note' | StateKind;
export type ShotResult = 'goal' | 'save' | 'missed' | 'blocked';
/** A penalty shot or a shootout attempt is aimed at the goalie: it cannot be blocked. */
export type OpenShotResult = 'goal' | 'save' | 'missed';
export type FaceoffResult = 'won' | 'lost';
/** The results drawn as a coloured marker (Set2 colour + shape). */
export type MarkResult = ShotResult | FaceoffResult;
export type Strength = 'even' | 'pp' | 'pk';
export type StateResult = 'goalie' | 'empty' | 'present' | Strength;
export type EventResult = MarkResult | 'note' | StateResult;
export type DotId = 'center' | 'off_top' | 'off_bottom' | 'def_top' | 'def_bottom';
export type Zone = 'off' | 'neutral' | 'def';
export type Role = 'shots_for' | 'shots_against' | 'faceoffs' | 'all';
export type Competition = 'championnat' | 'coupe' | 'playoffs';
export type Venue = 'home' | 'away' | 'neutral';
export type SheetSide = 'home' | 'visitor';

export const SHOT_RESULTS: readonly ShotResult[] = ['goal', 'save', 'missed', 'blocked'];
export const OPEN_SHOT_RESULTS: readonly OpenShotResult[] = ['goal', 'save', 'missed'];
export const FACEOFF_RESULTS: readonly FaceoffResult[] = ['won', 'lost'];
/** Kinds aimed at our net: they belong to one of our goalies (unless the net was empty). */
export const AGAINST_KINDS: readonly Kind[] = ['shot_against', 'own_goal_against', 'shootout_against'];

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
  /** Our goalie in net when the event was recorded (kinds aimed at our net, and `state_our_goalie`). */
  goalie_id: string | null;
  /** The net the shot was aimed at was empty (ours for shots against, theirs for shots for). */
  empty_net: boolean;
  /** Numerical situation from our point of view when the event was recorded. */
  strength: Strength;
  penalty_shot: boolean;
  note: string | null;
}

export interface Game {
  code: string;
  team_name: string;
  opponent: string;
  game_date: string; // YYYY-MM-DD
  /** Kept for v1 compatibility: true only when `venue` is 'home'. */
  home: boolean;
  venue: Venue;
  competition: Competition;
  /** Neutral ground only: are we "domicile" or "visiteur" on the official match sheet. */
  sheet_side: SheetSide | null;
  overtime_possible: boolean;
  created_at?: string;
}

export interface Goalie {
  id: string;
  name: string;
  created_at?: string;
}
