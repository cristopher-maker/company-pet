-- Company Pet
-- Allow company admins (and admins) to manage company members.

alter table public.company_members enable row level security;

drop policy if exists "company_members_write_admin" on public.company_members;
create policy "company_members_write_admin"
on public.company_members
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

