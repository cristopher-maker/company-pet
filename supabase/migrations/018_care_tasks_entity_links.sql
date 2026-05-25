alter table public.care_tasks
add column if not exists entity_type text
check (entity_type in ('lead', 'sede', 'cama', 'paciente'));

alter table public.care_tasks
add column if not exists entity_id uuid;

alter table public.care_tasks
add column if not exists entity_label text;

create index if not exists idx_care_tasks_entity_type_entity_id
on public.care_tasks (entity_type, entity_id);
