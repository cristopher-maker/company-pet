-- Company Pet
-- Deprecated compatibility migration.
-- The old care_intakes table was replaced by public.pet_support_requests.

notify pgrst, 'reload schema';
