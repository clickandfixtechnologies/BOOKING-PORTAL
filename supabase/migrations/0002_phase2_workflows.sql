-- Phase 2: tracking, notifications, administration, and technician foundation.
alter table public.business_availability
  add column if not exists minimum_advance_minutes integer not null default 60 check (minimum_advance_minutes >= 0),
  add column if not exists maximum_future_days integer not null default 90 check (maximum_future_days between 1 and 365);
alter table public.appointments
  add column if not exists job_code text check (job_code is null or job_code ~ '^CFX-JOB-[0-9]{4}-[0-9]{5}$'),
  add column if not exists assigned_at timestamptz,
  add column if not exists customer_cancelled_at timestamptz,
  add column if not exists rescheduled_at timestamptz;
create unique index if not exists appointments_job_code_unique on public.appointments(job_code) where job_code is not null;

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  technician_code text not null unique check (technician_code ~ '^CFX-TECH-[0-9]{4}-[0-9]{4,6}$'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  username text not null unique,
  specialization text[] not null default '{}',
  working_days smallint[] not null default array[1,2,3,4,5,6],
  working_start time not null default '10:00',
  working_end time not null default '19:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (working_start < working_end)
);
alter table public.appointments drop constraint if exists appointments_technician_id_fkey;
alter table public.appointments add constraint appointments_technician_id_fkey foreign key (technician_id) references public.technicians(id) on delete set null;
create trigger technicians_updated_at before update on public.technicians for each row execute function public.set_updated_at();

create type public.notification_channel as enum ('push', 'formspree', 'brevo');
create type public.notification_delivery_status as enum ('pending', 'sent', 'failed');
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  channel public.notification_channel not null,
  type text not null,
  status public.notification_delivery_status not null default 'pending',
  created_at timestamptz not null default now(), sent_at timestamptz, error text
);
create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  title text not null, body text not null, is_read boolean not null default false,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index notifications_appointment_idx on public.notifications(appointment_id, created_at desc);
create index admin_notifications_admin_idx on public.admin_notifications(admin_id, is_read, created_at desc);

alter table public.technicians enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_notifications enable row level security;
create policy "admins manage technicians" on public.technicians for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins read notification logs" on public.notifications for select to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins manage own inbox" on public.admin_notifications for all to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- Replace the Phase 1 booking function so API callers cannot bypass advance/future-date rules.
create or replace function public.create_public_appointment(payload jsonb)
returns public.appointments language plpgsql security definer set search_path = public as $$
declare cfg public.business_availability; result public.appointments; apt_date date; apt_time time; candidate char(5); attempt integer := 0; slot_count integer;
begin
 apt_date:=(payload->>'appointment_date')::date; apt_time:=(payload->>'appointment_time')::time; select * into cfg from public.business_availability where id=true;
 if apt_date < current_date or apt_date > current_date + cfg.maximum_future_days or (apt_date + apt_time) < now() + make_interval(mins=>cfg.minimum_advance_minutes) then raise exception 'Selected appointment time is unavailable'; end if;
 if not (extract(isodow from apt_date)::smallint=any(cfg.business_days)) or apt_time<cfg.opening_time or apt_time+make_interval(mins=>cfg.slot_duration_minutes)>cfg.closing_time then raise exception 'Selected appointment time is unavailable'; end if;
 if exists(select 1 from public.availability_blocks b where b.block_date=apt_date and (b.starts_at is null or apt_time>=b.starts_at and apt_time<b.ends_at)) then raise exception 'Selected appointment time is unavailable'; end if;
 perform pg_advisory_xact_lock(hashtext(apt_date::text||apt_time::text)); select count(*) into slot_count from public.appointments where appointment_date=apt_date and appointment_time=apt_time and status not in ('cancelled','rescheduled'); if slot_count>=cfg.max_appointments_per_slot then raise exception 'Selected appointment time is no longer available'; end if;
 loop candidate:=lpad((floor(random()*100000))::integer::text,5,'0'); exit when not exists(select 1 from public.appointments where appointment_id=format('CFX-APT-%s-%s',extract(year from apt_date)::integer,candidate)); attempt:=attempt+1; if attempt>=20 then raise exception 'Could not generate an appointment ID'; end if; end loop;
 insert into public.appointments(appointment_id,appointment_code,appointment_year,customer_name,mobile,email,service_category,service_type,problem_description,photo_references,service_location_type,service_address,landmark,latitude,longitude,google_maps_url,appointment_date,appointment_time,additional_notes) values(format('CFX-APT-%s-%s',extract(year from apt_date)::integer,candidate),candidate,extract(year from apt_date)::smallint,trim(payload->>'customer_name'),regexp_replace(payload->>'mobile','[^0-9]','','g'),lower(trim(payload->>'email')),payload->>'service_category',nullif(payload->>'service_type',''),nullif(payload->>'problem_description',''),coalesce(array(select jsonb_array_elements_text(payload->'photo_references')),'{}'),(payload->>'service_location_type')::public.service_location,nullif(payload->>'service_address',''),nullif(payload->>'landmark',''),nullif(payload->>'latitude','')::numeric,nullif(payload->>'longitude','')::numeric,nullif(payload->>'google_maps_url',''),apt_date,apt_time,nullif(payload->>'additional_notes','')) returning * into result;
 insert into public.appointment_status_history(appointment_id,new_status,note) values(result.id,'pending','Appointment created'); return result;
