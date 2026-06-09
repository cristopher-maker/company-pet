insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-images',
  'community-post-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_post_images_select_public" on storage.objects;
create policy "community_post_images_select_public"
on storage.objects for select
to public
using (bucket_id = 'community-post-images');

drop policy if exists "community_post_images_insert_company_member" on storage.objects;
create policy "community_post_images_insert_company_member"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-post-images'
  and auth.uid()::text = (storage.foldername(name))[2]
  and exists (
    select 1
    from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "community_post_images_delete_owner" on storage.objects;
create policy "community_post_images_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-post-images'
  and auth.uid()::text = (storage.foldername(name))[2]
);
