import type { MarkResult } from '../domain/types';
import { t } from '../i18n/fr';
import { ResultMarker } from './ResultMarker';

/** `counts`: when given, each label is followed by its count (« Perdu · 12 »). */
export function Legend({ results, counts }: { results: readonly MarkResult[]; counts?: Partial<Record<MarkResult, number>> }) {
  return (
    <div className="legend">
      {results.map((r) => (
        <span key={r}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <ResultMarker cx={10} cy={10} result={r} />
          </svg>
          {counts ? `${t.results[r]} · ${counts[r] ?? 0}` : t.results[r]}
        </span>
      ))}
    </div>
  );
}
