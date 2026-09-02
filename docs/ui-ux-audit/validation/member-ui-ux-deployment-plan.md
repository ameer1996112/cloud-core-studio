# Member UI/UX milestone 2 deployment plan

- Provider: Google Cloud Build → Artifact Registry → Cloud Run.
- Production project/service/region: `cloudandcorestudio` / `cloud-core-studio` / `me-west1`.
- Build manifest: `cloudbuild.yaml`; image is tagged with Cloud Build `$COMMIT_SHA`.
- Release source: the clean scoped commit recorded immediately before submission; it must match the deployed image tag.
- Preview: no isolated preview workflow for this application is documented. The separate staging manifest is explicitly out of scope and will not be used.
- Production method: fast-forward `main` without force to the exact tested commit; existing global Cloud Build trigger `deploy-main-branch` (`cbcce07f-33ed-4d05-a484-7c9cdc6bb100`) runs `cloudbuild.yaml`; then verify the Cloud Run revision and traffic.
- Rollback: move Cloud Run traffic back to the immediately previous healthy revision. Current known healthy target before release verification: `cloud-core-studio-00479-9pk`.
- Smoke plan: public read-only checks for `/`, `/auth`, public `/checkout`, language switching/direction, assets, 390 × 844 overflow, 1440 × 900 layout, console, Cloud Build and Cloud Run logs. No production member is created and no payment/deletion/booking mutation is submitted.

The deployment result records the exact release SHA, build ID, revision, previous revision, traffic, smoke result, and rollback status. No migration or environment/configuration change is part of this release.
