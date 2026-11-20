-- Accounts, and the one thing an account is for here: where you left off.
--
-- One row per player, holding the same strings the apps already keep locally -- the
-- half-played table, how far through the school you are, how loud it is. The value is
-- literally what localStorage or UserDefaults would have held, so neither app has to
-- reshape anything to put it here or to take it back.
create table public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Your row and nobody else's, in both directions. There is no policy for anon at all,
-- so the publishable key carried in the page can reach nothing on its own.
create policy "a player reads their own save"
  on public.saves for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "a player starts their own save"
  on public.saves for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "a player changes their own save"
  on public.saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Writing one key without clobbering the others. The apps save at different moments --
-- the table on a discard, the school on a lesson, the sound on a press -- so a plain
-- upsert of the whole row would mean read-modify-write and a race between two devices.
-- `||` merges the top level in the one statement instead.
create function public.save_state(patch jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.saves (user_id, state) values (auth.uid(), patch)
  on conflict (user_id) do update
    set state = public.saves.state || excluded.state, updated_at = now();
$$;

-- App Store review guideline 5.1.1(v): an app that lets you make an account has to let
-- you delete it from inside the app. Deleting the auth row cascades the save with it.
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.save_state(jsonb) from public, anon;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.save_state(jsonb) to authenticated;
grant execute on function public.delete_account() to authenticated;
