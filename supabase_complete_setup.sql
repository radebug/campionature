
-- Catalogue
create table if not exists public.catalogue (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
insert into public.catalogue (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.catalogue enable row level security;
drop policy if exists "catalogue read anon" on public.catalogue;
create policy "catalogue read anon" on public.catalogue for select to anon using (true);
drop policy if exists "catalogue write auth" on public.catalogue;
create policy "catalogue write auth" on public.catalogue for all to authenticated using (true) with check (true);

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  country text,
  contact text,
  phone text,
  created_at timestamptz default now()
);
alter table public.customers enable row level security;
drop policy if exists "customers auth all" on public.customers;
create policy "customers auth all" on public.customers for all to authenticated using (true) with check (true);

-- Shipments
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by text,
  customer_id uuid references public.customers(id) on delete set null,
  destination jsonb not null default '{}'::jsonb,
  notes text
);
alter table public.shipments enable row level security;
drop policy if exists "shipments auth all" on public.shipments;
create policy "shipments auth all" on public.shipments for all to authenticated using (true) with check (true);

create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  product_id text,
  product_name text,
  qty integer not null default 1 check (qty > 0)
);
alter table public.shipment_items enable row level security;
drop policy if exists "shipment_items auth all" on public.shipment_items;
create policy "shipment_items auth all" on public.shipment_items for all to authenticated using (true) with check (true);
