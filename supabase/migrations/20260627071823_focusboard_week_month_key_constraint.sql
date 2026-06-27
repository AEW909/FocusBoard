alter table focusboard.focus_board_events
  drop constraint if exists focus_board_events_month_matches_week_check;

alter table focusboard.focus_board_events
  add constraint focus_board_events_month_matches_week_check
  check (month_key = date_trunc('month', week_start)::date);
