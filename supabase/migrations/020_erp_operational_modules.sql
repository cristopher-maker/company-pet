-- ERP operational modules: system configuration, documents, comments, onboarding and invitations

alter table public.company_branding
add column if not exists erp_primary_color text not null default '#123c4a',
add column if not exists erp_accent_color text not null default '#f27a5e',
add column if not exists erp_background_color text not null default '#f8fafc',
add column if not exists erp_surface_color text not null default '#ffffff',
add column if not exists erp_text_color text not null default '#0f172a',
add column if not exists erp_button_style text not null default 'solid'
  check (erp_button_style in ('solid', 'soft', 'outline')),
add column if not exists erp_radius text not null default 'compact'
  check (erp_radius in ('compact', 'rounded', 'pill')),
add column if not exists erp_density text not null default 'comfortable'
  check (erp_density in ('compact', 'comfortable', 'spacious')),
add column if not exists erp_font_family text not null default 'dm_sans'
  check (erp_font_family in ('dm_sans', 'inter', 'system'));

create table if not exists public.system_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  scope text not null check (scope in ('request', 'task', 'provider', 'document', 'lead')),
  name text not null,
  color text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_categories_company_scope
on public.system_categories (company_id, scope, active, sort_order);

drop trigger if exists trg_system_categories_updated_at on public.system_categories;
create trigger trg_system_categories_updated_at
before update on public.system_categories
for each row execute function public.set_updated_at();

create table if not exists public.system_statuses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  scope text not null check (scope in ('request', 'task', 'lead', 'document', 'onboarding')),
  code text not null,
  label text not null,
  color text,
  is_terminal boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_system_statuses_company_scope_code
on public.system_statuses (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, code);

drop trigger if exists trg_system_statuses_updated_at on public.system_statuses;
create trigger trg_system_statuses_updated_at
before update on public.system_statuses
for each row execute function public.set_updated_at();

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  subject text not null,
  body_html text not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_email_templates_company_code
on public.email_templates (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

create table if not exists public.plan_slas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  plan_tier text not null,
  request_response_hours integer not null default 24 check (request_response_hours >= 0),
  task_due_hours integer not null default 72 check (task_due_hours >= 0),
  escalation_hours integer not null default 96 check (escalation_hours >= 0),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_plan_slas_company_tier
on public.plan_slas (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), plan_tier);

drop trigger if exists trg_plan_slas_updated_at on public.plan_slas;
create trigger trg_plan_slas_updated_at
before update on public.plan_slas
for each row execute function public.set_updated_at();

create table if not exists public.business_parameters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  key text not null,
  label text not null,
  value jsonb not null default 'null'::jsonb,
  value_type text not null default 'text' check (value_type in ('text', 'number', 'boolean', 'json')),
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_business_parameters_company_key
on public.business_parameters (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

drop trigger if exists trg_business_parameters_updated_at on public.business_parameters;
create trigger trg_business_parameters_updated_at
before update on public.business_parameters
for each row execute function public.set_updated_at();

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text check (entity_type in ('company', 'case', 'request', 'lead', 'provider', 'proposal', 'contract')),
  entity_id uuid,
  document_type text not null check (document_type in ('contract', 'company_file', 'case_file', 'certificate', 'proposal', 'other')),
  title text not null,
  file_name text,
  storage_bucket text not null default 'company-documents',
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'archived')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_documents_company_entity
on public.company_documents (company_id, entity_type, entity_id, created_at desc);

drop trigger if exists trg_company_documents_updated_at on public.company_documents;
create trigger trg_company_documents_updated_at
before update on public.company_documents
for each row execute function public.set_updated_at();

create table if not exists public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text not null check (entity_type in ('company', 'case', 'request', 'task', 'lead', 'provider', 'document', 'onboarding')),
  entity_id uuid,
  body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'company')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entity_comments_company_entity
on public.entity_comments (company_id, entity_type, entity_id, created_at desc);

