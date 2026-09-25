import { gameFx } from './test/builders';
import { loadCachedGame, loadSetup, loadTeamName, saveCachedGame, saveSetup, saveTeamName, todayIso } from './settings';

describe('settings', () => {
  beforeEach(() => localStorage.clear());
  it('remembers the team name', () => {
    expect(loadTeamName()).toBe('');
    saveTeamName('Nous');
    expect(loadTeamName()).toBe('Nous');
  });
  it('stores the setup per game and can clear it', () => {
    saveSetup('AB23', { role: 'all', defendP1: 'left', period: 2 });
    expect(loadSetup('AB23')).toEqual({ role: 'all', defendP1: 'left', period: 2 });
    expect(loadSetup('ZZZZ')).toBeNull();
    saveSetup('AB23', null);
    expect(loadSetup('AB23')).toBeNull();
  });
  it('survives corrupted storage', () => {
    localStorage.setItem('setup:AB23', '{oops');
    expect(loadSetup('AB23')).toBeNull();
  });
  it('caches games for offline reloads', () => {
    saveCachedGame(gameFx());
    expect(loadCachedGame('AB23')).toEqual(gameFx());
  });
  it('normalizes a game cached by v1 (no venue, competition or overtime flag)', () => {
    localStorage.setItem('game:AB23', JSON.stringify({ code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false }));
    expect(loadCachedGame('AB23')).toMatchObject({ venue: 'away', competition: 'championnat', sheet_side: null, overtime_possible: true });
  });
  it('gives today as YYYY-MM-DD', () => expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});
