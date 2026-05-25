-- Company Pet
-- Care intake forms created by HR/company admins for employees.

create table if not exists public.care_intakes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_care_intakes_company_id on public.care_intakes (company_id);
create index if not exists idx_care_intakes_employee_id on public.care_intakes (employee_id);
create index if not exists idx_care_intakes_created_at on public.care_intakes (created_at desc);

create trigger trg_care_intakes_updated_at
before update on public.care_intakes
for each row execute function public.set_updated_at();

alter table public.care_intakes enable row level security;

drop policy if exists "care_intakes_select_company" on public.care_intakes;
create policy "care_intakes_select_company"
on public.care_intakes for select
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_intakes.company_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "care_intakes_write_company" on public.care_intakes;
create policy "care_intakes_write_company"
on public.care_intakes for all
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_intakes.company_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_intakes.company_id
      and cm.user_id = auth.uid()
  )
);
