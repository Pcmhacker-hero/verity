import * as stripeLib from './stripe.js';

export const BillingService = {
  createCheckoutSession: stripeLib.createCheckoutSession,
  createCustomerPortalSession: stripeLib.createCustomerPortalSession,
  stripe: stripeLib.stripe,
};
