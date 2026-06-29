
CREATE TYPE public.app_role AS ENUM ('member', 'instructor', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE TABLE public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio_short TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read instructors" ON public.instructors FOR SELECT TO authenticated USING (true);

CREATE TABLE public.members (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Member',
  preferred_language TEXT NOT NULL DEFAULT 'en',
  remaining_credits INTEGER NOT NULL DEFAULT 0 CHECK (remaining_credits >= 0),
  attendance_count INTEGER NOT NULL DEFAULT 0 CHECK (attendance_count >= 0),
  last_visit_at TIMESTAMPTZ,
  energy_preference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own row" ON public.members FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Members update own row" ON public.members FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Instructors read members" ON public.members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'instructor') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  waitlist_count INTEGER NOT NULL DEFAULT 0 CHECK (waitlist_count >= 0),
  room TEXT NOT NULL,
  energy TEXT NOT NULL,
  cancellation_window_hours INTEGER NOT NULL DEFAULT 24,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  credit_cost INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'booked',
  credit_cost INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bookings_one_active_per_member ON public.bookings (class_id, member_id) WHERE status = 'booked';
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own bookings" ON public.bookings FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Instructors read class bookings" ON public.bookings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'instructor') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'member') ON CONFLICT DO NOTHING;
  INSERT INTO public.members (id, name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.book_class(p_class_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_class public.classes%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_existing public.bookings%ROWTYPE;
  v_booking_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status','error','message','not_authenticated');
  END IF;
  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','class_not_found');
  END IF;
  SELECT * INTO v_member FROM public.members WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','member_not_found');
  END IF;
  SELECT * INTO v_existing FROM public.bookings
    WHERE class_id = p_class_id AND member_id = v_user AND status = 'booked' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','already_booked','booking_id', v_existing.id,'remaining_credits', v_member.remaining_credits);
  END IF;
  IF v_class.booked_count >= v_class.capacity THEN
    RETURN jsonb_build_object('status','full');
  END IF;
  IF v_member.remaining_credits < v_class.credit_cost THEN
    RETURN jsonb_build_object('status','insufficient_credits','remaining_credits', v_member.remaining_credits);
  END IF;
  INSERT INTO public.bookings (class_id, member_id, status, credit_cost)
    VALUES (p_class_id, v_user, 'booked', v_class.credit_cost)
    RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count = booked_count + 1 WHERE id = p_class_id;
  UPDATE public.members SET remaining_credits = remaining_credits - v_class.credit_cost WHERE id = v_user;
  RETURN jsonb_build_object('status','booked','booking_id', v_booking_id,'remaining_credits', v_member.remaining_credits - v_class.credit_cost);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_booking_id FROM public.bookings
      WHERE class_id = p_class_id AND member_id = v_user AND status = 'booked' LIMIT 1;
    RETURN jsonb_build_object('status','already_booked','booking_id', v_booking_id);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status','error','message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.book_class(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class(UUID) TO authenticated;
