-- Click & Fix Booking Portal: independent Supabase schema (Phase 1)
create extension if not exists pgcrypto;

create type public.appointment_status as enum ('pending', 'assigned', 'confirmed', 'technician_assigned', 'on_the_way', 'in_progress', 'job_id_created', 'completed', 'cancelled', 'rescheduled', 'no_show');
create type public.service_location as enum ('service_centre', 'home_office', 'pickup_delivery');

create table public.business_availability (
  id boolean primary key default true check (id),
  business_days smallint[] not null default array[1,2,3,4,5,6], -- ISO weekday: Mon-Sat
  opening_time time not null default '10:00',
  closing_time time not null default '19:00',
  slot_duration_minutes integer not null default 30 check (slot_duration_minutes between 10 and 240),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  max_appointments_per_slot integer not null default 1 check (max_appointments_per_slot between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.business_availability (id) values (true);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  starts_at time,
  ends_at time,
  reason text,
  created_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and starts_at < ends_at))
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null unique check (appointment_id ~ '^CFX-APT-[0-9]{4}-[0-9]{5}$'),
  appointment_code char(5) not null check (appointment_code ~ '^[0-9]{5}$'),
  appointment_year smallint not null check (appointment_year between 2020 and 2100),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  service_category text not null,
  service_type text,
  problem_description text,
  photo_references text[] not null default '{}',
  service_location_type public.service_location not null,
  service_address text,
  landmark text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  google_maps_url text,
  appointment_date date not null,
  appointment_time time not null,
  status public.appointment_status not null default 'pending',
  additional_notes text,
  technician_id uuid, -- relation added when technician table is introduced
  job_id uuid,
  tracking_token uuid unique default gen_random_uuid(),
  cancellation_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((service_location_type = 'home_office' and service_address is not null and latitude is not null and longitude is not null and google_maps_url is not null) or service_location_type <> 'home_office'),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
-- The private booking function takes an advisory lock before applying max_appointments_per_slot.
-- This remains compatible with future capacity greater than one per slot.
create index appointments_active_slot_idx on public.appointments (appointment_date, appointment_time) where status not in ('cancelled', 'rescheduled');
create index appointments_appointment_date_idx on public.appointments (appointment_date, appointment_time);

create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_status public.appointment_status,
  new_status public.appointment_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  note text
);
create table public.appointment_reschedule_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_date date not null, old_time time not null, new_date date not null, new_time time not null,
  changed_by uuid references auth.users(id), reason text, created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text,
  browser text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.booking_rate_limits (
  request_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1
);
create or replace function public.consume_booking_rate_limit(request_key_input text)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_count integer;
begin
  insert into public.booking_rate_limits (request_key, window_started_at, request_count)
  values (request_key_input, now(), 1)
  on conflict (request_key) do update set
    window_started_at = case when public.booking_rate_limits.window_started_at < now() - interval '10 minutes' then now() else public.booking_rate_limits.window_started_at end,
    request_count = case when public.booking_rate_limits.window_started_at < now() - interval '10 minutes' then 1 else public.booking_rate_limits.request_count + 1 end
  returning request_count into current_count;
  return current_count <= 10;
end $$;
revoke all on function public.consume_booking_rate_limit(text) from public, anon, authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

-- Only Edge Functions (service role) call this function. It performs authoritative slot and ID checks.
create or replace function public.create_public_appointment(payload jsonb)
returns public.appointments language plpgsql security definer set search_path = public as $$
declare cfg public.business_availability; result public.appointments; apt_date date; apt_time time; candidate char(5); attempt integer := 0; slot_count integer;
begin
  apt_date := (payload->>'appointment_date')::date; apt_time := (payload->>'appointment_time')::time;
  select * into cfg from public.business_availability where id = true;
  if apt_date < current_date then raise exception 'Appointment date cannot be in the past'; end if;
  if not (extract(isodow from apt_date)::smallint = any(cfg.business_days)) then raise exception 'Appointments are unavailable on this day'; end if;
  if apt_time < cfg.opening_time or apt_time + make_interval(mins => cfg.slot_duration_minutes) > cfg.closing_time then raise exception 'Selected appointment time is outside business hours'; end if;
  if exists (select 1 from public.availability_blocks b where b.block_date = apt_date and (b.starts_at is null or apt_time >= b.starts_at and apt_time < b.ends_at)) then raise exception 'Selected appointment time is unavailable'; end if;
  perform pg_advisory_xact_lock(hashtext(apt_date::text || apt_time::text));
  select count(*) into slot_count from public.appointments where appointment_date = apt_date and appointment_time = apt_time and status not in ('cancelled','rescheduled');
  if slot_count >= cfg.max_appointments_per_slot then raise exception 'Selected appointment time is no longer available'; end if;
  loop
    candidate := lpad((floor(random() * 100000))::integer::text, 5, '0');
    exit when not exists (select 1 from public.appointments where appointment_id = format('CFX-APT-%s-%s', extract(year from apt_date)::integer, candidate));
    attempt := attempt + 1; if attempt >= 20 then raise exception 'Could not generate an appointment ID'; end if;
  end loop;
  insert into public.appointments (appointment_id, appointment_code, appointment_year, customer_name, mobile, email, service_category, service_type, problem_description, photo_references, service_location_type, service_address, landmark, latitude, longitude, google_maps_url, appointment_date, appointment_time, additional_notes)
  values (format('CFX-APT-%s-%s', extract(year from apt_date)::integer, candidate), candidate, extract(year from apt_date)::smallint, trim(payload->>'customer_name'), regexp_replace(payload->>'mobile','[^0-9]','','g'), lower(trim(payload->>'email')), payload->>'service_category', nullif(payload->>'service_type',''), nullif(payload->>'problem_description',''), coalesce(array(select jsonb_array_elements_text(payload->'photo_references')), '{}'), (payload->>'service_location_type')::public.service_location, nullif(payload->>'service_address',''), nullif(payload->>'landmark',''), nullif(payload->>'latitude','')::numeric, nullif(payload->>'longitude','')::numeric, nullif(payload->>'google_maps_url',''), apt_date, apt_time, nullif(payload->>'additional_notes','')) returning * into result;
  insert into public.appointment_status_history (appointment_id, new_status, note) values (result.id, 'pending', 'Appointment created');
  return result;
end $$;
revoke all on function public.create_public_appointment(jsonb) from public, anon, authenticated;

alter table public.business_availability enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.appointment_reschedule_history enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_push_subscriptions enable row level security;
alter table public.booking_rate_limits enable row level security;

-- No appointment, availability, or history data is exposed directly to browsers.
create policy "admins manage availability" on public.business_availability for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins manage blocks" on public.availability_blocks for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins read appointments" on public.appointments for select to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins read history" on public.appointment_status_history for select to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins manage their push subscriptions" on public.admin_push_subscriptions for all to authenticated using (admin_id = auth.uid() and exists (select 1 from public.admin_users where user_id = auth.uid())) with check (admin_id = auth.uid() and exists (select 1 from public.admin_users where user_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('appointment-photos', 'appointment-photos', false) on conflict (id) do nothing;
create policy "admins read appointment photos" on storage.objects for select to authenticated using (bucket_id = 'appointment-photos' and exists (select 1 from public.admin_users where user_id = auth.uid()));
