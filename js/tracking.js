(function(){const c=window.CFX_CONFIG||{},base=(c.supabaseUrl||"").replace(/\/$/,""),form=document.getElementById("trackingForm"),out=document.getElementById("trackingResult"),modal=document.getElementById("trackingModal"),toast=document.getElementById("trackingToast");let result,token,busy=false;const labels={pending:"Booking Received",confirmed:"Confirmed",technician_assigned:"Technician Assigned",on_the_way:"Technician On The Way",in_progress:"Work In Progress",job_id_created:"Job ID Created",completed:"Completed",cancelled:"Cancelled",rescheduled:"Rescheduled",no_show:"No Show"},flow=["pending","confirmed","technician_assigned","on_the_way","in_progress","completed"],esc=v=>{let x=document.createElement("div");x.textContent=v??"—";return x.innerHTML};

const SERVICE_CATEGORY_LABELS={
computer_laptop:"Computer / Laptop Service",
cctv:"CCTV Installation / Service",
data_recovery:"Data Recovery",
networking_it:"Networking / IT Support",
printer_peripheral:"Printer / Peripheral Service",
other:"Other Service"
};

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

if(form)form.onsubmit=async e=>{e.preventDefault();let y=String(new Date().getFullYear()),k=code.value.trim(),m=mobile.value.replace(/\D/g,""),err=trackingError;if(!/^\d{5}$/.test(k)||!/^[6-9]\d{9}$/.test(m))return err.textContent="Enter the final five digits and registered 10-digit mobile number.";trackSubmit.disabled=true;trackSubmit.textContent="Checking…";try{sessionStorage.setItem("cfx-tracking",JSON.stringify(await api("customer-tracking",{year:y,code:k,mobile:m})));location.href="../track/"}catch(x){err.textContent=x.message;trackSubmit.disabled=false;trackSubmit.textContent="Track appointment"}};

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

function render(r){if(!r?.appointment)throw Error();result=r;let a=r.appointment;token=a.tracking_token;let stages=a.job_code?[...flow.slice(0,-1),"job_id_created","completed"]:flow,at=stages.indexOf(a.status);out.className="";out.innerHTML=`<section class="tracking-hero"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><small class="text-uppercase text-muted fw-semibold">Appointment</small><div class="tracking-code">${esc(a.appointment_id)}</div><p class="mb-0 text-muted">${esc(serviceLabel(a))}</p></div><span class="track-status ${a.status==="cancelled"?"cancelled":""}">${esc(labels[a.status]||a.status)}</span></div></section><div class="track-grid"><section class="tracking-card"><h1 class="h5 mb-3">Appointment summary</h1><div class="track-summary"><div><small>Scheduled date</small><strong>${esc(date(a.appointment_date))}</strong></div><div><small>Scheduled time</small><strong>${esc(time(a.appointment_time))}</strong></div><div><small>Customer</small><strong>${esc(a.customer_name)}</strong></div><div><small>Service location</small><strong>${esc(({service_centre:"Service Centre",home_office:"Home / Office",pickup_delivery:"Pickup / Delivery"})[a.service_location_type])}</strong></div></div>${a.status==="cancelled"?'<div class="alert alert-danger mt-3 mb-0"><strong>Appointment cancelled</strong><br>Your appointment remains visible for reference.</div>':""}${a.job_code?`<div class="alert alert-info mt-3 mb-0"><strong>Job ID Created</strong><br>${esc(a.job_code)}<br><small>For more information, please log in to your Customer Account.</small><br><a class="btn btn-sm btn-primary mt-2" href="https://clickandfix.site/admin/customer-login.html">Visit Customer Portal</a></div>`:""}</section><section class="tracking-card"><h2 class="h5">Service progress</h2><ol class="timeline">${stages.map((s,i)=>`<li class="${i<at||a.status==="completed"?"done":i===at?"current":""}"><strong>${esc(labels[s])}</strong></li>`).join("")}</ol>${["cancelled","rescheduled","no_show"].includes(a.status)?`<small class="text-muted">Latest update: ${esc(labels[a.status])}</small>`:""}</section></div><section class="tracking-card mt-3">
<h2 class="h5">Manage appointment</h2>
<p class="text-muted">
${a.job_code
  ? "Your Job ID has been created. Reschedule and cancellation are no longer available for this appointment."
  : "Availability and the service cutoff are checked again when you confirm."
}
</p>
<div class="track-actions">
<button id="reschedule" class="btn btn-outline-primary" ${a.job_code || !a.can_reschedule ? "disabled" : ""}>Reschedule appointment</button>
<button id="cancel" class="btn btn-outline-danger" ${a.job_code || !a.can_cancel ? "disabled" : ""}>Cancel appointment</button>
</div></section>`;reschedule?.addEventListener("click",openReschedule);cancel?.addEventListener("click",openCancel)}function istDate(n){let p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t).value,d=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}function openReschedule(){let selectedDate,selectedTime,dates=Array.from({length:28},(_,i)=>istDate(i+1));dialog(`<div class="d-flex justify-content-between"><div><h2 class="h4">Reschedule appointment</h2><p class="text-muted">Current: ${esc(date(result.appointment.appointment_date))} at ${esc(time(result.appointment.appointment_time))}</p></div><button class="btn-close" data-close></button></div><h3 class="h6">Choose a new date</h3><div id="dates" class="calendar-grid">${dates.map(d=>`<button data-date="${d}"><small>${new Date(`${d}T12:00:00`).toLocaleDateString("en-IN",{weekday:"short"})}</small><br>${new Date(`${d}T12:00:00`).getDate()}</button>`).join("")}</div><h3 class="h6 mt-4">Available time slots</h3><div id="slots" class="slot-grid"><span class="text-muted small">Choose a date to check availability.</span></div><p id="actionError" class="text-danger small mt-3"></p><div class="d-flex justify-content-end gap-2 mt-3"><button class="btn btn-outline-secondary" data-close>Cancel</button><button id="continueReschedule" disabled class="btn btn-primary">Continue</button></div>`);datesEl.onclick=async e=>{let b=e.target.closest("[data-date]");if(!b)return;selectedDate=b.dataset.date;selectedTime=null;datesEl.querySelectorAll("button").forEach(x=>x.classList.toggle("selected",x===b));slots.innerHTML="<span class='text-muted small'>Checking availability…</span>";continueReschedule.disabled=true;try{let d=await api("availability",{date:selectedDate});slots.innerHTML=(d.slots||[]).length?d.slots.map(s=>`<button data-time="${s.value}">${esc(s.label)}</button>`).join(""):`<span class="text-muted small">${esc(d.message||"No time slots are available for this date.")}</span>`}catch(x){actionError.textContent=x.message;slots.innerHTML=""}};slots.onclick=e=>{let b=e.target.closest("[data-time]");if(!b)return;selectedTime=b.dataset.time;slots.querySelectorAll("button").forEach(x=>x.classList.toggle("selected",x===b));continueReschedule.disabled=false};continueReschedule.onclick=()=>confirmReschedule(selectedDate,selectedTime)}function confirmReschedule(d,t){dialog(`<h2 class="h4">Confirm reschedule</h2><p>Reschedule this appointment to <strong>${esc(date(d))} at ${esc(time(t))}</strong>?</p><div class="d-flex justify-content-end gap-2 mt-4"><button data-close class="btn btn-outline-secondary">Cancel</button><button id="doReschedule" class="btn btn-primary">Confirm reschedule</button></div>`);doReschedule.onclick=()=>action("reschedule",d,t)}function openCancel(){dialog(`<h2 class="h4">Cancel appointment?</h2><p>Are you sure you want to cancel this appointment?<br>This action cannot be undone.</p><div class="d-flex justify-content-end gap-2 mt-4"><button data-close class="btn btn-outline-secondary">Keep appointment</button><button id="doCancel" class="btn btn-danger">Cancel appointment</button></div>`);doCancel.onclick=()=>action("cancel")}async function action(type,d,t){if(busy)return;busy=true;let b=document.getElementById(type==="cancel"?"doCancel":"doReschedule");b.disabled=true;b.textContent="Saving…";try{await api("customer-appointment-action",{token,action:type,new_date:d,new_time:t});close();notice(type==="cancel"?"Appointment Cancelled Successfully":"Appointment rescheduled successfully");render(await api("customer-tracking",{token}))}catch(x){notice(x.message,true)}finally{busy=false}}load()}());
(function () { [["datesEl", "dates"], ["slots", "slots"], ["continueReschedule", "continueReschedule"], ["actionError", "actionError"], ["doReschedule", "doReschedule"], ["doCancel", "doCancel"]].forEach(function (entry) { Object.defineProperty(window, entry[0], { configurable: true, get: function () { return document.getElementById(entry[1]); } }); }); }());