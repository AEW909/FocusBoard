begin;

insert into focusboard.clients (
  client_key,
  display_name,
  status,
  content_lab_enabled
)
values (
  'verification-client',
  'Verification Client',
  'active',
  false
);

insert into focusboard.focus_board_settings (
  client_id,
  board_key,
  board_slug,
  admin_slug,
  title,
  subtitle,
  weekly_target
)
select
  id,
  'verification-board',
  'verification-board-public',
  'verification-board-admin',
  'Verification Board',
  'This board must remain isolated from Liona.',
  25
from focusboard.clients
where client_key = 'verification-client';

insert into focusboard.focus_board_tasks (
  board_key,
  task_key,
  icon,
  sticker_src,
  sticker_alt,
  title,
  description,
  accent_class,
  sort_order
)
values (
  'verification-board',
  'verification-task',
  'TEST',
  '/focus/mascot-rainbow.svg',
  'Verification sticker',
  'Verification task',
  'A temporary task used to prove board isolation.',
  'focus-task-teal',
  1
);

insert into focusboard.focus_board_task_metrics (
  task_id,
  metric_key,
  label,
  target,
  points,
  kind,
  sort_order
)
select
  id,
  'verification-metric',
  'Verified',
  1,
  99,
  'toggle',
  1
from focusboard.focus_board_tasks
where board_key = 'verification-board'
  and task_key = 'verification-task';

insert into focusboard.focus_board_reward_tiers (
  board_key,
  label,
  min_points,
  min_weeks_hit,
  locked_sticker_src,
  unlocked_sticker_src,
  sticker_alt,
  description,
  sort_order
)
values (
  'verification-board',
  'Verification Reward',
  99,
  1,
  '/focus/reward-monster.svg',
  '/focus/reward-monster.svg',
  'Verification reward',
  'A temporary reward used to prove board isolation.',
  1
);

insert into focusboard.focus_board_events (
  board_key,
  month_key,
  week_start,
  task_key,
  metric_key,
  points
)
values (
  'verification-board',
  date '2026-06-01',
  date '2026-06-08',
  'verification-task',
  'verification-metric',
  99
);

do $$
begin
  if (
    select count(*)
    from focusboard.focus_board_settings
    where board_key in ('liona-growth-board', 'verification-board')
  ) <> 2 then
    raise exception 'Expected two independently addressable boards';
  end if;

  if (
    select count(*)
    from focusboard.focus_board_tasks
    where board_key = 'verification-board'
  ) <> 1 then
    raise exception 'Verification board task scope is incorrect';
  end if;

  if (
    select count(*)
    from focusboard.focus_board_tasks
    where board_key = 'liona-growth-board'
      and task_key = 'verification-task'
  ) <> 0 then
    raise exception 'Verification task leaked into Liona board scope';
  end if;

  if (
    select count(*)
    from focusboard.focus_board_events
    where board_key = 'verification-board'
  ) <> 1 then
    raise exception 'Verification board event scope is incorrect';
  end if;

  if (
    select coalesce(sum(points), 0)
    from focusboard.focus_board_events
    where board_key = 'liona-growth-board'
      and task_key = 'verification-task'
  ) <> 0 then
    raise exception 'Verification event leaked into Liona board totals';
  end if;

  if not exists (
    select 1
    from focusboard.focus_board_settings
    where board_slug = 'verification-board-public'
      and board_key = 'verification-board'
  ) then
    raise exception 'Public slug did not resolve to the verification board';
  end if;

  if not exists (
    select 1
    from focusboard.focus_board_settings
    where admin_slug = 'verification-board-admin'
      and board_key = 'verification-board'
  ) then
    raise exception 'Admin slug did not resolve to the verification board';
  end if;
end
$$;

rollback;
