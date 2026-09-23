(function(){const c=window.CFX_CONFIG||{},base=(c.supabaseUrl||"").replace(/\/$/,""),form=document.getElementById("trackingForm"),out=document.getElementById("trackingResult"),modal=document.getElementById("trackingModal"),toast=document.getElementById("trackingToast");let result,token,busy=false;const labels={pending:"Booking Received",confirmed:"Confirmed",technician_assigned:"Technician Assigned",on_the_way:"Technician On The Way",in_progress:"Work In Progress",job_id_created:"Job ID Created",completed:"Completed",cancelled:"Cancelled",rescheduled:"Rescheduled",no_show:"No Show"},flow=["pending","confirmed","technician_assigned","on_the_way","in_progress","completed"],esc=v=>{let x=document.createElement("div");x.textContent=v??"—";return x.innerHTML};

const SERVICE_CATEGORY_LABELS={
computer_laptop:"Computer / Laptop Service",
cctv:"CCTV Installation / Service",
data_recovery:"Data Recovery",
networking_it:"Networking / IT Support",
printer_peripheral:"Printer / Peripheral Service",
other:"Other Service"
};

function showTrackingAlert(title, message) {
  if (!toast) return;

  toast.innerHTML = `
    <div class="tracking-alert-content">
      <div class="tracking-alert-icon">!</div>

      <div class="tracking-alert-text">
        <strong>${esc(title)}</strong>
        <span>${esc(message)}</span>
      </div>

      <button type="button" class="tracking-alert-close" aria-label="Close">
        &times;
      </button>
    </div>
  `;

  toast.className = "track-toast error";
  toast.hidden = false;

  const closeButton = toast.querySelector(".tracking-alert-close");

  if (closeButton) {
    closeButton.onclick = () => {
      toast.hidden = true;
    };
  }

  clearTimeout(showTrackingAlert.timer);

  showTrackingAlert.timer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

const SERVICE_TYPE_LABELS={
laptop_repair:"Laptop Repair",
desktop_repair:"Desktop / Computer Repair",
windows_software:"Windows / Software Installation",
ssd_upgrade:"SSD Upgrade / Replacement",
ram_upgrade:"RAM Upgrade / Replacement",
motherboard_repair:"Motherboard Repair",
other_computer:"Other Computer / Laptop Service",

new_cctv_installation:"New CCTV Installation",
cctv_repair:"CCTV Repair / Service",
camera_replacement:"Camera Replacement",
dvr_nvr_service:"DVR / NVR Service",
cctv_configuration:"CCTV Configuration",
other_cctv:"Other CCTV Service",

hard_disk_recovery:"Hard Disk Data Recovery",
ssd_data_recovery:"SSD Data Recovery",
pendrive_recovery:"Pen Drive / USB Data Recovery",
memory_card_recovery:"Memory Card Data Recovery",
other_data_recovery:"Other Data Recovery",

network_setup:"Network Setup",
router_configuration:"Router Configuration",
wifi_troubleshooting:"Wi-Fi Troubleshooting",
lan_cabling:"LAN / Network Cabling",
it_support:"General IT Support",
other_networking:"Other Networking / IT Service",

printer_repair:"Printer Repair / Service",
printer_installation:"Printer Installation",
printer_configuration:"Printer Configuration",
scanner_service:"Scanner Service",
peripheral_service:"Other Peripheral Service",

other_service:"Other Service"
};

function serviceLabel(a){
const category=SERVICE_CATEGORY_LABELS[a.service_category]||a.service_category||"";
const type=SERVICE_TYPE_LABELS[a.service_type]||a.service_type||"";
if(category&&type)return`${category} - ${type}`;
return a.service||"—";
}

async function api(name,body){if(!base||!c.supabaseAnonKey)throw Error("Tracking is not configured.");let r=await fetch(`${base}/functions/v1/${name}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:`Bearer ${c.supabaseAnonKey}`},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Appointment details could not be verified.");return d}function date(v){return new Date(`${v}T12:00:00`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"long",year:"numeric"})}function time(v){let[h,m]=v.slice(0,5).split(":").map(Number);return`${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`}function notice(x,error){if(!toast)return;toast.textContent=x;toast.className=`track-toast${error?" error":""}`;toast.hidden=false;clearTimeout(notice.t);notice.t=setTimeout(()=>toast.hidden=true,4200)}function close(){if(modal){modal.hidden=true;modal.innerHTML=""}}function dialog(html){modal.innerHTML=`<section class="track-dialog" role="dialog" aria-modal="true">${html}</section>`;modal.hidden=false;modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=close)}if(modal){modal.onclick=e=>e.target===modal&&close();document.addEventListener("keydown",e=>e.key==="Escape"&&close())}

if(form)form.onsubmit=async e=>{e.preventDefault();let y=String(new Date().getFullYear()),k=code.value.trim(),m=mobile.value.replace(/\D/g,""),err=trackingError;
    
    if (!/^\d{5}$/.test(k) || !/^[6-9]\d{9}$/.test(m)) {
  showTrackingAlert(
    "Check Your Details",
    "Please enter the final five digits of your Appointment Code and your registered 10-digit mobile number."
  );

  err.textContent = "";
  return;
}
    
    trackSubmit.disabled=true;trackSubmit.textContent="Checking…";try{sessionStorage.setItem("cfx-tracking",JSON.stringify(await api("customer-tracking",{year:y,code:k,mobile:m})));location.href="../track/"

}catch(x){
  showTrackingAlert(
    "Appointment Not Found",
    "We couldn't find an appointment with the details you entered. Please check your Appointment Code and registered Mobile Number and try again."
  );

  err.textContent = "";
  trackSubmit.disabled = false;
  trackSubmit.textContent = "Track appointment";
}};

async function load() {

    if (!out) {
        return;
    }

    try {

        const part =
            location.pathname
                .split("/")
                .filter(Boolean)
                .at(-1);


        /*
         * If the URL itself contains a secure tracking token,
         * always fetch fresh appointment data from Supabase.
         */

        if (
            part &&
            /^[0-9a-f-]{36}$/i.test(part)
        ) {

            const fresh =
                await api(
                    "customer-tracking",
                    {
                        token: part
                    }
                );

            sessionStorage.setItem(
                "cfx-tracking",
                JSON.stringify(fresh)
            );

            render(fresh);

            return;
        }


        /*
         * Normal /track/ page.
         *
         * The previous implementation only rendered the
         * sessionStorage copy here.
         *
         * Now we use the saved secure tracking token to
         * fetch the latest appointment data from Supabase.
         */

        const saved =
            JSON.parse(
                sessionStorage.getItem(
                    "cfx-tracking"
                ) || "null"
            );


        if (
            saved &&
            saved.appointment &&
            saved.appointment.tracking_token
        ) {

            const fresh =
                await api(
                    "customer-tracking",
                    {
                        token:
                            saved.appointment
                                .tracking_token
                    }
                );


            /*
             * Replace the cached data with the
             * latest server response.
             */

            sessionStorage.setItem(
                "cfx-tracking",
                JSON.stringify(fresh)
            );


            render(fresh);

            return;
        }


        /*
         * No saved tracking session available.
         */

        throw new Error(
            "Tracking session not found."
        );

    } catch (error) {

        console.error(
            "Tracking load failed:",
            error
        );

        out.className =
            "tracking-card mt-4 text-center";

        out.innerHTML =
            "<h1 class='h4'>We could not verify this appointment</h1>" +
            "<p class='text-muted mb-0'>" +
            "Please return to tracking and check the details you entered." +
            "</p>";
    }
}

function render(r){
    if(!r?.appointment) throw Error();

    result = r;

    let a = r.appointment;

    token = a.tracking_token;

    /*
     * Timeline
     * Job ID থাকলে Job ID Created দেখাবে।
     * Job ID না থাকলে সরাসরি In Progress → Completed থাকবে।
     */
    let stages = a.job_code
        ? [...flow.slice(0,-1),"job_id_created","completed"]
        : flow;

    let at = stages.indexOf(a.status);

    /*
     * Technician data
     *
     * Supports:
     * a.technicians
     * a.technician
     * flat technician fields
     */
    const technician =
        a.technicians ||
        a.technician ||
        {};

    const technicianName =
        technician.full_name ||
        technician.name ||
        a.technician_name ||
        "";

    const technicianMobile =
        technician.mobile ||
        technician.phone ||
        a.technician_mobile ||
        "";

    /*
     * Status history
     *
     * Supports different possible response keys.
     */
    const history =
        Array.isArray(a.appointment_status_history)
            ? a.appointment_status_history
            : Array.isArray(a.status_history)
                ? a.status_history
                : Array.isArray(r.status_history)
                    ? r.status_history
                    : [];

    /*
     * Find timestamp for a particular status.
     */
    function statusTime(status){

        const item = history.find(
            x =>
                x.new_status === status ||
                x.status === status
        );

        if(item){
            return (
                item.changed_at ||
                item.created_at ||
                item.updated_at ||
                null
            );
        }

        /*
         * Booking received can use appointment creation time.
         */
        if(
            status === "pending" &&
            a.created_at
        ){
            return a.created_at;
        }

        /*
         * Current status can use updated_at
         * when status history is unavailable.
         */
        if(
            status === a.status &&
            a.updated_at
        ){
            return a.updated_at;
        }

        return null;
    }

    /*
     * Format timeline date/time.
     */
    function statusDateTime(value){

        if(!value) return "";

        const d = new Date(value);

        if(Number.isNaN(d.getTime())) return "";

        return d.toLocaleString("en-IN",{
            day:"numeric",
            month:"short",
            hour:"numeric",
            minute:"2-digit",
            hour12:true
        });
    }

    /*
     * Status icon.
     */
    function statusIcon(status){

        if(status === "completed"){
            return '<i class="fa-solid fa-check"></i>';
        }

        if(status === "cancelled"){
            return '<i class="fa-solid fa-xmark"></i>';
        }

        if(status === "rescheduled"){
            return '<i class="fa-solid fa-calendar-days"></i>';
        }

        if(status === "no_show"){
            return '<i class="fa-solid fa-user-xmark"></i>';
        }

        if(status === "technician_assigned"){
            return '<i class="fa-solid fa-user-gear"></i>';
        }

        if(status === "on_the_way"){
            return '<i class="fa-solid fa-location-arrow"></i>';
        }

        if(status === "in_progress"){
            return '<i class="fa-solid fa-screwdriver-wrench"></i>';
        }

        if(status === "job_id_created"){
            return '<i class="fa-solid fa-ticket"></i>';
        }

        if(status === "confirmed"){
            return '<i class="fa-solid fa-check"></i>';
        }

        return '<i class="fa-solid fa-check"></i>';
    }

    /*
     * Service location label.
     */
    const locationLabel =
        ({
            service_centre:"Service Centre",
            home_office:"Home / Office",
            pickup_delivery:"Pickup / Delivery"
        })[a.service_location_type] ||
        a.service_location_type ||
        "—";

    /*
     * Technician section.
     */
    const technicianHtml = technicianName
        ? `
            <div class="track-technician">

                <div class="track-technician-avatar">
                    <i class="fa-solid fa-user-gear"></i>
                </div>

                <div class="track-technician-info">

                    <small>Assigned Technician</small>

                    <strong>
                        ${esc(technicianName)}
                    </strong>

                    ${
                        technicianMobile
                            ? `
                                <span>
                                    ${esc(technicianMobile)}
                                </span>
                              `
                            : ""
                    }

                </div>

                ${
                    technicianMobile
                        ? `
                            <a
                                class="track-technician-call"
                                href="tel:${esc(
                                    String(technicianMobile)
                                        .replace(/\D/g,"")
                                )}"
                                aria-label="Call technician"
                            >
                                <i class="fa-solid fa-phone"></i>
                            </a>
                          `
                        : ""
                }

            </div>
          `
        : `
            <div class="track-technician track-technician-empty">

                <div class="track-technician-avatar">
                    <i class="fa-solid fa-user-clock"></i>
                </div>

                <div class="track-technician-info">
                    <small>Assigned Technician</small>
                    <strong>Technician will be assigned soon</strong>
                </div>

            </div>
          `;

    /*
     * Timeline.
     */
    const timelineHtml = stages.map((s,i)=>{

        const done =
            i < at ||
            a.status === "completed";

        const current =
            i === at &&
            a.status !== "completed";

        const timestamp =
            statusDateTime(
                statusTime(s)
            );

        return `
            <li
                class="
                    ${done ? "done" : ""}
                    ${current ? "current" : ""}
                "
            >

                <div class="timeline-line"></div>

                <div class="timeline-dot">
                    ${statusIcon(s)}
                </div>

                <div class="timeline-content">

                    <strong>
                        ${esc(labels[s] || s)}
                    </strong>

                    ${
                        timestamp
                            ? `
                                <small>
                                    ${esc(timestamp)}
                                </small>
                              `
                            : ""
                    }

                </div>

            </li>
        `;

    }).join("");

    /*
     * Special status message.
     */
    const specialStatus =
        ["cancelled","rescheduled","no_show"].includes(a.status)
            ? `
                <div class="track-status-note ${
                    a.status === "cancelled"
                        ? "danger"
                        : ""
                }">

                    <i class="fa-solid fa-circle-info"></i>

                    <span>
                        Latest update:
                        <strong>
                            ${esc(labels[a.status] || a.status)}
                        </strong>
                    </span>

                </div>
              `
            : "";

    /*
     * Job ID card.
     */
    const jobHtml = a.job_code
        ? `
            <div class="track-job-card">

                <div class="track-job-icon">
                    <i class="fa-solid fa-ticket"></i>
                </div>

                <div class="track-job-content">

                    <small>Job ID Created</small>

                    <strong>
                        ${esc(a.job_code)}
                    </strong>

                    <p>
                        For more information, please log in to your
                        Customer Account.
                    </p>

                    <a
                        class="track-job-button"
                        href="https://clickandfix.site/admin/customer-login.html"
                    >
                        Visit Customer Portal
                        <i class="fa-solid fa-arrow-right"></i>
                    </a>

                </div>

            </div>
          `
        : "";

    /*
     * Render complete tracking page.
     */
    out.className = "";

    out.innerHTML = `

        <!-- Appointment Hero -->

        <section class="tracking-hero">

            <div class="tracking-live-pill">
                <span class="tracking-live-dot"></span>
                Live Tracking
            </div>

            <div class="tracking-hero-main">

                <div class="tracking-hero-left">

                    <div class="tracking-appointment-label">

                        <span>
                            Appointment
                        </span>

                        <span class="tracking-verified">
                            <i class="fa-solid fa-check"></i>
                            Verified
                        </span>

                    </div>

                    <div class="tracking-id-row">

                        <div class="tracking-code">
                            ${esc(a.appointment_id)}
                        </div>

                        <button
                            type="button"
                            id="copyAppointmentId"
                            class="tracking-copy-button"
                            title="Copy Appointment ID"
                        >
                            <i class="fa-regular fa-copy"></i>
                        </button>

                    </div>

                    <p class="tracking-service-name">
                        ${esc(serviceLabel(a))}
                    </p>

                </div>

                <span
                    class="
                        track-status
                        ${a.status === "cancelled" ? "cancelled" : ""}
                    "
                >
                    <i class="fa-solid fa-circle-check"></i>
                    ${esc(labels[a.status] || a.status)}
                </span>

            </div>

        </section>


        <!-- Main Grid -->

        <div class="track-grid">


            <!-- Appointment Summary -->

            <section class="tracking-card tracking-summary-card">

                <div class="tracking-section-heading">

                    <h2>
                        <i class="fa-solid fa-file-lines"></i>
                        Appointment summary
                    </h2>

                    <span>
                        ID:
                        #${esc(
                            String(a.appointment_id || "")
                                .split("-")
                                .pop() || "—"
                        )}
                    </span>

                </div>


                <div class="track-summary">


                    <!-- Date -->

                    <div class="track-summary-item">

                        <div class="track-summary-label">

                            <i class="fa-regular fa-calendar-days"></i>

                            <span>
                                Scheduled date
                            </span>

                        </div>

                        <strong>
                            ${esc(
                                date(a.appointment_date)
                            )}
                        </strong>

                    </div>


                    <!-- Time -->

                    <div class="track-summary-item">

                        <div class="track-summary-label">

                            <i class="fa-regular fa-clock"></i>

                            <span>
                                Scheduled time
                            </span>

                        </div>

                        <strong>
                            ${esc(
                                time(a.appointment_time)
                            )}
                        </strong>

                    </div>


                    <!-- Customer -->

                    <div class="track-summary-item">

                        <div class="track-summary-label">

                            <i class="fa-regular fa-user"></i>

                            <span>
                                Customer
                            </span>

                        </div>

                        <strong>
                            ${esc(a.customer_name)}
                        </strong>

                    </div>


                    <!-- Location -->

                    <div class="track-summary-item">

                        <div class="track-summary-label">

                            <i class="fa-solid fa-location-dot"></i>

                            <span>
                                Service location
                            </span>

                        </div>

                        <strong>
                            ${esc(locationLabel)}
                        </strong>

                    </div>

                </div>


                ${
                    a.status === "cancelled"
                        ? `
                            <div class="track-cancelled-alert">

                                <i class="fa-solid fa-circle-xmark"></i>

                                <div>
                                    <strong>
                                        Appointment cancelled
                                    </strong>

                                    <span>
                                        Your appointment remains visible
                                        for reference.
                                    </span>
                                </div>

                            </div>
                          `
                        : ""
                }


                ${jobHtml}


                <!-- Technician -->

                <div class="track-technician-wrapper">

                    ${technicianHtml}

                </div>

            </section>


            <!-- Service Progress -->

            <section class="tracking-card tracking-progress-card">

                <div class="tracking-section-heading">

                    <h2>
                        <i class="fa-solid fa-bars-progress"></i>
                        Service progress
                    </h2>

                </div>


                <ol class="timeline">

                    ${timelineHtml}

                </ol>


                ${specialStatus}


                <!-- Rate Service -->

                ${
                    a.status === "completed"
                        ? `
                            <div class="track-rate-wrapper">

                                <button
                                    id="rateService"
                                    type="button"
                                    class="track-rate-button"
                                >
                                    <i class="fa-solid fa-star"></i>
                                    Rate Service Experience
                                </button>

                            </div>
                          `
                        : ""
                }

            </section>

        </div>


        <!-- Manage Appointment -->

        <section class="tracking-card tracking-manage-card">

            <div class="tracking-section-heading manage-heading">

                <div>

                    <h2>
                        Manage appointment
                    </h2>

                    <p>
                        ${
                            a.job_code
                                ? "Your Job ID has been created. Reschedule and cancellation are no longer available for this appointment."
                                : "Availability and the service cutoff are checked again when you confirm."
                        }
                    </p>

                </div>

            </div>


            <div class="track-actions">

                <button
                    id="reschedule"
                    class="btn btn-outline-primary"
                    ${a.job_code || !a.can_reschedule ? "disabled" : ""}
                >
                    <i class="fa-regular fa-calendar-plus"></i>
                    Reschedule appointment
                </button>


                <button
                    id="cancel"
                    class="btn btn-outline-danger"
                    ${a.job_code || !a.can_cancel ? "disabled" : ""}
                >
                    <i class="fa-regular fa-circle-xmark"></i>
                    Cancel appointment
                </button>

            </div>

        </section>

    `;


    /*
     * Copy Appointment ID.
     */
    const copyButton =
        document.getElementById("copyAppointmentId");

    if(copyButton){

        copyButton.addEventListener(
            "click",
            async function(){

                try{

                    await navigator.clipboard.writeText(
                        String(a.appointment_id || "")
                    );

                    notice(
                        "Appointment ID copied successfully."
                    );

                }catch(_){

                    notice(
                        "Unable to copy Appointment ID.",
                        true
                    );

                }

            }
        );

    }


    /*
     * Rate Service Experience.
     */
    const rateButton =
        document.getElementById("rateService");

    if(rateButton){

        rateButton.addEventListener(
            "click",
            function(){

                dialog(`

                    <div class="tracking-feedback-modal">

                        <div class="d-flex justify-content-between align-items-center mb-3">

                            <div>

                                <h2 class="h5 mb-1">
                                    Rate Your Experience
                                </h2>

                                <p class="text-muted small mb-0">
                                    How was your service experience?
                                </p>

                            </div>

                            <button
                                class="btn-close"
                                data-close
                            ></button>

                        </div>


                        <div
                            class="tracking-rating-stars"
                            id="trackingRatingStars"
                        >

                            <button data-rating="1">
                                <i class="fa-solid fa-star"></i>
                            </button>

                            <button data-rating="2">
                                <i class="fa-solid fa-star"></i>
                            </button>

                            <button data-rating="3">
                                <i class="fa-solid fa-star"></i>
                            </button>

                            <button data-rating="4">
                                <i class="fa-solid fa-star"></i>
                            </button>

                            <button data-rating="5">
                                <i class="fa-solid fa-star"></i>
                            </button>

                        </div>


                        <textarea
                            id="trackingFeedbackText"
                            class="form-control mt-3"
                            rows="3"
                            placeholder="Write a short feedback..."
                        ></textarea>


                        <div class="d-flex justify-content-end gap-2 mt-3">

                            <button
                                class="btn btn-outline-secondary"
                                data-close
                            >
                                Skip
                            </button>

                            <button
                                id="submitTrackingFeedback"
                                class="btn btn-primary"
                            >
                                Submit Feedback
                            </button>

                        </div>

                    </div>

                `);


                let selectedRating = 0;

                const stars =
                    document.querySelectorAll(
                        "#trackingRatingStars button"
                    );

                stars.forEach(
                    function(star){

                        star.addEventListener(
                            "click",
                            function(){

                                selectedRating =
                                    Number(
                                        star.dataset.rating
                                    );

                                stars.forEach(
                                    function(item){

                                        item.classList.toggle(
                                            "selected",
                                            Number(
                                                item.dataset.rating
                                            ) <= selectedRating
                                        );

                                    }
                                );

                            }
                        );

                    }
                );


                const submit =
                    document.getElementById(
                        "submitTrackingFeedback"
                    );

                if(submit){

                    submit.addEventListener(
                        "click",
                        function(){

                            if(!selectedRating){

                                notice(
                                    "Please select a rating first.",
                                    true
                                );

                                return;
                            }

                            close();

                            notice(
                                "Thank you for your feedback!"
                            );

                        }
                    );

                }

            }
        );

    }


       /*
     * Existing appointment actions.
     */
    const rescheduleButton =
        document.getElementById("reschedule");

    const cancelButton =
        document.getElementById("cancel");


    rescheduleButton?.addEventListener(
        "click",
        openReschedule
    );

    cancelButton?.addEventListener(
        "click",
        openCancel
    );
}

load();

}());