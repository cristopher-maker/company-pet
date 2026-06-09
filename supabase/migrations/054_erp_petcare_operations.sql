-- ERP PetCare Operations
-- Complete operational tables for pet care business management.
-- Covers: services, bookings, employees, facilities, rooms, walking routes, medical records, invoices.

-- 1. ERP Services Catalog
create table if not exists public.erp_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('paseo', 'pension', 'grooming', 'consulta', 'adiestramiento', 'petsitting', 'other')),
  base_price numeric(12,0) not null default 0,
  currency text not null default 'CLP',
  unit_label text not null default 'sesión',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_erp_services_company_name
  on public.erp_services (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

create index if not exists idx_erp_ervices_category
  on public.erp_services (category, is_active, sort_order);

drop trigger if exists trg_erp_services_updated_at on public.erp_services;
create trigger trg_erp_services_updated_at
  before update on public.erp_services
  for each row execute function public.set_updated_at();

-- 2. ERP Employees (operational staff)
create table if not exists public.erp_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('paseador', 'groomer', 'veterinario', 'adiestrador', 'petsitter', 'recepcionista', 'admin')),
  specialty text,
  phone text,
  photo_url text,
  shift text not null default 'flexible' check (shift in ('manana', 'tarde', 'noche', 'flexible')),
  is_active boolean not null default true,
  max_daily_services integer not null default 8,
  hourly_rate numeric(12,0) default 0,
  hire_date date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_erp_employees_company_profile
  on public.erp_employees (company_id, profile_id);

create index if not exists idx_erp_employees_role
  on public.erp_employees (company_id, role, is_active);

drop trigger if exists trg_erp_employees_updated_at on public.erp_employees;
create trigger trg_erp_employees_updated_at
  before update on public.erp_employees
  for each row execute function public.set_updated_at();

-- 3. ERP Clients (dueños)
create table if not exists public.erp_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text not null,
  address text,
  notes text,
  is_active boolean not null default true,
  total_visits integer not null default 0,
  total_spent numeric(12,0) not null default 0,
  registered_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_clients_company
  on public.erp_clients (company_id, full_name);
create index if not exists idx_erp_clients_phone
  on public.erp_clients (company_id, phone);

drop trigger if exists trg_erp_clients_updated_at on public.erp_clients;
create trigger trg_erp_clients_updated_at
  before update on public.erp_clients
  for each row execute function public.set_updated_at();

-- 4. ERP Pets (mascotas for the ERP - company-local)
create table if not exists public.erp_pets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.erp_clients (id) on delete cascade,
  name text not null,
  species text not null check (species in ('perro', 'gato', 'ave', 'roedor', 'reptil', 'otro')),
  breed text,
  color text,
  birth_date date,
  approximate_age integer,
  sex text check (sex in ('macho', 'hembra', 'desconocido')),
  weight_kg numeric(5,2),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_pets_company_client
  on public.erp_pets (company_id, client_id);
create index if not exists idx_erp_pets_species
  on public.erp_pets (company_id, species);

drop trigger if exists trg_erp_pets_updated_at on public.erp_pets;
create trigger trg_erp_pets_updated_at
  before update on public.erp_pets
  for each row execute function public.set_updated_at();

-- 5. ERP Facilities (instalaciones)
create table if not exists public.erp_facilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  type text not null check (type in ('pension', 'grooming', 'consulta', 'adiestramiento', 'paseo', 'mixto')),
  address text,
  capacity integer,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_facilities_company
  on public.erp_facilities (company_id, type, is_active);

drop trigger if exists trg_erp_facilities_updated_at on public.erp_facilities;
create trigger trg_erp_facilities_updated_at
  before update on public.erp_facilities
  for each row execute function public.set_updated_at();

