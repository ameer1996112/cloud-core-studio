-- Update Cloud 10 Entry Card plan to have a 90-day (3 months) validity
UPDATE public.plans
SET duration_days = 90
WHERE description = 'cloud_10_entry_card';
