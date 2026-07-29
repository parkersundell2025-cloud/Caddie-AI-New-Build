-- Phase 3 anti-cheat: session timing foundation.
-- started_at is stamped server-side by the startSession edge function when
-- the user begins a session; duration_minutes computed by logSession at
-- submit. Null on sessions logged by pre-Phase-3 clients (checks skip).
alter table public.session_log
  add column if not exists started_at timestamptz,
  add column if not exists duration_minutes numeric;
