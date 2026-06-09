-- Allow employees to keep their pet profile and support requests even when
-- they are not linked to a company yet.

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
        or r.employee_id = auth.uid()
        or (
          r.company_id is not null
          and public.user_can_read_company_operations(r.company_id)
        )
      )
  );
$$;

drop policy if exists "pet_support_requests_insert_own" on public.pet_support_requests;
create policy "pet_support_requests_insert_own"
on public.pet_support_requests for insert
to authenticated
with check (employee_id = auth.uid());

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
  )
  or (
    company_id is not null
    and public.user_can_manage_company_operations(company_id)
  )
);

notify pgrst, 'reload schema';
