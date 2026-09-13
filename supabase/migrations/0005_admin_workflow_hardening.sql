-- Complete the existing administrator workflow without changing customer booking data.
create index if not exists appointments_appointment_code_idx on public.appointments (appointment_code);
create index if not exists appointments_mobile_idx on public.appointments (mobile);
create index if not exists appointments_status_idx on public.appointments (status);
create index if not exists appointments_technician_idx on public.appointments (technician_id);
create index if not exists appointments_tracking_token_idx on public.appointments (tracking_token);

create or replace function public.admin_update_appointment(
  appointment_uuid uuid, new_status public.appointment_status, actor uuid, note_input text default null,
  technician_uuid uuid default null, job_code_input text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare old public.appointments; updated public.appointments; target_technician uuid;
begin
  select * into old from public.appointments where id = appointment_uuid for update;
  if not found then raise exception 'Appointment not found'; end if;
  if new_status = 'technician_assigned' then
    target_technician := coalesce(technician_uuid, old.technician_id);
    if target_technician is null or not exists (select 1 from public.technicians where id = target_technician and is_active) then
      raise exception 'Select an active technician';
    end if;
  end if;
  if new_status = 'job_id_created' and (coalesce(nullif(job_code_input,''), old.job_code) is null or coalesce(nullif(job_code_input,''), old.job_code) !~ '^CFX-JOB-[0-9]{4}-[0-9]{5}$') then
    raise exception 'A valid Job ID is required for Job ID Created';
  end if;
  if new_status not in ('confirmed','technician_assigned','on_the_way','in_progress','job_id_created','completed','cancelled','rescheduled','no_show') then
    raise exception 'Invalid administrator status';
  end if;
  update public.appointments set
    status = new_status,
    technician_id = coalesce(technician_uuid, technician_id),
    job_code = coalesce(nullif(job_code_input,''), job_code),
    assigned_at = case when technician_uuid is not null then now() else assigned_at end,
    cancelled_at = case when new_status = 'cancelled' then now() else cancelled_at end,
    completed_at = case when new_status = 'completed' then now() else completed_at end,
    completed_by = case when new_status = 'completed' then actor else completed_by end,
    completed_by_role = case when new_status = 'completed' then 'admin' else completed_by_role end,
    completion_method = case when new_status = 'completed' then 'admin_direct' else completion_method end
  where id = appointment_uuid returning * into updated;
  if old.status is distinct from updated.status then
    insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note)
    values(updated.id,old.status,updated.status,actor,nullif(note_input,''));
  end if;
  return updated;
end $$;
revoke all on function public.admin_update_appointment(uuid, public.appointment_status, uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.admin_reschedule_appointment(
  appointment_uuid uuid, new_date_input date, new_time_input time, actor uuid, reason_input text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare old public.appointments; updated public.appointments; cfg public.business_availability; occupied integer;
begin
  select * into old from public.appointments where id = appointment_uuid for update;
  if not found then raise exception 'Appointment not found'; end if;
  if old.status in ('completed','cancelled','no_show') then raise exception 'This appointment cannot be rescheduled'; end if;
  select * into cfg from public.business_availability where id = true;
  if new_date_input < current_date or new_date_input > current_date + cfg.maximum_future_days
    or not (extract(isodow from new_date_input)::smallint = any(cfg.business_days))
    or new_time_input < cfg.opening_time or new_time_input + make_interval(mins => cfg.slot_duration_minutes) > cfg.closing_time
    or exists (select 1 from public.availability_blocks where block_date = new_date_input and (starts_at is null or new_time_input >= starts_at and new_time_input < ends_at)) then
    raise exception 'Selected slot is unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtext(new_date_input::text || new_time_input::text));
  select count(*) into occupied from public.appointments where appointment_date = new_date_input and appointment_time = new_time_input and id <> old.id and status not in ('cancelled','rescheduled');
  if occupied >= cfg.max_appointments_per_slot then raise exception 'Selected slot is no longer available'; end if;
  insert into public.appointment_reschedule_history(appointment_id,old_date,old_time,new_date,new_time,changed_by,reason)
  values(old.id,old.appointment_date,old.appointment_time,new_date_input,new_time_input,actor,nullif(reason_input,''));
  update public.appointments set appointment_date = new_date_input, appointment_time = new_time_input, status = 'rescheduled', rescheduled_at = now() where id = old.id returning * into updated;
  insert into public.appointment_status_history(appointment_id,old_status,new_status,changed_by,note)
  values(updated.id,old.status,'rescheduled',actor,'Rescheduled by administrator');
  return updated;
end $$;
revoke all on function public.admin_reschedule_appointment(uuid, date, time, uuid, text) from public, anon, authenticated;
