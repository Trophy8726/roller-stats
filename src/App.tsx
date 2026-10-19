import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { ClubProvider, useClub } from './clubs/ClubContext';
import { t } from './i18n/fr';
import { navigate, useRoute } from './router';
import { Home } from './screens/Home';
import { JoinScreen } from './screens/JoinScreen';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { clearPendingInvite, loadPendingInvite } from './settings';

export function Splash() {
  return (
    <main className="page">
      <p className="muted">{t.errors.loading}</p>
    </main>
  );
}

function SignedIn() {
  const route = useRoute();
  const club = useClub();
  // An invitation opened before the Google round trip: go back to it once, then forget it.
  const [pending, setPending] = useState(loadPendingInvite);
  useEffect(() => {
    if (!pending) return;
    clearPendingInvite();
    setPending(null);
    navigate({ name: 'join', token: pending });
  }, [pending]);

  if (route.name === 'join') return <JoinScreen key={route.token} token={route.token} />;
  if (pending) return <Splash />;
  if (club.status === 'loading') return <Splash />;
  if (club.status === 'error') {
    return (
      <main className="page">
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={() => void club.reload()}>
            {t.ui.retry}
          </button>
        </div>
      </main>
    );
  }
  if (!club.current) return <Onboarding />;
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    case 'report':
      return <ReportScreen key={route.code} code={route.code} />;
    case 'season':
      return <SeasonScreen key={club.current.clubId} />;
    default:
      return <Home key={club.current.clubId} />;
  }
}

export function App() {
  const { state } = useAuth();
  const route = useRoute();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <Login error={state.error} inviteToken={route.name === 'join' ? route.token : null} />;
  return (
    <ClubProvider key={state.user.id} userId={state.user.id}>
      <SignedIn />
    </ClubProvider>
  );
}
