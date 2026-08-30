import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AsyncState } from "../../src/components/ui/async-state.tsx";
import { ResponsiveDataList } from "../../src/components/ui/responsive-data-list.tsx";
import { PersistentAnnouncement } from "../../src/components/ui/sonner.tsx";

const readSource = (file) =>
  readFileSync(new URL(`../../src/components/ui/${file}`, import.meta.url), "utf8");

const render = (element) => renderToStaticMarkup(element);
const decoder = new TextDecoder();

function verifyFocusReturnForwarding() {
  const script = `
import { mock } from "bun:test";
import * as React from "react";

const primitive = React.forwardRef((props, ref) => React.createElement("radix-primitive", { ...props, ref }));
const content = React.forwardRef((props, ref) => React.createElement("radix-content", { ...props, ref }));

mock.module("@radix-ui/react-dialog", () => ({
  Root: primitive,
  Trigger: primitive,
  Close: primitive,
  Portal: ({ children }) => React.createElement(React.Fragment, null, children),
  Overlay: primitive,
  Content: content,
  Title: primitive,
  Description: primitive,
}));
mock.module("@/lib/i18n", () => ({
  t: () => "Close",
  useI18n: () => ({ t: () => "Close" }),
}));

const { DialogContent } = await import("./src/components/ui/dialog.tsx");
const { SheetContent } = await import("./src/components/ui/sheet.tsx");
const dialogSentinel = () => undefined;
const sheetSentinel = () => undefined;
const dialogTree = DialogContent.render({ children: "Dialog body", onCloseAutoFocus: dialogSentinel }, null);
const sheetTree = SheetContent.render({ children: "Sheet body", onCloseAutoFocus: sheetSentinel }, null);
const dialogContent = React.Children.toArray(dialogTree.props.children)[1];
const sheetContent = React.Children.toArray(sheetTree.props.children)[1];

if (dialogContent.props.onCloseAutoFocus !== dialogSentinel) throw new Error("Dialog did not forward onCloseAutoFocus");
if (sheetContent.props.onCloseAutoFocus !== sheetSentinel) throw new Error("Sheet did not forward onCloseAutoFocus");
process.stdout.write("focus-return-forwarded");
`;
  const result = Bun.spawnSync({
    cmd: [process.execPath, "-e", script],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr).trim() || "focus-return forwarding check failed");
  }

  return decoder.decode(result.stdout);
}

describe("composite accessibility contracts", () => {
  test("AsyncState renders persistent loading, empty, and error semantics that callers cannot override", () => {
    const loading = render(
      React.createElement(AsyncState, {
        state: { status: "loading", label: "Loading member records" },
        "aria-busy": false,
      }),
    );
    const empty = render(
      React.createElement(AsyncState, {
        state: {
          status: "empty",
          title: "No members yet",
          body: "Invite a member to begin.",
          action: React.createElement("a", { href: "/members/new" }, "Invite member"),
        },
        "aria-busy": true,
      }),
    );
    const error = render(
      React.createElement(AsyncState, {
        state: {
          status: "error",
          title: "Members unavailable",
          body: "Try again shortly.",
          retry: () => undefined,
        },
      }),
    );

    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain("Loading member records");
    expect(empty).toContain('aria-busy="false"');
    expect(empty).toContain("No members yet");
    expect(empty).toContain("Invite a member to begin.");
    expect(empty).toContain("Invite member");
    expect(error).toContain("Members unavailable");
    expect(error).toContain("Try again shortly.");
    expect(error).toContain("<button");
  });

  test("ResponsiveDataList renders the same columns as captioned table headers and labeled cards", () => {
    const html = render(
      React.createElement(ResponsiveDataList, {
        caption: "Member directory",
        columns: [
          { id: "name", label: "Name", cell: (member) => member.name },
          { id: "plan", label: "Plan", cell: (member) => member.plan },
        ],
        data: [{ id: "m-1", name: "Ari", plan: "Unlimited" }],
        getRowKey: (member) => member.id,
      }),
    );

    expect(html).toContain("<caption");
    expect(html).toContain("Member directory</caption>");
    expect(html).toContain("<th class=");
    expect(html).toContain('scope="col"');
    expect(html).toContain(">Name</th>");
    expect(html).toContain(">Plan</th>");
    expect(html).toContain('data-label="Name"');
    expect(html).toContain('data-label="Plan"');
    expect(html).toContain("><dt");
    expect(html).toContain(">Ari</dd>");
    expect(html).toContain(">Unlimited</dd>");
  });

  test("PersistentAnnouncement keeps success and error live-region semantics authoritative", () => {
    const success = render(
      React.createElement(
        PersistentAnnouncement,
        { tone: "success", title: "Profile saved", role: "alert", "aria-live": "assertive" },
        "Your changes are available.",
      ),
    );
    const error = render(
      React.createElement(
        PersistentAnnouncement,
        { tone: "error", title: "Could not save", role: "status", "aria-live": "polite" },
        "Check your connection and retry.",
      ),
    );

    expect(success).toContain('role="status"');
    expect(success).toContain('aria-live="polite"');
    expect(success).toContain("Profile saved");
    expect(success).toContain("Your changes are available.");
    expect(error).toContain('role="alert"');
    expect(error).toContain('aria-live="assertive"');
    expect(error).toContain("Could not save");
    expect(error).toContain("Check your connection and retry.");
  });

  test("DialogContent and SheetContent forward exact focus-return handlers to Radix Content", () => {
    expect(verifyFocusReturnForwarding()).toBe("focus-return-forwarded");
  });

  test("dialog and sheet wrappers preserve Radix title, description, close, and focus-return forwarding", () => {
    for (const file of ["dialog.tsx", "alert-dialog.tsx", "sheet.tsx"]) {
      const source = readSource(file);

      expect(source).toMatch(/Primitive\.Title/);
      expect(source).toMatch(/Primitive\.Description/);
      expect(source).toMatch(/\.\.\.props/);
    }

    const dialogContent = readSource("dialog.tsx").match(
      /const DialogContent[\s\S]*?DialogContent\.displayName/,
    )?.[0];
    const sheetContent = readSource("sheet.tsx").match(
      /const SheetContent[\s\S]*?SheetContent\.displayName/,
    )?.[0];

    expect(dialogContent).toMatch(/ComponentPropsWithoutRef<typeof DialogPrimitive\.Content>/);
    expect(dialogContent).toMatch(/DialogPrimitive\.Close/);
    expect(dialogContent).toMatch(/aria-label=\{t\("common\.close"\)\}/);
    expect(dialogContent).toMatch(/\.\.\.props/);
    expect(readSource("sheet.tsx")).toMatch(
      /ComponentPropsWithoutRef<typeof SheetPrimitive\.Content>/,
    );
    expect(sheetContent).toMatch(/SheetPrimitive\.Close/);
    expect(sheetContent).toMatch(/aria-label=\{t\("common\.close"\)\}/);
    expect(sheetContent).toMatch(/\.\.\.props/);
  });

  test("composite motion controls remain reduced-motion safe", () => {
    for (const file of ["dialog.tsx", "alert-dialog.tsx", "sheet.tsx", "skeleton.tsx"]) {
      expect(readSource(file)).toMatch(/motion-reduce:animate-none/);
    }
  });
});
