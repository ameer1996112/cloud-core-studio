import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.MESSAGING_TEST_DATABASE_URL;
const root = process.cwd();

async function psql(sql, args = []) {
  const processHandle = Bun.spawn(
    ["psql", databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At", ...args],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  processHandle.stdin.write(sql);
  processHandle.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr || stdout || `psql exited ${exitCode}`);
  return stdout.trim();
}

async function bookClassAs({ callerId, actorId = callerId, classId }) {
  const output = await psql(`
    SET ROLE authenticated;
    SET request.jwt.claim.sub = '${callerId}';
    SELECT concat_ws(':', result->>'status', result->>'message')
    FROM (SELECT public.book_class_v2('${actorId}', '${classId}') AS result) booking;
    RESET ROLE;
  `);
  return output
    .split("\n")
    .find((line) =>
      /^(booked|already_booked|full|no_active_package|insufficient_credits|error:)/.test(line),
    );
}

describe("unified messaging database integration", () => {
  test.skipIf(!databaseUrl)(
    "migrates, backfills, claims, deduplicates, and enforces RLS",
    async () => {
      const fixture = await readFile(
        path.join(root, "tests/integration/fixtures/unified_messaging_base.sql"),
        "utf8",
      );
      const migration = await readFile(
        path.join(root, "supabase/migrations/20260720140000_unified_messaging_phases_1_2.sql"),
        "utf8",
      );
      const openClassAlertMigration = await readFile(
        path.join(root, "supabase/migrations/20260721143000_open_class_alert_reservations.sql"),
        "utf8",
      );
      const premiumNotificationMigration = await readFile(
        path.join(root, "supabase/migrations/20260721170000_premium_notification_foundation.sql"),
        "utf8",
      );
      const premiumAllEventsMigration = await readFile(
        path.join(root, "supabase/migrations/20260721190000_premium_notification_all_events.sql"),
        "utf8",
      );
      const journeyTuningMigration = await readFile(
        path.join(root, "supabase/migrations/20260722120000_premium_messaging_journey_tuning.sql"),
        "utf8",
      );
      const adminBookingAlertMigration = await readFile(
        path.join(root, "supabase/migrations/20260809120000_admin_self_booking_alerts.sql"),
        "utf8",
      );
      const signupConsentMigration = await readFile(
        path.join(
          root,
          "supabase/migrations/20260731150000_separate_signup_notification_consent.sql",
        ),
        "utf8",
      );
      const signupPreferenceColumnsMigration = await readFile(
        path.join(root, "supabase/migrations/20260729163000_signup_notification_consent.sql"),
        "utf8",
      );
      const durableNotificationMigration = await readFile(
        path.join(root, "supabase/migrations/20260902150000_durable_notification_cloud_tasks.sql"),
        "utf8",
      );
      const rollbackReconciliation = await readFile(
        path.join(root, "docs/sql/unified-messaging-rollback-reconciliation.sql"),
        "utf8",
      );
      await psql(fixture);
      await psql(migration);
      await psql(openClassAlertMigration);
      await psql(premiumNotificationMigration);
      await psql(premiumAllEventsMigration);
      await psql(journeyTuningMigration);
      await psql(`
        ALTER TABLE public.classes ADD COLUMN credit_cost integer NOT NULL DEFAULT 1;
        ALTER TABLE public.bookings ADD COLUMN credit_cost integer NOT NULL DEFAULT 1;
        CREATE UNIQUE INDEX bookings_one_active_per_member
          ON public.bookings(class_id, member_id) WHERE status = 'booked';
        CREATE TABLE public.credit_transactions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id uuid NOT NULL REFERENCES public.members(id),
          amount_delta integer NOT NULL,
          reason text NOT NULL,
          related_booking_id uuid REFERENCES public.bookings(id),
          created_by uuid
        );
        CREATE TABLE public.attendance_records (
          booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
          member_id uuid NOT NULL REFERENCES public.members(id),
          class_id uuid NOT NULL REFERENCES public.classes(id),
          status text NOT NULL
        );
        CREATE OR REPLACE FUNCTION public.sweep_member_credits(p_member_id uuid)
        RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;
      `);
      await psql(adminBookingAlertMigration);
      await psql(signupPreferenceColumnsMigration);
      await psql(signupConsentMigration);
      await psql(durableNotificationMigration);

      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE template_key IS NULL OR template_version IS NULL OR locale IS NULL;",
        ),
      ).toBe("0");
      expect(
        await psql(
          "SELECT has_function_privilege('authenticated','public.claim_message_delivery_by_id(uuid,text,uuid,integer)','EXECUTE')::text;",
        ),
      ).toBe("false");
      expect(
        await psql(
          "SELECT has_function_privilege('authenticated','public.notification_delivery_health()','EXECUTE')::text;",
        ),
      ).toBe("false");
      await psql(
        "SELECT public.record_notification_runtime_heartbeat('maintenance','completed','{\"selected\":0}'::jsonb);",
      );
      expect(
        await psql(
          "SELECT (public.notification_delivery_health()->>'last_maintenance_execution' IS NOT NULL)::text;",
        ),
      ).toBe("true");
      const scheduleVersionRoundTrip = await psql(`
        BEGIN;
        UPDATE public.classes
        SET starts_at = starts_at + interval '1 hour'
        WHERE id='20000000-0000-0000-0000-000000000001';
        UPDATE public.classes
        SET starts_at = starts_at - interval '1 hour'
        WHERE id='20000000-0000-0000-0000-000000000001';
        SELECT notification_schedule_version::text
        FROM public.classes
        WHERE id='20000000-0000-0000-0000-000000000001';
        ROLLBACK;
      `);
      expect(scheduleVersionRoundTrip.split("\n")).toContain("2");
      await psql(`
        INSERT INTO public.message_deliveries (
          id, message_id, channel, status, idempotency_key, scheduled_for
        )
        SELECT
          '69000000-0000-4000-8000-000000000001', id, 'in_app', 'queued',
          'integration:cloud-task-lease', now()
        FROM public.messages
        ORDER BY created_at
        LIMIT 1;
      `);
      const concurrentClaims = await Promise.all([
        psql(
          "SELECT count(*) FROM public.claim_message_delivery_by_id('69000000-0000-4000-8000-000000000001','integration-a','69000000-0000-4000-8000-000000000002',300);",
        ),
        psql(
          "SELECT count(*) FROM public.claim_message_delivery_by_id('69000000-0000-4000-8000-000000000001','integration-b','69000000-0000-4000-8000-000000000003',300);",
        ),
      ]);
      expect(concurrentClaims.sort()).toEqual(["0", "1"]);
      const staleLeaseToken = await psql(
        "SELECT lease_token::text FROM public.message_deliveries WHERE id='69000000-0000-4000-8000-000000000001';",
      );
      await psql(
        "UPDATE public.message_deliveries SET lease_expires_at=now() - interval '1 second' WHERE id='69000000-0000-4000-8000-000000000001';",
      );
      expect(
        await psql(
          "SELECT count(*) FROM public.claim_message_delivery_by_id('69000000-0000-4000-8000-000000000001','integration-c','69000000-0000-4000-8000-000000000004',300);",
        ),
      ).toBe("1");
      expect(
        await psql(
          `WITH stale AS (
             UPDATE public.message_deliveries
             SET status='sent'
             WHERE id='69000000-0000-4000-8000-000000000001'
               AND lease_token='${staleLeaseToken}'
             RETURNING id
           ) SELECT count(*) FROM stale;`,
        ),
      ).toBe("0");

      expect(
        await psql("SELECT count(*) FROM public.messages WHERE legacy_source_table IS NOT NULL;"),
      ).toBe("2");
      expect(
        await psql(
          "SELECT count(*) FROM public.message_deliveries WHERE idempotency_key LIKE 'legacy:%';",
        ),
      ).toBe("3");
      expect(
        await psql(
          "SELECT whatsapp_enabled::text || ',' || email_enabled::text FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("true,true");
      expect(
        await psql(
          "SELECT class_reminders_enabled::text || ',' || schedule_openings_enabled::text || ',' || recommendations_enabled::text FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("true,true,false");
      expect(
        await psql(
          "SELECT has_table_privilege('authenticated','public.member_push_tokens','SELECT')::text;",
        ),
      ).toBe("false");
      expect(
        await psql(
          "SELECT count(*)::text FROM public.notification_event_rollouts WHERE enabled AND copy_reviewed AND allowlist_only;",
        ),
      ).toBe("43");
      expect(
        await psql(
          "SELECT enabled::text || ',' || copy_reviewed::text || ',' || allowlist_only::text || ',' || enabled_channels::text FROM public.notification_event_rollouts WHERE event_type='booking_registered_admin';",
        ),
      ).toBe("true,true,false,{push,email}");
      expect(
        await psql(
          "SELECT enabled_channels::text FROM public.notification_event_rollouts WHERE event_type='member_welcome';",
        ),
      ).toBe("{in_app,whatsapp,email}");
      expect(
        await psql(
          "SELECT has_table_privilege('authenticated','public.notification_experiment_assignments','SELECT')::text;",
        ),
      ).toBe("false");
      expect(
        await psql(
          "SELECT has_table_privilege('authenticated','public.notification_growth_cooldowns','SELECT')::text;",
        ),
      ).toBe("false");

      await psql(`
        UPDATE public.members
        SET remaining_credits = 5
        WHERE id = '00000000-0000-0000-0000-000000000001';
        INSERT INTO public.members (
          id, name, preferred_language, phone, email, status, remaining_credits
        ) VALUES
          ('00000000-0000-0000-0000-000000000003', 'First booking', 'en',
           '+972501111111', 'first@example.com', 'active', 5),
          ('00000000-0000-0000-0000-000000000004', 'No credits', 'he',
           '+972502222222', 'empty@example.com', 'active', 0);
        INSERT INTO public.member_notification_preferences (member_id) VALUES
          ('00000000-0000-0000-0000-000000000003'),
          ('00000000-0000-0000-0000-000000000004')
        ON CONFLICT (member_id) DO NOTHING;
        INSERT INTO public.classes (
          id, title, starts_at, cancellation_window_hours, instructor_id, status,
          capacity, booked_count, credit_cost
        ) VALUES
          ('20000000-0000-0000-0000-000000000006', 'Repeat member class',
           now() + interval '2 days', 24, '10000000-0000-0000-0000-000000000001',
           'scheduled', 10, 0, 1),
          ('20000000-0000-0000-0000-000000000007', 'First member class',
           now() + interval '3 days', 24, '10000000-0000-0000-0000-000000000001',
           'scheduled', 10, 0, 1),
          ('20000000-0000-0000-0000-000000000008', 'Staff-created class',
           now() + interval '4 days', 24, '10000000-0000-0000-0000-000000000001',
           'scheduled', 10, 0, 1),
          ('20000000-0000-0000-0000-000000000009', 'No-credit class',
           now() + interval '5 days', 24, '10000000-0000-0000-0000-000000000001',
           'scheduled', 10, 0, 1),
          ('20000000-0000-0000-0000-000000000010', 'Full class',
           now() + interval '6 days', 24, '10000000-0000-0000-0000-000000000001',
           'scheduled', 1, 1, 1);
      `);
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000003",
          actorId: "00000000-0000-0000-0000-000000000001",
          classId: "20000000-0000-0000-0000-000000000006",
        }),
      ).toBe("error:forbidden");
      expect(
        await psql(
          "SELECT count(*)::text FROM public.message_outbox WHERE event_type='booking_registered_admin';",
        ),
      ).toBe("0");
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000001",
          classId: "20000000-0000-0000-0000-000000000006",
        }),
      ).toBe("booked");
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000003",
          classId: "20000000-0000-0000-0000-000000000007",
        }),
      ).toBe("booked");
      expect(
        await psql(
          "SELECT string_agg(member_id::text || ':' || (payload->>'first_booking'), E'\\n' ORDER BY member_id) FROM public.message_outbox WHERE event_type='booking_registered_admin';",
        ),
      ).toBe(
        "00000000-0000-0000-0000-000000000001:false\n00000000-0000-0000-0000-000000000003:true",
      );
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000003",
          classId: "20000000-0000-0000-0000-000000000007",
        }),
      ).toBe("already_booked");
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000004",
          classId: "20000000-0000-0000-0000-000000000009",
        }),
      ).toBe("no_active_package");
      expect(
        await bookClassAs({
          callerId: "00000000-0000-0000-0000-000000000001",
          classId: "20000000-0000-0000-0000-000000000010",
        }),
      ).toBe("full");
      await psql(`
        INSERT INTO public.bookings (id, class_id, member_id, status, credit_cost)
        VALUES (
          '30000000-0000-0000-0000-000000000008',
          '20000000-0000-0000-0000-000000000008',
          '00000000-0000-0000-0000-000000000001', 'booked', 1
        );
        INSERT INTO public.waitlist_entries (id, class_id, member_id, status)
        VALUES (
          '70000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000010',
          '00000000-0000-0000-0000-000000000003', 'waiting'
        );
      `);
      expect(
        await psql(
          "SELECT count(*)::text FROM public.message_outbox WHERE event_type='booking_registered_admin';",
        ),
      ).toBe("2");

      await psql(`
        INSERT INTO public.member_push_tokens (
          id, member_id, token, installation_id, permission_status, active
        ) VALUES (
          '62000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', repeat('a', 64),
          'installation-integration-1', 'granted', true
        );
        INSERT INTO public.messages (
          id, member_id, event_type, language, template_key, template_version, subject, body,
          member_visible, idempotency_key
        ) VALUES (
          '63000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'booking_confirmed', 'en',
          'cc_booking_confirmed_v2', 'v2', 'Booking confirmed', 'Body', true,
          'integration:premium-message'
        );
        INSERT INTO public.message_deliveries (
          id, message_id, channel, provider, recipient_address, status, idempotency_key
        ) VALUES (
          '64000000-0000-0000-0000-000000000001',
          '63000000-0000-0000-0000-000000000001', 'push', 'apns',
          '00000000-0000-0000-0000-000000000001', 'sent', 'integration:premium-push'
        );
        INSERT INTO public.message_delivery_targets (
          id, delivery_id, push_token_id, member_id, status
        ) VALUES (
          '65000000-0000-0000-0000-000000000001',
          '64000000-0000-0000-0000-000000000001',
          '62000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'sent'
        );
      `);
      const engagement = await psql(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
        SELECT public.record_message_engagement(
          '63000000-0000-0000-0000-000000000001', 'device_received',
          'installation-integration-1', NULL, now(), '{}'
        );
        SELECT public.record_message_engagement(
          '63000000-0000-0000-0000-000000000001', 'device_received',
          'installation-integration-1', NULL, now(), '{}'
        );
        RESET ROLE;
      `);
      expect(engagement.split("\n").filter((line) => /^[0-9a-f-]{36}$/.test(line))).toHaveLength(1);
      expect(
        await psql(
          "SELECT status || ':' || (SELECT count(*) FROM public.message_engagement_events WHERE message_id='63000000-0000-0000-0000-000000000001')::text FROM public.message_delivery_targets WHERE id='65000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("device_received:1");

      const insert = `INSERT INTO public.message_outbox (
      event_type, aggregate_type, aggregate_id, member_id, deduplication_key
    ) VALUES (
      'booking_confirmed', 'booking', '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001', 'concurrent:dedupe'
    ) ON CONFLICT (deduplication_key) DO NOTHING;`;
      await Promise.all([psql(insert), psql(insert), psql(insert), psql(insert)]);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE deduplication_key='concurrent:dedupe';",
        ),
      ).toBe("1");

      await psql(`INSERT INTO public.message_outbox (
      event_type, aggregate_type, member_id, deduplication_key
    ) SELECT 'booking_confirmed', 'booking',
      '00000000-0000-0000-0000-000000000001', 'claim:' || value
      FROM generate_series(1, 12) value;`);
      const [firstClaim, secondClaim] = await Promise.all([
        psql("SELECT id FROM public.claim_message_outbox('worker-a', 6, 120);"),
        psql("SELECT id FROM public.claim_message_outbox('worker-b', 6, 120);"),
      ]);
      const claimed = [...firstClaim.split("\n"), ...secondClaim.split("\n")].filter(Boolean);
      expect(claimed.length).toBe(12);
      expect(new Set(claimed).size).toBe(12);

      await psql(`INSERT INTO public.classes (
        id, title, starts_at, cancellation_window_hours, instructor_id, status
      ) VALUES (
        '20000000-0000-0000-0000-000000000003', 'Second open class', now() + interval '1 day',
        24, '10000000-0000-0000-0000-000000000001', 'scheduled'
      );`);
      const reservations = await Promise.all([
        psql(
          "SELECT public.enqueue_open_class_alert('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',4,now() + interval '1 day')::text;",
        ),
        psql(
          "SELECT public.enqueue_open_class_alert('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',4,now() + interval '1 day')::text;",
        ),
      ]);
      expect(reservations.filter(Boolean)).toHaveLength(1);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE event_type='class_open_spots' AND member_id='00000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("1");

      await psql(`
        INSERT INTO public.members (id, name, status)
        SELECT
          ('81000000-0000-0000-0000-' || lpad(value::text, 12, '0'))::uuid,
          'Class cap member ' || value, 'active'
        FROM generate_series(1, 12) value;
        INSERT INTO public.classes (
          id, title, starts_at, cancellation_window_hours, instructor_id, status
        ) VALUES (
          '20000000-0000-0000-0000-000000000005', 'Atomic cap class',
          now() + interval '1 day', 24,
          '10000000-0000-0000-0000-000000000001', 'scheduled'
        );
      `);
      const classCapReservations = await Promise.all(
        Array.from({ length: 12 }, (_, index) => {
          const memberSuffix = String(index + 1).padStart(12, "0");
          return psql(
            `SELECT public.enqueue_open_class_alert(
              '20000000-0000-0000-0000-000000000005',
              '81000000-0000-0000-0000-${memberSuffix}', 4, now() + interval '1 day'
            );`,
          );
        }),
      );
      expect(classCapReservations.filter(Boolean)).toHaveLength(10);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE event_type='class_open_spots' AND aggregate_id='20000000-0000-0000-0000-000000000005';",
        ),
      ).toBe("10");

      const leases = await Promise.all([
        psql("SELECT public.acquire_whatsapp_provisioning_lease('waba-1','owner-a',300);"),
        psql("SELECT public.acquire_whatsapp_provisioning_lease('waba-1','owner-b',300);"),
      ]);
      expect(leases.sort()).toEqual(["f", "t"]);

      const memberVisible = await psql(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
      SELECT count(*) FROM public.messages;
      RESET ROLE;
    `);
      // The member can see the backfilled inbox row plus the premium message
      // inserted above, but not the member-invisible legacy notification log.
      expect(memberVisible.split("\n").find((line) => /^\d+$/.test(line))).toBe("2");

      await psql(rollbackReconciliation, ["-v", "cutover_at=2000-01-01T00:00:00Z"]);
      expect(
        await psql(
          "SELECT count(*) FROM public.member_notifications WHERE idempotency_key LIKE 'rollback:canonical:%';",
        ),
      ).toBe("1");
      expect(
        await psql(
          "SELECT count(*) FROM public.notification_logs WHERE idempotency_key LIKE 'rollback:canonical:%';",
        ),
      ).toBe("1");

      expect(
        await psql(
          "SELECT messaging_canonical_writes_enabled::text FROM public.studio_settings WHERE id=1;",
        ),
      ).toBe("false");
      await psql(`
        UPDATE public.studio_settings SET messaging_canonical_writes_enabled=true WHERE id=1;
        INSERT INTO public.members (id, name, preferred_language, phone, email)
        VALUES (
          '00000000-0000-0000-0000-000000000002', 'Welcome Member', 'en',
          '+972500000002', 'welcome@example.com'
        );
        INSERT INTO public.members (id, name, preferred_language, phone, email, status)
        VALUES (
          '00000000-0000-0000-0000-000000000013', 'Inactive Member', 'en',
          '+972500000003', 'inactive@example.com', 'inactive'
        );
        INSERT INTO public.members (id, name, preferred_language, phone, status)
        VALUES (
          '00000000-0000-0000-0000-000000000014', 'Invalid Phone Member', 'en', '+', 'active'
        );
        INSERT INTO public.classes (
          id, title, starts_at, cancellation_window_hours, instructor_id, status
        ) VALUES (
          '20000000-0000-0000-0000-000000000002', 'Cancelled class', now() + interval '2 days',
          24, '10000000-0000-0000-0000-000000000001', 'scheduled'
        );
        INSERT INTO public.bookings VALUES (
          '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000001', 'booked', now()
        );
        UPDATE public.classes SET status='cancelled'
          WHERE id='20000000-0000-0000-0000-000000000002';
        UPDATE public.bookings SET status='cancelled'
          WHERE id='30000000-0000-0000-0000-000000000002';
      `);
      expect(
        await psql(
          "SELECT event_type || ':' || count(*) FROM public.message_outbox WHERE aggregate_id='20000000-0000-0000-0000-000000000002' AND event_type='class_cancelled_by_admin' GROUP BY event_type;",
        ),
      ).toBe("class_cancelled_by_admin:1");
      expect(
        await psql(
          "SELECT event_type || ':' || deduplication_key FROM public.message_outbox WHERE member_id='00000000-0000-0000-0000-000000000002' AND event_type='member_welcome';",
        ),
      ).toBe("member_welcome:member:welcome:00000000-0000-0000-0000-000000000002:v2");
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE member_id='00000000-0000-0000-0000-000000000013' AND event_type='member_welcome';",
        ),
      ).toBe("0");
      await psql(`
        UPDATE public.members SET status='active'
          WHERE id='00000000-0000-0000-0000-000000000013';
        UPDATE public.members SET status='active'
          WHERE id='00000000-0000-0000-0000-000000000013';
      `);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE member_id='00000000-0000-0000-0000-000000000013' AND event_type='member_welcome';",
        ),
      ).toBe("1");
      expect(
        await psql(
          "SELECT whatsapp_enabled::text || ',' || email_enabled::text FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000013';",
        ),
      ).toBe("false,true");
      expect(
        await psql(
          "SELECT count(*)::text || ':' || min(source) FROM public.notification_preference_events WHERE member_id='00000000-0000-0000-0000-000000000013' AND preference_key IN ('whatsapp_enabled','email_enabled');",
        ),
      ).toBe("1:member_activation_essential_email");
      expect(
        await psql(
          "SELECT whatsapp_enabled::text || ',' || email_enabled::text || ',' || coalesce(whatsapp_consent_source, '') || ',' || email_consent_source FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000002';",
        ),
      ).toBe("false,true,,essential_service_email");
      expect(
        await psql(
          "SELECT whatsapp_enabled::text FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000014';",
        ),
      ).toBe("false");

      await psql(`
        INSERT INTO public.payments (id, member_id, amount, currency, status)
        VALUES (
          '72000000-0000-0000-0000-000000000009',
          '00000000-0000-0000-0000-000000000001', 100, 'ILS', 'paid'
        );
        UPDATE public.payments SET status='refunded'
          WHERE id='72000000-0000-0000-0000-000000000009';
      `);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE aggregate_id='72000000-0000-0000-0000-000000000009' AND event_type='payment_refunded';",
        ),
      ).toBe("1");

      await psql(`
        UPDATE public.notification_event_rollouts
        SET enabled=false
        WHERE event_type='booking_checked_in';
        INSERT INTO public.classes (
          id, title, starts_at, cancellation_window_hours, instructor_id, status
        ) VALUES (
          '20000000-0000-0000-0000-000000000004', 'Premium event class',
          now() + interval '3 days', 24,
          '10000000-0000-0000-0000-000000000001', 'scheduled'
        );
        INSERT INTO public.bookings VALUES (
          '30000000-0000-0000-0000-000000000004',
          '20000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000001', 'booked', now()
        );
        UPDATE public.bookings SET status='checked_in'
          WHERE id='30000000-0000-0000-0000-000000000004';
      `);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE event_type='booking_checked_in' AND aggregate_id='30000000-0000-0000-0000-000000000004';",
        ),
      ).toBe("0");
      await psql(`
        UPDATE public.notification_event_rollouts
        SET copy_reviewed=true, enabled=true
        WHERE event_type IN ('booking_checked_in', 'credits_depleted');
        UPDATE public.bookings SET status='booked'
          WHERE id='30000000-0000-0000-0000-000000000004';
        UPDATE public.bookings SET status='checked_in'
          WHERE id='30000000-0000-0000-0000-000000000004';
        UPDATE public.members SET remaining_credits=3
          WHERE id='00000000-0000-0000-0000-000000000001';
        UPDATE public.members SET remaining_credits=0
          WHERE id='00000000-0000-0000-0000-000000000001';
      `);
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE event_type='booking_checked_in' AND aggregate_id='30000000-0000-0000-0000-000000000004';",
        ),
      ).toBe("1");
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE event_type='credits_depleted' AND member_id='00000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("1");

      await psql(`
        INSERT INTO public.messages (
          id, member_id, direction, audience, event_type, language, template_key, template_version,
          body, content, member_visible, idempotency_key, created_at
        ) VALUES (
          '60000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'outbound', 'member',
          'booking_confirmed', 'en', 'cc_booking_confirmed_v2', 'v2', 'old body',
          '{"variables":{"member_name":"Private"}}', true, 'integration:stale-message',
          now() - interval '14 months'
        );
        INSERT INTO public.message_deliveries (
          id, message_id, channel, provider, recipient_address, status, provider_message_id,
          provider_payload, idempotency_key, lease_owner, lease_expires_at, created_at
        ) VALUES
        (
          '61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
          'whatsapp', 'official_whatsapp', '972500000001', 'sending', 'wamid.stale',
          '{"template_name":"cc_booking_confirmed_v2"}', 'integration:stale-whatsapp',
          'dead-worker', now() - interval '1 minute', now() - interval '14 months'
        ),
        (
          '61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001',
          'email', 'resend', 'staff@example.com', 'sending', 'email-stale', '{}',
          'integration:stale-email', 'dead-worker', now() - interval '1 minute',
          now() - interval '14 months'
        );
      `);
      const staleClaim = await psql(
        "SELECT id FROM public.claim_message_deliveries('recovery-worker', 10, 120, ARRAY['email','whatsapp']);",
      );
      expect(staleClaim).toContain("61000000-0000-0000-0000-000000000002");
      expect(
        await psql(
          "SELECT status || ':' || failure_class FROM public.message_deliveries WHERE id='61000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("delivery_unknown:ambiguous");

      await psql(
        "UPDATE public.message_deliveries SET status='sent', provider_message_id='wamid.atomic' WHERE id='61000000-0000-0000-0000-000000000001';",
      );
      await Promise.all([
        psql(
          "SELECT * FROM public.apply_message_delivery_status('official_whatsapp','wamid.atomic','read','read',now(),NULL,NULL);",
        ),
        psql(
          "SELECT * FROM public.apply_message_delivery_status('official_whatsapp','wamid.atomic','delivered','delivered',now(),NULL,NULL);",
        ),
      ]);
      expect(
        await psql(
          "SELECT status FROM public.message_deliveries WHERE id='61000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("read");

      await psql(
        "SELECT * FROM public.apply_message_delivery_status('resend','email-stale','suppressed','complained',now(),'resend_complained','permanent');",
      );
      expect(
        await psql(
          "SELECT email_enabled::text || ':' || email_consent_source FROM public.member_notification_preferences WHERE member_id='00000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("false:resend_complaint");

      const openings = await Promise.all([
        psql(
          "SELECT newly_opened::text || ':' || open_generation::text FROM public.open_whatsapp_message_conversation('972599999999',NULL,now());",
        ),
        psql(
          "SELECT newly_opened::text || ':' || open_generation::text FROM public.open_whatsapp_message_conversation('972599999999',NULL,now());",
        ),
      ]);
      expect(openings.map((value) => value.split(":")[0]).sort()).toEqual(["false", "true"]);
      expect(new Set(openings.map((value) => value.split(":")[1])).size).toBe(1);

      await psql(`
        INSERT INTO public.plans VALUES ('70000000-0000-0000-0000-000000000001', 'Monthly');
        INSERT INTO public.member_subscriptions (
          id, member_id, plan_id, status, retry_count, amount, currency
        ) VALUES (
          '71000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          '70000000-0000-0000-0000-000000000001', 'active', 0, 350, 'ILS'
        );
        INSERT INTO public.payments (
          id, member_id, amount, currency, status, plan_id, subscription_id
        ) VALUES (
          '72000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 350, 'ILS', 'pending',
          '70000000-0000-0000-0000-000000000001',
          '71000000-0000-0000-0000-000000000001'
        );
        UPDATE public.payments SET status='paid'
          WHERE id='72000000-0000-0000-0000-000000000001';
        INSERT INTO public.receipts (
          id, payment_id, member_id, receipt_number, amount, currency
        ) VALUES (
          '73000000-0000-0000-0000-000000000001',
          '72000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'CC-1001', 350, 'ILS'
        );
        UPDATE public.member_subscriptions SET status='past_due', retry_count=1
          WHERE id='71000000-0000-0000-0000-000000000001';
        INSERT INTO public.waitlist_entries (id, class_id, member_id, status) VALUES (
          '74000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000008',
          '00000000-0000-0000-0000-000000000002', 'waiting'
        );
        INSERT INTO public.bookings VALUES (
          '30000000-0000-0000-0000-000000000005',
          '20000000-0000-0000-0000-000000000008',
          '00000000-0000-0000-0000-000000000002', 'booked', now()
        );
        UPDATE public.waitlist_entries SET status='promoted'
          WHERE id='74000000-0000-0000-0000-000000000001';
        INSERT INTO public.waitlist_entries (id, class_id, member_id, status) VALUES (
          '74000000-0000-0000-0000-000000000002',
          '20000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000002', 'waiting'
        );
        UPDATE public.waitlist_entries SET status='promoted'
          WHERE id='74000000-0000-0000-0000-000000000002';
      `);
      expect(
        await psql(`
          SELECT string_agg(event_type, ',' ORDER BY event_type)
          FROM public.message_outbox
          WHERE aggregate_id IN (
            '72000000-0000-0000-0000-000000000001',
            '73000000-0000-0000-0000-000000000001',
            '71000000-0000-0000-0000-000000000001',
            '74000000-0000-0000-0000-000000000001'
          );
        `),
      ).toBe(
        "payment_confirmed,payment_failed,payment_request_received,receipt_issued,subscription_renewal_failed,waitlist_joined",
      );
      expect(
        await psql(
          "SELECT (offered_at IS NOT NULL AND offer_expires_at > offered_at)::text FROM public.waitlist_entries WHERE id='74000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("true");
      expect(
        await psql(
          "SELECT string_agg(event_type, ',' ORDER BY event_type) FROM public.message_outbox WHERE aggregate_id='30000000-0000-0000-0000-000000000005';",
        ),
      ).toBe("waitlist_accepted");
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE aggregate_id='74000000-0000-0000-0000-000000000001' AND event_type='waitlist_spot_available';",
        ),
      ).toBe("0");
      expect(
        await psql(
          "SELECT count(*) FROM public.message_outbox WHERE aggregate_id='74000000-0000-0000-0000-000000000002' AND event_type='waitlist_spot_available';",
        ),
      ).toBe("1");

      const retention = JSON.parse(
        await psql("SELECT public.redact_and_purge_message_audit(now())::text;"),
      );
      expect(retention.redacted_messages).toBeGreaterThanOrEqual(1);
      expect(retention.redacted_deliveries).toBeGreaterThanOrEqual(1);
      expect(
        await psql(
          "SELECT (recipient_address IS NULL AND provider_message_id IS NULL AND provider_payload='{}'::jsonb)::text FROM public.message_deliveries WHERE id='61000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("true");
    },
    30_000,
  );
});
