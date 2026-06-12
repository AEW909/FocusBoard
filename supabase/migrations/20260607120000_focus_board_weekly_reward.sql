alter table focusboard.focus_board_settings
  add column if not exists weekly_reward_label text not null default 'Weekly Treat',
  add column if not exists weekly_reward_description text not null default 'A small immediate reward for hitting the weekly points target.',
  add column if not exists weekly_reward_locked_sticker_src text not null default '/focus/liona-reward-spark-locked.png',
  add column if not exists weekly_reward_unlocked_sticker_src text not null default '/focus/liona-reward-spark.png',
  add column if not exists weekly_reward_sticker_alt text not null default 'Weekly reward sticker';

update focusboard.focus_board_settings
set
  weekly_reward_locked_sticker_src = 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/liona-reward-spark-locked.png',
  weekly_reward_unlocked_sticker_src = 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/liona-reward-spark.png'
where board_key = 'liona-growth-board'
  and weekly_reward_locked_sticker_src = '/focus/liona-reward-spark-locked.png'
  and weekly_reward_unlocked_sticker_src = '/focus/liona-reward-spark.png';
