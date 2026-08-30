# Task 14 Report — Bundle and Core Web Vitals budgets

## Trace-led scope ruling

The first complete local production mobile audit covered `/`, `/auth`, and
`/member/schedule` in HE, AR, and EN. All nine runs passed CLS (0.0011–0.0097),
Lighthouse accessibility (1.0), and serious/critical axe (zero), but LCP failed at
9,528–11,590 ms.

The saved Lighthouse reports and traces identify uncompressed render-blocking CSS as the
specific local-production bottleneck:

- `assets/base-6F7JFr5Q.css`: 377,833 transferred bytes and 7,502–8,702 ms simulated
  render-blocking delay.
- `assets/index-B0GZ7Rzl.css`: 52,993 transferred bytes and 1,652–2,102 ms simulated
  render-blocking delay.
- Actual local TTFB was 2–44 ms, the critical request chain completed in 83–255 ms,
  JavaScript boot work was 122–217 ms, and the LCP phase breakdown was 145–256 ms.

Task 14 therefore adds deterministic Brotli/gzip negotiation to
`scripts/serve-production.mjs`, with a focused compression test. The speculative
`__root.tsx`, reports, messages, and admin console lazy-load targets remain unchanged
because this trace does not identify them as the public-route LCP blocker.

## Intended-DOM validity and second scope ruling

The runner now fails closed unless `/` finishes on the intended auth DOM, `/auth` renders
`main.auth-page`, and `/member/schedule` renders `main.public-safe-page`; it also rejects
the root error boundary explicitly. Runtime variables were loaded read-only from the root
`.env` into the local build/server process without copying, printing, or committing them.
The valid HE diagnostic measured:

- redirected home: LCP 4,841 ms, CLS 0.0658, accessibility 1.0, axe serious/critical 0;
- auth: LCP 4,354 ms, CLS 0.0618, accessibility 1.0, axe serious/critical 0;
- public schedule: LCP 5,607 ms, CLS 0.0097, accessibility 1.0, axe serious/critical 0.

Home/auth LCP is the auth hero. Schedule LCP is the 1,536-byte empty-schedule SVG, whose
713.672 ms discovery delay is real but cannot close a 3.1-second budget gap alone. All
three valid pages still pay for `base-6F7JFr5Q.css` (46,654 transferred / 376,884 decoded,
1,652–1,653 ms blocking) plus `index-B0GZ7Rzl.css` (10,074 / 52,045, 602–603 ms).
Lighthouse estimates only 350–750 ms LCP savings from unused JavaScript.

The next trace-supported change is therefore bounded to `src/styles/base.css`,
`src/styles/member.css`, `src/styles/admin.css`, a new `src/styles/instructor.css`, lazy
`member-shared.css`/`pulse.css` assets owned by `PremiumClassCard`/`StudioPulse`, their three
authenticated route owners, and the Task 14 budget analyzer/config/test. Tailwind
theme/preflight remains root-owned and unique; role sheets generate only their utilities
while referencing the base theme. Task 12's base-first/active-route-second cascade and
shared schedule/AppShell ownership remain authoritative. No root/admin lazy-load target is
in scope. The Task 12 style checker, its ownership manifest, and focused ownership test are
also in scope so the new instructor sheet cannot become an ungoverned loading boundary.

Implementation and final verification evidence will be added below after the rerun.

## Source ownership result and bounded stop

The accepted trace-backed pass makes Tailwind generation source-aware: `base.css` retains
the unique Tailwind theme/preflight, tokens, and every authored cross-role primitive;
member, instructor, and admin route sheets generate scoped utilities against that theme
without a second preflight. The executable Task 12 owner contract now covers the instructor
sheet as well.

A further bounded probe attempted to move authored lesson/member and Studio Pulse blocks
behind component load boundaries. The Task 12 cascade proof correctly failed because
`member-eyebrow`, `member-card`, AppShell frame rules, and CTA primitives are shared by
public/member/admin consumers, and nested CSS imports are not equivalent to the checked
runtime owner order. The probe was reverted in full. The authoritative cascade proof then
returned to 18/18 passing, preserving behavior rather than accepting an attractive but
unsafe byte reduction.

