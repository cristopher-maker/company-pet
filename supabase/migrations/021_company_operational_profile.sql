-- Company ERP operational profile: company sheet, contacts and active contract.

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists industry text,
  add column if not exists employee_count integer check (employee_count is null or employee_count >= 0),
  add column if not exists billing_email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists operational_status text not null default 'onboarding';

alter table public.companies
  drop constraint if exists companies_operational_status_check;

alter table public.companies
  add constraint companies_operational_status_check
  check (operational_status in ('onboarding', 'active', 'paused', 'inactive'));

update public.companies
set plan_tier = 'empresa'
where plan_tier is null or plan_tier = 'lite';

alter table public.companies
  alter column plan_tier set default 'empresa';

alter table public.companies
  drop constraint if exists companies_plan_tier_check;

alter table public.companies
  add constraint companies_plan_tier_check
  check (plan_tier in ('empresa', 'premium'));

create table if not exists public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  contact_type text not null default 'operations'
    check (contact_type in ('hr', 'billing', 'legal', 'operations', 'executive', 'other')),
  is_primary boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_contacts_company_type
on public.company_contacts (company_id, contact_type, is_primary desc, created_at);

drop trigger if exists trg_company_contacts_updated_at on public.company_contacts;
create trigger trg_company_contacts_updated_at
before update on public.company_contacts
for each row execute function public.set_updated_at();

create table if not exists public.company_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_tier text not null check (plan_tier in ('empresa', 'premium')),
  status text not null default 'active'
    check (status in ('draft', 'active', 'pending_renewal', 'expired', 'cancelled')),
  starts_at date,
  renews_at date,
  ends_at date,
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual', 'custom')),
  amount numeric(12,2),
  currency text not null default 'CLP',
  document_id uuid references public.company_documents (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_company_contracts_one_active
on public.company_contracts (company_id)
where status = 'active';

create index if not exists idx_company_contracts_company_status
on public.company_contracts (company_id, status, starts_at desc);

drop trigger if exists trg_company_contracts_updated_at on public.company_contracts;
create trigger trg_company_contracts_updated_at
before update on public.company_contracts
for each row execute function public.set_updated_at();

create or replace function public.is_internal_admin()
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
      and p.role = 'admin'
  );
$$;

alter table public.company_contacts enable row level security;
alter table public.company_contracts enable row level security;

drop policy if exists "company_contacts_select_member" on public.company_contacts;
create policy "company_contacts_select_member"
on public.company_contacts for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company_contacts_manage_company" on public.company_contacts;
create policy "company_contacts_manage_company"
on public.company_contacts for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

drop policy if exists "company_contracts_select_member" on public.company_contracts;
create policy "company_contracts_select_member"
on public.company_contracts for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company_contracts_manage_company" on public.company_contracts;
drop policy if exists "company_contracts_manage_internal_admin" on public.company_contracts;
create policy "company_contracts_manage_internal_admin"
on public.company_contracts for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());
