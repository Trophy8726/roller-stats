import { useRoute } from './router';
import { Home } from './screens/Home';
import { RecordScreen } from './screens/record/RecordScreen';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    default:
      return <Home />;
  }
}
