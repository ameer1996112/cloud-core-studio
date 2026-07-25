# Data model

Every new table is scoped by `studio_id`.

- Identity/permission: `studios`, `communication_recipients`,
  `participant_relationships`, `consent_records`.
- Event/workflow: `domain_outbox`, `journey_instances`, `journey_intents`,
  `concierge_decisions`.
- Coordination: `recipient_contact_state`, `frequency_reservations`.
- Governance: `automation_config_versions`, `concierge_channel_controls`,
  `concierge_template_versions`.
- Evidence/delivery: `message_snapshots` and the extended existing
  `message_deliveries`, attempts, and webhook tables.
- Business workflows: `inactivity_episodes`, `weekly_schedule_campaigns`,
  `lead_journeys`, `admin_attention_items`.

A child relationship is valid only with an authorized adult recipient in the same studio. The
database trigger rejects self-recipient, non-adult, and unauthorized kid relationships.
Existing members are safely backfilled as self-recipients. Existing kid guardian text is not
automatically promoted to an authorized identity.