end $$;

-- Private customer views: returned only by server-side functions after mobile/token checks.
create or replace function public.customer_visible_appointment(appointment_uuid uuid)
returns table (appointment_id text, customer_name text, service_category text, service_type text, service_location_type public.service_location, appointment_date date, appointment_time time, status public.appointment_status, job_code text, rescheduled_at timestamptz, cancelled_at timestamptz, completed_at timestamptz)
language sql security definer set search_path = public as $$
  select a.appointment_id, a.customer_name, a.service_category, a.service_type, a.service_location_type, a.appointment_date, a.appointment_time, a.status, a.job_code, a.rescheduled_at, a.cancelled_at, a.completed_at
  from public.appointments a where a.id = appointment_uuid;
$$;
revoke all on function public.customer_visible_appointment(uuid) from public, anon, authenticated;

-- Handles every status change consistently. Only server-side admin functions may call it.
create or replace function public.admin_update_appointment(
  appointment_uuid uuid, new_status public.appointment_status, actor uuid, note_input text default null,
  technician_uuid uuid default null, job_code_input text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare old public.appointments; updated public.appointments;
begin
  select * into old from public.appointments where id = appointment_uuid for update;
  if not found then raise exception 'Appointment not found'; end if;
  if new_status = 'job_id_created' and coalesce(job_code_input, old.job_code) is null then raise exception 'A Job ID is required for Job ID Created'; end if;
  update public.appointments set status = new_status, technician_id = coalesce(technician_uuid, technician_id),
    job_code = coalesce(job_code_input, job_code), assigned_at = case when technician_uuid is not null then now() else assigned_at end,
    cancelled_at = case when new_status = 'cancelled' then now() else cancelled_at end,
    completed_at = case when new_status = 'completed' then now() else completed_at end
  where id = appointment_uuid returning * into updated;
  if old.status is distinct from updated.status then insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note) values(updated.id,old.status,updated.status,actor,note_input); end if;
  return updated;
end $$;
revoke all on function public.admin_update_appointment(uuid, public.appointment_status, uuid, text, uuid, text) from public, anon, authenticated;

-- Secure-token customer cancellation/rescheduling with a server-side one-hour cutoff.
create or replace function public.customer_modify_appointment(token uuid, action text, new_date_input date default null, new_time_input time default null, reason_input text default null)
returns public.appointments language plpgsql security definer set search_path = public as $$
declare old public.appointments; prior_status public.appointment_status; cfg public.business_availability; occupied integer;
begin
  select * into old from public.appointments where tracking_token = token for update;
  prior_status := old.status;
  if not found then raise exception 'Appointment not found'; end if;
  if old.status in ('cancelled','completed','no_show') then raise exception 'This appointment can no longer be changed'; end if;
  if (old.appointment_date + old.appointment_time) <= now() + interval '1 hour' then raise exception 'Changes are allowed only until one hour before the appointment'; end if;
  if action = 'cancel' then
    update public.appointments set status='cancelled', cancelled_at=now(), customer_cancelled_at=now(), cancellation_reason=nullif(reason_input,'') where id=old.id returning * into old;
    insert into public.appointment_status_history(appointment_id,old_status,new_status,note) values(old.id,prior_status,'cancelled','Cancelled by customer');
    return old;
  end if;
  if action <> 'reschedule' or new_date_input is null or new_time_input is null then raise exception 'Invalid customer action'; end if;
  select * into cfg from public.business_availability where id=true;
  if new_date_input < current_date or new_date_input > current_date + cfg.maximum_future_days then raise exception 'Selected date is unavailable'; end if;
  if not (extract(isodow from new_date_input)::smallint = any(cfg.business_days)) or new_time_input < cfg.opening_time or new_time_input + make_interval(mins => cfg.slot_duration_minutes) > cfg.closing_time then raise exception 'Selected slot is unavailable'; end if;
  if exists(select 1 from public.availability_blocks b where b.block_date=new_date_input and (b.starts_at is null or new_time_input >= b.starts_at and new_time_input < b.ends_at)) then raise exception 'Selected slot is unavailable'; end if;
  perform pg_advisory_xact_lock(hashtext(new_date_input::text || new_time_input::text));
  select count(*) into occupied from public.appointments where appointment_date=new_date_input and appointment_time=new_time_input and status not in ('cancelled','rescheduled') and id<>old.id;
  if occupied >= cfg.max_appointments_per_slot then raise exception 'Selected slot is no longer available'; end if;
  insert into public.appointment_reschedule_history(appointment_id,old_date,old_time,new_date,new_time,reason) values(old.id,old.appointment_date,old.appointment_time,new_date_input,new_time_input,nullif(reason_input,''));
  update public.appointments set appointment_date=new_date_input, appointment_time=new_time_input, status='rescheduled', rescheduled_at=now() where id=old.id returning * into old;
  insert into public.appointment_status_history(appointment_id,old_status,new_status,note) values(old.id,prior_status,'rescheduled','Rescheduled by customer');
  return old;
end $$;
revoke all on function public.customer_modify_appointment(uuid, text, date, time, text) from public, anon, authenticated;
