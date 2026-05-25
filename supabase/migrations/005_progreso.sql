-- Company Pet
-- Persist course progress per user (training_enrollments).

alter table public.training_enrollments
  add column if not exists progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  add column if not exists last_accessed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_training_enrollments_updated_at on public.training_enrollments;
create trigger trg_training_enrollments_updated_at
before update on public.training_enrollments
for each row execute function public.set_updated_at();

