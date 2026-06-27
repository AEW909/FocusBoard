alter table focusboard.focus_board_task_metrics
  add column if not exists checkbox_options jsonb not null default '[]'::jsonb;

update focusboard.focus_board_task_metrics
set
  kind = 'count',
  target = 1
where kind = 'toggle';

alter table focusboard.focus_board_task_metrics
  drop constraint if exists focus_board_task_metrics_kind_check;

alter table focusboard.focus_board_task_metrics
  add constraint focus_board_task_metrics_kind_check
  check (kind in ('count', 'checkbox'));
