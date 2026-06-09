-- Company Pet
-- Tenant-aware policies for pet support, pet learning and appointments.
-- This runs after 027 so the pet tables already exist.

create extension if not exists "pgcrypto";

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
  add column if not exists operational_status text not null default 'onboarding';

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name text not null,
  species text not null check (species in ('dog', 'cat', 'other')),
  breed text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pets_owner_id on public.pets (owner_id);
create index if not exists idx_pets_company_id on public.pets (company_id);

drop trigger if exists trg_pets_updated_at on public.pets;
create trigger trg_pets_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

create table if not exists public.pet_support_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete set null,
  request_type text not null check (
    request_type in ('veterinary', 'walking', 'daycare', 'grooming', 'training', 'voucher', 'other')
  ),
  channel text not null default 'portal' check (channel in ('portal', 'chat', 'call', 'video')),
  title text not null,
  details text,
  status text not null default 'open' check (
    status in ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled')
  ),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pet_support_requests_company_id on public.pet_support_requests (company_id);
create index if not exists idx_pet_support_requests_employee_id on public.pet_support_requests (employee_id);
create index if not exists idx_pet_support_requests_status on public.pet_support_requests (status);

drop trigger if exists trg_pet_support_requests_updated_at on public.pet_support_requests;
create trigger trg_pet_support_requests_updated_at
before update on public.pet_support_requests
for each row execute function public.set_updated_at();

create table if not exists public.pet_support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pet_support_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  visibility text not null default 'thread' check (visibility in ('thread', 'internal')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pet_support_messages_request_id_created_at
on public.pet_support_messages (request_id, created_at);

create table if not exists public.pet_learning_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  level text not null default 'basic' check (level in ('basic', 'intermediate', 'advanced')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pet_learning_courses_active on public.pet_learning_courses (active);

drop trigger if exists trg_pet_learning_courses_updated_at on public.pet_learning_courses;
create trigger trg_pet_learning_courses_updated_at
before update on public.pet_learning_courses
for each row execute function public.set_updated_at();

create table if not exists public.pet_learning_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  format text not null default 'online' check (format in ('online', 'in_person')),
  location text,
  join_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pet_learning_events_starts_at on public.pet_learning_events (starts_at);

drop trigger if exists trg_pet_learning_events_updated_at on public.pet_learning_events;
create trigger trg_pet_learning_events_updated_at
before update on public.pet_learning_events
for each row execute function public.set_updated_at();

create table if not exists public.pet_learning_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.pet_learning_courses (id) on delete cascade,
  event_id uuid references public.pet_learning_events (id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'completed', 'cancelled')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_learning_enrollments_one_target check (
    (course_id is not null and event_id is null)
    or (course_id is null and event_id is not null)
  )
);

create unique index if not exists uq_pet_learning_enrollments_user_course
on public.pet_learning_enrollments (user_id, course_id)
where course_id is not null;

create unique index if not exists uq_pet_learning_enrollments_user_event
on public.pet_learning_enrollments (user_id, event_id)
where event_id is not null;

drop trigger if exists trg_pet_learning_enrollments_updated_at on public.pet_learning_enrollments;
create trigger trg_pet_learning_enrollments_updated_at
before update on public.pet_learning_enrollments
for each row execute function public.set_updated_at();

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
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

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.pets enable row level security;
alter table public.pet_support_requests enable row level security;
alter table public.pet_support_messages enable row level security;
alter table public.pet_learning_courses enable row level security;
alter table public.pet_learning_events enable row level security;
alter table public.pet_learning_enrollments enable row level security;
alter table public.appointments enable row level security;

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

create or replace function public.is_pet_expert()
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
      and p.role = 'pet_expert'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin() or public.is_pet_expert();
$$;

create or replace function public.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('company_admin', 'hr_admin', 'manager')
    );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
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
      and coalesce(c.operational_status, 'onboarding') in ('onboarding', 'active')
  );
$$;

create or replace function public.user_can_read_company_operations(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin()
    or (
      public.is_company_member(target_company_id)
      and public.can_company_use_benefits(target_company_id)
    );
$$;

create or replace function public.user_can_manage_company_operations(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin()
    or (
      public.can_manage_company(target_company_id)
      and public.can_company_use_benefits(target_company_id)
    );
$$;

create or replace function public.employee_has_active_benefit_access(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = target_employee_id
      and public.can_company_use_benefits(cm.company_id)
  );
$$;

create or replace function public.user_can_access_pet_support_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pet_support_requests r
    where r.id = target_request_id
      and (
        public.is_staff()
        or r.assigned_to = auth.uid()
        or (
          r.employee_id = auth.uid()
          and public.employee_has_active_benefit_access(r.employee_id)
        )
        or (
          r.company_id is not null
          and public.user_can_read_company_operations(r.company_id)
        )
      )
  );
$$;

drop policy if exists "pet_support_requests_insert_own" on public.pet_support_requests;
create policy "pet_support_requests_insert_own"
on public.pet_support_requests for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.employee_has_active_benefit_access(employee_id)
);

