alter table public.pets
  add column if not exists pet_photo_url text,
  add column if not exists data_consent_accepted boolean not null default false,
  add column if not exists data_consent_accepted_at timestamptz;

insert into storage.buckets (id, name, public)
values ('pet-files', 'pet-files', false)
on conflict (id) do nothing;

drop policy if exists "pet_files_select_authenticated" on storage.objects;
create policy "pet_files_select_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'pet-files');

drop policy if exists "pet_files_insert_own_folder" on storage.objects;
create policy "pet_files_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pet-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "pet_files_update_own_folder" on storage.objects;
create policy "pet_files_update_own_folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pet-files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'pet-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

notify pgrst, 'reload schema';
