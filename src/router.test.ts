import { href, parseRoute, type Route } from './router';

describe('parseRoute', () => {
  it('defaults to home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nimporte')).toEqual({ name: 'home' });
  });
  it('parses record and report routes, uppercasing the code', () => {
    expect(parseRoute('#/saisie/k7qx')).toEqual({ name: 'record', code: 'K7QX' });
    expect(parseRoute('#/rapport/K7QX')).toEqual({ name: 'report', code: 'K7QX' });
  });
  it('parses the season route', () => {
    expect(parseRoute('#/saison')).toEqual({ name: 'season' });
  });
  it('parses and builds the invitation route, keeping the token case', () => {
    expect(parseRoute('#/rejoindre/abcDEF123')).toEqual({ name: 'join', token: 'abcDEF123' });
    expect(href({ name: 'join', token: 'abcDEF123' })).toBe('#/rejoindre/abcDEF123');
  });
  it('round-trips through href', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'season' },
      { name: 'record', code: 'AB23' },
      { name: 'report', code: 'AB23' },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r);
  });
});
