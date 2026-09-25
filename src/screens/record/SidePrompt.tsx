import type { Side } from '../../domain/types';
import { t } from '../../i18n/fr';

/** Asked when entering overtime for the first time on this device: no rule is assumed about the ends. */
export function SidePrompt({ onPick, onCancel }: { onPick: (s: Side) => void; onCancel: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t.record.overtimeSideTitle}>
      <h1>{t.record.overtimeSideTitle}</h1>
      <p>{t.setup.sideHint}</p>
      <div className="row">
        <button type="button" className="btn btn--big" autoFocus onClick={() => onPick('left')}>
          {t.setup.defendLeft}
        </button>
        <button type="button" className="btn btn--big" onClick={() => onPick('right')}>
          {t.setup.defendRight}
        </button>
      </div>
      <button type="button" className="btn" onClick={onCancel}>
        {t.record.cancel}
      </button>
    </div>
  );
}
