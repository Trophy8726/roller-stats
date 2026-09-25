import { gameFx, shotEv } from '../test/builders';
import { downloadCsv, eventsToCsv, slug } from './csv';

describe('eventsToCsv', () => {
  const game = gameFx({ code: 'AB23', opponent: 'Rouen;B', game_date: '2026-09-24' });

  it('writes a BOM, a French header and ; separated rows with decimal commas', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { x: 0.912, y: 0.5 })], [game]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('match;date;adversaire;type;periode;x;y;point;resultat;role;enregistre_le');
    expect(lines[1]).toMatch(/^AB23;2026-09-24;"Rouen;B";shot_for;1;0,912;0,5;;goal;all;/);
  });

  it('leaves out deleted events', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00Z' })], [game]);
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });

  it.each(['=HYPERLINK("x")', '+33', '-1', '@SUM(A1)'])('neutralizes a cell starting like a formula: %s', (opponent) => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal')], [gameFx({ code: 'AB23', opponent })]);
    const cell = csv.trim().split('\r\n')[1].split(';')[2];
    expect(cell.replace(/^"/, '').startsWith(`'${opponent[0]}`)).toBe(true);
  });

  it('neutralizes a formula cell that also needs quoting', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal')], [gameFx({ code: 'AB23', opponent: '=1;2' })]);
    expect(csv).toContain(`;"'=1;2";`);
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a link attached to the page, removes it, and frees the file later', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:csv');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let attachedOnClick = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedOnClick = document.body.contains(this);
    });
    downloadCsv('saison.csv', 'a;b\r\n');
    expect(attachedOnClick).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:csv');
  });
});

describe('slug', () => {
  it('makes file-safe names', () => expect(slug('Évreux HC 2')).toBe('evreux-hc-2'));
});
