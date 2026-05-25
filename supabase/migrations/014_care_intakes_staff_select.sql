drop policy if exists "care_intakes_select_staff" on public.care_intakes;
create policy "care_intakes_select_staff"
on public.care_intakes for select
to authenticated
using (public.is_staff());
