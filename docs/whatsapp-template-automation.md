# WhatsApp template automation

The authoritative v2 workflow is documented in [Unified Messaging System](./unified-messaging-system.md#template-catalog-and-provisioning).

The template catalog is immutable application code in `src/lib/messageTemplateCatalog.ts`. Generated Meta JSON lives under `whatsapp/templates/v2/{he,ar,en}`. The current v2 catalog contains 19 semantic names and 57 locale variants. The welcome template is `UTILITY`; recommendation and personal-return templates are `MARKETING`. The legacy v1 JSON remains untouched for rollback/history.

Safe commands:

```sh
bun run whatsapp:templates:check
bun run whatsapp:templates:plan
bun run whatsapp:templates:status
```

`check` is local-only. `plan` is read/reconcile only and uses paginated Meta lookup when credentials exist. Neither command sends customer messages, deletes templates, or creates templates.

Creation is intentionally difficult and requires separate authorization:

```sh
bun run whatsapp:templates:apply
```

Apply refuses any WABA other than `1009561255148806`, requires a Supabase-backed WABA lease, creates sequentially, and reconciles after errors. Exact content is skipped. Same-name content drift requires a new version; it is never updated or deleted in place.

Required Meta access is `whatsapp_business_management` and `whatsapp_business_messaging` through a permanent system-user token attached to the correct business/WABA. Never commit `.env.whatsapp.local` or copy tokens into logs.

The 35 existing Meta rows—including nine duplicate pairs and the incorrectly categorized Hebrew waitlist row—are intentionally out of scope and must remain untouched.
