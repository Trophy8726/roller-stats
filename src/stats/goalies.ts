import { AGAINST_KINDS, type GameEvent } from '../domain/types';
import { ratio } from './game';

export interface GoalieLine {
  /** null: shots that no goalie was attached to ("Non renseigné"). */
  goalieId: string | null;
  name: string;
  /** Games where the goalie was in net (a shot faced or a change to him). */
  games: number;
  onGoal: number;
  saves: number;
  goalsAgainst: number;
  savePct: number | null;
  /** CSC against us while he was in net: shown apart, never in the save %. */
  ownGoals: number;
}

interface Acc {
  games: Set<string>;
  onGoal: number;
  saves: number;
  goalsAgainst: number;
  ownGoals: number;
}

/** Lines for one game or a whole season: our goalies only, empty-net shots and shootouts left out of the save %. */
export function computeGoalieStats(
  events: GameEvent[],
  names: ReadonlyMap<string, string>,
  labels: { unset: string; unknown: string },
): GoalieLine[] {
  const acc = new Map<string | null, Acc>();
  const get = (id: string | null) => {
    let a = acc.get(id);
    if (!a) {
      a = { games: new Set(), onGoal: 0, saves: 0, goalsAgainst: 0, ownGoals: 0 };
      acc.set(id, a);
    }
    return a;
  };
  for (const e of events) {
    if (e.deleted_at) continue;
    if (e.kind === 'state_our_goalie' && e.result === 'goalie') {
      get(e.goalie_id).games.add(e.game_code);
    } else if (e.kind === 'shot_against' && !e.empty_net) {
      const a = get(e.goalie_id ?? null);
      a.games.add(e.game_code);
      if (e.result === 'save') {
        a.onGoal++;
        a.saves++;
      } else if (e.result === 'goal') {
        a.onGoal++;
        a.goalsAgainst++;
      }
    } else if (e.kind === 'own_goal_against' && !e.empty_net) {
      const a = get(e.goalie_id ?? null);
      a.games.add(e.game_code);
      a.ownGoals++;
    }
  }
  const lines: GoalieLine[] = [];
  for (const [id, a] of acc) {
    // The "not set" line only exists when it has something to show.
    if (id === null && a.onGoal === 0 && a.ownGoals === 0) continue;
    lines.push({
      goalieId: id,
      name: id === null ? labels.unset : (names.get(id) ?? labels.unknown),
      games: a.games.size,
      onGoal: a.onGoal,
      saves: a.saves,
      goalsAgainst: a.goalsAgainst,
      savePct: ratio(a.saves, a.onGoal),
      ownGoals: a.ownGoals,
    });
  }
  return lines.sort((x, y) => (x.goalieId === null ? 1 : y.goalieId === null ? -1 : x.name.localeCompare(y.name, 'fr')));
}

/** Entries against us that a goalie can still be attached to (report's "Attribuer un gardien"). */
export function countUnassigned(events: GameEvent[]): number {
  return events.filter((e) => !e.deleted_at && AGAINST_KINDS.includes(e.kind) && !e.goalie_id && !e.empty_net).length;
}
