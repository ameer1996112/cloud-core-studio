import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const shell = read("src/components/app-shell/AppShell.tsx");
const authenticatedRoute = read("src/routes/_authenticated/route.tsx");
const memberRoute = read("src/routes/_authenticated/member/route.tsx");
const instructorRoute = read("src/routes/_authenticated/instructor/route.tsx");
const instructorIndex = read("src/routes/_authenticated/instructor/index.tsx");
const adminRoute = read("src/routes/_authenticated/admin/route.tsx");
const adminMessages = read("src/routes/_authenticated/admin/messages.tsx");
const dangerZonePath = resolve(root, "src/components/admin/AdminClassDangerZone.tsx");
const destructiveActionPath = resolve(root, "src/components/admin/AdminDestructiveAction.tsx");

describe("authenticated shell accessibility contracts", () => {
  test("owns the only main landmark while nested authenticated routes stay landmark-neutral", () => {
    expect(shell.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(shell.match(/role="main"/g) ?? []).toHaveLength(2);

    for (const route of [
      authenticatedRoute,
      instructorRoute,
      instructorIndex,
      adminRoute,
      adminMessages,
    ]) {
      expect(route).not.toMatch(/<main\b/);
    }
  });

  test("localizes drawer controls and returns focus to the explicit menu trigger", () => {
    expect(shell).toContain('aria-label={t("shell.openMenu")}');
    expect(shell).toContain('aria-label={t("shell.closeMenu")}');
    expect(shell).toContain("menuTriggerRef");
    expect(shell).toContain("onCloseAutoFocus");
    expect(shell).toMatch(/menuTriggerRef\.current\?\.focus\(\)/);
  });

  test("keeps member content above the fixed bottom navigation", () => {
    expect(shell).toContain("--member-bottom-nav-height");
    expect(shell).toMatch(/pb-\[calc\(var\(--member-bottom-nav-height\).*safe-area-inset-bottom/);
  });

  test("marks active links in desktop, drawer, and bottom navigation", () => {
    expect(shell.match(/aria-current=\{active \? "page" : undefined\}/g) ?? []).toHaveLength(3);
  });

  test("preserves the authenticated and role guard contracts", () => {
    expect(authenticatedRoute).toContain("requireAuthenticatedRoute");
    expect(adminRoute).toMatch(/requireRouteRole\(\s*\["admin"\]/);
    expect(instructorRoute).toContain('["instructor"]');
  });

  test("loads and render-gates only the active role namespace before guarded UI", () => {
    for (const [route, role] of [
      [memberRoute, "member"],
      [instructorRoute, "instructor"],
      [adminRoute, "admin"],
    ]) {
      expect(route).toContain(`() => ensureI18nNamespaces(["${role}"])`);
      expect(route).toContain(`use(i18nNamespaceReady("${role}"))`);
      expect(route).toContain("loadAuthorizedRoleNamespace");
      expect(route.indexOf("requireRouteRole")).toBeLessThan(
        route.indexOf("() => ensureI18nNamespaces"),
      );
    }
  });

  test("uses the shared persistent destructive-action contract for class changes", () => {
    expect(existsSync(destructiveActionPath)).toBe(true);
    const destructiveAction = readFileSync(destructiveActionPath, "utf8");
    const dangerZone = readFileSync(dangerZonePath, "utf8");

    for (const prop of ["objectName", "consequence", "confirmLabel", "pendingLabel", "onConfirm"]) {
      expect(destructiveAction).toContain(prop);
    }
    expect(destructiveAction).toContain("PersistentAnnouncement");
    expect(destructiveAction).toContain("onCloseAutoFocus");
    expect(destructiveAction).toContain("pendingRef");
    expect(destructiveAction).toMatch(/if \(pendingRef\.current\) return/);
    expect(dangerZone).toContain("<AdminDestructiveAction");
    expect(dangerZone).toContain("<PersistentAnnouncement");
  });
});
