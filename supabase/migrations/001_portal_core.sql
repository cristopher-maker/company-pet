-- Company Pet
-- Supabase (Postgres) schema for: portal de beneficios (empleados)

-- Extensions
create extension if not exists "pgcrypto";

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

-- Profiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  company text,
  role text not null default 'employee' check (role in ('employee', 'admin', 'pet_expert')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Automatically create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Role helpers (avoid RLS recursion by using security definer)
create or replace function public.is_admin()
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
  select public.is_admin() or public.is_pet_expert();
$$;

-- Care requests (Asesoría Personalizada)
create table if not exists public.care_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('Chat', 'Videollamada', 'Llamada')),
  topic text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_expert_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_care_requests_employee_id on public.care_requests (employee_id);
create index if not exists idx_care_requests_status on public.care_requests (status);
create index if not exists idx_care_requests_assigned_expert_id on public.care_requests (assigned_expert_id);

create trigger trg_care_requests_updated_at
before update on public.care_requests
for each row execute function public.set_updated_at();

-- Care messages (chat)
create table if not exists public.care_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_care_messages_request_id_created_at
on public.care_messages (request_id, created_at);

-- Providers (Red de Proveedores Verificados)
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('Hotel para mascotas', 'Pet sitter a domicilio', 'Servicio médico')),
  area text not null,
  verified boolean not null default false,
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_providers_type on public.providers (type);
create index if not exists idx_providers_area on public.providers (area);
create index if not exists idx_providers_verified on public.providers (verified);

create trigger trg_providers_updated_at
before update on public.providers
for each row execute function public.set_updated_at();

-- Provider listings (precio + disponibilidad, cache local)
create table if not exists public.provider_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  price_from integer not null check (price_from >= 0),
  currency text not null default 'CLP',
  availability text not null check (availability in ('Hoy', 'Esta semana', 'Sin cupo')),
  notes text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_listings_provider_id on public.provider_listings (provider_id);
create index if not exists idx_provider_listings_availability on public.provider_listings (availability);

create trigger trg_provider_listings_updated_at
before update on public.provider_listings
for each row execute function public.set_updated_at();

-- Resources (Biblioteca de recursos)
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Opciones de cuidado', 'Financiación', 'Guías prácticas', 'Checklist')),
  summary text,
  body_markdown text,
  external_url text,
  published_at timestamptz,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resources_category on public.resources (category);
create index if not exists idx_resources_published_at on public.resources (published_at desc);

create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

-- Training (Formación)
create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  level text not null default 'Básico' check (level in ('Básico', 'Intermedio')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_courses_active on public.training_courses (active);

create trigger trg_training_courses_updated_at
before update on public.training_courses
for each row execute function public.set_updated_at();

create table if not exists public.training_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  format text not null default 'Online' check (format in ('Online', 'Presencial')),
  location text,
  join_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_events_starts_at on public.training_events (starts_at);

create trigger trg_training_events_updated_at
before update on public.training_events
for each row execute function public.set_updated_at();

create table if not exists public.training_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.training_courses (id) on delete cascade,
  event_id uuid references public.training_events (id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'completed', 'canceled')),
  created_at timestamptz not null default now(),
  constraint training_enrollments_one_target check (
    (course_id is not null and event_id is null) or
    (course_id is null and event_id is not null)
  )
);

create unique index if not exists uq_training_enrollments_user_course
on public.training_enrollments (user_id, course_id)
where course_id is not null;

create unique index if not exists uq_training_enrollments_user_event
on public.training_enrollments (user_id, event_id)
where event_id is not null;

-- RLS
alter table public.profiles enable row level security;
alter table public.care_requests enable row level security;
alter table public.care_messages enable row level security;
alter table public.providers enable row level security;
alter table public.provider_listings enable row level security;
alter table public.resources enable row level security;
alter table public.training_courses enable row level security;
alter table public.training_events enable row level security;
alter table public.training_enrollments enable row level security;

-- profiles policies
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- care_requests policies
drop policy if exists "care_requests_insert_own" on public.care_requests;
create policy "care_requests_insert_own"
on public.care_requests for insert
to authenticated
with check (employee_id = auth.uid());

drop policy if exists "care_requests_select_own_or_staff" on public.care_requests;
create policy "care_requests_select_own_or_staff"
on public.care_requests for select
to authenticated
using (employee_id = auth.uid() or public.is_staff() or assigned_expert_id = auth.uid());

drop policy if exists "care_requests_update_own_open_or_staff" on public.care_requests;
create policy "care_requests_update_own_open_or_staff"
on public.care_requests for update
to authenticated
using (
  (employee_id = auth.uid() and status = 'open') or
  public.is_staff() or
  assigned_expert_id = auth.uid()
)
with check (
  (employee_id = auth.uid() and status = 'open') or
  public.is_staff() or
  assigned_expert_id = auth.uid()
);

-- care_messages policies
drop policy if exists "care_messages_select_participants" on public.care_messages;
create policy "care_messages_select_participants"
on public.care_messages for select
to authenticated
using (
  exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (r.employee_id = auth.uid() or r.assigned_expert_id = auth.uid() or public.is_staff())
  )
);

drop policy if exists "care_messages_insert_participants" on public.care_messages;
create policy "care_messages_insert_participants"
on public.care_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (r.employee_id = auth.uid() or r.assigned_expert_id = auth.uid() or public.is_staff())
  )
);

-- providers + listings policies
drop policy if exists "providers_select_authenticated" on public.providers;
create policy "providers_select_authenticated"
on public.providers for select
to authenticated
using (active = true or public.is_staff());

drop policy if exists "providers_write_staff_only" on public.providers;
create policy "providers_write_staff_only"
on public.providers for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "provider_listings_select_authenticated" on public.provider_listings;
create policy "provider_listings_select_authenticated"
on public.provider_listings for select
to authenticated
using (true);

drop policy if exists "provider_listings_write_staff_only" on public.provider_listings;
create policy "provider_listings_write_staff_only"
on public.provider_listings for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- resources policies
drop policy if exists "resources_select_authenticated" on public.resources;
create policy "resources_select_authenticated"
on public.resources for select
to authenticated
using (true);

drop policy if exists "resources_write_staff_only" on public.resources;
create policy "resources_write_staff_only"
on public.resources for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- training policies
drop policy if exists "training_courses_select_authenticated" on public.training_courses;
create policy "training_courses_select_authenticated"
on public.training_courses for select
to authenticated
using (active = true or public.is_staff());

drop policy if exists "training_courses_write_staff_only" on public.training_courses;
create policy "training_courses_write_staff_only"
on public.training_courses for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "training_events_select_authenticated" on public.training_events;
create policy "training_events_select_authenticated"
on public.training_events for select
to authenticated
using (true);

drop policy if exists "training_events_write_staff_only" on public.training_events;
create policy "training_events_write_staff_only"
on public.training_events for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "training_enrollments_select_own_or_staff" on public.training_enrollments;
create policy "training_enrollments_select_own_or_staff"
on public.training_enrollments for select
to authenticated
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "training_enrollments_insert_own" on public.training_enrollments;
create policy "training_enrollments_insert_own"
on public.training_enrollments for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "training_enrollments_update_own_or_staff" on public.training_enrollments;
create policy "training_enrollments_update_own_or_staff"
on public.training_enrollments for update
to authenticated
using (user_id = auth.uid() or public.is_staff())
with check (user_id = auth.uid() or public.is_staff());
