-- Allow company HR admins to manage ERP operational data.
-- Company signup creates the owner membership as hr_admin, so ERP writes must allow it.

create or replace function public.erp_can_write(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('hr_admin', 'company_admin', 'manager')
    );
$$;

notify pgrst, 'reload schema';
