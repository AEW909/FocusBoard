alter table focusboard.business_stat_categories
  add column if not exists monthly_target numeric;

alter table focusboard.business_stat_categories
  drop constraint if exists business_stat_categories_monthly_target_non_negative;

alter table focusboard.business_stat_categories
  add constraint business_stat_categories_monthly_target_non_negative
  check (monthly_target is null or monthly_target >= 0);

update focusboard.business_stat_categories
set monthly_target = weekly_target * 4
where monthly_target is null
  and weekly_target is not null;

with palette(color, sort_order) as (
  values
    ('#00f5d4', 1),
    ('#ff4dca', 2),
    ('#ffd84d', 3),
    ('#8f7cff', 4),
    ('#95ff4a', 5),
    ('#55a7ff', 6),
    ('#ff7a59', 7),
    ('#73e06c', 8),
    ('#ff8fb8', 9),
    ('#7ce6ff', 10)
),
ranked_categories as (
  select
    category.id,
    row_number() over (
      partition by category.client_id
      order by
        coalesce(category.group_id::text, ''),
        category.sort_order,
        category.created_at,
        category.id
    ) as colour_rank
  from focusboard.business_stat_categories category
)
update focusboard.business_stat_categories category
set color = palette.color
from ranked_categories ranked
join palette
  on palette.sort_order = ((ranked.colour_rank - 1) % 10) + 1
where ranked.id = category.id;
