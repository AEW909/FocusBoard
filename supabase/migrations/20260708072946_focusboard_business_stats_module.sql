alter table focusboard.clients
  add column if not exists business_stats_enabled boolean not null default false;

create table if not exists focusboard.business_stat_groups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references focusboard.clients (id) on delete cascade,
  name text not null,
  color text not null default '#00f5d4',
  sort_order integer not null default 1,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_stat_groups_name_not_blank check (length(trim(name)) > 0)
);

create table if not exists focusboard.business_stat_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references focusboard.clients (id) on delete cascade,
  group_id uuid references focusboard.business_stat_groups (id) on delete set null,
  name text not null,
  unit text not null default 'number' check (unit in ('number', 'currency', 'percent')),
  prefix text not null default '',
  suffix text not null default '',
  color text not null default '#ff4dca',
  weekly_target numeric,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_stat_categories_name_not_blank check (length(trim(name)) > 0),
  constraint business_stat_categories_target_non_negative check (weekly_target is null or weekly_target >= 0)
);

create table if not exists focusboard.business_stat_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references focusboard.clients (id) on delete cascade,
  category_id uuid not null references focusboard.business_stat_categories (id) on delete cascade,
  week_start date not null,
  value numeric not null default 0,
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_stat_entries_value_non_negative check (value >= 0),
  constraint business_stat_entries_week_unique unique (category_id, week_start)
);

create index if not exists business_stat_groups_client_order_idx
  on focusboard.business_stat_groups (client_id, is_active, is_visible, sort_order);

create index if not exists business_stat_categories_client_group_order_idx
  on focusboard.business_stat_categories (client_id, group_id, is_active, is_visible, sort_order);

create index if not exists business_stat_entries_client_week_idx
  on focusboard.business_stat_entries (client_id, week_start);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_stat_groups_id_client_unique'
      and conrelid = 'focusboard.business_stat_groups'::regclass
  ) then
    alter table focusboard.business_stat_groups
      add constraint business_stat_groups_id_client_unique unique (id, client_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_stat_categories_id_client_unique'
      and conrelid = 'focusboard.business_stat_categories'::regclass
  ) then
    alter table focusboard.business_stat_categories
      add constraint business_stat_categories_id_client_unique unique (id, client_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_stat_categories_group_client_fkey'
      and conrelid = 'focusboard.business_stat_categories'::regclass
  ) then
    alter table focusboard.business_stat_categories
      add constraint business_stat_categories_group_client_fkey
      foreign key (group_id, client_id)
      references focusboard.business_stat_groups (id, client_id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_stat_entries_category_client_fkey'
      and conrelid = 'focusboard.business_stat_entries'::regclass
  ) then
    alter table focusboard.business_stat_entries
      add constraint business_stat_entries_category_client_fkey
      foreign key (category_id, client_id)
      references focusboard.business_stat_categories (id, client_id)
      on delete cascade;
  end if;
end
$$;

alter table focusboard.business_stat_groups enable row level security;
alter table focusboard.business_stat_categories enable row level security;
alter table focusboard.business_stat_entries enable row level security;

revoke all on focusboard.business_stat_groups from anon, authenticated;
revoke all on focusboard.business_stat_categories from anon, authenticated;
revoke all on focusboard.business_stat_entries from anon, authenticated;

grant all on focusboard.business_stat_groups to postgres, service_role;
grant all on focusboard.business_stat_categories to postgres, service_role;
grant all on focusboard.business_stat_entries to postgres, service_role;
