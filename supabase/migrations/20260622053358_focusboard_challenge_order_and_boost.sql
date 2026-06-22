alter table focusboard.focus_board_tasks
  add column if not exists is_boosted boolean not null default false;

create index if not exists focus_board_tasks_boosted_idx
  on focusboard.focus_board_tasks (board_key, is_boosted)
  where is_boosted = true;
