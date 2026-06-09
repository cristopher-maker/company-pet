-- Company Pet
-- Adapts the asesoría/support module for the pet care model (tutor/cuidador roles)
-- Creates missing tables, fixes column names, and updates RLS policies.

-- 1. expert_presence table (used by care-experts page)
create table if not exists public.expert_presence (
  expert_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'busy', 'offline')),
  updated_at timestamptz not null default now()
);

alter table public.expert_presence enable row level security;

drop policy if exists "expert_presence_select_authenticated" on public.expert_presence;
create policy "expert_presence_select_authenticated"
on public.expert_presence for select
to authenticated
using (true);

drop policy if exists "expert_presence_upsert_own" on public.expert_presence;
create policy "expert_presence_upsert_own"
on public.expert_presence for insert
to authenticated
with check (expert_id = auth.uid());

drop policy if exists "expert_presence_update_own" on public.expert_presence;
create policy "expert_presence_update_own"
on public.expert_presence for update
to authenticated
using (expert_id = auth.uid())
with check (expert_id = auth.uid());

grant all on public.expert_presence to authenticated;

-- 2. Fix internal_notes: ensure table exists with body column (TS uses 'body')
create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  note text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_request_id_created_at
on public.internal_notes (request_id, created_at);

alter table public.internal_notes enable row level security;

-- backfill body from note if note exists and body is null
update public.internal_notes set body = note where body is null and note is not null;

-- 3. Function: check if user is a pet care user
create or replace function public.user_is_pet_care_user()
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

create or replace function public.user_is_pet_care_user_or_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_is_pet_care_user() or public.is_staff();
$$;

-- 4. Update pet_support_requests RLS policies for pet care users

drop policy if exists "pet_support_requests_insert_own" on public.pet_support_requests;
create policy "pet_support_requests_insert_own"
on public.pet_support_requests for insert
to authenticated
with check (
  employee_id = auth.uid()
  and (
    public.employee_has_active_benefit_access(employee_id)
    or public.user_is_pet_care_user()
  )
);

drop policy if exists "pet_support_requests_select_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_select_own_or_staff"
on public.pet_support_requests for select
to authenticated
using (
  employee_id = auth.uid()
  or assigned_to = auth.uid()
  or public.is_staff()
  or (
    company_id is not null
    and public.company_member_can_read_pet_request(company_id)
  )
  or public.user_is_pet_care_user()
);

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
    and (
      public.employee_has_active_benefit_access(employee_id)
      or public.user_is_pet_care_user()
    )
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
    and (
      public.employee_has_active_benefit_access(employee_id)
      or public.user_is_pet_care_user()
    )
  )
  or (
    company_id is not null
    and public.user_can_manage_company_operations(company_id)
  )
);

-- 5. Update pet_support_messages RLS for pet care users

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

-- 6. Update appointments RLS for pet care users

drop policy if exists "appointments_select_own_or_staff" on public.appointments;
create policy "appointments_select_own_or_staff"
on public.appointments for select
to authenticated
using (
  public.is_staff()
  or expert_id = auth.uid()
  or (
    employee_id = auth.uid()
    and (
      public.employee_has_active_benefit_access(employee_id)
      or public.user_is_pet_care_user()
    )
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
      and (
        public.employee_has_active_benefit_access(employee_id)
        or public.user_is_pet_care_user()
      )
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
    and (
      public.employee_has_active_benefit_access(employee_id)
      or public.user_is_pet_care_user()
    )
  )
)
with check (
  public.is_staff()
  or expert_id = auth.uid()
  or (
    employee_id = auth.uid()
    and (
      public.employee_has_active_benefit_access(employee_id)
      or public.user_is_pet_care_user()
    )
  )
);

-- 7. Update user_can_access_pet_support_request to include pet care users
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
          and (
            public.employee_has_active_benefit_access(r.employee_id)
            or public.user_is_pet_care_user()
          )
        )
        or (
          r.company_id is not null
          and public.user_can_read_company_operations(r.company_id)
        )
      )
  );
$$;

notify pgrst, 'reload schema';
