import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'season' }
  | { name: 'record'; code: string }
  | { name: 'report'; code: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'saisie' && parts[1]) return { name: 'record', code: parts[1].toUpperCase() };
  if (parts[0] === 'rapport' && parts[1]) return { name: 'report', code: parts[1].toUpperCase() };
  if (parts[0] === 'saison') return { name: 'season' };
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'season':
      return '#/saison';
    case 'record':
      return `#/saisie/${r.code}`;
    case 'report':
      return `#/rapport/${r.code}`;
  }
}

export function navigate(r: Route): void {
  window.location.hash = href(r);
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}
