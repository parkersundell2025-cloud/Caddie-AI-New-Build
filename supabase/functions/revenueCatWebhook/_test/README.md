# revenueCatWebhook smoke-test payloads

Sample event JSONs for local testing. **Not used by the function at runtime** —
they're checked in so the smoke test is reproducible and so future engineers
can see the exact shape of events we expect.

Run a smoke test against a deployed function:

```bash
SECRET="$(supabase secrets list | awk '$1=="REVENUECAT_WEBHOOK_SECRET"{print $2}')"  # or set manually
URL="https://<project-ref>.supabase.co/functions/v1/revenueCatWebhook"

for f in supabase/functions/revenueCatWebhook/_test/*.json; do
  echo "→ $f"
  curl -s -X POST "$URL" \
    -H "Authorization: $SECRET" \
    -H "Content-Type: application/json" \
    --data @"$f"
  echo
done
```

Each event targets a fictional test user (`verify-rc-…@silexdev.com`) so it
won't collide with real subscribers. Adjust `app_user_id` / `aliases` for your
own seeded test profile.

The dashboard's "Send test event" button on the webhook integration page sends
a `TEST` event — the function acknowledges it with a 200. That's the cleanest
real-traffic smoke test.
