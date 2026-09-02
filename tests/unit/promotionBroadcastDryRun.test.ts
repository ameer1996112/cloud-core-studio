import { expect, test } from "bun:test";
import { dispatchDuePromotions } from "../../src/lib/promotionBroadcast.server";

test("promotion dry-run does not activate campaigns or contact the database or providers", async () => {
  // No database/provider credentials or network fixtures are configured here.
  // A shadow notification pass must return before any external operation.
  expect(await dispatchDuePromotions({ dryRun: true })).toEqual([]);
});
