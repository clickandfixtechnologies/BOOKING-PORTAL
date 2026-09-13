import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { requireTechnician } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const context = await requireTechnician(request);
    const body = await request.json();
    const result = await route(context, body);
    return corsResponse(result);
  } catch (error) {
    const message = error.message === "AUTH_REQUIRED" ? "Sign in is required." : error.message === "TECHNICIAN_REQUIRED" ? "An active technician account is required." : error.message || "Request failed.";
    return corsResponse({ error: message }, message.includes("required") ? 401 : 400);
  }
});

async function route(context: any, body: any) {
  const { supabase: db, technician } = context;
  switch (body.action) {
    case "dashboard": return dashboard(db, technician);
    case "appointment": return appointment(db, technician.id, body.id);
    case "set_status": return setStatus(db, technician.id, body);
    case "start_completion": return startCompletion(db, technician, body.id);
    case "verify_completion": return verifyCompletion(db, technician, body.id, body.otp);
    default: throw new Error("Unknown technician action.");
  }
}

async function dashboard(db: any, technician: any) {
  const today = new Date().toLocaleDateString("en-CA");
  const { data, error } = await db.from("appointments").select("id,appointment_id,customer_name,mobile,service_category,service_type,appointment_date,appointment_time,service_address,problem_description,status,google_maps_url,job_code").eq("technician_id", technician.id).order("appointment_date").order("appointment_time");
  if (error) throw error;
  const jobs = data || [];
  return { technician: { name: technician.full_name, technician_code: technician.technician_code }, today: jobs.filter((job: any) => job.appointment_date === today && job.status !== "completed"), upcoming: jobs.filter((job: any) => job.appointment_date > today && job.status !== "completed"), completed: jobs.filter((job: any) => job.status === "completed") };
}

async function appointment(db: any, technicianId: string, id: string) {
  const { data, error } = await db.from("appointments").select("id,appointment_id,customer_name,mobile,email,service_category,service_type,problem_description,photo_references,service_location_type,service_address,landmark,latitude,longitude,google_maps_url,appointment_date,appointment_time,status,job_code,appointment_status_history(old_status,new_status,changed_at,note)").eq("id", id).eq("technician_id", technicianId).single();
  if (error || !data) throw new Error("Assigned appointment not found.");
  return { appointment: data };
}

async function setStatus(db: any, technicianId: string, body: any) {
  if (!/^[0-9a-f-]{36}$/i.test(body.id || "")) throw new Error("Invalid appointment.");
  const { data, error } = await db.rpc("technician_set_status", { appointment_uuid: body.id, technician_uuid: technicianId, new_status: body.status, note_input: text(body.note, 1000), job_code_input: body.job_code || null });
  if (error) throw new Error(error.message);
  return { appointment: data };
}

async function startCompletion(db: any, technician: any, appointmentId: string) {
  const { data: appointment, error } = await db.from("appointments").select("id,customer_name,email,status,technician_id").eq("id", appointmentId).eq("technician_id", technician.id).single();
  if (error || !appointment) throw new Error("Assigned appointment not found.");
  if (!["in_progress", "job_id_created"].includes(appointment.status)) throw new Error("Completion can begin only when work is In Progress or Job ID Created.");
  if (!appointment.email) throw new Error("The appointment has no registered customer email.");
  const { data: active } = await db.from("completion_otps").select("id,last_sent_at").eq("appointment_id", appointment.id).eq("technician_id", technician.id).is("used_at", null).is("invalidated_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (active && Date.now() - new Date(active.last_sent_at).getTime() < 60000) throw new Error("Please wait 60 seconds before requesting another OTP.");
  if (active) await db.from("completion_otps").update({ invalidated_at: new Date().toISOString() }).eq("id", active.id);
  const otp = randomOtp(); const hash = await otpHash(otp); const now = new Date(); const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await db.from("completion_otps").insert({ appointment_id: appointment.id, technician_id: technician.id, otp_hash: hash, expires_at: expires, last_sent_at: now.toISOString() });
  if (insertError) throw new Error("Could not start verification.");
  try { await sendOtpEmail(appointment.email, otp); await db.from("notifications").insert({ appointment_id: appointment.id, channel: "brevo", type: "completion_otp", status: "sent", sent_at: new Date().toISOString() }); } catch (_) { await db.from("completion_otps").update({ invalidated_at: new Date().toISOString() }).eq("appointment_id", appointment.id).eq("technician_id", technician.id).is("used_at", null); await db.from("notifications").insert({ appointment_id: appointment.id, channel: "brevo", type: "completion_otp", status: "failed", error: "OTP email delivery failed" }); throw new Error("The verification email could not be sent. Please try again."); }
  return { verification_required: true, expires_at: expires, resend_available_at: new Date(now.getTime() + 60000).toISOString() };
}

async function verifyCompletion(db: any, technician: any, appointmentId: string, otp: string) {
  if (!/^\d{6}$/.test(otp || "")) throw new Error("Enter the 6-digit OTP.");
  const { data, error } = await db.rpc("consume_completion_otp", { appointment_uuid: appointmentId, technician_uuid: technician.id, candidate_hash: await otpHash(otp) });
  if (error) throw new Error("Verification could not be completed.");
  if (!data) throw new Error("The OTP is invalid, expired, or has reached its attempt limit.");
  return { completed: true };
}

function randomOtp() { const values = new Uint32Array(1); const upper = Math.floor(0x100000000 / 1000000) * 1000000; do { crypto.getRandomValues(values); } while (values[0] >= upper); return String(values[0] % 1000000).padStart(6, "0"); }
async function otpHash(otp: string) { const pepper = Deno.env.get("OTP_HASH_PEPPER"); if (!pepper) throw new Error("OTP service is not configured."); const bytes = new TextEncoder().encode(`${pepper}:${otp}`); const hash = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function sendOtpEmail(email: string, otp: string) { const key = Deno.env.get("BREVO_API_KEY"), sender = Deno.env.get("BREVO_SENDER_EMAIL"); if (!key || !sender) throw new Error("OTP email service is not configured."); const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "Content-Type": "application/json", "api-key": key }, body: JSON.stringify({ sender: { email: sender, name: "Click & Fix Technologies" }, to: [{ email }], subject: "Click & Fix Technologies – Service Completion Verification OTP", htmlContent: `<p>Your service completion verification OTP is:</p><h2>${otp}</h2><p>Please provide this OTP to the technician to confirm completion of your service.</p><p>This OTP is valid for 10 minutes.</p>` }) }); if (!response.ok) throw new Error("OTP email delivery failed."); }
function text(value: unknown, limit: number) { return typeof value === "string" ? value.trim().slice(0, limit) : null; }
