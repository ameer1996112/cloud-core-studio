import { describe, expect, test } from "bun:test";
import {
  conciergeJourneyForTemplate,
  filterConciergeTemplates,
  isConciergeTemplateApproved,
  renderConciergeTemplatePreview,
} from "../../src/lib/conciergeTemplateAdmin.ts";

const templates = [
  {
    id: "1",
    template_key: "booking_confirmed_first",
    channel: "push",
    locale: "he",
    version: 1,
    lifecycle_status: "approved",
    subject_template: null,
    body_template: "השיעור הראשון שלך אושר",
    required_variables: ["member_name"],
    approved_at: "2026-07-26T00:00:00Z",
    approved_by: "admin-1",
  },
  {
    id: "2",
    template_key: "retention",
    channel: "in_app",
    locale: "en",
    version: 1,
    lifecycle_status: "draft",
    subject_template: null,
    body_template: "We missed seeing you",
    required_variables: ["member_name"],
    approved_at: null,
    approved_by: null,
  },
];

describe("Concierge template admin filters", () => {
  test("combines journey, channel, and locale filters", () => {
    expect(
      filterConciergeTemplates(templates, {
        journey: "booking",
        channel: "push",
        locale: "he",
        query: "",
      }).map((template) => template.id),
    ).toEqual(["1"]);
  });

  test("searches localized body copy and template keys", () => {
    expect(
      filterConciergeTemplates(templates, {
        journey: "",
        channel: "",
        locale: "",
        query: "missed",
      }).map((template) => template.id),
    ).toEqual(["2"]);
    expect(
      filterConciergeTemplates(templates, {
        journey: "",
        channel: "",
        locale: "",
        query: "booking_confirmed",
      }).map((template) => template.id),
    ).toEqual(["1"]);
  });

  test("groups template variants into their Concierge journey", () => {
    expect(conciergeJourneyForTemplate("booking_confirmed_repeat")).toBe("booking");
    expect(conciergeJourneyForTemplate("payment_recovered")).toBe("payment_outcome");
  });

  test("requires recorded approver and timestamp for approved status", () => {
    expect(isConciergeTemplateApproved(templates[0])).toBe(true);
    expect(
      isConciergeTemplateApproved({
        ...templates[0],
        approved_by: null,
      }),
    ).toBe(false);
  });

  test("renders localized fixture values without unresolved tokens", () => {
    const preview = renderConciergeTemplatePreview({
      ...templates[0],
      body_template: "היי {{member_name}}, ההזמנה אושרה",
    });
    expect(preview.body).toBe("היי נועה, ההזמנה אושרה");
    expect(preview.body).not.toContain("{{");
  });
});
