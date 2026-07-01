# OpenWA Automation Design

## Summary

Cloud & Core should evolve from the current notification draft/manual workflow into a real automated WhatsApp delivery system that sends from the studio WhatsApp number through OpenWA.

The recommended V1 architecture is:

- keep Cloud Run as the control plane
- keep Supabase as the notification source of truth
- keep the existing draft/template/log foundation
- run OpenWA on the user's personal computer first
- add a lightweight local sender worker on that computer
- let the worker pull pending jobs, send through OpenWA, and report results back

This preserves the existing notification investment while avoiding a premature move to the official WhatsApp API.

## Goals

- Automatically send specific studio WhatsApp messages from the studio number using OpenWA
- Respect quiet hours and never send outside approved hours
- Keep messaging failures from breaking booking, waitlist, package, or class flows
- Maintain a premium, warm, non-robotic member experience
- Preserve a full audit trail of rendered message content and delivery attempts
- Keep hosting cost low in the first rollout

## Non-Goals

- No official WhatsApp Cloud API in this phase
- No Cloud Run-hosted OpenWA session in this phase
- No re-engagement automation in V1
- No milestone automation in V1
- No marketing-blast behavior
- No public inbound tunnel from Cloud Run to the user's personal computer

## Current State

The current repo already supports:

- notification templates
- localized notification rendering
- event-triggered draft generation
- notification logs
- admin message previews
- manual WhatsApp deep-link flow
- manual "mark sent" workflow

The current repo does not yet support:

- actual server-side WhatsApp delivery
- OpenWA-backed automated sending
- retry scheduling
- queued delivery lifecycle
- provider success/failure updates

Direct WhatsApp sending is explicitly disabled in `src/lib/messages.functions.ts`.

## Approved Product Rules

### Send Window

- Automatic WhatsApp delivery is allowed only between `08:00` and `20:30` Israel time
- No automatic message may be sent during quiet hours
- Messages that fall in quiet hours must be delayed to the next allowed send time

### Waitlist Claim Window

- Waitlist spot offer window is `60 minutes`

### No-Package Onboarding

- Do not send a WhatsApp welcome message immediately after signup
- Show soft onboarding in-app after signup
- Send WhatsApp only on the first blocked booking attempt caused by no active package
- Do not repeat the same WhatsApp on every blocked attempt

### Booking Confirmation

- Send a confirmation for every successful booking

### First-Class Follow-Up

- Send once, `3 hours` after the member's first attended class

### Delivery Failure Handling

- If OpenWA is offline or fails temporarily, queue and retry automatically
- If retry attempts expire, mark the notification as failed and surface it in admin

## Approved Automatic Trigger Set

The first automation rollout should include:

1. blocked booking due to no active package
2. booking confirmation
3. 24-hour reminder
4. 2-hour reminder
5. waitlist spot opened
6. studio cancellation
7. class-time change
8. first-class follow-up
9. birthday

The following remain out of scope for this phase:

- milestone messages
- re-engagement messages
- broader custom lifecycle campaigns

## Recommended Architecture

### Control Plane

Cloud Run remains the control plane.

Responsibilities:

- detect notification-worthy product events
- render the final localized message
- create delivery jobs
- enforce scheduling and quiet-hour rules
- expose claim/update endpoints for delivery workers
- power admin visibility and retry actions

### Source of Truth

Supabase remains the source of truth.

Responsibilities:

- store notification rows
- track status transitions
- store rendered content snapshots
- store provider metadata and failure reasons
- support admin activity feeds and retry logic

### Sender Runtime

OpenWA runs on the user's personal computer in V1.

Responsibilities:

- maintain the logged-in WhatsApp Web session for the studio number
- run a local sender worker
- poll for due notifications
- send through OpenWA
- report `sent` or `failed` back to the control plane

### Delivery Direction

Use a pull model, not a push model.

- The local worker polls for work from Cloud Run or Supabase-backed server functions
- Cloud Run never needs to call directly into the user's personal computer

This avoids home-network exposure, public tunnels, IP drift, and brittle inbound connectivity.

## Delivery Lifecycle

### States

Notifications should use this delivery lifecycle:

- `queued`
- `sending`
- `sent`
- `failed`
- `cancelled`
- `skipped`

### State Semantics

- `queued`
  - notification exists and is waiting for send time or worker pickup
- `sending`
  - worker has claimed the job and is attempting delivery
- `sent`
  - OpenWA accepted the send and the worker reported success
- `failed`
  - retries are exhausted or a non-recoverable provider error occurred
- `cancelled`
  - the message became irrelevant before send
- `skipped`
  - business rules decided it should not send

### Retry Policy

Retry only on operational failures such as:

- OpenWA unavailable
- timeout
- temporary API/network issue

Recommended retry cadence:

1. retry after `5 minutes`
2. retry after `15 minutes`
3. retry after `30 minutes`
4. then mark `failed`

Time-sensitive messages must stop retrying when they are no longer useful.

Examples:

- a delayed 2-hour reminder that would land after class start should become `skipped` or `cancelled`
- a waitlist spot alert that misses the 60-minute offer window should become `cancelled`

## Trigger Rules

### Blocked Booking Due To No Package

- Trigger when a member tries to book and is blocked because there is no active package
- Send only on the first blocked booking attempt
- Only send if the member still has no active package when the job becomes due
- If they purchase a package before send, mark the job `skipped`

### Booking Confirmation

- Trigger after every successful booking
- One notification per successful booking

