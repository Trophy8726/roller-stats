import { t } from '../../i18n/fr';
import { noteEv, ownGoalEv, penaltyEv, shotEv, stateEv } from '../../test/builders';
import { describeEvent } from './describe';

const names = new Map([['g1', 'François Mallet']]);

describe('describeEvent', () => {
  it('describes a shot with its period, side and result', () => {
    expect(describeEvent(shotEv('shot_against', 'save'), names)).toBe('P1 · Tir contre · Arrêt');
  });

  it('describes a penalty shot with the penalty label instead of the shot label', () => {
    expect(describeEvent(penaltyEv('shot_for', 'goal'), names)).toBe(`P1 · ${t.kinds.penalty_for} · ${t.results.goal}`);
    expect(describeEvent(penaltyEv('shot_against', 'save'), names)).toContain(t.kinds.penalty_against);
  });

  it('describes a note with its text', () => {
    expect(describeEvent(noteEv('terrain glissant', { period: 2 }), names)).toBe(`P2 · ${t.kinds.note} · terrain glissant`);
  });

  it('describes a goalie state with a known goalie, an unknown goalie id and an empty net', () => {
    expect(describeEvent(stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1' }), names)).toBe(`P1 · ${t.kinds.state_our_goalie} · François Mallet`);
    expect(describeEvent(stateEv('state_our_goalie', 'goalie', { goalie_id: 'g9' }), names)).toContain(t.goalies.unknown);
    expect(describeEvent(stateEv('state_our_goalie', 'empty', { goalie_id: null }), names)).toContain(t.state.ourNetEmpty);
  });

  it('describes the other net and the numerical situation', () => {
    expect(describeEvent(stateEv('state_their_net', 'empty'), names)).toContain(t.state.theirNetEmpty);
    expect(describeEvent(stateEv('state_their_net', 'present'), names)).toContain(t.state.theirNetPresent);
    expect(describeEvent(stateEv('state_strength', 'pk',{ strength: 'pk' }), names)).toContain(t.strength.pk);
  });

  it('describes an own goal by its label only', () => {
    expect(describeEvent(ownGoalEv('own_goal_against'), names)).toBe(`P1 · ${t.kinds.own_goal_against}`);
  });
});
