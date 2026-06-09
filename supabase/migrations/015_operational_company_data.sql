-- Company Pet
-- Operational data used by pet experts and company admins.

create table if not exists public.pet_expert_profiles (
  expert_id uuid primary key references public.profiles (id) on delete cascade,
  photo_url text,
  specialty text not null default 'Orientacion pet',
  years_experience integer,
  shift text not null default 'flexible' check (shift in ('manana', 'tarde', 'noche', 'flexible')),
  bio text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_pet_expert_profiles_updated_at on public.pet_expert_profiles;
create trigger trg_pet_expert_profiles_updated_at
before update on public.pet_expert_profiles
for each row execute function public.set_updated_at();

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_documents_request_id
on public.case_documents (request_id, created_at desc);

alter table public.pet_expert_profiles enable row level security;
alter table public.case_documents enable row level security;

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
using (expert_id = auth.uid() or public.is_admin())
with check (expert_id = auth.uid() or public.is_admin());

drop policy if exists "case_documents_select_staff" on public.case_documents;
create policy "case_documents_select_staff"
on public.case_documents for select
to authenticated
using (public.is_staff());

drop policy if exists "case_documents_insert_staff" on public.case_documents;
create policy "case_documents_insert_staff"
on public.case_documents for insert
to authenticated
with check (uploaded_by = auth.uid() and public.is_staff());

notify pgrst, 'reload schema';
