import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const authSource = readFileSync(resolve(root, "src/routes/auth.tsx"), "utf8");
const shellSource = readFileSync(resolve(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const migrationSource = readFileSync(
  resolve(root, "supabase/migrations/20260728233000_sync_signup_preferred_language.sql"),
  "utf8",
);

describe("member language synchronization", () => {
  test("includes the selected app language in new-member signup metadata", () => {
    expect(authSource).toContain("preferred_language: lang");
  });

  test("synchronizes the active app language only for signed-in members", () => {
    expect(shellSource).toContain('if (role !== "member") return;');
    expect(shellSource).toContain("syncMyPreferredLanguage({ data: { preferredLanguage: lang } })");
  });

  test("persists validated signup metadata in the member record", () => {
    expect(migrationSource).toContain("NEW.raw_user_meta_data->>'preferred_language'");
    expect(migrationSource).toContain("IN ('en', 'he', 'ar')");
    expect(migrationSource).toContain("preferred_language");
  });
});
