create table if not exists public.care_task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid,
  action text not null check (action in ('created', 'updated', 'status_changed', 'deleted')),
  changed_by uuid references public.profiles (id) on delete set null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_care_task_history_task_id_created_at
on public.care_task_history (task_id, created_at desc);

create index if not exists idx_care_task_history_changed_by_created_at
on public.care_task_history (changed_by, created_at desc);

create or replace function public.log_care_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  summary_text text;
begin
  if tg_op = 'INSERT' then
    action_name := 'created';
    summary_text := 'Tarea creada: ' || new.title;

    insert into public.care_task_history (task_id, action, changed_by, summary, metadata)
    values (
      new.id,
      action_name,
      auth.uid(),
      summary_text,
      jsonb_build_object(
        'title', new.title,
        'status', new.status,
        'priority', new.priority,
        'entity_label', new.entity_label
      )
    );

    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      action_name := 'status_changed';
      summary_text := 'Estado: ' || old.status || ' -> ' || new.status;
    else
      action_name := 'updated';
      summary_text := 'Tarea actualizada: ' || new.title;
    end if;

    insert into public.care_task_history (task_id, action, changed_by, summary, metadata)
    values (
      new.id,
      action_name,
      auth.uid(),
      summary_text,
      jsonb_build_object(
        'title_before', old.title,
        'title_after', new.title,
        'status_before', old.status,
        'status_after', new.status,
        'priority_before', old.priority,
        'priority_after', new.priority,
        'entity_label_before', old.entity_label,
        'entity_label_after', new.entity_label
      )
    );

    return new;
  elsif tg_op = 'DELETE' then
    insert into public.care_task_history (task_id, action, changed_by, summary, metadata)
    values (
      old.id,
      'deleted',
      auth.uid(),
      'Tarea eliminada: ' || old.title,
      jsonb_build_object(
        'title', old.title,
        'status', old.status,
        'priority', old.priority,
        'entity_label', old.entity_label
      )
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_care_tasks_history on public.care_tasks;
create trigger trg_care_tasks_history
after insert or update or delete on public.care_tasks
for each row execute function public.log_care_task_change();

alter table public.care_task_history enable row level security;

drop policy if exists "care_task_history_select_participants" on public.care_task_history;
create policy "care_task_history_select_participants"
on public.care_task_history for select
to authenticated
using (
  public.is_staff()
  or changed_by = auth.uid()
  or exists (
    select 1
    from public.care_tasks ct
    where ct.id = care_task_history.task_id
      and ct.employee_id = auth.uid()
  )
);
