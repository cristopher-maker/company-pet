-- B2B Enterprise Sales CRM: Enhanced leads for company acquisition
-- and provider service catalog for the pet care benefit marketplace.

-- 1. Enhance leads table for B2B enterprise sales
alter table public.leads
  add column if not exists company_name text,
  add column if not exists contact_name text,
  add column if not exists contact_position text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists company_size text check (company_size in ('1-10','11-50','51-200','201-500','500+')),
  add column if not exists industry text,
  add column if not exists source text default 'website',
  add column if not exists notes text,
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists converted_company_id uuid references public.companies (id) on delete set null;

create index if not exists idx_leads_assigned_to
  on public.leads (assigned_to);
create index if not exists idx_leads_status_company_size
  on public.leads (estado, company_size);

-- 2. Provider services catalog (what each provider offers)
create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  description text,
  service_type text not null default 'consulta' check (service_type in ('consulta','paseo','guarderia','peluqueria','veterinaria','entrenamiento','hospedaje','otros')),
  price_from numeric(12,0),
  currency text not null default 'CLP',
  duration_minutes integer,
  active boolean not null default true,
  max_daily_slots integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_services_provider
  on public.provider_services (provider_id, active);
create index if not exists idx_provider_services_type
  on public.provider_services (service_type, active);

drop trigger if exists trg_provider_services_updated_at on public.provider_services;
create trigger trg_provider_services_updated_at
  before update on public.provider_services
  for each row execute function public.set_updated_at();

-- 3. Company benefit plans (what each company plan includes)
create table if not exists public.company_benefit_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  plan_tier text not null check (plan_tier in ('empresa','premium','enterprise')),
  monthly_allowance_per_employee numeric(12,0) not null default 0,
  annual_max_per_employee numeric(12,0) not null default 0,
  covered_service_types text[] not null default '{}',
  max_per_service numeric(12,0) not null default 0,
  copay_percent integer not null default 0 check (copay_percent between 0 and 100),
  active boolean not null default true,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_benefit_plans_company
  on public.company_benefit_plans (company_id, active);

drop trigger if exists trg_company_benefit_plans_updated_at on public.company_benefit_plans;
create trigger trg_company_benefit_plans_updated_at
  before update on public.company_benefit_plans
  for each row execute function public.set_updated_at();

-- 4. Employee benefit usage tracking
create table if not exists public.benefit_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  benefit_plan_id uuid references public.company_benefit_plans (id) on delete set null,
  voucher_id uuid references public.vouchers (id) on delete set null,
  provider_service_id uuid references public.provider_services (id) on delete set null,
  amount_claimed numeric(12,0) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','reimbursed')),
  claimed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_benefit_usage_employee
  on public.benefit_usage (company_id, employee_id, status);
create index if not exists idx_benefit_usage_plan
  on public.benefit_usage (benefit_plan_id);

-- RLS
alter table public.provider_services enable row level security;
alter table public.company_benefit_plans enable row level security;
alter table public.benefit_usage enable row level security;

-- Provider services: company members can view, staff manage
drop policy if exists "provider_services_select_member_or_staff" on public.provider_services;
create policy "provider_services_select_member_or_staff"
  on public.provider_services for select
  to authenticated
  using (public.is_company_member(company_id) or public.is_staff());

drop policy if exists "provider_services_manage_staff" on public.provider_services;
create policy "provider_services_manage_staff"
  on public.provider_services for all
  to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- Company benefit plans: company members can view, staff manage
drop policy if exists "company_benefit_plans_select_member" on public.company_benefit_plans;
create policy "company_benefit_plans_select_member"
  on public.company_benefit_plans for select
  to authenticated
  using (public.is_company_member(company_id));

drop policy if exists "company_benefit_plans_manage_staff" on public.company_benefit_plans;
create policy "company_benefit_plans_manage_staff"
  on public.company_benefit_plans for all
  to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- Benefit usage: employees see own, company managers see all, staff see all
drop policy if exists "benefit_usage_select_self_or_manager" on public.benefit_usage;
create policy "benefit_usage_select_self_or_manager"
  on public.benefit_usage for select
  to authenticated
  using (
    employee_id = auth.uid()
    or public.is_company_member(company_id)
    or public.is_staff()
  );

drop policy if exists "benefit_usage_insert_self" on public.benefit_usage;
create policy "benefit_usage_insert_self"
  on public.benefit_usage for insert
  to authenticated
  with check (employee_id = auth.uid());

drop policy if exists "benefit_usage_manage_staff" on public.benefit_usage;
create policy "benefit_usage_manage_staff"
  on public.benefit_usage for update
  to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

notify pgrst, 'reload schema';
