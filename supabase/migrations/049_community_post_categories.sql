alter table public.community_posts
  add column if not exists category text not null default 'stories';

alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (category in ('stories', 'questions', 'health', 'care', 'adoption', 'events'));

notify pgrst, 'reload schema';
