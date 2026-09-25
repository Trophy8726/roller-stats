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
      shotEv('shot_against', 'save', { game_code: 'BBBB' }),
    ]);
    expect(s.games).toBe(2);
    expect(s.total.shotsFor.goals).toBe(2);
    expect(s.avgFor.goals).toBe(1);
  });

  it('leaves out games with no live events (empty or test games) but still lists them', () => {
    const c = gameFx({ code: 'CCCC', opponent: 'Test', game_date: '2026-09-21' });
    const s = computeSeasonStats([a, b, c], [
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'CCCC', deleted_at: '2026-09-21T19:00:00Z' }),
    ]);
    expect(s.games).toBe(1);
    expect(s.avgFor.goals).toBe(2);
    expect(s.rows.map((r) => [r.game.code, r.included, r.empty])).toEqual([
      ['BBBB', false, true],
      ['CCCC', false, true],
      ['AAAA', true, false],
    ]);
  });

  it('leaves out the games the user unticked from every total', () => {
    const s = computeSeasonStats(
      [a, b],
      [shotEv('shot_for', 'goal', { game_code: 'AAAA' }), shotEv('shot_for', 'save', { game_code: 'BBBB' })],
      new Set(['AAAA']),
    );
    expect(s.games).toBe(1);
    expect(s.total.shotsFor.goals).toBe(0);
    expect(s.total.shotsFor.onGoal).toBe(1);
    expect(s.rows.find((r) => r.game.code === 'AAAA')?.included).toBe(false);
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

describe('competition filter', () => {
  const champ = gameFx({ code: 'AAAA', game_date: '2026-09-20' });
  const cup = gameFx({ code: 'BBBB', competition: 'coupe', game_date: '2026-09-27' });
  const events = [
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_for', 'goal', { game_code: 'BBBB' }), shotEv('shot_for', 'goal', { game_code: 'BBBB' }),
  ];
  it('defaults to Championnat', () => {
    const s = computeSeasonStats([champ, cup], events);
    expect(s.rows.map((r) => r.game.code)).toEqual(['AAAA']);
    expect(s.total.shotsFor.goals).toBe(1);
  });
  it('shows another competition, or all of them', () => {
    expect(computeSeasonStats([champ, cup], events, new Set(), 'coupe').total.shotsFor.goals).toBe(2);
    expect(computeSeasonStats([champ, cup], events, new Set(), 'all').games).toBe(2);
  });
  it('treats a game without a competition as Championnat', () => {
    const v1 = { ...champ } as Record<string, unknown>;
    delete v1.competition;
    expect(computeSeasonStats([v1 as never], events, new Set(), 'championnat').games).toBe(1);
  });
});
