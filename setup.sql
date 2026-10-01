-- =====================================================================
--  Boulet du mois : création de la base de données (Supabase)
--  À exécuter UNE fois : Supabase > SQL Editor > New query > coller > Run
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.actions (
  id   text primary key,
  who  text not null check (who in ('Titouan','Abel','Baptiste','Shemseddine','Mehdi')),
  why  text not null check (char_length(why) between 1 and 200),
  pts  int  not null default 1 check (pts between 1 and 3),
  ts   bigint not null
);

create table if not exists public.photos (
  id      text primary key,
  who     text not null check (who in ('Titouan','Abel','Baptiste','Shemseddine','Mehdi')),
  caption text not null default '' check (char_length(caption) <= 120),
  ts      bigint not null
);

create table if not exists public.votes (
  cycle    text not null,
  voter    text not null check (voter in ('Titouan','Abel','Baptiste','Shemseddine','Mehdi')),
  photo_id text not null references public.photos(id) on delete cascade,
  primary key (cycle, voter)
);

create table if not exists public.cup_photos (
  id      text primary key,
  cycle   text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  ts      bigint not null
);

-- ---------- Sécurité (Row Level Security) ----------
-- Tout le monde peut lire et ajouter. Seul l'admin connecté peut supprimer
-- et ajouter des photos avec la coupe. Personne ne peut modifier une action.
alter table public.actions    enable row level security;
alter table public.photos     enable row level security;
alter table public.votes      enable row level security;
alter table public.cup_photos enable row level security;

drop policy if exists "lecture" on public.actions;
drop policy if exists "ajout" on public.actions;
drop policy if exists "suppression admin" on public.actions;
create policy "lecture" on public.actions for select using (true);
create policy "ajout" on public.actions for insert to anon, authenticated with check (true);
create policy "suppression admin" on public.actions for delete to authenticated using (true);

drop policy if exists "lecture" on public.photos;
drop policy if exists "ajout" on public.photos;
drop policy if exists "suppression admin" on public.photos;
create policy "lecture" on public.photos for select using (true);
create policy "ajout" on public.photos for insert to anon, authenticated with check (true);
create policy "suppression admin" on public.photos for delete to authenticated using (true);

drop policy if exists "lecture" on public.votes;
drop policy if exists "ajout" on public.votes;
drop policy if exists "changement de vote" on public.votes;
drop policy if exists "suppression admin" on public.votes;
create policy "lecture" on public.votes for select using (true);
create policy "ajout" on public.votes for insert to anon, authenticated with check (true);
create policy "changement de vote" on public.votes for update to anon, authenticated using (true) with check (true);
create policy "suppression admin" on public.votes for delete to authenticated using (true);

drop policy if exists "lecture" on public.cup_photos;
drop policy if exists "ajout admin" on public.cup_photos;
drop policy if exists "suppression admin" on public.cup_photos;
create policy "lecture" on public.cup_photos for select using (true);
create policy "ajout admin" on public.cup_photos for insert to authenticated with check (true);
create policy "suppression admin" on public.cup_photos for delete to authenticated using (true);

-- ---------- Stockage des images ----------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true), ('coupe', 'coupe', true)
on conflict (id) do nothing;

drop policy if exists "bdm lecture" on storage.objects;
drop policy if exists "bdm photos ajout" on storage.objects;
drop policy if exists "bdm coupe ajout" on storage.objects;
drop policy if exists "bdm suppression admin" on storage.objects;
create policy "bdm lecture" on storage.objects for select using (bucket_id in ('photos', 'coupe'));
create policy "bdm photos ajout" on storage.objects for insert to anon, authenticated with check (bucket_id = 'photos');
create policy "bdm coupe ajout" on storage.objects for insert to authenticated with check (bucket_id = 'coupe');
create policy "bdm suppression admin" on storage.objects for delete to authenticated using (bucket_id in ('photos', 'coupe'));
