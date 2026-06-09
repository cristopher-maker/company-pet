-- Archived Company Pet MVP schema snapshot
-- New schema for the pet care platform: cuidadores, tutores, paseos, visitas, etc.
-- Runs alongside existing corporate tables (companies, etc.) without affecting them.

-- 1. Expand profile roles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'admin', 'company_admin', 'manager', 'pet_expert', 'cuidador', 'tutor'));

-- 2. Update handle_new_user to support the new roles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_company_id uuid;
  invited_role text;
  invitation_id uuid;
  profile_role text;
  signup_company_name text;
  signup_company_tax_id text;
  signup_company_id uuid;
begin
  profile_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'cuidador');
  if profile_role not in ('employee', 'company_admin', 'manager', 'pet_expert', 'admin', 'cuidador', 'tutor') then
    profile_role := 'cuidador';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    profile_role
  )
  on conflict (id) do update
    set
      email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      role = case
        when public.profiles.role = 'employee' then excluded.role
        else public.profiles.role
      end;

  if profile_role = 'cuidador' then
    insert into public.cuidador_profiles (id, tipo_cuidador)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'tipo_cuidador', ''), 'cuidador_domiciliario')
    )
    on conflict (id) do update
      set tipo_cuidador = excluded.tipo_cuidador;
  end if;

  invited_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  invited_role := coalesce(nullif(new.raw_user_meta_data ->> 'member_role', ''), 'employee');
  invitation_id := nullif(new.raw_user_meta_data ->> 'company_invitation_id', '')::uuid;

  if invited_company_id is not null and invited_role in ('employee', 'hr_admin', 'manager') then
    insert into public.company_members (company_id, user_id, member_role)
    values (invited_company_id, new.id, invited_role)
    on conflict (company_id, user_id) do update
      set member_role = excluded.member_role;

    update public.company_invitations
    set
      status = 'accepted',
      accepted_at = now()
    where id = invitation_id
      and company_id = invited_company_id
      and lower(email) = lower(coalesce(new.email, ''))
      and status = 'pending';
  end if;

  signup_company_name := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  signup_company_tax_id := nullif(trim(new.raw_user_meta_data ->> 'company_tax_id'), '');

  if profile_role = 'company_admin'
    and signup_company_name is not null
    and signup_company_tax_id is not null
    and not exists (
      select 1
      from public.company_members cm
      where cm.user_id = new.id
    )
    and not exists (
      select 1
      from public.companies c
      where c.tax_id = signup_company_tax_id
    )
  then
    insert into public.companies (name, tax_id, created_by)
    values (signup_company_name, signup_company_tax_id, new.id)
    returning id into signup_company_id;

    insert into public.company_members (company_id, user_id, member_role)
    values (signup_company_id, new.id, 'hr_admin')
    on conflict (company_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- 3. Helpers for the new roles
create or replace function public.is_cuidador()
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
      and p.role = 'cuidador'
  );
$$;

create or replace function public.is_tutor()
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
      and p.role = 'tutor'
  );
$$;

-- 4. New tables

-- 4a. Cuidador extended profile
create table if not exists public.cuidador_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  bio text,
  comuna text,
  direccion text,
  photo_url text,
  verified boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  experience_years integer,
  has_transport boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cuidador_profiles
  add column if not exists tipo_cuidador text not null default 'cuidador_domiciliario'
  check (tipo_cuidador in ('paseador', 'residencia', 'cuidador_domiciliario'));

drop trigger if exists trg_cuidador_profiles_updated_at on public.cuidador_profiles;
create trigger trg_cuidador_profiles_updated_at
before update on public.cuidador_profiles
for each row execute function public.set_updated_at();

-- 4b. Tutor extended profile
create table if not exists public.tutor_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  direccion text,
  comuna text,
  notas_entrega_llaves text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tutor_profiles_updated_at on public.tutor_profiles;
create trigger trg_tutor_profiles_updated_at
before update on public.tutor_profiles
for each row execute function public.set_updated_at();

