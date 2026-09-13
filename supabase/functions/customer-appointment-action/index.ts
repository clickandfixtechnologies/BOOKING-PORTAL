import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(body.token || "") || !["cancel","reschedule"].includes(body.action)) throw new Error("Invalid request.");
    const { data, error } = await serviceClient().rpc("customer_modify_appointment", { token: body.token, action: body.action, new_date_input: body.new_date || null, new_time_input: body.new_time || null, reason_input: body.reason || null });
    if (error) throw error;
    return corsResponse({ appointment: { appointment_id:data.appointment_id, appointment_date:data.appointment_date, appointment_time:data.appointment_time, status:data.status } });
  } catch (error) { return corsResponse({ error: error.message || "This appointment cannot be changed." }, 400); }
});
