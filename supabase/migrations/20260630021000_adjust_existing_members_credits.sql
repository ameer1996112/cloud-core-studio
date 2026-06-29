-- Adjust existing active member plans and credits to align with new plan limits
-- 4 credits -> 5 credits for cloud_monthly_1x_week
-- 8 credits -> 10 credits for cloud_monthly_2x_week

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  -- 1. Adjust cloud_monthly_1x_week active plans
  FOR v_rec IN 
    SELECT mp.id, mp.member_id 
    FROM public.member_plans mp
    JOIN public.plans p ON p.id = mp.plan_id
    WHERE p.description = 'cloud_monthly_1x_week' 
      AND mp.status = 'active' 
      AND mp.credits_granted = 4
      AND (mp.expires_at IS NULL OR mp.expires_at > now())
  LOOP
    -- Update credits granted
    UPDATE public.member_plans 
    SET credits_granted = 5 
    WHERE id = v_rec.id;
    
    -- Add 1 credit to the member's balance
    UPDATE public.members 
    SET remaining_credits = remaining_credits + 1 
    WHERE id = v_rec.member_id;
    
    -- Record the adjustment transaction
    INSERT INTO public.credit_transactions (member_id, amount_delta, reason, created_by)
    VALUES (v_rec.member_id, 1, 'adjustment: plan credits updated to 5', '00000000-0000-0000-0000-000000000000'::uuid);
  END LOOP;

  -- 2. Adjust cloud_monthly_2x_week active plans
  FOR v_rec IN 
    SELECT mp.id, mp.member_id 
    FROM public.member_plans mp
    JOIN public.plans p ON p.id = mp.plan_id
    WHERE p.description = 'cloud_monthly_2x_week' 
      AND mp.status = 'active' 
      AND mp.credits_granted = 8
      AND (mp.expires_at IS NULL OR mp.expires_at > now())
  LOOP
    -- Update credits granted
    UPDATE public.member_plans 
    SET credits_granted = 10 
    WHERE id = v_rec.id;
    
    -- Add 2 credits to the member's balance
    UPDATE public.members 
    SET remaining_credits = remaining_credits + 2 
    WHERE id = v_rec.member_id;
    
    -- Record the adjustment transaction
    INSERT INTO public.credit_transactions (member_id, amount_delta, reason, created_by)
    VALUES (v_rec.member_id, 2, 'adjustment: plan credits updated to 10', '00000000-0000-0000-0000-000000000000'::uuid);
  END LOOP;
END $$;
