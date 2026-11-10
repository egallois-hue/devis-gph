-- =====================================================================
-- Devis Gallois PH : base de données (à coller une seule fois dans
-- Supabase → SQL Editor → New query → Run)
-- =====================================================================

-- 1. Table unique des données (devis, prestations, clients, réglages)
create table if not exists public.docs (
  owner      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner, collection, id)
);
create index if not exists docs_owner_updated on public.docs (owner, updated_at);

-- Date de mise à jour fixée par le serveur (synchronisation fiable entre iPhone et Mac)
create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- 2. Sécurité : chaque utilisateur ne voit et ne modifie que ses propres données
alter table public.docs enable row level security;
drop policy if exists docs_owner_all on public.docs;
create policy docs_owner_all on public.docs for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- 3. Stockage privé des devis fournisseurs (photos, PDF)
insert into storage.buckets (id, name, public) values ('annexes', 'annexes', false)
  on conflict (id) do nothing;
drop policy if exists annexes_select on storage.objects;
drop policy if exists annexes_insert on storage.objects;
drop policy if exists annexes_update on storage.objects;
drop policy if exists annexes_delete on storage.objects;
create policy annexes_select on storage.objects for select to authenticated
  using (bucket_id = 'annexes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy annexes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'annexes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy annexes_update on storage.objects for update to authenticated
  using (bucket_id = 'annexes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy annexes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'annexes' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Petite fonction appelée chaque jour par GitHub pour éviter la mise en pause
--    du projet gratuit (elle ne lit aucune donnée).
create or replace function public.keepalive() returns text language sql security definer as $$ select 'ok'::text $$;
grant execute on function public.keepalive() to anon;