-- 6. ERP Rooms (habitaciones dentro de instalaciones)
create table if not exists public.erp_rooms (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.erp_facilities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  room_type text not null default 'standard' check (room_type in ('standard', 'suite', 'vip', 'area_aves', 'area_roedores', 'aislamiento')),
  max_capacity integer not null default 1,
  current_occupant_id uuid references public.erp_pets (id) on delete set null,
  status text not null default 'available' check (status in ('available', 'occupied', 'maintenance', 'reserved')),
  price_multiplier numeric(3,2) not null default 1.00,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_rooms_facility
  on public.erp_rooms (facility_id, status);
create index if not exists idx_erp_rooms_company_status
  on public.erp_rooms (company_id, status);

drop trigger if exists trg_erp_rooms_updated_at on public.erp_rooms;
create trigger trg_erp_rooms_updated_at
  before update on public.erp_rooms
  for each row execute function public.set_updated_at();

-- 7. ERP Walking Routes
create table if not exists public.erp_walking_routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30,
  max_dogs integer not null default 6,
  area text,
  starting_point text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_routes_company
  on public.erp_walking_routes (company_id, is_active);

drop trigger if exists trg_erp_walking_routes_updated_at on public.erp_walking_routes;
create trigger trg_erp_walking_routes_updated_at
  before update on public.erp_walking_routes
  for each row execute function public.set_updated_at();

-- 8. ERP Service Bookings (agenda / reservas)
create table if not exists public.erp_service_bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  service_id uuid not null references public.erp_services (id) on delete cascade,
  client_id uuid not null references public.erp_clients (id) on delete cascade,
  pet_id uuid references public.erp_pets (id) on delete set null,
  employee_id uuid references public.erp_employees (id) on delete set null,
  room_id uuid references public.erp_rooms (id) on delete set null,
  route_id uuid references public.erp_walking_routes (id) on delete set null,
  scheduled_date date not null,
  scheduled_time time not null,
  duration_minutes integer not null default 30,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  price numeric(12,0) not null default 0,
  currency text not null default 'CLP',
  notes text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_bookings_company_date
  on public.erp_service_bookings (company_id, scheduled_date);
create index if not exists idx_erp_bookings_employee_date
  on public.erp_service_bookings (employee_id, scheduled_date);
create index if not exists idx_erp_bookings_status
  on public.erp_service_bookings (company_id, status);
create index if not exists idx_erp_bookings_client
  on public.erp_service_bookings (company_id, client_id);
create index if not exists idx_erp_bookings_pet
  on public.erp_service_bookings (company_id, pet_id);

drop trigger if exists trg_erp_service_bookings_updated_at on public.erp_service_bookings;
create trigger trg_erp_service_bookings_updated_at
  before update on public.erp_service_bookings
  for each row execute function public.set_updated_at();

-- 9. ERP Medical Records
create table if not exists public.erp_medical_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  pet_id uuid not null references public.erp_pets (id) on delete cascade,
  record_type text not null check (record_type in ('consulta', 'vacuna', 'desparasitacion', 'cirugia', 'examen', 'otro')),
  title text not null,
  description text,
  veterinarian text,
  clinic_name text,
  record_date date not null default current_date,
  next_due_date date,
  attachment_url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_erp_medical_records_pet
  on public.erp_medical_records (company_id, pet_id, record_date desc);
create index if not exists idx_erp_medical_records_type
  on public.erp_medical_records (company_id, record_type);

drop trigger if exists trg_erp_medical_records_updated_at on public.erp_medical_records;
create trigger trg_erp_medical_records_updated_at
  before update on public.erp_medical_records
  for each row execute function public.set_updated_at();

-- 10. ERP Invoices (operational billing)
create table if not exists public.erp_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.erp_clients (id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'void')),
  subtotal numeric(12,0) not null default 0,
  tax numeric(12,0) not null default 0,
  total numeric(12,0) not null default 0,
  currency text not null default 'CLP',
  due_date date,
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_erp_invoices_company_number
  on public.erp_invoices (company_id, invoice_number);
create index if not exists idx_erp_invoices_client
  on public.erp_invoices (company_id, client_id, created_at desc);
create index if not exists idx_erp_invoices_status
  on public.erp_invoices (company_id, status, due_date);

