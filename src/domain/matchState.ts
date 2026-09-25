import type { GameEvent, Kind, Strength } from './types';

export interface MatchState {
  /** Our goalie in net (null: none chosen yet, or the net is empty). */
  ourGoalieId: string | null;
  ourNetEmpty: boolean;
  theirNetEmpty: boolean;
  strength: Strength;
}

export const INITIAL_MATCH_STATE: MatchState = { ourGoalieId: null, ourNetEmpty: false, theirNetEmpty: false, strength: 'even' };

const STATE_KINDS: readonly Kind[] = ['state_our_goalie', 'state_their_net', 'state_strength'];

/** The current state: the last non-deleted change of each kind, in recording order. */
export function computeMatchState(events: GameEvent[]): MatchState {
  const changes = events
    .filter((e) => !e.deleted_at && STATE_KINDS.includes(e.kind))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || a.id.localeCompare(b.id));
  let s = INITIAL_MATCH_STATE;
  for (const e of changes) {
    if (e.kind === 'state_our_goalie') {
      s = e.result === 'empty' ? { ...s, ourGoalieId: null, ourNetEmpty: true } : { ...s, ourGoalieId: e.goalie_id, ourNetEmpty: false };
    } else if (e.kind === 'state_their_net') {
      s = { ...s, theirNetEmpty: e.result === 'empty' };
    } else {
      s = { ...s, strength: e.result as Strength };
    }
  }
  return s;
}
