import { serviceClient } from "./supabase.ts";
export async function requireAdmin(request: Request) {
  const token = (request.headers.get("Authorization") || "").replace("Bearer ", "");
  const supabase = serviceClient();
  const { data: identity } = await supabase.auth.getUser(token);
  if (!identity.user) throw new Error("AUTH_REQUIRED");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", identity.user.id).maybeSingle();
  if (!admin) throw new Error("ADMIN_REQUIRED");
  return { supabase, user: identity.user };
}

export async function requireTechnician(request: Request) {
  const token = (request.headers.get("Authorization") || "").replace("Bearer ", "");
  const supabase = serviceClient();
  const { data: identity } = await supabase.auth.getUser(token);
  if (!identity.user) throw new Error("AUTH_REQUIRED");
  const { data: technician } = await supabase.from("technicians").select("id,full_name,technician_code,is_active").eq("auth_user_id", identity.user.id).eq("is_active", true).maybeSingle();
  if (!technician) throw new Error("TECHNICIAN_REQUIRED");
  return { supabase, user: identity.user, technician };
}
