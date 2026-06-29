-- Cloud & Core studio packages
-- Canonical plan codes live in description so the UI can localize display copy
-- while the existing plans schema stays unchanged.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.plans WHERE description = 'cloud_monthly_1x_week') THEN
    UPDATE public.plans
       SET name = 'Cloud Monthly 1x Week',
           credits = 4,
           price_cents = 28000,
           currency = 'ILS',
           duration_days = 30,
           active = true,
           updated_at = now()
     WHERE description = 'cloud_monthly_1x_week';
  ELSE
    INSERT INTO public.plans (name, description, credits, price_cents, currency, duration_days, active)
    VALUES ('Cloud Monthly 1x Week', 'cloud_monthly_1x_week', 4, 28000, 'ILS', 30, true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.plans WHERE description = 'cloud_monthly_2x_week') THEN
    UPDATE public.plans
       SET name = 'Cloud Monthly 2x Week',
           credits = 8,
           price_cents = 35000,
           currency = 'ILS',
           duration_days = 30,
           active = true,
           updated_at = now()
     WHERE description = 'cloud_monthly_2x_week';
  ELSE
    INSERT INTO public.plans (name, description, credits, price_cents, currency, duration_days, active)
    VALUES ('Cloud Monthly 2x Week', 'cloud_monthly_2x_week', 8, 35000, 'ILS', 30, true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.plans WHERE description = 'cloud_10_entry_card') THEN
    UPDATE public.plans
       SET name = 'Cloud 10 Entry Card',
           credits = 10,
           price_cents = 70000,
           currency = 'ILS',
           duration_days = 90,
           active = true,
           updated_at = now()
     WHERE description = 'cloud_10_entry_card';
  ELSE
    INSERT INTO public.plans (name, description, credits, price_cents, currency, duration_days, active)
    VALUES ('Cloud 10 Entry Card', 'cloud_10_entry_card', 10, 70000, 'ILS', 90, true);
  END IF;
END $$;
