import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const server = readFileSync(
  new URL("../../src/lib/promotionBroadcast.server.ts", import.meta.url),
  "utf8",
);
const automation = readFileSync(
  new URL("../../src/lib/memberNotificationAutomation.server.ts", import.meta.url),
  "utf8",
);
const queuedDelivery = readFileSync(
  new URL("../../src/lib/memberNotificationDelivery.server.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824120000_yoga_lina_launch_promotion.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("promotion broadcast contract", () => {
  test("uses shared audience and channel consent decisions", () => {
    expect(server).toContain("selectPromotionAudience");
    expect(server).toContain("resolvePromotionDeliveryChannels");
  });

  test("creates durable inbox delivery and uses official providers", () => {
    expect(server).toContain("member_notifications");
    expect(server).toContain("enqueueMemberNotification");
    expect(server).toContain("sendOfficialWhatsappTemplateMessage");
    expect(server).toContain("promotion_deliveries");
  });

  test("dispatches scheduled promotions from the existing automation sweep", () => {
    expect(server).toContain("dispatchDuePromotions");
    expect(automation).toContain("dispatchDuePromotions");
  });

  test("retries active campaigns until durable broadcast completion is recorded", () => {
    expect(server).toContain('eq("status", "active")');
    expect(server).toContain('is("broadcast_dispatched_at", null)');
    expect(server).toContain("broadcast_dispatched_at: now.toISOString()");
  });

  test("claims campaign and WhatsApp delivery before external broadcast work", () => {
    expect(server).toContain("PROMOTION_DISPATCH_LEASE_MS");
    expect(server).toContain("broadcast_dispatch_started_at: leaseStartedAt");
    expect(server).toContain("broadcast_dispatch_started_at.lt.");
    expect(server).toContain("async function claimDelivery");
    expect(server.indexOf("const claimed = await claimDelivery")).toBeLessThan(
      server.indexOf("const result = await sendOfficialWhatsappTemplateMessage"),
    );
    expect(server).toContain("ignoreDuplicates: true");
    expect(server).toContain('.eq("status", "skipped")');
    expect(server).toContain('.eq("error_message", "campaign_inactive")');
  });

  test("never activates, claims, or retries an expired campaign", () => {
    expect(server.match(/ends_at\.is\.null,ends_at\.gt\./g)?.length).toBe(4);
    expect(server).toContain("checkedAt.toISOString()");
    expect(migration).toContain("v_campaign.ends_at<=now()");
    expect(migration).toContain("'campaign_window_expired'");
  });

  test("stops later channel work when a leased campaign is paused", () => {
    expect(server).toContain("async function campaignLeaseIsActive");
    expect(server.match(/campaignLeaseIsActive\(db, campaign\.id, leaseStartedAt\)/g)?.length).toBe(
      4,
    );
    expect(server).toContain("break memberLoop");
    expect(migration).toContain("suppress_inactive_promotion_notification");
    expect(migration).toContain("member_notification_inactive_promotion_guard");
    expect(server).toContain('action: interrupted ? "broadcast_interrupted"');
    expect(server).toContain("if (result.interrupted)");
  });

  test("suppresses a queued promotion push when the campaign is no longer active", () => {
    expect(queuedDelivery).toContain("promotion_id");
    expect(queuedDelivery).toContain("campaign_inactive");
    expect(queuedDelivery).toContain('status !== "active"');
    expect(queuedDelivery).toContain('delivery_status: "suppressed"');
  });

  test("does not revive a notification that was suppressed while a push was in flight", () => {
    const delivery = queuedDelivery.slice(
      queuedDelivery.indexOf("async function deliverNotification"),
      queuedDelivery.indexOf("export async function enqueueMemberNotification"),
    );
    expect(delivery.match(/\.eq\("delivery_status", "sending"\)/g)).toHaveLength(2);
  });
});
