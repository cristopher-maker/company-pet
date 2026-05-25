create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.care_requests (id) on delete set null,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_care_tasks_employee_id_created_at
on public.care_tasks (employee_id, created_at desc);

create index if not exists idx_care_tasks_request_id
on public.care_tasks (request_id);

drop trigger if exists trg_care_tasks_updated_at on public.care_tasks;
create trigger trg_care_tasks_updated_at
before update on public.care_tasks
for each row execute function public.set_updated_at();

alter table public.care_tasks enable row level security;

drop policy if exists "care_tasks_select_participants" on public.care_tasks;
create policy "care_tasks_select_participants"
on public.care_tasks for select
to authenticated
using (
  employee_id = auth.uid()
  or public.is_staff()
);

drop policy if exists "care_tasks_insert_participants" on public.care_tasks;
create policy "care_tasks_insert_participants"
on public.care_tasks for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    employee_id = auth.uid()
    or public.is_staff()
  )
);

drop policy if exists "care_tasks_update_participants" on public.care_tasks;
create policy "care_tasks_update_participants"
on public.care_tasks for update
to authenticated
using (
  employee_id = auth.uid()
  or public.is_staff()
)
with check (
  employee_id = auth.uid()
  or public.is_staff()
);

drop policy if exists "care_tasks_delete_participants" on public.care_tasks;
create policy "care_tasks_delete_participants"
on public.care_tasks for delete
to authenticated
using (
  employee_id = auth.uid()
  or created_by = auth.uid()
  or public.is_staff()
);
