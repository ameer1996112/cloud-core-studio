# WhatsApp Template Automation

This workflow creates Hebrew utility message templates for Cloud & Core Studio through the official Meta Graph API. It never sends WhatsApp messages and it never deletes or recreates existing templates.

## Required Meta Access

The access token must belong to a Meta app/user or system user with access to the Cloud & Core WhatsApp Business Account.

Required permissions:

- `whatsapp_business_management`
- `whatsapp_business_messaging`

The token must be able to call:

- `GET /{WABA_ID}/message_templates`
- `POST /{WABA_ID}/message_templates`

## Local Env

Create a local file named `.env.whatsapp.local`. This file is ignored by git.

```bash
META_GRAPH_API_VERSION="v25.0"
META_WABA_ID="your_whatsapp_business_account_id"
META_ACCESS_TOKEN="your_meta_access_token"
```

Do not commit this file or paste the token in logs.

## Dry Run

Dry-run validates all local JSON templates. It does not create templates.

```bash
bun run whatsapp:templates:dry-run
```

If the env vars are present, the script also fetches existing templates and reports which ones would be skipped. If env vars are missing, dry-run still validates local files without calling Meta.

To validate or create only one template:

```bash
bun run whatsapp:templates:dry-run -- --only=booking_confirmed_he
bun run whatsapp:templates:create -- --only=booking_confirmed_he
```

## Create Templates

```bash
bun run whatsapp:templates:create
```

Behavior:

- reads all JSON files under `whatsapp/templates/he`
- validates Hebrew `UTILITY` template structure
- fetches existing templates from Meta
- skips existing templates by default and prints their current status
- creates only missing templates
- prints created, skipped, failed, and pending approval results

The script does not recreate or delete templates.

Before creating templates, the script prints the selected WABA and its phone status. If Meta returns `WABA not allowed to manage templates`, check that `META_WABA_ID` points at the Cloud API WABA, not an old on-premise WhatsApp account. A phone showing `platform=ON_PREMISE`, `status=DISCONNECTED`, or `code=NOT_VERIFIED` is not ready for production Cloud API template management.

If Meta returns `Permissions error` while status checks still work, regenerate the access token from the app/business that owns the selected WABA and make sure the user or system user has full WhatsApp management access for that WABA.

## Check Status

```bash
bun run whatsapp:templates:status
```

The status script prints:

- template name
- language
- category
- status
- rejection reason when Meta returns one

It exits non-zero only for API/auth failures. Pending templates are not treated as failures.

## Rejections

If Meta rejects a template:

1. Run `bun run whatsapp:templates:status`.
2. Read the rejection reason.
3. Edit the matching JSON file.
4. Create a new template name if Meta does not allow editing the rejected one.
5. Rerun dry-run before creating again.

Do not switch rejected utility templates to marketing templates unless the business use case really changed.

## Template Names And App Events

Approved V1 templates map to the app notification event scope:

| App event                  | WhatsApp template             |
| -------------------------- | ----------------------------- |
| `booking_confirmed`        | `booking_confirmed_he`        |
| `payment_confirmed`        | `payment_confirmed_he`        |
| `class_reminder_24h`       | `class_reminder_24h_he`       |
| `waitlist_spot_available`  | `waitlist_spot_available_he`  |
| `class_cancelled_by_admin` | `class_cancelled_by_admin_he` |
| `class_time_changed`       | `class_time_changed_he`       |

Keep this mapping stable when wiring official WhatsApp sending into `notification_logs`.
