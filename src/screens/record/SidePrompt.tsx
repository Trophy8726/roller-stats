import type { Side } from '../../domain/types';
import { t } from '../../i18n/fr';

/**
 * Asked whenever the overtime side is unknown: no rule is assumed about the ends.
 * `onCancel` is only given when leaving the prompt is possible (the period is not 3 yet); without it the choice is mandatory.
 */
export function SidePrompt({ onPick, onCancel }: { onPick: (s: Side) => void; onCancel?: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t.record.overtimeSideTitle}>
      <h1>{t.record.overtimeSideTitle}</h1>
      <p>{t.setup.sideHint}</p>
      <div className="row">
        <button type="button" className="btn btn--big" onClick={() => onPick('left')}>
          {t.setup.defendLeft}
        </button>
        <button type="button" className="btn btn--big" onClick={() => onPick('right')}>
          {t.setup.defendRight}
        </button>
      </div>
      {onCancel && (
        <button type="button" className="btn" onClick={onCancel}>
          {t.record.cancel}
        </button>
      )}
    </div>
  );
}
