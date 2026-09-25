import { gameFx, noteEv, penaltyEv, shotEv } from '../test/builders';
import { downloadCsv, eventsToCsv, slug } from './csv';

describe('eventsToCsv', () => {
  const game = gameFx({ code: 'AB23', opponent: 'Rouen;B', game_date: '2026-09-24' });

  it('writes a BOM, a French header and ; separated rows with decimal commas', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { x: 0.912, y: 0.5 })], [game]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('match;date;adversaire;type;periode;x;y;point;resultat;role;enregistre_le;gardien;cage_vide;situation;tir_penalty;note');
    expect(lines[1]).toMatch(/^AB23;2026-09-24;"Rouen;B";shot_for;1;0,912;0,5;;goal;all;/);
  });

  it('leaves out deleted events', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00Z' })], [game]);
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });

  it('adds the goalie name, the empty-net flag, the situation, the penalty flag and the note', () => {
    const csv = eventsToCsv(
      [
        shotEv('shot_against', 'save', { goalie_id: 'g1', strength: 'pk' }),
        shotEv('shot_against', 'goal', { empty_net: true }),
        penaltyEv('shot_for', 'goal'),
        noteEv('=SOMME(1;2)'),
      ],
      [game],
      new Map([['g1', 'François Mallet']]),
    );
    const rows = csv.replace('﻿', '').trim().split('\r\n').slice(1);
    expect(rows[0].endsWith(';François Mallet;;pk;;')).toBe(true);
    expect(rows[1].endsWith(';;oui;even;;')).toBe(true);
    expect(rows[2].endsWith(';;;even;oui;')).toBe(true);
    expect(rows[3]).toContain(`"'=SOMME(1;2)"`);
  });
  it('falls back to the goalie id when the name is unknown', () => {
    expect(eventsToCsv([shotEv('shot_against', 'save', { goalie_id: 'g9' })], [game])).toContain(';g9;');
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
