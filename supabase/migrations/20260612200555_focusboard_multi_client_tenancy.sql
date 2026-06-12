create table if not exists focusboard.clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  content_lab_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists focusboard.client_memberships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references focusboard.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('client_admin', 'client_user')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint client_memberships_client_user_unique unique (client_id, user_id)
);

create table if not exists focusboard.platform_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role = 'platform_owner'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists client_memberships_user_active_idx
  on focusboard.client_memberships (user_id, is_active);

create index if not exists client_memberships_client_active_idx
  on focusboard.client_memberships (client_id, is_active);

alter table focusboard.clients enable row level security;
alter table focusboard.client_memberships enable row level security;
alter table focusboard.platform_users enable row level security;

revoke all on focusboard.clients from anon, authenticated;
revoke all on focusboard.client_memberships from anon, authenticated;
revoke all on focusboard.platform_users from anon, authenticated;

grant all on focusboard.clients to postgres, service_role;
grant all on focusboard.client_memberships to postgres, service_role;
grant all on focusboard.platform_users to postgres, service_role;

insert into focusboard.clients (
  client_key,
  display_name,
  status,
  content_lab_enabled
)
values (
  'liona-harris',
  'Liona Harris',
  'active',
  true
)
on conflict (client_key) do update
set
  display_name = excluded.display_name,
  status = excluded.status,
  content_lab_enabled = excluded.content_lab_enabled,
  updated_at = timezone('utc', now());

alter table focusboard.focus_board_settings
  add column if not exists client_id uuid;

update focusboard.focus_board_settings
set client_id = (
  select id
  from focusboard.clients
  where client_key = 'liona-harris'
)
where board_key = 'liona-growth-board'
  and client_id is null;

do $$
begin
  if exists (
    select 1
    from focusboard.focus_board_settings
    where client_id is null
  ) then
    raise exception 'Cannot enforce client ownership: one or more focus boards have no client_id';
  end if;
end
$$;

alter table focusboard.focus_board_settings
  alter column client_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'focus_board_settings_client_id_fkey'
      and conrelid = 'focusboard.focus_board_settings'::regclass
  ) then
    alter table focusboard.focus_board_settings
      add constraint focus_board_settings_client_id_fkey
      foreign key (client_id)
      references focusboard.clients (id)
      on delete restrict;
  end if;
end
$$;

create unique index if not exists focus_board_settings_client_unique_idx
  on focusboard.focus_board_settings (client_id);

insert into focusboard.client_memberships (
  client_id,
  user_id,
  role,
  is_active
)
select
  client.id,
  auth_user.id,
  'client_user',
  true
from focusboard.clients client
join auth.users auth_user
  on lower(auth_user.email) in (
    'liona@harrisphysio.com',
    'liona@harrisphysiotherapy.com'
  )
where client.client_key = 'liona-harris'
on conflict (client_id, user_id) do update
set
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into focusboard.platform_users (
  user_id,
  role,
  is_active
)
select
  id,
  'platform_owner',
  true
from auth.users
where lower(email) = 'andrew_e_wilkinson@hotmail.com'
on conflict (user_id) do update
set
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from focusboard.platform_users platform_user
    join auth.users auth_user on auth_user.id = platform_user.user_id
    where lower(auth_user.email) = 'andrew_e_wilkinson@hotmail.com'
      and platform_user.role = 'platform_owner'
      and platform_user.is_active
  ) then
    raise exception 'FocusBoard platform owner account was not found';
  end if;

  if (
    select count(*)
    from focusboard.client_memberships membership
    join focusboard.clients client on client.id = membership.client_id
    join auth.users auth_user on auth_user.id = membership.user_id
    where client.client_key = 'liona-harris'
      and lower(auth_user.email) in (
        'liona@harrisphysio.com',
        'liona@harrisphysiotherapy.com'
      )
      and membership.is_active
  ) <> 2 then
    raise exception 'Expected both existing Liona accounts to have active FocusBoard membership';
  end if;
end
$$;
