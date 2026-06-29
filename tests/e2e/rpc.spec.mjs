// Integration matrix: RPC + RLS as real authenticated users.
// Run after `node scripts/e2e-seed.mjs`.
import { createClient } from "@supabase/supabase-js";
import { requireE2eMutationTarget } from "../../scripts/e2e-env-guard.mjs";

requireE2eMutationTarget("tests/e2e/rpc.spec.mjs");

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
const results = [];
function ok(name) {
  pass++;
  console.log("PASS", name);
  results.push({ name, ok: true });
}
function bad(name, why) {
  fail++;
  console.log("FAIL", name, "—", why);
  results.push({ name, ok: false, why });
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

function userClient() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}
async function signIn(email) {
  const c = userClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}

// ---------- look up seeded ids
const { data: classes } = await admin
  .from("classes")
  .select("id,title,capacity,booked_count,credit_cost,cancellation_window_hours,starts_at")
  .in("title", ["E2E Open Class", "E2E Full Class", "E2E Imminent Class"]);
const openCls = classes.find((c) => c.title === "E2E Open Class");
const fullCls = classes.find((c) => c.title === "E2E Full Class");
const lateCls = classes.find((c) => c.title === "E2E Imminent Class");
const { data: planRows } = await admin
  .from("plans")
  .select("id,name,credits")
  .in("name", ["E2E 10 Credits", "E2E Unlimited"]);
const creditsPlan = planRows.find((p) => p.name === "E2E 10 Credits");
const unlimPlan = planRows.find((p) => p.name === "E2E Unlimited");

const adminS = await signIn("e2e_admin@test.local");
const instrS = await signIn("e2e_instructor@test.local");
const m1 = await signIn("e2e_member@test.local");
const m2 = await signIn("e2e_member2@test.local");

// ---------- AUTH / RLS BOUNDARIES ----------

await check("member cannot read other member profile", async () => {
  const { data } = await m1.c.from("members").select("id,name").eq("id", m2.uid);
  return !data || data.length === 0;
});

await check("member cannot read notification_templates", async () => {
  const { data, error } = await m1.c.from("notification_templates").select("id").limit(1);
  return !data || data.length === 0 || !!error;
});

await check("member cannot read notification_logs of others", async () => {
  const { data } = await m1.c
    .from("notification_logs")
    .select("id,member_id")
    .neq("member_id", m1.uid)
    .limit(1);
  return !data || data.length === 0;
});

await check("member cannot read other member package_requests", async () => {
  // seed a package_request for m2 then ensure m1 can't see it
  await admin
    .from("package_requests")
    .insert({ member_id: m2.uid, plan_id: creditsPlan.id, status: "pending" });
  const { data } = await m1.c
    .from("package_requests")
    .select("id,member_id")
    .eq("member_id", m2.uid);
  return !data || data.length === 0;
});

await check("instructor cannot read payments", async () => {
  const { data, error } = await instrS.c.from("payments").select("id").limit(1);
  return !data || data.length === 0 || !!error;
});

// ---------- MEMBER BOOKING ----------

await check("member with credits books open class", async () => {
  const { data } = await m1.c.rpc("book_class_v2", { p_actor_id: m1.uid, p_class_id: openCls.id });
  return data?.status === "booked";
});

await check("booking visible to member", async () => {
  const { data } = await m1.c
    .from("bookings")
    .select("id,status")
    .eq("member_id", m1.uid)
    .eq("class_id", openCls.id)
    .eq("status", "booked");
  return data && data.length === 1;
});

await check("credit ledger row created with negative delta", async () => {
  const { data } = await m1.c
    .from("credit_transactions")
    .select("amount_delta,reason")
    .eq("member_id", m1.uid)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.amount_delta === -1;
});

await check("member credit balance decremented to 9", async () => {
  const { data } = await m1.c.from("members").select("remaining_credits").eq("id", m1.uid).single();
  return data.remaining_credits === 9;
});

await check("member cannot double-book same class", async () => {
  const { data } = await m1.c.rpc("book_class_v2", { p_actor_id: m1.uid, p_class_id: openCls.id });
  return data?.status === "already_booked";
});

await check("admin roster reflects member booking (sees it via service role)", async () => {
  const { data } = await admin
    .from("bookings")
    .select("member_id")
    .eq("class_id", openCls.id)
    .eq("status", "booked");
  return data.some((r) => r.member_id === m1.uid);
});

