alter table public.companies
  add column if not exists plan_tier text not null default 'lite';

alter table public.companies
  drop constraint if exists companies_plan_tier_check;

alter table public.companies
  add constraint companies_plan_tier_check
  check (plan_tier in ('lite', 'empresa', 'premium'));
