# Monthly Lab Putter Giveaway — working doc

Source: Parker's email 2026-08-05. Rules below are HIS DRAFT, marked
"PENDING LEGAL REVIEW" — do not publish until he confirms legal sign-off.

## Locked decisions (Parker, 2026-08-05)
- Free trials do NOT count as subscribed for entry eligibility
- Winner must still be an active PAID subscriber at draw time (else redraw)
- Giveaway promoted on website + video ONLY — deliberately NOT in-app
  (keeps Apple 5.3.x surface minimal; revisit if he wants in-app promo)
- RECURRING MONTHLY, not a one-off: entry period = calendar month

## Still TO BE FINALIZED by Parker (chase these)
- Entry action: "[1 practice session and/or 1 round]" — which, and how many
- Bonus entries (4c): +5 comment / +5 follow, cap 10 — cap + mechanics TBD
- Legal review of the rules text
- Promo video may be rescripted for entry mechanics (his side, non-blocking)

## Build checklist (ours)
- [ ] caddieaiapp.com/giveaway page: rules text + free-entry form
      (form = one free entry/person/period; email dedupe)
- [ ] Entrant query: active paid subs (basic=1, pro=3 entries) with the
      qualifying activity in-period; EXCLUDE: trials, comped accounts
      (account_flag IS NOT NULL), activity with pending/ignored
      flagged_session or flagged_round
- [ ] Bonus-entry reconciliation: social actions are OUTSIDE our data —
      needs a handle field on the form + manual list from whoever runs
      social; merged at draw time
- [ ] Freeze protocol: run entrant query at period close, save output
      (tier locked at close); draw within 7 days per rules
- [ ] Draw: documented repeatable script over the merged weighted list
- [ ] Pre-draw fraud pass: manual review of entrants' qualifying activity
- [ ] Winner-still-active check at draw time (rules §5)
- NOTE: recurring monthly → the "manual first run" plan holds for month 1,
  but tooling (entries table/admin view) becomes worth quoting from month 2

## Interactions with existing systems
- Monthly cadence overlaps the leaderboard monthly winner
  (processMonthlyWinner — still needs its scheduler; two monthly prize
  programs will run side by side)
- Anti-cheat (Phase 3) directly guards the entry action if sessions count

## LAUNCH BUILD (2026-08-06) — DONE, pending commit + merge
- `giveaway_entry` table (migration 20260806235521): anon INSERT / admin-only
  read (mirrors waitlist_email); unique(lower(email), entry_period) dedupes
  free entries at DB level.
- `/giveaway` public page (src/pages/Giveaway.jsx, routed in App.jsx public
  block): prize blurb, NO PURCHASE NECESSARY, both entry paths explained,
  free-entry form (name/email/social handle) → direct anon insert (no
  .select(), catches 23505 as "already in"), collapsible full official rules
  (Parker's blessed text), Apple non-sponsor disclaimer, Meta Lead pixel.
- Verified (Playwright): loads without auth, entry → "You're entered",
  duplicate → "already in". Test entry cleaned.
- GOES LIVE ON MERGE TO MAIN (web-only, no app release). Must be live before
  Saturday's video → target Friday.

## STILL TO DO (end-of-August, NOT launch-critical)
- Entrant query (subscribers: basic=1/pro=3 with qualifying activity,
  exclude trials/comped/flagged) + free-entry list + social bonus list merge
- Draw script (documented, repeatable) + pre-draw fraud pass + winner-active
  check. Qualifying-activity definition still TBD by Parker.
