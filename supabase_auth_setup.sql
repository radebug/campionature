-- 1) Make sure the table exists
create table if not exists public.catalogue (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.catalogue (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.catalogue enable row level security;

-- 2) Everyone can read
drop policy if exists "catalogue_public_read" on public.catalogue;
create policy "catalogue_public_read"
on public.catalogue
for select
to anon, authenticated
using (true);

-- 3) Only authenticated users can insert/update
drop policy if exists "catalogue_auth_insert" on public.catalogue;
create policy "catalogue_auth_insert"
on public.catalogue
for insert
to authenticated
with check (true);

drop policy if exists "catalogue_auth_update" on public.catalogue;
create policy "catalogue_auth_update"
on public.catalogue
for update
to authenticated
using (true)
with check (true);

-- Optional: prevent delete
drop policy if exists "catalogue_no_delete" on public.catalogue;
create policy "catalogue_no_delete"
on public.catalogue
for delete
to authenticated
using (false);