drop policy if exists "pet_support_requests_select_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_select_own_or_staff"
on public.pet_support_requests for select
to authenticated
using (public.user_can_access_pet_support_request(id));

drop policy if exists "pet_support_requests_update_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_update_own_or_staff"
on public.pet_support_requests for update
to authenticated
using (
  public.is_staff()
  or assigned_to = auth.uid()
  or (
    employee_id = auth.uid()
    and status = 'open'
    and public.employee_has_active_benefit_access(employee_id)
  )
  or (
    company_id is not null
    and public.user_can_manage_company_operations(company_id)
  )
)
with check (
  public.is_staff()
  or assigned_to = auth.uid()
  or (
    employee_id = auth.uid()
    and status = 'open'
    and public.employee_has_active_benefit_access(employee_id)
  )
  or (
    company_id is not null
    and public.user_can_manage_company_operations(company_id)
  )
);

drop policy if exists "pet_support_messages_select_participants" on public.pet_support_messages;
create policy "pet_support_messages_select_participants"
on public.pet_support_messages for select
to authenticated
using (public.user_can_access_pet_support_request(request_id));

drop policy if exists "pet_support_messages_insert_participants" on public.pet_support_messages;
create policy "pet_support_messages_insert_participants"
on public.pet_support_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.user_can_access_pet_support_request(request_id)
);

drop policy if exists "pet_learning_courses_select_authenticated" on public.pet_learning_courses;
create policy "pet_learning_courses_select_authenticated"
on public.pet_learning_courses for select
to authenticated
using ((active = true and public.employee_has_active_benefit_access(auth.uid())) or public.is_staff());

drop policy if exists "pet_learning_events_select_authenticated" on public.pet_learning_events;
create policy "pet_learning_events_select_authenticated"
on public.pet_learning_events for select
to authenticated
using (public.is_staff() or public.employee_has_active_benefit_access(auth.uid()));

drop policy if exists "pet_learning_enrollments_select_own_or_staff" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_select_own_or_staff"
on public.pet_learning_enrollments for select
to authenticated
using (
  public.is_staff()
  or (
    user_id = auth.uid()
    and public.employee_has_active_benefit_access(user_id)
  )
);

drop policy if exists "pet_learning_enrollments_insert_own" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_insert_own"
on public.pet_learning_enrollments for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.employee_has_active_benefit_access(user_id)
);

drop policy if exists "pet_learning_enrollments_update_own_or_staff" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_update_own_or_staff"
on public.pet_learning_enrollments for update
to authenticated
using (
  public.is_staff()
  or (
    user_id = auth.uid()
    and public.employee_has_active_benefit_access(user_id)
  )
)
with check (
  public.is_staff()
  or (
    user_id = auth.uid()
    and public.employee_has_active_benefit_access(user_id)
  )
);

drop policy if exists "appointments_select_own_or_staff" on public.appointments;
create policy "appointments_select_own_or_staff"
on public.appointments for select
to authenticated
using (
  public.is_staff()
  or expert_id = auth.uid()
  or (
    employee_id = auth.uid()
    and public.employee_has_active_benefit_access(employee_id)
  )
  or exists (
    select 1
    from public.company_members employee_membership
    where employee_membership.user_id = appointments.employee_id
      and public.user_can_read_company_operations(employee_membership.company_id)
  )
);

drop policy if exists "appointments_insert_own_or_staff" on public.appointments;
create policy "appointments_insert_own_or_staff"
on public.appointments for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_staff()
    or (
      employee_id = auth.uid()
      and public.employee_has_active_benefit_access(employee_id)
    )
  )
);

drop policy if exists "appointments_update_own_or_staff" on public.appointments;
create policy "appointments_update_own_or_staff"
on public.appointments for update
to authenticated
using (
  public.is_staff()
  or expert_id = auth.uid()
  or (
    employee_id = auth.uid()
    and public.employee_has_active_benefit_access(employee_id)
  )
)
with check (
  public.is_staff()
  or expert_id = auth.uid()
  or (
    employee_id = auth.uid()
    and public.employee_has_active_benefit_access(employee_id)
  )
);

notify pgrst, 'reload schema';
