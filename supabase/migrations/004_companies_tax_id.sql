-- Company Pet
-- Add company tax id (RUT) for Chilean companies.

alter table public.companies
  add column if not exists tax_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_tax_id_unique'
  ) then
    alter table public.companies
      add constraint companies_tax_id_unique unique (tax_id);
  end if;
end $$;

