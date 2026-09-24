import type { DotId, FaceoffResult, GameEvent, ShotResult, Zone } from '../domain/types';
import { DOT_IDS, dotZone } from '../rink/dots';

export interface ShotLevels {
  attempts: number;
  unblocked: number;
  onGoal: number;
  goals: number;
}
export interface WinLoss {
  won: number;
  lost: number;
  pct: number | null;
}
export interface PeriodStats {
  shotsFor: ShotLevels;
  shotsAgainst: ShotLevels;
  ourSavePct: number | null;
  oppSavePct: number | null;
  shootingPct: number | null;
  faceoffs: WinLoss;
  faceoffsByZone: Record<Zone, WinLoss>;
}
export interface GameStats {
  p1: PeriodStats;
  p2: PeriodStats;
  total: PeriodStats;
  score: { us: number; them: number };
}

export const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export function shotLevels(results: ShotResult[]): ShotLevels {
  const count = (r: ShotResult) => results.filter((x) => x === r).length;
  const goals = count('goal');
  const saves = count('save');
  const missed = count('missed');
  const blocked = count('blocked');
  return { attempts: goals + saves + missed + blocked, unblocked: goals + saves + missed, onGoal: goals + saves, goals };
}

function winLoss(results: FaceoffResult[]): WinLoss {
  const won = results.filter((r) => r === 'won').length;
  const lost = results.length - won;
  return { won, lost, pct: ratio(won, won + lost) };
}

const live = (events: GameEvent[]) => events.filter((e) => !e.deleted_at);

export function periodStats(events: GameEvent[]): PeriodStats {
  const evs = live(events);
  const shots = (k: GameEvent['kind']) => evs.filter((e) => e.kind === k).map((e) => e.result as ShotResult);
  const f = shotLevels(shots('shot_for'));
  const a = shotLevels(shots('shot_against'));
  const fo = evs.filter((e) => e.kind === 'faceoff' && e.dot !== null);
  const zone = (z: Zone) => winLoss(fo.filter((e) => dotZone(e.dot as DotId) === z).map((e) => e.result as FaceoffResult));
  return {
    shotsFor: f,
    shotsAgainst: a,
    ourSavePct: ratio(a.onGoal - a.goals, a.onGoal),
    oppSavePct: ratio(f.onGoal - f.goals, f.onGoal),
    shootingPct: ratio(f.goals, f.onGoal),
    faceoffs: winLoss(fo.map((e) => e.result as FaceoffResult)),
    faceoffsByZone: { off: zone('off'), neutral: zone('neutral'), def: zone('def') },
  };
}

export function computeGameStats(events: GameEvent[]): GameStats {
  const total = periodStats(events);
  return {
    p1: periodStats(events.filter((e) => e.period === 1)),
    p2: periodStats(events.filter((e) => e.period === 2)),
    total,
    score: { us: total.shotsFor.goals, them: total.shotsAgainst.goals },
  };
}

export function faceoffsByDot(events: GameEvent[]): Record<DotId, WinLoss> {
  const fo = live(events).filter((e) => e.kind === 'faceoff');
  return Object.fromEntries(
    DOT_IDS.map((id) => [id, winLoss(fo.filter((e) => e.dot === id).map((e) => e.result as FaceoffResult))]),
  ) as Record<DotId, WinLoss>;
}
