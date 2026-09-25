import type { MarkResult } from '../domain/types';
import { t } from '../i18n/fr';
import { ResultMarker } from './ResultMarker';

export function Legend({ results }: { results: readonly MarkResult[] }) {
  return (
    <div className="legend">
      {results.map((r) => (
        <span key={r}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <ResultMarker cx={10} cy={10} result={r} />
          </svg>
          {t.results[r]}
        </span>
      ))}
    </div>
  );
}
