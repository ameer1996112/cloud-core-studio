import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  bookingAvailabilityForClassState,
  cancellationOutcomePresentation,
  deriveBookingViewState,
  type BookingViewStateInput,
} from "../../src/lib/booking-view-state";
import { BookingActionPanel } from "../../src/components/member/BookingActionPanel";
import { ensureI18nNamespaces } from "../../src/lib/i18n";

await ensureI18nNamespaces(["member"]);

function fixture(overrides: Partial<BookingViewStateInput> = {}): BookingViewStateInput {
  return {
    availability: "available",
    lang: "en",
    seats: { remaining: 3, capacity: 10 },
    cost: { kind: "credits", count: 2 },
    ...overrides,
  };
}

describe("deriveBookingViewState", () => {
  test.each([
    ["available", "available"],
    ["almost", "available"],
    ["full", "full"],
    ["waitlist_available", "waitlist-open"],
    ["package_required", "ineligible"],
    ["low_credits", "ineligible"],
    ["closed", "full"],
    ["cancelled", "full"],
    ["booked", "booked"],
    ["waiting", "booked"],
  ] as const)("adapts the existing %s class decision to %s presentation", (kind, availability) => {
    expect(bookingAvailabilityForClassState(kind)).toBe(availability);
  });

  test.each([
    ["available", "book"],
    ["full", "unavailable"],
    ["waitlist-open", "join-waitlist"],
    ["ineligible", "recover"],
    ["pending", "pending"],
    ["booked", "manage"],
  ] as const)("maps %s to %s", (availability, action) => {
    expect(
      deriveBookingViewState(
        fixture({
          availability,
          recovery:
            availability === "ineligible"
              ? {
                  reason: "An active package is required.",
                  label: "Choose a package",
                  href: "/member/packages",
                }
              : undefined,
        }),
      ).action.kind,
    ).toBe(action);
  });

  test("formats the exact seats and credit consequence supplied by the surface", () => {
    const state = deriveBookingViewState(fixture());

    expect(state.seatCopy).toBe("3 of 10 spots available.");
    expect(state.consequence).toBe("This booking uses 2 credits.");
    expect(state.action).toEqual({
      kind: "book",
      label: "Book · 2 credits",
      consequence: "This booking uses 2 credits.",
    });
  });

  test("preserves an authoritative formatted cash price without recalculating it", () => {
    const state = deriveBookingViewState(fixture({ cost: { kind: "price", formatted: "₪48.00" } }));

    expect(state.consequence).toBe("Total due: ₪48.00.");
  });

  test("carries recovery and cancellation details into their matching actions", () => {
    const recovery = deriveBookingViewState(
      fixture({
        availability: "ineligible",
        recovery: {
          reason: "Your credits need renewing.",
          label: "Top up credits",
          href: "/member/packages",
        },
      }),
    );
    const booked = deriveBookingViewState(
      fixture({ availability: "booked", cancellationDeadline: "Friday at 18:00" }),
    );

    expect(recovery.action).toEqual({
      kind: "recover",
      reason: "Your credits need renewing.",
      label: "Top up credits",
      href: "/member/packages",
    });
    expect(booked.action).toEqual({
      kind: "manage",
      label: "Manage booking",
      cancellationDeadline: "Friday at 18:00",
    });
  });

  test("requires the surface to supply the authoritative ineligibility recovery", () => {
    expect(() =>
      deriveBookingViewState(fixture({ availability: "ineligible", recovery: undefined })),
    ).toThrow("Ineligible booking presentation requires an authoritative recovery action.");
  });

  test("locks duplicate actions only while the authoritative mutation is pending", () => {
    expect(deriveBookingViewState(fixture({ availability: "pending" })).actionLocked).toBe(true);
    expect(deriveBookingViewState(fixture()).actionLocked).toBe(false);
  });

  test.each(["success", "failure"] as const)(
    "keeps a final %s outcome persistent with the class context and recovery",
    (kind) => {
      const state = deriveBookingViewState(
        fixture({
          outcome: {
            kind,
            message: kind === "success" ? "Your spot is saved." : "Could not book this class.",
            context: "Friday Flow · Friday at 18:00",
            recovery:
              kind === "failure"
                ? { label: "Try again", kind: "retry" }
                : { label: "View my bookings", kind: "link", href: "/member/bookings" },
          },
        }),
      );

      expect(state.outcome).toMatchObject({ kind, persistent: true });
      expect(state.outcome?.context).toBe("Friday Flow · Friday at 18:00");
      expect(state.outcome?.recovery?.label).toBe(
        kind === "success" ? "View my bookings" : "Try again",
      );
    },
  );

  test("retains cancellation facts and caller-owned recovery in a terminal outcome", () => {
    expect(
      cancellationOutcomePresentation({
        kind: "success",
        message: "Booking cancelled.",
        context: "Friday Flow · Friday at 18:00",
        refundedCredits: "2 credits were returned to your balance.",
        cancellationDeadline: "Cancellation deadline: Friday at 14:00.",
        recovery: { kind: "link", label: "Browse schedule", href: "/member/schedule" },
      }),
    ).toEqual({
      kind: "success",
      message: "Booking cancelled.",
      context: "Friday Flow · Friday at 18:00",
      details: [
        "2 credits were returned to your balance.",
        "Cancellation deadline: Friday at 14:00.",
      ],
      recovery: { kind: "link", label: "Browse schedule", href: "/member/schedule" },
    });

    expect(
      cancellationOutcomePresentation({
        kind: "failure",
        message: "The cancellation window has passed.",
        context: "Friday Flow · Friday at 18:00",
        cancellationDeadline: "Cancellation deadline: Friday at 14:00.",
        recovery: { kind: "link", label: "Contact support", href: "/support" },
      }),
    ).toMatchObject({
      details: ["Cancellation deadline: Friday at 14:00."],
      recovery: { kind: "link", label: "Contact support", href: "/support" },
    });
  });
});