-- 4c. Expand pets table with behavior, feeding, emergency fields
alter table public.pets
  add column if not exists pet_photo_url text,
  add column if not exists behavior_notes text,
  add column if not exists feeding_schedule text,
  add column if not exists food_brand text,
  add column if not exists food_portion text,
  add column if not exists food_allergies text,
  add column if not exists emergency_vet_name text,
  add column if not exists emergency_vet_phone text,
  add column if not exists emergency_vet_address text;

-- 4d. Services offered by caregivers
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('paseo', 'visita', 'alojamiento')),
  titulo text not null,
  descripcion text,
  duracion_minutos integer,
  precio numeric(10,0) not null default 0,
  moneda text not null default 'CLP',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_servicios_cuidador_id on public.servicios (cuidador_id);
create index if not exists idx_servicios_tipo on public.servicios (tipo);

drop trigger if exists trg_servicios_updated_at on public.servicios;
create trigger trg_servicios_updated_at
before update on public.servicios
for each row execute function public.set_updated_at();

-- 4e. Caregiver availability
create table if not exists public.disponibilidad (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_disponibilidad_slot unique (cuidador_id, dia_semana, hora_inicio, hora_fin)
);

create index if not exists idx_disponibilidad_cuidador_id on public.disponibilidad (cuidador_id);

-- 4f. Bookings / reservations
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios (id),
  cuidador_id uuid not null references public.profiles (id),
  tutor_id uuid not null references public.profiles (id),
  mascota_id uuid not null references public.pets (id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada')),
  direccion text,
  notas_tutor text,
  notas_cuidador text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservas_cuidador_id on public.reservas (cuidador_id);
create index if not exists idx_reservas_tutor_id on public.reservas (tutor_id);
create index if not exists idx_reservas_fecha on public.reservas (fecha);

drop trigger if exists trg_reservas_updated_at on public.reservas;
create trigger trg_reservas_updated_at
before update on public.reservas
for each row execute function public.set_updated_at();

-- 4g. Walk records
create table if not exists public.paseos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas (id),
  checkin_at timestamptz,
  checkout_at timestamptz,
  duracion_minutos integer,
  distancia_km numeric(5,2),
  ruta_gps jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_paseos_updated_at on public.paseos;
create trigger trg_paseos_updated_at
before update on public.paseos
for each row execute function public.set_updated_at();

-- 4h. Visit records
create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas (id),
  checkin_at timestamptz,
  checkout_at timestamptz,
  duracion_minutos integer,
  tareas_realizadas jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_visitas_updated_at on public.visitas;
create trigger trg_visitas_updated_at
before update on public.visitas
for each row execute function public.set_updated_at();

-- 4i. Lodging records
create table if not exists public.alojamientos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas (id),
  checkin_at timestamptz,
  checkout_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_alojamientos_updated_at on public.alojamientos;
create trigger trg_alojamientos_updated_at
before update on public.alojamientos
for each row execute function public.set_updated_at();

-- 4j. Checklist templates
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id),
  categoria text not null check (categoria in ('paseo', 'visita', 'alojamiento', 'general')),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_checklist_items_cuidador_id on public.checklist_items (cuidador_id);

-- 4k. Checklist execution per booking
create table if not exists public.checklist_ejecucion (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id),
  item_id uuid not null references public.checklist_items (id),
  completado boolean not null default false,
  completado_at timestamptz,
  constraint uq_checklist_ejecucion unique (reserva_id, item_id)
);

-- 4l. Photos attached to bookings
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id),
  url text not null,
  descripcion text,
  tomada_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_fotos_reserva_id on public.fotos (reserva_id);

-- 4m. Reports sent to tutors
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas (id),
  resumen text,
  duracion_minutos integer,
  actividades jsonb,
  pdf_url text,
  compartido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_reportes_updated_at on public.reportes;
create trigger trg_reportes_updated_at
before update on public.reportes
for each row execute function public.set_updated_at();

