// Core Balance Slice — smoke test (RPC layer).
// Verifies the booking → credits/capacity → roster reflection loop the Studio Pulse depends on.
// Requires `node scripts/e2e-seed.mjs` first.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SR) {
  console.error("missing env");
  process.exit(2);
}

const PWD = "E2ePass!23";
const admin = createClient(URL, SR, { auth: { persistSession: false } });

let pass = 0,
  fail = 0;
function ok(name) {
  pass++;
  console.log("PASS", name);
}
function bad(name, why) {
  fail++;
  console.log("FAIL", name, "—", why);
}
async function check(name, fn) {
  try {
    const r = await fn();
    if (r === false) bad(name, "returned false");
    else ok(name);
  } catch (e) {
    bad(name, e?.message ?? String(e));
  }
}

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}

// Use the same E2E seed as rpc.spec.mjs — the "Open Class" stands in for Core Balance.
const { data: classes } = await admin
  .from("classes")
  .select("id,title,capacity,booked_count,credit_cost")
  .eq("title", "E2E Open Class")
  .limit(1);
const cls = classes?.[0];
if (!cls) {
  console.error("seed missing: E2E Open Class");
  process.exit(2);
}

const memberS = await signIn("e2e_member@test.local");
const instrS = await signIn("e2e_instructor@test.local");

// Reset state: cancel any existing booking for this member on this class.
const { data: existing } = await admin
  .from("bookings")
  .select("id, status")
  .eq("class_id", cls.id)
  .eq("member_id", memberS.uid);
for (const b of existing ?? []) {
  if (b.status === "booked") {
    await admin.rpc("admin_cancel_booking", {
      p_actor_id: (
        await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle()
      ).data.id,
      p_booking_id: b.id,
      p_refund: true,
    });
  }
}

// Snapshot pre-state via service-role (RLS-bypass for verification only).
const pre = (await admin.from("classes").select("booked_count").eq("id", cls.id).single()).data;
const preMember = (
  await admin.from("members").select("remaining_credits").eq("id", memberS.uid).single()
).data;

await check("member books Core Balance (book_class_v2 → status=booked)", async () => {
  const { data, error } = await memberS.c.rpc("book_class_v2", {
    p_actor_id: memberS.uid,
    p_class_id: cls.id,
  });
  if (error) throw error;
  return data?.status === "booked";
});

const post = (await admin.from("classes").select("booked_count").eq("id", cls.id).single()).data;
const postMember = (
  await admin.from("members").select("remaining_credits").eq("id", memberS.uid).single()
).data;

await check(
  "class.booked_count incremented by exactly 1",
  async () => post.booked_count === pre.booked_count + 1,
);
await check(
  "member.remaining_credits decremented by class.credit_cost",
  async () => postMember.remaining_credits === preMember.remaining_credits - cls.credit_cost,
);

await check("duplicate booking returns already_booked (no double-charge)", async () => {
  const { data } = await memberS.c.rpc("book_class_v2", {
    p_actor_id: memberS.uid,
    p_class_id: cls.id,
  });
  return data?.status === "already_booked";
});

const postDup = (
  await admin.from("members").select("remaining_credits").eq("id", memberS.uid).single()
).data;
await check(
  "duplicate booking did NOT change remaining_credits",
  async () => postDup.remaining_credits === postMember.remaining_credits,
);

await check("booking reflected in roster (Studio Pulse data source)", async () => {
  // Simulate the studioPulse roster query against the same class.
  const { data: bookings } = await admin
    .from("bookings")
    .select("id, member:members(id, name)")
    .eq("class_id", cls.id)
    .eq("status", "booked");
  return (bookings ?? []).some((b) => b.member?.id === memberS.uid);
});

await check("instructor can read the booking via roster (RLS allows staff read)", async () => {
  const { data: bookings, error } = await instrS.c
    .from("bookings")
    .select("id, member_id, status")
    .eq("class_id", cls.id)
    .eq("status", "booked");
  if (error) throw error;
  return (bookings ?? []).some((b) => b.member_id === memberS.uid);
});

await check(
  "member.remaining_credits never went below zero",
  async () => postDup.remaining_credits >= 0,
);

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
