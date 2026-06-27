create table if not exists focusboard.focus_board_sections (
  id uuid primary key default gen_random_uuid(),
  board_key text not null references focusboard.focus_board_settings (board_key) on delete cascade,
  section_key text not null,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint focus_board_sections_board_section_unique unique (board_key, section_key)
);

create index if not exists focus_board_sections_board_sort_idx
  on focusboard.focus_board_sections (board_key, sort_order)
  where is_active = true;

alter table focusboard.focus_board_sections enable row level security;
revoke all on focusboard.focus_board_sections from anon, authenticated;
grant all on focusboard.focus_board_sections to postgres, service_role;

insert into focusboard.focus_board_sections (
  board_key,
  section_key,
  title,
  description,
  sort_order,
  is_active,
  is_visible
)
select
  settings.board_key,
  'main_goals',
  'Main goals',
  '',
  1,
  true,
  true
from focusboard.focus_board_settings settings
on conflict (board_key, section_key) do nothing;

alter table focusboard.focus_board_tasks
  add column if not exists section_id uuid references focusboard.focus_board_sections (id) on delete restrict;

update focusboard.focus_board_tasks tasks
set section_id = sections.id
from focusboard.focus_board_sections sections
where tasks.section_id is null
  and sections.board_key = tasks.board_key
  and sections.section_key = 'main_goals';

alter table focusboard.focus_board_tasks
  alter column section_id set not null;

create index if not exists focus_board_tasks_section_sort_idx
  on focusboard.focus_board_tasks (section_id, sort_order)
  where is_active = true;
