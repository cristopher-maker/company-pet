-- Company Pet
-- Import pipeline for providers from Excel/CSV:
-- 1) load CSV into public.provider_import_raw
-- 2) run: select public.sync_providers_from_import();

create table if not exists public.provider_import_raw (
  codigo text,
  nombre text,
  email text,
  telefono text,
  whatsapp text,
  direccion text,
  comuna text,
  region text,
  descripcion text,
  tipo text,
  tipo_instalacion text,
  horario_atencion text,
  bio text,
  youtube text,
  place_id text,
  precio_hotel para mascotass text,
  desc_hotel para mascotass text,
  precio_cuidado_domicilio text,
  desc_cuidado_domicilio text,
  precio_salud_mental text,
  desc_salud_mental text,
  amenidades text,
  website text,
  facebook text,
  instagram text,
  rating text,
  cant_resenas text,
  latitud text,
  longitud text,
  imagen_1 text,
  imagen_2 text,
  imagen_3 text,
  imported_at timestamptz not null default now()
);

create index if not exists idx_provider_import_raw_codigo
on public.provider_import_raw (codigo);

alter table public.providers
  add column if not exists external_code text;

create unique index if not exists uq_providers_external_code
on public.providers (external_code);

alter table public.providers
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.parse_clp_to_int(raw text)
returns integer
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g'), '')::integer;
$$;

create or replace function public.parse_decimal_nullable(raw text)
returns numeric
language sql
immutable
as $$
  select nullif(replace(trim(coalesce(raw, '')), ',', '.'), '')::numeric;
$$;

create or replace function public.normalize_provider_type(raw text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(raw, '')) like '%resid%' then 'Hotel para mascotas'
    when lower(coalesce(raw, '')) like '%domic%' then 'Pet sitter a domicilio'
    else 'Servicio médico'
  end;
$$;

create or replace function public.sync_providers_from_import()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert providers
  insert into public.providers (
    external_code,
    name,
    type,
    area,
    verified,
    rating,
    active,
    metadata
  )
  select
    trim(r.codigo) as external_code,
    trim(r.nombre) as name,
    public.normalize_provider_type(r.tipo) as type,
    trim(
      coalesce(r.comuna, '')
      || case
        when nullif(trim(coalesce(r.region, '')), '') is not null
          then ', ' || trim(r.region)
        else ''
      end
    ) as area,
    true as verified,
    least(
      greatest(coalesce(public.parse_decimal_nullable(r.rating), 0), 0),
      5
    ) as rating,
    true as active,
    jsonb_strip_nulls(
      jsonb_build_object(
        'email', nullif(trim(coalesce(r.email, '')), ''),
        'telefono', nullif(trim(coalesce(r.telefono, '')), ''),
        'whatsapp', nullif(trim(coalesce(r.whatsapp, '')), ''),
        'direccion', nullif(trim(coalesce(r.direccion, '')), ''),
        'descripcion', nullif(trim(coalesce(r.descripcion, '')), ''),
        'tipo_instalacion', nullif(trim(coalesce(r.tipo_instalacion, '')), ''),
        'horario_atencion', nullif(trim(coalesce(r.horario_atencion, '')), ''),
        'bio', nullif(trim(coalesce(r.bio, '')), ''),
        'youtube', nullif(trim(coalesce(r.youtube, '')), ''),
        'place_id', nullif(trim(coalesce(r.place_id, '')), ''),
        'amenidades', nullif(trim(coalesce(r.amenidades, '')), ''),
        'website', nullif(trim(coalesce(r.website, '')), ''),
        'facebook', nullif(trim(coalesce(r.facebook, '')), ''),
        'instagram', nullif(trim(coalesce(r.instagram, '')), ''),
        'cant_resenas', public.parse_clp_to_int(r.cant_resenas),
        'latitud', public.parse_decimal_nullable(r.latitud),
        'longitud', public.parse_decimal_nullable(r.longitud),
        'imagenes',
          coalesce(
            to_jsonb((
              select array_agg(img)
              from unnest(array[r.imagen_1, r.imagen_2, r.imagen_3]) img
              where nullif(trim(coalesce(img, '')), '') is not null
            )),
            '[]'::jsonb
          )
      )
    ) as metadata
  from public.provider_import_raw r
  where nullif(trim(coalesce(r.codigo, '')), '') is not null
    and nullif(trim(coalesce(r.nombre, '')), '') is not null
  on conflict (external_code) do update
  set
    name = excluded.name,
    type = excluded.type,
    area = excluded.area,
    verified = excluded.verified,
    rating = excluded.rating,
    active = excluded.active,
    metadata = excluded.metadata,
    updated_at = now();

  -- Rebuild listings for imported providers (idempotent refresh)
  delete from public.provider_listings pl
  using public.providers p
  where p.id = pl.provider_id
    and p.external_code in (
      select trim(codigo)
      from public.provider_import_raw
      where nullif(trim(coalesce(codigo, '')), '') is not null
    );

  insert into public.provider_listings (
    provider_id,
    price_from,
    currency,
    availability,
    notes,
    last_synced_at
  )
  select
    p.id,
    svc.price,
    'CLP',
    'Esta semana',
    svc.notes,
    now()
  from public.provider_import_raw r
  join public.providers p on p.external_code = trim(r.codigo)
  cross join lateral (
    values
      (public.parse_clp_to_int(r.precio_hotel para mascotass), concat('Hotel para mascotass: ', nullif(trim(coalesce(r.desc_hotel para mascotass, '')), ''))),
      (public.parse_clp_to_int(r.precio_cuidado_domicilio), concat('Cuidado domicilio: ', nullif(trim(coalesce(r.desc_cuidado_domicilio, '')), ''))),
      (public.parse_clp_to_int(r.precio_salud_mental), concat('Salud mental: ', nullif(trim(coalesce(r.desc_salud_mental, '')), '')))
  ) as svc(price, notes)
  where svc.price is not null;
end;
$$;

revoke all on function public.sync_providers_from_import() from public;
grant execute on function public.sync_providers_from_import() to service_role;
