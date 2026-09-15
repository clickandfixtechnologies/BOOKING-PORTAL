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
  if (!subscriptions?.length) return log(appointment.id,"push","failed","No active Push subscriptions");
  const publicKey=Deno.env.get("VAPID_PUBLIC_KEY"), privateKey=Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return log(appointment.id,"push","failed","VAPID is not configured");
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || `mailto:${Deno.env.get("VAPID_CONTACT_EMAIL") || "admin@booking.clickandfix.site"}`, publicKey, privateKey);
  const payload=JSON.stringify({title:"New Appointment Received",body:appointment.customer_name,url:`${adminUrl()}#appointment=${encodeURIComponent(appointment.id)}`});
  const outcomes=await Promise.allSettled(subscriptions.map(async(s)=>{try { await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload); await db.from("admin_push_subscriptions").update({last_seen_at:new Date().toISOString(),is_active:true}).eq("id",s.id); } catch(error) { const status=(error as {statusCode?:number}).statusCode; if(status===404||status===410) await db.from("admin_push_subscriptions").update({is_active:false}).eq("id",s.id); throw error; }}));
  const failures=outcomes.filter((item)=>item.status==="rejected"); await log(appointment.id,"push",failures.length ? "failed":"sent",failures.length ? "One or more subscriptions failed" : undefined);
}
async function sendFormspree(appointment: Appointment) {
  const endpoint=Deno.env.get("FORMSPREE_ENDPOINT"); if(!endpoint) return log(appointment.id,"formspree","failed","FORMSPREE_ENDPOINT is not configured");
  try { const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({subject:"New Booking Received – Click & Fix Technologies",message:`New Booking Received\n\nCustomer Name: ${appointment.customer_name}\n\nLogin to Admin Panel:\n${adminUrl()}`})}); if(!response.ok) throw new Error(`Formspree returned ${response.status}`); await log(appointment.id,"formspree","sent"); } catch(error) { await log(appointment.id,"formspree","failed",error); }
}


