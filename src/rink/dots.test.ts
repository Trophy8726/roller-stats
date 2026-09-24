import { orient } from './coords';
import { DOTS, DOT_IDS, dotZone } from './dots';

describe('faceoff dots', () => {
  it('has 5 dots', () => expect(DOT_IDS).toHaveLength(5));
  it('maps dots to zones', () => {
    expect(dotZone('center')).toBe('neutral');
    expect(dotZone('off_top')).toBe('off');
    expect(dotZone('off_bottom')).toBe('off');
    expect(dotZone('def_top')).toBe('def');
    expect(dotZone('def_bottom')).toBe('def');
  });
  it('puts offensive dots in the right half (our attack)', () => {
    expect(DOTS.off_top.x).toBeGreaterThan(0.5);
    expect(DOTS.def_top.x).toBeLessThan(0.5);
  });
  it('is symmetric under the 180° rotation, so a rotated rink shows dots at the same places', () => {
    for (const id of DOT_IDS) {
      const r = orient(DOTS[id], false);
      const match = DOT_IDS.some((o) => Math.abs(DOTS[o].x - r.x) < 1e-9 && Math.abs(DOTS[o].y - r.y) < 1e-9);
      expect(match).toBe(true);
    }
  });
});