await check("member with zero credits cannot book", async () => {
  await admin.from("members").update({ remaining_credits: 0 }).eq("id", m1.uid);
  // create a fresh class to attempt
  const { data: c } = await admin
    .from("classes")
    .insert({
      title: "E2E Zero Credit",
      starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      duration_minutes: 60,
      capacity: 5,
      instructor_id: instrS.uid,
      room: "E2E Studio",
      credit_cost: 1,
      cancellation_window_hours: 4,
      status: "scheduled",
      booked_count: 0,
      waitlist_count: 0,
      energy: "flow",
    })
    .select()
    .single();
  const { data: r } = await m1.c.rpc("book_class_v2", { p_actor_id: m1.uid, p_class_id: c.id });
  await admin.from("members").update({ remaining_credits: 9 }).eq("id", m1.uid); // restore for later tests
  return r?.status === "insufficient_credits";
});

// ---------- WAITLIST ----------

await check("member joins waitlist on full class", async () => {
  const { data } = await m1.c.rpc("member_join_waitlist", {
    p_actor_id: m1.uid,
    p_class_id: fullCls.id,
  });
  return data?.status === "waiting";
});

await check("member cannot join waitlist twice", async () => {
  const { data } = await m1.c.rpc("member_join_waitlist", {
    p_actor_id: m1.uid,
    p_class_id: fullCls.id,
  });
  return data?.status === "already_waiting";
});

await check("member cannot join waitlist if already booked", async () => {
  const { data } = await m1.c.rpc("member_join_waitlist", {
    p_actor_id: m1.uid,
    p_class_id: openCls.id,
  });
  return data?.status === "already_booked";
});

await check("member sees only own waitlist row", async () => {
  const { data } = await m1.c
    .from("waitlist_entries")
    .select("member_id")
    .eq("class_id", fullCls.id);
  return data && data.every((r) => r.member_id === m1.uid);
});

let waitEntryId;
await check(
  "admin can offer waitlist spot without creating booking or deducting credit",
  async () => {
    const { data: ent } = await admin
      .from("waitlist_entries")
      .select("id")
      .eq("class_id", fullCls.id)
      .eq("member_id", m1.uid)
      .single();
    waitEntryId = ent.id;
    const balBefore = (
      await admin.from("members").select("remaining_credits").eq("id", m1.uid).single()
    ).data.remaining_credits;
    const { data, error } = await adminS.c.rpc("admin_waitlist_offer", {
      p_actor_id: adminS.uid,
      p_entry_id: ent.id,
    });
    const balAfter = (
      await admin.from("members").select("remaining_credits").eq("id", m1.uid).single()
    ).data.remaining_credits;
    const { data: bk } = await admin
      .from("bookings")
      .select("id")
      .eq("member_id", m1.uid)
      .eq("class_id", fullCls.id)
      .eq("status", "booked");
    if (data?.status !== "offered" || balBefore !== balAfter || (bk && bk.length > 0)) {
      throw new Error(
        `status=${data?.status} bal ${balBefore}->${balAfter} bookings=${bk?.length ?? 0} err=${error?.message}`,
      );
    }
    return true;
  },
);

await check("admin can promote waitlist (but class still full → no booking)", async () => {
  const { data } = await adminS.c.rpc("admin_waitlist_promote", {
    p_actor_id: adminS.uid,
    p_entry_id: waitEntryId,
  });
  // class is still full → admin_create_booking returns 'full' UNLESS override=true (the RPC passes true).
  // So promotion should create a booking via override path.
  return data?.status === "booked" || data?.status === "already_booked";
});

await check("after promotion waitlist row marked promoted", async () => {
  const { data } = await admin
    .from("waitlist_entries")
    .select("status")
    .eq("id", waitEntryId)
    .single();
  return data.status === "promoted";
});

// ---------- CANCELLATION ----------

await check("member can cancel booking inside window", async () => {
  const { data: bk } = await admin
    .from("bookings")
    .select("id")
    .eq("member_id", m1.uid)
    .eq("class_id", openCls.id)
    .eq("status", "booked")
    .single();
  const before = (await admin.from("members").select("remaining_credits").eq("id", m1.uid).single())
    .data.remaining_credits;
  const { data } = await m1.c.rpc("member_cancel_booking", {
    p_actor_id: m1.uid,
    p_booking_id: bk.id,
  });
  const after = (await admin.from("members").select("remaining_credits").eq("id", m1.uid).single())
    .data.remaining_credits;
  return data?.status === "cancelled" && after === before + 1;
});

