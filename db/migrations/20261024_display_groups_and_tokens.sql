-- Slice 12: display groups and read-only display tokens. Additive only.
-- Rollback: drop table focusboard.display_tokens;
--           alter table focusboard.focus_board_settings drop column display_group;

alter table focusboard.focus_board_settings
  add column if not exists display_group text;

create index if not exists focus_board_settings_display_group_idx
  on focusboard.focus_board_settings (display_group)
  where display_group is not null;

create table if not exists focusboard.display_tokens (
  id uuid primary key default gen_random_uuid(),
  display_group text not null,
  token_hash text not null unique,
  label text not null default '',
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists display_tokens_display_group_idx
  on focusboard.display_tokens (display_group);