-- 4n. Payments
create table if not exists public.cobros (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id),
  tutor_id uuid not null references public.profiles (id),
  cuidador_id uuid not null references public.profiles (id),
  monto numeric(10,0) not null,
  moneda text not null default 'CLP',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'vencido', 'anulado')),
  metodo_pago text,
  pagado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cobros_tutor_id on public.cobros (tutor_id);
create index if not exists idx_cobros_cuidador_id on public.cobros (cuidador_id);
create index if not exists idx_cobros_estado on public.cobros (estado);

drop trigger if exists trg_cobros_updated_at on public.cobros;
create trigger trg_cobros_updated_at
before update on public.cobros
for each row execute function public.set_updated_at();

-- 4o. Payment receipts
create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.cobros (id),
  url text not null,
  tipo text not null default 'transferencia' check (tipo in ('transferencia', 'efectivo', 'tarjeta', 'mercadopago')),
  created_at timestamptz not null default now()
);

create index if not exists idx_comprobantes_cobro_id on public.comprobantes (cobro_id);

-- 4p. Reminders
create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid references public.profiles (id),
  tutor_id uuid references public.profiles (id),
  reserva_id uuid references public.reservas (id),
  titulo text not null,
  descripcion text,
  recordar_at timestamptz not null,
  completado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_recordatorios_cuidador_id on public.recordatorios (cuidador_id);
create index if not exists idx_recordatorios_recordar_at on public.recordatorios (recordar_at);

-- 4q. Reviews
create table if not exists public.resenas (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id),
  tutor_id uuid not null references public.profiles (id),
  reserva_id uuid not null unique references public.reservas (id),
  puntuacion integer not null check (puntuacion between 1 and 5),
  comentario text,
  created_at timestamptz not null default now()
);

create index if not exists idx_resenas_cuidador_id on public.resenas (cuidador_id);

-- 4r. Certificates
create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id),
  titulo text not null,
  emisor text,
  url text,
  verificado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_certificados_cuidador_id on public.certificados (cuidador_id);

-- 4s. Policies
create table if not exists public.politicas (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references public.profiles (id),
  tipo text not null check (tipo in ('cancelacion', 'reembolso', 'conducta', 'general')),
  contenido text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_politicas_updated_at on public.politicas;
create trigger trg_politicas_updated_at
before update on public.politicas
for each row execute function public.set_updated_at();

-- 4t. Emergency contacts
create table if not exists public.emergencias (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id),
  nombre text not null,
  telefono text not null,
  parentesco text,
  created_at timestamptz not null default now()
);

create index if not exists idx_emergencias_tutor_id on public.emergencias (tutor_id);

-- 4u. Consent records
create table if not exists public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id),
  tipo text not null check (tipo in ('datos', 'fotos', 'medicacion', 'paseo', 'general')),
  aceptado boolean not null default false,
  aceptado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_consentimientos_tutor_id on public.consentimientos (tutor_id);

-- 5. Row Level Security

-- Enable RLS on all new tables
alter table public.cuidador_profiles enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.servicios enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.reservas enable row level security;
alter table public.paseos enable row level security;
alter table public.visitas enable row level security;
alter table public.alojamientos enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_ejecucion enable row level security;
alter table public.fotos enable row level security;
alter table public.reportes enable row level security;
alter table public.cobros enable row level security;
alter table public.comprobantes enable row level security;
alter table public.recordatorios enable row level security;
alter table public.resenas enable row level security;
alter table public.certificados enable row level security;
alter table public.politicas enable row level security;
alter table public.emergencias enable row level security;
alter table public.consentimientos enable row level security;

-- RLS Policies

-- Cuidador profiles: public read, self write
drop policy if exists "cuidador_profiles_select_public" on public.cuidador_profiles;
create policy "cuidador_profiles_select_public"
on public.cuidador_profiles for select
to authenticated
using (true);

