import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { AuthApi, User } from '../auth/api';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { InvalidInviteError, LastOwnerError, type ClubRole, type ClubsApi, type Member, type Membership } from '../clubs/api';
import { ClubProvider } from '../clubs/ClubContext';
import { DuplicateTeamError, type Team, type TeamsApi } from '../teams/api';
import { toRow } from '../domain/factory';
import { AGAINST_KINDS, type Game, type GameEvent, type Goalie } from '../domain/types';
import type { GamesApi } from '../games/api';
import { DuplicateGoalieError, type GoaliesApi } from '../goalies/api';
import type { Remote } from '../events/remote';
import { EventStore, memoryKV } from '../events/store';
import { SyncProvider, type SyncDeps } from '../events/SyncContext';

export function fakeRemote() {
  const rows = new Map<string, GameEvent>();
  const listeners = new Set<(e: GameEvent) => void>();
  let online = true;
  const guard = () => {
    if (!online) throw new Error('offline');
  };
  const remote: Remote = {
    async push(e) {
      guard();
      const r = toRow(e);
      const existing = rows.get(r.id);
      rows.set(r.id, existing ? { ...existing, deleted_at: r.deleted_at ?? existing.deleted_at } : r);
    },
    async fetchEvents(code) {
      guard();
      return [...rows.values()].filter((r) => r.game_code === code);
    },
    async fetchGamesEvents(codes) {
      guard();
      return [...rows.values()].filter((r) => codes.includes(r.game_code) && !r.deleted_at);
    },
    subscribe(code, onEvent, onStatus) {
      const l = (e: GameEvent) => {
        if (e.game_code === code) onEvent(e);
      };
      listeners.add(l);
      onStatus(true);
      return () => listeners.delete(l);
    },
    async assignGoalie(code, goalieId) {
      guard();
      let n = 0;
      for (const [id, r] of rows) {
        if (r.game_code === code && !r.goalie_id && !r.empty_net && !r.deleted_at && AGAINST_KINDS.includes(r.kind)) {
          const next = { ...r, goalie_id: goalieId };
          rows.set(id, next);
          listeners.forEach((l) => l(next));
          n++;
        }
      }
      return n;
    },
  };
  return {
    remote,
    rows,
    setOnline: (v: boolean) => (online = v),
    emit: (e: GameEvent) => listeners.forEach((l) => l(e)),
  };
}

export function fakeGames(initial: Game[] = []) {
  const games = [...initial];
  let failing = false;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const api: GamesApi = {
    async create(input) {
      guard();
      const g: Game = { code: 'K7QX', ...input };
      games.push(g);
      return g;
    },
    async get(code) {
      guard();
      return games.find((g) => g.code === code) ?? null;
    },
    async list(clubId) {
      guard();
      return games.filter((g) => !g.club_id || g.club_id === clubId);
    },
  };
  return { api, games, setFailing: (v: boolean) => (failing = v) };
}

