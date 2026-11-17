import { faceoffEv, shotEv, turnoverEv } from '../test/builders';
import { filterShotMarkers, filterTurnoverMarkers } from './markers';

const evs = [
  shotEv('shot_for', 'goal', { period: 1 }),
  shotEv('shot_against', 'save', { period: 2 }),
  shotEv('shot_for', 'missed', { period: 2, deleted_at: '2026-09-24T19:00:00Z' }),
  faceoffEv('center', 'won'),
  turnoverEv('lost', { period: 1 }),
  turnoverEv('recovered', { period: 2 }),
  turnoverEv('lost', { period: 2, deleted_at: '2026-09-24T19:00:00Z' }),
];

describe('filterShotMarkers', () => {
  it('keeps only live shots', () => expect(filterShotMarkers(evs, 'all', 'both')).toHaveLength(2));
  it('filters by period', () => expect(filterShotMarkers(evs, 2, 'both').map((m) => m.result)).toEqual(['save']));
  it('filters by side', () => expect(filterShotMarkers(evs, 'all', 'for').map((m) => m.result)).toEqual(['goal']));
  it('never puts a turnover on the shot map', () =>
    expect(filterShotMarkers(evs, 'all', 'both').map((m) => m.result)).toEqual(['goal', 'save']));
});

describe('filterTurnoverMarkers', () => {
  it('keeps only live turnovers', () => expect(filterTurnoverMarkers(evs, 'all', 'both')).toHaveLength(2));
  it('filters by result', () => expect(filterTurnoverMarkers(evs, 'all', 'lost').map((m) => m.result)).toEqual(['lost']));
  it('filters by period', () => expect(filterTurnoverMarkers(evs, 2, 'both').map((m) => m.result)).toEqual(['recovered']));
});
