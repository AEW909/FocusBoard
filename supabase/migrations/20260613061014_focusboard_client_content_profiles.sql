create table if not exists focusboard.client_content_profiles (
  client_id uuid primary key references focusboard.clients (id) on delete cascade,
  business_name text not null,
  brand_voice text,
  target_audience text,
  services text,
  differentiators text,
  content_rules text,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into focusboard.client_content_profiles (
  client_id,
  business_name,
  brand_voice,
  target_audience,
  services,
  differentiators,
  content_rules
)
select
  settings.client_id,
  'Skin Revive Aesthetics',
  'Warm, confident, reassuring - like advice from a trusted friend who happens to be an expert. Knowledgeable and credible, never cold or corporate. Friendly and personal, with subtle sophistication. Premium but never pretentious or exclusive. Empowering, education-led, and never pressure-led.',
  'Women and men aged 40-55, often professionals and business owners with disposable income. They research carefully before spending, want natural refreshed results, value clarity and professionalism, and may be new to aesthetics or returning after a poor experience.',
  'Anti-wrinkle injections for natural results, The Restore Protocol for post-weight-loss facial recovery, RF Microneedling using the Trimax platform, polynucleotides, PLLA, dermal fillers, skin boosters, physiotherapy, and sports massage.',
  'Liona Harris is an HCPC-registered physiotherapist with 15 years of clinical experience and 3 years in aesthetics. She brings deep anatomical knowledge, safety expertise, Trimax platform training, and a warm non-intimidating environment at 3-1-5 Health Club in Lancaster.',
  'Always refer to GLP-1 medication generically rather than by brand name. Never lead with price or discounts. Weave in clinical credibility where relevant. Use Liona''s name and personality where natural. Avoid fear-based language, urgency tactics, cheap beauty-salon tone, or shaming language. For Instagram and Facebook, end with tasteful relevant hashtags only.'
from focusboard.focus_board_settings settings
where settings.board_key = 'liona-growth-board'
  and settings.client_id is not null
on conflict (client_id) do nothing;
