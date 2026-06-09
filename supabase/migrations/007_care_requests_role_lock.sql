-- Company Pet
-- Deprecated compatibility migration.
-- Request/message RLS is now defined for public.pet_support_requests and
-- public.pet_support_messages in 027_replace_legacy_care_tables.sql.

notify pgrst, 'reload schema';
