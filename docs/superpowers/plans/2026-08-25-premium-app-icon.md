# Cloud & Core Logo-Derived App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the already approved logo-derived PNG as the iOS AppIcon without changing a single production-source byte.

**Architecture:** Treat `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png` as the immutable release source. Pin its digest and complete PNG structure in a failing Bun test, copy it directly into the existing iOS asset catalog, require native-size visual QA before committing the production asset, and validate the clean branch with locked dependencies and a fully isolated unsigned Xcode build.

**Tech Stack:** Bun package manager and test runner, Node.js binary and cryptographic APIs, PNG chunk parsing, macOS `sips` and Preview, SHA-256, Xcode asset catalogs, Xcode command-line build tools, Vite.

**Spec:** `docs/superpowers/specs/2026-08-25-premium-app-icon-design.md`

## Global Constraints

- `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png` is the immutable visual and byte-for-byte production source for this release.
- The approved source SHA-256 is `7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54`.
- The production file is one `1024x1024`, 8-bit, opaque RGB PNG with no alpha channel and no `tRNS` chunk.
- The design is full-bleed warm ivory `#FAF7F2`, with the complete deep navy `#0B1D3A` source emblem and exactly one centered champagne-gold `#D4AF6A` underline.
- Preserve the complete approximately `2.24:1` emblem, including its tiny far-right terminal lobe, at about 70% of canvas width; preserve the underline at about 20% of canvas width.
- Do not redraw, trace, regenerate, transform, optimize, recompress, recolor, or reinterpret the approved PNG.
- Do not create a vector master for this release.
- Do not add text, a tagline, letters, extra dots or dividers, unrelated symbols, effects, transparency, a border, or pre-rounded corners.
- Do not deploy, merge, migrate, upload to App Store Connect, modify the Yoga branch, or change the iOS version/build number.

---

## File Map

- Delete `docs/superpowers/assets/premium-app-icon/core-halo-concepts.png`: the rejected concept board is removed by the documentation revision and must remain absent from the final tree.
- Read `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png`: immutable approved source; never modify it.
- Verify `bun.lock`: install from the frozen lockfile and prove it remains unchanged.
- Create `tests/unit/appIconAsset.test.mjs`: pin the exact catalog entry, approved SHA-256, complete PNG chunk contract, reasonable file size, and byte identity.
- Modify `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: replace it only by a direct binary copy after verifying the approved source digest.
- Verify `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`: keep the existing single universal iOS entry unchanged.

### Task 1: Install the locked dependencies without changing the lockfile

**Files:**

- Verify unchanged: `bun.lock`

**Interfaces:**

- Consumes: the committed Bun lockfile.
- Produces: the exact dependency environment used by every later test and build step.

- [ ] **Step 1: Install from the frozen lockfile and prove repository cleanliness**

Run this block in one shell:

```bash
set -euo pipefail
APP_ICON_LOCK_BEFORE="$(shasum -a 256 bun.lock | awk '{print $1}')"
bun install --frozen-lockfile
APP_ICON_LOCK_AFTER="$(shasum -a 256 bun.lock | awk '{print $1}')"
test "$APP_ICON_LOCK_AFTER" = "$APP_ICON_LOCK_BEFORE"
git diff --exit-code -- bun.lock
test -z "$(git status --porcelain)"
```

Expected: `bun install` exits 0, both lockfile digests match, `bun.lock` has no diff, and the worktree is clean.

### Task 2: Add the digest-pinned AppIcon asset contract test

**Files:**

- Create: `tests/unit/appIconAsset.test.mjs`
- Read: `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png`
- Read: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Read: `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`

**Interfaces:**

- Consumes: the approved source PNG, current iOS AppIcon PNG, and parsed asset-catalog JSON.
- Produces: a Bun test that enforces exact catalog structure, safe PNG structure and encoding, minimum file size, independent approved digests, and byte-for-byte source equality.

- [ ] **Step 1: Create the focused test**

Create `tests/unit/appIconAsset.test.mjs` with exactly this content:

```js
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const approvedPreviewPath = resolve(
  root,
  "docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png",
);
const iconSetPath = resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const productionIconPath = resolve(iconSetPath, "AppIcon-512@2x.png");
const contentsPath = resolve(iconSetPath, "Contents.json");
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const approvedSha256 = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectApprovedPngContract(bytes) {
  expect(bytes.byteLength).toBeGreaterThan(10_000);
  expect(bytes.subarray(0, pngSignature.byteLength)).toEqual(pngSignature);

  let offset = pngSignature.byteLength;
  let ihdr = null;
  let ihdrCount = 0;
  let sawIend = false;

  while (offset < bytes.byteLength) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.byteLength);

    const dataLength = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;

    expect(chunkEnd).toBeLessThanOrEqual(bytes.byteLength);

    const type = bytes.toString("ascii", typeStart, typeStart + 4);
    if (offset === pngSignature.byteLength) {
      expect(type).toBe("IHDR");
    }
    expect(type).not.toBe("tRNS");

    if (type === "IHDR") {
      ihdrCount += 1;
      expect(dataLength).toBe(13);
      ihdr = Buffer.from(bytes.subarray(dataStart, dataEnd));
    }

    offset = chunkEnd;
    if (type === "IEND") {
      expect(dataLength).toBe(0);
      sawIend = true;
      break;
    }
  }

  expect(sawIend).toBe(true);
  expect(offset).toBe(bytes.byteLength);
  expect(ihdrCount).toBe(1);
  expect(ihdr).not.toBeNull();
  expect(ihdr.byteLength).toBe(13);
  expect(ihdr.readUInt32BE(0)).toBe(1024);
  expect(ihdr.readUInt32BE(4)).toBe(1024);
  expect(ihdr[8]).toBe(8);
  expect(ihdr[9]).toBe(2);
}

