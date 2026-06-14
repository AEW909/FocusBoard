-- Run before dropping legacy PhysioNote-era FocusBoard tables from the shared Supabase project.
-- Safe result for removal:
-- 1. PhysioNote has been redeployed with redirect-only FocusBoard shims.
-- 2. No live app depends on these tables.
-- 3. Counts are understood and, if needed, preserved in focusboard.*.

select
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'focus_board_settings',
    'focus_board_tasks',
    'focus_board_task_metrics',
    'focus_board_reward_tiers',
    'focus_board_events'
  )
order by tablename;

select 'public.focus_board_settings' as table_name, count(*) as row_count from public.focus_board_settings
union all
select 'public.focus_board_tasks', count(*) from public.focus_board_tasks
union all
select 'public.focus_board_task_metrics', count(*) from public.focus_board_task_metrics
union all
select 'public.focus_board_reward_tiers', count(*) from public.focus_board_reward_tiers
union all
select 'public.focus_board_events', count(*) from public.focus_board_events;

select 'focusboard.focus_board_settings' as table_name, count(*) as row_count from focusboard.focus_board_settings
union all
select 'focusboard.focus_board_tasks', count(*) from focusboard.focus_board_tasks
union all
select 'focusboard.focus_board_task_metrics', count(*) from focusboard.focus_board_task_metrics
union all
select 'focusboard.focus_board_reward_tiers', count(*) from focusboard.focus_board_reward_tiers
union all
select 'focusboard.focus_board_events', count(*) from focusboard.focus_board_events;
