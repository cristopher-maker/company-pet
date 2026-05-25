-- Company Pet
-- Pet Expert appointment scheduling MVP.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.care_requests (id) on delete set null,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  expert_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('Videollamada', 'Llamada')),
  scheduled_for timestamptz not null,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_employee_id_scheduled_for
on public.appointments (employee_id, scheduled_for desc);

create index if not exists idx_appointments_expert_id_scheduled_for
on public.appointments (expert_id, scheduled_for desc);

create index if not exists idx_appointments_request_id
on public.appointments (request_id);

create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "appointments_select_own_or_staff" on public.appointments;
create policy "appointments_select_own_or_staff"
on public.appointments for select
to authenticated
using (
  employee_id = auth.uid()
  or expert_id = auth.uid()
  or public.is_staff()
);

drop policy if exists "appointments_insert_own_or_staff" on public.appointments;
create policy "appointments_insert_own_or_staff"
on public.appointments for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    employee_id = auth.uid()
    or public.is_staff()
  )
);

drop policy if exists "appointments_update_own_or_staff" on public.appointments;
create policy "appointments_update_own_or_staff"
on public.appointments for update
to authenticated
using (
  employee_id = auth.uid()
  or expert_id = auth.uid()
  or public.is_staff()
)
with check (
  employee_id = auth.uid()
  or expert_id = auth.uid()
  or public.is_staff()
);
