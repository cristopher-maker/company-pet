-- Tabla de pacientes independiente
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  document_id text,
  birth_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  status text not null default 'active' check (status in ('active', 'discharged', 'deceased')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agregar el vínculo en la tabla de camas/recursos
alter table public.care_resources
add column if not exists patient_id uuid references public.patients (id) on delete set null;

-- Políticas de Seguridad (RLS)
alter table public.patients enable row level security;

create policy "patients_select_company"
on public.patients for select
to authenticated
using (public.is_company_member(company_id));

create policy "patients_manage_company"
on public.patients for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));