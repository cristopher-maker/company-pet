-- Company Pet
-- Deprecated compatibility migration.
-- The employee task view is now backed by public.pet_support_requests.

notify pgrst, 'reload schema';
