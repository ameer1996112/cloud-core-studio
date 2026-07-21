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
      const rollbackReconciliation = await readFile(
        path.join(root, "docs/sql/unified-messaging-rollback-reconciliation.sql"),
        "utf8",
      );
      await psql(fixture);
      await psql(migration);
      await psql(openClassAlertMigration);

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

      await psql(`INSERT INTO public.classes VALUES (
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
      expect(memberVisible.split("\n").find((line) => /^\d+$/.test(line))).toBe("1");

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
        INSERT INTO public.classes VALUES (
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
          "SELECT event_type || ':' || count(*) FROM public.message_outbox WHERE aggregate_id='20000000-0000-0000-0000-000000000002' GROUP BY event_type;",
        ),
      ).toBe("class_cancelled_by_admin:1");

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
          '20000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'waiting'
        );
        UPDATE public.waitlist_entries SET status='promoted'
          WHERE id='74000000-0000-0000-0000-000000000001';
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
        "payment_confirmed,payment_failed,payment_request_received,receipt_issued,waitlist_joined,waitlist_spot_available",
      );
      expect(
        await psql(
          "SELECT (offered_at IS NOT NULL AND offer_expires_at > offered_at)::text FROM public.waitlist_entries WHERE id='74000000-0000-0000-0000-000000000001';",
        ),
      ).toBe("true");

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
  );
});
