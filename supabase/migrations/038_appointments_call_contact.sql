alter table public.appointments
  add column if not exists appointment_phone text,
  add column if not exists appointment_contact_name text;

notify pgrst, 'reload schema';
