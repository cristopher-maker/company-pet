-- Read model used by the company admin page.

drop view if exists public.company_members_view;

create view public.company_members_view as
select
  cm.company_id,
  cm.user_id,
  cm.member_role,
  p.email,
  p.full_name,
  cm.created_at
from public.company_members cm
join public.profiles p on p.id = cm.user_id;

grant select on public.company_members_view to authenticated;

notify pgrst, 'reload schema';
