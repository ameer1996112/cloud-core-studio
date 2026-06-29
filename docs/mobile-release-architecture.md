# Cloud & Core Mobile Release Architecture

## Decision

Cloud & Core V1 should ship as a Capacitor native shell that loads the deployed Cloud & Core web application.

This is intentional. The current app is not a static-only React bundle. It uses TanStack Start server functions for authenticated Supabase operations, admin actions, package requests, payments, reports, messages, and OpenWA integration. A native build that only bundles local static files would lose those server routes and would break core flows.

## V1 Architecture

- Web app: TanStack Start application deployed to a production HTTPS URL.
- Native apps: Capacitor iOS and Android shells pointed at that production URL.
- Native fallback: `native-fallback/index.html` is only an offline/error fallback for native build tooling. It is not the production app UI.
- Backend: Supabase project `banjmspemvzrqckajvwo`.
- Server-only secrets: remain on the deployed web server, never inside the native app.
- Native polish: safe-area viewport, status bar color, splash screen, keyboard handling, and app metadata.

## Store Gate

The native apps are not store-ready until the production web URL is live and stable. The store build must point to that URL, not `localhost`.

Required before App Store / Google Play submission:

- Production domain configured.
- Native sync/build defaults to `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`.
- Native shell is hard-locked to the production Cloud Run URL in `capacitor.config.ts`.
- HTTPS enabled.
- Privacy Policy, Terms, Support, and Account Deletion pages live.
- Demo reviewer account prepared.
- Payments either fully live and tested, or clearly marked as manual/request-based.
- Push notifications disabled unless native permission flows and backend delivery are implemented.

## Future Option

If a fully bundled/offline native app is required later, the server functions must first be moved behind deployed API endpoints or Supabase Edge Functions. That is a larger architecture change and should not block V1.
