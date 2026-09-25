import {
  makeFaceoff, makeGoalieState, makeNote, makeOwnGoal, makePenaltyShot, makeShootout, makeShot,
  makeStrengthState, makeTheirNetState, toRow, uuid,
} from './factory';
import type { MatchState } from './matchState';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ctx = { code: 'AB23', period: 2 as const, role: 'all' as const, now: new Date('2026-09-24T18:00:00Z'), id: 'id-1' };
const state = (over: Partial<MatchState> = {}): MatchState => ({ ourGoalieId: 'g1', ourNetEmpty: false, theirNetEmpty: false, strength: 'even', ...over });
const defaults = { goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null };

describe('makeShot', () => {
  it('builds a normalized shot event with rounded coordinates', () => {
    expect(makeShot(ctx, 'shot_for', { x: 0.912345, y: 0.5 }, 'goal')).toEqual({
      id: 'id-1', game_code: 'AB23', kind: 'shot_for', period: 2, x: 0.912, y: 0.5, dot: null,
      result: 'goal', device_role: 'all', recorded_at: '2026-09-24T18:00:00.000Z', deleted_at: null, ...defaults,
    });
  });
  it('a shot against records our goalie, the empty-net flag and the strength', () => {
    const e = makeShot({ ...ctx, state: state({ strength: 'pk' }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'save');
    expect(e).toMatchObject({ goalie_id: 'g1', empty_net: false, strength: 'pk' });
  });
  it('a shot against on our empty net has no goalie and is flagged, even with a stale goalie id', () => {
    const e = makeShot({ ...ctx, state: state({ ourNetEmpty: true }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'goal');
    expect(e).toMatchObject({ goalie_id: null, empty_net: true });
  });
  it('a shot against with no goalie chosen has no goalie and is not flagged', () => {
    const e = makeShot({ ...ctx, state: state({ ourGoalieId: null }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'goal');
    expect(e).toMatchObject({ goalie_id: null, empty_net: false });
  });
  it('a shot for carries the opponent net flag and never a goalie', () => {
    expect(makeShot({ ...ctx, state: state({ theirNetEmpty: true }) }, 'shot_for', { x: 0.9, y: 0.5 }, 'goal')).toMatchObject({ goalie_id: null, empty_net: true });
    expect(makeShot({ ...ctx, state: state() }, 'shot_for', { x: 0.9, y: 0.5 }, 'goal')).toMatchObject({ goalie_id: null, empty_net: false });
  });
});

describe('makePenaltyShot', () => {
  it('has no position, is flagged, and is attributed like a shot', () => {
    expect(makePenaltyShot({ ...ctx, state: state() }, 'shot_against', 'save')).toMatchObject({
      kind: 'shot_against', x: null, y: null, penalty_shot: true, result: 'save', goalie_id: 'g1',
    });
    expect(makePenaltyShot(ctx, 'shot_for', 'goal')).toMatchObject({ kind: 'shot_for', penalty_shot: true, goalie_id: null });
  });
});

describe('makeFaceoff', () => {
  it('builds a faceoff with a dot, no coordinates and the strength', () => {
    expect(makeFaceoff({ ...ctx, state: state({ strength: 'pp' }) }, 'off_top', 'won')).toMatchObject({
      kind: 'faceoff', x: null, y: null, dot: 'off_top', result: 'won', strength: 'pp', goalie_id: null,
    });
  });
});

describe('makeOwnGoal', () => {
  it('a goal against us is attributed to our goalie in net', () => {
    expect(makeOwnGoal({ ...ctx, state: state() }, 'own_goal_against')).toMatchObject({ kind: 'own_goal_against', result: 'goal', x: null, goalie_id: 'g1', empty_net: false });
  });
  it('a goal for us has no goalie', () => {
    expect(makeOwnGoal({ ...ctx, state: state() }, 'own_goal_for')).toMatchObject({ kind: 'own_goal_for', goalie_id: null });
  });
});

describe('makeShootout', () => {
  it('an attempt against us records our goalie', () => {
    expect(makeShootout({ ...ctx, state: state() }, 'shootout_against', 'save')).toMatchObject({ kind: 'shootout_against', result: 'save', goalie_id: 'g1', empty_net: false });
  });
  it('an attempt against us with our net marked empty has no goalie and is not flagged', () => {
    expect(makeShootout({ ...ctx, state: state({ ourNetEmpty: true }) }, 'shootout_against', 'goal')).toMatchObject({ goalie_id: null, empty_net: false });
  });
  it('an attempt for us has no goalie', () => {
    expect(makeShootout(ctx, 'shootout_for', 'goal')).toMatchObject({ kind: 'shootout_for', goalie_id: null });
  });
});

describe('makeNote', () => {
  it('trims the text and caps it at 200 characters', () => {
    expect(makeNote(ctx, '  glissant  ')).toMatchObject({ kind: 'note', result: 'note', note: 'glissant' });
    expect(makeNote(ctx, 'x'.repeat(300)).note).toHaveLength(200);
  });
});

describe('state events', () => {
  it('a goalie change carries the goalie, an empty net carries none', () => {
    expect(makeGoalieState(ctx, 'g2')).toMatchObject({ kind: 'state_our_goalie', result: 'goalie', goalie_id: 'g2' });
    expect(makeGoalieState(ctx, null)).toMatchObject({ kind: 'state_our_goalie', result: 'empty', goalie_id: null });
  });
  it('the opponent net and strength changes', () => {
    expect(makeTheirNetState(ctx, true)).toMatchObject({ kind: 'state_their_net', result: 'empty' });
    expect(makeTheirNetState(ctx, false)).toMatchObject({ kind: 'state_their_net', result: 'present' });
    expect(makeStrengthState(ctx, 'pk')).toMatchObject({ kind: 'state_strength', result: 'pk', strength: 'pk' });
  });
});

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns a v4 uuid', () => expect(uuid()).toMatch(UUID_RE));
  it('works without crypto.randomUUID (plain http on a local network)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) });
    expect(uuid()).toMatch(UUID_RE);
  });
});

describe('toRow', () => {
  it('drops local-only fields and keeps every column', () => {
    const e = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save'), sync: 'pending', mine: true };
    expect(Object.keys(toRow(e)).sort()).toEqual(
      ['deleted_at', 'device_role', 'dot', 'empty_net', 'game_code', 'goalie_id', 'id', 'kind', 'note', 'penalty_shot', 'period', 'recorded_at', 'result', 'strength', 'x', 'y'].sort(),
    );
  });
  it('fills the new columns of an event that predates them', () => {
    const legacy = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save') } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    expect(toRow(legacy as never)).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
  });
});
