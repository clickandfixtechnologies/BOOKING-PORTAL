import { serviceClient } from "./supabase.ts";

export async function requireAdmin(request: Request) {

  const token = (request.headers.get("Authorization") || "")
    .replace("Bearer ", "")
    .trim();

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const supabase = serviceClient();

  const {
    data: identity,
    error: identityError
  } = await supabase.auth.getUser(token);

  if (identityError) {
    console.error(
      "ADMIN AUTH getUser ERROR:",
      identityError.message
    );

    throw new Error("AUTH_REQUIRED");
  }

  if (!identity?.user) {
    throw new Error("AUTH_REQUIRED");
  }

  const {
    data: admin,
    error: adminError
  } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", identity.user.id)
    .maybeSingle();

  if (adminError) {
    console.error(
      "ADMIN USER LOOKUP ERROR:",
      adminError.message
    );

    throw new Error("ADMIN_LOOKUP_FAILED");
  }

  if (!admin) {
    throw new Error("ADMIN_REQUIRED");
  }

  return {
    supabase,
    user: identity.user
  };
}


export async function requireTechnician(request: Request) {

  const token = (request.headers.get("Authorization") || "")
    .replace("Bearer ", "")
    .trim();

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const supabase = serviceClient();

  const {
    data: identity,
    error: identityError
  } = await supabase.auth.getUser(token);

  if (identityError) {
    console.error(
      "TECHNICIAN AUTH getUser ERROR:",
      identityError.message
    );

    throw new Error("AUTH_REQUIRED");
  }

  if (!identity?.user) {
    throw new Error("AUTH_REQUIRED");
  }

  const {
    data: technician,
    error: technicianError
  } = await supabase
    .from("technicians")
    .select("id,full_name,technician_code,is_active")
    .eq("auth_user_id", identity.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (technicianError) {
    console.error(
      "TECHNICIAN LOOKUP ERROR:",
      technicianError.message
    );

    throw new Error("TECHNICIAN_LOOKUP_FAILED");
  }

  if (!technician) {
    throw new Error("TECHNICIAN_REQUIRED");
  }

  return {
    supabase,
    user: identity.user,
    technician
  };
}