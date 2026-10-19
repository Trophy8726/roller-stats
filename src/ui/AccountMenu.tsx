import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';

/** The signed-in account. Signing out never touches the outbox: pending entries stay on the device. */
export function AccountMenu() {
  const { state, api } = useAuth();
  const { store } = useSync();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(0);
  if (state.status !== 'signedIn') return null;

  // Read the outbox at click time, not the background-sync counter, which may not have run yet.
  async function signOut() {
    const n = await store.pendingTotal();
    if (n === 0) {
      await api.signOut();
      return;
    }
    setPending(n);
    setConfirming(true);
  }

  return (
    <div className="stack">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {state.user.name}
      </button>
      {open && (
        <div className="card stack">
          <span className="muted">{state.user.email}</span>
          {confirming ? (
            <>
              <p className="notice" role="alert">
                {t.account.pendingWarning(pending)}
              </p>
              <div className="row">
                <button type="button" className="btn btn--primary" onClick={() => setConfirming(false)}>
                  {t.account.wait}
                </button>
                <button type="button" className="btn" onClick={() => void api.signOut()}>
                  {t.account.signOutAnyway}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => void signOut()}>
              {t.account.signOut}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
