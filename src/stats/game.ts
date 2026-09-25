import type { DotId, FaceoffResult, GameEvent, ShotResult, Strength, Zone } from '../domain/types';
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
  /** Our goalies: shots aimed at a defended net only (empty-net shots and CSC are left out). */
  ourSavePct: number | null;
  /** Their goalie, same rule. */
  oppSavePct: number | null;
  shootingPct: number | null;
  faceoffs: WinLoss;
  faceoffsByZone: Record<Zone, WinLoss>;
}
export interface StrengthLine {
  shotsFor: ShotLevels;
  shotsAgainst: ShotLevels;
}
export interface ShootoutSummary {
  us: { goals: number; attempts: number };
  them: { goals: number; attempts: number };
}
export interface GameStats {
  p1: PeriodStats;
  p2: PeriodStats;
  /** Overtime. */
  p3: PeriodStats;
  hasOvertime: boolean;
  total: PeriodStats;
  /** Goals (empty net, penalty shots and overtime included) + own goals. Shootouts do not count. */
  score: { us: number; them: number };
  ownGoals: { for: number; against: number };
  shootout: ShootoutSummary | null;
  byStrength: Record<Strength, StrengthLine>;
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
const results = (evs: GameEvent[]) => evs.map((e) => e.result as ShotResult);

export function periodStats(events: GameEvent[]): PeriodStats {
  const evs = live(events);
  const forShots = evs.filter((e) => e.kind === 'shot_for');
  const againstShots = evs.filter((e) => e.kind === 'shot_against');
  const f = shotLevels(results(forShots));
  const a = shotLevels(results(againstShots));
  // A goalie only faces shots aimed at a defended net.
  const fGoalie = shotLevels(results(forShots.filter((e) => !e.empty_net)));
  const aGoalie = shotLevels(results(againstShots.filter((e) => !e.empty_net)));
  const fo = evs.filter((e) => e.kind === 'faceoff' && e.dot !== null);
  const zone = (z: Zone) => winLoss(fo.filter((e) => dotZone(e.dot as DotId) === z).map((e) => e.result as FaceoffResult));
  return {
    shotsFor: f,
    shotsAgainst: a,
    ourSavePct: ratio(aGoalie.onGoal - aGoalie.goals, aGoalie.onGoal),
    oppSavePct: ratio(fGoalie.onGoal - fGoalie.goals, fGoalie.onGoal),
    shootingPct: ratio(f.goals, f.onGoal),
    faceoffs: winLoss(fo.map((e) => e.result as FaceoffResult)),
    faceoffsByZone: { off: zone('off'), neutral: zone('neutral'), def: zone('def') },
  };
}

function strengthLine(evs: GameEvent[], s: Strength): StrengthLine {
  const inS = evs.filter((e) => (e.strength ?? 'even') === s);
  return {
    shotsFor: shotLevels(results(inS.filter((e) => e.kind === 'shot_for'))),
    shotsAgainst: shotLevels(results(inS.filter((e) => e.kind === 'shot_against'))),
  };
}

function shootoutSummary(evs: GameEvent[]): ShootoutSummary | null {
  const mine = evs.filter((e) => e.kind === 'shootout_for');
  const theirs = evs.filter((e) => e.kind === 'shootout_against');
  if (mine.length + theirs.length === 0) return null;
  const goals = (l: GameEvent[]) => l.filter((e) => e.result === 'goal').length;
  return { us: { goals: goals(mine), attempts: mine.length }, them: { goals: goals(theirs), attempts: theirs.length } };
}

export function computeGameStats(events: GameEvent[]): GameStats {
  const evs = live(events);
  const total = periodStats(evs);
  const ownFor = evs.filter((e) => e.kind === 'own_goal_for').length;
  const ownAgainst = evs.filter((e) => e.kind === 'own_goal_against').length;
  return {
    p1: periodStats(evs.filter((e) => e.period === 1)),
    p2: periodStats(evs.filter((e) => e.period === 2)),
    p3: periodStats(evs.filter((e) => e.period === 3)),
    hasOvertime: evs.some((e) => e.period === 3),
    total,
    score: { us: total.shotsFor.goals + ownFor, them: total.shotsAgainst.goals + ownAgainst },
    ownGoals: { for: ownFor, against: ownAgainst },
    shootout: shootoutSummary(evs),
    byStrength: { even: strengthLine(evs, 'even'), pp: strengthLine(evs, 'pp'), pk: strengthLine(evs, 'pk') },
  };
}

export function faceoffsByDot(events: GameEvent[]): Record<DotId, WinLoss> {
  const fo = live(events).filter((e) => e.kind === 'faceoff');
  return Object.fromEntries(
    DOT_IDS.map((id) => [id, winLoss(fo.filter((e) => e.dot === id).map((e) => e.result as FaceoffResult))]),
  ) as Record<DotId, WinLoss>;
}
