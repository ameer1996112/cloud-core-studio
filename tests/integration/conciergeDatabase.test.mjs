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
  journey3: "83000000-0000-0000-0000-000000000003",
  intent1: "84000000-0000-0000-0000-000000000001",
  intent2: "84000000-0000-0000-0000-000000000002",
  intent3: "84000000-0000-0000-0000-000000000003",
  template: "85000000-0000-0000-0000-000000000001",
  emailTemplate: "85000000-0000-0000-0000-000000000002",
  whatsappTemplate: "85000000-0000-0000-0000-000000000003",
  pushDeliveryVersion: "87000000-0000-0000-0000-000000000001",
  emailDeliveryVersion: "87000000-0000-0000-0000-000000000002",
  whatsappDeliveryVersion: "87000000-0000-0000-0000-000000000003",
  pushSelection: "88000000-0000-0000-0000-000000000001",
  emailSelection: "88000000-0000-0000-0000-000000000002",
  whatsappSelection: "88000000-0000-0000-0000-000000000003",
  correlation1: "86000000-0000-0000-0000-000000000001",
  correlation2: "86000000-0000-0000-0000-000000000002",
  correlation3: "86000000-0000-0000-0000-000000000003",
};

function materializeSql(
  intentId,
  correlationId,
  suffix,
  actionUrl = "https://cloudandcorestudio.com/member/bookings",
  wabaId = "concierge-integration",
) {
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
          "finalSubject":"Booked","finalBody":"Your class is booked",
          "presentationKey":"booking_confirmed_repeat:push:v1","journeyType":"booking",
          "actionUrl":null,"selectionId":"${ids.pushSelection}"
        },
        "delivery":{
          "channel":"push","provider":"apns","recipientAddress":"${ids.user}",
          "status":"queued","errorCode":null,"idempotencyKey":"test-dispatch:${suffix}:push",
          "scheduledFor":"2026-07-26T10:00:00Z","expiresAt":null,"providerPayload":{}
        }
      },{
        "snapshot":{
          "templateId":"${ids.whatsappTemplate}","templateVersion":1,"locale":"en",
          "channel":"whatsapp","renderedVariables":{"member_name":"Test"},
          "finalSubject":null,"finalBody":"Your class is booked",
          "presentationKey":"booking_confirmed_repeat:whatsapp:v2","journeyType":"booking",
          "actionUrl":"${actionUrl}","selectionId":"${ids.whatsappSelection}"
        },
        "delivery":{
          "channel":"whatsapp","provider":"official_whatsapp","recipientAddress":"+972500000000",
          "status":"queued","errorCode":null,"idempotencyKey":"test-dispatch:${suffix}:whatsapp",
          "scheduledFor":"2026-07-26T10:00:00Z","expiresAt":null,
          "providerPayload":{
            "template_name":"booking_confirmed_repeat_branded_v2","template_language":"en_US",
            "presentation_key":"booking_confirmed_repeat:whatsapp:v2",
            "expected_content_hash":"integration-v2-hash",
            "selection_id":"${ids.whatsappSelection}",
            "components":[
              {"type":"header","parameters":[{"type":"image","image":{"link":"https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp"}}]},
              {"type":"body","parameters":[{"type":"text","text":"Test"}]}
            ]
          }
        }
      },{
        "snapshot":{
          "templateId":"${ids.emailTemplate}","templateVersion":1,"locale":"en",
          "channel":"email","renderedVariables":{"member_name":"Test"},
          "finalSubject":"Booked","finalBody":"Your class is booked",
          "presentationKey":"booking_confirmed_repeat:email:v2","journeyType":"booking",
          "actionUrl":"${actionUrl}","selectionId":"${ids.emailSelection}"
        },
        "delivery":{
          "channel":"email","provider":"resend","recipientAddress":"concierge-test@example.com",
          "status":"queued","errorCode":null,"idempotencyKey":"test-dispatch:${suffix}:email",
          "scheduledFor":"2026-07-26T10:00:00Z","expiresAt":null,"providerPayload":{}
        }
      }]'::jsonb,
      '${wabaId}',
      '2026-07-26T10:00:00Z'
    );
  `;
}

function invalidMaterializationsSql(materializations, legacy = false) {
  const common = `
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'invalid-shape','policy',1,'test_only','booking_confirmed_repeat',
    '00000000-0000-0000-0000-000000000004'::uuid,
    '{}'::text[],'{}'::uuid[],'{}'::jsonb,${materializations}`;
  return legacy
    ? `SELECT * FROM public.materialize_concierge_delivery(${common},now());`
    : `SELECT * FROM public.materialize_concierge_delivery(${common},null::text,now());`;
}

function legacyMaterializeSql() {
  return `
    SELECT outcome || ':' || COALESCE(result_suppression_reason,'')
    FROM public.materialize_concierge_delivery(
      (SELECT id FROM public.studios WHERE slug='cloud-core'),
      '${ids.recipient}','${ids.intent3}','test-dispatch:legacy',
      'concierge-2026-07-v1',2,'test_only','booking_confirmed_repeat',
      '${ids.correlation3}',ARRAY['legacy_compatibility'],'{}'::uuid[],
      '{"member_name":"Test"}'::jsonb,
      '[{
        "snapshot":{
          "templateId":"${ids.template}","templateVersion":1,"locale":"en",
          "channel":"push","renderedVariables":{"member_name":"Test"},
          "finalSubject":"Booked","finalBody":"Your class is booked"
        },
        "delivery":{
          "channel":"push","provider":"apns","recipientAddress":"${ids.user}",
          "status":"queued","errorCode":null,"idempotencyKey":"test-dispatch:legacy:push",
          "scheduledFor":"2026-07-26T10:00:00Z","expiresAt":null,"providerPayload":{}
        }
      }]'::jsonb,
      '2026-07-26T10:00:00Z'
    );
  `;
}

describe("concierge database integration", () => {
  test.skipIf(!databaseUrl)("rejects SQL null, JSON null, objects, and empty arrays", async () => {
    for (const materializations of ["NULL::jsonb", "'null'::jsonb", "'{}'::jsonb", "'[]'::jsonb"]) {
      await expect(psql(invalidMaterializationsSql(materializations))).rejects.toThrow(
        "materializations_required",
      );
      await expect(psql(invalidMaterializationsSql(materializations, true))).rejects.toThrow(
        "materializations_required",
      );
    }
  });

  test.skipIf(!databaseUrl)(
    "materializes once and atomically protects recipient contact capacity",
    async () => {
      await psql(`
        DELETE FROM public.automation_config_versions
        WHERE journey_type='booking' AND version=2
          AND studio_id=(SELECT id FROM public.studios WHERE slug='cloud-core');
        DELETE FROM public.concierge_delivery_selections
        WHERE studio_id=(SELECT id FROM public.studios WHERE slug='cloud-core')
          AND template_key='booking_confirmed_repeat'
          AND channel IN ('push','email','whatsapp')
          AND locale='en';
        DELETE FROM public.concierge_delivery_versions
        WHERE studio_id=(SELECT id FROM public.studios WHERE slug='cloud-core')
          AND template_key='booking_confirmed_repeat'
          AND channel IN ('push','email','whatsapp')
          AND locale='en';
        DELETE FROM public.concierge_template_versions
        WHERE studio_id=(SELECT id FROM public.studios WHERE slug='cloud-core')
          AND template_key='booking_confirmed_repeat'
          AND channel IN ('push','email','whatsapp')
          AND locale='en';
        DELETE FROM public.whatsapp_template_deployments
        WHERE waba_id IN ('concierge-integration','another-approved-waba')
          AND template_name='booking_confirmed_repeat_branded_v2';
        DELETE FROM auth.users WHERE id='${ids.user}';
        INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
        VALUES ('${ids.user}','authenticated','authenticated','concierge-test@example.com',now(),now());
        UPDATE public.profiles SET role='admin' WHERE id='${ids.user}';
        UPDATE public.members
        SET name='Concierge Test',preferred_language='en',
            email='concierge-test@example.com',status='active'
        WHERE id='${ids.user}';
        INSERT INTO public.communication_recipients(
          id,studio_id,member_id,display_name,email,phone_e164,preferred_locale,is_adult,status
        ) VALUES (
          '${ids.recipient}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          '${ids.user}','Concierge Test','concierge-test@example.com','+972500000000','en',true,'active'
        );
        INSERT INTO public.automation_config_versions(
          studio_id,journey_type,version,mode,config
        ) VALUES (
          (SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking',2,'test_only','{}'
        );
        INSERT INTO public.concierge_template_versions(
          id,studio_id,template_key,channel,locale,version,lifecycle_status,
          subject_template,body_template,required_variables,content_hash,approved_at,approved_by
        ) VALUES (
          '${ids.template}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking_confirmed_repeat','push','en',1,'approved','Booked',
          'Your class is booked',ARRAY['member_name'],'integration',now(),'${ids.user}'
        ),(
          '${ids.emailTemplate}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking_confirmed_repeat','email','en',1,'approved','Booked',
          'Your class is booked',ARRAY['member_name'],'integration-email',now(),'${ids.user}'
        ),(
          '${ids.whatsappTemplate}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking_confirmed_repeat','whatsapp','en',1,'approved',null,
          'Your class is booked',ARRAY['member_name'],'integration-whatsapp',now(),'${ids.user}'
        );
        INSERT INTO public.whatsapp_template_deployments(
          waba_id,template_name,language,version,category,content_hash,approval_status
        ) VALUES (
          'concierge-integration','booking_confirmed_repeat_branded_v2','en_US','v2','UTILITY','integration-v2-hash','APPROVED'
        ),(
          'another-approved-waba','booking_confirmed_repeat_branded_v2','en_US','v2','UTILITY','integration-v2-hash','APPROVED'
        );
        INSERT INTO public.concierge_delivery_versions(
          id,studio_id,journey_type,template_key,channel,locale,
          source_template_version,presentation_version,provider_template_name,provider_content_hash
        ) VALUES (
          '${ids.pushDeliveryVersion}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','push','en',1,1,null,null
        ),(
          '${ids.emailDeliveryVersion}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','email','en',1,2,null,null
        ),(
          '${ids.whatsappDeliveryVersion}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','whatsapp','en',1,2,
          'booking_confirmed_repeat_branded_v2','integration-v2-hash'
        );
        INSERT INTO public.concierge_delivery_selections(
          id,studio_id,journey_type,template_key,channel,locale,delivery_mode,
          delivery_version_id,selected_by
        ) VALUES (
          '${ids.pushSelection}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','push','en','test_only',
          '${ids.pushDeliveryVersion}','${ids.user}'
        ),(
          '${ids.emailSelection}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','email','en','test_only',
          '${ids.emailDeliveryVersion}','${ids.user}'
        ),(
          '${ids.whatsappSelection}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','booking_confirmed_repeat','whatsapp','en','test_only',
          '${ids.whatsappDeliveryVersion}','${ids.user}'
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
        ),
        (
          '${ids.journey3}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          'booking','${ids.user}','${ids.recipient}','active','test-journey:3','${ids.correlation3}'
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
        ),
        (
          '${ids.intent3}',(SELECT id FROM public.studios WHERE slug='cloud-core'),
          '${ids.journey3}','booking','${ids.user}','${ids.recipient}',
          'transactional',1,'2026-07-26T10:00:00Z','test-intent:3',
          'concierge-2026-07-v1','pending'
        );
      `);

      const outcomes = await Promise.all([
        psql(materializeSql(ids.intent1, ids.correlation1, "one")),
        psql(materializeSql(ids.intent2, ids.correlation2, "two")),
      ]);
      expect([...outcomes].sort()).toEqual(["materialized:", "postponed:six_hour_contact_cap"]);
      const materialized =
        outcomes[0] === "materialized:"
          ? { intentId: ids.intent1, correlationId: ids.correlation1, suffix: "one" }
          : { intentId: ids.intent2, correlationId: ids.correlation2, suffix: "two" };
      expect(
        await psql(
          `SELECT count(*) FROM public.message_deliveries WHERE idempotency_key LIKE 'test-dispatch:%';`,
        ),
      ).toBe("3");
      expect(
        await psql(`
          SELECT string_agg(m.content->>'presentation_key', ',' ORDER BY m.content->>'presentation_key')
          FROM public.messages m
          JOIN public.message_deliveries d ON d.message_id=m.id
          WHERE d.idempotency_key LIKE 'test-dispatch:${materialized.suffix}:%';
        `),
      ).toBe(
        "booking_confirmed_repeat:email:v2,booking_confirmed_repeat:push:v1,booking_confirmed_repeat:whatsapp:v2",
      );
      expect(
        await psql(`
          SELECT (provider_payload->>'template_name') || ':' ||
                 (provider_payload->>'presentation_key') || ':' ||
                 (provider_payload->>'expected_content_hash') || ':' ||
                 (provider_payload->>'selection_id')
          FROM public.message_deliveries
          WHERE idempotency_key='test-dispatch:${materialized.suffix}:whatsapp';
        `),
      ).toBe(
        `booking_confirmed_repeat_branded_v2:booking_confirmed_repeat:whatsapp:v2:` +
          `integration-v2-hash:${ids.whatsappSelection}`,
      );
      expect(
        await psql(
          `SELECT count(*) FROM public.frequency_reservations WHERE communication_recipient_id='${ids.recipient}';`,
        ),
      ).toBe("1");

      expect(
        await psql(
          materializeSql(materialized.intentId, materialized.correlationId, materialized.suffix),
        ),
      ).toBe("duplicate:");
      expect(
        await psql(
          `SELECT count(*) FROM public.message_deliveries WHERE idempotency_key LIKE 'test-dispatch:${materialized.suffix}:%';`,
        ),
      ).toBe("3");
      await psql(`
        UPDATE public.concierge_decisions
        SET materialization_evidence=NULL
        WHERE decision_key='test-dispatch:${materialized.suffix}';
      `);
      await expect(
        psql(
          materializeSql(materialized.intentId, materialized.correlationId, materialized.suffix),
        ),
      ).rejects.toThrow("snapshot_replay_mismatch");
      await expect(
        psql(
          materializeSql(
            materialized.intentId,
            materialized.correlationId,
            materialized.suffix,
            "https://cloudandcorestudio.com/member/changed",
          ),
        ),
      ).rejects.toThrow("invalid_concierge_presentation_evidence");
      await expect(
        psql(
          materializeSql(
            materialized.intentId,
            materialized.correlationId,
            materialized.suffix,
            "https://cloudandcorestudio.com/member/bookings",
            "another-approved-waba",
          ),
        ),
      ).rejects.toThrow("snapshot_replay_mismatch");
      await expect(
        psql(
          materializeSql(
            ids.intent2,
            ids.correlation2,
            "off-origin",
            "https://evil.example/action",
          ),
        ),
      ).rejects.toThrow("invalid_concierge_presentation_evidence");

      expect(await psql(legacyMaterializeSql())).toBe("materialized:");
      expect(
        await psql(`
          SELECT m.content->>'presentation_key' || ':' || m.content->>'selection_id'
          FROM public.messages m
          JOIN public.message_deliveries d ON d.message_id=m.id
          WHERE d.idempotency_key='test-dispatch:legacy:push';
        `),
      ).toBe(`booking_confirmed_repeat:push:v1:${ids.pushSelection}`);
    },
  );
});
