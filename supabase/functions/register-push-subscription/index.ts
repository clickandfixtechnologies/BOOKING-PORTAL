import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = request.headers.get("Authorization") || "";
  const client = serviceClient();
  const { data: identity } = await client.auth.getUser(auth.replace("Bearer ", ""));
  if (!identity.user) return corsResponse({ error: "Sign in is required." }, 401);
  const { data: admin } = await client.from("admin_users").select("user_id").eq("user_id", identity.user.id).maybeSingle();
  if (!admin) return corsResponse({ error: "Administrator access is required." }, 403);
  try {
    const payload = await request.json(); const subscription = payload.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return corsResponse({ error: "Invalid push subscription." }, 400);
    const { error } = await client.from("admin_push_subscriptions").upsert({ admin_id: identity.user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, device_name: payload.device_name || null, browser: payload.browser || null, last_seen_at: new Date().toISOString(), is_active: true }, { onConflict: "endpoint" });
    if (error) throw error;
    return corsResponse({ ok: true });
  } catch (error) { return corsResponse({ error: "Push subscription could not be saved." }, 400); }
});
