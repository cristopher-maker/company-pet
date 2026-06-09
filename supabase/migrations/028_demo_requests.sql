-- Public demo requests from the landing page.

create extension if not exists "pgcrypto";

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company_name text not null,
  work_email text not null,
  phone text,
  message text,
  source text not null default 'landing',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demo_requests_created_at on public.demo_requests (created_at desc);
create index if not exists idx_demo_requests_status on public.demo_requests (status);

drop trigger if exists trg_demo_requests_updated_at on public.demo_requests;
create trigger trg_demo_requests_updated_at
before update on public.demo_requests
for each row execute function public.set_updated_at();

alter table public.demo_requests enable row level security;

drop policy if exists "demo_requests_insert_public" on public.demo_requests;
create policy "demo_requests_insert_public"
on public.demo_requests for insert
to anon, authenticated
with check (
  length(trim(full_name)) > 1
  and length(trim(company_name)) > 1
  and work_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
);

drop policy if exists "demo_requests_select_admin" on public.demo_requests;
create policy "demo_requests_select_admin"
on public.demo_requests for select
to authenticated
using (public.is_admin());

drop policy if exists "demo_requests_update_admin" on public.demo_requests;
create policy "demo_requests_update_admin"
on public.demo_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