describe("BookingActionPanel", () => {
  test("announces changing status politely and disables the pending action", () => {
    const html = renderToStaticMarkup(
      React.createElement(BookingActionPanel, {
        state: deriveBookingViewState(
          fixture({ availability: "pending", pendingLabel: "Booking…" }),
        ),
        onAction() {},
      }),
    );

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Booking…");
    expect(html).toContain("disabled");
    expect(html).toContain("3 of 10 spots available.");
    expect(html).toContain("This booking uses 2 credits.");
  });

  test("renders a final failure and retry as persistent visible content", () => {
    const html = renderToStaticMarkup(
      React.createElement(BookingActionPanel, {
        state: deriveBookingViewState(
          fixture({
            outcome: {
              kind: "failure",
              message: "Could not book this class.",
              context: "Friday Flow · Friday at 18:00",
              recovery: { kind: "retry", label: "Try again" },
            },
          }),
        ),
        onAction() {},
        onRetry() {},
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not book this class.");
    expect(html).toContain("Friday Flow · Friday at 18:00");
    expect(html).toContain("Try again");
  });

  test("renders terminal cancellation details and support recovery even without the live summary", () => {
    const html = renderToStaticMarkup(
      React.createElement(BookingActionPanel, {
        state: deriveBookingViewState(
          fixture({
            outcome: cancellationOutcomePresentation({
              kind: "failure",
              message: "The cancellation window has passed.",
              context: "Friday Flow · Friday at 18:00",
              cancellationDeadline: "Cancellation deadline: Friday at 14:00.",
              recovery: { kind: "link", label: "Contact support", href: "/support" },
            }),
          }),
        ),
        showAction: false,
        showSummary: false,
      }),
    );

    expect(html).toContain("Cancellation deadline: Friday at 14:00.");
    expect(html).toContain('href="/support"');
    expect(html).toContain("Contact support");
  });

  test("renders exact refunded credits and deadline in the persistent success outcome", () => {
    const html = renderToStaticMarkup(
      React.createElement(BookingActionPanel, {
        state: deriveBookingViewState(
          fixture({
            outcome: cancellationOutcomePresentation({
              kind: "success",
              message: "Booking cancelled.",
              context: "Friday Flow · Friday at 18:00",
              refundedCredits: "2 credits were returned to your balance.",
              cancellationDeadline: "Cancellation deadline: Friday at 14:00.",
              recovery: { kind: "link", label: "Browse schedule", href: "/member/schedule" },
            }),
          }),
        ),
        showAction: false,
        showSummary: false,
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("2 credits were returned to your balance.");
    expect(html).toContain("Cancellation deadline: Friday at 14:00.");
  });
});
