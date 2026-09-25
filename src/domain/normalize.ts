import type { Game, GameEvent } from './types';

type V2GameFields = 'venue' | 'competition' | 'sheet_side' | 'overtime_possible';

/** A game saved by v1 (localStorage cache, old rows) lacks the v2 fields. */
export function normalizeGame(raw: Omit<Game, V2GameFields> & Partial<Pick<Game, V2GameFields>>): Game {
  return {
    ...raw,
    venue: raw.venue ?? (raw.home ? 'home' : 'away'),
    competition: raw.competition ?? 'championnat',
    sheet_side: raw.sheet_side ?? null,
    overtime_possible: raw.overtime_possible ?? true,
  };
}

/** An event stored by v1 (IndexedDB on a device that has not synced yet) lacks the new columns. */
export function normalizeEvent<E extends GameEvent>(e: E): E {
  return {
    ...e,
    goalie_id: e.goalie_id ?? null,
    empty_net: e.empty_net ?? false,
    strength: e.strength ?? 'even',
    penalty_shot: e.penalty_shot ?? false,
    note: e.note ?? null,
  };
}
