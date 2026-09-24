import { makeFaceoff, makeShot, toRow, uuid } from './factory';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ctx = { code: 'AB23', period: 2 as const, role: 'all' as const, now: new Date('2026-09-24T18:00:00Z'), id: 'id-1' };

describe('makeShot', () => {
  it('builds a normalized shot event with rounded coordinates', () => {
    expect(makeShot(ctx, 'shot_for', { x: 0.912345, y: 0.5 }, 'goal')).toEqual({
      id: 'id-1', game_code: 'AB23', kind: 'shot_for', period: 2, x: 0.912, y: 0.5, dot: null,
      result: 'goal', device_role: 'all', recorded_at: '2026-09-24T18:00:00.000Z', deleted_at: null,
    });
  });
});

describe('makeFaceoff', () => {
  it('builds a faceoff with a dot and no coordinates', () => {
    expect(makeFaceoff(ctx, 'off_top', 'won')).toMatchObject({ kind: 'faceoff', x: null, y: null, dot: 'off_top', result: 'won' });
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
  it('drops local-only fields', () => {
    const e = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save'), sync: 'pending', mine: true };
    expect(Object.keys(toRow(e)).sort()).toEqual(
      ['deleted_at', 'device_role', 'dot', 'game_code', 'id', 'kind', 'period', 'recorded_at', 'result', 'x', 'y'].sort(),
    );
  });
});
