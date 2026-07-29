import { z } from "zod";

export const checkoutConsentSchema = z.object({
  termsAccepted: z.literal(true),
});

export type CheckoutConsent = {
  termsAccepted: boolean;
};
