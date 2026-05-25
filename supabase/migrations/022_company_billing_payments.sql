-- Company billing: external payment providers, subscriptions, invoices, payments and benefit access.

create table if not exists public.payment_provider_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_customer_id text,
  billing_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_payment_provider_customers_external
on public.payment_provider_customers (provider, external_customer_id)
where external_customer_id is not null;

create index if not exists idx_payment_provider_customers_company
on public.payment_provider_customers (company_id, provider);

drop trigger if exists trg_payment_provider_customers_updated_at on public.payment_provider_customers;
create trigger trg_payment_provider_customers_updated_at
before update on public.payment_provider_customers
for each row execute function public.set_updated_at();

create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  contract_id uuid references public.company_contracts (id) on delete set null,
  provider_customer_id uuid references public.payment_provider_customers (id) on delete set null,
  provider text not null default 'manual' check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_subscription_id text,
  plan_tier text not null check (plan_tier in ('empresa', 'premium')),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'active', 'past_due', 'suspended', 'cancelled')),
  payment_url text,
  external_reference text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  activated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_subscriptions
  add column if not exists external_reference text;

create unique index if not exists uq_company_subscriptions_external
on public.company_subscriptions (provider, external_subscription_id)
where external_subscription_id is not null;

create unique index if not exists uq_company_subscriptions_one_active
on public.company_subscriptions (company_id)
where status = 'active';

create index if not exists idx_company_subscriptions_company_status
on public.company_subscriptions (company_id, status, current_period_end desc);

create unique index if not exists uq_company_subscriptions_external_reference
on public.company_subscriptions (provider, external_reference)
where external_reference is not null;

drop trigger if exists trg_company_subscriptions_updated_at on public.company_subscriptions;
create trigger trg_company_subscriptions_updated_at
before update on public.company_subscriptions
for each row execute function public.set_updated_at();

create table if not exists public.company_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  subscription_id uuid references public.company_subscriptions (id) on delete set null,
  provider text not null default 'manual' check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_invoice_id text,
  external_reference text,
  invoice_number text,
  status text not null default 'open'
    check (status in ('draft', 'open', 'paid', 'overdue', 'void', 'uncollectible')),
  amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'CLP',
  due_at timestamptz,
  paid_at timestamptz,
  hosted_invoice_url text,
  invoice_pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_invoices
  add column if not exists external_reference text;

create unique index if not exists uq_company_invoices_external
on public.company_invoices (provider, external_invoice_id)
where external_invoice_id is not null;

create index if not exists idx_company_invoices_company_status
on public.company_invoices (company_id, status, due_at desc);

create index if not exists idx_company_invoices_external_reference
on public.company_invoices (provider, external_reference);

drop trigger if exists trg_company_invoices_updated_at on public.company_invoices;
create trigger trg_company_invoices_updated_at
before update on public.company_invoices
for each row execute function public.set_updated_at();

create table if not exists public.company_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  subscription_id uuid references public.company_subscriptions (id) on delete set null,
  invoice_id uuid references public.company_invoices (id) on delete set null,
  provider text not null default 'manual' check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_payment_id text,
  external_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'failed', 'refunded', 'cancelled')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'CLP',
  payment_method text,
  paid_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_payments
  add column if not exists external_reference text;

create unique index if not exists uq_company_payments_external
on public.company_payments (provider, external_payment_id)
where external_payment_id is not null;

create index if not exists idx_company_payments_company_status
on public.company_payments (company_id, status, paid_at desc);

create index if not exists idx_company_payments_external_reference
on public.company_payments (provider, external_reference);

drop trigger if exists trg_company_payments_updated_at on public.company_payments;
create trigger trg_company_payments_updated_at
before update on public.company_payments
for each row execute function public.set_updated_at();

create table if not exists public.benefit_entitlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid references public.profiles (id) on delete cascade,
  subscription_id uuid references public.company_subscriptions (id) on delete set null,
  benefit_key text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_benefit_entitlements_company_employee
on public.benefit_entitlements (company_id, employee_id, status, benefit_key);

drop trigger if exists trg_benefit_entitlements_updated_at on public.benefit_entitlements;
create trigger trg_benefit_entitlements_updated_at
before update on public.benefit_entitlements
for each row execute function public.set_updated_at();

create or replace function public.company_has_active_subscription(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_subscriptions s
    where s.company_id = target_company_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end >= now())
  );
$$;

create or replace function public.can_company_use_benefits(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.operational_status in ('onboarding', 'active')
      and public.company_has_active_subscription(c.id)
  );
$$;

alter table public.payment_provider_customers enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.company_invoices enable row level security;
alter table public.company_payments enable row level security;
alter table public.benefit_entitlements enable row level security;

drop policy if exists "payment_provider_customers_select_member" on public.payment_provider_customers;
create policy "payment_provider_customers_select_member"
on public.payment_provider_customers for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "payment_provider_customers_manage_staff" on public.payment_provider_customers;
create policy "payment_provider_customers_manage_staff"
on public.payment_provider_customers for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());

drop policy if exists "company_subscriptions_select_member" on public.company_subscriptions;
create policy "company_subscriptions_select_member"
on public.company_subscriptions for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company_subscriptions_manage_staff" on public.company_subscriptions;
create policy "company_subscriptions_manage_staff"
on public.company_subscriptions for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());

drop policy if exists "company_invoices_select_member" on public.company_invoices;
create policy "company_invoices_select_member"
on public.company_invoices for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company_invoices_manage_staff" on public.company_invoices;
create policy "company_invoices_manage_staff"
on public.company_invoices for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());

drop policy if exists "company_payments_select_member" on public.company_payments;
create policy "company_payments_select_member"
on public.company_payments for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company_payments_manage_staff" on public.company_payments;
create policy "company_payments_manage_staff"
on public.company_payments for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());

drop policy if exists "benefit_entitlements_select_member_or_employee" on public.benefit_entitlements;
create policy "benefit_entitlements_select_member_or_employee"
on public.benefit_entitlements for select
to authenticated
using (
  public.is_company_member(company_id)
  or employee_id = auth.uid()
);

drop policy if exists "benefit_entitlements_manage_staff" on public.benefit_entitlements;
create policy "benefit_entitlements_manage_staff"
on public.benefit_entitlements for all
to authenticated
using (public.is_internal_admin())
with check (public.is_internal_admin());
