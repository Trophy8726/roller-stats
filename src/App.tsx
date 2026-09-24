import { t } from './i18n/fr';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return (
    <main className="page">
      <h1>{t.appName}</h1>
      <p className="muted">{route.name}</p>
    </main>
  );
}
