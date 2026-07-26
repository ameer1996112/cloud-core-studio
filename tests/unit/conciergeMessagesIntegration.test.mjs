import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const messagesRoute = readFileSync(
  resolve(root, "src/routes/_authenticated/admin/messages.tsx"),
  "utf8",
);

describe("Concierge Messages integration", () => {
  test("makes Concierge the first-class default workspace in Messages", () => {
    expect(messagesRoute).toContain("import { ConciergeCommandCenter }");
    expect(messagesRoute).toContain('"concierge"');
    expect(messagesRoute).toContain('useState<Tab>("concierge")');
    expect(messagesRoute).toContain('tab === "concierge" && <ConciergeCommandCenter');
    expect(messagesRoute).toContain('title: "קונסיירז׳ והודעות"');
    expect(messagesRoute).toContain('title: "الكونسيرج والرسائل"');
  });

  test("keeps the Concierge command center connected to the safe server controls", () => {
    const component = readFileSync(
      resolve(root, "src/components/admin/ConciergeCommandCenter.tsx"),
      "utf8",
    );

    expect(component).toContain("getConciergeCenter");
    expect(component).toContain("setConciergeAutomationMode");
    expect(component).toContain("setConciergeChannelEnabled");
    expect(component).toContain("simulateConciergeDecision");
    expect(component).toContain("ENABLE LIVE CONCIERGE");
    expect(component).toContain("simulationMutation.isPending");
  });

  test("keeps the old automations URL on the shared implementation", () => {
    const automationsRoute = readFileSync(
      resolve(root, "src/routes/_authenticated/admin/automations.tsx"),
      "utf8",
    );

    expect(automationsRoute).toContain("<ConciergeCommandCenter lang={lang} />");
    expect(automationsRoute).not.toContain("setConciergeAutomationMode");
  });
});
