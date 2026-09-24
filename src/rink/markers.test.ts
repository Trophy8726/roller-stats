import { faceoffEv, shotEv } from '../test/builders';
import { filterShotMarkers } from './markers';

describe('filterShotMarkers', () => {
  const evs = [
    shotEv('shot_for', 'goal', { period: 1 }),
    shotEv('shot_against', 'save', { period: 2 }),
    shotEv('shot_for', 'missed', { period: 2, deleted_at: '2026-09-24T19:00:00Z' }),
    faceoffEv('center', 'won'),
  ];
  it('keeps only live shots', () => expect(filterShotMarkers(evs, 'all', 'both')).toHaveLength(2));
  it('filters by period', () => expect(filterShotMarkers(evs, 2, 'both').map((m) => m.result)).toEqual(['save']));
  it('filters by side', () => expect(filterShotMarkers(evs, 'all', 'for').map((m) => m.result)).toEqual(['goal']));
});
