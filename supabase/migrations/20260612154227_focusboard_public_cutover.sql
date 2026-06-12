do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'focus_board_settings'
  ) then
    raise exception 'Expected source table public.focus_board_settings to exist before cutover.';
  end if;
end
$$;

truncate table
  focusboard.focus_board_events,
  focusboard.focus_board_task_metrics,
  focusboard.focus_board_reward_tiers,
  focusboard.focus_board_tasks,
  focusboard.focus_board_settings;

insert into focusboard.focus_board_settings (
  board_key,
  board_slug,
  admin_slug,
  title,
  subtitle,
  weekly_target,
  created_at,
  updated_at,
  weekly_reward_label,
  weekly_reward_description,
  weekly_reward_locked_sticker_src,
  weekly_reward_unlocked_sticker_src,
  weekly_reward_sticker_alt,
  weekly_reward_locked_description,
  weekly_reward_unlocked_description
)
select
  board_key,
  board_slug,
  admin_slug,
  title,
  subtitle,
  weekly_target,
  created_at,
  updated_at,
  weekly_reward_label,
  weekly_reward_description,
  weekly_reward_locked_sticker_src,
  weekly_reward_unlocked_sticker_src,
  weekly_reward_sticker_alt,
  weekly_reward_locked_description,
  weekly_reward_unlocked_description
from public.focus_board_settings;

insert into focusboard.focus_board_tasks (
  id,
  board_key,
  task_key,
  icon,
  sticker_src,
  sticker_alt,
  title,
  description,
  accent_class,
  sort_order,
  created_at,
  updated_at,
  is_active,
  is_visible
)
select
  id,
  board_key,
  task_key,
  icon,
  sticker_src,
  sticker_alt,
  title,
  description,
  accent_class,
  sort_order,
  created_at,
  updated_at,
  is_active,
  is_visible
from public.focus_board_tasks;

insert into focusboard.focus_board_task_metrics (
  id,
  task_id,
  metric_key,
  label,
  target,
  points,
  kind,
  sort_order,
  created_at,
  updated_at,
  is_active,
  is_visible
)
select
  id,
  task_id,
  metric_key,
  label,
  target,
  points,
  kind,
  sort_order,
  created_at,
  updated_at,
  is_active,
  is_visible
from public.focus_board_task_metrics;

insert into focusboard.focus_board_reward_tiers (
  id,
  board_key,
  label,
  min_points,
  min_weeks_hit,
  locked_sticker_src,
  unlocked_sticker_src,
  sticker_alt,
  description,
  sort_order,
  created_at,
  updated_at
)
select
  id,
  board_key,
  label,
  min_points,
  min_weeks_hit,
  locked_sticker_src,
  unlocked_sticker_src,
  sticker_alt,
  description,
  sort_order,
  created_at,
  updated_at
from public.focus_board_reward_tiers;

insert into focusboard.focus_board_events (
  id,
  board_key,
  month_key,
  week_start,
  task_key,
  metric_key,
  points,
  created_at
)
select
  id,
  board_key,
  month_key,
  week_start,
  task_key,
  metric_key,
  points,
  created_at
from public.focus_board_events;