async function sendBrevo(appointment: Appointment) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");

  if (!apiKey || !sender) {
    return log(
      appointment.id,
      "brevo",
      "failed",
      "Brevo is not configured"
    );
  }

 const track =
  `${Deno.env.get("PUBLIC_SITE_URL") || "https://booking.clickandfix.site"}/tracking/`;

  const serviceCategory = formatServiceCategory(
    appointment.service_category
  );

  const serviceType = appointment.service_type
    ? formatServiceType(appointment.service_type)
    : "";

  const serviceDisplay = serviceType
    ? `${serviceCategory} — ${serviceType}`
    : serviceCategory;

  const locationDisplay = formatLocation(
    appointment.service_location_type
  );

  const dateDisplay = formatDate(appointment.appointment_date);
  const timeDisplay = formatTime(appointment.appointment_time);

  const customerName = escapeHtml(appointment.customer_name);
  const appointmentId = escapeHtml(appointment.appointment_id);

  try {
    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey
        },
        body: JSON.stringify({
          sender: {
            email: sender,
            name: "Click & Fix Technologies"
          },

          to: [
            {
              email: appointment.email,
              name: appointment.customer_name
            }
          ],

          subject:
            `Appointment Request Received | Click & Fix Technologies`,

          htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Appointment Request Received</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f5f8;
  font-family:Arial,Helvetica,sans-serif;
  color:#1f2937;
">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f3f5f8;padding:35px 15px;"
  >
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:600px;
            width:100%;
            background:#ffffff;
            border-radius:14px;
            overflow:hidden;
            box-shadow:0 4px 18px rgba(0,0,0,0.08);
          "
        >

          <!-- Header -->
          <tr>
            <td
              style="
                background:#111827;
                padding:28px 30px;
                text-align:center;
              "
            >

              <div style="
                font-size:27px;
                line-height:34px;
                font-weight:700;
                color:#ffffff;
              ">
                Click &amp; Fix Technologies
              </div>

              <div style="
                margin-top:7px;
                font-size:13px;
                line-height:20px;
                color:#cbd5e1;
              ">
                Computer Repair&nbsp;&nbsp;•&nbsp;&nbsp;
                CCTV&nbsp;&nbsp;•&nbsp;&nbsp;
                Networking&nbsp;&nbsp;•&nbsp;&nbsp;
                IT Solutions
              </div>

            </td>
          </tr>


          <!-- Content -->
          <tr>
            <td style="padding:35px 32px 25px 32px;">

              <!-- Title -->
              <div style="
                font-size:26px;
                line-height:34px;
                font-weight:700;
                color:#111827;
                margin-bottom:12px;
              ">
                Appointment Request Received
              </div>

              <div style="
                font-size:16px;
                line-height:26px;
                color:#4b5563;
              ">
                Hello <strong style="color:#111827;">${customerName}</strong>,
              </div>

              <div style="
                margin-top:10px;
                font-size:15px;
                line-height:25px;
                color:#4b5563;
              ">
                Thank you for choosing Click &amp; Fix Technologies.
                We've successfully received your service request.
                Our team will review the request and confirm your
                appointment shortly.
              </div>


              <!-- Status -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  margin-top:25px;
                  background:#fff8e6;
                  border:1px solid #f6d98b;
                  border-radius:10px;
                "
              >
                <tr>
                  <td style="padding:16px 18px;">

                    <div style="
                      font-size:12px;
                      font-weight:700;
                      letter-spacing:0.5px;
                      color:#9a6700;
                      text-transform:uppercase;
                    ">
                      Current Status
                    </div>

                    <div style="
                      margin-top:5px;
                      font-size:18px;
                      font-weight:700;
                      color:#8a5a00;
                    ">
                      Awaiting Confirmation
                    </div>

                  </td>
                </tr>
              </table>


              <!-- Appointment Details -->
              <div style="
                margin-top:30px;
                font-size:18px;
                font-weight:700;
                color:#111827;
              ">
                Appointment Details
              </div>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  margin-top:12px;
                  border:1px solid #e5e7eb;
                  border-radius:10px;
                  overflow:hidden;
                "
              >

                <!-- Appointment ID -->
                <tr>
                  <td style="
                    padding:14px 16px;
                    width:38%;
                    background:#f9fafb;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    font-weight:700;
                    color:#6b7280;
                  ">
                    Appointment ID
                  </td>

                  <td style="
                    padding:14px 16px;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    font-weight:600;
                    color:#111827;
                  ">
                    ${appointmentId}
                  </td>
                </tr>


                <!-- Service -->
                <tr>
                  <td style="
                    padding:14px 16px;
                    background:#f9fafb;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    font-weight:700;
                    color:#6b7280;
                  ">
                    Service
                  </td>

                  <td style="
                    padding:14px 16px;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    color:#111827;
                  ">
                    ${escapeHtml(serviceDisplay)}
                  </td>
                </tr>


                <!-- Date -->
                <tr>
                  <td style="
                    padding:14px 16px;
                    background:#f9fafb;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    font-weight:700;
                    color:#6b7280;
                  ">
                    Date
                  </td>

                  <td style="
                    padding:14px 16px;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    color:#111827;
                  ">
                    ${dateDisplay}
                  </td>
                </tr>


                <!-- Time -->
                <tr>
                  <td style="
                    padding:14px 16px;
                    background:#f9fafb;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    font-weight:700;
                    color:#6b7280;
                  ">
                    Time
                  </td>

                  <td style="
                    padding:14px 16px;
                    border-bottom:1px solid #e5e7eb;
                    font-size:14px;
                    color:#111827;
                  ">
                    ${timeDisplay}
                  </td>
                </tr>


                <!-- Location -->
                <tr>
                  <td style="
                    padding:14px 16px;
                    background:#f9fafb;
                    font-size:14px;
                    font-weight:700;
                    color:#6b7280;
                  ">
                    Location
                  </td>

                  <td style="
                    padding:14px 16px;
                    font-size:14px;
                    color:#111827;
                  ">
                    ${locationDisplay}
                  </td>
                </tr>

              </table>


              <!-- CTA -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin-top:30px;"
              >
                <tr>
                  <td align="center">

                    <a
                      href="${escapeHtml(track)}"
                      style="
                        display:inline-block;
                        padding:14px 28px;
                        background:#2563eb;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:15px;
                        font-weight:700;
                        border-radius:8px;
                      "
                    >
                      View Appointment Status
                    </a>

                  </td>
                </tr>
              </table>


              <div style="
                margin-top:18px;
                text-align:center;
                font-size:13px;
                line-height:21px;
                color:#6b7280;
              ">
                You can use the button above to check the
                latest status of your appointment.
              </div>


            </td>
          </tr>


          <!-- Support -->
<tr>
  <td style="
    padding:25px 32px;
    background:#f9fafb;
    border-top:1px solid #e5e7eb;
  ">

    <div style="
      font-size:15px;
      font-weight:700;
      color:#111827;
    ">
      Need assistance?
    </div>

    <div style="
      margin-top:7px;
      font-size:13px;
      line-height:21px;
      color:#6b7280;
    ">
      If you have any questions regarding your appointment,
      please feel free to contact Click &amp; Fix Technologies.
    </div>

    <div style="
  margin-top:14px;
  font-size:13px;
  line-height:24px;
  color:#374151;
  white-space:nowrap;
">
  <strong>Website:</strong>
  <a
    href="https://www.clickandfix.site/"
    style="color:#2563eb; text-decoration:none;"
  >www.clickandfix.site</a>

  <span style="color:#9ca3af; padding:0 8px;">||</span>

  <strong>Mobile:</strong>
  <a
    href="tel:7098889990"
    style="color:#2563eb; text-decoration:none;"
  >7098889990</a>

  <span style="color:#9ca3af; padding:0 8px;">||</span>

  <strong>Email:</strong>
  <a
    href="mailto:info.clicknfixtech@gmail.com"
    style="color:#2563eb; text-decoration:none;"
  >info.clicknfixtech@gmail.com</a>
</div>

  </td>
</tr>


          <!-- Footer -->
          <tr>
            <td style="
              padding:22px 30px;
              text-align:center;
              background:#111827;
            ">

              <div style="
                font-size:14px;
                font-weight:700;
                color:#ffffff;
              ">
                Click &amp; Fix Technologies
              </div>

              <div style="
                margin-top:5px;
                font-size:12px;
                color:#9ca3af;
              ">
                Professional IT &amp; Technology Solutions
              </div>

              <div style="
                margin-top:12px;
                font-size:11px;
                color:#6b7280;
              ">
                © ${new Date().getFullYear()}
                Click &amp; Fix Technologies.
                All rights reserved.
              </div>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
          `
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Brevo returned ${response.status}`);
    }

    await log(appointment.id, "brevo", "sent");

  } catch (error) {
    await log(appointment.id, "brevo", "failed", error);
  }
}
function escapeHtml(value:string) { return value.replace(/[&<>'"]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[character]!)); }

function formatServiceCategory(value: string): string {
  const map: Record<string, string> = {
    computer_repair: "Computer Repair",
    laptop_repair: "Laptop Repair",
    cctv_installation: "CCTV Installation",
    cctv_maintenance: "CCTV Maintenance",
    networking_it: "Networking & IT",
    printer_repair: "Printer Repair",
    data_recovery: "Data Recovery"
  };

  return map[value] || humanize(value);
}


function formatServiceType(value: string): string {
  const map: Record<string, string> = {
    lan_cabling: "LAN Cabling",
    wifi_setup: "Wi-Fi Setup",
    router_configuration: "Router Configuration",
    network_troubleshooting: "Network Troubleshooting",
    cctv_camera_installation: "CCTV Camera Installation",
    cctv_camera_replacement: "CCTV Camera Replacement"
  };

  return map[value] || humanize(value);
}


function formatLocation(value: string): string {
  const map: Record<string, string> = {
    home_office: "Home / Office",
    office: "Office",
    home: "Home",
    shop: "Shop / Business",
    godown: "Godown / Warehouse"
  };

  return map[value] || humanize(value);
}


function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}


function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}


function formatTime(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return escapeHtml(value);
  }

  const hour = Number(match[1]);
  const minute = match[2];

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}