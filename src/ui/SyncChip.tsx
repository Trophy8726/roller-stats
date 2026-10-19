import { t } from '../i18n/fr';

export function SyncChip({ pending, connected, refused = false }: { pending: number; connected: boolean; refused?: boolean }) {
  const label = refused && pending > 0 ? t.sync.refused : pending > 0 ? t.sync.pending(pending) : connected ? t.sync.synced : t.sync.offline;
  return (
    <span className="chip" role="status">
      <span className={`dot-status${connected && pending === 0 ? ' dot-status--ok' : ''}`} />
      {label}
    </span>
  );
}
