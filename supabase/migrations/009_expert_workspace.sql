-- Company Pet
-- Internal notes for pet support experts.

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_request_id_created_at
on public.internal_notes (request_id, created_at);

alter table public.internal_notes enable row level security;

drop policy if exists "internal_notes_select_staff" on public.internal_notes;
create policy "internal_notes_select_staff"
on public.internal_notes for select
to authenticated
using (public.is_staff());

drop policy if exists "internal_notes_insert_staff" on public.internal_notes;
create policy "internal_notes_insert_staff"
on public.internal_notes for insert
to authenticated
with check (author_id = auth.uid() and public.is_staff());

notify pgrst, 'reload schema';
