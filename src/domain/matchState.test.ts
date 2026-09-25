import { stateEv } from '../test/builders';
import { computeMatchState, INITIAL_MATCH_STATE } from './matchState';

const at = (s: number) => new Date(Date.UTC(2026, 8, 24, 19, 0, s)).toISOString();

describe('computeMatchState', () => {
  it('starts with no goalie known, full nets and even strength', () => {
    expect(INITIAL_MATCH_STATE).toEqual({ ourGoalieId: null, ourNetEmpty: false, theirNetEmpty: false, strength: 'even' });
    expect(computeMatchState([])).toEqual(INITIAL_MATCH_STATE);
  });

  it('follows the latest goalie change', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2) }),
    ]);
    expect(s).toMatchObject({ ourGoalieId: 'g2', ourNetEmpty: false });
  });

  it('an empty net clears the goalie, and a new goalie fills it again', () => {
    const empty = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'empty', { recorded_at: at(2) }),
    ]);
    expect(empty).toMatchObject({ ourGoalieId: null, ourNetEmpty: true });
    const back = computeMatchState([
      stateEv('state_our_goalie', 'empty', { recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2) }),
    ]);
    expect(back).toMatchObject({ ourGoalieId: 'g2', ourNetEmpty: false });
  });

  it('ignores an undone change: the previous state comes back', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2), deleted_at: at(3) }),
    ]);
    expect(s.ourGoalieId).toBe('g1');
  });

  it('orders changes by recording time, not by list order', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(5) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
    ]);
    expect(s.ourGoalieId).toBe('g2');
  });

  it('breaks a tie on recorded_at by id, whatever the list order', () => {
    const first = stateEv('state_our_goalie', 'goalie', { id: 'a', goalie_id: 'g1', recorded_at: at(1) });
    const second = stateEv('state_our_goalie', 'goalie', { id: 'b', goalie_id: 'g2', recorded_at: at(1) });
    expect(computeMatchState([first, second]).ourGoalieId).toBe('g2');
    expect(computeMatchState([second, first]).ourGoalieId).toBe('g2');
  });

  it('tracks the opponent net and the strength independently', () => {
    const s = computeMatchState([
      stateEv('state_their_net', 'empty', { recorded_at: at(1) }),
      stateEv('state_strength', 'pp', { recorded_at: at(2) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(3) }),
    ]);
    expect(s).toEqual({ ourGoalieId: 'g1', ourNetEmpty: false, theirNetEmpty: true, strength: 'pp' });
    const back = computeMatchState([
      stateEv('state_their_net', 'empty', { recorded_at: at(1) }),
      stateEv('state_their_net', 'present', { recorded_at: at(2) }),
      stateEv('state_strength', 'pk', { recorded_at: at(3) }),
      stateEv('state_strength', 'even', { recorded_at: at(4) }),
    ]);
    expect(back).toMatchObject({ theirNetEmpty: false, strength: 'even' });
  });

  it('ignores events that are not states', () => {
    expect(computeMatchState([stateEv('state_strength', 'pp', { kind: 'note' as never, recorded_at: at(1) })])).toEqual(INITIAL_MATCH_STATE);
  });
});
