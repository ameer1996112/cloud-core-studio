Changed files:
- tests/unit/notificationTemplates.test.mjs

Commit hash:
- 93ec8bf

Command run:
- bun test tests/unit/notificationTemplates.test.mjs

Result:
- Expected failure on first WhatsApp copy assertion at line 62 (booking_confirmed smoke assertion), confirming runtime copy still old.

Self-review:
- Scope is limited to tests/unit/notificationTemplates.test.mjs only.
- Existing email/admin assertions were kept unchanged.
- Premium Hebrew variables extended with required fields.
- Exact expected strings from task brief were applied for member-facing WhatsApp templates.
- Runtime files were not modified.
