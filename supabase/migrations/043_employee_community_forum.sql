-- Employee Community Forum
-- Mirrors Seniorcare's "Community" feature: employees share experiences, ask questions, and get advice

-- Community posts
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_anonymous boolean not null default false,
  is_pinned boolean not null default false,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

-- Community comments
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_comments enable row level security;

-- Community post likes
create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

alter table public.community_likes enable row level security;

-- RLS: company members can read their company's posts
create policy "company_members_select_community_posts"
  on public.community_posts for select
  using (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = community_posts.company_id
      and cm.user_id = auth.uid()
    )
    or author_id = auth.uid()
  );

-- RLS: company members can insert posts
create policy "company_members_insert_community_posts"
  on public.community_posts for insert
  with check (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = community_posts.company_id
      and cm.user_id = auth.uid()
    )
    and (author_id = auth.uid() or author_id is null)
  );

-- RLS: post authors and company admins can update
create policy "post_author_or_admin_update_community_posts"
  on public.community_posts for update
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.company_members cm
      join public.profiles p on p.id = cm.user_id
      where cm.company_id = community_posts.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'admin', 'manager')
    )
  );

-- RLS: post authors and company admins can delete
create policy "post_author_or_admin_delete_community_posts"
  on public.community_posts for delete
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.company_members cm
      join public.profiles p on p.id = cm.user_id
      where cm.company_id = community_posts.company_id
      and cm.user_id = auth.uid()
      and p.role in ('company_admin', 'admin', 'manager')
    )
  );

-- RLS: comments - company members can read
create policy "company_members_select_community_comments"
  on public.community_comments for select
  using (
    exists (
      select 1 from public.community_posts cp
      join public.company_members cm on cm.company_id = cp.company_id
      where cp.id = community_comments.post_id
      and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.community_posts cp
      where cp.id = community_comments.post_id
      and cp.author_id = auth.uid()
    )
  );

-- RLS: comments - insert
create policy "company_members_insert_community_comments"
  on public.community_comments for insert
  with check (
    exists (
      select 1 from public.community_posts cp
      join public.company_members cm on cm.company_id = cp.company_id
      where cp.id = community_comments.post_id
      and cm.user_id = auth.uid()
    )
    and (author_id = auth.uid() or author_id is null)
  );

-- RLS: comments - authors can update/delete
create policy "comment_author_update_community_comments"
  on public.community_comments for update
  using (author_id = auth.uid());

create policy "comment_author_delete_community_comments"
  on public.community_comments for delete
  using (author_id = auth.uid());

-- RLS: likes
create policy "anyone_select_community_likes"
  on public.community_likes for select
  using (true);

create policy "authenticated_insert_community_likes"
  on public.community_likes for insert
  with check (user_id = auth.uid());

create policy "owner_delete_community_likes"
  on public.community_likes for delete
  using (user_id = auth.uid());

-- Auto-update updated_at
create or replace trigger set_community_post_updated_at
  before update on public.community_posts
  for each row execute function set_updated_at();

create or replace trigger set_community_comment_updated_at
  before update on public.community_comments
  for each row execute function set_updated_at();

-- Grant access
grant select, insert, update, delete on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
grant select, insert, delete on public.community_likes to authenticated;
