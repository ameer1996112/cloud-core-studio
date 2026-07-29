import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));

mock.module("@/components/visual/ClassMoodImage", () => ({
  ClassMoodImage: ({ title }) =>
    React.createElement("div", { "data-testid": "class-image" }, title),
}));

const { VisualClassCard } = await import("../../src/components/visual/VisualClassCard.tsx");

const sampleClass = {
  id: "class-1",
  starts_at: "2026-07-03T14:00:00.000Z",
  duration_minutes: 60,
  capacity: 8,
  booked_count: 8,
  energy: "grounded",
  instructor: { name: "Maya" },
  room_ref: { name: "Main Studio" },
  program_type: { name_he: "יוגה אווירית", name_en: "Aerial Yoga" },
};

function renderCard(state) {
  return renderToStaticMarkup(
    React.createElement(VisualClassCard, {
      cls: sampleClass,
      state,
      onOpen() {},
      variant: "standard",
      context: "memberSchedule",
    }),
  );
}

describe("VisualClassCard package cta", () => {
  test("exposes a localized accessible name and dialog relationship", () => {
    const markup = renderCard({ kind: "available", spotsLeft: 3 });

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-label="');
    expect(markup).toContain("יוגה אווירית");
    expect(markup).toContain("פרטים והרשמה");
  });

  test("renders renew credits as a direct packages link", () => {
    const markup = renderCard({ kind: "low_credits" });

    expect(markup).toContain('role="button"');
    expect(markup).toContain('href="/member/packages"');
    expect(markup).toContain("חידוש קרדיטים");
    expect(markup).not.toContain('<button type="button"');
  });

  test("renders choose package as a direct packages link", () => {
    const markup = renderCard({ kind: "package_required" });

    expect(markup).toContain('href="/member/packages"');
    expect(markup).toContain('data-card-open-ignore="true"');
  });
});
