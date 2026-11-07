-- Pieterpad Tracker – Supabase-schema
-- Voer dit uit in Supabase: SQL Editor → New query → plakken → Run.
-- Het script is idempotent: je kunt het veilig opnieuw uitvoeren.

-- 1. Eén generieke tabel voor alle records (etappes, routes, dagboek, foto's, plekken).
create table if not exists public.pp_records (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind              text        not null check (kind in ('stage', 'route', 'diary', 'photo', 'place')),
  id                text        not null,
  data              jsonb       not null,
  updated_at        bigint      not null,              -- tijdstip van de wijziging op het apparaat (ms)
  deleted           boolean     not null default false, -- tombstone: verwijderd (voor sync en undo)
  server_updated_at timestamptz not null default now(), -- cursor voor "wat is er nieuw sinds…"
  primary key (user_id, kind, id)
);

create index if not exists pp_records_user_server_updated_idx
  on public.pp_records (user_id, server_updated_at);

-- server_updated_at altijd door de server laten zetten.
create or replace function public.pp_touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists pp_records_touch on public.pp_records;
create trigger pp_records_touch
  before insert or update on public.pp_records
  for each row execute function public.pp_touch_server_updated_at();

-- 2. Row Level Security: iedereen ziet en wijzigt alleen zijn eigen gegevens.
alter table public.pp_records enable row level security;

drop policy if exists "eigen records lezen" on public.pp_records;
create policy "eigen records lezen" on public.pp_records
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "eigen records toevoegen" on public.pp_records;
create policy "eigen records toevoegen" on public.pp_records
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "eigen records wijzigen" on public.pp_records;
create policy "eigen records wijzigen" on public.pp_records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "eigen records verwijderen" on public.pp_records;
create policy "eigen records verwijderen" on public.pp_records
  for delete to authenticated using (user_id = auth.uid());

-- 3. Storage-bucket voor foto's (privé). Bestanden staan in <user-id>/<foto-id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "eigen foto's lezen" on storage.objects;
create policy "eigen foto's lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigen foto's uploaden" on storage.objects;
create policy "eigen foto's uploaden" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigen foto's overschrijven" on storage.objects;
create policy "eigen foto's overschrijven" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigen foto's verwijderen" on storage.objects;
create policy "eigen foto's verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
