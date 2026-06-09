create or replace function public.company_member_can_read_pet_request(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.company_member_can_manage_pet_request(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.member_role in ('company_admin', 'hr_admin', 'manager')
  );
$$;

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
);

drop policy if exists "pet_support_requests_update_own_or_staff" on public.pet_support_requests;
create policy "pet_support_requests_update_own_or_staff"
on public.pet_support_requests for update
to authenticated
using (
  assigned_to = auth.uid()
  or public.is_staff()
  or (
    employee_id = auth.uid()
    and status = 'open'
  )
  or (
    company_id is not null
    and public.company_member_can_manage_pet_request(company_id)
  )
)
with check (
  assigned_to = auth.uid()
  or public.is_staff()
  or (
    employee_id = auth.uid()
    and status = 'open'
  )
  or (
    company_id is not null
    and public.company_member_can_manage_pet_request(company_id)
  )
);

grant execute on function public.company_member_can_read_pet_request(uuid) to authenticated;
grant execute on function public.company_member_can_manage_pet_request(uuid) to authenticated;

notify pgrst, 'reload schema';
