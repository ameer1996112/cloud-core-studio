import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isApnsConfigured, sendApnsAlert } from "@/lib/apns.server";

type SignupMember = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type AdminPushToken = {
  token: string;
  platform: "ios" | "android";
};

const RECENT_SIGNUP_WINDOW_MS = 15 * 60_000;

function apnsEnvironment() {
  return process.env.APNS_ENV === "sandbox" ? "sandbox" : "production";
}

function cleanText(value: string | null | undefined, fallback = "-") {
  const text = value?.trim();
  return text || fallback;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findRecentSignupMember(memberId: string): Promise<SignupMember | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id,name,email,phone,created_at")
      .eq("id", memberId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const createdAt = new Date(data.created_at).getTime();
      if (!Number.isFinite(createdAt)) return null;
      if (Date.now() - createdAt > RECENT_SIGNUP_WINDOW_MS) return null;
      return data as SignupMember;
    }

    await sleep(250);
  }

  return null;
}

export async function notifyAdminMemberSignupServer(memberId: string) {
  const member = await findRecentSignupMember(memberId);
  if (!member) return { ok: false, skipped: "member_not_found_or_not_recent" };
  if (!isApnsConfigured()) return { ok: false, skipped: "missing_apns_config" };

  const { data: tokens, error } = await supabaseAdmin
    .from("admin_push_tokens")
    .select("token,platform,profiles!inner(role)")
    .eq("active", true)
    .eq("platform", "ios")
    .eq("apns_environment", apnsEnvironment())
    .eq("profiles.role", "admin");

  if (error) throw error;
  const rows = (tokens ?? []) as AdminPushToken[];
  if (!rows.length) return { ok: false, skipped: "no_admin_push_tokens" };

  const name = cleanText(member.name, "לקוחה חדשה");
  const phone = cleanText(member.phone);
  const email = cleanText(member.email);
  const results = await Promise.allSettled(
    rows.map((row) =>
      sendApnsAlert(row.token, {
        title: "לקוחה חדשה נרשמה",
        body: `${name}\nטלפון: ${phone}\nאימייל: ${email}`,
        url: "/admin/members",
      }),
    ),
  );

  const sent = results.filter((result) => result.status === "fulfilled" && result.value.ok).length;
  const failed = results.length - sent;
  if (failed > 0) {
    console.warn("admin_signup_push_partial_failure", { sent, failed });
  }

  return { ok: sent > 0, sent, failed };
}