drop policy if exists "cuidador_profiles_write_self" on public.cuidador_profiles;
create policy "cuidador_profiles_write_self"
on public.cuidador_profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "cuidador_profiles_update_self" on public.cuidador_profiles;
create policy "cuidador_profiles_update_self"
on public.cuidador_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Tutor profiles: self read/write
drop policy if exists "tutor_profiles_select_self" on public.tutor_profiles;
create policy "tutor_profiles_select_self"
on public.tutor_profiles for select
to authenticated
using (id = auth.uid() or public.is_cuidador());

drop policy if exists "tutor_profiles_write_self" on public.tutor_profiles;
create policy "tutor_profiles_write_self"
on public.tutor_profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "tutor_profiles_update_self" on public.tutor_profiles;
create policy "tutor_profiles_update_self"
on public.tutor_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Servicios: public read, cuidador write
drop policy if exists "servicios_select_public" on public.servicios;
create policy "servicios_select_public"
on public.servicios for select
to authenticated
using (activo = true or cuidador_id = auth.uid());

drop policy if exists "servicios_insert_own" on public.servicios;
create policy "servicios_insert_own"
on public.servicios for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "servicios_update_own" on public.servicios;
create policy "servicios_update_own"
on public.servicios for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Disponibilidad: public read, cuidador write
drop policy if exists "disponibilidad_select_public" on public.disponibilidad;
create policy "disponibilidad_select_public"
on public.disponibilidad for select
to authenticated
using (true);

drop policy if exists "disponibilidad_insert_own" on public.disponibilidad;
create policy "disponibilidad_insert_own"
on public.disponibilidad for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "disponibilidad_update_own" on public.disponibilidad;
create policy "disponibilidad_update_own"
on public.disponibilidad for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Reservas: participants read, tutor insert, mutual update
drop policy if exists "reservas_select_participants" on public.reservas;
create policy "reservas_select_participants"
on public.reservas for select
to authenticated
using (tutor_id = auth.uid() or cuidador_id = auth.uid());

drop policy if exists "reservas_insert_tutor" on public.reservas;
create policy "reservas_insert_tutor"
on public.reservas for insert
to authenticated
with check (tutor_id = auth.uid());

drop policy if exists "reservas_update_participants" on public.reservas;
create policy "reservas_update_participants"
on public.reservas for update
to authenticated
using (tutor_id = auth.uid() or cuidador_id = auth.uid())
with check (tutor_id = auth.uid() or cuidador_id = auth.uid());

-- Paseos: participants read, cuidador write
drop policy if exists "paseos_select_participants" on public.paseos;
create policy "paseos_select_participants"
on public.paseos for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = paseos.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "paseos_insert_cuidador" on public.paseos;
create policy "paseos_insert_cuidador"
on public.paseos for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = paseos.reserva_id
    and r.cuidador_id = auth.uid()
));

drop policy if exists "paseos_update_cuidador" on public.paseos;
create policy "paseos_update_cuidador"
on public.paseos for update
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = paseos.reserva_id
    and r.cuidador_id = auth.uid()
))
with check (exists (
  select 1 from public.reservas r
  where r.id = paseos.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Visitas: same pattern as paseos
drop policy if exists "visitas_select_participants" on public.visitas;
create policy "visitas_select_participants"
on public.visitas for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = visitas.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "visitas_insert_cuidador" on public.visitas;
create policy "visitas_insert_cuidador"
on public.visitas for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = visitas.reserva_id
    and r.cuidador_id = auth.uid()
));

drop policy if exists "visitas_update_cuidador" on public.visitas;
create policy "visitas_update_cuidador"
on public.visitas for update
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = visitas.reserva_id
    and r.cuidador_id = auth.uid()
))
with check (exists (
  select 1 from public.reservas r
  where r.id = visitas.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Alojamientos: same pattern
drop policy if exists "alojamientos_select_participants" on public.alojamientos;
create policy "alojamientos_select_participants"
on public.alojamientos for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = alojamientos.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "alojamientos_insert_cuidador" on public.alojamientos;
create policy "alojamientos_insert_cuidador"
on public.alojamientos for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = alojamientos.reserva_id
    and r.cuidador_id = auth.uid()
));