await check("member cannot cancel after window (imminent class)", async () => {
  // book the late class first
  await admin.from("members").update({ remaining_credits: 5 }).eq("id", m1.uid);
  const { data: bRes } = await m1.c.rpc("book_class_v2", {
    p_actor_id: m1.uid,
    p_class_id: lateCls.id,
  });
  if (bRes?.status !== "booked")
    throw new Error("precondition: late booking failed: " + JSON.stringify(bRes));
  const { data } = await m1.c.rpc("member_cancel_booking", {
    p_actor_id: m1.uid,
    p_booking_id: bRes.booking_id,
  });
  return data?.status === "window_passed";
});

// ---------- ADMIN ROSTER ----------

await check("admin can add member to a fresh class", async () => {
  const { data: c } = await admin
    .from("classes")
    .insert({
      title: "E2E Admin Roster",
      starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      duration_minutes: 60,
      capacity: 3,
      instructor_id: instrS.uid,
      room: "E2E Studio",
      credit_cost: 1,
      cancellation_window_hours: 4,
      status: "scheduled",
      booked_count: 0,
      waitlist_count: 0,
      energy: "flow",
    })
    .select()
    .single();
  const { data } = await adminS.c.rpc("admin_create_booking", {
    p_actor_id: adminS.uid,
    p_class_id: c.id,
    p_member_id: m2.uid,
    p_override: false,
  });
  return data?.status === "booked";
});

await check("admin duplicate add is idempotent (already_booked)", async () => {
  const { data: c } = await admin
    .from("classes")
    .select("id")
    .eq("title", "E2E Admin Roster")
    .single();
  const { data } = await adminS.c.rpc("admin_create_booking", {
    p_actor_id: adminS.uid,
    p_class_id: c.id,
    p_member_id: m2.uid,
    p_override: false,
  });
  return data?.status === "already_booked";
});

await check("admin without override cannot exceed capacity", async () => {
  const { data: c } = await admin
    .from("classes")
    .insert({
      title: "E2E Cap1",
      starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      duration_minutes: 60,
      capacity: 1,
      instructor_id: instrS.uid,
      room: "E2E Studio",
      credit_cost: 1,
      cancellation_window_hours: 4,
      status: "scheduled",
      booked_count: 0,
      waitlist_count: 0,
      energy: "flow",
    })
    .select()
    .single();
  await adminS.c.rpc("admin_create_booking", {
    p_actor_id: adminS.uid,
    p_class_id: c.id,
    p_member_id: m1.uid,
    p_override: false,
  });
  const { data } = await adminS.c.rpc("admin_create_booking", {
    p_actor_id: adminS.uid,
    p_class_id: c.id,
    p_member_id: m2.uid,
    p_override: false,
  });
  return data?.status === "full";
});

await check("admin WITH override exceeds capacity", async () => {
  const { data: c } = await admin.from("classes").select("id").eq("title", "E2E Cap1").single();
  const { data } = await adminS.c.rpc("admin_create_booking", {
    p_actor_id: adminS.uid,
    p_class_id: c.id,
    p_member_id: m2.uid,
    p_override: true,
  });
  return data?.status === "booked";
});

await check("admin can cancel booking with refund", async () => {
  const { data: c } = await admin
    .from("classes")
    .select("id")
    .eq("title", "E2E Admin Roster")
    .single();
  const { data: bk } = await admin
    .from("bookings")
    .select("id,member_id,credit_cost")
    .eq("class_id", c.id)
    .eq("member_id", m2.uid)
    .eq("status", "booked")
    .single();
  const before = (await admin.from("members").select("remaining_credits").eq("id", m2.uid).single())
    .data.remaining_credits;
  const { data } = await adminS.c.rpc("admin_cancel_booking", {
    p_actor_id: adminS.uid,
    p_booking_id: bk.id,
    p_refund: true,
  });
  const after = (await admin.from("members").select("remaining_credits").eq("id", m2.uid).single())
    .data.remaining_credits;
  return data?.status === "cancelled" && after === before + bk.credit_cost;
});

// ---------- INSTRUCTOR / ADMIN RPC FORBIDDEN ----------

await check("non-admin cannot call admin_create_booking", async () => {
  const { data } = await m1.c.rpc("admin_create_booking", {
    p_actor_id: m1.uid,
    p_class_id: openCls.id,
    p_member_id: m1.uid,
    p_override: true,
  });
  return data?.message === "forbidden";
});

await check("non-admin cannot call admin_adjust_credits", async () => {
  const { data } = await m1.c.rpc("admin_adjust_credits", {
    p_actor_id: m1.uid,
    p_member_id: m1.uid,
    p_delta: 100,
    p_reason: "hack",
  });
  return data?.message === "forbidden";
});

// ---------- SUMMARY ----------

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
