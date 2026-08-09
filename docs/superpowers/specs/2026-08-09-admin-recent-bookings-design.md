# Admin Recent Bookings Design

## Goal

Make the admin overview's “Active bookings” metric describe current work and make newly created bookings visible without opening individual classes.

## Behavior

- Count a booking as active only when its booking status is `booked` and its class is scheduled in the future.
- Exclude QA/test classes using the app's existing test-record policy.
- Show the six most recently created active bookings on the overview.
- Each recent-booking row shows the member name, localized class title, class date/time, and booking creation time.
- Link each row to the existing class detail page, where staff can manage the roster.
- Keep the existing generic recent-activity panel unchanged.

## Architecture and Data Flow

`adminOverview` will replace its count-only bookings query with a query for booked rows joined to their class and member. The database query will restrict classes to future scheduled classes. A small pure helper will apply the existing QA/test-record filter, sort by booking creation time, and produce both the active count and six-row recent list from the same source. Deriving both values together prevents the metric and list from drifting apart.

The overview route will render a new panel beside recent activity. It will use the existing admin panel and localization patterns and will show a localized empty state when there are no upcoming bookings.

## Error Handling

The server function will treat a bookings-query error like its other required overview queries and throw it rather than returning a misleading zero. Rows missing either their class or member relation will not appear in the recent list; rows without a valid future scheduled class will not contribute to the active count.

## Testing

- Unit-test the pure projection helper before implementation.
- Prove that past booked rows, cancelled classes, missing relations, and QA/test classes are excluded.
- Prove that upcoming scheduled bookings are counted, sorted newest-first, and capped at six.
- Run the focused regression test, the full unit suite, lint, and production build.

## Out of Scope

- A dedicated bookings-management page or navigation item.
- Database migrations or historical status cleanup.
- Changes to member booking, cancellation, attendance, or activity-log behavior.
