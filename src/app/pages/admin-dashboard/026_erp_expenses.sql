-- Gastos Operativos de la Empresa
create table if not exists public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category text not null default 'Operativos',
  amount numeric not null default 0,
  currency text not null default 'CLP',
  expense_date date not null default current_date,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS (Políticas de Seguridad)
alter table public.company_expenses enable row level security;

create policy "expenses_manage" on public.company_expenses for all 
to authenticated using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));