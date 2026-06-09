-- Legal and clinical fields for the pet profile.

alter table public.pets
  add column if not exists approximate_age integer check (approximate_age is null or approximate_age >= 0),
  add column if not exists life_stage text check (life_stage is null or life_stage in ('puppy', 'adult', 'senior')),
  add column if not exists sex text check (sex is null or sex in ('female', 'male', 'unknown')),
  add column if not exists weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  add column if not exists neutered text check (neutered is null or neutered in ('yes', 'no', 'unknown')),
  add column if not exists microchip_number text,
  add column if not exists national_registry_number text,
  add column if not exists vaccine_status text check (vaccine_status is null or vaccine_status in ('up_to_date', 'pending', 'unknown')),
  add column if not exists vaccine_card_url text,
  add column if not exists veterinary_clinic_name text,
  add column if not exists veterinary_clinic_commune text,
  add column if not exists treating_vet_name text,
  add column if not exists treating_vet_contact text,
  add column if not exists chronic_conditions_allergies text,
  add column if not exists current_medications text;

create index if not exists idx_pets_microchip_number
on public.pets (microchip_number)
where microchip_number is not null;

create index if not exists idx_pets_national_registry_number
on public.pets (national_registry_number)
where national_registry_number is not null;

alter table public.pets enable row level security;

drop policy if exists "pets_select_own_or_staff_or_company_manager" on public.pets;
create policy "pets_select_own_or_staff_or_company_manager"
on public.pets for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_staff()
  or (company_id is not null and public.user_can_read_company_operations(company_id))
);

drop policy if exists "pets_insert_own" on public.pets;
create policy "pets_insert_own"
on public.pets for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "pets_update_own_or_staff_or_company_manager" on public.pets;
create policy "pets_update_own_or_staff_or_company_manager"
on public.pets for update
to authenticated
using (
  owner_id = auth.uid()
  or public.is_staff()
  or (company_id is not null and public.user_can_manage_company_operations(company_id))
)
with check (
  owner_id = auth.uid()
  or public.is_staff()
  or (company_id is not null and public.user_can_manage_company_operations(company_id))
);

notify pgrst, 'reload schema';
