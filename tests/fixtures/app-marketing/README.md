# App-marketing capture fixture

This Vite entry is capture-only and is never part of the production route tree or build.
It reuses the real `VisualClassCard`, `ScheduleDaySection`, `ClassArtTile`, and
`LessonAvailabilityMeter` presentation primitives plus the application style tokens.
The class-detail layout stays local because the production sheet is coupled to member
data loaders.

Verify the pinned, non-production capture runtime:

```sh
bun run marketing:capture-assets:check
```

Verify exact PNG reproduction across two independent Vite and Chromium processes:

```sh
bun run marketing:capture-assets:stability-check
```

Normal generation uses the same two-process comparison and only atomically replaces
the checked-in assets and manifest after all 18 hashes match.

Bootstrap a missing local runtime deliberately (the capture script never downloads it):

```sh
python3 -m pip install -r tests/fixtures/app-marketing/requirements.txt
python3 -m playwright install chromium
```

After inspecting generated PNGs, create the separate hash-bound attestation:

```sh
bun run marketing:capture-assets:approve -- --reviewer "Your Name" --reviewed-at YYYY-MM-DD
```
