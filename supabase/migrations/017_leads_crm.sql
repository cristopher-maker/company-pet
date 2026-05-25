create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid references public.profiles (id) on delete set null,
  assigned_expert_id uuid references public.profiles (id) on delete set null,
  nombre text not null,
  telefono text,
  comuna text,
  dependencia text,
  presupuesto numeric,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'evaluacion', 'match', 'cerrado', 'perdido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_company_id_created_at
on public.leads (company_id, created_at desc);

create index if not exists idx_leads_company_id_estado
on public.leads (company_id, estado);

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp', 'llamada', 'email', 'nota', 'videollamada')),
  mensaje text not null,
  fecha timestamptz not null default now()
);

create index if not exists idx_lead_interactions_lead_id_fecha
on public.lead_interactions (lead_id, fecha desc);

create table if not exists public.lead_pipeline_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null check (estado_nuevo in ('nuevo', 'contactado', 'evaluacion', 'match', 'cerrado', 'perdido')),
  changed_by uuid references public.profiles (id) on delete set null,
  fecha timestamptz not null default now()
);

create index if not exists idx_lead_pipeline_history_lead_id_fecha
on public.lead_pipeline_history (lead_id, fecha desc);

create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.lead_pipeline_history (lead_id, estado_anterior, estado_nuevo, changed_by, fecha)
    values (new.id, old.estado, new.estado, auth.uid(), now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_pipeline_history on public.leads;
create trigger trg_leads_pipeline_history
after update on public.leads
for each row execute function public.log_lead_status_change();

alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.lead_pipeline_history enable row level security;

drop policy if exists "leads_select_company_or_staff" on public.leads;
create policy "leads_select_company_or_staff"
on public.leads for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = leads.company_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "leads_write_company_or_staff" on public.leads;
create policy "leads_write_company_or_staff"
on public.leads for all
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = leads.company_id
      and cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
  )
)
with check (
  public.is_staff()
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = leads.company_id
      and cm.user_id = auth.uid()
      and cm.member_role in ('hr_admin', 'manager')
  )
);

drop policy if exists "lead_interactions_select_company_or_staff" on public.lead_interactions;
create policy "lead_interactions_select_company_or_staff"
on public.lead_interactions for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.leads l
    join public.company_members cm on cm.company_id = l.company_id
    where l.id = lead_interactions.lead_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "lead_interactions_insert_company_or_staff" on public.lead_interactions;
create policy "lead_interactions_insert_company_or_staff"
on public.lead_interactions for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_staff()
    or exists (
      select 1
      from public.leads l
      join public.company_members cm on cm.company_id = l.company_id
      where l.id = lead_interactions.lead_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('hr_admin', 'manager')
    )
  )
);

drop policy if exists "lead_pipeline_history_select_company_or_staff" on public.lead_pipeline_history;
create policy "lead_pipeline_history_select_company_or_staff"
on public.lead_pipeline_history for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.leads l
    join public.company_members cm on cm.company_id = l.company_id
    where l.id = lead_pipeline_history.lead_id
      and cm.user_id = auth.uid()
  )
);
