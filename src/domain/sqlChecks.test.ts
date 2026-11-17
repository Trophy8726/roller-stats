import { readFileSync } from 'node:fs';
import type { Kind, Role } from './types';

// The database refuses a kind or role its checks do not list, and a refused entry blocks the tablet's outbox:
// every kind and role the app can send must be allowed by the last definition in the migrations, applied in this order.
const MIGRATIONS = ['schema.sql', 'migration-v2.sql', 'migration-v3a.sql', 'migration-v3b.sql'];
const sql = MIGRATIONS.map((f) => readFileSync(`supabase/${f}`, 'utf8')).join('\n');

const KINDS = [
  'shot_for', 'shot_against', 'turnover', 'faceoff', 'own_goal_for', 'own_goal_against', 'shootout_for', 'shootout_against',
  'note', 'state_our_goalie', 'state_their_net', 'state_strength',
] as const satisfies readonly Kind[];
const ROLES = ['shots_for', 'shots_against', 'turnovers', 'faceoffs', 'all'] as const satisfies readonly Role[];
// Compile-time: a Kind or Role added to types.ts without being listed here fails the type check.
const allKinds: Exclude<Kind, (typeof KINDS)[number]> extends never ? true : false = true;
const allRoles: Exclude<Role, (typeof ROLES)[number]> extends never ? true : false = true;

/** The quoted values of the last `<column> in (...)` check matching `pattern`. */
function lastList(pattern: RegExp): string[] {
  const matches = [...sql.matchAll(pattern)];
  const last = matches[matches.length - 1];
  return last ? [...last[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];
}

describe('database checks', () => {
  it('lists every kind the app sends', () => {
    expect(allKinds).toBe(true);
    const allowed = lastList(/events_kind_check check \(kind in \(([^)]*)\)/g);
    expect(KINDS.filter((k) => !allowed.includes(k))).toEqual([]);
  });

  it('lists every device role the app sends', () => {
    expect(allRoles).toBe(true);
    const allowed = lastList(/check \(device_role in \(([^)]*)\)/g);
    expect(ROLES.filter((r) => !allowed.includes(r))).toEqual([]);
  });
});
