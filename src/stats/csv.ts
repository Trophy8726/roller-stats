import type { Game, GameEvent } from '../domain/types';

const HEADER = ['match', 'date', 'adversaire', 'type', 'periode', 'x', 'y', 'point', 'resultat', 'role', 'enregistre_le'];

const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
const esc = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV for French Excel: UTF-8 BOM, `;` separator, decimal comma. Deleted events are excluded. */
export function eventsToCsv(events: GameEvent[], games: Game[]): string {
  const byCode = new Map(games.map((g) => [g.code, g]));
  const rows = events
    .filter((e) => !e.deleted_at)
    .map((e) => {
      const g = byCode.get(e.game_code);
      return [e.game_code, g?.game_date ?? '', g?.opponent ?? '', e.kind, String(e.period), num(e.x), num(e.y), e.dot ?? '', e.result, e.device_role, e.recorded_at]
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
  a.click();
  URL.revokeObjectURL(url);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
