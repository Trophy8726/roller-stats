import { faceoffEv, shotEv } from '../test/builders';
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
