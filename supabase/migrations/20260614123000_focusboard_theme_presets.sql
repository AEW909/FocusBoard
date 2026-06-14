alter table focusboard.focus_board_settings
add column if not exists theme_preset text not null default 'neon';

update focusboard.focus_board_settings
set theme_preset = 'neon'
where coalesce(theme_preset, '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'focus_board_settings_theme_preset_check'
      and conrelid = 'focusboard.focus_board_settings'::regclass
  ) then
    alter table focusboard.focus_board_settings
    add constraint focus_board_settings_theme_preset_check
    check (theme_preset in ('neon', 'sunset_pop', 'lagoon_bounce', 'citrus_blast'));
  end if;
end $$;
