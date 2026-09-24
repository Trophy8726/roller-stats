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

console.log(`\nCleanup — paste in Supabase SQL Editor:\ndelete from events where game_code='${code}'; delete from games where code='${code}';`);
