import { gameFx, shotEv } from '../test/builders';
import { normalizeEvent, normalizeGame } from './normalize';

describe('normalizeGame', () => {
  it('fills the v2 fields of a game saved by v1', () => {
    const v1 = { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false };
    expect(normalizeGame(v1)).toEqual({ ...v1, venue: 'away', competition: 'championnat', sheet_side: null, overtime_possible: true });
    expect(normalizeGame({ ...v1, home: true }).venue).toBe('home');
  });
  it('keeps the v2 fields it is given', () => {
    const g = gameFx({ venue: 'neutral', competition: 'coupe', sheet_side: 'visitor', overtime_possible: false, home: false });
    expect(normalizeGame(g)).toEqual(g);
  });
});

describe('normalizeEvent', () => {
  it('fills the new columns of an event recorded by v1', () => {
    const legacy = { ...shotEv('shot_for', 'goal') } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    expect(normalizeEvent(legacy as never)).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
  });
  it('does not touch an event that already has them', () => {
    const e = shotEv('shot_against', 'save', { goalie_id: 'g1', empty_net: true, strength: 'pk' });
    expect(normalizeEvent(e)).toEqual(e);
  });
});