The resulting deterministic production budget evidence is:

- public JavaScript: 1,110,169 raw / 337,917 gzip bytes (limits 1,166,000 / 355,000);
- public CSS closure: 383,966 raw / 55,010 gzip bytes (limits 395,000 / 58,000);
- root CSS: 331,921 raw / 45,449 gzip bytes (limits 350,000 / 50,000);
- largest route chunk: 401,927 raw / 104,851 gzip bytes (limits 415,000 / 110,000);
- total fonts: 622,560 raw / 618,801 gzip bytes (limits 635,000 / 630,000).

The analyzer also rejects representative admin, instructor, and member-role utility
markers if they re-enter the public CSS closure.

The accepted environment-backed HE checkpoint remained intended DOM and measured:

- redirected home: LCP 4,842 ms, CLS 0.0658, accessibility 1.0, axe serious/critical 0;
- auth: LCP 4,279 ms, CLS 0.0618, accessibility 1.0, axe serious/critical 0;
- public schedule: LCP 5,605 ms, CLS 0.0097, accessibility 1.0, axe serious/critical 0.

Direct-auth root CSS fell from 376,884 to 331,921 decoded bytes and from 46,654 to 42,509
transferred bytes. Lighthouse still models 1,502 ms of root-CSS render blocking and 603 ms
for the 52,045-byte Fontsource CSS. The LCP remains the eagerly loaded, high-priority auth
hero and the trace reports no discovery defect.

The only reported unused-JavaScript opportunity is 86,809 bytes and at most 750 ms of LCP
savings. Its top item is the generated TanStack Start client entry (400,736 raw / 122,503
gzip), which contains framework boot and route metadata, not a route-level application
feature. The Supabase client is the next closure contributor (202,100 raw / 51,334 gzip)
and is required by auth session restore and form submission. Even total recovery of the
modeled 750 ms leaves 3,529 ms, above the strict 2,500 ms gate. There is therefore no
trace-supported SSR-compatible JS split capable of meeting the local simulated target.

Per the authorized bounded-pass ruling, no speculative `__root.tsx`, auth flow, home
redirect, schedule illustration, or admin lazy-load edit was made, and the full nine-route
matrix was not rerun after the valid HE checkpoint. The local Lighthouse LCP gate remains
an honest limitation; CLS, accessibility, axe, deterministic bundle budgets, and intended
DOM gates pass.

## Final verification

- Focused Task 12/style/public/admin/Task 14 suite: 104 passed, 0 failed.
- Authoritative cascade suite: 18 passed, 0 failed after rejecting and reverting the unsafe
  authored split.
- Repository unit/integration command: 932 passed, 6 environment-gated integration tests
  skipped, 0 failed across 141 files.
- Production build: passed. Existing TanStack `inputValidator()` deprecation notices remain.
- Bundle budget: passed with the exact byte evidence above.
- Lint: exited successfully with 0 errors and 748 pre-existing warnings.
- Env-backed local Lighthouse HE diagnostic: intended DOM, CLS/accessibility/axe gates pass;
  LCP fails at 4,842 / 4,279 / 5,605 ms as documented. The fail-closed runner exits nonzero.
- Staging/deployment: not run. No staging result or score is claimed.
- Root `.env`: read only into the authorized local build/server process; never copied,
  printed, modified, or committed.

## Independent review fix round 1

All eight review findings were addressed without expanding into speculative UI changes:

- The production server asynchronously precompresses static assets once with bounded
  concurrency. Requests only select cached identity/Brotli/gzip representations; HEAD
  reads no body, byte ranges remain representation-correct, private dot paths return 404,
  and absent API/static paths continue to the SSR handler. Accept-Encoding now honors
  explicit and wildcard quality values, identity defaults and exclusions, and returns 406
  when no representation is acceptable.
