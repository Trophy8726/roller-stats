import type { EventResult } from '../domain/types';
import { t } from '../i18n/fr';
import { ResultMarker } from '../rink/ResultMarker';

export function ResultButtons<R extends EventResult>({ results, onPick, onCancel }: { results: readonly R[]; onPick: (r: R) => void; onCancel: () => void }) {
  return (
    <div className="actionbar">
      {results.map((r) => (
        <button key={r} type="button" className="btn btn--big" onClick={() => onPick(r)}>
          <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
            <ResultMarker cx={10} cy={10} result={r} />
          </svg>
          {t.results[r]}
        </button>
      ))}
      <button type="button" className="btn btn--big btn--cancel" onClick={onCancel} aria-label={t.record.cancel}>
        ✕
      </button>
    </div>
  );
}
