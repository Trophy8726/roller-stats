import type { Game, GameEvent } from '../domain/types';
import { computeGameStats, periodStats, type GameStats, type PeriodStats, type ShotLevels } from './game';

export interface SeasonGameRow {
  game: Game;
  stats: GameStats;
}
export interface SeasonStats {
  games: number;
  rows: SeasonGameRow[];
  total: PeriodStats;
  avgFor: ShotLevels;
  avgAgainst: ShotLevels;
}

function average(l: ShotLevels, n: number): ShotLevels {
  if (n === 0) return { attempts: 0, unblocked: 0, onGoal: 0, goals: 0 };
  return { attempts: l.attempts / n, unblocked: l.unblocked / n, onGoal: l.onGoal / n, goals: l.goals / n };
}

export function computeSeasonStats(games: Game[], events: GameEvent[]): SeasonStats {
  const byCode = new Map<string, GameEvent[]>();
  for (const e of events) {
    const list = byCode.get(e.game_code) ?? [];
    list.push(e);
    byCode.set(e.game_code, list);
  }
  const sorted = [...games].sort((x, y) => y.game_date.localeCompare(x.game_date));
  const rows = sorted.map((game) => ({ game, stats: computeGameStats(byCode.get(game.code) ?? []) }));
  const relevant = games.flatMap((g) => byCode.get(g.code) ?? []);
  const total = periodStats(relevant);
  return {
    games: games.length,
    rows,
    total,
    avgFor: average(total.shotsFor, games.length),
    avgAgainst: average(total.shotsAgainst, games.length),
  };
}
