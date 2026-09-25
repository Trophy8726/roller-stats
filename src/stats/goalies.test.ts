import { noteEv, ownGoalEv, shootoutEv, shotEv, stateEv } from '../test/builders';
import { computeGoalieStats, countUnassigned } from './goalies';

const names = new Map([['g1', 'Mallet'], ['g2', 'Bernard']]);
const labels = { unset: 'Non renseigné', unknown: 'Gardien inconnu' };
const stats = (evs: Parameters<typeof computeGoalieStats>[0]) => computeGoalieStats(evs, names, labels);

describe('computeGoalieStats', () => {
  it('groups the shots faced by goalie and computes the save %', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'goal', { goalie_id: 'g1' }),
      shotEv('shot_against', 'missed', { goalie_id: 'g1' }), shotEv('shot_against', 'blocked', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g2', game_code: 'CD45' }),
    ]);
    expect(lines).toEqual([
      { goalieId: 'g2', name: 'Bernard', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 0 },
      { goalieId: 'g1', name: 'Mallet', games: 1, onGoal: 4, saves: 3, goalsAgainst: 1, savePct: 0.75, ownGoals: 0 },
    ]);
  });

  it('leaves empty-net shots out, and shows a CSC apart without touching the save %', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'goal', { goalie_id: null, empty_net: true }),
      ownGoalEv('own_goal_against', { goalie_id: 'g1' }),
      ownGoalEv('own_goal_against', { goalie_id: null, empty_net: true }),
      ownGoalEv('own_goal_for'),
    ]);
    expect(lines).toEqual([{ goalieId: 'g1', name: 'Mallet', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 1 }]);
  });

  it('puts shots with no goalie on a "not set" line, only when there are some', () => {
    expect(stats([shotEv('shot_against', 'save', { goalie_id: null })])).toEqual([
      { goalieId: null, name: 'Non renseigné', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 0 },
    ]);
    expect(stats([shotEv('shot_for', 'goal')])).toEqual([]);
  });

  it('counts the games a goalie played, including one set in net without a shot', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1', game_code: 'AAAA' }),
      shotEv('shot_against', 'save', { goalie_id: 'g1', game_code: 'BBBB' }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', game_code: 'CCCC' }),
    ]);
    expect(lines.map((l) => [l.name, l.games])).toEqual([['Bernard', 1], ['Mallet', 2]]);
  });

  it('ignores deleted events and unrelated kinds', () => {
    expect(stats([
      shotEv('shot_against', 'goal', { goalie_id: 'g1', deleted_at: '2026-09-24T19:00:00Z' }),
      noteEv('x'), shootoutEv('shootout_against', 'save', { goalie_id: 'g1' }),
    ])).toEqual([]);
  });

  it('sorts goalies by name with the "not set" line last, and names an unknown goalie', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: null }),
      shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g-unknown' }),
      shotEv('shot_against', 'save', { goalie_id: 'g2' }),
    ]);
    expect(lines.map((l) => l.name)).toEqual(['Bernard', 'Gardien inconnu', 'Mallet', 'Non renseigné']);
  });
});

describe('countUnassigned', () => {
  it('counts live entries against us with no goalie and not on an empty net', () => {
    expect(countUnassigned([
      shotEv('shot_against', 'save'), ownGoalEv('own_goal_against'), shootoutEv('shootout_against', 'goal'),
      shotEv('shot_against', 'save', { empty_net: true }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { deleted_at: '2026-09-24T19:00:00Z' }), shotEv('shot_for', 'goal'),
    ])).toBe(3);
  });
});
