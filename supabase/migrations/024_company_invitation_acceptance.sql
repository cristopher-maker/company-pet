-- Link accepted auth invitations to company membership.

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
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set email = excluded.email;

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

  return new;
end;
$$;

notify pgrst, 'reload schema';
