drop policy if exists "profiles_select_same_company" on public.profiles;

create policy "profiles_select_same_company"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.company_members viewer
    join public.company_members profile_member
      on profile_member.company_id = viewer.company_id
    where viewer.user_id = auth.uid()
      and profile_member.user_id = profiles.id
  )
);

notify pgrst, 'reload schema';
