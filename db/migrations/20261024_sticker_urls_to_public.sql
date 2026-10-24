-- Point sticker artwork at the bundled files in public/focus instead of the old Supabase
-- Storage bucket (PhysioNote project, focus-assets/focus/). The files were copied to
-- public/focus first. Only rows whose value starts with the Supabase prefix are changed.
-- Rollback: previous values are in 20261024_sticker_urls_to_public.rollback.json.

update focusboard.focus_board_tasks
set sticker_src = replace(
  regexp_replace(sticker_src, '^https://xoafnjhsxxczmfavmwoq\.supabase\.co/storage/v1/object/public/focus-assets/focus/', '/focus/'),
  '%20', ' ')
where sticker_src like 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/%';

update focusboard.focus_board_reward_tiers
set locked_sticker_src = replace(
      regexp_replace(locked_sticker_src, '^https://xoafnjhsxxczmfavmwoq\.supabase\.co/storage/v1/object/public/focus-assets/focus/', '/focus/'),
      '%20', ' '),
    unlocked_sticker_src = replace(
      regexp_replace(unlocked_sticker_src, '^https://xoafnjhsxxczmfavmwoq\.supabase\.co/storage/v1/object/public/focus-assets/focus/', '/focus/'),
      '%20', ' ')
where locked_sticker_src like 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/%'
   or unlocked_sticker_src like 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/%';

update focusboard.focus_board_settings
set weekly_reward_locked_sticker_src = replace(
      regexp_replace(weekly_reward_locked_sticker_src, '^https://xoafnjhsxxczmfavmwoq\.supabase\.co/storage/v1/object/public/focus-assets/focus/', '/focus/'),
      '%20', ' '),
    weekly_reward_unlocked_sticker_src = replace(
      regexp_replace(weekly_reward_unlocked_sticker_src, '^https://xoafnjhsxxczmfavmwoq\.supabase\.co/storage/v1/object/public/focus-assets/focus/', '/focus/'),
      '%20', ' ')
where weekly_reward_locked_sticker_src like 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/%'
   or weekly_reward_unlocked_sticker_src like 'https://xoafnjhsxxczmfavmwoq.supabase.co/storage/v1/object/public/focus-assets/focus/%';
