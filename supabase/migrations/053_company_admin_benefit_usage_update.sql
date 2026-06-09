drop policy if exists "benefit_usage_manage_staff" on public.benefit_usage;
drop policy if exists "benefit_usage_manage_staff_or_company_manager" on public.benefit_usage;

create policy "benefit_usage_manage_staff_or_company_manager"
  on public.benefit_usage for update
  to authenticated
  using (
    public.is_internal_admin()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = benefit_usage.company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('company_admin', 'manager')
    )
  )
  with check (
    public.is_internal_admin()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = benefit_usage.company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('company_admin', 'manager')
    )
  );

notify pgrst, 'reload schema';
