import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parsePersonalConciergePause,
  parsePersonalConciergePreference,
} from "@/lib/personalConciergePreferences";
import { resolvePersonalConciergeVisibility } from "@/lib/personalConciergeExperience";

function conciergeAvailable(memberId: string) {
  return resolvePersonalConciergeVisibility(process.env, memberId);
}

export const getMyPersonalConcierge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!conciergeAvailable(context.userId)) {
      return { available: false, relationship: null, preferences: [] };
    }
    const db = context.supabase as any;
    const [relationship, preferences] = await Promise.all([
      db
        .from("personal_concierge_relationships")
        .select("stage,personalization_paused,current_experience_state")
        .eq("member_id", context.userId)
        .limit(1)
        .maybeSingle(),
      db
        .from("personal_concierge_preference_evidence")
        .select("id,preference_key,preference_value,confidence,evidence_source")
        .eq("member_id", context.userId)
        .eq("member_visible", true)
        .is("removed_at", null)
        .order("created_at", { ascending: true }),
    ]);
    if (relationship.error) throw relationship.error;
    if (preferences.error) throw preferences.error;
    return {
      available: true,
      relationship: relationship.data,
      preferences: preferences.data ?? [],
    };
  });

export const setMyPersonalConciergePause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parsePersonalConciergePause)
  .handler(async ({ data, context }) => {
    if (!conciergeAvailable(context.userId)) throw new Error("personal_concierge_unavailable");
    const db = context.supabase as any;
    const result = await db.rpc("set_my_personal_concierge_pause", {
      p_paused: data.paused,
    });
    if (result.error) throw result.error;
    return { personalization_paused: result.data === true };
  });

export const saveMyPersonalConciergePreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parsePersonalConciergePreference)
  .handler(async ({ data, context }) => {
    if (!conciergeAvailable(context.userId)) throw new Error("personal_concierge_unavailable");
    const db = context.supabase as any;
    const relationship = await db
      .from("personal_concierge_relationships")
      .select("studio_id")
      .eq("member_id", context.userId)
      .limit(1)
      .single();
    if (relationship.error) throw relationship.error;

    const existing = await db
      .from("personal_concierge_preference_evidence")
      .update({ removed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("studio_id", relationship.data.studio_id)
      .eq("member_id", context.userId)
      .eq("preference_key", data.key)
      .is("removed_at", null);
    if (existing.error) throw existing.error;

    const created = await db
      .from("personal_concierge_preference_evidence")
      .insert({
        studio_id: relationship.data.studio_id,
        member_id: context.userId,
        preference_key: data.key,
        preference_value: data.value,
        evidence_source: "member",
        confidence: "known",
        member_visible: true,
      })
      .select("id,preference_key,preference_value,confidence,evidence_source")
      .single();
    if (created.error) throw created.error;
    return created.data;
  });
