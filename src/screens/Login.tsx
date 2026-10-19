import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n/fr';
import { savePendingInvite } from '../settings';

export function Login({ error, inviteToken }: { error: boolean; inviteToken: string | null }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(error);

  // Coming back with the Back button restores the page from the bfcache with busy still set.
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function signIn() {
    if (inviteToken) savePendingInvite(inviteToken);
    setBusy(true);
    setFailed(false);
    try {
      await api.signInWithGoogle(); // the browser leaves for Google
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>{t.appName}</h1>
        <p className="muted">{t.auth.intro}</p>
        {inviteToken && <p>{t.auth.invitePending}</p>}
        {failed && (
          <p className="notice" role="alert">
            {t.auth.failed}
          </p>
        )}
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void signIn()}>
          {t.auth.google}
        </button>
      </section>
    </main>
  );
}
