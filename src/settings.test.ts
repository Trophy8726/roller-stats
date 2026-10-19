import { gameFx } from './test/builders';
import { loadCachedGame, loadCachedGoalies, saveCachedGoalies, loadSetup, loadTeamName, saveCachedGame, saveSetup, saveTeamName, todayIso, savePendingInvite, loadPendingInvite, clearPendingInvite, loadMemberships, saveMemberships, loadCurrentClub, saveCurrentClub } from './settings';

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
  it('remembers the goalie roster and survives corrupted storage', () => {
    expect(loadCachedGoalies()).toEqual([]);
    saveCachedGoalies([{ id: 'g1', name: 'Mallet' }]);
    expect(loadCachedGoalies()).toEqual([{ id: 'g1', name: 'Mallet' }]);
    localStorage.setItem('goalies', '{oops');
    expect(loadCachedGoalies()).toEqual([]);
  });
  it('keeps a pending invitation until it is cleared', () => {
    expect(loadPendingInvite()).toBeNull();
    savePendingInvite('tok');
    expect(loadPendingInvite()).toBe('tok');
    expect(loadPendingInvite()).toBe('tok');
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();
  });
  it('gives today as YYYY-MM-DD', () => expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  it('keeps the memberships and the current club per account', () => {
    expect(loadMemberships('u1')).toEqual([]);
    saveMemberships('u1', [{ clubId: 'c', clubName: 'Aix', role: 'owner' }]);
    expect(loadMemberships('u1')).toEqual([{ clubId: 'c', clubName: 'Aix', role: 'owner' }]);
    expect(loadMemberships('u2')).toEqual([]);
    saveCurrentClub('u1', 'c');
    expect(loadCurrentClub('u1')).toBe('c');
    expect(loadCurrentClub('u2')).toBeNull();
  });
});
