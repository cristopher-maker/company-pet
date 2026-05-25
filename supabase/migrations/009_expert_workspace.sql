-- Company Pet
-- Internal notes, case tags and expert presence for Pet Expert workspace.

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_request_id_created_at
on public.internal_notes (request_id, created_at);

create table if not exists public.care_request_tags (
  request_id uuid not null references public.care_requests (id) on delete cascade,
  tag text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, tag)
);

create index if not exists idx_care_request_tags_created_by
on public.care_request_tags (created_by);

create table if not exists public.expert_presence (
  expert_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'busy', 'away')),
  updated_at timestamptz not null default now()
);

create trigger trg_expert_presence_updated_at
before update on public.expert_presence
for each row execute function public.set_updated_at();

alter table public.internal_notes enable row level security;
alter table public.care_request_tags enable row level security;
alter table public.expert_presence enable row level security;

drop policy if exists "internal_notes_select_staff" on public.internal_notes;
create policy "internal_notes_select_staff"
on public.internal_notes for select
to authenticated
using (
  exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        public.is_staff()
        or r.assigned_expert_id = auth.uid()
      )
  )
);

drop policy if exists "internal_notes_insert_staff" on public.internal_notes;
create policy "internal_notes_insert_staff"
on public.internal_notes for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        public.is_staff()
        or r.assigned_expert_id = auth.uid()
      )
  )
);

drop policy if exists "care_request_tags_select_staff" on public.care_request_tags;
create policy "care_request_tags_select_staff"
on public.care_request_tags for select
to authenticated
using (
  exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        public.is_staff()
        or r.assigned_expert_id = auth.uid()
      )
  )
);

drop policy if exists "care_request_tags_insert_staff" on public.care_request_tags;
create policy "care_request_tags_insert_staff"
on public.care_request_tags for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        public.is_staff()
        or r.assigned_expert_id = auth.uid()
      )
  )
);

drop policy if exists "care_request_tags_delete_staff" on public.care_request_tags;
create policy "care_request_tags_delete_staff"
on public.care_request_tags for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_staff()
);

drop policy if exists "expert_presence_select_staff_or_self" on public.expert_presence;
create policy "expert_presence_select_staff_or_self"
on public.expert_presence for select
to authenticated
using (
  expert_id = auth.uid()
  or public.is_staff()
);

drop policy if exists "expert_presence_upsert_self_or_admin" on public.expert_presence;
create policy "expert_presence_upsert_self_or_admin"
on public.expert_presence for insert
to authenticated
with check (
  expert_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "expert_presence_update_self_or_admin" on public.expert_presence;
create policy "expert_presence_update_self_or_admin"
on public.expert_presence for update
to authenticated
using (
  expert_id = auth.uid()
  or public.is_admin()
)
with check (
  expert_id = auth.uid()
  or public.is_admin()
);
