-- Company Pet
-- Restrict care requests/messages so only employees start conversations.

create or replace function public.is_employee()
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
      and p.role = 'employee'
  );
$$;

drop policy if exists "care_requests_insert_own" on public.care_requests;
create policy "care_requests_insert_own"
on public.care_requests for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.is_employee()
);

drop policy if exists "care_requests_select_own_or_staff" on public.care_requests;
create policy "care_requests_select_own_or_staff"
on public.care_requests for select
to authenticated
using (
  (employee_id = auth.uid() and public.is_employee())
  or public.is_staff()
  or assigned_expert_id = auth.uid()
);

drop policy if exists "care_requests_update_own_open_or_staff" on public.care_requests;
create policy "care_requests_update_own_open_or_staff"
on public.care_requests for update
to authenticated
using (
  (employee_id = auth.uid() and public.is_employee() and status = 'open')
  or public.is_staff()
  or assigned_expert_id = auth.uid()
)
with check (
  (employee_id = auth.uid() and public.is_employee() and status = 'open')
  or public.is_staff()
  or assigned_expert_id = auth.uid()
);

drop policy if exists "care_messages_select_participants" on public.care_messages;
create policy "care_messages_select_participants"
on public.care_messages for select
to authenticated
using (
  exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        (r.employee_id = auth.uid() and public.is_employee())
        or r.assigned_expert_id = auth.uid()
        or public.is_staff()
      )
  )
);

drop policy if exists "care_messages_insert_participants" on public.care_messages;
create policy "care_messages_insert_participants"
on public.care_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.care_requests r
    where r.id = request_id
      and (
        (r.employee_id = auth.uid() and public.is_employee())
        or r.assigned_expert_id = auth.uid()
        or public.is_staff()
      )
  )
);
