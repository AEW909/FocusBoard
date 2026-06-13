select
  clients.display_name,
  clients.client_key,
  clients.status,
  clients.content_lab_enabled,
  clients.created_by,
  clients.updated_by,
  settings.board_key,
  settings.board_slug,
  settings.admin_slug,
  count(distinct tasks.id) as task_count,
  count(distinct rewards.id) as reward_count,
  count(distinct memberships.id) as membership_count
from focusboard.clients clients
join focusboard.focus_board_settings settings on settings.client_id = clients.id
left join focusboard.focus_board_tasks tasks on tasks.board_key = settings.board_key
left join focusboard.focus_board_reward_tiers rewards on rewards.board_key = settings.board_key
left join focusboard.client_memberships memberships on memberships.client_id = clients.id
group by
  clients.display_name,
  clients.client_key,
  clients.status,
  clients.content_lab_enabled,
  clients.created_by,
  clients.updated_by,
  settings.board_key,
  settings.board_slug,
  settings.admin_slug
order by clients.display_name;
