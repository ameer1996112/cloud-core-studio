CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  email text,
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'reviewing', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_member
  ON public.account_deletion_requests(member_id);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status
  ON public.account_deletion_requests(status, created_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

DROP POLICY IF EXISTS "Members create own deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Members read own deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Admins manage deletion requests" ON public.account_deletion_requests;

CREATE POLICY "Members create own deletion requests"
  ON public.account_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members read own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Admins manage deletion requests"
  ON public.account_deletion_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS account_deletion_requests_set_updated_at
  ON public.account_deletion_requests;

CREATE TRIGGER account_deletion_requests_set_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
