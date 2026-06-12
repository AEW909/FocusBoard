alter table focusboard.focus_board_tasks
  add column if not exists is_visible boolean not null default true;

update focusboard.focus_board_tasks
set is_visible = true
where is_visible is null;
