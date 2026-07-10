import { strict as assert } from "node:assert";
import { formatStudioDateTimeInput, studioDateTimeInputToIso } from "../../src/lib/studio-time.ts";

const studioTime = "2026-07-08T18:00";
const iso = studioDateTimeInputToIso(studioTime);

assert.equal(iso, "2026-07-08T15:00:00.000Z");
assert.equal(formatStudioDateTimeInput(iso), studioTime);

console.log("studio time helpers OK");
