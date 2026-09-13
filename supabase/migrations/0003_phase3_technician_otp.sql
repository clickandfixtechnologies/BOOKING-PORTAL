-- Phase 3: technician completion verification. This project remains independent of CRM and Billing.
alter table public.appointments
  add column if not exists completed_by uuid references auth.users(id),
  add column if not exists completed_by_role text check (completed_by_role in ('admin','technician')),
  add column if not exists completion_method text check (completion_method in ('admin_direct','technician_email_otp'));

create table public.completion_otps (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  used_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
create index completion_otps_active_idx on public.completion_otps(appointment_id, technician_id, created_at desc) where used_at is null and invalidated_at is null;
alter table public.completion_otps enable row level security;
-- No direct browser policy: only protected Edge Functions read/write OTP records.

create or replace function public.technician_set_status(appointment_uuid uuid, technician_uuid uuid, new_status public.appointment_status, note_input text default null, job_code_input text default null)
returns public.appointments language plpgsql security definer set search_path=public as $$
declare old public.appointments; updated public.appointments;
begin
  select * into old from public.appointments where id=appointment_uuid and technician_id=technician_uuid for update;
  if not found then raise exception 'Assigned appointment not found'; end if;
  if new_status='on_the_way' and old.status not in ('technician_assigned','confirmed') then raise exception 'Status change is not allowed'; end if;
  if new_status='in_progress' and old.status not in ('on_the_way','technician_assigned') then raise exception 'Status change is not allowed'; end if;
  if new_status='job_id_created' and (old.status not in ('in_progress','job_id_created') or job_code_input is null or job_code_input !~ '^CFX-JOB-[0-9]{4}-[0-9]{5}$') then raise exception 'A valid Job ID is required while work is in progress'; end if;
  if new_status not in ('on_the_way','in_progress','job_id_created') then raise exception 'Technician status is not allowed'; end if;
  update public.appointments set status=new_status,job_code=coalesce(job_code_input,job_code) where id=old.id returning * into updated;
  if old.status is distinct from updated.status then insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note) values(updated.id,old.status,updated.status,(select auth_user_id from public.technicians where id=technician_uuid),note_input); end if;
  return updated;
end $$;
revoke all on function public.technician_set_status(uuid,uuid,public.appointment_status,text,text) from public,anon,authenticated;

create or replace function public.consume_completion_otp(appointment_uuid uuid, technician_uuid uuid, candidate_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare otp public.completion_otps; result public.appointments; prior_status public.appointment_status;
begin
  select * into otp from public.completion_otps where appointment_id=appointment_uuid and technician_id=technician_uuid and used_at is null and invalidated_at is null order by created_at desc limit 1 for update;
  if not found or otp.expires_at<=now() or otp.attempt_count>=otp.max_attempts then
    if found then update public.completion_otps set invalidated_at=now() where id=otp.id; end if;
    return false;
  end if;
  if otp.otp_hash<>candidate_hash then
    update public.completion_otps set attempt_count=attempt_count+1,invalidated_at=case when attempt_count+1>=max_attempts then now() else null end where id=otp.id;
    return false;
  end if;
  select status into prior_status from public.appointments where id=appointment_uuid and technician_id=technician_uuid for update;
  if prior_status not in ('in_progress','job_id_created') then return false; end if;
  update public.completion_otps set used_at=now() where id=otp.id;
  update public.appointments set status='completed',completed_at=now(),completed_by=(select auth_user_id from public.technicians where id=technician_uuid),completed_by_role='technician',completion_method='technician_email_otp' where id=appointment_uuid and technician_id=technician_uuid returning * into result;
  insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note) values(result.id,prior_status,'completed',result.completed_by,'Completed after customer email OTP verification');
  return true;
end $$;
revoke all on function public.consume_completion_otp(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.admin_update_appointment(
  appointment_uuid uuid, new_status public.appointment_status, actor uuid, note_input text default null,
  technician_uuid uuid default null, job_code_input text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare old public.appointments; updated public.appointments;
begin
 select * into old from public.appointments where id=appointment_uuid for update; if not found then raise exception 'Appointment not found'; end if;
 if new_status='job_id_created' and coalesce(job_code_input,old.job_code) is null then raise exception 'A Job ID is required for Job ID Created'; end if;
 update public.appointments set status=new_status,technician_id=coalesce(technician_uuid,technician_id),job_code=coalesce(job_code_input,job_code),assigned_at=case when technician_uuid is not null then now() else assigned_at end,cancelled_at=case when new_status='cancelled' then now() else cancelled_at end,completed_at=case when new_status='completed' then now() else completed_at end,completed_by=case when new_status='completed' then actor else completed_by end,completed_by_role=case when new_status='completed' then 'admin' else completed_by_role end,completion_method=case when new_status='completed' then 'admin_direct' else completion_method end where id=appointment_uuid returning * into updated;
 if old.status is distinct from updated.status then insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note) values(updated.id,old.status,updated.status,actor,note_input); end if; return updated;
end $$;
