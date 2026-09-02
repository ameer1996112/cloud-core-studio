#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-cloudandcorestudio}"
REGION="${GCP_REGION:-me-west1}"

echo "Cloud Run services"
gcloud run services list --platform=managed --project="$PROJECT_ID" \
  --format="table(metadata.name,status.url,spec.template.metadata.annotations.'autoscaling.knative.dev/minScale':label=MIN,spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale':label=MAX,spec.template.spec.containers[0].resources.limits.cpu:label=CPU,spec.template.spec.containers[0].resources.limits.memory:label=MEMORY,spec.template.spec.containerConcurrency:label=CONCURRENCY,status.traffic[].tag:label=TAGS)"

echo "Cloud Run revisions and traffic tags"
gcloud run revisions list --region="$REGION" --project="$PROJECT_ID" \
  --format="table(metadata.name,metadata.annotations.'autoscaling.knative.dev/minScale':label=MIN,status.conditions[0].status:label=READY)"

echo "Cloud Run jobs"
gcloud run jobs list --region="$REGION" --project="$PROJECT_ID" \
  --format='table(metadata.name,status.executionCount,spec.template.spec.template.spec.taskCount,spec.template.spec.template.spec.timeoutSeconds)'

echo "Scheduler frequencies and targets"
gcloud scheduler jobs list --location="$REGION" --project="$PROJECT_ID" \
  --format='table(name.segment(-1),schedule,state,httpTarget.uri)'

echo "Cloud Tasks queues"
gcloud tasks queues list --location="$REGION" --project="$PROJECT_ID" \
  --quiet \
  --format='table(name.segment(-1),state,rateLimits.maxDispatchesPerSecond,rateLimits.maxConcurrentDispatches,retryConfig.maxAttempts)' || true

echo "Review actual charges in Google Cloud Billing grouped by Service and SKU."
