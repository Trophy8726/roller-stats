import { t } from '../i18n/fr';

export function SyncChip({ pending, connected }: { pending: number; connected: boolean }) {
  const label = pending > 0 ? t.sync.pending(pending) : connected ? t.sync.synced : t.sync.offline;
  return (
    <span className="chip" role="status">
      <span className={`dot-status${connected && pending === 0 ? ' dot-status--ok' : ''}`} />
      {label}
    </span>
  );
}
