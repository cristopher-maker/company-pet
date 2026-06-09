alter table public.benefit_usage
  add column if not exists pet_id uuid references public.pets (id) on delete set null;

create index if not exists idx_benefit_usage_pet_id
  on public.benefit_usage (pet_id);

notify pgrst, 'reload schema';
