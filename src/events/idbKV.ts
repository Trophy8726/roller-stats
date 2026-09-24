import { get, keys, set } from 'idb-keyval';
import type { KV } from './store';

export function idbKV(): KV {
  return { get: (k) => get(k), set: (k, v) => set(k, v), keys: async () => (await keys()).map(String) };
}
