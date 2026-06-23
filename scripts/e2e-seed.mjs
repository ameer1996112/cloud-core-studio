// Idempotent seed for e2e tests. Creates users + minimal data.
// Run: node scripts/e2e-seed.mjs   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env)
import { createClient } from "@supabase/supabase-js";
const URL = process.env.SUPABASE_URL,
  SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SR) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const s = createClient(URL, SR, { auth: { persistSession: false } });
export const PWD = "E2ePass!23";
export const USERS = [
  { email: "e2e_admin@test.local", role: "admin", name: "E2E Admin" },
  { email: "e2e_instructor@test.local", role: "instructor", name: "E2E Instructor" },
  { email: "e2e_member@test.local", role: "member", name: "E2E Member" },
  { email: "e2e_member2@test.local", role: "member", name: "E2E Member 2" },
];

async function upsertUser(u) {
  const { data: list } = await s.auth.admin.listUsers();
  const existing = list.users.find((x) => x.email === u.email);
  let id;
  if (existing) {
    id = existing.id;
    await s.auth.admin.updateUserById(id, { password: PWD, email_confirm: true });
  } else {
    const { data, error } = await s.auth.admin.createUser({
      email: u.email,
      password: PWD,
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    if (error) throw error;
    id = data.user.id;
  }
  await s.from("profiles").upsert({ id, role: u.role });
  await s.from("members").upsert({ id, name: u.name });
  return id;
}

const ids = {};
for (const u of USERS) {
  ids[u.email] = await upsertUser(u);
}

// Ensure instructor row exists for FK
await s
  .from("instructors")
  .upsert({ id: ids["e2e_instructor@test.local"], name: "E2E Instructor", active: true });

async function upsertPlan(p) {
  const { data: ex } = await s.from("plans").select("id").eq("name", p.name).maybeSingle();
  if (ex) {
    const { error } = await s.from("plans").update(p).eq("id", ex.id);
    if (error) throw new Error("plan update: " + error.message);
  } else {
    const { error } = await s.from("plans").insert(p);
    if (error) throw new Error("plan insert: " + error.message);
  }
}
await upsertPlan({
  name: "E2E 10 Credits",
  credits: 10,
  duration_days: 30,
  price_cents: 10000,
  currency: "USD",
  active: true,
});
await upsertPlan({
  name: "E2E Unlimited",
  credits: 999,
  duration_days: 30,
  price_cents: 20000,
  currency: "USD",
  active: true,
});

// Reset members for clean state
for (const email of ["e2e_member@test.local", "e2e_member2@test.local"]) {
  await s
    .from("members")
    .update({ remaining_credits: 10, attendance_count: 0 })
    .eq("id", ids[email]);
}

// Seed a room
const { data: roomEx } = await s.from("rooms").select("id").eq("name", "E2E Studio").maybeSingle();
if (!roomEx) await s.from("rooms").insert({ name: "E2E Studio", capacity: 4, active: true });

// Clean up any leftover E2E classes from previous runs (only ones with our prefix)
{
  const { data: stale } = await s.from("classes").select("id").like("title", "E2E %");
  for (const c of stale || []) {
    await s.from("bookings").delete().eq("class_id", c.id);
    await s.from("waitlist_entries").delete().eq("class_id", c.id);
    await s.from("attendance_records").delete().eq("class_id", c.id);
  }
  await s.from("classes").delete().like("title", "E2E %");
}

async function seedClass({ title, capacity, startOffsetMin, cancellation_window_hours = 4 }) {
  const starts_at = new Date(Date.now() + startOffsetMin * 60000).toISOString();
  const { data: c, error } = await s
    .from("classes")
    .insert({
      title,
      starts_at,
      duration_minutes: 60,
      capacity,
      instructor_id: ids["e2e_instructor@test.local"],
      room: "E2E Studio",
      credit_cost: 1,
      cancellation_window_hours,
      status: "scheduled",
      booked_count: 0,
      waitlist_count: 0,
      energy: "flow",
    })
    .select()
    .single();
  if (error) throw error;
  return c.id;
}
const openClassId = await seedClass({
  title: "E2E Open Class",
  capacity: 5,
  startOffsetMin: 60 * 24,
});
const fullClassId = await seedClass({
  title: "E2E Full Class",
  capacity: 1,
  startOffsetMin: 60 * 24 + 30,
});
const lateClassId = await seedClass({
  title: "E2E Imminent Class",
  capacity: 5,
  startOffsetMin: 30,
  cancellation_window_hours: 4,
});

// Fill the full class with member2 so member1 must waitlist
const fillRes = await s.rpc("admin_create_booking", {
  p_actor_id: ids["e2e_admin@test.local"],
  p_class_id: fullClassId,
  p_member_id: ids["e2e_member2@test.local"],
  p_override: true,
});

const result = { password: PWD, ids, openClassId, fullClassId, lateClassId, fillRes: fillRes.data };
console.log(JSON.stringify(result, null, 2));
