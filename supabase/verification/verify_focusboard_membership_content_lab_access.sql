select
  memberships.client_id,
  clients.display_name,
  clients.content_lab_enabled as client_content_lab_enabled,
  memberships.user_id,
  memberships.role,
  memberships.is_active,
  memberships.content_lab_access
from focusboard.client_memberships memberships
join focusboard.clients clients on clients.id = memberships.client_id
order by clients.display_name, memberships.user_id;
