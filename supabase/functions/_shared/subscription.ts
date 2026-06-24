// Server-side mirror of `hasProAccess` from src/lib/subscription.js.
// Active trials count as Pro (the "try before you buy" pattern) — keep this
// in sync with the client helper or trial users will get 403 from Pro
// features that the client UI happily renders.

// deno-lint-ignore no-explicit-any
type Profile = { subscription_status?: string | null; trial_end_date?: string | null } & Record<string, any>;

export function hasProAccess(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status === 'pro') return true;
  if (profile.subscription_status === 'trial') {
    if (!profile.trial_end_date) return false;
    return new Date(profile.trial_end_date).getTime() > Date.now();
  }
  return false;
}
