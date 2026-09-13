import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const form = await request.formData(); const photo = form.get("photo");
    if (!(photo instanceof File) || !allowed.has(photo.type) || photo.size > 5 * 1024 * 1024) return corsResponse({ error: "Upload a JPG, PNG, or WebP image no larger than 5 MB." }, 400);
    const extension = photo.type.split("/")[1]; const path = `pending/${crypto.randomUUID()}.${extension}`;
    const { error } = await serviceClient().storage.from("appointment-photos").upload(path, photo, { contentType: photo.type, upsert: false });
    if (error) throw error;
    return corsResponse({ path }, 201);
  } catch (_) { return corsResponse({ error: "Photo upload failed." }, 400); }
});
