# Production deploy report

- Date: 2026-07-29
- Source branch: `main`
- Audited fix commit: `dea75f673921a7dbc85c898b899081fc07d140f9`
- Released `main` commit: `306619eb98b50210229dc4ab9da8e6ecc4f3bbb5`
- Push: `origin/main` advanced from `28ef01c` to `dea75f6`
- Cloud Build: `60cebe83-5ae6-49fd-aef8-b53d83db78d1`
- Cloud Build status: `SUCCESS`
- Image digest: `sha256:c7216f53a353f6886311c5093ffd90818e5351131a2dbf92825d102eab895da3`
- Cloud Run revision: `cloud-core-studio-00422-sff`
- Production traffic: 100% to the latest revision
- Production URL: https://cloudandcorestudio.com

## Verification

- `/auth` returned HTTP 200 through Google Frontend.
- The 390×844 Hebrew auth page rendered immediately with no horizontal overflow.
- Body text measured 16px and the minimum audited interactive target measured 44px.
- The Arabic checkout rendered all live plan names and descriptions without an English plan-copy leak.
- Browser console/error checks returned no errors.

Two signup-consent commits landed on `main` while the audited fix image was deploying.
The final release therefore uses the later successful `main` image, which contains
`dea75f6` as an ancestor.

## Pipeline note

The `deploy-main-branch` Cloud Build trigger builds and publishes the container image.
`cloudbuild.yaml` does not deploy that image to Cloud Run, so this release used an
explicit `gcloud run deploy` followed by `gcloud run services update-traffic --to-latest`.
