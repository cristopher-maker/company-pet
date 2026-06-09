-- Backfill pet records and support requests created before the employee was
-- linked to a company.

update public.pets p
set company_id = cm.company_id
from public.company_members cm
where p.company_id is null
  and p.owner_id = cm.user_id;

update public.pet_support_requests r
set company_id = cm.company_id
from public.company_members cm
where r.company_id is null
  and r.employee_id = cm.user_id;

notify pgrst, 'reload schema';
