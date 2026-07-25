# Template approval

Templates have `draft`, `approved`, and `retired` lifecycle states. Approval is unique and
independent for template key, channel, locale, and version. Arabic, Hebrew, and English are
required explicitly; there is no locale fallback.

Before approval, validate that body/subject placeholders exactly match `required_variables`,
render fixtures without unresolved tokens, render Arabic/Hebrew previews with `dir="rtl"`, and
record approver, timestamp, and content hash. Missing variables or approved locale suppress
dispatch and create an attention item.

First-person retention WhatsApp copy additionally requires
`first_person_voice_approved=true`. Draft placeholder copy is never production-ready and all
automations remain non-live until real copy is approved.
