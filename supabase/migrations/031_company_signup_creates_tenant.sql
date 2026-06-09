-- Ensure company signups create the tenant and owner membership server-side.

alter table public.companies
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

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
  profile_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'employee');
  if profile_role not in ('employee', 'company_admin', 'manager', 'pet_expert', 'admin') then
    profile_role := 'employee';
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

create or replace function public.register_company_for_current_user(
  company_name text,
  company_tax_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_company_id uuid;
  existing_company_id uuid;
begin
  if current_user_id is null then
    raise exception 'No hay sesion activa.';
  end if;

  if nullif(trim(company_name), '') is null then
    raise exception 'Nombre de empresa invalido.';
  end if;

  if nullif(trim(company_tax_id), '') is null then
    raise exception 'RUT de empresa invalido.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.role = 'company_admin'
  ) then
    raise exception 'El usuario no puede crear empresas.';
  end if;

  select cm.company_id
  into existing_company_id
  from public.company_members cm
  where cm.user_id = current_user_id
  limit 1;

  if existing_company_id is not null then
    return existing_company_id;
  end if;

  select c.id
  into existing_company_id
  from public.companies c
  where c.tax_id = trim(company_tax_id)
  limit 1;

  if existing_company_id is not null then
    raise exception 'Ya existe una empresa registrada con ese RUT. Solicita una invitacion al administrador de esa empresa.';
  end if;

  insert into public.companies (name, tax_id, created_by)
  values (trim(company_name), trim(company_tax_id), current_user_id)
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, member_role)
  values (new_company_id, current_user_id, 'hr_admin');

  return new_company_id;
end;
$$;

grant execute on function public.register_company_for_current_user(text, text) to authenticated;

with signup_admins as (
  select
    u.id as user_id,
    nullif(trim(u.raw_user_meta_data ->> 'company_name'), '') as company_name,
    nullif(trim(u.raw_user_meta_data ->> 'company_tax_id'), '') as company_tax_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where coalesce(nullif(u.raw_user_meta_data ->> 'role', ''), p.role) = 'company_admin'
    and nullif(trim(u.raw_user_meta_data ->> 'company_name'), '') is not null
    and nullif(trim(u.raw_user_meta_data ->> 'company_tax_id'), '') is not null
    and not exists (
      select 1
      from public.company_members cm
      where cm.user_id = u.id
    )
    and not exists (
      select 1
      from public.companies c
      where c.tax_id = nullif(trim(u.raw_user_meta_data ->> 'company_tax_id'), '')
    )
),
created_companies as (
  insert into public.companies (name, tax_id, created_by)
  select company_name, company_tax_id, user_id
  from signup_admins
  returning id, created_by
)
insert into public.company_members (company_id, user_id, member_role)
select id, created_by, 'hr_admin'
from created_companies
on conflict (company_id, user_id) do nothing;

notify pgrst, 'reload schema';
