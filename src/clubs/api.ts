import type { SupabaseClient } from '@supabase/supabase-js';

export type ClubRole = 'owner' | 'member';

export interface Membership {
  clubId: string;
  clubName: string;
  role: ClubRole;
}

export interface Member {
  userId: string;
  name: string;
  role: ClubRole;
  joinedAt: string;
}

/** The invitation token is unknown or has been regenerated (SQLSTATE RS002). */
export class InvalidInviteError extends Error {}
/** The club would be left without an owner (SQLSTATE RS001). */
export class LastOwnerError extends Error {}

export interface ClubsApi {
  mine(userId: string): Promise<Membership[]>;
  create(clubName: string, teamName: string): Promise<string>;
  inviteInfo(token: string): Promise<{ clubId: string; clubName: string } | null>;
  join(token: string): Promise<string>;
  members(clubId: string): Promise<Member[]>;
  setRole(clubId: string, userId: string, role: ClubRole): Promise<void>;
  remove(clubId: string, userId: string): Promise<void>;
  rename(clubId: string, name: string): Promise<void>;
  invite(clubId: string): Promise<string>;
  regenerateInvite(clubId: string): Promise<string>;
}

const fail = (e: { code?: string; message: string }): never => {
  if (e.code === 'RS001') throw new LastOwnerError(e.message);
  if (e.code === 'RS002') throw new InvalidInviteError(e.message);
  throw new Error(e.message);
};

const byClubName = (a: Membership, b: Membership) => a.clubName.localeCompare(b.clubName, 'fr');
const ownersFirst = (a: Member, b: Member) => (a.role === b.role ? a.name.localeCompare(b.name, 'fr') : a.role === 'owner' ? -1 : 1);

type MembershipRow = { role: ClubRole; clubs: { id: string; name: string } };
type MemberRow = { user_id: string; role: ClubRole; joined_at: string; profiles: { display_name: string } | null };

export function supabaseClubs(client: SupabaseClient): ClubsApi {
  return {
    async mine(userId) {
      const { data, error } = await client.from('club_members').select('role, clubs(id, name)').eq('user_id', userId);
      if (error) fail(error);
      return ((data ?? []) as unknown as (Omit<MembershipRow, 'clubs'> & { clubs: MembershipRow['clubs'] | null })[])
        .filter((r): r is MembershipRow => r.clubs !== null)
        .map((r) => ({ clubId: r.clubs.id, clubName: r.clubs.name, role: r.role })).sort(byClubName);
    },
    async create(clubName, teamName) {
      const { data, error } = await client.rpc('create_club', { club_name: clubName.trim(), team_name: teamName.trim() });
      if (error) fail(error);
      return data as string;
    },
    async inviteInfo(token) {
      const { data, error } = await client.rpc('invite_info', { invite_token: token });
      if (error) fail(error);
      const row = ((data ?? []) as { club_id: string; club_name: string }[])[0];
      return row ? { clubId: row.club_id, clubName: row.club_name } : null;
    },
    async join(token) {
      const { data, error } = await client.rpc('join_club', { invite_token: token });
      if (error) fail(error);
      return data as string;
    },
    async members(clubId) {
      const { data, error } = await client.from('club_members').select('user_id, role, joined_at, profiles(display_name)').eq('club_id', clubId);
      if (error) fail(error);
      return ((data ?? []) as unknown as MemberRow[])
        .map((r) => ({ userId: r.user_id, name: r.profiles?.display_name || '—', role: r.role, joinedAt: r.joined_at }))
        .sort(ownersFirst);
    },
    async setRole(clubId, userId, role) {
      const { error } = await client.from('club_members').update({ role }).eq('club_id', clubId).eq('user_id', userId);
      if (error) fail(error);
    },
    async remove(clubId, userId) {
      const { error } = await client.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
      if (error) fail(error);
    },
    async rename(clubId, name) {
      const { error } = await client.from('clubs').update({ name: name.trim() }).eq('id', clubId);
      if (error) fail(error);
    },
    async invite(clubId) {
      const { data, error } = await client.rpc('club_invite', { club: clubId });
      if (error) fail(error);
      return data as string;
    },
    async regenerateInvite(clubId) {
      const { data, error } = await client.rpc('regenerate_invite', { club: clubId });
      if (error) fail(error);
      return data as string;
    },
  };
}
