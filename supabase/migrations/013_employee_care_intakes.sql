drop policy if exists "care_intakes_select_employee_own" on public.care_intakes;
create policy "care_intakes_select_employee_own"
on public.care_intakes for select
to authenticated
using (employee_id = auth.uid());

drop policy if exists "care_intakes_insert_employee_own" on public.care_intakes;
create policy "care_intakes_insert_employee_own"
on public.care_intakes for insert
to authenticated
with check (
  employee_id = auth.uid()
  and exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_intakes.company_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "care_intakes_update_employee_own" on public.care_intakes;
create policy "care_intakes_update_employee_own"
on public.care_intakes for update
to authenticated
using (employee_id = auth.uid())
with check (
  employee_id = auth.uid()
  and exists (
    select 1
    from public.company_members cm
    where cm.company_id = care_intakes.company_id
      and cm.user_id = auth.uid()
  )
);
