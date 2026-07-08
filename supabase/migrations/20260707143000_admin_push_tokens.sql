CREATE TABLE IF NOT EXISTS public.admin_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_push_tokens_platform_check CHECK (platform IN ('ios', 'android'))
);

CREATE INDEX IF NOT EXISTS admin_push_tokens_active_idx
  ON public.admin_push_tokens(active, platform, last_seen_at DESC);

ALTER TABLE public.admin_push_tokens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.admin_push_tokens TO service_role;

CREATE POLICY "admins can read own push tokens" ON public.admin_push_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