### 24-Hour Reminder

- Schedule relative to class start time
- If the planned send time falls in quiet hours, delay to the next allowed time
- If the delayed send is no longer useful, skip it

### 2-Hour Reminder

- Same quiet-hours rule as all other messages
- Never break quiet hours
- If delaying makes the reminder too late to matter, skip it

### Waitlist Spot Opened

- Trigger when a member is offered a waitlist spot
- Offer window is `60 minutes`
- If not claimed in time, move to the next eligible person

### Studio Cancellation And Class-Time Change

- Trigger automatically when those product events happen
- Respect allowed send hours even for operational urgency
- If the event occurs during quiet hours, send at the next allowed time

This is intentionally user-preference-driven even though it can delay urgent notices.

### First-Class Follow-Up

- Trigger only after the member's first attended class
- Schedule `3 hours` after attendance is recorded
- Send only once in the member lifetime

### Birthday

- Trigger once on the member's birthday
- Respect allowed send hours
- Message tone should be personal first, offer second

## Data Model Changes

Reuse `notification_logs` as the main delivery table. Do not create a parallel WhatsApp job table unless operational scale later forces that separation.

Ensure `notification_logs` supports:

- `scheduled_for`
- `status`
- `provider`
- `provider_message_id`
- `attempt_count`
- `last_attempt_at`
- `next_attempt_at`
- `error_message`
- `sent_at`
- `generated_text`
- `subject`
- `language`
- `idempotency_key`
- `staff_visibility`

If some of these already exist, keep them and normalize behavior around them rather than duplicating fields.

## Provider Model

Use a provider abstraction now.

Supported provider values should include at least:

- `openwa`
- `manual`
- `official_whatsapp`

V1 uses:

- `openwa` for automatic WhatsApp delivery
- `manual` for admin override/manual sending

This keeps the system ready for a future switch to the official WhatsApp API without redesigning product flows.

## Server Responsibilities

Add or normalize server-side capabilities for:

- enqueueing notification jobs
- calculating allowed send times
- claiming due jobs for a provider
- marking a job `sending`
- marking a job `sent`
- marking a job `failed`
- computing retry schedule
- cancelling or skipping obsolete jobs

Suggested server function surface:

- `enqueueNotification`
- `claimPendingNotifications`
- `markNotificationSent`
- `markNotificationFailed`
- `retryNotificationNow`

Naming can follow existing repo conventions, but behavior should match this model.

## Local Worker Responsibilities

The local OpenWA worker should:

1. authenticate securely
2. poll on an interval, for example every minute
3. claim a small batch of due `queued` OpenWA notifications
4. send each through local OpenWA
5. report success or failure back
6. avoid duplicate sending through claim/lock semantics

The worker should never render business copy itself. It should send the already-rendered message from the control plane.

## Security Model

V1 security requirements:

- do not expose the user's personal machine as a public unauthenticated endpoint
- require authenticated worker access to claim/send/update jobs
- restrict worker credentials to the minimum delivery scope
- log every send attempt
- store provider message ids when available
- never allow arbitrary public creation of WhatsApp sends

## Admin Behavior

The admin experience should show:

- `queued`
- `sending`
- `sent`
- `failed`
- `skipped`
- `cancelled`

For failed rows, staff should have:

- retry now
- open WhatsApp manually
- copy rendered message

Each row should show:

- member
- event type
- scheduled time
- sent time
- rendered content snapshot
- provider
- failure reason when relevant

## Business Isolation Rule

Messaging must stay isolated from core product actions.

This is a hard rule:

- booking success must not depend on WhatsApp success
- package logic must not depend on WhatsApp success
- waitlist logic must not depend on WhatsApp success
- cancellation logic must not depend on WhatsApp success

Notification delivery is support infrastructure, not the source of truth for business state.

## Implementation Sequence

Recommended implementation order:

1. normalize `notification_logs` schema for queued automation
2. add provider-aware enqueue/claim/update server functions
3. add trigger wiring for the approved automatic trigger set
4. build the local OpenWA sender worker
5. add admin retry/failure controls
6. run end-to-end validation with the user's personal computer as the sender host

## Testing Strategy

Required coverage:

- unit tests for scheduling and quiet-hour calculations
- unit tests for trigger deduplication rules
- unit tests for retry progression
- unit tests for skip/cancel logic when a message is no longer useful
- integration tests for enqueue-on-event behavior
- local end-to-end dry run with OpenWA connected but controlled

Specific cases to test:

- first blocked booking only
- booking confirmation for every successful booking
- 24-hour reminder delayed out of quiet hours
- 2-hour reminder skipped when delayed too long
- waitlist offer expiry after 60 minutes
- first-class follow-up only once
- birthday only once per year
- OpenWA offline queue + retry + failed transition

## Rollout Plan

### Phase 1

- OpenWA runs on the user's personal computer
- real automatic sends for the approved trigger set
- admin visibility and retry

### Phase 2

- move OpenWA to a cheap always-on VM
- keep the same provider contract

### Phase 3

- optionally add official WhatsApp API for higher-reliability or compliance-sensitive flows

## Final Recommendation

The right path is not to replace the existing notification system.

The right path is to evolve it into:

- queued automation
- OpenWA as a real provider
- local worker pull model
- strict quiet-hour rules
- operational-first trigger set

This achieves the user's stated end goal of automatic studio-number WhatsApp delivery while keeping cost low and preserving an upgrade path for future provider changes.
