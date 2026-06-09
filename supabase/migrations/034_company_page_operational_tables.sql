-- Minimal operational tables required by /company.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists industry text,
  add column if not exists employee_count integer check (employee_count is null or employee_count >= 0),
  add column if not exists billing_email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists operational_status text not null default 'onboarding',
  add column if not exists plan_tier text default 'empresa';

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

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text,
  entity_id uuid,
  document_type text not null default 'other',
  title text not null,
  file_name text,
  storage_bucket text not null default 'company-documents',
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status text not null default 'draft',
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_documents_company_entity
on public.company_documents (company_id, entity_type, entity_id, created_at desc);

drop trigger if exists trg_company_documents_updated_at on public.company_documents;
create trigger trg_company_documents_updated_at
before update on public.company_documents
for each row execute function public.set_updated_at();

create table if not exists public.company_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_tier text not null default 'empresa',
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

create index if not exists idx_company_contracts_company_status
on public.company_contracts (company_id, status, starts_at desc);

drop trigger if exists trg_company_contracts_updated_at on public.company_contracts;
create trigger trg_company_contracts_updated_at
before update on public.company_contracts
for each row execute function public.set_updated_at();

create table if not exists public.onboarding_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null default 'Onboarding empresa',
  plan_tier text,
  owner_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'paused')),
  starts_at date,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_projects_company_status
on public.onboarding_projects (company_id, status, created_at desc);

drop trigger if exists trg_onboarding_projects_updated_at on public.onboarding_projects;
create trigger trg_onboarding_projects_updated_at
before update on public.onboarding_projects
for each row execute function public.set_updated_at();

create table if not exists public.payment_provider_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null default 'manual' check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_customer_id text,
  billing_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  contract_id uuid references public.company_contracts (id) on delete set null,
  provider_customer_id uuid references public.payment_provider_customers (id) on delete set null,
  provider text not null default 'manual' check (provider in ('stripe', 'flow', 'mercadopago', 'manual')),
  external_subscription_id text,
  plan_tier text not null default 'empresa',
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

create index if not exists idx_company_subscriptions_company_status
on public.company_subscriptions (company_id, status, current_period_end desc);

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

create index if not exists idx_company_invoices_company_status
on public.company_invoices (company_id, status, due_at desc);

drop trigger if exists trg_company_invoices_updated_at on public.company_invoices;
create trigger trg_company_invoices_updated_at
before update on public.company_invoices
for each row execute function public.set_updated_at();

grant select, insert, update, delete on
  public.company_contacts,
  public.company_documents,
  public.company_contracts,
  public.onboarding_projects,
  public.payment_provider_customers,
  public.company_subscriptions,
  public.company_invoices
to authenticated;

notify pgrst, 'reload schema';