- The client Vite manifest is no longer publicly reachable. Build-only audit evidence now
  lives under `dist/audit`, while `/.vite/*` and other private path segments fail closed.
- Lighthouse cleanup awaits SIGTERM exit, escalates to SIGKILL and awaits that exit, attempts
  every cleanup task, and reports cleanup failures without replacing the primary audit error.
- A private Rollup module metadata artifact maps every emitted client chunk to its rendered
  source modules and exports. Public closure analysis now rejects forbidden implementation
  sources inside named, anonymous, shared, or inlined chunks and fails closed on missing
  metadata. TanStack route-registration shells are recorded and exempt only when their sole
  rendered export is `Route`. Moving the admin session-form implementation behind its route
  boundary and splitting public signup notification registration removed the real
  `adminClassFormValidation` and `adminPush.functions` modules from the public closure.
- Role CSS markers are non-vacuous: each configured marker occurs exactly once in its owner
  output and zero times in public CSS. Source-aware generation restores the member-account,
  admin-kids, and Studio Pulse arbitrary-value utilities. Instructor CSS now participates in
  every Task 12 owner, order, equivalence, and immutable-baseline check.
- A custom Lighthouse gatherer captures the live pathname, route marker, error state, and
  `html` language/direction from the same navigation that produces the Lighthouse report.
  This correctly handles the client-side `/` to `/auth` redirect without a second navigation
  and fails closed when its artifact is absent or malformed.

The final deterministic production bundle evidence is:

- public JavaScript: 1,080,858 raw / 330,365 gzip bytes (limits 1,166,000 / 355,000);
- public CSS closure: 383,966 raw / 55,010 gzip bytes (limits 395,000 / 58,000);
- root CSS: 331,921 raw / 45,449 gzip bytes (limits 350,000 / 50,000);
- largest route chunk: 401,859 raw / 104,832 gzip bytes (limits 415,000 / 110,000);
- total fonts: 622,560 raw / 618,801 gzip bytes (limits 635,000 / 630,000).

The authorized bounded environment-backed `home-he` rerun passed exact-navigation validity:
the captured live DOM was `/auth`, `main.auth-page` was present, the root error boundary was
absent, and `html` was Hebrew/RTL. It measured LCP 4,386 ms, CLS 0.0013, Lighthouse
accessibility 1.0, and zero serious/critical axe violations. The runner therefore exits
nonzero solely because LCP remains above the strict 2,500 ms gate. This is retained as an
honest local simulated-performance limitation; no full nine-route rerun, staging run, or
deployment result is claimed in this fix round.

Round-1 verification: 44 focused server/provenance/cascade tests passed; the full suite
passed 944 tests with 6 environment-gated skips and 0 failures across 141 files; the
production build and bundle budget passed; lint completed with 0 errors and 748 existing
warnings. The existing TanStack `inputValidator()` build notices remain unchanged.

## Independent review fix round 2

Rollup module provenance now preserves the complete normalized module identity, including
query and hash suffixes, while canonicalizing both POSIX and Windows path separators. The
route-registry exemption applies only to an exact unsuffixed `src/routes/*` module whose
sole rendered export is `Route`. A `?tsr-split=component` or any other suffixed variant is
therefore checked as implementation code even when its unsuffixed shell is present in the
same anonymous public chunk. The regression fixture exercises exactly that mixed shell and
split-component closure and observes the forbidden-module violation.

One clean, environment-neutral production build followed by one bundle analysis passed with
this canonical evidence:

- public JavaScript: 1,080,857 raw / 330,310 gzip bytes (limits 1,166,000 / 355,000);
- public CSS closure: 383,966 raw / 55,010 gzip bytes (limits 395,000 / 58,000);
- root CSS: 331,921 raw / 45,449 gzip bytes (limits 350,000 / 50,000);
- largest route chunk: 401,859 raw / 104,831 gzip bytes (limits 415,000 / 110,000);
- total fonts: 622,560 raw / 618,801 gzip bytes (limits 635,000 / 630,000).