drop trigger if exists trg_entity_comments_updated_at on public.entity_comments;
create trigger trg_entity_comments_updated_at
before update on public.entity_comments
for each row execute function public.set_updated_at();

create table if not exists public.comment_mentions (
  comment_id uuid not null references public.entity_comments (id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_user_id)
);

create table if not exists public.onboarding_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null default 'Onboarding empresa',
  plan_tier text,
  owner_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'paused')),
  starts_at date,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_projects_company_status
on public.onboarding_projects (company_id, status, created_at desc);

drop trigger if exists trg_onboarding_projects_updated_at on public.onboarding_projects;
create trigger trg_onboarding_projects_updated_at
before update on public.onboarding_projects
for each row execute function public.set_updated_at();

create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects (id) on delete cascade,
  step_key text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  required boolean not null default true,
  completed boolean not null default false,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_onboarding_steps_project_key
on public.onboarding_steps (project_id, step_key);

drop trigger if exists trg_onboarding_steps_updated_at on public.onboarding_steps;
create trigger trg_onboarding_steps_updated_at
before update on public.onboarding_steps
for each row execute function public.set_updated_at();

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role text not null default 'employee' check (role in ('employee', 'hr_admin', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.profiles (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_company_invitations_company_email_pending
on public.company_invitations (company_id, lower(email))
where status = 'pending';

drop trigger if exists trg_company_invitations_updated_at on public.company_invitations;
create trigger trg_company_invitations_updated_at
before update on public.company_invitations
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

alter table public.system_categories enable row level security;
alter table public.system_statuses enable row level security;
alter table public.email_templates enable row level security;
alter table public.plan_slas enable row level security;
alter table public.business_parameters enable row level security;
alter table public.company_documents enable row level security;
alter table public.entity_comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.onboarding_projects enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.company_invitations enable row level security;

create or replace function public.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('hr_admin', 'manager')
    );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
    );
$$;

drop policy if exists "company_branding_write_company_manager" on public.company_branding;
create policy "company_branding_write_company_manager"
on public.company_branding for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

drop policy if exists "erp_global_or_company_select_categories" on public.system_categories;
create policy "erp_global_or_company_select_categories"
on public.system_categories for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "erp_manage_categories" on public.system_categories;
create policy "erp_manage_categories"
on public.system_categories for all
to authenticated
using (company_id is not null and public.can_manage_company(company_id))
with check (company_id is not null and public.can_manage_company(company_id));

drop policy if exists "erp_global_or_company_select_statuses" on public.system_statuses;
create policy "erp_global_or_company_select_statuses"
on public.system_statuses for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "erp_manage_statuses" on public.system_statuses;
create policy "erp_manage_statuses"
on public.system_statuses for all
to authenticated
using (company_id is not null and public.can_manage_company(company_id))
with check (company_id is not null and public.can_manage_company(company_id));

drop policy if exists "erp_global_or_company_select_templates" on public.email_templates;
create policy "erp_global_or_company_select_templates"
on public.email_templates for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "erp_manage_templates" on public.email_templates;
create policy "erp_manage_templates"
on public.email_templates for all
to authenticated
using (company_id is not null and public.can_manage_company(company_id))
with check (company_id is not null and public.can_manage_company(company_id));

drop policy if exists "erp_global_or_company_select_slas" on public.plan_slas;
create policy "erp_global_or_company_select_slas"
on public.plan_slas for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "erp_manage_slas" on public.plan_slas;
create policy "erp_manage_slas"
on public.plan_slas for all
to authenticated
using (company_id is not null and public.can_manage_company(company_id))
with check (company_id is not null and public.can_manage_company(company_id));

drop policy if exists "erp_global_or_company_select_parameters" on public.business_parameters;
create policy "erp_global_or_company_select_parameters"
on public.business_parameters for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "erp_manage_parameters" on public.business_parameters;
create policy "erp_manage_parameters"
on public.business_parameters for all
to authenticated
using (company_id is not null and public.can_manage_company(company_id))
with check (company_id is not null and public.can_manage_company(company_id));

drop policy if exists "erp_company_documents_select" on public.company_documents;
create policy "erp_company_documents_select"
on public.company_documents for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "erp_company_documents_manage" on public.company_documents;
create policy "erp_company_documents_manage"
on public.company_documents for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

drop policy if exists "erp_entity_comments_select" on public.entity_comments;
create policy "erp_entity_comments_select"
on public.entity_comments for select
to authenticated
using (
  public.is_company_member(company_id)
  and (visibility = 'company' or public.can_manage_company(company_id))
);

drop policy if exists "erp_entity_comments_insert" on public.entity_comments;
create policy "erp_entity_comments_insert"
on public.entity_comments for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_company_member(company_id)
);

