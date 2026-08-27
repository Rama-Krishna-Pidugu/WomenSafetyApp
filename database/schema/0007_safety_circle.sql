-- 0007_safety_circle.sql
-- Safety Circle / Trusted Contact System.
--
-- NOTE on placement: emergency_contacts/users/devices/notifications are NOT part of the
-- profiles/incidents family tracked in 0001_core.sql..0006_timeline.sql (those use
-- Supabase Auth `auth.uid()` + RLS). emergency_contacts/users/devices/notifications are a
-- separate table family that the FastAPI backend (app/repositories/*.py) accesses with the
-- service_role key and its own Firebase-token-based `user_id` filtering in Python — there is
-- no tracked schema file for that family, only the reverse-engineered dump in
-- backend/database/schema.sql. This file extends THAT family, so it deliberately matches
-- its conventions (plain uuid FK to public.users(id), no RLS/auth.uid()) rather than the
-- RLS style used in 0001-0006. Apply in the Supabase SQL editor.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------- extend emergency_contacts -> "Safety Circle" ----------
-- No `email` column: this app does not send email notifications, only FCM push + a
-- stubbed SMS channel (see notification_preferences below).
alter table public.emergency_contacts
  add column if not exists is_active boolean not null default true,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists live_location_enabled boolean not null default true,
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- ---------- notification_preferences (per contact, per event type) ----------
create table if not exists public.notification_preferences (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  contact_id   uuid not null references public.emergency_contacts (id) on delete cascade,
  event_type   text not null,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint notification_preferences_contact_event_uniq unique (contact_id, event_type)
);
create index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);

-- ---------- safety_events (canonical event log) ----------
create table if not exists public.safety_events (
  id               uuid primary key default gen_random_uuid(),
  client_event_id  text unique, -- idempotency key from the client
  user_id          uuid not null references public.users (id) on delete cascade,
  incident_id      uuid references public.sos_incidents (id) on delete set null,
  event_type       text not null,              -- SOS_ACTIVATED, JOURNEY_STARTED, etc.
  severity         text not null default 'INFO',    -- LOW, MEDIUM, HIGH, CRITICAL
  status           text not null default 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);
create index if not exists safety_events_user_idx on public.safety_events (user_id);
create index if not exists safety_events_incident_idx on public.safety_events (incident_id);
create index if not exists safety_events_client_event_idx on public.safety_events (client_event_id);

-- ---------- live_location_sessions (session registry; actual position stream stays in
-- Firebase RTDB per liveLocationSharing.ts — this table only tracks session metadata) ----------
create table if not exists public.live_location_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  incident_id   uuid references public.sos_incidents (id) on delete set null,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz,
  status        text not null default 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED
  share_token   text unique not null default gen_random_uuid()::text,
  created_at    timestamptz not null default now()
);
create index if not exists live_location_sessions_user_idx on public.live_location_sessions (user_id);
create index if not exists live_location_sessions_token_idx on public.live_location_sessions (share_token);

-- ---------- enhance public.notifications (recipient tracking) ----------
-- The pasted plan referred to this table as `notification_logs`; the table that actually
-- exists in this Supabase project (see backend/database/schema.sql) is `public.notifications`
-- (backend/app/repositories/notification_repository.py writes to it). Enhancing that real
-- table instead of creating a nonexistent `notification_logs` one.
alter table public.notifications
  add column if not exists event_id uuid references public.safety_events (id) on delete set null,
  add column if not exists contact_id uuid references public.emergency_contacts (id) on delete set null,
  add column if not exists channel text not null default 'FCM',
  add column if not exists delivered_at timestamptz,
  add column if not exists recipient_user_id uuid references public.users (id) on delete set null;
