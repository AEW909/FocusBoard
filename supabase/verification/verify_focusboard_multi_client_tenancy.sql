select
  client.client_key,
  client.display_name,
  client.status,
  client.content_lab_enabled,
  settings.board_key,
  settings.board_slug,
  settings.admin_slug
from focusboard.clients client
join focusboard.focus_board_settings settings on settings.client_id = client.id
order by client.client_key;

select
  client.client_key,
  auth_user.email,
  membership.role,
  membership.is_active
from focusboard.client_memberships membership
join focusboard.clients client on client.id = membership.client_id
join auth.users auth_user on auth_user.id = membership.user_id
order by client.client_key, auth_user.email;

select
  auth_user.email,
  platform_user.role,
  platform_user.is_active
from focusboard.platform_users platform_user
join auth.users auth_user on auth_user.id = platform_user.user_id
order by auth_user.email;

select jsonb_build_object(
  'settings', (select count(*) from focusboard.focus_board_settings),
  'boards_without_client', (
    select count(*)
    from focusboard.focus_board_settings
    where client_id is null
  ),
  'tasks', (select count(*) from focusboard.focus_board_tasks),
  'metrics', (select count(*) from focusboard.focus_board_task_metrics),
  'rewards', (select count(*) from focusboard.focus_board_reward_tiers),
  'events', (select count(*) from focusboard.focus_board_events)
) as focusboard_counts;