export function fakeGoalies(initial: Goalie[] = []) {
  const list = [...initial];
  let failing = false;
  let n = 0;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clash = (name: string, except?: string) =>
    list.some((g) => g.id !== except && g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const api: GoaliesApi = {
    async list(clubId) {
      guard();
      return list.filter((g) => !g.club_id || g.club_id === clubId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async add(clubId, name) {
      guard();
      if (clash(name)) throw new DuplicateGoalieError('duplicate');
      const g = { id: `goalie-${++n}`, name: name.trim(), club_id: clubId };
      list.push(g);
      return { ...g };
    },
    async rename(id, name) {
      guard();
      if (clash(name, id)) throw new DuplicateGoalieError('duplicate');
      const g = list.find((x) => x.id === id);
      if (!g) throw new Error('unknown goalie');
      g.name = name.trim();
      return { ...g };
    },
  };
  return { api, list, setFailing: (v: boolean) => (failing = v) };
}

export const TEST_USER: User = { id: 'user-1', email: 'paul@example.com', name: 'Paul' };

export function fakeAuth(initial: User | null) {
  let current = initial;
  const listeners = new Set<(u: User | null) => void>();
  const api: AuthApi = {
    current: async () => current,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      current = null;
      listeners.forEach((l) => l(null));
    }),
  };
  return {
    api,
    userId: () => current?.id ?? '',
    setUser(u: User | null) {
      current = u;
      listeners.forEach((l) => l(u));
    },
  };
}

export const DEFAULT_TEAM: Team = { id: 'team-1', club_id: 'club-1', name: 'N2', archived_at: null };
export const DEFAULT_MEMBERSHIP: Membership = { clubId: 'club-1', clubName: 'Aix', role: 'owner' };

export function fakeTeams(initial: Team[] = [DEFAULT_TEAM]) {
  const list = initial.map((x) => ({ ...x }));
  let failing = false;
  let n = 0;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clash = (clubId: string, name: string, except?: string) =>
    list.some((x) => x.club_id === clubId && x.id !== except && x.name.trim().toLowerCase() === name.trim().toLowerCase());
  const find = (id: string) => {
    const x = list.find((y) => y.id === id);
    if (!x) throw new Error('unknown team');
    return x;
  };
  const api: TeamsApi = {
    async list(clubId) {
      guard();
      return list.filter((x) => x.club_id === clubId).map((x) => ({ ...x })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async add(clubId, name) {
      guard();
      if (clash(clubId, name)) throw new DuplicateTeamError('duplicate');
      const x = { id: `team-new-${++n}`, club_id: clubId, name: name.trim(), archived_at: null };
      list.push(x);
      return { ...x };
    },
    async rename(id, name) {
      guard();
      const x = find(id);
      if (clash(x.club_id, name, id)) throw new DuplicateTeamError('duplicate');
      x.name = name.trim();
      return { ...x };
    },
    async setArchived(id, archived) {
      guard();
      const x = find(id);
      x.archived_at = archived ? '2026-10-15T12:00:00Z' : null;
      return { ...x };
    },
  };
  return { api, list, setFailing: (v: boolean) => (failing = v) };
}

type FakeMember = Member & { clubId: string };

export function fakeClubs(teams: Team[], me: () => string) {
  const clubs = [{ id: 'club-1', name: 'Aix' }];
  const members: FakeMember[] = [{ clubId: 'club-1', userId: TEST_USER.id, name: TEST_USER.name, role: 'owner', joinedAt: '2026-10-01T00:00:00Z' }];
  const invites = new Map<string, string>([['club-1', 'token-club-1']]);
  let failing = false;
  let n = 1;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? '?';
  const findMember = (clubId: string, userId: string) => {
    const m = members.find((x) => x.clubId === clubId && x.userId === userId);
    if (!m) throw new Error('unknown member');
    return m;
  };
  const otherOwner = (clubId: string, userId: string) => members.some((x) => x.clubId === clubId && x.role === 'owner' && x.userId !== userId);
  const api: ClubsApi = {
    async mine(userId) {
      guard();
      return members
        .filter((m) => m.userId === userId)
        .map((m) => ({ clubId: m.clubId, clubName: clubName(m.clubId), role: m.role }))
        .sort((a, b) => a.clubName.localeCompare(b.clubName, 'fr'));
    },
    async create(name, teamName) {
      guard();
      const id = `club-${++n}`;
      clubs.push({ id, name: name.trim() });
      members.push({ clubId: id, userId: me(), name: TEST_USER.name, role: 'owner', joinedAt: '2026-10-15T00:00:00Z' });
      teams.push({ id: `team-${id}`, club_id: id, name: teamName.trim(), archived_at: null });
      invites.set(id, `token-${id}`);
      return id;
    },
    async inviteInfo(token) {
      guard();
      const hit = [...invites].find(([, tok]) => tok === token);
      return hit ? { clubId: hit[0], clubName: clubName(hit[0]) } : null;
    },
    async join(token) {
      guard();
      const hit = [...invites].find(([, tok]) => tok === token);
      if (!hit) throw new InvalidInviteError('invalid invite');
      if (!members.some((m) => m.clubId === hit[0] && m.userId === me())) {
        members.push({ clubId: hit[0], userId: me(), name: TEST_USER.name, role: 'member', joinedAt: '2026-10-15T00:00:00Z' });
      }
      return hit[0];
    },
    async members(clubId) {
      guard();
      return members
        .filter((m) => m.clubId === clubId)
        .map(({ userId, name, role, joinedAt }) => ({ userId, name, role, joinedAt }))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'fr') : a.role === 'owner' ? -1 : 1));
    },
    async setRole(clubId, userId, role: ClubRole) {
      guard();
      const m = findMember(clubId, userId);
      if (m.role === 'owner' && role !== 'owner' && !otherOwner(clubId, userId)) throw new LastOwnerError('last owner');
      m.role = role;
    },
    async remove(clubId, userId) {
      guard();
      const m = findMember(clubId, userId);
      if (m.role === 'owner' && !otherOwner(clubId, userId)) throw new LastOwnerError('last owner');
      members.splice(members.indexOf(m), 1);
    },
    async rename(clubId, name) {
      guard();
      const c = clubs.find((x) => x.id === clubId);
      if (c) c.name = name.trim();
    },
    async invite(clubId) {
      guard();
      return invites.get(clubId) ?? '';
    },
    async regenerateInvite(clubId) {
      guard();
      const tok = `token-${clubId}-${++n}`;
      invites.set(clubId, tok);
      return tok;
    },
  };
  return { api, clubs, members, invites, setFailing: (v: boolean) => (failing = v) };
}

export function makeDeps(opts: { games?: Game[]; goalies?: Goalie[]; teams?: Team[]; user?: User | null } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const fgo = fakeGoalies(opts.goalies);
  const fa = fakeAuth(opts.user === undefined ? TEST_USER : opts.user);
  const ft = fakeTeams(opts.teams);
  const fc = fakeClubs(ft.list, () => fa.userId());
  const deps: SyncDeps = {
    store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api, goalies: fgo.api, auth: fa.api, clubs: fc.api, teams: ft.api,
  };
  return { deps, fr, fg, fgo, fa, ft, fc };
}

export function renderWithSync(ui: ReactElement, deps: SyncDeps, opts: { user?: User | null; memberships?: Membership[] } = {}) {
  const user = opts.user === undefined ? TEST_USER : opts.user;
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>
        {user ? (
          <ClubProvider userId={user.id} initial={opts.memberships ?? [DEFAULT_MEMBERSHIP]}>
            {ui}
          </ClubProvider>
        ) : (
          ui
        )}
      </AuthProvider>
    </SyncProvider>,
  );
}

export function renderApp(deps: SyncDeps, user: User | null = TEST_USER) {
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>
        <App />
      </AuthProvider>
    </SyncProvider>,
  );
}
