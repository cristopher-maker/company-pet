create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role text not null default 'employee' check (role in ('employee', 'hr_admin', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.profiles (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_company_invitations_company_email_pending
on public.company_invitations (company_id, lower(email))
where status = 'pending';

drop trigger if exists trg_company_invitations_updated_at on public.company_invitations;
create trigger trg_company_invitations_updated_at
before update on public.company_invitations
for each row execute function public.set_updated_at();

alter table public.company_invitations enable row level security;

drop policy if exists "company_invitations_company_managers_select" on public.company_invitations;
create policy "company_invitations_company_managers_select"
on public.company_invitations for select
using (public.can_manage_company(company_id));

drop policy if exists "company_invitations_company_managers_manage" on public.company_invitations;
create policy "company_invitations_company_managers_manage"
on public.company_invitations for all
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

grant select, insert, update, delete on public.company_invitations to authenticated;

notify pgrst, 'reload schema';
