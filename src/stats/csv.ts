import type { Game, GameEvent } from '../domain/types';

const HEADER = [
  'match', 'date', 'adversaire', 'type', 'periode', 'x', 'y', 'point', 'resultat', 'role', 'enregistre_le',
  'gardien', 'cage_vide', 'situation', 'tir_penalty', 'note',
];

const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
/** A leading ' stops Excel from running a cell as a formula (CSV injection). A leading tab or CR counts too. Coordinates are in [0, 1], never negative. */
const defuse = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
const esc = (raw: string) => {
  const s = defuse(raw);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV for French Excel: UTF-8 BOM, `;` separator, decimal comma. Deleted events are excluded. */
export function eventsToCsv(events: GameEvent[], games: Game[], goalieNames: ReadonlyMap<string, string> = new Map()): string {
  const byCode = new Map(games.map((g) => [g.code, g]));
  const rows = events
    .filter((e) => !e.deleted_at)
    .map((e) => {
      const g = byCode.get(e.game_code);
      return [
        e.game_code, g?.game_date ?? '', g?.opponent ?? '', e.kind, String(e.period), num(e.x), num(e.y), e.dot ?? '', e.result,
        e.device_role, e.recorded_at,
        e.goalie_id ? (goalieNames.get(e.goalie_id) ?? e.goalie_id) : '',
        e.empty_net ? 'oui' : '', e.strength ?? 'even', e.penalty_shot ? 'oui' : '', e.note ?? '',
      ]
        .map(esc)
        .join(';');
    });
  return '﻿' + [HEADER.join(';'), ...rows].join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers (Firefox, older Safari) ignore clicks on a link that is not in the page.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
