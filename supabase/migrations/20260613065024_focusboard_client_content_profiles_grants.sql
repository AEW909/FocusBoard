alter table focusboard.client_content_profiles enable row level security;

revoke all on focusboard.client_content_profiles from anon, authenticated;
grant all on focusboard.client_content_profiles to postgres, service_role;