drop policy if exists "erp_entity_comments_update_own_or_manager" on public.entity_comments;
create policy "erp_entity_comments_update_own_or_manager"
on public.entity_comments for update
to authenticated
using (created_by = auth.uid() or public.can_manage_company(company_id))
with check (created_by = auth.uid() or public.can_manage_company(company_id));

drop policy if exists "erp_comment_mentions_select" on public.comment_mentions;
create policy "erp_comment_mentions_select"
on public.comment_mentions for select
to authenticated
using (
  mentioned_user_id = auth.uid()
  or exists (
    select 1
    from public.entity_comments c
    where c.id = comment_mentions.comment_id
      and public.is_company_member(c.company_id)
  )
);

drop policy if exists "erp_comment_mentions_insert_company_member" on public.comment_mentions;
create policy "erp_comment_mentions_insert_company_member"
on public.comment_mentions for insert
to authenticated
with check (
  exists (
    select 1
    from public.entity_comments c
    where c.id = comment_mentions.comment_id
      and public.is_company_member(c.company_id)
  )
);

drop policy if exists "erp_onboarding_projects_select" on public.onboarding_projects;
create policy "erp_onboarding_projects_select"
on public.onboarding_projects for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "erp_onboarding_projects_manage" on public.onboarding_projects;
create policy "erp_onboarding_projects_manage"
on public.onboarding_projects for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

drop policy if exists "erp_onboarding_steps_select" on public.onboarding_steps;
create policy "erp_onboarding_steps_select"
on public.onboarding_steps for select
to authenticated
using (
  exists (
    select 1
    from public.onboarding_projects p
    where p.id = onboarding_steps.project_id
      and public.is_company_member(p.company_id)
  )
);

drop policy if exists "erp_onboarding_steps_manage" on public.onboarding_steps;
create policy "erp_onboarding_steps_manage"
on public.onboarding_steps for all
to authenticated
using (
  exists (
    select 1
    from public.onboarding_projects p
    where p.id = onboarding_steps.project_id
      and public.can_manage_company(p.company_id)
  )
)
with check (
  exists (
    select 1
    from public.onboarding_projects p
    where p.id = onboarding_steps.project_id
      and public.can_manage_company(p.company_id)
  )
);

drop policy if exists "erp_company_invitations_select" on public.company_invitations;
create policy "erp_company_invitations_select"
on public.company_invitations for select
to authenticated
using (public.can_manage_company(company_id));

drop policy if exists "erp_company_invitations_manage" on public.company_invitations;
create policy "erp_company_invitations_manage"
on public.company_invitations for all
to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

drop policy if exists "company_documents_storage_select" on storage.objects;
create policy "company_documents_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-documents'
  and exists (
    select 1
    from public.company_documents d
    where d.storage_bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and public.is_company_member(d.company_id)
  )
);

drop policy if exists "company_documents_storage_insert" on storage.objects;
create policy "company_documents_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-documents'
  and exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
      and storage.objects.name like cm.company_id::text || '/%'
  )
);

drop policy if exists "company_documents_storage_delete" on storage.objects;
create policy "company_documents_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-documents'
  and exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
      and storage.objects.name like cm.company_id::text || '/%'
  )
);
