import { useAuth } from './auth/AuthContext';
import { t } from './i18n/fr';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { SeasonScreen } from './screens/SeasonScreen';

export function Splash() {
  return (
    <main className="page">
      <p className="muted">{t.errors.loading}</p>
    </main>
  );
}

export function App() {
  const { state } = useAuth();
  const route = useRoute();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <Login error={state.error} inviteToken={route.name === 'join' ? route.token : null} />;
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    case 'report':
      return <ReportScreen key={route.code} code={route.code} />;
    case 'season':
      return <SeasonScreen />;
    default:
      return <Home />;
  }
}
