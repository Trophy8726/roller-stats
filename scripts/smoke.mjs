// Checks the v3a database rules on the STAGING Supabase project. Usage: npm run smoke
// Needs .env.development (staging URL + publishable key, committed) and the git-ignored .env.smoke.local:
//   SMOKE_A_EMAIL=...  SMOKE_A_PASSWORD=...  SMOKE_B_EMAIL=...  SMOKE_B_PASSWORD=...
// (two users created in the staging dashboard: Authentication → Users → Add user, Auto Confirm).
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const production = readEnv('.env');
const env = { ...readEnv('.env.development'), ...readEnv('.env.smoke.local') };
const prodRef = production.VITE_SUPABASE_URL ? new URL(production.VITE_SUPABASE_URL).hostname.split('.')[0].toLowerCase() : '';
if (
  !env.VITE_SUPABASE_URL ||
  env.VITE_SUPABASE_URL === production.VITE_SUPABASE_URL ||
  (prodRef && env.VITE_SUPABASE_URL.toLowerCase().includes(prodRef))
) {
  console.error('Refusing to run: .env.development must point at the staging project, never at production.');
  process.exit(1);
}
for (const k of ['SMOKE_A_EMAIL', 'SMOKE_A_PASSWORD', 'SMOKE_B_EMAIL', 'SMOKE_B_PASSWORD']) {
  if (!env[k]) {
    console.error(`${k} is missing from .env.smoke.local`);
    process.exit(1);
  }
}

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY, { auth: { persistSession: false } });
async function signedIn(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Sign-in failed for ${email}: ${error.message}`);
    process.exit(1);
  }
  return { c, id: data.user.id };
}
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${detail}`);
  if (!ok) process.exitCode = 1;
}

const { c: a, id: aId } = await signedIn(env.SMOKE_A_EMAIL, env.SMOKE_A_PASSWORD);
const { c: b, id: bId } = await signedIn(env.SMOKE_B_EMAIL, env.SMOKE_B_PASSWORD);
const anon = client();
const sb = a; // the v2 block below runs as user A, inside A's club
const tag = Math.random().toString(36).slice(2, 8);
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');

// ---- clubs and teams ------------------------------------------------------
let r = await a.rpc('create_club', { club_name: `SMOKE ${tag}`, team_name: 'N2' });
check('create_club', !r.error && typeof r.data === 'string', r.error?.message);
const clubId = r.data;
r = await a.from('teams').select('id').eq('club_id', clubId).single();
const teamId = r.data?.id;
check('create_club also creates the first team', !r.error && !!teamId, r.error?.message);
r = await a.from('club_members').select('role').eq('club_id', clubId).eq('user_id', aId).single();
check('creator is owner', r.data?.role === 'owner', r.error?.message);
r = await a.rpc('club_invite', { club: clubId });
const token = r.data;
check('owner reads the invite token', !r.error && typeof token === 'string' && token.length === 64, r.error?.message);

const code = newCode();
const game = { code, club_id: clubId, team_id: teamId, team_name: 'N2', opponent: 'SMOKE', game_date: '2026-01-01', home: true };
r = await a.from('games').insert(game);
check('member creates a game in his club', !r.error, r.error?.message);
const row = (over) => ({
  id: crypto.randomUUID(), game_code: code, kind: 'shot_against', period: 1, x: 0.1, y: 0.5, dot: null, result: 'save',
  device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null,
  goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...over,
});
const first = row({});
r = await a.from('events').insert(first);
check('member records an event', !r.error, r.error?.message);
r = await a.from('events').select('created_by').eq('id', first.id).single();
check('created_by is stamped with the author', r.data?.created_by === aId, JSON.stringify(r.data));
const spoofed = row({ created_by: bId });
r = await a.from('events').insert(spoofed);
r = await a.from('events').select('created_by').eq('id', spoofed.id).single();
check('a client cannot choose created_by', r.data?.created_by === aId, JSON.stringify(r.data));

