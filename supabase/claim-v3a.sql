-- Run AFTER the v3a deploy, once you have signed in with Google on the new app.
-- Replace the address on the marked line with the Google address you signed in with, then Run.
-- It makes that account owner ("Responsable") of the two clubs created by migration-v3a.sql. Nothing stays behind.
do $$
declare uid uuid;
begin
  select id into uid from auth.users
  where lower(email) = lower('ADRESSE_GOOGLE@gmail.com');  -- <- your Google address here
  if uid is null then
    raise exception 'No account with this address yet: sign in with Google on the app first, then run this again.';
  end if;
  insert into public.club_members (club_id, user_id, role)
    select c.id, uid, 'owner' from public.clubs c where c.name in ('Aix-en-Provence', 'Maisons-Laffitte')
  on conflict (club_id, user_id) do update set role = 'owner';
end $$;
