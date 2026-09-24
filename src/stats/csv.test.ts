import { gameFx, shotEv } from '../test/builders';
import { eventsToCsv, slug } from './csv';

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
});

describe('slug', () => {
  it('makes file-safe names', () => expect(slug('Évreux HC 2')).toBe('evreux-hc-2'));
});
