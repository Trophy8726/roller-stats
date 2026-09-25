import type { Competition, Game, GameEvent } from '../domain/types';
import { computeGameStats, periodStats, type GameStats, type PeriodStats, type ShotLevels } from './game';

export interface SeasonGameRow {
  game: Game;
  stats: GameStats;
  /** No live (non-deleted) events: an empty or test game, always left out of the season stats. */
  empty: boolean;
  /** Counted in the season totals, averages and combined map. */
  included: boolean;
}
export interface SeasonStats {
  /** Number of included games. */
  games: number;
  /** Every game, newest first, included or not. */
  rows: SeasonGameRow[];
  total: PeriodStats;
  avgFor: ShotLevels;
  avgAgainst: ShotLevels;
}

function average(l: ShotLevels, n: number): ShotLevels {
  if (n === 0) return { attempts: 0, unblocked: 0, onGoal: 0, goals: 0 };
  return { attempts: l.attempts / n, unblocked: l.unblocked / n, onGoal: l.onGoal / n, goals: l.goals / n };
}

export type CompetitionFilter = Competition | 'all';

/** `excluded`: codes of games the user unticked. Games with no live events are always excluded. `competition`: which games to look at (Championnat by default). */
export function computeSeasonStats(
  games: Game[],
  events: GameEvent[],
  excluded: ReadonlySet<string> = new Set(),
  competition: CompetitionFilter = 'championnat',
): SeasonStats {
  const shown = competition === 'all' ? games : games.filter((g) => (g.competition ?? 'championnat') === competition);
  const byCode = new Map<string, GameEvent[]>();
  for (const e of events) {
    if (e.deleted_at) continue;
    const list = byCode.get(e.game_code) ?? [];
    list.push(e);
    byCode.set(e.game_code, list);
  }
  const sorted = [...shown].sort((x, y) => y.game_date.localeCompare(x.game_date));
  const rows = sorted.map((game) => {
    const evs = byCode.get(game.code) ?? [];
    const empty = evs.length === 0;
    return { game, stats: computeGameStats(evs), empty, included: !empty && !excluded.has(game.code) };
  });
  const included = rows.filter((r) => r.included);
  const total = periodStats(included.flatMap((r) => byCode.get(r.game.code) ?? []));
  return {
    games: included.length,
    rows,
    total,
    avgFor: average(total.shotsFor, included.length),
    avgAgainst: average(total.shotsAgainst, included.length),
  };
}
