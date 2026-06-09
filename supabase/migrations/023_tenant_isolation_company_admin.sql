-- Company Pet
-- Tenant isolation: separate internal admins from company admins.

alter table public.companies
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.providers
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

create index if not exists idx_providers_company
on public.providers (company_id);

notify pgrst, 'reload schema';

create or replace function public.is_internal_admin()
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
      and p.role = 'admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin() or public.is_pet_expert();
$$;

create or replace function public.can_claim_created_company(
  target_company_id uuid,
  target_user_id uuid,
  target_member_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user_id = auth.uid()
    and target_member_role = 'hr_admin'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'company_admin'
    )
    and exists (
      select 1
      from public.companies c
      where c.id = target_company_id
        and c.created_by = auth.uid()
    )
    and not exists (
      select 1
      from public.company_members existing
      where existing.user_id = auth.uid()
    );
$$;

create or replace function public.user_can_read_company_operations(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin()
    or (
      public.is_company_member(target_company_id)
      and public.can_company_use_benefits(target_company_id)
    );
$$;

create or replace function public.user_can_manage_company_operations(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_internal_admin()
    or (
      public.can_manage_company(target_company_id)
      and public.can_company_use_benefits(target_company_id)
    );
$$;

create or replace function public.employee_has_active_benefit_access(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = target_employee_id
      and public.can_company_use_benefits(cm.company_id)
  );
$$;

drop policy if exists "companies_select_admin" on public.companies;
drop policy if exists "companies_select_internal_or_member" on public.companies;
create policy "companies_select_internal_or_member"
on public.companies for select
to authenticated
using (
  public.is_internal_admin()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = companies.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "companies_write_admin" on public.companies;
drop policy if exists "companies_insert_internal_or_company_owner" on public.companies;
create policy "companies_insert_internal_or_company_owner"
on public.companies for insert
to authenticated
with check (
  public.is_internal_admin()
  or (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'company_admin'
    )
  )
);

drop policy if exists "companies_update_internal_or_company_manager" on public.companies;
create policy "companies_update_internal_or_company_manager"
on public.companies for update
to authenticated
using (public.is_internal_admin() or public.can_manage_company(id))
with check (public.is_internal_admin() or public.can_manage_company(id));

drop policy if exists "company_members_select_own" on public.company_members;
drop policy if exists "company_members_select_own_or_company_manager" on public.company_members;
create policy "company_members_select_own_or_company_manager"
on public.company_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_internal_admin()
  or public.can_manage_company(company_id)
);

drop policy if exists "company_members_write_admin" on public.company_members;
drop policy if exists "company_members_insert_company_owner_or_manager" on public.company_members;
create policy "company_members_insert_company_owner_or_manager"
on public.company_members for insert
to authenticated
with check (
  public.is_internal_admin()
  or public.can_manage_company(company_id)
  or public.can_claim_created_company(company_id, user_id, member_role)
);

drop policy if exists "company_members_update_delete_internal_or_manager" on public.company_members;
create policy "company_members_update_delete_internal_or_manager"
on public.company_members for update
to authenticated
using (public.is_internal_admin() or public.can_manage_company(company_id))
with check (public.is_internal_admin() or public.can_manage_company(company_id));

drop policy if exists "company_members_delete_internal_or_manager" on public.company_members;
create policy "company_members_delete_internal_or_manager"
on public.company_members for delete
to authenticated
using (public.is_internal_admin() or public.can_manage_company(company_id));

drop policy if exists "providers_select_authenticated" on public.providers;
drop policy if exists "providers_select_public_or_company_member" on public.providers;
create policy "providers_select_public_or_company_member"
on public.providers for select
to authenticated
using (
  public.is_internal_admin()
  or (company_id is null and active = true and public.employee_has_active_benefit_access(auth.uid()))
  or (company_id is not null and public.user_can_read_company_operations(company_id))
);

drop policy if exists "providers_write_staff_only" on public.providers;
drop policy if exists "providers_manage_internal_or_company_manager" on public.providers;
create policy "providers_manage_internal_or_company_manager"
on public.providers for all
to authenticated
using (
  public.is_internal_admin()
  or (company_id is not null and public.user_can_manage_company_operations(company_id))
)
with check (
  public.is_internal_admin()
  or (company_id is not null and public.user_can_manage_company_operations(company_id))
);

drop policy if exists "resources_select_authenticated" on public.resources;
create policy "resources_select_authenticated"
on public.resources for select
to authenticated
using (public.is_staff() or public.employee_has_active_benefit_access(auth.uid()));

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

  if exists (
    select 1
    from public.company_members cm
    where cm.user_id = current_user_id
  ) then
    raise exception 'El usuario ya esta asociado a una empresa.';
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

notify pgrst, 'reload schema';
