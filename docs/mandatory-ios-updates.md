# Mandatory iOS updates

Cloud & Core 1.0.5 build 6 introduces native version reporting through `@capacitor/app`.
The web client checks a public Cloud Run policy at startup and when the app returns to the
foreground.

## Safe release order

1. Keep enforcement disabled while the iOS build is in TestFlight or App Review.
2. Confirm version 1.0.5 is publicly downloadable from the App Store.
3. Enable the minimum version in Cloud Run:

   ```sh
   gcloud run services update cloud-core-studio \
     --project cloudandcorestudio \
     --region me-west1 \
     --update-env-vars IOS_FORCE_UPDATE_ENABLED=true,IOS_MINIMUM_APP_VERSION=1.0.5
   ```

4. Open an older installed build and confirm it shows the App Store gate.
5. Open version 1.0.5 and confirm the app opens normally.

Never set `IOS_MINIMUM_APP_VERSION` above a version that is publicly available in the App
Store. A missing or malformed minimum version disables enforcement automatically.

## Emergency rollback

Disable the gate without shipping another build:

```sh
gcloud run services update cloud-core-studio \
  --project cloudandcorestudio \
  --region me-west1 \
  --update-env-vars IOS_FORCE_UPDATE_ENABLED=false
```

The App Store destination defaults to
`https://apps.apple.com/il/app/cloud-core/id6786035836`. It can be overridden with the
`APP_STORE_URL` Cloud Run environment variable, but only `https://apps.apple.com` URLs are
accepted.
