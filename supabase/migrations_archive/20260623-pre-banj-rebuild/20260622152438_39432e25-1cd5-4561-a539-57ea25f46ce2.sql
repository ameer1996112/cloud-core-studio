ALTER TABLE public.waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_status_check;
ALTER TABLE public.waitlist_entries ADD CONSTRAINT waitlist_entries_status_check
  CHECK (status IN ('waiting','ready','offered','promoted','left','cancelled','expired','no_response'));