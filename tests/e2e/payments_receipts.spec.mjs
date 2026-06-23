// Payments + Receipts hardening matrix (RPC + RLS).
// Run after `node scripts/e2e-seed.mjs`.
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
function userClient() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}
async function signIn(email) {
  const c = userClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}

const adminS = await signIn("e2e_admin@test.local");
const instrS = await signIn("e2e_instructor@test.local");
const m1 = await signIn("e2e_member@test.local");
const m2 = await signIn("e2e_member2@test.local");

const { data: planRows } = await admin
  .from("plans")
  .select("id,name,credits,price_cents,currency")
  .in("name", ["E2E 10 Credits", "E2E Unlimited"]);
const creditsPlan = planRows.find((p) => p.name === "E2E 10 Credits");

async function newPayment({
  memberId,
  planId = creditsPlan.id,
  amount = 100,
  status = "pending",
  method = "cash",
}) {
  const { data, error } = await admin
    .from("payments")
    .insert({
      member_id: memberId,
      plan_id: planId,
      amount,
      currency: "ILS",
      method,
      status,
      provider: "manual",
      recorded_by: adminS.uid,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ---------- AUTH BOUNDARIES ----------

await check("member cannot call confirm RPC", async () => {
  const pid = await newPayment({ memberId: m1.uid });
  const { data } = await m1.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: m1.uid,
    p_payment_id: pid,
  });
  return data?.status === "error" && data?.message === "forbidden";
});

await check("instructor cannot call confirm RPC", async () => {
  const pid = await newPayment({ memberId: m1.uid });
  const { data } = await instrS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: instrS.uid,
    p_payment_id: pid,
  });
  return data?.status === "error" && data?.message === "forbidden";
});

await check("admin gets payment_not_found for bogus id", async () => {
  const { data } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: "00000000-0000-0000-0000-000000000000",
  });
  return data?.status === "error" && data?.message === "payment_not_found";
});

// ---------- HAPPY PATH + IDEMPOTENCY ----------

await check("admin confirm grants credits + plan + receipt exactly once", async () => {
  const before = (await admin.from("members").select("remaining_credits").eq("id", m1.uid).single())
    .data.remaining_credits;
  const pid = await newPayment({ memberId: m1.uid });
  const { data: r1 } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  if (r1?.status !== "confirmed") return false;

  // Second call should be idempotent: same receipt, no extra credits
  const { data: r2 } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  const after = (await admin.from("members").select("remaining_credits").eq("id", m1.uid).single())
    .data.remaining_credits;

  const { data: mps } = await admin
    .from("member_plans")
    .select("id")
    .eq("member_id", m1.uid)
    .eq("notes", `auto via payment ${pid}`);
  const { data: rcpts } = await admin.from("receipts").select("id").eq("payment_id", pid);
  const { data: tx } = await admin
    .from("credit_transactions")
    .select("id")
    .eq("reason", `plan paid: ${creditsPlan.name}`)
    .eq("member_id", m1.uid);

  return (
    r2?.status === "already_confirmed" &&
    r2?.receipt_id === r1.receipt_id &&
    after === before + creditsPlan.credits &&
    mps.length === 1 &&
    rcpts.length === 1 &&
    tx.length >= 1
  ); // at least one (could be many from other tests, but our specific reason+payment is one)
});

await check("confirm without plan still issues receipt, no credits granted", async () => {
  const before = (await admin.from("members").select("remaining_credits").eq("id", m2.uid).single())
    .data.remaining_credits;
  const pid = await newPayment({ memberId: m2.uid, planId: null, amount: 50 });
  const { data } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  const after = (await admin.from("members").select("remaining_credits").eq("id", m2.uid).single())
    .data.remaining_credits;
  return data?.status === "confirmed" && data?.receipt_id && after === before;
});

// ---------- GUARDS ----------

await check("cannot confirm a refunded payment", async () => {
  const pid = await newPayment({ memberId: m1.uid, status: "refunded" });
  const { data } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  return data?.status === "error" && data?.message === "payment_not_confirmable";
});

await check("cannot confirm a failed payment", async () => {
  const pid = await newPayment({ memberId: m1.uid, status: "failed" });
  const { data } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  return data?.status === "error" && data?.message === "payment_not_confirmable";
});

await check("cannot confirm zero-amount payment", async () => {
  const pid = await newPayment({ memberId: m1.uid, amount: 0, planId: null });
  const { data } = await adminS.c.rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: adminS.uid,
    p_payment_id: pid,
  });
  return data?.status === "error" && data?.message === "invalid_amount";
});

// ---------- RECEIPT RLS ----------

await check("member can read own receipt", async () => {
  const { data: rcpt } = await admin
    .from("receipts")
    .select("id")
    .eq("member_id", m1.uid)
    .limit(1)
    .maybeSingle();
  if (!rcpt) return false;
  const { data } = await m1.c.from("receipts").select("id").eq("id", rcpt.id).maybeSingle();
  return data?.id === rcpt.id;
});

await check("member cannot read other member receipt", async () => {
  const { data: rcpt } = await admin
    .from("receipts")
    .select("id")
    .eq("member_id", m1.uid)
    .limit(1)
    .maybeSingle();
  if (!rcpt) return true;
  const { data } = await m2.c.from("receipts").select("id").eq("id", rcpt.id).maybeSingle();
  return !data;
});

await check("admin can read any receipt", async () => {
  const { data: rcpt } = await admin.from("receipts").select("id").limit(1).maybeSingle();
  if (!rcpt) return false;
  const { data } = await adminS.c.from("receipts").select("id").eq("id", rcpt.id).maybeSingle();
  return data?.id === rcpt.id;
});

await check("instructor cannot read receipts", async () => {
  const { data } = await instrS.c.from("receipts").select("id").limit(1);
  return !data || data.length === 0;
});

await check("member cannot insert a receipt", async () => {
  const { error } = await m1.c.from("receipts").insert({
    payment_id: "00000000-0000-0000-0000-000000000000",
    member_id: m1.uid,
    receipt_number: "HACK-1",
    amount: 1,
  });
  return !!error;
});

// ---------- PROVIDER EVENTS RLS ----------

await check("member cannot read provider_events", async () => {
  const { data } = await m1.c.from("provider_events").select("id").limit(1);
  return !data || data.length === 0;
});

// ---------- SUMMARY ----------
console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
