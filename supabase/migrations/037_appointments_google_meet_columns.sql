alter table public.appointments
  add column if not exists meeting_provider text,
  add column if not exists meeting_url text,
  add column if not exists meeting_code text,
  add column if not exists meeting_space_name text;

notify pgrst, 'reload schema';
