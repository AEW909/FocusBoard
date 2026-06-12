select
  auth_user.email,
  case
    when platform_user.user_id is not null then '/clients'
    when count(membership.id) = 1 then
      '/focus/' || min(settings.board_slug)
    when count(membership.id) > 1 then '/boards'
    else null
  end as expected_home_path,
  count(membership.id) as active_memberships
from auth.users auth_user
left join focusboard.platform_users platform_user
  on platform_user.user_id = auth_user.id
  and platform_user.role = 'platform_owner'
  and platform_user.is_active
left join focusboard.client_memberships membership
  on membership.user_id = auth_user.id
  and membership.is_active
left join focusboard.clients client
  on client.id = membership.client_id
  and client.status = 'active'
left join focusboard.focus_board_settings settings
  on settings.client_id = client.id
where lower(auth_user.email) in (
  'andrew_e_wilkinson@hotmail.com',
  'liona@harrisphysio.com',
  'liona@harrisphysiotherapy.com'
)
group by auth_user.email, platform_user.user_id
order by auth_user.email;
