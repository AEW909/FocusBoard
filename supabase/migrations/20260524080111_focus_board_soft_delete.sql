alter table focusboard.focus_board_tasks
  add column if not exists is_active boolean not null default true;

alter table focusboard.focus_board_task_metrics
  add column if not exists is_active boolean not null default true;

update focusboard.focus_board_tasks
set is_active = true
where is_active is null;

update focusboard.focus_board_task_metrics
set is_active = true
where is_active is null;
