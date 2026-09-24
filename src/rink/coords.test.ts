import { attacksRight, endLabels, orient } from './coords';

describe('attacksRight', () => {
  it.each([
    ['left', 1, true],
    ['left', 2, false],
    ['right', 1, false],
    ['right', 2, true],
  ] as const)('defendP1=%s period=%s -> %s', (side, period, expected) => {
    expect(attacksRight(side, period)).toBe(expected);
  });
});

describe('orient', () => {
  it('keeps the point when we attack right', () => {
    expect(orient({ x: 0.9, y: 0.2 }, true)).toEqual({ x: 0.9, y: 0.2 });
  });
  it('rotates 180° when we attack left', () => {
    const r = orient({ x: 0.9, y: 0.2 }, false);
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(0.8);
  });
  it('is its own inverse', () => {
    const p = { x: 0.37, y: 0.61 };
    const r = orient(orient(p, false), false);
    expect(r.x).toBeCloseTo(p.x);
    expect(r.y).toBeCloseTo(p.y);
  });
  it('stores a shot near the opponent goal near x=1 in both periods', () => {
    // Tracker sees us attacking left in P1 (we defend right): taps near the left goal.
    expect(orient({ x: 0.08, y: 0.5 }, attacksRight('right', 1)).x).toBeCloseTo(0.92);
    // Same tracker in P2 sees us attacking right: taps near the right goal.
    expect(orient({ x: 0.92, y: 0.5 }, attacksRight('right', 2)).x).toBeCloseTo(0.92);
  });
});

describe('endLabels', () => {
  it('puts our name on the end we defend', () => {
    expect(endLabels('Nous', 'Rouen', true)).toEqual({ left: 'Nous', right: 'Rouen' });
    expect(endLabels('Nous', 'Rouen', false)).toEqual({ left: 'Rouen', right: 'Nous' });
  });
});
