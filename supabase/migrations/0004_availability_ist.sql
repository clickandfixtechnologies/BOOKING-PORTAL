-- Appointment business rules run in Click & Fix's business timezone, not UTC.
alter function public.create_public_appointment(jsonb) set timezone to 'Asia/Kolkata';
alter function public.customer_modify_appointment(uuid, text, date, time, text) set timezone to 'Asia/Kolkata';
