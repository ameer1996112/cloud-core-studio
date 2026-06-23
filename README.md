# Cloud & Core Studio

Standalone TanStack Start app for Cloud & Core Studio bookings, member self-service, instructor tools, and studio admin operations.

## Setup

```bash
bun install
cp .env.example .env
bun run dev
```

Fill `.env` with the Supabase project URL and publishable key before signing in or calling server functions.

## Checks

```bash
bun run lint
bun run build
```

## Notes

- `.env` is intentionally ignored and must not be committed.
- The app uses TanStack Start, Vite, React, Tailwind CSS, Supabase, and Bun.
- Production builds emit `dist/client` and `dist/server`.