drop policy if exists "alojamientos_update_cuidador" on public.alojamientos;
create policy "alojamientos_update_cuidador"
on public.alojamientos for update
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = alojamientos.reserva_id
    and r.cuidador_id = auth.uid()
))
with check (exists (
  select 1 from public.reservas r
  where r.id = alojamientos.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Checklist items: own read/write
drop policy if exists "checklist_items_select_own" on public.checklist_items;
create policy "checklist_items_select_own"
on public.checklist_items for select
to authenticated
using (cuidador_id = auth.uid());

drop policy if exists "checklist_items_insert_own" on public.checklist_items;
create policy "checklist_items_insert_own"
on public.checklist_items for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "checklist_items_update_own" on public.checklist_items;
create policy "checklist_items_update_own"
on public.checklist_items for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Checklist ejecucion: participants read/write
drop policy if exists "checklist_ejecucion_select_participants" on public.checklist_ejecucion;
create policy "checklist_ejecucion_select_participants"
on public.checklist_ejecucion for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = checklist_ejecucion.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "checklist_ejecucion_insert_cuidador" on public.checklist_ejecucion;
create policy "checklist_ejecucion_insert_cuidador"
on public.checklist_ejecucion for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = checklist_ejecucion.reserva_id
    and r.cuidador_id = auth.uid()
));

drop policy if exists "checklist_ejecucion_update_cuidador" on public.checklist_ejecucion;
create policy "checklist_ejecucion_update_cuidador"
on public.checklist_ejecucion for update
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = checklist_ejecucion.reserva_id
    and r.cuidador_id = auth.uid()
))
with check (exists (
  select 1 from public.reservas r
  where r.id = checklist_ejecucion.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Fotos: participants read, cuidador write
drop policy if exists "fotos_select_participants" on public.fotos;
create policy "fotos_select_participants"
on public.fotos for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = fotos.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "fotos_insert_cuidador" on public.fotos;
create policy "fotos_insert_cuidador"
on public.fotos for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = fotos.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Reportes: participants read, cuidador write
drop policy if exists "reportes_select_participants" on public.reportes;
create policy "reportes_select_participants"
on public.reportes for select
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = reportes.reserva_id
    and (r.tutor_id = auth.uid() or r.cuidador_id = auth.uid())
));

drop policy if exists "reportes_insert_cuidador" on public.reportes;
create policy "reportes_insert_cuidador"
on public.reportes for insert
to authenticated
with check (exists (
  select 1 from public.reservas r
  where r.id = reportes.reserva_id
    and r.cuidador_id = auth.uid()
));

drop policy if exists "reportes_update_cuidador" on public.reportes;
create policy "reportes_update_cuidador"
on public.reportes for update
to authenticated
using (exists (
  select 1 from public.reservas r
  where r.id = reportes.reserva_id
    and r.cuidador_id = auth.uid()
))
with check (exists (
  select 1 from public.reservas r
  where r.id = reportes.reserva_id
    and r.cuidador_id = auth.uid()
));

-- Cobros: participants read, cuidador write
drop policy if exists "cobros_select_participants" on public.cobros;
create policy "cobros_select_participants"
on public.cobros for select
to authenticated
using (tutor_id = auth.uid() or cuidador_id = auth.uid());

drop policy if exists "cobros_insert_cuidador" on public.cobros;
create policy "cobros_insert_cuidador"
on public.cobros for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "cobros_update_cuidador" on public.cobros;
create policy "cobros_update_cuidador"
on public.cobros for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Comprobantes: participants read, cuidador write
drop policy if exists "comprobantes_select_participants" on public.comprobantes;
create policy "comprobantes_select_participants"
on public.comprobantes for select
to authenticated
using (exists (
  select 1 from public.cobros c
  where c.id = comprobantes.cobro_id
    and (c.tutor_id = auth.uid() or c.cuidador_id = auth.uid())
));

