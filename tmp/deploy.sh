#!/bin/bash
set -e

TAG=$(date -u +%Y%m%d%H%M%S)
IMAGE="me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:$TAG"
RUNTIME_ENV="SUPABASE_URL=https://banjmspemvzrqckajvwo.supabase.co,SUPABASE_PUBLISHABLE_KEY=sb_publishable_teQmj60vBGsYCVxVWFHlVg_i4zawbJJ,APP_STORE_URL=https://apps.apple.com/il/app/cloud-core/id6786035836,GOOGLE_PLAY_URL=,HYP_PAY_BASE_URL=https://pay.hyp.co.il/p/,HYP_TERMINAL_NUMBER=4502357839,HYP_PUBLIC_BASE_URL=https://cloudandcorestudio.com,HYP_MODE=live,HYP_RECURRING_MODE=hyp_managed_hk,WHATSAPP_NOTIFICATION_PROVIDER=official_whatsapp,META_GRAPH_API_VERSION=v25.0,META_WABA_ID=1009561255148806,META_WHATSAPP_PHONE_NUMBER_ID=1251794674676123,APNS_ENV=production,APNS_KEY_ID=YCM54MXKT9,APNS_TEAM_ID=GMNK33H8Z4,APNS_BUNDLE_ID=com.cloudandcore.studio"
RUNTIME_SECRETS="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,HYP_API_USER=HYP_API_USER:latest,HYP_API_PASSWORD=HYP_API_PASSWORD:latest,APNS_PRIVATE_KEY=APNS_PRIVATE_KEY:latest"

for SECRET_NAME in META_ACCESS_TOKEN WHATSAPP_WEBHOOK_VERIFY_TOKEN WHATSAPP_APP_SECRET NOTIFICATION_AUTOMATION_TOKEN SUBSCRIPTION_AUTOMATION_TOKEN HYP_RELAY_URL HYP_RECURRING_TERMINAL_NUMBER HYP_RENEWAL_TERMINAL_NUMBER HYP_SOFT_TERMINAL_NUMBER HYP_TOKEN_OWNER_TERMINAL_NUMBER HYP_TOKEN_OWNER_TERMINAL HYP_TOWNER HYP_RECURRING_API_PASSWORD HYP_RECURRING_PASSP HYP_RENEWAL_API_PASSWORD HYP_RENEWAL_PASSP; do
  if gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
    RUNTIME_SECRETS="$RUNTIME_SECRETS,$SECRET_NAME=$SECRET_NAME:latest"
  fi
done

echo "Building and deploying image: $IMAGE"

echo "$IMAGE" > tmp/latest-image-to-deploy.txt
echo "$IMAGE" > tmp/latest-deploy-image.txt

echo "==> Running gcloud builds submit..."
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _IMAGE="$IMAGE",_VITE_SUPABASE_PROJECT_ID="banjmspemvzrqckajvwo",_VITE_SUPABASE_URL="https://banjmspemvzrqckajvwo.supabase.co",_VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_teQmj60vBGsYCVxVWFHlVg_i4zawbJJ",_VITE_APNS_ENV="production"

echo "==> Running gcloud run deploy..."
gcloud run deploy cloud-core-studio \
  --image "$IMAGE" \
  --region "me-west1" \
  --allow-unauthenticated \
  --min-instances "1" \
  --set-env-vars="$RUNTIME_ENV" \
  --set-secrets="$RUNTIME_SECRETS"

gcloud run services update-traffic cloud-core-studio \
  --region "me-west1" \
  --to-latest

echo "$IMAGE" > tmp/last-deployed-image.txt
echo "==> Deploy complete!"
