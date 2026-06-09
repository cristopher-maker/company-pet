-- Create the resource-files storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resource-files',
  'resource-files',
  true,
  104857600, -- 100MB
  array[
    'application/pdf',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS Policies for resource-files
drop policy if exists "resource_files_select_public" on storage.objects;
create policy "resource_files_select_public"
on storage.objects for select
to public
using (bucket_id = 'resource-files');

drop policy if exists "resource_files_insert_staff" on storage.objects;
create policy "resource_files_insert_staff"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resource-files'
  and public.is_staff()
);

drop policy if exists "resource_files_update_staff" on storage.objects;
create policy "resource_files_update_staff"
on storage.objects for update
to authenticated
using (
  bucket_id = 'resource-files'
  and public.is_staff()
)
with check (
  bucket_id = 'resource-files'
  and public.is_staff()
);

drop policy if exists "resource_files_delete_staff" on storage.objects;
create policy "resource_files_delete_staff"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'resource-files'
  and public.is_staff()
);
