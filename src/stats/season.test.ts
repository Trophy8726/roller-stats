import { gameFx, shotEv } from '../test/builders';
import { computeSeasonStats } from './season';

const a = gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' });
const b = gameFx({ code: 'BBBB', opponent: 'Caen', game_date: '2026-09-27' });

describe('computeSeasonStats', () => {
  it('builds one row per game, newest first, each with its own stats', () => {
    const s = computeSeasonStats([a, b], [
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_against', 'goal', { game_code: 'BBBB' }),
    ]);
    expect(s.rows.map((r) => r.game.code)).toEqual(['BBBB', 'AAAA']);
    expect(s.rows[1].stats.score).toEqual({ us: 2, them: 0 });
    expect(s.rows[0].stats.score).toEqual({ us: 0, them: 1 });
  });

  it('totals and averages per game', () => {
    const s = computeSeasonStats([a, b], [
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    ]);
    expect(s.games).toBe(2);
    expect(s.total.shotsFor.goals).toBe(2);
    expect(s.avgFor.goals).toBe(1);
  });

  it('ignores events of games not in the list', () => {
    const s = computeSeasonStats([a], [shotEv('shot_for', 'goal', { game_code: 'ZZZZ' })]);
    expect(s.total.shotsFor.goals).toBe(0);
  });

  it('handles an empty season', () => {
    const s = computeSeasonStats([], []);
    expect(s.games).toBe(0);
    expect(s.avgFor).toEqual({ attempts: 0, unblocked: 0, onGoal: 0, goals: 0 });
  });
});
