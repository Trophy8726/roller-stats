import { useRoute } from './router';
import { Home } from './screens/Home';

export function App() {
  const route = useRoute();
  switch (route.name) {
    default:
      return <Home />;
  }
}
