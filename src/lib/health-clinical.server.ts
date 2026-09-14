// Imported only inside authenticated, runtime-gated server handlers.
// The user identity passed to this RPC must come from getUser(), never the payload.
export { supabaseAdmin as clinicalServerClient } from "@/integrations/supabase/client.server";