// ---- signed out -----------------------------------------------------------
r = await anon.from('games').select('code').eq('code', code);
check('signed out: no game visible', !!r.error || r.data.length === 0, r.error?.code);
r = await anon.from('events').insert(row({}));
check('signed out: insert refused', !!r.error, r.error?.code);
r = await anon.rpc('create_club', { club_name: 'x', team_name: 'y' });
check('signed out: create_club refused', !!r.error, r.error?.code);
r = await anon.rpc('game_club', { game: code });
check('signed out: helper functions not callable', !!r.error, r.error?.code);

// ---- another club ---------------------------------------------------------
r = await b.from('games').select('code').eq('code', code);
check('other account: game invisible', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').select('id').eq('game_code', code);
check('other account: events invisible', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').insert(row({}));
check('other account: event insert refused (42501)', r.error?.code === '42501', r.error?.code);
r = await b.from('games').insert({ ...game, code: newCode() });
check('other account: game insert refused', !!r.error, r.error?.code);
r = await b.rpc('club_invite', { club: clubId });
check('non-member cannot read the invite token', !!r.error, r.error?.code);
r = await b.from('club_invites').select('token');
check('club_invites not readable directly', !!r.error, r.error?.code);
r = await b.rpc('create_club', { club_name: `SMOKE ${tag} B`, team_name: 'X' });
check('second club created', !r.error && typeof r.data === 'string', r.error?.message);
const clubB = r.data;
r = await b.from('teams').select('id').eq('club_id', clubB).single();
const teamB = r.data?.id;
check('second club team', !!teamB, r.error?.message);
r = await a.from('games').insert({ ...game, code: newCode(), team_id: teamB });
check('a game cannot use the team of another club (23503)', r.error?.code === '23503', r.error?.code);

// ---- joining ---------------------------------------------------------------
r = await b.rpc('invite_info', { invite_token: token });
check('invite_info names the club', !r.error && r.data?.[0]?.club_name === `SMOKE ${tag}`, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('join_club with a valid token', !r.error && r.data === clubId, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('joining twice is harmless', !r.error && r.data === clubId, r.error?.message);
r = await b.from('club_members').select('role').eq('club_id', clubId).eq('user_id', bId).single();
check('joiner is a member, not an owner', r.data?.role === 'member', JSON.stringify(r.data));
r = await b.from('games').select('code').eq('code', code);
check('member now sees the game', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('events').insert(row({}));
check('member records an event in the club game', !r.error, r.error?.message);
r = await b.rpc('club_invite', { club: clubId });
check('member cannot read the invite token', !!r.error, r.error?.code);
r = await b.rpc('regenerate_invite', { club: clubId });
check('member cannot regenerate the invite', !!r.error, r.error?.code);
r = await b.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', bId).select();
check('member cannot promote himself', !!r.error || r.data.length === 0, r.error?.code);
r = await b.from('clubs').update({ name: 'hacked' }).eq('id', clubId).select();
check('member cannot rename the club', !!r.error || r.data.length === 0, r.error?.code);
r = await b.from('teams').insert({ club_id: clubId, name: 'U17' }).select('id').single();
const u17 = r.data?.id;
check('member adds a team', !r.error && !!u17, r.error?.message);
r = await b.from('teams').insert({ club_id: clubId, name: ' u17 ' });
check('duplicate team name refused (23505)', r.error?.code === '23505', r.error?.code);
r = await b.from('teams').update({ name: 'U17 B' }).eq('id', u17).select('id');
check('member renames a team', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('teams').update({ archived_at: new Date().toISOString() }).eq('id', u17).select('id');
check('member cannot archive a team', !!r.error, r.error?.code);
r = await a.from('teams').update({ archived_at: new Date().toISOString() }).eq('id', u17).select('id');
check('owner archives a team', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('profiles').select('display_name').eq('id', aId);
check('members see each other in profiles', !r.error && r.data.length === 1, r.error?.message);

// ---- owners -----------------------------------------------------------------
r = await a.from('club_members').delete().eq('club_id', clubId).eq('user_id', aId).select();
check('last owner cannot leave (RS001)', r.error?.code === 'RS001', r.error?.code);
r = await a.from('club_members').update({ role: 'member' }).eq('club_id', clubId).eq('user_id', aId).select();
check('last owner cannot step down (RS001)', r.error?.code === 'RS001', r.error?.code);
r = await a.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', bId).select();
check('owner promotes a member', !r.error && r.data.length === 1, r.error?.message);
r = await a.from('club_members').update({ role: 'member' }).eq('club_id', clubId).eq('user_id', aId).select();
check('an owner may step down when another owner exists', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', aId).select();
check('restore A as owner', !r.error && r.data.length === 1, r.error?.message);
r = await a.rpc('regenerate_invite', { club: clubId });
check('owner regenerates the invite', !r.error && typeof r.data === 'string' && r.data !== token, r.error?.message);
r = await b.rpc('invite_info', { invite_token: token });
check('old token no longer resolves', !r.error && r.data.length === 0, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('old token cannot join (RS002)', r.error?.code === 'RS002', r.error?.code);
r = await a.from('club_members').delete().eq('club_id', clubId).eq('user_id', bId).select();
check('owner removes a member', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('games').select('code').eq('code', code);
check('removed member no longer sees the game', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').insert(row({}));
check('removed member: insert refused (42501)', r.error?.code === '42501', r.error?.code);

const id = crypto.randomUUID();
const ev = { id, game_code: code, kind: 'shot_for', period: 1, x: 0.9, y: 0.5, dot: null, result: 'goal', device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null };
r = await sb.from('events').insert(ev);
check('insert event', !r.error, r.error?.message);
r = await sb.from('events').insert(ev);
check('duplicate insert reports 23505', r.error?.code === '23505', r.error?.code);
r = await sb.from('events').insert({ ...ev, id: crypto.randomUUID(), result: 'won' });
check('malformed event rejected', !!r.error, r.error?.code);
r = await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
check('soft delete allowed', !r.error, r.error?.message);
r = await sb.from('events').update({ result: 'save' }).eq('id', id);
check('other updates refused', !!r.error, r.error?.code);
r = await sb.from('events').delete().eq('id', id).select();
check('hard delete refused', !!r.error || (r.data?.length ?? 0) === 0, r.error?.code);
r = await sb.from('events').select('id,deleted_at').eq('id', id).single();
check('row still present and soft-deleted', !!r.data?.deleted_at, JSON.stringify(r.data));

// ---- v2 rules ----------------------------------------------------------
const goalieName = `SMOKE ${tag}`;
const bare = { x: null, y: null };

r = await sb.from('goalies').insert({ club_id: clubId, name: goalieName }).select('id').single();
check('insert goalie', !r.error && !!r.data?.id, r.error?.message);
const goalieId = r.data?.id;
r = await sb.from('goalies').insert({ club_id: clubId, name: `  ${goalieName.toUpperCase()} ` });
check('duplicate goalie name rejected (23505)', r.error?.code === '23505', r.error?.code);
r = await sb.from('goalies').insert({ club_id: clubId, name: `${goalieName} 2` }).select('id').single();
const goalie2 = r.data?.id;
check('insert second goalie', !r.error && !!goalie2, r.error?.message);
r = await sb.from('goalies').update({ name: `${goalieName} bis` }).eq('id', goalie2).select('id');
check('rename goalie allowed', !r.error && r.data?.length === 1, r.error?.message);
r = await sb.from('goalies').delete().eq('id', goalie2).select();
check('goalie delete refused', !!r.error || (r.data?.length ?? 0) === 0, r.error?.code);

r = await sb.from('events').insert(row({ period: 3 }));
check('overtime period accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'shot_for', result: 'goal', penalty_shot: true, ...bare }));
check('penalty shot without position accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ ...bare }));
check('shot without position that is not a penalty rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'own_goal_against', result: 'goal', ...bare }));
check('own goal accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'shootout_for', result: 'missed', ...bare }));
check('shootout attempt accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'note', result: 'note', note: 'smoke', ...bare }));
check('note accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'note', result: 'note', note: 'x'.repeat(201), ...bare }));
check('note over 200 characters rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'goalie', goalie_id: goalieId, ...bare }));
check('goalie state with a goalie accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'goalie', goalie_id: null, ...bare }));
check('goalie state without a goalie rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'empty', goalie_id: null, ...bare }));
check('empty-net state accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'state_strength', result: 'pp', strength: 'pp', ...bare }));
check('strength state accepted', !r.error, r.error?.message);

const open = row({ result: 'goal' });
r = await sb.from('events').insert(open);
check('insert shot against without goalie', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', open.id).select('id');
check('goalie can be filled in on a shot against', !r.error && r.data?.length === 1, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalie2 }).eq('id', open.id).select('id');
check('an attached goalie cannot be replaced', !!r.error, r.error?.code);
r = await sb.from('events').update({ goalie_id: null }).eq('id', open.id).select('id');
check('an attached goalie cannot be removed', !!r.error, r.error?.code);
const forShot = row({ kind: 'shot_for', x: 0.9 });
r = await sb.from('events').insert(forShot);
check('insert shot for', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', forShot.id).select('id');
check('no goalie on a shot for', !!r.error, r.error?.code);
const emptyShot = row({ empty_net: true, result: 'goal' });
r = await sb.from('events').insert(emptyShot);
check('insert empty-net shot', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', emptyShot.id).select('id');
check('no goalie on an empty-net shot', !!r.error, r.error?.code);
const goneShot = row({ result: 'goal' });
r = await sb.from('events').insert(goneShot);
check('insert shot against to soft-delete', !r.error, r.error?.message);
await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', goneShot.id);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', goneShot.id).select('id');
check('no goalie on a soft-deleted shot against', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_their_net', result: 'empty', ...bare }));
check('state_their_net accepted', !r.error, r.error?.message);

const v1Event = { id: crypto.randomUUID(), game_code: code, kind: 'shot_for', period: 1, x: 0.9, y: 0.5, dot: null, result: 'goal', device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null };
r = await sb.from('events').insert(v1Event).select();
check('v1-style event (only v1 columns) accepted with defaults', !r.error && r.data?.[0]?.goalie_id === null && r.data?.[0]?.empty_net === false && r.data?.[0]?.strength === 'even' && r.data?.[0]?.penalty_shot === false, r.error?.message);

r = await sb.from('events').insert(row({ kind: 'shot_for', goalie_id: goalieId, x: 0.9 }));
check('shot for with goalie_id rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'shot_against', empty_net: true, goalie_id: goalieId, x: 0.1 }));
check('empty-net shot with goalie_id rejected', !!r.error, r.error?.code);

const code2 = 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');
r = await sb.from('games').insert({ code: code2, club_id: clubId, team_id: teamId, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: false }).select('venue').single();
check('v1-style game insert (only home=false) gets venue away', !r.error && r.data?.venue === 'away', r.error?.message);

const gone = row({});
await sb.from('events').insert(gone);
const t1 = new Date().toISOString();
await sb.from('events').update({ deleted_at: t1 }).eq('id', gone.id);
r = await sb.from('events').select('deleted_at').eq('id', gone.id).single();
const t1Stored = r.data?.deleted_at;
r = await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id).select('deleted_at');
check('re-deleting an already deleted event is idempotent (same timestamp)', !r.error && r.data?.[0]?.deleted_at === t1Stored, r.error?.message);
r = await sb.from('events').update({ deleted_at: null }).eq('id', gone.id).select('id');
check('a deleted event cannot be restored', !!r.error, r.error?.code);
r = await sb.from('events').update({ empty_net: true }).eq('id', open.id).select('id');
check('empty_net cannot be edited', !!r.error, r.error?.code);

console.log(
  `\nCleanup (staging) — paste in the SQL Editor:\n` +
    `delete from events where game_code in (select code from games where club_id in ('${clubId}','${clubB}'));\n` +
    `delete from games where club_id in ('${clubId}','${clubB}'); delete from goalies where club_id in ('${clubId}','${clubB}');\n` +
    `delete from clubs where id in ('${clubId}','${clubB}');`,
);
