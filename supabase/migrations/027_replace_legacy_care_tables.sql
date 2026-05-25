-- Company Pet
-- Replaces legacy "care" / "training" tables inherited from another project.
-- WARNING: this migration drops old tables and their data.

create extension if not exists "pgcrypto";

-- Remove legacy tables that do not match this product language.
drop table if exists public.care_messages cascade;
drop table if exists public.care_requests cascade;
drop table if exists public.care_intakes cascade;
drop table if exists public.care_tasks cascade;
drop table if exists public.care_task_history cascade;
drop table if exists public.care_resources cascade;
drop table if exists public.provider_listings cascade;
drop table if exists public.training_enrollments cascade;
drop table if exists public.training_events cascade;
drop table if exists public.training_courses cascade;
drop table if exists public.patients cascade;
drop table if exists public.patient_contracts cascade;
drop table if exists public.patient_invoices cascade;

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Pets registered by employees.
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

-- Support / benefit requests for pet-related help.
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

-- Request messages / internal notes.
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

-- Provider services offered by verified providers.
create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  service_type text not null check (
    service_type in ('veterinary', 'walking', 'daycare', 'grooming', 'training', 'hotel', 'other')
  ),
  title text not null,
  description text,
  price_from integer check (price_from >= 0),
  currency text not null default 'CLP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_services_provider_id on public.provider_services (provider_id);
create index if not exists idx_provider_services_service_type on public.provider_services (service_type);

drop trigger if exists trg_provider_services_updated_at on public.provider_services;
create trigger trg_provider_services_updated_at
before update on public.provider_services
for each row execute function public.set_updated_at();

-- Pet education content and events, renamed from generic "training".
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

-- RLS
alter table public.pets enable row level security;
alter table public.pet_support_requests enable row level security;
alter table public.pet_support_messages enable row level security;
alter table public.provider_services enable row level security;
alter table public.pet_learning_courses enable row level security;
alter table public.pet_learning_events enable row level security;
alter table public.pet_learning_enrollments enable row level security;

-- Pets
drop policy if exists "pets_select_own_or_admin" on public.pets;
create policy "pets_select_own_or_admin"
on public.pets for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pets_insert_own" on public.pets;
create policy "pets_insert_own"
on public.pets for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "pets_update_own_or_admin" on public.pets;
create policy "pets_update_own_or_admin"
on public.pets for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

-- Support requests
drop policy if exists "pet_support_requests_insert_own" on public.pet_support_requests;
create policy "pet_support_requests_insert_own"
on public.pet_support_requests for insert
to authenticated
with check (employee_id = auth.uid());

drop policy if exists "pet_support_requests_select_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_select_own_or_staff"
on public.pet_support_requests for select
to authenticated
using (employee_id = auth.uid() or public.is_staff());

drop policy if exists "pet_support_requests_update_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_update_own_or_staff"
on public.pet_support_requests for update
to authenticated
using (employee_id = auth.uid() or public.is_staff())
with check (employee_id = auth.uid() or public.is_staff());

-- Support messages
drop policy if exists "pet_support_messages_select_participants" on public.pet_support_messages;
create policy "pet_support_messages_select_participants"
on public.pet_support_messages for select
to authenticated
using (
  exists (
    select 1
    from public.pet_support_requests r
    where r.id = request_id
      and (r.employee_id = auth.uid() or public.is_staff())
  )
);

drop policy if exists "pet_support_messages_insert_participants" on public.pet_support_messages;
create policy "pet_support_messages_insert_participants"
on public.pet_support_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.pet_support_requests r
    where r.id = request_id
      and (r.employee_id = auth.uid() or public.is_staff())
  )
);

-- Provider services and learning content
drop policy if exists "provider_services_select_authenticated" on public.provider_services;
create policy "provider_services_select_authenticated"
on public.provider_services for select
to authenticated
using (active = true or public.is_staff());

drop policy if exists "provider_services_write_staff" on public.provider_services;
create policy "provider_services_write_staff"
on public.provider_services for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "pet_learning_courses_select_authenticated" on public.pet_learning_courses;
create policy "pet_learning_courses_select_authenticated"
on public.pet_learning_courses for select
to authenticated
using (active = true or public.is_staff());

drop policy if exists "pet_learning_courses_write_staff" on public.pet_learning_courses;
create policy "pet_learning_courses_write_staff"
on public.pet_learning_courses for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "pet_learning_events_select_authenticated" on public.pet_learning_events;
create policy "pet_learning_events_select_authenticated"
on public.pet_learning_events for select
to authenticated
using (active = true or public.is_staff());

drop policy if exists "pet_learning_events_write_staff" on public.pet_learning_events;
create policy "pet_learning_events_write_staff"
on public.pet_learning_events for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "pet_learning_enrollments_select_own_or_staff" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_select_own_or_staff"
on public.pet_learning_enrollments for select
to authenticated
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "pet_learning_enrollments_insert_own" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_insert_own"
on public.pet_learning_enrollments for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "pet_learning_enrollments_update_own_or_staff" on public.pet_learning_enrollments;
create policy "pet_learning_enrollments_update_own_or_staff"
on public.pet_learning_enrollments for update
to authenticated
using (user_id = auth.uid() or public.is_staff())
with check (user_id = auth.uid() or public.is_staff());
