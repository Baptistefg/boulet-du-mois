-- =====================================================================
--  Boulet du mois : mise à jour v2
--  Contestations, modification des actions par l'admin, photos de profil,
--  actualisation en direct.
--  À exécuter UNE fois : Supabase > SQL Editor > New query > coller > Run
--  (sans risque si tu le relances : rien n'est supprimé)
-- =====================================================================

-- ---------- Contestations ----------
create table if not exists public.contests (
  action_id text not null references public.actions(id) on delete cascade,
  who       text not null check (who in ('Titouan','Abel','Baptiste','Shemseddine','Mehdi')),
  ts        bigint not null,
  primary key (action_id, who)
);
alter table public.contests enable row level security;
drop policy if exists "lecture" on public.contests;
drop policy if exists "ajout" on public.contests;
drop policy if exists "suppression admin" on public.contests;
create policy "lecture" on public.contests for select using (true);
-- Tout le monde peut contester, sauf la personne visée par l'action
create policy "ajout" on public.contests for insert to anon, authenticated
  with check (who <> (select a.who from public.actions a where a.id = action_id));
create policy "suppression admin" on public.contests for delete to authenticated using (true);

-- ---------- Modification des actions : admin uniquement ----------
drop policy if exists "modification admin" on public.actions;
create policy "modification admin" on public.actions for update to authenticated using (true) with check (true);

-- ---------- Photos de profil : admin uniquement ----------
create table if not exists public.profiles (
  who text primary key check (who in ('Titouan','Abel','Baptiste','Shemseddine','Mehdi')),
  v   bigint not null
);
alter table public.profiles enable row level security;
drop policy if exists "lecture" on public.profiles;
drop policy if exists "ajout admin" on public.profiles;
drop policy if exists "modification admin" on public.profiles;
drop policy if exists "suppression admin" on public.profiles;
create policy "lecture" on public.profiles for select using (true);
create policy "ajout admin" on public.profiles for insert to authenticated with check (true);
create policy "modification admin" on public.profiles for update to authenticated using (true) with check (true);
create policy "suppression admin" on public.profiles for delete to authenticated using (true);

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "bdm lecture" on storage.objects;
drop policy if exists "bdm avatars ajout" on storage.objects;
drop policy if exists "bdm suppression admin" on storage.objects;
create policy "bdm lecture" on storage.objects for select using (bucket_id in ('photos', 'coupe', 'avatars'));
create policy "bdm avatars ajout" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "bdm suppression admin" on storage.objects for delete to authenticated using (bucket_id in ('photos', 'coupe', 'avatars'));

-- ---------- Actualisation en direct (Realtime) ----------
do $$
declare t text;
begin
  foreach t in array array['actions', 'contests', 'photos', 'votes', 'cup_photos', 'profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
