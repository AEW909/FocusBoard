alter table focusboard.focus_board_settings
  add column if not exists weekly_reward_locked_description text not null
    default 'Keep stacking points to unlock this week''s reward.',
  add column if not exists weekly_reward_unlocked_description text not null
    default 'A small immediate reward for hitting the weekly points target.';

update focusboard.focus_board_settings
set weekly_reward_unlocked_description = weekly_reward_description
where weekly_reward_description is not null
  and weekly_reward_description <> ''
  and weekly_reward_unlocked_description = 'A small immediate reward for hitting the weekly points target.';
