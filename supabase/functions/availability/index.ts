import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { date } = await request.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return corsResponse({ error: "A valid appointment date is required." }, 400);
    const supabase = serviceClient();
    let configResult = await supabase.from("business_availability").select("*").eq("id", true).maybeSingle();
    if (!configResult.data && !configResult.error) {
      // The migration normally seeds this. This server-side fallback protects a
      // fresh project where the initial row was accidentally omitted.
      await supabase.from("business_availability").insert({ id: true });
      configResult = await supabase.from("business_availability").select("*").eq("id", true).maybeSingle();
    }
    const [blocksResult, appointmentsResult] = await Promise.all([
      supabase.from("availability_blocks").select("starts_at,ends_at").eq("block_date", date),
      supabase.from("appointments").select("appointment_time").eq("appointment_date", date).not("status", "in", "(cancelled,rescheduled)")
    ]);
    if (configResult.error || blocksResult.error || appointmentsResult.error) throw new Error("Availability could not be loaded.");
    const config = configResult.data;
    const day = isoWeekday(date);
    const now = kolkataNow();
    const today = kolkataDate(now);
    const minimum = new Date(now.getTime() + (config.minimum_advance_minutes || 0) * 60000);
    const minimumDate = kolkataDate(minimum);
    const latest = addKolkataDays(today, config.maximum_future_days || 90);
    if (date > latest || date < minimumDate) return corsResponse({ slots: [], message: "Appointments are unavailable on this date." });
    if (!config.business_days.includes(day)) return corsResponse({ slots: [], message: "Appointments are unavailable on this day." });
    if (blocksResult.data.some((block) => !block.starts_at)) return corsResponse({ slots: [], message: "Appointments are unavailable on this date." });
    const bookedBySlot = new Map<string, number>();
    appointmentsResult.data.forEach((item) => {
      const slot = item.appointment_time.slice(0, 5);
      bookedBySlot.set(slot, (bookedBySlot.get(slot) || 0) + 1);
    });
    const blocks = blocksResult.data;
    const slots = [];
    const opening = toMinutes(config.opening_time), closing = toMinutes(config.closing_time);
    const earliestMinutes = date === minimumDate ? kolkataMinutes(minimum) : 0;
    for (let minute = opening; minute + config.slot_duration_minutes <= closing; minute += config.slot_duration_minutes + config.buffer_minutes) {
      const value = fromMinutes(minute);
      const blocked = blocks.some((block) => value >= block.starts_at.slice(0, 5) && value < block.ends_at.slice(0, 5));
      if (blocked || minute < earliestMinutes || (bookedBySlot.get(value) || 0) >= config.max_appointments_per_slot) continue;
      slots.push({ value, label: formatTime(minute) });
    }
    return corsResponse({ slots });
  } catch (error) { return corsResponse({ error: error.message || "Availability could not be loaded." }, 500); }
});
function toMinutes(value: string) { const [hours, minutes] = value.slice(0, 5).split(":").map(Number); return hours * 60 + minutes; }
function fromMinutes(value: number) { return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0"); }
function formatTime(value: number) { const hour = Math.floor(value / 60); return `${hour % 12 || 12}:${String(value % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`; }
function kolkataNow() { return new Date(); }
function kolkataDate(now: Date) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const value = (type: string) => parts.find((part) => part.type === type)?.value || ""; return `${value("year")}-${value("month")}-${value("day")}`; }
function kolkataMinutes(now: Date) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now); const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0); return value("hour") * 60 + value("minute"); }
function isoWeekday(date: string) { const value = new Date(`${date}T12:00:00Z`).getUTCDay(); return value === 0 ? 7 : value; }
function addKolkataDays(date: string, days: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
