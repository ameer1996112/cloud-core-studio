import { describe, expect, it } from "bun:test";
import {
  deriveProductionChannelStatus,
  deriveProductionJourneyStatus,
} from "@/lib/productionJourneyStatus";

describe("deriveProductionJourneyStatus", () => {
  it("reports a journey live only when every required unified event is live", () => {
    const result = deriveProductionJourneyStatus([
      {
        event_type: "booking_confirmed",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "email", "whatsapp"],
      },
      {
        event_type: "booking_changed",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push", "email"],
      },
      {
        event_type: "booking_checked_in",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app"],
      },
      {
        event_type: "booking_no_show_followup",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push"],
      },
      {
        event_type: "class_reminder_planning",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push", "whatsapp"],
      },
      {
        event_type: "class_reminder_final",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "whatsapp"],
      },
    ]);

    expect(result.find((journey) => journey.journeyType === "booking")).toEqual({
      journeyType: "booking",
      status: "live",
      liveEvents: 6,
      totalEvents: 6,
      channels: ["email", "in_app", "push", "whatsapp"],
    });
  });

  it("reports a journey partial when an event remains restricted", () => {
    const result = deriveProductionJourneyStatus([
      {
        event_type: "class_recommendation",
        enabled: true,
        allowlist_only: true,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push", "whatsapp"],
      },
    ]);

    expect(result.find((journey) => journey.journeyType === "recommendation")).toEqual({
      journeyType: "recommendation",
      status: "partial",
      liveEvents: 0,
      totalEvents: 1,
      channels: [],
    });
  });

  it("treats the published schedule as the weekly customer journey", () => {
    const result = deriveProductionJourneyStatus([
      {
        event_type: "weekly_schedule",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push"],
      },
    ]);

    expect(result.find((journey) => journey.journeyType === "weekly_schedule")).toEqual({
      journeyType: "weekly_schedule",
      status: "live",
      liveEvents: 1,
      totalEvents: 1,
      channels: ["in_app", "push"],
    });
  });

  it("does not present allowlisted channel delivery as live production", () => {
    const result = deriveProductionChannelStatus([
      {
        event_type: "class_recommendation",
        enabled: true,
        allowlist_only: true,
        copy_reviewed: true,
        enabled_channels: ["in_app", "whatsapp"],
      },
      {
        event_type: "booking_confirmed",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "email"],
      },
    ]);

    expect(result.find((channel) => channel.channel === "email")?.status).toBe("live");
    expect(result.find((channel) => channel.channel === "whatsapp")?.status).toBe("partial");
  });

  it("reports disabled or unreviewed rollout rows as inactive", () => {
    const result = deriveProductionJourneyStatus([
      {
        event_type: "retention_reminder",
        enabled: false,
        allowlist_only: false,
        copy_reviewed: true,
        enabled_channels: ["in_app", "push"],
      },
      {
        event_type: "trial_followup",
        enabled: true,
        allowlist_only: false,
        copy_reviewed: false,
        enabled_channels: ["in_app", "email"],
      },
    ]);

    expect(result.find((journey) => journey.journeyType === "retention")?.status).toBe("inactive");
    expect(result.find((journey) => journey.journeyType === "lead_to_trial")?.status).toBe(
      "inactive",
    );
  });
});
