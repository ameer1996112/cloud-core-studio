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
});
