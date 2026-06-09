alter table public.providers
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

alter table public.provider_services
  add column if not exists company_id uuid references public.companies (id) on delete cascade,
  add column if not exists duration_minutes integer,
  add column if not exists max_daily_slots integer,
  add column if not exists requirements text;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.provider_services'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%service_type%'
  loop
    execute format('alter table public.provider_services drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.provider_services
  add constraint provider_services_service_type_check
  check (service_type in (
    'consulta','paseo','guarderia','peluqueria','veterinaria','entrenamiento','hospedaje','otros',
    'veterinary','walking','daycare','grooming','training','hotel','other'
  ));

drop policy if exists "provider_services_manage_company_admin" on public.provider_services;
create policy "provider_services_manage_company_admin"
on public.provider_services for all
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = provider_services.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = provider_services.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'manager')
  )
);

drop policy if exists "providers_manage_company_admin" on public.providers;
create policy "providers_manage_company_admin"
on public.providers for all
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = providers.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = providers.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'manager')
  )
);

notify pgrst, 'reload schema';
