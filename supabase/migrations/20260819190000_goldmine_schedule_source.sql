-- Read-only, customer-safe schedule projection for the GoldMine service endpoint.
-- Authentication is enforced by the application route; this function remains
-- restricted to the server-side service_role and never returns booking identity.

CREATE OR REPLACE FUNCTION public.goldmine_schedule_source_rows(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_limit integer DEFAULT 201
)
RETURNS TABLE (
  external_session_id uuid,
  title text,
  program_type_slug text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  member_visible boolean,
  program_type_active boolean,
  age_groups text[],
  capacity integer,
  confirmed_booking_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '5s'
AS $$
  SELECT
    c.id AS external_session_id,
    c.title,
    pt.slug AS program_type_slug,
    c.starts_at,
    c.starts_at + make_interval(mins => c.duration_minutes) AS ends_at,
    c.status,
    c.member_visible,
    pt.active AS program_type_active,
    pt.age_groups,
    c.capacity,
    count(b.class_id) FILTER (WHERE b.status = 'booked') AS confirmed_booking_count
  FROM public.classes AS c
  JOIN public.program_types AS pt
    ON pt.id = c.program_type_id
  LEFT JOIN public.bookings AS b
    ON b.class_id = c.id
   AND b.status = 'booked'
  WHERE c.starts_at >= p_start_at
    AND c.starts_at >= now()
    AND c.starts_at < p_end_at
    AND c.status = 'scheduled'
    AND c.member_visible = true
    AND pt.active = true
    AND pt.age_groups @> ARRAY['adults']::text[]
  GROUP BY c.id, pt.id
  ORDER BY c.starts_at ASC, c.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 201), 1), 501);
$$;

REVOKE ALL ON FUNCTION public.goldmine_schedule_source_rows(timestamptz, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goldmine_schedule_source_rows(timestamptz, timestamptz, integer)
  TO service_role;

COMMENT ON FUNCTION public.goldmine_schedule_source_rows(timestamptz, timestamptz, integer) IS
  'Bounded read-only GoldMine schedule projection; aggregates active bookings without booking or member identity.';
