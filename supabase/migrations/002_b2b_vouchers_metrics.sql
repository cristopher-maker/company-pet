-- Company Pet
-- Add B2B (empresas), vouchers, onboarding and analytics tables.

-- Expand profile roles to support corporate admin/manager use-cases.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'admin', 'company_admin', 'manager', 'pet_expert'));

-- Update helper functions to treat company_admin as admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'company_admin')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_pet_expert();
$$;

-- Companies (tenants)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_domain_unique unique (domain)
);

create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- Company membership (empleados y roles RR.HH.)
create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'employee'
    check (member_role in ('employee', 'hr_admin', 'manager')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_company_members_user_id on public.company_members (user_id);

-- Co-branding / personalización por empresa
create table if not exists public.company_branding (
  company_id uuid primary key references public.companies (id) on delete cascade,
  logo_url text,
  primary_color text,
  secondary_color text,
  updated_at timestamptz not null default now()
);

create trigger trg_company_branding_updated_at
before update on public.company_branding
for each row execute function public.set_updated_at();

-- Vouchers (beneficios / descuentos)
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null default 'text' check (discount_type in ('percentage', 'amount', 'text')),
  discount_value numeric,
  currency text not null default 'CLP',
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vouchers_company_id on public.vouchers (company_id);
create index if not exists idx_vouchers_active on public.vouchers (active);

create trigger trg_vouchers_updated_at
before update on public.vouchers
for each row execute function public.set_updated_at();

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint uq_voucher_redemptions_voucher_user unique (voucher_id, user_id)
);

create index if not exists idx_voucher_redemptions_user_id on public.voucher_redemptions (user_id);

-- Company onboarding (checklist / configuración inicial)
create table if not exists public.company_onboarding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  step_key text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_company_onboarding_step unique (company_id, step_key)
);

create index if not exists idx_company_onboarding_company_id on public.company_onboarding (company_id);

create trigger trg_company_onboarding_updated_at
before update on public.company_onboarding
for each row execute function public.set_updated_at();

-- Analytics / métricas (evento simple, base para ROI)
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  event_name text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_company_id_created_at
on public.analytics_events (company_id, created_at desc);

-- RLS
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_branding enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.company_onboarding enable row level security;
alter table public.analytics_events enable row level security;

-- Basic policies:
-- - Users can read their own company membership.
-- - Company admins (profile role company_admin/admin) can manage company data.
-- - Vouchers are readable by authenticated users; redemptions are per-user.

drop policy if exists "company_members_select_own" on public.company_members;
create policy "company_members_select_own"
on public.company_members for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "companies_select_admin" on public.companies;
create policy "companies_select_admin"
on public.companies for select
to authenticated
using (public.is_admin());

drop policy if exists "companies_write_admin" on public.companies;
create policy "companies_write_admin"
on public.companies for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "company_branding_select_authenticated" on public.company_branding;
create policy "company_branding_select_authenticated"
on public.company_branding for select
to authenticated
using (true);

drop policy if exists "company_branding_write_admin" on public.company_branding;
create policy "company_branding_write_admin"
on public.company_branding for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vouchers_select_authenticated" on public.vouchers;
create policy "vouchers_select_authenticated"
on public.vouchers for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "vouchers_write_admin" on public.vouchers;
create policy "vouchers_write_admin"
on public.vouchers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "voucher_redemptions_select_own_or_admin" on public.voucher_redemptions;
create policy "voucher_redemptions_select_own_or_admin"
on public.voucher_redemptions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "voucher_redemptions_insert_own" on public.voucher_redemptions;
create policy "voucher_redemptions_insert_own"
on public.voucher_redemptions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "company_onboarding_select_admin" on public.company_onboarding;
create policy "company_onboarding_select_admin"
on public.company_onboarding for select
to authenticated
using (public.is_admin());

drop policy if exists "company_onboarding_write_admin" on public.company_onboarding;
create policy "company_onboarding_write_admin"
on public.company_onboarding for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "analytics_events_insert_authenticated" on public.analytics_events;
create policy "analytics_events_insert_authenticated"
on public.analytics_events for insert
to authenticated
with check (true);

drop policy if exists "analytics_events_select_admin" on public.analytics_events;
create policy "analytics_events_select_admin"
on public.analytics_events for select
to authenticated
using (public.is_admin());

