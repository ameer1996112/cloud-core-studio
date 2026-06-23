
REVOKE EXECUTE ON FUNCTION public.admin_create_booking(uuid, uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_booking(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, int, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_attendance(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_waitlist_promote(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._log_action(text, text, uuid, jsonb) FROM anon, public, authenticated;
