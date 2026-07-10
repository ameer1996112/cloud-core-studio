import { strict as assert } from "node:assert";
import {
  buildAuthReturnToHref,
  buildProtectedRouteAuthHref,
  buildMemberScheduleReturnTo,
  buildMemberScheduleUrl,
  clearGuestAuthIntent,
  consumeGuestAuthIntent,
  readMemberScheduleClassId,
  resolvePostAuthDestination,
  resolveSafeInternalReturnTo,
  syncGuestScheduleAuthIntent,
} from "../../src/lib/guest-auth-intent.ts";

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

assert.equal(buildMemberScheduleReturnTo(), "/member/schedule");
assert.equal(buildMemberScheduleReturnTo("open-class"), "/member/schedule?classId=open-class");
assert.equal(
  buildAuthReturnToHref("/member/schedule?classId=open-class"),
  "/auth?returnTo=%2Fmember%2Fschedule%3FclassId%3Dopen-class",
);
assert.equal(
  buildProtectedRouteAuthHref("/admin/calendar", "?view=week", "#today"),
  "/auth?returnTo=%2Fadmin%2Fcalendar%3Fview%3Dweek%23today",
);

assert.equal(
  buildMemberScheduleUrl("https://cloudandcorestudio.com/member/schedule", "open-class"),
  "/member/schedule?classId=open-class",
);
assert.equal(
  buildMemberScheduleUrl("https://cloudandcorestudio.com/member/schedule?classId=open-class", null),
  "/member/schedule",
);
assert.equal(
  readMemberScheduleClassId("https://cloudandcorestudio.com/member/schedule?classId=open-class"),
  "open-class",
);
assert.equal(readMemberScheduleClassId("https://cloudandcorestudio.com/member/schedule"), null);

assert.equal(
  resolveSafeInternalReturnTo(
    "/member/schedule?classId=open-class",
    "https://cloudandcorestudio.com",
  ),
  "/member/schedule?classId=open-class",
);
assert.equal(
  resolveSafeInternalReturnTo("https://example.com/pwn", "https://cloudandcorestudio.com"),
  null,
);
assert.equal(
  resolveSafeInternalReturnTo("/auth?mode=forgot", "https://cloudandcorestudio.com"),
  null,
);

{
  const storage = createStorage();
  syncGuestScheduleAuthIntent(storage, "open-class", 1000);

  assert.equal(
    consumeGuestAuthIntent(storage, "https://cloudandcorestudio.com", 1001),
    "/member/schedule?classId=open-class",
  );
  assert.equal(consumeGuestAuthIntent(storage, "https://cloudandcorestudio.com", 1002), null);
}

{
  const storage = createStorage();
  syncGuestScheduleAuthIntent(storage, "open-class", 1000);
  syncGuestScheduleAuthIntent(storage, null, 1001);

  assert.equal(consumeGuestAuthIntent(storage, "https://cloudandcorestudio.com", 1002), null);
}

{
  const storage = createStorage();
  syncGuestScheduleAuthIntent(storage, "open-class", 1000);

  assert.equal(
    resolvePostAuthDestination({
      fallbackTo: "/member",
      origin: "https://cloudandcorestudio.com",
      returnTo: "/member/schedule?classId=full-class",
      storage,
      now: 1001,
    }),
    "/member/schedule?classId=full-class",
  );

  clearGuestAuthIntent(storage);
}

{
  const storage = createStorage();
  syncGuestScheduleAuthIntent(storage, "open-class", 1000);

  assert.equal(
    resolvePostAuthDestination({
      fallbackTo: "/member",
      origin: "https://cloudandcorestudio.com",
      returnTo: null,
      storage,
      now: 1001,
    }),
    "/member/schedule?classId=open-class",
  );
}

console.log("guest auth intent helpers OK");
