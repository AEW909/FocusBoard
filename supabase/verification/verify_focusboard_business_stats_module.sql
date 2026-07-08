do $$
declare
  client_a uuid;
  client_b uuid;
  group_a uuid;
  guard_worked boolean := false;
begin
  select id
  into client_a
  from focusboard.clients
  order by created_at, id::text
  limit 1;

  select id
  into client_b
  from focusboard.clients
  where id <> client_a
  order by created_at, id::text
  limit 1;

  if client_a is null or client_b is null then
    raise notice 'cross-client guard skipped: only one client';
    return;
  end if;

  insert into focusboard.business_stat_groups (
    client_id,
    name,
    color,
    sort_order
  )
  values (
    client_a,
    'Smoke Guard Group',
    '#00f5d4',
    1000
  )
  returning id into group_a;

  begin
    insert into focusboard.business_stat_categories (
      client_id,
      group_id,
      name,
      unit,
      color,
      sort_order
    )
    values (
      client_b,
      group_a,
      'Bad Cross Client Stat',
      'number',
      '#ff4dca',
      1000
    );
  exception
    when foreign_key_violation then
      guard_worked := true;
  end;

  delete from focusboard.business_stat_groups
  where id = group_a;

  if not guard_worked then
    raise exception 'Cross-client stat category guard did not fire';
  end if;
end
$$;

begin;

with target_client as (
  select id
  from focusboard.clients
  order by created_at
  limit 1
),
enabled_update as (
  update focusboard.clients
  set business_stats_enabled = true
  where id = (select id from target_client)
  returning id, business_stats_enabled
),
new_group as (
  insert into focusboard.business_stat_groups (
    client_id,
    name,
    color,
    sort_order
  )
  select id, 'Smoke Marketing', '#00f5d4', 999
  from target_client
  returning id, client_id
),
new_category as (
  insert into focusboard.business_stat_categories (
    client_id,
    group_id,
    name,
    unit,
    prefix,
    suffix,
    color,
    weekly_target,
    sort_order
  )
  select client_id, id, 'Smoke Leads', 'number', '', ' leads', '#ff4dca', 10, 999
  from new_group
  returning id, client_id, group_id
),
new_entry as (
  insert into focusboard.business_stat_entries (
    client_id,
    category_id,
    week_start,
    value,
    note
  )
  select client_id, id, date '2026-07-06', 12, 'rollback smoke'
  from new_category
  returning id, client_id, category_id, week_start, value
)
select
  (select business_stats_enabled from enabled_update) as feature_flag_updated,
  (select count(*) from new_group)::int as group_inserted,
  (select count(*) from new_category)::int as category_inserted,
  (select count(*) from new_entry)::int as entry_inserted,
  (select value from new_entry)::numeric as entry_value,
  'cross_client_guard_passed' as cross_client_guard;

rollback;