describe("approved Cloud & Core iOS app icon", () => {
  test("retains exactly one universal 1024px iOS catalog entry", () => {
    const contents = JSON.parse(readFileSync(contentsPath, "utf8"));

    expect(contents).toEqual({
      images: [
        {
          filename: "AppIcon-512@2x.png",
          idiom: "universal",
          platform: "ios",
          size: "1024x1024",
        },
      ],
      info: {
        author: "xcode",
        version: 1,
      },
    });
  });

  test("uses the independently pinned approved RGB bytes", () => {
    const approvedPreviewBytes = readFileSync(approvedPreviewPath);
    const productionIconBytes = readFileSync(productionIconPath);

    expectApprovedPngContract(approvedPreviewBytes);
    expectApprovedPngContract(productionIconBytes);
    expect(sha256(approvedPreviewBytes)).toBe(approvedSha256);
    expect(sha256(productionIconBytes)).toBe(approvedSha256);
    expect(productionIconBytes.equals(approvedPreviewBytes)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the intended red state**

Run:

```bash
bun test tests/unit/appIconAsset.test.mjs
```

Expected: `1 pass`, `1 fail`. The catalog, approved-preview digest, and both PNG structure assertions pass; the production digest assertion reports the current iOS AppIcon does not equal the pinned approved SHA-256. The byte-equality assertion remains in the test and will run after the production digest is corrected.

- [ ] **Step 3: Confirm the red test did not modify either PNG**

Run this block in one shell:

```bash
set -euo pipefail
APPROVED_PREVIEW_SHA256="$(shasum -a 256 docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png | awk '{print $1}')"
CURRENT_PRODUCTION_SHA256="$(shasum -a 256 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png | awk '{print $1}')"
test "$APPROVED_PREVIEW_SHA256" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
test "$CURRENT_PRODUCTION_SHA256" != "$APPROVED_PREVIEW_SHA256"
printf 'approved=%s\ncurrent-production=%s\n' "$APPROVED_PREVIEW_SHA256" "$CURRENT_PRODUCTION_SHA256"
git status --short
test "$(git status --porcelain)" = "?? tests/unit/appIconAsset.test.mjs"
```

Expected: the approved digest is exactly pinned, the current production digest differs, and the new test is the only worktree change.

- [ ] **Step 4: Commit the failing contract test**

Run this block in one shell:

```bash
set -euo pipefail
git add tests/unit/appIconAsset.test.mjs
git diff --cached --check
test "$(git diff --cached --name-only)" = "tests/unit/appIconAsset.test.mjs"
git commit -m "test: pin approved iOS app icon asset"
test -z "$(git status --porcelain)"
```

Expected: one commit containing only the focused test, followed by a clean worktree.

### Task 3: Copy and verify the approved PNG without committing it

**Files:**

- Read: `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png`
- Modify but do not commit yet: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Verify unchanged: `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`

**Interfaces:**

- Consumes: the exact approved PNG and the Task 2 contract test.
- Produces: an uncommitted production iOS AppIcon whose bytes and SHA-256 equal the approved source, ready for mandatory visual QA.

- [ ] **Step 1: Reconfirm the approved source hash**

Run this block in one shell:

```bash
set -euo pipefail
APPROVED_PREVIEW_SHA256="$(shasum -a 256 docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png | awk '{print $1}')"
test "$APPROVED_PREVIEW_SHA256" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
printf '%s\n' "$APPROVED_PREVIEW_SHA256"
```

Expected: the command prints only the pinned approved SHA-256.

- [ ] **Step 2: Copy the approved source byte-for-byte**

Run:

```bash
cp docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

Expected: only the existing production PNG changes. Do not run an image converter, optimizer, renderer, or metadata tool that writes to either source or destination.

- [ ] **Step 3: Prove the focused test, byte identity, and both digests**

Run this block in one shell:

```bash
set -euo pipefail
bun test tests/unit/appIconAsset.test.mjs
cmp -s docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
APPROVED_PREVIEW_SHA256="$(shasum -a 256 docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png | awk '{print $1}')"
PRODUCTION_ICON_SHA256="$(shasum -a 256 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png | awk '{print $1}')"
test "$APPROVED_PREVIEW_SHA256" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
test "$PRODUCTION_ICON_SHA256" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
printf 'approved=%s\nproduction=%s\n' "$APPROVED_PREVIEW_SHA256" "$PRODUCTION_ICON_SHA256"
```

Expected: `2 pass`, `0 fail`; `cmp` exits 0; both independently calculated digests equal the pinned approved SHA-256.

- [ ] **Step 4: Assert that only the uncommitted production asset changed**

Run this block in one shell:

```bash
set -euo pipefail
git diff --exit-code -- ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json
git diff --exit-code -- docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png
test "$(git diff --name-only)" = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
git status --short
```

Expected: only the production AppIcon PNG is modified and remains uncommitted; the catalog JSON and approved source have no diff.

### Task 4: Complete native-size QA before committing the AppIcon

**Files:**

- Read: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Create temporarily under one validated `/tmp` directory: four uncommitted PNG previews.

**Interfaces:**

- Consumes: the verified but uncommitted production AppIcon from Task 3.
- Produces: an explicit recorded visual pass at 29, 40, 60, and 120 px, followed by the production asset commit.

- [ ] **Step 1: Generate, inspect, record, and remove all four QA previews in one persistent shell**

Run this entire block in one shell. Preview opens each file; select **View → Actual Size** for every image, or use the local image viewer's original-detail/100% mode, before entering `PASS`:

```bash
set -euo pipefail
(
  set -euo pipefail
  APP_ICON_QA_DIR="$(mktemp -d /tmp/cloud-core-app-icon-qa.XXXXXX)"
  case "$APP_ICON_QA_DIR" in
    /tmp/cloud-core-app-icon-qa.??????) ;;
    *) exit 1 ;;
  esac

  cleanup_app_icon_qa() {
    case "$APP_ICON_QA_DIR" in
      /tmp/cloud-core-app-icon-qa.??????)
        find "$APP_ICON_QA_DIR" -mindepth 1 -maxdepth 1 -type f -delete
        rmdir "$APP_ICON_QA_DIR"
        ;;
      *) return 1 ;;
    esac
  }
  trap cleanup_app_icon_qa EXIT

  for APP_ICON_QA_SIZE in 29 40 60 120; do
    APP_ICON_QA_FILE="$APP_ICON_QA_DIR/app-icon-$APP_ICON_QA_SIZE.png"
    sips -z "$APP_ICON_QA_SIZE" "$APP_ICON_QA_SIZE" ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png --out "$APP_ICON_QA_FILE"
    APP_ICON_QA_WIDTH="$(sips -g pixelWidth "$APP_ICON_QA_FILE" | awk '/pixelWidth/ {print $2}')"
    APP_ICON_QA_HEIGHT="$(sips -g pixelHeight "$APP_ICON_QA_FILE" | awk '/pixelHeight/ {print $2}')"
    test "$APP_ICON_QA_WIDTH" = "$APP_ICON_QA_SIZE"
    test "$APP_ICON_QA_HEIGHT" = "$APP_ICON_QA_SIZE"
  done

  printf 'QA directory: %s\n' "$APP_ICON_QA_DIR"
  open -W -n -a Preview \
    "$APP_ICON_QA_DIR/app-icon-29.png" \
    "$APP_ICON_QA_DIR/app-icon-40.png" \
    "$APP_ICON_QA_DIR/app-icon-60.png" \
    "$APP_ICON_QA_DIR/app-icon-120.png"
  printf 'Enter PASS only after inspecting every image at Actual Size/100%%: '
  read -r APP_ICON_QA_REVIEW
  test "$APP_ICON_QA_REVIEW" = "PASS"
  printf 'Visual QA: PASS at 29, 40, 60, and 120 px\n'
)
test "$(git status --porcelain)" = " M ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
```

Expected visual result: the complete navy multi-cloud/aerial-loop emblem is recognizable at all four sizes; the ivory field remains clean; the underline stays separate and centered. The gold may be subtle at 29 px and 40 px. The rightmost terminal lobe remains present in the source-derived shape, and no preview introduces an apparent extra dot, divider, or merged mark. The scoped trap removes only the printed QA directory, and the uncommitted AppIcon remains the sole worktree change.

- [ ] **Step 2: Commit the production asset only after the recorded visual pass**

Run this block in one shell:

```bash
set -euo pipefail
git add ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
git diff --cached --check
test "$(git diff --cached --name-only)" = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
git commit -m "feat: install approved iOS app icon"
test -z "$(git status --porcelain)"
```

Expected: one commit containing only the visually approved production AppIcon PNG, followed by a clean worktree.

### Task 5: Run repository and isolated unsigned iOS validation

**Files:**

- Verify: all repository files and the checked-in Xcode project.
- Create temporarily under one validated `/tmp` directory: Xcode DerivedData, SourcePackages, and PackageCache only.

**Interfaces:**

- Consumes: the Task 2 test and the committed, visually approved Task 4 AppIcon.
- Produces: passing automated checks, ignored Capacitor build inputs, and an unsigned simulator build without tracked repository or release-metadata changes.

- [ ] **Step 1: Re-prove the focused icon contract and pinned digests**

Run this block in one shell:

```bash
set -euo pipefail
bun test tests/unit/appIconAsset.test.mjs
cmp -s docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
test "$(shasum -a 256 docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png | awk '{print $1}')" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
test "$(shasum -a 256 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png | awk '{print $1}')" = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54"
test -z "$(git status --porcelain)"
```

Expected: `2 pass`, `0 fail`; `cmp` exits 0; both digests match independently; the worktree remains clean.

- [ ] **Step 2: Run the full Bun test suite**

Run:

```bash
bun run test
```

Expected: exit 0 with no test failures. Tests that require unavailable external integration credentials may report as skipped, following the repository's existing test behavior.

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: exit 0 with no lint errors.

- [ ] **Step 4: Build the web application**

Run:

```bash
bun run build
```

Expected: exit 0 and a successful Vite production build.

- [ ] **Step 5: Generate the ignored Capacitor inputs without changing tracked files**

Run this block in one shell:

```bash
set -euo pipefail
bunx cap sync ios
test -d ios/App/App/public
test -f ios/App/App/capacitor.config.json
test -f ios/App/App/config.xml
git diff --check
test -z "$(git status --porcelain)"
```

Expected: Capacitor sync exits 0; the ignored `public`, `capacitor.config.json`, and `config.xml` build inputs exist; no tracked or untracked repository change is reported.

- [ ] **Step 6: Build the iOS simulator target entirely inside a scoped temporary directory**

Fresh-cache requirement: the block below needs outbound access to the pinned GitHub checkout and release artifacts even though package version updates and automatic re-resolution are disabled. If the runner cannot use that network/Keychain path, preseed only the fresh `SourcePackages` directory from an existing local cache after independently proving that (1) the checkout `HEAD` equals the revision in `Package.resolved` and (2) `swift package compute-checksum` for both cached binary ZIPs equals the checksums declared by that pinned revision's `Package.swift`. Rewrite absolute paths only inside the copied temporary `workspace-state.json`; do not reuse DerivedData or modify the global cache. The restricted-runner validation for this plan used that checksum-verified preseed path, and the same scoped trap removed it afterward.

Run this entire block in one shell. It invokes Xcode only after allocating and validating the isolated directory:

```bash
set -euo pipefail
(
  set -euo pipefail
  APP_ICON_XCODE_DIR="$(mktemp -d /tmp/cloud-core-app-icon-xcode.XXXXXX)"
  case "$APP_ICON_XCODE_DIR" in
    /tmp/cloud-core-app-icon-xcode.??????) ;;
    *) exit 1 ;;
  esac

  cleanup_app_icon_xcode() {
    case "$APP_ICON_XCODE_DIR" in
      /tmp/cloud-core-app-icon-xcode.??????) rm -rf -- "$APP_ICON_XCODE_DIR" ;;
      *) return 1 ;;
    esac
  }
  trap cleanup_app_icon_xcode EXIT

  xcodebuild \
    -project ios/App/App.xcodeproj \
    -scheme App \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath "$APP_ICON_XCODE_DIR/DerivedData" \
    -clonedSourcePackagesDirPath "$APP_ICON_XCODE_DIR/SourcePackages" \
    -packageCachePath "$APP_ICON_XCODE_DIR/PackageCache" \
    -disableAutomaticPackageResolution \
    -onlyUsePackageVersionsFromResolvedFile \
    -skipPackageUpdates \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    build
  git diff --check
  test -z "$(git status --porcelain)"
)
test -z "$(git status --porcelain)"
```

Expected: `** BUILD SUCCEEDED **`; the scoped trap removes only `/tmp/cloud-core-app-icon-xcode.XXXXXX`; the repository remains clean. The command uses isolated DerivedData, SourcePackages, and package-cache paths, locks package versions, disables signing, and does not list through default caches, archive, upload, or change the version/build number.

### Task 6: Confirm isolation and prepare the release handoff

**Files:**

- Verify: branch history and final repository state only.

**Interfaces:**

- Consumes: all completed implementation and validation commits.
- Produces: a scoped handoff report; no deployment or publication action.

- [ ] **Step 1: Assert the expected branch and clean worktree**

Run this block in one shell:

```bash
set -euo pipefail
test "$(git branch --show-current)" = "codex/premium-app-icon"
git diff --check origin/main...HEAD
git status --short --branch
test -z "$(git status --porcelain)"
```

Expected: the branch is `codex/premium-app-icon`, diff check reports no errors, and the worktree is explicitly clean.

- [ ] **Step 2: Assert the final branch scope and rejected-board absence**

Run this block in one shell:

```bash
set -euo pipefail
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
APP_ICON_ACTUAL_FILES="$(git diff --name-only origin/main...HEAD | LC_ALL=C sort)"
APP_ICON_EXPECTED_FILES="$(printf '%s\n' \
  docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png \
  docs/superpowers/plans/2026-08-25-premium-app-icon.md \
  docs/superpowers/specs/2026-08-25-premium-app-icon-design.md \
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
  tests/unit/appIconAsset.test.mjs | LC_ALL=C sort)"
test "$APP_ICON_ACTUAL_FILES" = "$APP_ICON_EXPECTED_FILES"
test ! -e docs/superpowers/assets/premium-app-icon/core-halo-concepts.png
test -z "$(git status --porcelain)"
```

Expected: the branch contains exactly the approved preview, revised design/plan documentation, focused icon test, and production AppIcon; the rejected board is absent. There are no Yoga changes, migrations, deployment files, environment files, generated QA previews, version/build-number changes, or unrelated production code.

- [ ] **Step 3: Report the release boundary**

Report the passing frozen install, focused/full tests, lint, web build, unsigned isolated simulator build, native-size visual review, clean branch status, production/source SHA-256 match, rejected-board absence, and commits created by this plan.

State explicitly: App Store publication requires separately authorized work to create a new iOS build, upload it to App Store Connect, and submit it for review. Do not merge, deploy, migrate, sign, archive for distribution, upload, submit, or modify the Yoga branch as part of this plan.
