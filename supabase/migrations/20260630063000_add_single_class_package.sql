-- Add/update the single-class drop-in package without changing schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.plans WHERE description = 'single_class') THEN
    UPDATE public.plans
       SET name = 'Single Class',
           credits = 1,
           price_cents = 8000,
           currency = 'ILS',
           duration_days = 14,
           active = true,
           updated_at = now()
     WHERE description = 'single_class';
  ELSE
    INSERT INTO public.plans (name, description, credits, price_cents, currency, duration_days, active)
    VALUES ('Single Class', 'single_class', 1, 8000, 'ILS', 14, true);
  END IF;
END $$;
