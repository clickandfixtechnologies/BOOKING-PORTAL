import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

const permittedStatuses = new Set([
  "pending",
  "confirmed",
  "technician_assigned",
  "on_the_way",
  "in_progress",
  "job_id_created",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show"
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, year, mobile, token } = await request.json();

    const supabase = serviceClient();

    let query = supabase
      .from("appointments")
      .select(
        "id,appointment_id,customer_name,service_category,service_type,service_location_type,appointment_date,appointment_time,status,job_code,tracking_token,cancelled_at,rescheduled_at,completed_at"
      );

    /*
     * Secure tracking using tracking token
     */
    if (token) {
      query = query.eq("tracking_token", token);
    } else {
      /*
       * Validate customer-entered tracking details
       */
      const cleanMobile = String(mobile || "").replace(/\D/g, "");

      if (
        !/^\d{5}$/.test(code || "") ||
        !/^\d{4}$/.test(year || "") ||
        !/^[6-9]\d{9}$/.test(cleanMobile)
      ) {
        return corsResponse(
          {
            error:
              "Please check your Appointment Code and registered Mobile Number."
          },
          400
        );
      }

      query = query
        .eq("appointment_id", `CFX-APT-${year}-${code}`)
        .eq("mobile", cleanMobile);
    }

    const { data: appointment, error: appointmentError } =
      await query.maybeSingle();

    if (appointmentError) {
      console.error("Customer tracking query failed:", appointmentError);

      return corsResponse(
        {
          error:
            "We couldn't verify your appointment right now. Please try again."
        },
        500
      );
    }

    /*
     * No matching appointment
     */
    if (!appointment) {
      return corsResponse(
        {
          error:
            "Appointment Not Found. We couldn't find an appointment matching the details you entered. Please check your Appointment Code and registered Mobile Number and try again."
        },
        404
      );
    }

    /*
     * Appointment status history
     */
    const { data: history } = await supabase
      .from("appointment_status_history")
      .select("new_status,changed_at,note")
      .eq("appointment_id", appointment.id)
      .order("changed_at");

    return corsResponse({
      appointment: publicAppointment(
        appointment,
        appointment.tracking_token
      ),
      history: (history || []).filter((item) =>
        permittedStatuses.has(item.new_status)
      )
    });
  } catch (error) {
    console.error("Customer tracking error:", error);

    return corsResponse(
      {
        error:
          "We couldn't verify your appointment right now. Please try again."
      },
      500
    );
  }
});

function publicAppointment(
  a: Record<string, unknown>,
  token: string | null
) {
  const cutoff =
    new Date(
      `${a.appointment_date}T${String(a.appointment_time).slice(0, 5)}:00`
    ).getTime() - 3600000;

  const mutable =
    !["cancelled", "completed", "no_show"].includes(a.status as string) &&
    Date.now() < cutoff;

  return {
    appointment_id: a.appointment_id,
    customer_name: a.customer_name,

    // Raw values for frontend label mapping
    service_category: a.service_category,
    service_type: a.service_type,

    // Backward compatibility
    service: [a.service_category, a.service_type]
      .filter(Boolean)
      .join(" — "),

    service_location_type: a.service_location_type,
    appointment_date: a.appointment_date,
    appointment_time: String(a.appointment_time).slice(0, 5),
    status: a.status,
    job_code: a.job_code,
    can_cancel: mutable,
    can_reschedule: mutable,
    tracking_token: token
  };
}