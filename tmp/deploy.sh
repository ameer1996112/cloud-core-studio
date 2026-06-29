#!/bin/bash
set -e

TAG=$(date -u +%Y%m%d%H%M%S)
IMAGE="me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:$TAG"

echo "Building and deploying image: $IMAGE"

echo "$IMAGE" > tmp/latest-image-to-deploy.txt
echo "$IMAGE" > tmp/latest-deploy-image.txt

echo "==> Running gcloud builds submit..."
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _IMAGE="$IMAGE",_VITE_SUPABASE_PROJECT_ID="banjmspemvzrqckajvwo",_VITE_SUPABASE_URL="https://banjmspemvzrqckajvwo.supabase.co",_VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_teQmj60vBGsYCVxVWFHlVg_i4zawbJJ"

echo "==> Running gcloud run deploy..."
gcloud run deploy cloud-core-studio \
  --image "$IMAGE" \
  --region "me-west1" \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL="https://banjmspemvzrqckajvwo.supabase.co",SUPABASE_PUBLISHABLE_KEY="sb_publishable_teQmj60vBGsYCVxVWFHlVg_i4zawbJJ" \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest

echo "$IMAGE" > tmp/last-deployed-image.txt
echo "==> Deploy complete!"
