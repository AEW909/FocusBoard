select
  clients.display_name,
  profiles.client_id,
  profiles.business_name,
  profiles.updated_at
from focusboard.client_content_profiles profiles
join focusboard.clients clients on clients.id = profiles.client_id
order by clients.display_name;
