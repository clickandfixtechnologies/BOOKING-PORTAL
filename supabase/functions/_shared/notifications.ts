import webpush from "npm:web-push@3.6.7";
import { serviceClient } from "./supabase.ts";
type Appointment = { id:string; appointment_id:string; customer_name:string; email:string; service_category:string; service_type:string|null; service_location_type:string; appointment_date:string; appointment_time:string; tracking_token:string; };
const adminUrl = () => (Deno.env.get("ADMIN_URL") || "https://booking.clickandfix.site/admin/");
async function log(appointmentId:string, channel:"push"|"formspree"|"brevo", status:"sent"|"failed", error?:unknown) { await serviceClient().from("notifications").insert({ appointment_id:appointmentId, channel, type:"new_booking", status, sent_at: status === "sent" ? new Date().toISOString() : null, error: error ? String(error).slice(0,500) : null }); }
export async function notifyNewBooking(appointment: Appointment) {
  const db = serviceClient();
  const { data: admins } = await db.from("admin_users").select("user_id");
  await Promise.all((admins || []).map((admin) => db.from("admin_notifications").insert({ admin_id:admin.user_id, appointment_id:appointment.id, title:"New Appointment Received", body:appointment.customer_name })));
  await Promise.allSettled([sendPush(appointment), sendFormspree(appointment), sendBrevo(appointment)]);
}
async function sendPush(appointment: Appointment) {
  const db=serviceClient(); const {data: subscriptions}=await db.from("admin_push_subscriptions").select("id,endpoint,p256dh,auth").eq("is_active",true);
  if (!subscriptions?.length) return log(appointment.id,"push","sent");
  webpush.setVapidDetails(`mailto:${Deno.env.get("VAPID_CONTACT_EMAIL") || "admin@booking.clickandfix.site"}`, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const payload=JSON.stringify({title:"New Appointment Received",body:appointment.customer_name,url:`${adminUrl()}#appointment=${encodeURIComponent(appointment.id)}`});
  const outcomes=await Promise.allSettled(subscriptions.map(async(s)=>{try { await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload); await db.from("admin_push_subscriptions").update({last_seen_at:new Date().toISOString(),is_active:true}).eq("id",s.id); } catch(error) { const status=(error as {statusCode?:number}).statusCode; if(status===404||status===410) await db.from("admin_push_subscriptions").update({is_active:false}).eq("id",s.id); throw error; }}));
  const failures=outcomes.filter((item)=>item.status==="rejected"); await log(appointment.id,"push",failures.length ? "failed":"sent",failures.length ? "One or more subscriptions failed" : undefined);
}
async function sendFormspree(appointment: Appointment) {
  const endpoint=Deno.env.get("FORMSPREE_ENDPOINT"); if(!endpoint) return log(appointment.id,"formspree","failed","FORMSPREE_ENDPOINT is not configured");
  try { const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({subject:"New Booking Received – Click & Fix Technologies",message:`New Booking Received\n\nCustomer Name: ${appointment.customer_name}\n\nLogin to Admin Panel:\n${adminUrl()}`})}); if(!response.ok) throw new Error(`Formspree returned ${response.status}`); await log(appointment.id,"formspree","sent"); } catch(error) { await log(appointment.id,"formspree","failed",error); }
}
async function sendBrevo(appointment: Appointment) {
  const apiKey=Deno.env.get("BREVO_API_KEY"), sender=Deno.env.get("BREVO_SENDER_EMAIL"); if(!apiKey||!sender) return log(appointment.id,"brevo","failed","Brevo is not configured");
  const service=[appointment.service_category,appointment.service_type].filter(Boolean).join(" — "); const track=`${Deno.env.get("PUBLIC_SITE_URL") || "https://booking.clickandfix.site"}/track/${appointment.tracking_token}`;
  try { const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey},body:JSON.stringify({sender:{email:sender,name:"Click & Fix Technologies"},to:[{email:appointment.email,name:appointment.customer_name}],subject:"Your Click & Fix appointment is booked",htmlContent:`<h2>Click &amp; Fix Technologies</h2><p>Hello ${escapeHtml(appointment.customer_name)},</p><p>Your appointment is <strong>Pending</strong>.</p><p><strong>Appointment ID:</strong> ${appointment.appointment_id}<br><strong>Service:</strong> ${escapeHtml(service)}<br><strong>Date:</strong> ${appointment.appointment_date}<br><strong>Time:</strong> ${appointment.appointment_time}<br><strong>Location:</strong> ${escapeHtml(appointment.service_location_type)}</p><p><a href="${track}">Track Your Appointment</a></p>`})}); if(!response.ok) throw new Error(`Brevo returned ${response.status}`); await log(appointment.id,"brevo","sent"); } catch(error) { await log(appointment.id,"brevo","failed",error); }
}
function escapeHtml(value:string) { return value.replace(/[&<>'"]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[character]!)); }
