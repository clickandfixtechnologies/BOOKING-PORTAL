import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { notifyNewBooking } from "../_shared/notifications.ts";

const categories = new Set(["computer_laptop", "cctv", "data_recovery", "networking_it", "printer_peripheral", "other"]);
const locations = new Set(["service_centre", "home_office", "pickup_delivery"]);
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("cf-connecting-ip") || "unknown";
    const rateKey = await sha256(forwarded);
    const rate = await serviceClient().rpc("consume_booking_rate_limit", { request_key_input: rateKey });
    if (rate.error) throw new Error("Booking service is temporarily unavailable.");
    if (!rate.data) return corsResponse({ error: "Too many booking attempts. Please wait a few minutes and try again." }, 429);
    const payload = await request.json();
    validate(payload);
    const { data, error } = await serviceClient().rpc("create_public_appointment", { payload });
    if (error) return corsResponse({ error: safeDatabaseError(error.message) }, 409);
    const row = data;
    // Delivery channels run independently after persistence; notification failure never rolls back a booking.
    EdgeRuntime.waitUntil(notifyNewBooking(row));
    return corsResponse({ appointment: {
      appointment_id: row.appointment_id, customer_name: row.customer_name, mobile: row.mobile, email: row.email,
      service: [row.service_category, row.service_type].filter(Boolean).join(" — "), appointment_date: row.appointment_date,
      appointment_time: row.appointment_time.slice(0, 5), service_address: row.service_address
    } }, 201);
  } catch (error) { return corsResponse({ error: error.message || "Invalid booking request." }, 400); }
});
function validate(p: Record<string, unknown>) {
  const required = ["customer_name", "mobile", "email", "service_category", "service_location_type", "appointment_date", "appointment_time"];
  if (required.some((key) => typeof p[key] !== "string" || !(p[key] as string).trim())) throw new Error("Please complete all required fields.");
  if (!categories.has(p.service_category as string) || !locations.has(p.service_location_type as string)) throw new Error("Invalid service selection.");
  if (!/^[6-9]\d{9}$/.test((p.mobile as string).replace(/\D/g, ""))) throw new Error("Enter a valid 10-digit Indian mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email as string)) throw new Error("Enter a valid email address.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.appointment_date as string) || !/^\d{2}:\d{2}$/.test(p.appointment_time as string)) throw new Error("Invalid appointment date or time.");
  if (p.service_location_type === "home_office") {
    if (typeof p.service_address !== "string" || !p.service_address.trim() || !Number.isFinite(Number(p.latitude)) || !Number.isFinite(Number(p.longitude))) throw new Error("A service address and verified GPS location are required for a Home / Office visit.");
  }
  if (p.photo_references !== undefined && (!Array.isArray(p.photo_references) || p.photo_references.some((path) => typeof path !== "string" || !/^pending\/[a-f0-9-]+\.(jpeg|png|webp)$/.test(path)))) throw new Error("Invalid photo reference.");
}
function safeDatabaseError(message: string) { return /no longer available|unavailable|outside business|past/.test(message) ? message : "This appointment could not be saved. Please choose another slot and try again."; }
async function sha256(value: string) { const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
