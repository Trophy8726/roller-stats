// Checks the real Supabase project's rules with the publishable key. Usage: npm run smoke
import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ibgyycalrtnwtfmlzrwk.supabase.co', 'sb_publishable_1ifZJNFPoei1CZQQr7jcIw_1n_cWr1s', {
  auth: { persistSession: false },
});
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${detail}`);
  if (!ok) process.exitCode = 1;
}

let r = await sb.from('games').insert({ code, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: true });
check('insert game', !r.error, r.error?.message);

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
const tag = Math.random().toString(36).slice(2, 8);
const goalieName = `SMOKE ${tag}`;
const row = (over) => ({
  id: crypto.randomUUID(), game_code: code, kind: 'shot_against', period: 1, x: 0.1, y: 0.5, dot: null, result: 'save',
  device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null,
  goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...over,
});
const bare = { x: null, y: null };

r = await sb.from('goalies').insert({ name: goalieName }).select('id').single();
check('insert goalie', !r.error && !!r.data?.id, r.error?.message);
const goalieId = r.data?.id;
r = await sb.from('goalies').insert({ name: `  ${goalieName.toUpperCase()} ` });
check('duplicate goalie name rejected (23505)', r.error?.code === '23505', r.error?.code);
r = await sb.from('goalies').insert({ name: `${goalieName} 2` }).select('id').single();
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
r = await sb.from('events').insert(row({ kind: 'state_their_net', result: 'empty', ...bare }));
check('state_their_net accepted', !r.error, r.error?.message);

const v1Event = { game_code: code, kind: 'shot_for', period: 1, x: 0.9, y: 0.5, dot: null, result: 'goal', device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null };
r = await sb.from('events').insert(v1Event).select();
check('v1-style event (only v1 columns) accepted with defaults', !r.error && r.data?.[0]?.goalie_id === null && r.data?.[0]?.empty_net === false && r.data?.[0]?.strength === 'even' && r.data?.[0]?.penalty_shot === false, r.error?.message);

r = await sb.from('events').insert(row({ kind: 'shot_for', goalie_id: goalieId, x: 0.9 }));
check('shot for with goalie_id rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'shot_against', empty_net: true, goalie_id: goalieId, x: 0.1 }));
check('empty-net shot with goalie_id rejected', !!r.error, r.error?.code);

const code2 = 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');
r = await sb.from('games').insert({ code: code2, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: false });
check('v1-style game insert (only home=false) gets venue away', !r.error && r.data?.venue === 'away', r.error?.message);

const gone = row({});
await sb.from('events').insert(gone);
const t1 = new Date().toISOString();
await sb.from('events').update({ deleted_at: t1 }).eq('id', gone.id);
r = await sb.from('events').select('deleted_at').eq('id', gone.id).single();
const t1Stored = r.data?.deleted_at;
r = await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id).select('deleted_at');
check('re-deleting an already deleted event is idempotent (same timestamp)', !r.error && r.data?.deleted_at === t1Stored, r.error?.message);
r = await sb.from('events').update({ deleted_at: null }).eq('id', gone.id).select('id');
check('a deleted event cannot be restored', !!r.error, r.error?.code);
r = await sb.from('events').update({ empty_net: true }).eq('id', open.id).select('id');
check('empty_net cannot be edited', !!r.error, r.error?.code);

console.log(
  `\nCleanup — paste in Supabase SQL Editor:\n` +
    `delete from events where game_code in ('${code}','${code2}'); delete from games where code in ('${code}','${code2}'); delete from goalies where name like 'SMOKE ${tag}%';`,
);