drop trigger if exists trg_erp_invoices_updated_at on public.erp_invoices;
create trigger trg_erp_invoices_updated_at
  before update on public.erp_invoices
  for each row execute function public.set_updated_at();

-- 11. ERP Invoice Items
create table if not exists public.erp_invoice_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid not null references public.erp_invoices (id) on delete cascade,
  booking_id uuid references public.erp_service_bookings (id) on delete set null,
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(12,0) not null default 0,
  total numeric(12,0) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_erp_invoice_items_invoice
  on public.erp_invoice_items (invoice_id, sort_order);

-- 12. Dashboard metrics helper: today's counts
create or replace function public.erp_dashboard_metrics(target_company_id uuid)
returns table (
  pets_in_care bigint,
  services_today bigint,
  services_completed_today bigint,
  revenue_today numeric,
  pending_invoices bigint,
  pending_invoice_total numeric,
  active_employees bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select count(*) from public.erp_rooms r where r.company_id = target_company_id and r.status = 'occupied'), 0),
    coalesce((select count(*) from public.erp_service_bookings b where b.company_id = target_company_id and b.scheduled_date = current_date), 0),
    coalesce((select count(*) from public.erp_service_bookings b where b.company_id = target_company_id and b.scheduled_date = current_date and b.status = 'completed'), 0),
    coalesce((select coalesce(sum(b.price), 0) from public.erp_service_bookings b where b.company_id = target_company_id and b.scheduled_date = current_date and b.status = 'completed'), 0),
    coalesce((select count(*) from public.erp_invoices i where i.company_id = target_company_id and i.status in ('pending', 'overdue')), 0),
    coalesce((select coalesce(sum(i.total), 0) from public.erp_invoices i where i.company_id = target_company_id and i.status in ('pending', 'overdue')), 0),
    coalesce((select count(*) from public.erp_employees e where e.company_id = target_company_id and e.is_active = true), 0);
$$;

-- Row Level Security
alter table public.erp_services enable row level security;
alter table public.erp_employees enable row level security;
alter table public.erp_clients enable row level security;
alter table public.erp_pets enable row level security;
alter table public.erp_facilities enable row level security;
alter table public.erp_rooms enable row level security;
alter table public.erp_walking_routes enable row level security;
alter table public.erp_service_bookings enable row level security;
alter table public.erp_medical_records enable row level security;
alter table public.erp_invoices enable row level security;
alter table public.erp_invoice_items enable row level security;

-- RLS: company members can read their company data
create or replace function public.erp_can_read(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = target_company_id and cm.user_id = auth.uid()
    );
$$;

create or replace function public.erp_can_write(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = target_company_id and cm.user_id = auth.uid()
        and cm.member_role in ('hr_admin', 'company_admin', 'manager')
    );
$$;

-- RLS policies for each ERP table
do $policy$
declare
  tbl text;
  tables text[] := array['erp_services', 'erp_employees', 'erp_clients', 'erp_pets',
                         'erp_facilities', 'erp_rooms', 'erp_walking_routes',
                         'erp_service_bookings', 'erp_medical_records',
                         'erp_invoices', 'erp_invoice_items'];
begin
  foreach tbl in array tables
  loop
    execute format(
      'drop policy if exists "erp_select_%1$s" on public.%1$s;
       create policy "erp_select_%1$s" on public.%1$s for select to authenticated
         using (public.erp_can_read(company_id));
       drop policy if exists "erp_insert_%1$s" on public.%1$s;
       create policy "erp_insert_%1$s" on public.%1$s for insert to authenticated
         with check (public.erp_can_write(company_id));
       drop policy if exists "erp_update_%1$s" on public.%1$s;
       create policy "erp_update_%1$s" on public.%1$s for update to authenticated
         using (public.erp_can_write(company_id))
         with check (public.erp_can_write(company_id));
       drop policy if exists "erp_delete_%1$s" on public.%1$s;
       create policy "erp_delete_%1$s" on public.%1$s for delete to authenticated
         using (public.erp_can_write(company_id));',
      tbl
    );
  end loop;
end;
$policy$;

grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;

notify pgrst, 'reload schema';
