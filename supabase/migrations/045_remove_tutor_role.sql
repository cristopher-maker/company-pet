-- Remove the 'tutor' role from the platform.
-- In the B2B model, employees are the pet owners, not a separate 'tutor' role.

-- 1. Drop is_tutor function (only defined, never referenced in policies)
drop function if exists public.is_tutor();

-- 2. Update profiles CHECK constraint to remove 'tutor'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'admin', 'company_admin', 'manager', 'pet_expert', 'cuidador'));

-- 3. Update handle_new_user function to remove 'tutor' from role checks
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
  if profile_role not in ('employee', 'company_admin', 'manager', 'pet_expert', 'admin', 'cuidador') then
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
