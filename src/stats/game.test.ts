import { faceoffEv, noteEv, ownGoalEv, penaltyEv, shootoutEv, shotEv, stateEv } from '../test/builders';
import { computeGameStats, faceoffsByDot } from './game';

describe('computeGameStats', () => {
  it('counts the four shot levels', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal'), shotEv('shot_for', 'save'), shotEv('shot_for', 'save'),
      shotEv('shot_for', 'missed'), shotEv('shot_for', 'blocked'),
    ]);
    expect(s.total.shotsFor).toEqual({ attempts: 5, unblocked: 4, onGoal: 3, goals: 1 });
  });

  it('computes both save percentages, shooting % and the score', () => {
    const s = computeGameStats([
      shotEv('shot_against', 'save'), shotEv('shot_against', 'save'), shotEv('shot_against', 'save'),
      shotEv('shot_against', 'goal'), shotEv('shot_for', 'goal'), shotEv('shot_for', 'save'),
    ]);
    expect(s.total.ourSavePct).toBeCloseTo(0.75);
    expect(s.total.oppSavePct).toBeCloseTo(0.5);
    expect(s.total.shootingPct).toBeCloseTo(0.5);
    expect(s.score).toEqual({ us: 1, them: 1 });
  });

  it('returns null percentages when nothing can be divided', () => {
    const s = computeGameStats([]);
    expect(s.total.ourSavePct).toBeNull();
    expect(s.total.shootingPct).toBeNull();
    expect(s.total.faceoffs.pct).toBeNull();
  });

  it('splits by period', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal', { period: 1 }),
      shotEv('shot_for', 'goal', { period: 2 }),
      shotEv('shot_for', 'save', { period: 2 }),
    ]);
    expect(s.p1.shotsFor.goals).toBe(1);
    expect(s.p2.shotsFor.onGoal).toBe(2);
    expect(s.total.shotsFor.onGoal).toBe(3);
  });

  it('ignores soft-deleted events', () => {
    expect(computeGameStats([shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T18:10:00Z' })]).score.us).toBe(0);
  });

  it('computes faceoff % overall and per zone', () => {
    const s = computeGameStats([
      faceoffEv('off_top', 'won'), faceoffEv('off_bottom', 'lost'),
      faceoffEv('center', 'won'), faceoffEv('def_top', 'won'),
    ]);
    expect(s.total.faceoffs).toEqual({ won: 3, lost: 1, pct: 0.75 });
    expect(s.total.faceoffsByZone.off).toEqual({ won: 1, lost: 1, pct: 0.5 });
    expect(s.total.faceoffsByZone.neutral.pct).toBe(1);
    expect(s.total.faceoffsByZone.def.won).toBe(1);
  });
});

describe('faceoffsByDot', () => {
  it('counts per dot, null % for unused dots', () => {
    const d = faceoffsByDot([faceoffEv('center', 'won'), faceoffEv('center', 'lost')]);
    expect(d.center).toEqual({ won: 1, lost: 1, pct: 0.5 });
    expect(d.off_top.pct).toBeNull();
  });
});

describe('v2 rules', () => {
  it('keeps empty-net shots in the team stats but out of the goalie save %', () => {
    const s = computeGameStats([
      shotEv('shot_against', 'save'), shotEv('shot_against', 'goal'), shotEv('shot_against', 'goal', { empty_net: true }),
      shotEv('shot_for', 'goal', { empty_net: true }), shotEv('shot_for', 'save'), shotEv('shot_for', 'goal'),
    ]);
    expect(s.total.shotsAgainst).toEqual({ attempts: 3, unblocked: 3, onGoal: 3, goals: 2 });
    expect(s.total.ourSavePct).toBeCloseTo(0.5); // 1 save on 2 shots at a defended net
    expect(s.total.oppSavePct).toBeCloseTo(0.5);
    expect(s.total.shootingPct).toBeCloseTo(2 / 3);
    expect(s.score).toEqual({ us: 2, them: 2 });
  });

  it('counts own goals in the score only', () => {
    const s = computeGameStats([shotEv('shot_for', 'goal'), ownGoalEv('own_goal_for'), ownGoalEv('own_goal_against'), ownGoalEv('own_goal_against')]);
    expect(s.score).toEqual({ us: 2, them: 2 });
    expect(s.ownGoals).toEqual({ for: 1, against: 2 });
    expect(s.total.shotsFor.attempts).toBe(1);
    expect(s.total.shotsAgainst.attempts).toBe(0);
    expect(s.total.ourSavePct).toBeNull();
  });

  it('counts penalty shots as ordinary shots', () => {
    const s = computeGameStats([penaltyEv('shot_for', 'goal'), penaltyEv('shot_against', 'save')]);
    expect(s.total.shotsFor).toEqual({ attempts: 1, unblocked: 1, onGoal: 1, goals: 1 });
    expect(s.total.ourSavePct).toBe(1);
  });

  it('keeps shootouts out of shots and score and summarizes them', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal'),
      shootoutEv('shootout_for', 'goal'), shootoutEv('shootout_for', 'missed'),
      shootoutEv('shootout_against', 'goal'), shootoutEv('shootout_against', 'save'), shootoutEv('shootout_against', 'save'),
    ]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.total.shotsFor.attempts).toBe(1);
    expect(s.shootout).toEqual({ us: { goals: 1, attempts: 2 }, them: { goals: 1, attempts: 3 } });
    expect(computeGameStats([shotEv('shot_for', 'goal')]).shootout).toBeNull();
  });

  it('reports overtime only when there is period-3 activity, with its own column', () => {
    expect(computeGameStats([shotEv('shot_for', 'goal')]).hasOvertime).toBe(false);
    const ot = computeGameStats([shotEv('shot_for', 'goal', { period: 3 }), shotEv('shot_for', 'save', { period: 1 })]);
    expect(ot.hasOvertime).toBe(true);
    expect(ot.p3.shotsFor.goals).toBe(1);
    expect(ot.total.shotsFor.onGoal).toBe(2);
  });

  it('splits shots by numerical situation and treats a missing value as even', () => {
    const legacy = { ...shotEv('shot_for', 'goal') } as Record<string, unknown>;
    delete legacy.strength;
    const s = computeGameStats([
      shotEv('shot_for', 'goal', { strength: 'pp' }),
      shotEv('shot_against', 'goal', { strength: 'pk' }), shotEv('shot_against', 'save', { strength: 'pk' }),
      legacy as never,
    ]);
    expect(s.byStrength.pp.shotsFor.goals).toBe(1);
    expect(s.byStrength.pk.shotsAgainst).toEqual({ attempts: 2, unblocked: 2, onGoal: 2, goals: 1 });
    expect(s.byStrength.even.shotsFor.goals).toBe(1);
  });

  it('ignores states and notes', () => {
    const s = computeGameStats([stateEv('state_strength', 'pp'), noteEv('glissant')]);
    expect(s.total.shotsFor.attempts + s.total.shotsAgainst.attempts).toBe(0);
    expect(s.score).toEqual({ us: 0, them: 0 });
  });
});
