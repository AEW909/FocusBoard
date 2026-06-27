create table if not exists focusboard.focus_board_weekly_roundups (
  id uuid primary key default gen_random_uuid(),
  board_key text not null references focusboard.focus_board_settings(board_key) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint focus_board_weekly_roundups_unique_user_week
    unique (board_key, user_id, week_start)
);

create index if not exists focus_board_weekly_roundups_user_board_idx
  on focusboard.focus_board_weekly_roundups (user_id, board_key, week_start desc);