The small round-1 byte difference was not gzip nondeterminism: that bounded Lighthouse build
explicitly loaded the root runtime environment, so Vite embedded different public build
inputs and emitted different client content/hashes. This round's canonical build did not
load that external environment. `analyzeBundle` measures file contents rather than names,
uses a fixed gzip level, and its focused test proves repeated analysis of identical build
bytes is equal. No budget or threshold changed.

## Independent review fix round 3

The Rollup provenance producer now normalizes the filesystem project root and each Vite
module pathname into a common slash form before containment and relativization. Windows
drive-root comparisons are case-insensitive, retain drive/root boundaries, and cannot
mistake `C:/repository` for a child of `C:/repo`; a different drive also remains absolute.
Query and hash suffixes are split before path comparison and restored byte-for-byte after
normalization.

The focused regression builds metadata for an anonymous public chunk using project root
`C:\repo` and the Vite ID
`C:/repo/src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route`. The producer
emits the repo-relative identity with its complete suffix, and the bundle analyzer rejects
it as forbidden implementation code. Case-varied containment, another drive, and a sibling
path prefix are also asserted.

Verification: 17 focused tests passed; production build and bundle analysis passed; lint
completed with zero errors and the same 748 existing warnings. Bundle evidence remains
public JS 1,080,857 raw / 330,310 gzip, public CSS 383,966 / 55,010, root CSS 331,921 /
45,449, largest route 401,859 / 104,831, and fonts 622,560 / 618,801 bytes. No threshold,
progress record, staging state, or unrelated application code changed.

## Independent review fix round 4

The provenance producer now recognizes normalized UNC roots with both a server and share as
Windows roots. It compares the server, share, and contained path case-insensitively while
retaining exact path-segment boundaries; query and hash suffixes remain untouched. Different
servers, different shares, and sibling prefixes remain absolute and cannot be mistaken for
repository-relative sources.

The focused anonymous-chunk regression uses root `\\SERVER\Share\repo` and Vite ID
`//server/share/repo/src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route`.
The metadata producer emits the full suffixed repo-relative identity and the bundle analyzer
rejects it as forbidden public implementation. Negative other-server, other-share, and
`repository` sibling cases remain absolute.

Verification: 18 focused tests passed; production build and bundle analysis passed; lint
completed with zero errors and 748 existing warnings; formatting and diff checks passed.
Canonical bundle evidence remains public JS 1,080,857 raw / 330,310 gzip, public CSS 383,966
/ 55,010, root CSS 331,921 / 45,449, largest route 401,859 / 104,831, and fonts 622,560 /
618,801 bytes. No threshold or progress record changed.

## Independent review fix round 5

The provenance producer now handles Vite's observed UNC normalization, where an absolute UNC
module ID may arrive with one leading slash even though `fileURLToPath()` retains two on the
configured repository root. When, and only when, the validated project root is UNC and the
single-slash ID's server/share segments match that root case-insensitively at exact segment
boundaries, the producer restores the UNC authority form before containment and
relativization. Ordinary POSIX roots and IDs are not reinterpreted.

The updated anonymous-public-chunk fixture uses the production-shaped ID
`/server/share/repo/src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route`
against `\\SERVER\Share\repo`. It emits the full suffixed repo-relative identity and the
analyzer rejects it. The fixture retains the double-slash contained form and negative other
server, other share, and sibling path cases, and adds a non-UNC POSIX-root guard.

Verification: 18 focused tests passed; production build and bundle analysis passed; lint
completed with zero errors and 748 existing warnings; formatting and diff checks passed.
Canonical bundle evidence remains public JS 1,080,857 raw / 330,310 gzip, public CSS 383,966
/ 55,010, root CSS 331,921 / 45,449, largest route 401,859 / 104,831, and fonts 622,560 /
618,801 bytes. No threshold or progress record changed.
