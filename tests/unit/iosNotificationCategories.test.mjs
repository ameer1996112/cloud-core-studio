import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("iOS notification categories", () => {
  test("registers every server category and branded action at launch", async () => {
    const source = await readFile("ios/App/App/AppDelegate.swift", "utf8");
    for (const category of [
      "CC_CLASS_UPDATE",
      "CC_BOOKING_ACTIONS",
      "CC_OPEN_CLASS",
      "CC_WAITLIST_OFFER",
      "CC_ACCOUNT_ACTION",
      "CC_RECEIPT",
      "CC_STAFF_REPLY",
      "CC_NOTIFICATION",
    ]) {
      expect(source).toContain(category);
    }
    for (const action of [
      "view_class",
      "claim_spot",
      "book_now",
      "choose_package",
      "fix_payment",
      "view_receipt",
      "contact_studio",
      "reply",
    ]) {
      expect(source).toContain(action);
    }
    expect(source).toContain("UNUserNotificationCenter.current().setNotificationCategories");
  });
});
