import { describe, expect, test } from "bun:test";

const databaseUrl = process.env.MESSAGING_TEST_DATABASE_URL;

async function psql(sql) {
  const child = Bun.spawn(["psql", databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(sql);
  child.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr || stdout || `psql exited ${exitCode}`);
  return stdout.trim();
}

const ids = {
  user: "81000000-0000-0000-0000-000000000001",
  recipient: "82000000-0000-0000-0000-000000000001",
  journey1: "83000000-0000-0000-0000-000000000001",
  journey2: "83000000-0000-0000-0000-000000000002",
  intent1: "84000000-0000-0000-0000-000000000001",
  intent2: "84000000-0000-0000-0000-000000000002",
  template: "85000000-0000-0000-0000-000000000001",
  correlation1: "86000000-0000-0000-0000-000000000001",
  correlation2: "86000000-0000-0000-0000-000000000002",
};

function materializeSql(intentId, correlationId, suffix) {
  return `
    SELECT outcome || ':' || COALESCE(result_suppression_reason,'')
    FROM public.materialize_concierge_delivery(
      (SELECT id FROM public.studios WHERE slug='cloud-core'),
      '${ids.recipient}','${intentId}','test-dispatch:${suffix}',
      'concierge-2026-07-v1',2,'test_only','booking_confirmed_repeat',
      '${correlationId}',ARRAY['integration_test'],'{}'::uuid[],
      '{"member_name":"Test"}'::jsonb,
      '[{
        "snapshot":{
          "templateId":"${ids.template}","templateVersion":1,"locale":"en",
          "channel":"push","renderedVariables":{"member_name":"Test"},
          "finalSubject":"Booked","finalBody":"Your class is booked"
        },
        "delivery":{
          "channel":"push","provider":"apns","recipientAddress":"${ids.user}",
          "status":"queued","errorCode":null,"idempotencyKey":"test-dispatch:${suffix}:push",
          "scheduledFor":"2026-07-26T10:00:00Z","expiresAt":null,"providerPayload":{}
        }
      }]'::jsonb,
      '2026-07-26T10:00:00Z'
    );
  `;
}

describe("concierge database integration", () => {
  test.skipIf(!databaseUrl)(
    "materializes once and atomically protects recipient contact capacity",
    async () => {
      await psql(`
        DELETE FROM public.automation_config_versions
        WHERE journey_type='booking' AND version=2
          AND studio_id=(SELECT id FROM public.studios WHERE slug='cloud-core');
        DELETE FROM public.concierge_template_versions WHERE id='${ids.template}';
        DELETE FROM auth.users WHERE id='${ids.user}';
        INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
        VALUES ('${ids.user}','authenticated','authenticated','concierge-test@example.com',now(),now());
        UPDATE public.members
        SET name='Concierge Test',preferred_language='en',
            email='concierge-test@example.com',status='active'
        WHERE id='${ids.user}';
        INSERT INTO public.communication_recipients(
          id,studio_id,member_id,display_name,email,preferred_locale,is_adult,status
        ) VALUES (
          '${ids.recipient}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          '${ids.user}','Concierge Test','concierge-test@example.com','en',true,'active'
        );
        INSERT INTO public.automation_config_versions(
          studio_id,journey_type,version,mode,config
        ) VALUES (
          (SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking',2,'test_only','{}'
        );
        INSERT INTO public.concierge_template_versions(
          id,studio_id,template_key,channel,locale,version,lifecycle_status,
          subject_template,body_template,required_variables,content_hash,approved_at
        ) VALUES (
          '${ids.template}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking_confirmed_repeat','push','en',1,'approved','Booked',
          'Your class is booked',ARRAY['member_name'],'integration',now()
        );
        INSERT INTO public.journey_instances(
          id,studio_id,journey_type,participant_id,communication_recipient_id,
          state,deduplication_key,correlation_id
        ) VALUES
        (
          '${ids.journey1}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','${ids.user}','${ids.recipient}','active','test-journey:1','${ids.correlation1}'
        ),
        (
          '${ids.journey2}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','${ids.user}','${ids.recipient}','active','test-journey:2','${ids.correlation2}'
        );
        INSERT INTO public.journey_intents(
          id,studio_id,journey_instance_id,journey_type,participant_id,
          communication_recipient_id,purpose,priority,eligible_at,deduplication_key,
          initial_policy_version,status
        ) VALUES
        (
          '${ids.intent1}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          '${ids.journey1}','booking','${ids.user}','${ids.recipient}',
          'transactional',3,'2026-07-26T10:00:00Z','test-intent:1',
          'concierge-2026-07-v1','pending'
        ),
        (
          '${ids.intent2}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          '${ids.journey2}','booking','${ids.user}','${ids.recipient}',
          'transactional',3,'2026-07-26T10:00:00Z','test-intent:2',
          'concierge-2026-07-v1','pending'
        );
      `);

      const outcomes = await Promise.all([
        psql(materializeSql(ids.intent1, ids.correlation1, "one")),
        psql(materializeSql(ids.intent2, ids.correlation2, "two")),
      ]);
      expect(outcomes.sort()).toEqual(["materialized:", "postponed:six_hour_contact_cap"]);
      expect(
        await psql(
          `SELECT count(*) FROM public.message_deliveries WHERE idempotency_key LIKE 'test-dispatch:%:push';`,
        ),
      ).toBe("1");
      expect(
        await psql(
          `SELECT count(*) FROM public.frequency_reservations WHERE communication_recipient_id='${ids.recipient}';`,
        ),
      ).toBe("1");

      expect(await psql(materializeSql(ids.intent1, ids.correlation1, "one"))).toBe("duplicate:");
      expect(
        await psql(
          `SELECT count(*) FROM public.message_deliveries WHERE idempotency_key='test-dispatch:one:push';`,
        ),
      ).toBe("1");
    },
  );
});
