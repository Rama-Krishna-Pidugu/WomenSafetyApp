-- setup.sql — full schema for modules #17 & #20 (paste into Supabase SQL editor).
-- Generated from schema/0001_core.sql + 0002_evidence.sql + 0003_admin.sql.

-- 0001_core.sql
-- Shared/core schema for the AI-Enabled Women Security Application.
--
-- Modules #17 (Cloud Evidence Storage) and #20 (Administrative Dashboard) — owned by pratik —
-- read/write a few shared tables that other teammates' modules also touch. Those tables are
-- created here MINIMALLY and guarded with IF NOT EXISTS so a teammate's fuller definition can
-- supersede this one. Apply in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------- enums ----------
do $$ begin
  create type public.evidence_type as enum ('audio', 'video', 'image', 'gps_track', 'incident_log');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.incident_type as enum ('sos', 'journey', 'report', 'alert');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.incident_status as enum ('active', 'resolved', 'under_review', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_level as enum ('low', 'moderate', 'high', 'hotspot');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
-- One row per auth user. `is_admin` gates the Administrative Dashboard (#20).
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  phone         text,
  blood_group   text,
  is_admin      boolean not null default false,
  status        text not null default 'active',   -- active | suspended
  created_at    timestamptz not null default now(),
  last_active_at timestamptz
);

-- ---------- incidents ----------
-- SOS / journey / report / alert events. #20 aggregates these for analytics + response monitoring.
create table if not exists public.incidents (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles (id) on delete cascade,
  type                  public.incident_type not null,
  status                public.incident_status not null default 'active',
  severity              int not null default 0,          -- danger score 0..100
  lat                   double precision,
  lng                   double precision,
  address               text,
  started_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  response_time_seconds int
);
create index if not exists incidents_user_idx    on public.incidents (user_id);
create index if not exists incidents_started_idx on public.incidents (started_at);

-- ---------- crime_hotspots ----------
-- Risk-zone points powering the dashboard heatmap (#20). Owned longer-term by module #11.
create table if not exists public.crime_hotspots (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  lat            double precision,
  lng            double precision,
  risk_level     public.risk_level not null default 'moderate',
  incident_count int not null default 0,
  updated_at     timestamptz not null default now()
);

-- ---------- app_health_metrics ----------
-- Backend/service health samples surfaced on the dashboard (#20).
create table if not exists public.app_health_metrics (
  id          uuid primary key default gen_random_uuid(),
  service     text not null,          -- e.g. 'emergency-service'
  metric      text not null,          -- e.g. 'uptime', 'latency_ms', 'error_rate'
  value       numeric not null,
  unit        text,                   -- '%', 'ms', ...
  recorded_at timestamptz not null default now()
);
create index if not exists app_health_service_idx on public.app_health_metrics (service, recorded_at);

-- ---------- helpers ----------
-- is_admin(): true when the current auth user has profiles.is_admin = true.
-- SECURITY DEFINER so it can be called from RLS policies without recursive checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------- RLS: profiles ----------
alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS: incidents / hotspots / health (admin-readable) ----------
alter table public.incidents enable row level security;

drop policy if exists incidents_owner_all on public.incidents;
create policy incidents_owner_all on public.incidents
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

alter table public.crime_hotspots enable row level security;
drop policy if exists hotspots_read on public.crime_hotspots;
create policy hotspots_read on public.crime_hotspots
  for select using (auth.role() = 'authenticated');
drop policy if exists hotspots_admin_write on public.crime_hotspots;
create policy hotspots_admin_write on public.crime_hotspots
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.app_health_metrics enable row level security;
drop policy if exists health_admin_read on public.app_health_metrics;
create policy health_admin_read on public.app_health_metrics
  for select using (public.is_admin());

-- 0002_evidence.sql
-- Module #17 — Cloud Evidence Storage.
-- Encrypted audio/video/image/GPS/log evidence, tamper-proof metadata, and a secure-retrieval
-- audit trail. Binary files live in the private Storage bucket `evidence`; this table holds the
-- metadata. Apply after 0001_core.sql.

-- ---------- evidence ----------
create table if not exists public.evidence (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  incident_id      uuid references public.incidents (id) on delete set null,
  type             public.evidence_type not null,
  storage_bucket   text not null default 'evidence',
  storage_path     text not null,                       -- '<user_id>/<uuid>.<ext>'
  file_name        text,
  mime_type        text,
  size_bytes       bigint not null default 0,
  duration_seconds int,                                 -- audio/video only
  checksum_sha256  text,                                -- integrity hash of the ciphertext
  is_encrypted     boolean not null default true,
  encryption_algo  text not null default 'AES-256-GCM',
  tamper_seal      text,                                -- signature / hash-chain seal
  status           text not null default 'ready',       -- pending | ready
  captured_at      timestamptz,
  uploaded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  metadata         jsonb not null default '{}'::jsonb
);
create index if not exists evidence_user_idx     on public.evidence (user_id, created_at desc);
create index if not exists evidence_incident_idx on public.evidence (incident_id);
create index if not exists evidence_type_idx     on public.evidence (type);

-- ---------- evidence_access_log ----------
-- Every view/download/retrieve/delete is recorded — this is what makes retrieval "secure &
-- auditable" and supports legal chain-of-custody.
create table if not exists public.evidence_access_log (
  id                    uuid primary key default gen_random_uuid(),
  evidence_id           uuid not null references public.evidence (id) on delete cascade,
  accessed_by           uuid references public.profiles (id) on delete set null,
  action                text not null,                  -- view | download | retrieve | delete | upload
  signed_url_expires_at timestamptz,
  accessed_at           timestamptz not null default now(),
  ip                    text
);
create index if not exists evidence_access_evidence_idx on public.evidence_access_log (evidence_id, accessed_at desc);

-- ---------- RLS: evidence ----------
alter table public.evidence enable row level security;

drop policy if exists evidence_owner_select on public.evidence;
create policy evidence_owner_select on public.evidence
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists evidence_owner_insert on public.evidence;
create policy evidence_owner_insert on public.evidence
  for insert with check (auth.uid() = user_id);

drop policy if exists evidence_owner_update on public.evidence;
create policy evidence_owner_update on public.evidence
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists evidence_owner_delete on public.evidence;
create policy evidence_owner_delete on public.evidence
  for delete using (auth.uid() = user_id or public.is_admin());

-- ---------- RLS: evidence_access_log ----------
alter table public.evidence_access_log enable row level security;

drop policy if exists evidence_log_read on public.evidence_access_log;
create policy evidence_log_read on public.evidence_access_log
  for select using (
    public.is_admin()
    or exists (select 1 from public.evidence e where e.id = evidence_id and e.user_id = auth.uid())
  );

drop policy if exists evidence_log_insert on public.evidence_access_log;
create policy evidence_log_insert on public.evidence_access_log
  for insert with check (
    accessed_by = auth.uid()
    and exists (select 1 from public.evidence e where e.id = evidence_id and (e.user_id = auth.uid() or public.is_admin()))
  );

-- ---------- Storage bucket + object RLS ----------
-- Private bucket; each user's files live under a folder named after their uuid.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists evidence_objects_read on storage.objects;
create policy evidence_objects_read on storage.objects
  for select using (
    bucket_id = 'evidence'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists evidence_objects_write on storage.objects;
create policy evidence_objects_write on storage.objects
  for insert with check (
    bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists evidence_objects_delete on storage.objects;
create policy evidence_objects_delete on storage.objects
  for delete using (
    bucket_id = 'evidence'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- 0003_admin.sql
-- Module #20 — Administrative Dashboard read models.
-- Aggregate views for KPIs, incident analytics, hotspots, and storage usage. The user-service
-- edge function queries these with the service-role key AFTER verifying the caller is_admin().
-- Apply after 0001_core.sql and 0002_evidence.sql.

-- KPI overview (single row).
create or replace view public.v_admin_overview as
select
  (select count(*) from public.profiles)                                              as total_users,
  (select count(*) from public.profiles where last_active_at > now() - interval '7 days') as active_users_7d,
  (select count(*) from public.profiles where status = 'suspended')                   as suspended_users,
  (select count(*) from public.incidents)                                             as total_incidents,
  (select count(*) from public.incidents where status = 'active')                     as active_incidents,
  (select coalesce(round(avg(response_time_seconds)), 0)
     from public.incidents where response_time_seconds is not null)                   as avg_response_seconds,
  (select count(*) from public.evidence)                                              as total_evidence,
  (select coalesce(sum(size_bytes), 0) from public.evidence)                          as storage_bytes_used;

-- Incidents per day for the last 30 days (time-series for the trend chart).
create or replace view public.v_incident_daily as
select
  d::date                                       as day,
  count(i.id)                                   as incident_count
from generate_series(
       (current_date - interval '29 days'),
       current_date,
       interval '1 day'
     ) as d
left join public.incidents i on i.started_at::date = d::date
group by d
order by d;

-- Incident counts grouped by type (bar chart).
create or replace view public.v_incident_by_type as
select type::text as type, count(*) as incident_count
from public.incidents
group by type
order by incident_count desc;

-- Hotspots ordered by risk for the heatmap + top-zone list.
create or replace view public.v_hotspots as
select id, name, lat, lng, risk_level::text as risk_level, incident_count, updated_at
from public.crime_hotspots
order by incident_count desc, updated_at desc;

-- Latest health sample per service+metric (dashboard health panel).
create or replace view public.v_service_health as
select distinct on (service, metric)
  service, metric, value, unit, recorded_at
from public.app_health_metrics
order by service, metric, recorded_at desc;

-- Views run with the querying role's privileges; the edge function enforces admin-only access,
-- and RLS on the base tables (0001/0002) already restricts non-admins.

-- 0006_timeline.sql
-- Module #19 — Incident Timeline Schema
-- Aggregates pipeline events (SOS, GPS, Audio, Video, AI Risk, Contacts, Resolutions)
-- for an emergency incident. Accessible to incident owners and administrators.

CREATE TABLE IF NOT EXISTS public.incident_timeline (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL REFERENCES public.incidents (id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index: fast retrieval of events for a given incident ordered chronologically
CREATE INDEX IF NOT EXISTS incident_timeline_incident_idx ON public.incident_timeline (incident_id, created_at ASC);

-- Row Level Security (RLS)
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;

-- Owner select policy: user can only view events for their own incidents (or admin)
DROP POLICY IF EXISTS incident_timeline_owner_select ON public.incident_timeline;
CREATE POLICY incident_timeline_owner_select ON public.incident_timeline
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND i.user_id = auth.uid()
    )
  );

-- Owner insert policy: user can append events to their own incidents (or admin)
DROP POLICY IF EXISTS incident_timeline_owner_insert ON public.incident_timeline;
CREATE POLICY incident_timeline_owner_insert ON public.incident_timeline
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND i.user_id = auth.uid()
    )
  );


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
