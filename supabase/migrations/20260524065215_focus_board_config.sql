create schema if not exists focusboard;

grant usage on schema focusboard to postgres, service_role;
grant create on schema focusboard to postgres, service_role;
revoke all on schema focusboard from anon, authenticated;

create table if not exists focusboard.focus_board_settings (
  board_key text primary key,
  board_slug text not null unique,
  admin_slug text not null unique,
  title text not null,
  subtitle text not null,
  weekly_target integer not null default 50 check (weekly_target > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists focusboard.focus_board_tasks (
  id uuid primary key default gen_random_uuid(),
  board_key text not null references focusboard.focus_board_settings (board_key) on delete cascade,
  task_key text not null,
  icon text not null,
  sticker_src text not null,
  sticker_alt text not null,
  title text not null,
  description text not null,
  accent_class text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint focus_board_tasks_board_task_unique unique (board_key, task_key)
);

create table if not exists focusboard.focus_board_task_metrics (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references focusboard.focus_board_tasks (id) on delete cascade,
  metric_key text not null,
  label text not null,
  target integer not null default 0 check (target >= 0),
  points integer not null default 0,
  kind text not null check (kind in ('count', 'toggle')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint focus_board_task_metrics_task_metric_unique unique (task_id, metric_key)
);

create table if not exists focusboard.focus_board_reward_tiers (
  id uuid primary key default gen_random_uuid(),
  board_key text not null references focusboard.focus_board_settings (board_key) on delete cascade,
  label text not null,
  min_points integer not null default 0 check (min_points >= 0),
  min_weeks_hit integer not null default 0 check (min_weeks_hit >= 0),
  locked_sticker_src text not null,
  unlocked_sticker_src text not null,
  sticker_alt text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint focus_board_reward_tiers_board_label_unique unique (board_key, label)
);

create index if not exists focus_board_tasks_board_sort_idx
  on focusboard.focus_board_tasks (board_key, sort_order);

create index if not exists focus_board_task_metrics_task_sort_idx
  on focusboard.focus_board_task_metrics (task_id, sort_order);

create index if not exists focus_board_reward_tiers_board_sort_idx
  on focusboard.focus_board_reward_tiers (board_key, sort_order);

alter table focusboard.focus_board_settings enable row level security;
alter table focusboard.focus_board_tasks enable row level security;
alter table focusboard.focus_board_task_metrics enable row level security;
alter table focusboard.focus_board_reward_tiers enable row level security;

revoke all on focusboard.focus_board_settings from anon, authenticated;
revoke all on focusboard.focus_board_tasks from anon, authenticated;
revoke all on focusboard.focus_board_task_metrics from anon, authenticated;
revoke all on focusboard.focus_board_reward_tiers from anon, authenticated;
grant all on focusboard.focus_board_settings to postgres, service_role;
grant all on focusboard.focus_board_tasks to postgres, service_role;
grant all on focusboard.focus_board_task_metrics to postgres, service_role;
grant all on focusboard.focus_board_reward_tiers to postgres, service_role;

insert into focusboard.focus_board_settings (
  board_key,
  board_slug,
  admin_slug,
  title,
  subtitle,
  weekly_target
)
values (
  'liona-growth-board',
  'sunburst-sprint-f3k9',
  'sunburst-sprint-hq-m8v2',
  'Liona''s tiny-task disco',
  'Business admin, but make it feel like stickers, sparks, and prize tokens.',
  50
)
on conflict (board_key) do update
set
  board_slug = excluded.board_slug,
  admin_slug = excluded.admin_slug,
  title = excluded.title,
  subtitle = excluded.subtitle,
  weekly_target = excluded.weekly_target,
  updated_at = timezone('utc', now());

with upserted_tasks as (
  insert into focusboard.focus_board_tasks (
    board_key,
    task_key,
    icon,
    sticker_src,
    sticker_alt,
    title,
    description,
    accent_class,
    sort_order
  )
  values
    (
      'liona-growth-board',
      'google_reviews',
      'STAR',
      '/focus/review-star.svg',
      'Smiling star review sticker',
      'Ask for Google reviews',
      'Ask three happy patients each week for a Google review. Actual reviews earned score bonus points because they move the business fastest.',
      'focus-task-teal',
      1
    ),
    (
      'liona-growth-board',
      'clinic_photos',
      'SNAP',
      '/focus/camera-zap.svg',
      'Camera sticker with neon spark',
      'Take usable clinic photos',
      'Capture three tidy, usable photos of the clinic, kit, or treatment moments. Only keep the ones she would actually be happy to post.',
      'focus-task-sage',
      2
    ),
    (
      'liona-growth-board',
      'weekly_post',
      'POST',
      '/focus/post-rocket.svg',
      'Rocket social post sticker',
      'Publish the weekly post',
      'Publish one 100-word myth-vs-fact or treatment-focus post on Google, Facebook, or Instagram. Bonus if it uses one of the week''s photos.',
      'focus-task-stone',
      3
    )
  on conflict (board_key, task_key) do update
  set
    icon = excluded.icon,
    sticker_src = excluded.sticker_src,
    sticker_alt = excluded.sticker_alt,
    title = excluded.title,
    description = excluded.description,
    accent_class = excluded.accent_class,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now())
  returning id, task_key
)
insert into focusboard.focus_board_task_metrics (
  task_id,
  metric_key,
  label,
  target,
  points,
  kind,
  sort_order
)
select
  t.id,
  v.metric_key,
  v.label,
  v.target,
  v.points,
  v.kind,
  v.sort_order
from upserted_tasks t
join (
  values
    ('google_reviews', 'ask', 'Asked', 3, 4, 'count', 1),
    ('google_reviews', 'review', 'Review landed', 0, 10, 'count', 2),
    ('clinic_photos', 'photo', 'Usable photo', 3, 8, 'count', 1),
    ('weekly_post', 'post', 'Posted', 1, 20, 'toggle', 1)
) as v(task_key, metric_key, label, target, points, kind, sort_order)
  on v.task_key = t.task_key
on conflict (task_id, metric_key) do update
set
  label = excluded.label,
  target = excluded.target,
  points = excluded.points,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into focusboard.focus_board_reward_tiers (
  board_key,
  label,
  min_points,
  min_weeks_hit,
  locked_sticker_src,
  unlocked_sticker_src,
  sticker_alt,
  description,
  sort_order
)
values
  (
    'liona-growth-board',
    'Spark Starter',
    40,
    1,
    '/focus/liona-reward-spark-locked.png',
    '/focus/liona-reward-spark.png',
    'Spark reward sticker',
    'Tiny happy thing. Coffee, pastry, flowers, or ten guilt-free minutes spent on pure nonsense.',
    1
  ),
  (
    'liona-growth-board',
    'Glow Up',
    95,
    2,
    '/focus/liona-reward-glow-locked.png',
    '/focus/liona-reward-glow.png',
    'Glow reward sticker',
    'Something she genuinely likes: lunch out, a book, a beauty treat, or a home comfort upgrade.',
    2
  ),
  (
    'liona-growth-board',
    'Boss Energy',
    150,
    3,
    '/focus/liona-reward-boss-locked.png',
    '/focus/liona-reward-boss.png',
    'Boss reward sticker',
    'A bigger reward because she kept showing up for the business even when the tasks felt annoying.',
    3
  ),
  (
    'liona-growth-board',
    'Chaos Queen Jackpot',
    220,
    4,
    '/focus/liona-reward-queen-locked.png',
    '/focus/liona-reward-queen.png',
    'Jackpot reward sticker',
    'Top-tier monthly reward. Dinner out, something fun, or a proper experience-level treat.',
    4
  )
on conflict (board_key, label) do update
set
  min_points = excluded.min_points,
  min_weeks_hit = excluded.min_weeks_hit,
  locked_sticker_src = excluded.locked_sticker_src,
  unlocked_sticker_src = excluded.unlocked_sticker_src,
  sticker_alt = excluded.sticker_alt,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());
