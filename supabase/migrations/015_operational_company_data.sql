create table if not exists public.care_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete set null,
  resource_code text not null,
  status text not null check (status in ('Disponible', 'Ocupada', 'En limpieza')),
  care_type text not null check (care_type in ('Basico', 'Intensivo', 'Post-operatorio')),
  location_label text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_care_resources_company_code
on public.care_resources (company_id, resource_code);

create index if not exists idx_care_resources_company_id
on public.care_resources (company_id);

drop trigger if exists trg_care_resources_updated_at on public.care_resources;
create trigger trg_care_resources_updated_at
before update on public.care_resources
for each row execute function public.set_updated_at();

create table if not exists public.pet_expert_profiles (
  expert_id uuid primary key references public.profiles (id) on delete cascade,
  photo_url text,
  specialty text not null default 'Coordinacion de cuidados',
  years_experience integer,
  shift text not null default 'manana' check (shift in ('manana', 'tarde', 'noche', 'flexible')),
  bio text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_pet_expert_profiles_updated_at on public.pet_expert_profiles;
create trigger trg_pet_expert_profiles_updated_at
before update on public.pet_expert_profiles
for each row execute function public.set_updated_at();

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_requests (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_documents_request_id
on public.case_documents (request_id, created_at desc);

alter table public.care_resources enable row level security;
alter table public.pet_expert_profiles enable row level security;
alter table public.case_documents enable row level security;

drop policy if exists "care_resources_select_company_or_staff" on public.care_resources;
create policy "care_resources_select_company_or_staff"
on public.care_resources for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_resources.company_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "care_resources_write_company_or_staff" on public.care_resources;
create policy "care_resources_write_company_or_staff"
on public.care_resources for all
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_resources.company_id
      and cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
  )
)
with check (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_resources.company_id
      and cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
  )
);

drop policy if exists "pet_expert_profiles_select_company_or_staff" on public.pet_expert_profiles;
create policy "pet_expert_profiles_select_company_or_staff"
on public.pet_expert_profiles for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
  )
);

drop policy if exists "pet_expert_profiles_write_self_or_admin" on public.pet_expert_profiles;
create policy "pet_expert_profiles_write_self_or_admin"
on public.pet_expert_profiles for all
to authenticated
using (
  expert_id = auth.uid()
  or public.is_admin()
)
with check (
  expert_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "case_documents_select_participants_company_or_staff" on public.case_documents;
create policy "case_documents_select_participants_company_or_staff"
on public.case_documents for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.care_requests r
    where r.id = case_documents.request_id
      and r.employee_id = auth.uid()
  )
);

drop policy if exists "case_documents_insert_participants_company_or_staff" on public.case_documents;
create policy "case_documents_insert_participants_company_or_staff"
on public.case_documents for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.is_staff()
    or exists (
      select 1
      from public.care_requests r
      where r.id = case_documents.request_id
        and r.employee_id = auth.uid()
    )
  )
);
