-- Explicit, authenticated approval for the generated Concierge library.

CREATE OR REPLACE FUNCTION public.approve_concierge_template_library(
  p_studio_id uuid,
  p_actor_id uuid,
  p_confirmation text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_confirmation <> 'APPROVE CONCIERGE TEMPLATES' THEN
    RAISE EXCEPTION 'template_approval_confirmation_required';
  END IF;

  UPDATE public.concierge_template_versions
  SET lifecycle_status = 'approved',
      approved_at = now(),
      approved_by = p_actor_id
  WHERE studio_id = p_studio_id
    AND retired_at IS NULL
    AND (
      lifecycle_status = 'draft'
      OR (lifecycle_status = 'approved' AND approved_by IS NULL)
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_activity_log(
    actor_id,action,entity_type,entity_id,metadata
  ) VALUES (
    p_actor_id,'concierge.template_library_approved','studio',p_studio_id,
    jsonb_build_object('template_count',v_count)
  );
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_concierge_template_library(uuid,uuid,text)
  FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_concierge_template_library(uuid,uuid,text)
  TO service_role;
