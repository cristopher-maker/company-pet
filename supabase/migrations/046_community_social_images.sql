alter table public.community_posts
  add column if not exists image_url text;

notify pgrst, 'reload schema';
