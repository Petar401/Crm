import "server-only";

import Stripe from "stripe";

/**
 * Instantiates a Stripe SDK bound to the given secret key. Kept per-call
 * because keys are per-workspace and we don't want a stale singleton
 * across tenants.
 */
export function stripeFor(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}
