create or replace function public.care_type_label(value text)
returns text
language sql
immutable
as $$
  select case value
    when 'guidance' then 'Orientacion general'
    when 'home_care' then 'Cuidados a domicilio'
    when 'residential' then 'Hotel para mascotas'
    when 'nursing' then 'Enfermeria'
    when 'dementia' then 'Demencia / Alzheimer'
    when 'respite' then 'Cuidado de respiro'
    else coalesce(nullif(value, ''), 'Sin perfil')
  end;
$$;

create or replace function public.dependency_level_label(value text)
returns text
language sql
immutable
as $$
  select case value
    when 'low' then 'Baja'
    when 'medium' then 'Media'
    when 'high' then 'Alta'
    when 'full' then 'Dependencia total'
    else nullif(value, '')
  end;
$$;

create or replace function public.create_lead_from_care_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_name text;
  care_type text;
  city text;
  dependency text;
  budget numeric;
begin
  if new.company_id is null or new.employee_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.leads l
    where l.company_id = new.company_id
      and l.employee_id = new.employee_id
  ) then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Empleado')
  into employee_name
  from public.profiles p
  where p.id = new.employee_id;

  employee_name := coalesce(employee_name, 'Empleado');
  care_type := public.care_type_label(new.payload #>> '{care_type}');
  city := nullif(trim(coalesce(new.payload #>> '{location,city}', '')), '');
  dependency := public.dependency_level_label(new.payload #>> '{care_receiver,dependency_level}');

  begin
    budget := nullif(new.payload #>> '{budget,monthly_max}', '')::numeric;
  exception when invalid_text_representation then
    budget := null;
  end;

  insert into public.leads (
    company_id,
    employee_id,
    nombre,
    comuna,
    dependencia,
    presupuesto,
    estado
  )
  values (
    new.company_id,
    new.employee_id,
    'Solicitud: ' || employee_name || ' (' || care_type || ')',
    city,
    dependency,
    budget,
    'nuevo'
  );

  return new;
end;
$$;

drop trigger if exists trg_care_intakes_create_lead on public.care_intakes;
create trigger trg_care_intakes_create_lead
after insert on public.care_intakes
for each row execute function public.create_lead_from_care_intake();

insert into public.leads (
  company_id,
  employee_id,
  nombre,
  comuna,
  dependencia,
  presupuesto,
  estado,
  created_at,
  updated_at
)
select
  ci.company_id,
  ci.employee_id,
  'Solicitud: ' || coalesce(nullif(trim(p.full_name), ''), 'Empleado') || ' (' || public.care_type_label(ci.payload #>> '{care_type}') || ')',
  nullif(trim(coalesce(ci.payload #>> '{location,city}', '')), ''),
  public.dependency_level_label(ci.payload #>> '{care_receiver,dependency_level}'),
  case
    when nullif(ci.payload #>> '{budget,monthly_max}', '') ~ '^[0-9]+(\.[0-9]+)?$'
      then (ci.payload #>> '{budget,monthly_max}')::numeric
    else null
  end,
  'nuevo',
  ci.created_at,
  ci.updated_at
from public.care_intakes ci
left join public.profiles p on p.id = ci.employee_id
where ci.employee_id is not null
  and not exists (
    select 1
    from public.leads l
    where l.company_id = ci.company_id
      and l.employee_id = ci.employee_id
  );
