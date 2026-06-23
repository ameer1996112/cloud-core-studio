ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS image_card_url text,
  ADD COLUMN IF NOT EXISTS image_hero_url text,
  ADD COLUMN IF NOT EXISTS image_thumb_url text;

ALTER TABLE public.program_types
  ADD COLUMN IF NOT EXISTS image_card_url text,
  ADD COLUMN IF NOT EXISTS image_hero_url text,
  ADD COLUMN IF NOT EXISTS image_thumb_url text;

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS login_image_url text,
  ADD COLUMN IF NOT EXISTS studio_atmosphere_url text;