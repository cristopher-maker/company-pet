-- Contratos: Guarda la tarifa mensual y datos del responsable de pago
create table if not exists public.patient_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  monthly_fee numeric not null default 0,
  currency text not null default 'CLP',
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'cancelled', 'suspended')),
  guarantor_name text,
  guarantor_document_id text,
  guarantor_email text,
  guarantor_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_patient_contract unique(patient_id)
);

-- Cobros / Boletas: Guarda el historial de cobros emitidos a un paciente
create table if not exists public.patient_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  contract_id uuid references public.patient_contracts (id) on delete set null,
  amount numeric not null default 0,
  currency text not null default 'CLP',
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Básico
alter table public.patient_contracts enable row level security;
alter table public.patient_invoices enable row level security;

create policy "patient_contracts_manage" on public.patient_contracts for all to authenticated using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));
create policy "patient_invoices_manage" on public.patient_invoices for all to authenticated using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));