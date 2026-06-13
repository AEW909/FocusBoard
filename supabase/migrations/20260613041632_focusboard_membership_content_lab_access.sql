alter table focusboard.client_memberships
add column if not exists content_lab_access boolean not null default false;

update focusboard.client_memberships memberships
set content_lab_access = coalesce(clients.content_lab_enabled, false)
from focusboard.clients clients
where clients.id = memberships.client_id
  and memberships.content_lab_access = false;
