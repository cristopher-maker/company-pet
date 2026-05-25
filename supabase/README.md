# Supabase (SQL)

Scripts para crear las tablas del portal **Company Pet**.

## Cómo usar
- En Supabase Dashboard → **SQL Editor** → pega y ejecuta `supabase/migrations/001_portal_core.sql`.
- Luego ejecuta `supabase/migrations/002_b2b_vouchers_metrics.sql` para habilitar panel B2B, vouchers y métricas.
- Si usas Supabase CLI, puedes mover estos archivos a tu repo con `supabase/` y correr migraciones.

## Tablas
- `public.profiles`: perfil 1:1 con `auth.users`
- `public.care_requests`, `public.care_messages`: asesoría personalizada (tickets + chat)
- `public.providers`, `public.provider_listings`: proveedores verificados (catálogo + disponibilidad/precio cache)
- `public.resources`: biblioteca (incluye financiación)
- `public.training_courses`, `public.training_events`, `public.training_enrollments`: formación

Incluye RLS y policies base.