drop policy if exists "comprobantes_insert_cuidador" on public.comprobantes;
create policy "comprobantes_insert_cuidador"
on public.comprobantes for insert
to authenticated
with check (exists (
  select 1 from public.cobros c
  where c.id = comprobantes.cobro_id
    and c.cuidador_id = auth.uid()
));

-- Recordatorios: own read/write
drop policy if exists "recordatorios_select_own" on public.recordatorios;
create policy "recordatorios_select_own"
on public.recordatorios for select
to authenticated
using (cuidador_id = auth.uid() or tutor_id = auth.uid());

drop policy if exists "recordatorios_insert_own" on public.recordatorios;
create policy "recordatorios_insert_own"
on public.recordatorios for insert
to authenticated
with check (cuidador_id = auth.uid() or tutor_id = auth.uid());

drop policy if exists "recordatorios_update_own" on public.recordatorios;
create policy "recordatorios_update_own"
on public.recordatorios for update
to authenticated
using (cuidador_id = auth.uid() or tutor_id = auth.uid())
with check (cuidador_id = auth.uid() or tutor_id = auth.uid());

-- Resenas: public read, tutor write (one per booking)
drop policy if exists "resenas_select_public" on public.resenas;
create policy "resenas_select_public"
on public.resenas for select
to authenticated
using (true);

drop policy if exists "resenas_insert_own" on public.resenas;
create policy "resenas_insert_own"
on public.resenas for insert
to authenticated
with check (tutor_id = auth.uid());

-- Certificados: public read, cuidador write
drop policy if exists "certificados_select_public" on public.certificados;
create policy "certificados_select_public"
on public.certificados for select
to authenticated
using (true);

drop policy if exists "certificados_insert_own" on public.certificados;
create policy "certificados_insert_own"
on public.certificados for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "certificados_update_own" on public.certificados;
create policy "certificados_update_own"
on public.certificados for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Politicas: public read, cuidador write
drop policy if exists "politicas_select_public" on public.politicas;
create policy "politicas_select_public"
on public.politicas for select
to authenticated
using (true);

drop policy if exists "politicas_insert_own" on public.politicas;
create policy "politicas_insert_own"
on public.politicas for insert
to authenticated
with check (cuidador_id = auth.uid());

drop policy if exists "politicas_update_own" on public.politicas;
create policy "politicas_update_own"
on public.politicas for update
to authenticated
using (cuidador_id = auth.uid())
with check (cuidador_id = auth.uid());

-- Emergencias: self read/write, cuidador read (via reserva)
drop policy if exists "emergencias_select_self_or_cuidador" on public.emergencias;
create policy "emergencias_select_self_or_cuidador"
on public.emergencias for select
to authenticated
using (tutor_id = auth.uid() or public.is_cuidador());

drop policy if exists "emergencias_insert_self" on public.emergencias;
create policy "emergencias_insert_self"
on public.emergencias for insert
to authenticated
with check (tutor_id = auth.uid());

drop policy if exists "emergencias_update_self" on public.emergencias;
create policy "emergencias_update_self"
on public.emergencias for update
to authenticated
using (tutor_id = auth.uid())
with check (tutor_id = auth.uid());

-- Consentimientos: self read/write, cuidador read
drop policy if exists "consentimientos_select_self_or_cuidador" on public.consentimientos;
create policy "consentimientos_select_self_or_cuidador"
on public.consentimientos for select
to authenticated
using (tutor_id = auth.uid() or public.is_cuidador());

drop policy if exists "consentimientos_insert_self" on public.consentimientos;
create policy "consentimientos_insert_self"
on public.consentimientos for insert
to authenticated
with check (tutor_id = auth.uid());

drop policy if exists "consentimientos_update_self" on public.consentimientos;
create policy "consentimientos_update_self"
on public.consentimientos for update
to authenticated
using (tutor_id = auth.uid())
with check (tutor_id = auth.uid());

notify pgrst, 'reload schema';
