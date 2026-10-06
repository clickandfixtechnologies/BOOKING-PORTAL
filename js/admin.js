import{createClient}from"https://esm.sh/@supabase/supabase-js@2";const c=window.CFX_CONFIG||{},s=c.supabaseUrl&&createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}),q=document.getElementById("content"),flashBox=document.getElementById("flash"),S=["pending","confirmed","technician_assigned","on_the_way","in_progress","job_id_created","completed","cancelled","rescheduled","no_show"],L=x=>(x||"").replaceAll("_"," ").replace(/\b\w/g,a=>a.toUpperCase()),e=x=>{const d=document.createElement("div");d.textContent=x??"—";return d.innerHTML};

const SERVICE_CATEGORY_LABELS = {
  computer_laptop: "Computer / Laptop Service",
  cctv: "CCTV Installation / Service",
  data_recovery: "Data Recovery",
  networking_it: "Networking / IT Support",
  printer_peripheral: "Printer / Peripheral Service",
  other: "Other Service"
};

const SERVICE_TYPE_LABELS = {
  laptop_repair: "Laptop Repair",
  desktop_repair: "Desktop / Computer Repair",
  windows_software: "Windows / Software Installation",
  ssd_upgrade: "SSD Upgrade / Replacement",
  ram_upgrade: "RAM Upgrade / Replacement",
  motherboard_repair: "Motherboard Repair",
  other_computer: "Other Computer / Laptop Service",

  new_cctv_installation: "New CCTV Installation",
  cctv_repair: "CCTV Repair / Service",
  camera_replacement: "Camera Replacement",
  dvr_nvr_service: "DVR / NVR Service",
  cctv_configuration: "CCTV Configuration",
  other_cctv: "Other CCTV Service",

  hard_disk_recovery: "Hard Disk Data Recovery",
  ssd_data_recovery: "SSD Data Recovery",
  pendrive_recovery: "Pen Drive / USB Data Recovery",
  memory_card_recovery: "Memory Card Data Recovery",
  other_data_recovery: "Other Data Recovery",

  network_setup: "Network Setup",
  router_configuration: "Router Configuration",
  wifi_troubleshooting: "Wi-Fi Troubleshooting",
  lan_cabling: "LAN / Network Cabling",
  it_support: "General IT Support",
  other_networking: "Other Networking / IT Service",

  printer_repair: "Printer Repair / Service",
  printer_installation: "Printer Installation",
  printer_configuration: "Printer Configuration",
  scanner_service: "Scanner Service",
  peripheral_service: "Other Peripheral Service",

  other_service: "Other Service"
};

function serviceCategoryLabel(value) {
  return SERVICE_CATEGORY_LABELS[value] || value || "—";
}

function serviceTypeLabel(value) {
  return SERVICE_TYPE_LABELS[value] || value || "—";
}

function formatAppointmentDateTime(date, time) {
    if (!date) return "—";

    const cleanTime = String(time || "").slice(0, 8);

    const dateTime = new Date(`${date}T${cleanTime}`);

    if (Number.isNaN(dateTime.getTime())) {
        return `${date} ${time || ""}`.trim();
    }

    const formattedDate = dateTime.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const formattedTime = dateTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    return `${formattedDate} · ${formattedTime}`;
}

let filter={},refreshInFlight;async function getValidAccessToken(){let{data:{session}}=await s.auth.getSession();if(!session)throw Error("Sign in is required.");if(!session.expires_at||session.expires_at*1000-Date.now()>60000)return session.access_token;refreshInFlight??=s.auth.refreshSession().finally(()=>{refreshInFlight=null});let{data,error}=await refreshInFlight;if(error||!data.session)throw Error("Your session has expired. Please sign in again.");return data.session.access_token}

async function api(action,more={}){
  async function request(token){
    const response=await fetch(
      c.supabaseUrl.replace(/\/$/,"")+"/functions/v1/admin-api",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          apikey:c.supabaseAnonKey,
          Authorization:"Bearer "+token
        },
        body:JSON.stringify({action,...more})
      }
    );

    const data=await response.json().catch(()=>({}));

    return {
      response,
      data
    };
  }

  let token=await getValidAccessToken();
  let {response,data}=await request(token);

  /*
   * Background tab / stale session protection:
   * If admin-api returns 401, refresh the Supabase session once
   * and retry the same request with the fresh access token.
   */
  if(response.status===401){
    refreshInFlight??=s.auth.refreshSession().finally(()=>{
      refreshInFlight=null;
    });

    const {
      data:refreshData,
      error:refreshError
    }=await refreshInFlight;

    if(refreshError||!refreshData?.session){
      throw Error(
        data?.error ||
        "Your admin session has expired. Please sign in again."
      );
    }

    token=refreshData.session.access_token;

    ({response,data}=await request(token));
  }

  if(!response.ok){
    throw Error(data?.error||"Request failed.");
  }

  return data;
}

function flash(message, ok = true) {
    if (!flashBox) return;

    flashBox.innerHTML = `
        <div
            class="toast align-items-center text-bg-${ok ? "success" : "danger"} border-0 show shadow"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                min-width: 300px;
                max-width: 420px;
            "
        >
            <div class="d-flex">
                <div class="toast-body fw-semibold">
                    ${e(message)}
                </div>
                <button
                    type="button"
                    class="btn-close btn-close-white me-2 m-auto"
                    aria-label="Close"
                    onclick="this.closest('.toast').remove()"
                ></button>
            </div>
        </div>
    `;

    const toast = flashBox.querySelector(".toast");

    setTimeout(() => {
        if (toast) {
            toast.classList.remove("show");

            setTimeout(() => {
                if (toast) toast.remove();
            }, 300);
        }
    }, 3500);
}

async function dashboard(){pageTitle.textContent="Dashboard";q.innerHTML="Loading…";let[d,a]=await Promise.all([api("dashboard"),api("appointments",{filters:filter})]);q.innerHTML=`<div class="kpis">${[["Today's Appointments",d.today],["Pending",d.counts.pending],["Confirmed",d.counts.confirmed],["In Progress",d.counts.in_progress],["Completed",d.counts.completed]].map(x=>`<div class="kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("")}</div><div class="admin-card mt-3"><div class="status-tabs"><button data-status="" class="${!filter.status?"active":""}">All (${Object.values(d.counts).reduce((x,y)=>x+y,0)})</button>${S.map(x=>`<button data-status="${x}" class="${filter.status===x?"active":""}">${L(x)} (${d.counts[x]})</button>`).join("")}</div>${filters()}${table(a.appointments)}</div>`;bind()}
function filters(){return`<div class="row g-2 mb-3"><div class="col-md-4"><input id="search" class="form-control" placeholder="ID, code, customer or mobile" value="${e(filter.search||"")}"></div><div class="col-md-3"><input id="dateFilter" type="date" class="form-control" value="${e(filter.date||"")}"></div><div class="col-md-3"><select id="statusFilter" class="form-select"><option value="">All statuses</option>${S.map(x=>`<option value="${x}" ${filter.status===x?"selected":""}>${L(x)}</option>`).join("")}</select></div><div class="col-md-2"><button id="clear" class="btn btn-outline-secondary w-100">Clear filters</button></div></div>`}function table(a){return`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Date / Time</th><th>Technician</th><th>Job</th><th>Status</th><th>Actions</th></tr></thead><tbody>${a.map(x=>`<tr><td>${e(x.appointment_id)}</td><td>${e(x.customer_name)}<br><small>${e(x.mobile)} · ${e(x.email)}</small></td><td>${e(serviceCategoryLabel(x.service_category))}<br><small>${e(serviceTypeLabel(x.service_type))}</small></td><td>${e(x.appointment_date)}<br>${e(x.appointment_time)}</td><td>${e(x.technicians?.full_name)}</td><td>${e(x.job_code)}</td><td><span class="badge text-bg-secondary status-badge">${L(x.status)}</span></td><td class="actions"><button class="btn btn-sm btn-outline-primary" data-view-id="${x.id}">View</button>${["pending", "rescheduled"].includes(x.status)
  ? `<button class="btn btn-sm btn-primary" data-set="confirmed" data-id="${x.id}">
      Confirm
     </button>`
  : ""}
  

  
  </td></tr>`).join("")||'<tr><td colspan="8" class="text-center text-muted">No appointments match these filters.</td></tr>'}</tbody></table></div>`}
function bind(){document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{filter.status=b.dataset.status;dashboard()});search.onchange=()=>{filter.search=search.value;dashboard()};dateFilter.onchange=()=>{filter.date=dateFilter.value;dashboard()};statusFilter.onchange=()=>{filter.status=statusFilter.value;dashboard()};clear.onclick=()=>{filter={};dashboard()};document.querySelectorAll("[data-view-id]").forEach(b=>b.onclick=()=>detail(b.dataset.viewId));document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>set(b.dataset.id,b.dataset.set))}

async function set(id, status, extra = {}) {

    /*
     * Direct "completed" calls through the generic action handler
     * are permanently blocked.
     *
     * Completion must only happen through the dedicated
     * Mark Completed button inside appointment details.
     */
    if (status === "completed" && extra.__completionFlow !== true) {
        flash(
            "Appointment completion must be done from the appointment details.",
            false
        );
        return;
    }

    try {
        const payload = { id, status, ...extra };

        // Internal frontend-only flag must never be sent to the API
        delete payload.__completionFlow;

        await api("update_appointment", payload);

        flash(`Appointment ${L(status)} successfully.`);
        dashboard();

    } catch (x) {
        flash(x.message, false);
    }
}

signIn.onclick=async()=>{try{let{error:x}=await s.auth.signInWithPassword({email:email.value,password:password.value});if(x)throw x;login.hidden=true;panel.hidden=false;dashboard()}catch(x){error.textContent=x.message}};signOut.onclick=()=>s.auth.signOut().then(()=>location.reload())
    
    document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));b.classList.add("active");
        
        ({
            
            dashboard,
            appointments:dashboard,
            calendar:calendarView,
            availability:availabilityView,
            technicians:techniciansView,
            notifications:notificationsView,
            support:supportCenterView,
            }[b.dataset.view]||dashboard)()

});

menuToggle.onclick=()=>document.querySelector(".admin-sidebar").classList.toggle("open");s?.auth.getSession().then(({data:{session}})=>{if(session){login.hidden=true;panel.hidden=false;dashboard()}});
async function calendarView(){pageTitle.textContent="Calendar";let a=(await api("appointments",{filters:{}})).appointments;q.innerHTML=`<div class="admin-card"><h2 class="h6">Appointments by date</h2>${a.map(x=>`<button class="btn btn-light w-100 text-start mb-1" data-view-id="${x.id}">${e(formatAppointmentDateTime(x.appointment_date, x.appointment_time))} · ${e(x.customer_name)} · ${L(x.status)}</button>`).join("")||"No appointments."}</div>`;document.querySelectorAll("[data-view-id]").forEach(b=>b.onclick=()=>detail(b.dataset.viewId))}
async function availabilityView(){pageTitle.textContent="Availability";let x=await api("availability");let z=x.settings;q.innerHTML=`<div class="admin-card"><h2 class="h6">Business settings</h2><div class="row g-2"><div class="col-12"><label>Business days (1=Mon … 7=Sun)</label><input id="days" class="form-control" value="${z.business_days.join(",")}"></div>${[["open","Opening time",z.opening_time],["close","Closing time",z.closing_time],["duration","Slot minutes",z.slot_duration_minutes],["buffer","Buffer minutes",z.buffer_minutes],["capacity","Maximum appointments",z.max_appointments_per_slot],["advance","Minimum advance minutes",z.minimum_advance_minutes],["future","Maximum future days",z.maximum_future_days]].map(v=>`<div class="col-md-4"><label>${v[1]}</label><input id="${v[0]}" class="form-control" value="${v[2]}"></div>`).join("")}</div><button id="saveAvailability" class="btn btn-primary mt-3">Save settings</button></div><div class="admin-card mt-3"><h2 class="h6">Holiday / blocked date or slot</h2><input id="blockDate" type="date" class="form-control mb-2"><input id="blockStart" type="time" class="form-control mb-2"><input id="blockEnd" type="time" class="form-control mb-2"><input id="blockReason" class="form-control mb-2" placeholder="Reason"><button id="addBlock" class="btn btn-outline-primary">Save block</button><ul class="mt-3">${x.blocks.map(b=>`<li>${e(b.block_date)} ${e(b.starts_at||"All day")} ${e(b.reason)} <button class="btn btn-sm btn-link" data-delete-block="${b.id}">Delete</button></li>`).join("")}</ul></div>`;saveAvailability.onclick=async()=>{await api("save_availability",{settings:{business_days:days.value.split(",").map(Number),opening_time:open.value,closing_time:close.value,slot_duration_minutes:duration.value,buffer_minutes:buffer.value,max_appointments_per_slot:capacity.value,minimum_advance_minutes:advance.value,maximum_future_days:future.value}});flash("Availability saved");availabilityView()};addBlock.onclick=async()=>{await api("save_block",{block:{block_date:blockDate.value,starts_at:blockStart.value||null,ends_at:blockEnd.value||null,reason:blockReason.value}});availabilityView()};document.querySelectorAll("[data-delete-block]").forEach(b=>b.onclick=async()=>{await api("delete_block",{id:b.dataset.deleteBlock});availabilityView()})}
async function notificationsView(){pageTitle.textContent="Notifications";let[n,l]=await Promise.all([api("notifications"),api("notification_logs")]);n=n.notifications;q.innerHTML=`<div class="admin-card"><h2 class="h6">Appointment notifications</h2><p>Permission: <b>${Notification.permission==="granted"?"Enabled":"Not Enabled"}</b></p><button id="enablePush" class="btn btn-primary">Enable Appointment Notifications</button></div><div class="admin-card mt-3"><h2 class="h6">Admin inbox</h2>${n.map(x=>`<div class="border rounded p-2 mb-2"><b>${e(x.title)}</b> · ${x.is_read?"Read":"Unread"}<br><small>${e(x.body)} · ${new Date(x.created_at).toLocaleString()}</small><div class="actions mt-1">${x.appointments?.appointment_id?`<button class="btn btn-sm btn-outline-primary" data-notification-appointment="${x.appointment_id}">View appointment</button>`:""}${!x.is_read?`<button class="btn btn-sm btn-outline-secondary" data-read="${x.id}">Mark as read</button>`:""}</div></div>`).join("")||"No notifications yet."}</div><div class="admin-card mt-3"><h2 class="h6">Delivery log</h2><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Type</th><th>Channel</th><th>Status</th><th>Appointment</th><th>Created</th><th>Sent</th><th>Error</th></tr></thead><tbody>${l.logs.map(x=>`<tr><td>${e(x.type)}</td><td>${e(x.channel)}</td><td>${e(x.status)}</td><td>${e(x.appointments?.appointment_id)}</td><td>${new Date(x.created_at).toLocaleString()}</td><td>${x.sent_at?new Date(x.sent_at).toLocaleString():"—"}</td><td>${e(x.error)}</td></tr>`).join("")||'<tr><td colspan="7" class="text-muted">No delivery attempts recorded.</td></tr>'}</tbody></table></div></div>`;document.getElementById("enablePush").onclick=enablePushNotifications;document.querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{await api("mark_notification_read",{id:b.dataset.read});notificationsView()});document.querySelectorAll("[data-notification-appointment]").forEach(b=>b.onclick=()=>detail(b.dataset.notificationAppointment))}
async function enablePush(){try{if(!("serviceWorker" in navigator)||!window.CFX_CONFIG.vapidPublicKey)throw Error("Push notifications are not configured for this deployment.");let p=await Notification.requestPermission();if(p!=="granted")throw Error("Notification permission was not granted.");let reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64(window.CFX_CONFIG.vapidPublicKey)}),token=await getValidAccessToken();let r=await fetch(c.supabaseUrl.replace(/\/$/,"")+"/functions/v1/register-push-subscription",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify({subscription:sub,device_name:navigator.platform,browser:navigator.userAgent})}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Subscription could not be saved.");flash("Appointment notifications enabled.");notificationsView()}catch(x){flash(x.message,false)}}function base64(v){let x=v.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(x+"=".repeat((4-x.length%4)%4)),a=>a.charCodeAt(0))}

function days(v){return(v||[1,2,3,4,5,6]).join(",")}

function renderTechForm(t={}){

  const needsAccount =
    Boolean(
      t.id &&
      !t.auth_user_id
    );

  const selectedDays =
    Array.isArray(t.working_days)
      ? t.working_days.map(Number)
      : [1, 2, 3, 4, 5, 6];

  const daysOfWeek = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" }
  ];

  return`
  <form id="techForm" class="row g-2">

    <div class="col-md-4">
      <input
        name="technician_code"
        class="form-control"
        placeholder="Auto-generated: CFX-TECH-2026-12345"
        value="${e(t.technician_code||"")}"
        readonly
      >
    </div>

    <div class="col-md-4">
      <input
        name="full_name"
        class="form-control"
        required
        placeholder="Name"
        value="${e(t.full_name||"")}"
      >
    </div>

    <div class="col-md-4">
      <input
        name="mobile"
        class="form-control"
        required
        inputmode="tel"
        placeholder="10-digit mobile"
        value="${e(t.mobile||"")}"
      >
    </div>

    <div class="col-md-4">
      <input
        name="username"
        class="form-control"
        required
        placeholder="Username"
        value="${e(t.username||"")}"
      >
    </div>

    <div class="col-md-4">
      <input
        name="email"
        class="form-control"
        type="email"
        placeholder="Login email"
        value="${e(t.login_email||t.email||"")}"
        ${needsAccount?"required":""}
      >
    </div>

    <div class="col-md-4">
      <div class="input-group">

        <input
          id="technicianPassword"
          name="password"
          class="form-control"
          type="password"
          ${t.id&&!needsAccount?"":"required minlength=6"}
          placeholder="${
            t.id&&!needsAccount
              ? "Leave blank to keep current password"
              : "6+ character password"
          }"
          autocomplete="new-password"
        >

        <button
          type="button"
          class="btn btn-outline-secondary"
          id="toggleTechnicianPassword"
          aria-label="Show password"
          title="Show password"
        >
          👁
        </button>

      </div>
    </div>

    ${
      needsAccount
        ? `
          <div class="col-12">
            <small class="text-warning">
              This older technician has no portal account.
              Enter a login email and password to create the portal login.
            </small>
          </div>
        `
        : ""
    }

    <div class="col-md-4">
      <input
        name="specialization"
        class="form-control"
        placeholder="Specializations, comma separated"
        value="${e((t.specialization||[]).join(","))}"
      >
    </div>

    <!-- WORKING DAYS -->

    <div class="col-md-8">

      <label class="form-label mb-1">
        Working Days
      </label>

      <div
        class="d-flex flex-wrap gap-2"
        id="workingDaysContainer"
      >

        ${
          daysOfWeek.map(day => `
            <label
              class="btn btn-outline-primary btn-sm"
              style="min-width:58px;"
            >

              <input
                type="checkbox"
                name="working_day"
                value="${day.value}"
                class="working-day-checkbox me-1"
                ${selectedDays.includes(day.value) ? "checked" : ""}
              >

              ${day.label}

            </label>
          `).join("")
        }

      </div>

    </div>

    <div class="col-md-2">
      <input
        name="working_start"
        type="time"
        class="form-control"
        value="${e(t.working_start||"10:00")}"
      >
    </div>

    <div class="col-md-2">
      <input
        name="working_end"
        type="time"
        class="form-control"
        value="${e(t.working_end||"19:00")}"
      >
    </div>

    <div class="col-12">
      <button class="btn btn-primary">
        ${t.id?"Save technician":"Create technician"}
      </button>
    </div>

  </form>
  `;
}techniciansView

/* =========================================================
   TECHNICIANS VIEW
   ========================================================= */

async function techniciansView(){

    pageTitle.textContent =
        "Technicians";

    let t =
        (await api("technicians"))
            .technicians;

    q.innerHTML = `
        <div class="admin-card">

            <h2 class="h6">
                ${
                    window.editTech
                        ? "Edit technician"
                        : "Add technician"
                }
            </h2>

            ${renderTechForm(
                window.editTech || {}
            )}

        </div>

        <div class="admin-card mt-3">

            <h2 class="h6">
                Technicians
            </h2>

            ${
                t.map(x => `
                    <div class="border rounded p-2 mb-2">

                        <b>
                            ${e(x.technician_code)}
                        </b>

                        ${e(x.full_name)}
                        ·
                        ${e(x.mobile)}
                        ·
                        ${
                            x.is_active
                                ? "Active"
                                : "Inactive"
                        }

                        <div class="actions float-end">

                            <button
                                class="btn btn-sm btn-outline-primary"
                                data-edit-tech="${x.id}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn btn-sm btn-outline-secondary"
                                data-toggle-tech="${x.id}"
                            >
                                ${
                                    x.is_active
                                        ? "Deactivate"
                                        : "Activate"
                                }
                            </button>

                            <button
                                class="btn btn-sm btn-outline-danger"
                                data-delete-tech="${x.id}"
                                ${
                                    x.is_active
                                        ? 'disabled title="Deactivate this technician before deleting"'
                                        : ""
                                }
                            >
                                Delete
                            </button>

                        </div>

                    </div>
                `).join("")
                ||
                "No technicians yet."
            }

        </div>
    `;


    /* =========================================================
       PASSWORD TOGGLE
       ========================================================= */

    const technicianPassword =
        document.getElementById(
            "technicianPassword"
        );

    const toggleTechnicianPassword =
        document.getElementById(
            "toggleTechnicianPassword"
        );

    if (
        technicianPassword &&
        toggleTechnicianPassword
    ){

        toggleTechnicianPassword.onclick =
            () => {

                const isHidden =
                    technicianPassword.type ===
                    "password";

                technicianPassword.type =
                    isHidden
                        ? "text"
                        : "password";

                toggleTechnicianPassword.textContent =
                    isHidden
                        ? "🙈"
                        : "👁";

                toggleTechnicianPassword.setAttribute(
                    "aria-label",
                    isHidden
                        ? "Hide password"
                        : "Show password"
                );

                toggleTechnicianPassword.title =
                    isHidden
                        ? "Hide password"
                        : "Show password";
            };
    }


    /* =========================================================
       TECHNICIAN FORM SUBMIT
       ========================================================= */

    const techFormElement =
        document.getElementById(
            "techForm"
        );

    techFormElement.onsubmit =
        async ev => {

            ev.preventDefault();

            const f =
                new FormData(
                    techFormElement
                );

            const x =
                Object.fromEntries(f);


            /* =================================================
               SPECIALIZATION
               ================================================= */

            x.specialization =
                String(
                    x.specialization || ""
                )
                .split(",")
                .map(
                    v => v.trim()
                )
                .filter(Boolean);


            /* =================================================
               WORKING DAYS
               
               0 = Sunday
               1 = Monday
               2 = Tuesday
               3 = Wednesday
               4 = Thursday
               5 = Friday
               6 = Saturday
               ================================================= */

            x.working_days =
                Array.from(
                    document.querySelectorAll(
                        ".working-day-checkbox:checked"
                    )
                )
                .map(
                    checkbox =>
                        Number(
                            checkbox.value
                        )
                )
                .sort(
                    (a, b) =>
                        a - b
                );


            /* =================================================
               AT LEAST ONE WORKING DAY REQUIRED
               ================================================= */

            if (
                !x.working_days.length
            ){

                flash(
                    "Please select at least one working day.",
                    false
                );

                return;
            }


            /* =================================================
               CREATE / UPDATE
               ================================================= */

            try {

                if (
                    window.editTech
                ){

                    /*
                     * EDIT
                     *
                     * Existing technician_code
                     * will remain unchanged because
                     * backend updateTechnician()
                     * does not update technician_code.
                     */

                    x.id =
                        window.editTech.id;

                    await api(
                        "update_technician",
                        {
                            technician: x
                        }
                    );

                } else {

                    /*
                     * CREATE
                     *
                     * Backend generates the
                     * random technician code.
                     */

                    await api(
                        "create_technician",
                        {
                            technician: x
                        }
                    );
                }


                window.editTech =
                    null;

                flash(
                    "Technician saved."
                );

                techniciansView();

            } catch (err) {

                flash(
                    err.message ||
                    "Technician could not be saved.",
                    false
                );
            }
        };


    /* =========================================================
       EDIT TECHNICIAN
       ========================================================= */

    document
        .querySelectorAll(
            "[data-edit-tech]"
        )
        .forEach(
            b => {

                b.onclick = () => {

                    window.editTech =
                        t.find(
                            x =>
                                x.id ===
                                b.dataset.editTech
                        );

                    techniciansView();
                };
            }
        );


    /* =========================================================
       ACTIVATE / DEACTIVATE
       ========================================================= */

    document
        .querySelectorAll(
            "[data-toggle-tech]"
        )
        .forEach(
            b => {

                b.onclick =
                    async () => {

                        const technician =
                            t.find(
                                x =>
                                    x.id ===
                                    b.dataset.toggleTech
                            );

                        if (
                            !technician
                        ){

                            flash(
                                "Technician not found.",
                                false
                            );

                            return;
                        }


                        const newStatus =
                            !technician.is_active;


                        try {

                            await api(
                                "toggle_technician_status",
                                {
                                    id:
                                        technician.id,

                                    is_active:
                                        newStatus
                                }
                            );


                            flash(
                                newStatus
                                    ? "Technician activated successfully."
                                    : "Technician deactivated successfully."
                            );


                            techniciansView();

                        } catch (err) {

                            flash(
                                err.message ||
                                "Technician status could not be updated.",
                                false
                            );
                        }
                    };
            }
        );


    /* =========================================================
       DELETE TECHNICIAN
       ========================================================= */

    document
        .querySelectorAll(
            "[data-delete-tech]"
        )
        .forEach(
            b => {

                b.onclick =
                    async () => {

                        const technician =
                            t.find(
                                x =>
                                    x.id ===
                                    b.dataset.deleteTech
                            );


                        if (
                            !technician
                        ){

                            flash(
                                "Technician not found.",
                                false
                            );

                            return;
                        }


                        /*
                         * Frontend safety check.
                         * Backend also checks this independently.
                         */

                        if (
                            technician.is_active
                        ){

                            flash(
                                "Active technician cannot be deleted. Deactivate the technician first.",
                                false
                            );

                            return;
                        }


                        const confirmed =
                            window.confirm(
                                `Delete technician "${technician.full_name}" permanently?\n\n` +
                                "This will also delete the technician's portal login account.\n\n" +
                                "This action cannot be undone."
                            );


                        if (
                            !confirmed
                        ){

                            return;
                        }


                        try {

                            b.disabled =
                                true;

                            b.textContent =
                                "Deleting…";


                            await api(
                                "delete_technician",
                                {
                                    id:
                                        technician.id
                                }
                            );


                            flash(
                                "Technician deleted successfully."
                            );


                            techniciansView();

                        } catch (err) {

                            b.disabled =
                                false;

                            b.textContent =
                                "Delete";


                            flash(
                                err.message ||
                                "Technician could not be deleted.",
                                false
                            );
                        }
                    };
            }
        );
}

async function detail(id){let[{appointment:a},{technicians}]=await Promise.all([api("appointment",{id}),api("technicians")]);let active=technicians.filter(x=>x.is_active);const hasGps=Number.isFinite(Number(a.latitude))&&Number.isFinite(Number(a.longitude));const mapsUrl=hasGps?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.latitude},${a.longitude}`)}`:"";const locationType=a.service_location_type==="home_office"?"Home / Office Visit":a.service_location_type||"—";pageTitle.textContent=a.appointment_id;q.innerHTML=`<button id="back" class="btn btn-link p-0 mb-3">← Back</button><div class="detail-grid"><section><h2 class="h6">Customer</h2><p>${e(a.customer_name)}<br>${e(a.mobile)}<br>${e(a.email)}</p></section><section><h2 class="h6">Service Location</h2><p><strong>Location Type:</strong> ${e(locationType)}<br><strong>Address:</strong> ${e(a.service_address||"—")}<br><strong>Landmark:</strong> ${e(a.landmark||"—")}</p>${hasGps?`<div class="mt-2"><strong>GPS Coordinates:</strong><div>${e(String(a.latitude))}, ${e(String(a.longitude))}</div></div>`:`<p class="text-muted mb-0">GPS location not available.</p>`}${hasGps?`<div class="mt-3"><a class="btn btn-sm btn-primary" href="${e(mapsUrl)}" target="_blank" rel="noopener noreferrer">Open Customer Location in Google Maps</a></div>`:""}</section>

<section><h2 class="h6">Service</h2><p>${e(serviceCategoryLabel(a.service_category))} - ${e(serviceTypeLabel(a.service_type))}<br>${e(a.problem_description)}</p></section><section><h2 class="h6">Additional Notes</h2><p class="mb-0">${e(a.additional_notes||"No additional notes provided.")}</p></section>

<section><h2 class="h6">Appointment</h2>

<p>
    ${e(a.appointment_id)}<br>
    ${e(formatAppointmentDateTime(a.appointment_date, a.appointment_time))}<br>
    <b>${L(a.status)}</b>
</p>

</section><section><h2 class="h6">Technician</h2><p>${e(a.technicians?.full_name)}</p><select id="techAssign" class="form-select mb-2"><option value="">Select active technician</option>${active.map(x=>`<option value="${x.id}" ${a.technician_id===x.id?"selected":""}>${e(x.full_name)} — ${e(x.technician_code)}</option>`).join("")}</select><button id="assignTech" class="btn btn-sm btn-primary" ${a.status==="confirmed"?"":"disabled"}>Assign technician</button></section>

<section>
    <h2 class="h6">Job</h2>

    <input
        id="job"
        class="form-control mb-2"
        value="${e(a.job_code || "")}"
        placeholder="CFX-JOB-2026-00452"
        ${a.status === "in_progress" ? "" : "disabled"}
    >

    <button
        id="jobSave"
        class="btn btn-sm btn-primary"
        ${a.status === "in_progress" ? "" : "disabled"}
    >
        Save Job ID
    </button>
</section></div>

<div class="admin-card mt-3">
    <div class="actions">

        ${["pending", "rescheduled"].includes(a.status)
            ? '<button id="confirmAppointment" class="btn btn-primary">Confirm Appointment</button>'
            : ""}

        <button
            id="way"
            class="btn btn-outline-primary"
            ${a.status === "technician_assigned" ? "" : "disabled"}
        >
            On The Way
        </button>

        <button
            id="progress"
            class="btn btn-outline-primary"
            ${a.status === "on_the_way" ? "" : "disabled"}
        >
            In Progress
        </button>

        <button
            id="complete"
            class="btn btn-success"
            ${(
                a.status === "job_id_created" ||
                (a.status === "in_progress" && !a.job_code)
            ) ? "" : "disabled"}
        >
            Mark Completed
        </button>

        <button
            id="cancel"
            class="btn btn-outline-danger"
            ${["completed", "cancelled", "no_show"].includes(a.status) ? "disabled" : ""}
        >
            Cancel
        </button>

    </div>
</div>

<div class="admin-card mt-3"><h2 class="h6">Status History</h2><ol>${(a.appointment_status_history||[]).map(h=>`<li>${L(h.old_status||"Created")} → <b>${L(h.new_status)}</b><br><small>${new Date(h.changed_at).toLocaleString()} ${e(h.note||"")}</small></li>`).join("")}</ol>

</div>`;

back.onclick = dashboard;

assignTech.onclick = () =>
    set(id, "technician_assigned", {
        technician_id: techAssign.value
    });

const confirmAppointmentButton =
    document.getElementById("confirmAppointment");

if (confirmAppointmentButton) {
    confirmAppointmentButton.onclick = function () {
        set(id, "confirmed");
    };
}

way.onclick = () =>
    set(id, "on_the_way");

progress.onclick = () =>
    set(id, "in_progress");

complete.onclick = () =>
    set(id, "completed", {
        __completionFlow: true
    });

cancel.onclick = () =>
    set(id, "cancelled");

jobSave.onclick = async () => {

    const jobCode = String(job.value || "").trim();

    // Job ID না দিলে কিছু করবে না
    if (!jobCode) {
        return;
    }

    // Job ID format check
    if (!/^CFX-JOB-[0-9]{4}-[0-9]{5}$/.test(jobCode)) {

        flash(
            "Please enter a valid Job ID. Example: CFX-JOB-2026-00452",
            false
        );

        job.focus();
        return;
    }

    // Job ID save হলেই automatically Job ID Created হবে
    await set(id, "job_id_created", {
        job_code: jobCode
    });
}}


const sidebar=document.querySelector(".admin-sidebar"),sidebarOverlay=document.createElement("div"),menuClose=document.createElement("button"),closeSidebar=()=>{sidebar.classList.remove("open");sidebarOverlay.hidden=true;document.body.classList.remove("sidebar-open")},openSidebar=()=>{sidebar.classList.add("open");sidebarOverlay.hidden=false;document.body.classList.add("sidebar-open")};sidebarOverlay.id="sidebarOverlay";sidebarOverlay.className="sidebar-overlay";sidebarOverlay.hidden=true;document.querySelector(".admin-shell").prepend(sidebarOverlay);menuClose.type="button";menuClose.id="menuClose";menuClose.className="btn btn-sm btn-outline-light d-md-none";menuClose.setAttribute("aria-label","Close menu");menuClose.textContent="×";sidebar.prepend(menuClose);menuToggle.onclick=()=>sidebar.classList.contains("open")?closeSidebar():openSidebar();menuClose.onclick=closeSidebar;sidebarOverlay.onclick=closeSidebar;document.addEventListener("keydown",event=>{if(event.key==="Escape")closeSidebar()});document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{if(matchMedia("(max-width: 767px)").matches)closeSidebar()}));
const existingDetail=detail;table=function(rows){return`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Date / Time</th><th>Technician</th><th>Job</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${e(item.appointment_id)}</td><td>${e(item.customer_name)}<br><small>${e(item.mobile)} · ${e(item.email)}</small></td><td>${e(serviceCategoryLabel(item.service_category))}<br><small>${e(serviceTypeLabel(item.service_type))}</small></td><td>${e(formatAppointmentDateTime(item.appointment_date, item.appointment_time))}</td><td>${e(item.technicians?.full_name)}</td><td>${e(item.job_code)}</td><td><span class="badge status-badge">${L(item.status)}</span></td><td class="actions"><button class="btn btn-sm btn-outline-primary" data-view-id="${item.id}">View</button>
${["pending", "rescheduled"].includes(item.status)
    ? `<button class="btn btn-sm btn-primary" data-set="confirmed" data-id="${item.id}">
        Confirm
       </button>`
    : ""}



${item.status !== "completed"
    ? `<button class="btn btn-sm btn-outline-danger" data-delete-id="${item.id}">Delete</button>`
    : ""}
    
    </td></tr>`).join("")||'<tr><td colspan="8" class="text-center text-muted">No appointments match these filters.</td></tr>'}</tbody></table></div>`}
    
    bind=function(){
    search.onchange=()=>{
        filter.search=search.value;
        dashboard();
    };

    dateFilter.onchange=()=>{
        filter.date=dateFilter.value;
        dashboard();
    };

    statusFilter.onchange=()=>{
        filter.status=statusFilter.value;
        dashboard();
    };

    clear.onclick=()=>{
        filter={};
        dashboard();
    };

    document.querySelectorAll("[data-view-id]").forEach(button=>{
        button.onclick=()=>{
            detail(button.dataset.viewId);
        };
    });

    document.querySelectorAll("[data-set]").forEach(button=>{
        button.onclick=()=>{
            set(button.dataset.id,button.dataset.set);
        };
    });

    document.querySelectorAll("[data-delete-id]").forEach(button=>{
        button.onclick=async()=>{

            let modal=document.getElementById("deleteConfirmModal");

            if(!modal){
                modal=document.createElement("div");
                modal.id="deleteConfirmModal";
                modal.className="modal fade";
                modal.tabIndex=-1;
                modal.setAttribute("aria-hidden","true");

                modal.innerHTML=
                    '<div class="modal-dialog modal-dialog-centered">'+
                        '<div class="modal-content border-0 shadow-lg">'+
                            '<div class="modal-header border-0">'+
                                '<h5 class="modal-title fw-semibold">Delete Appointment</h5>'+
                                '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'+
                            '</div>'+
                            '<div class="modal-body pt-0">'+
                                '<div class="d-flex align-items-start gap-3">'+
                                    '<div class="rounded-circle bg-danger-subtle text-danger d-flex align-items-center justify-content-center flex-shrink-0" style="width:48px;height:48px;font-size:22px;">⚠</div>'+
                                    '<div>'+
                                        '<p class="mb-1 fw-semibold">Are you sure you want to delete this appointment?</p>'+
                                        '<p class="text-muted mb-0">This appointment will be permanently deleted. This action cannot be undone.</p>'+
                                    '</div>'+
                                '</div>'+
                            '</div>'+
                            '<div class="modal-footer border-0 pt-0">'+
                                '<button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>'+
                                '<button type="button" id="confirmDeleteAppointment" class="btn btn-danger">Delete Permanently</button>'+
                            '</div>'+
                        '</div>'+
                    '</div>';

                document.body.appendChild(modal);
            }

            const confirmButton=document.getElementById("confirmDeleteAppointment");

            if(typeof bootstrap==="undefined" || !bootstrap.Modal){
                flash("Bootstrap modal is not available.",false);
                return;
            }

            const bootstrapModal=bootstrap.Modal.getOrCreateInstance(modal);

            confirmButton.disabled=false;
            confirmButton.innerHTML="Delete Permanently";

            bootstrapModal.show();

            confirmButton.onclick=async()=>{

                confirmButton.disabled=true;
                confirmButton.innerHTML="Deleting…";

                try{
                    await api("delete_appointment",{
                        id:button.dataset.deleteId
                    });

                    bootstrapModal.hide();

                    flash(
                        "Appointment deleted successfully.",
                        true
                    );

                    dashboard();

                }catch(error){

                    confirmButton.disabled=false;
                    confirmButton.innerHTML="Delete Permanently";

                    flash(
                        error.message||"Appointment could not be deleted.",
                        false
                    );
                }
            };
        };
    });
};
    
    
dashboard=async function(){pageTitle.textContent="Dashboard";q.innerHTML="Loading…";let[summary,list]=await Promise.all([api("dashboard"),api("appointments",{filters:filter})]);q.innerHTML=`<div class="kpis">${[["Today's Appointments",summary.today],["Pending",summary.counts.pending],["Confirmed",summary.counts.confirmed],["In Progress",summary.counts.in_progress],["Completed",summary.counts.completed]].map(item=>`<div class="kpi"><small>${item[0]}</small><b>${item[1]}</b></div>`).join("")}</div><div class="admin-card mt-3">${filters()}${table(list.appointments)}</div>`;bind()};detail=async function(id){await existingDetail(id);const current=await api("appointment",{id});if(current.appointment.status==="completed"){const cancelButton=document.getElementById("cancel");if(cancelButton){cancelButton.disabled=true;cancelButton.title="Completed appointments cannot be cancelled"}}};
signOut.onclick=async()=>{if(!window.confirm("Sign out of the administrator portal?"))return;await s.auth.signOut();location.replace("login.html")};s?.auth.getSession().then(({data:{session}})=>{if(!session)location.replace("login.html");else{login.hidden=true;panel.hidden=false;dashboard()}});
availabilityView=async function(){pageTitle.textContent="Availability";const data=await api("availability"),settings=data.settings;q.innerHTML=`<div class="admin-card"><h2 class="h6">Business settings</h2><div class="row g-2"><div class="col-12"><label>Business days (1=Mon … 7=Sun)</label><input id="availabilityDays" class="form-control" value="${settings.business_days.join(",")}"></div>${[["availabilityOpen","Opening time",settings.opening_time],["availabilityClose","Closing time",settings.closing_time],["availabilityDuration","Slot minutes",settings.slot_duration_minutes],["availabilityBuffer","Buffer minutes",settings.buffer_minutes],["availabilityCapacity","Maximum appointments",settings.max_appointments_per_slot],["availabilityAdvance","Minimum advance minutes",settings.minimum_advance_minutes],["availabilityFuture","Maximum future days",settings.maximum_future_days]].map(item=>`<div class="col-md-4"><label>${item[1]}</label><input id="${item[0]}" class="form-control" value="${item[2]}"></div>`).join("")}</div><button id="saveAvailability" class="btn btn-primary mt-3">Save settings</button></div><div class="admin-card mt-3"><h2 class="h6">Holiday / blocked date or slot</h2><input id="blockDate" type="date" class="form-control mb-2"><input id="blockStart" type="time" class="form-control mb-2"><input id="blockEnd" type="time" class="form-control mb-2"><input id="blockReason" class="form-control mb-2" placeholder="Reason"><button id="addBlock" class="btn btn-outline-primary">Save block</button><ul class="mt-3">${data.blocks.map(block=>`<li>${e(block.block_date)} ${e(block.starts_at||"All day")} ${e(block.reason)} <button class="btn btn-sm btn-link" data-delete-block="${block.id}">Delete</button></li>`).join("")}</ul></div>`;document.getElementById("saveAvailability").onclick=async()=>{try{await api("save_availability",{settings:{business_days:document.getElementById("availabilityDays").value.split(",").map(Number),opening_time:document.getElementById("availabilityOpen").value,closing_time:document.getElementById("availabilityClose").value,slot_duration_minutes:document.getElementById("availabilityDuration").value,buffer_minutes:document.getElementById("availabilityBuffer").value,max_appointments_per_slot:document.getElementById("availabilityCapacity").value,minimum_advance_minutes:document.getElementById("availabilityAdvance").value,maximum_future_days:document.getElementById("availabilityFuture").value}});flash("Availability saved");availabilityView()}catch(error){flash(error.message,false)}};document.getElementById("addBlock").onclick=async()=>{try{await api("save_block",{block:{block_date:document.getElementById("blockDate").value,starts_at:document.getElementById("blockStart").value||null,ends_at:document.getElementById("blockEnd").value||null,reason:document.getElementById("blockReason").value}});availabilityView()}catch(error){flash(error.message,false)}};document.querySelectorAll("[data-delete-block]").forEach(button=>button.onclick=async()=>{try{await api("delete_block",{id:button.dataset.deleteBlock});availabilityView()}catch(error){flash(error.message,false)}})};
const detailWithPhotos=detail;detail=async function(id){await detailWithPhotos(id);const {appointment}=await api("appointment",{id});if(appointment.photo_urls?.length){q.querySelector(".detail-grid").insertAdjacentHTML("beforeend",`<section><h2 class="h6">Customer photos</h2><div class="d-flex gap-2 flex-wrap">${appointment.photo_urls.map(url=>`<a href="${e(url)}" target="_blank" rel="noopener"><img src="${e(url)}" alt="Customer uploaded service photo" style="width:120px;height:90px;object-fit:cover;border-radius:.5rem"></a>`).join("")}</div></section>`)}};
async function enablePushNotifications() {
    const button = document.getElementById("enablePush");

    try {
        if (button) {
            button.disabled = true;
            button.textContent = "Enabling…";
        }

        if (!("serviceWorker" in navigator)) {
            throw new Error(
                "This browser does not support service-worker notifications."
            );
        }

        if (!window.CFX_CONFIG?.vapidPublicKey) {
            throw new Error(
                "Push notifications are not configured for this deployment."
            );
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            throw new Error(
                "Notification permission was not granted. Enable notifications for this site in your browser settings and try again."
            );
        }

        const registration =
            await navigator.serviceWorker.register(
                "../service-worker.js",
                {
                    updateViaCache: "none"
                }
            );

        await registration.update();

        await navigator.serviceWorker.ready;

        const subscription =
            await registration.pushManager.getSubscription() ||
            await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey:
                    base64(window.CFX_CONFIG.vapidPublicKey)
            });

        console.log(
            "Push subscription created:",
            subscription
        );

        const accessToken = await getValidAccessToken();

        const response = await fetch(
            c.supabaseUrl.replace(/\/$/, "") +
            "/functions/v1/register-push-subscription",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": c.supabaseAnonKey,
                    "Authorization": "Bearer " + accessToken
                },
                body: JSON.stringify({
                    subscription,
                    device_name:
                        navigator.platform || "Unknown device",
                    browser:
                        navigator.userAgent
                })
            }
        );

        const body =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                body.error ||
                "Push subscription could not be saved."
            );
        }

        console.log(
            "Push subscription saved successfully:",
            body
        );

        flash("Appointment notifications enabled.");

        notificationsView();

    } catch (error) {

        console.error(
            "Push notification setup failed:",
            error
        );

        if (button) {
            button.disabled = false;
            button.textContent =
                "Enable Appointment Notifications";
        }

        flash(
            error.message ||
            "Notification enablement failed.",
            false
        );
    }
}

/* =========================================================
   ADMIN SUPPORT CENTER
   PHASE 6B
   ========================================================= */

const ADMIN_SUPPORT_STATUSES = [
    "OPEN",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "CANCELLED"
];

const ADMIN_SUPPORT_TYPES = [
    "TECHNICAL_PROBLEM",
    "APPOINTMENT_JOB",
    "CCTV_PROBLEM",
    "COMPUTER_LAPTOP",
    "JOB_ID_BILLING",
    "TECHNICIAN_SUPPORT",
    "OTHER"
];

let adminSupportState = {
    status: "",
    supportType: "",
    search: "",
    requestId: "",
    loading: false
};

function adminSupportTypeLabel(value) {

    const labels = {
        TECHNICAL_PROBLEM: "Technical Problem",
        APPOINTMENT_JOB: "Appointment / Job",
        CCTV_PROBLEM: "CCTV Problem",
        COMPUTER_LAPTOP: "Computer / Laptop",
        JOB_ID_BILLING: "Job ID / Billing",
        TECHNICIAN_SUPPORT: "Technician Support",
        OTHER: "Other"
    };

    return (
        labels[value] ||
        String(value || "")
            .replaceAll("_", " ")
            .replace(/\b\w/g, char => char.toUpperCase())
    );
}

function adminSupportStatusLabel(value) {

    return String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function adminSupportStatusClass(status) {

    return String(status || "")
        .toLowerCase()
        .replaceAll("_", "-");
}

function adminSupportFormatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function adminSupportFormatAppointmentDate(date, time) {

    if (!date) {
        return "—";
    }

    const cleanTime = String(time || "").slice(0, 8);

    const value = new Date(
        `${date}T${cleanTime}`
    );

    if (Number.isNaN(value.getTime())) {
        return `${date} ${time || ""}`.trim();
    }

    return value.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}


/* =========================================================
   SUPPORT CENTER
   ========================================================= */

async function supportCenterView() {

    pageTitle.textContent = "Support Center";

    q.innerHTML = `
        <div class="admin-support-loading">
            <div class="spinner-border spinner-border-sm"
                 role="status"></div>
            <span>Loading support requests…</span>
        </div>
    `;

    try {

        await loadAdminSupportRequests();

    } catch (error) {

        console.error(
            "Admin support center failed:",
            error
        );

        q.innerHTML = `
            <div class="admin-card admin-support-error">
                <h2 class="h6 mb-2">
                    Unable to load Support Center
                </h2>

                <p class="text-muted mb-3">
                    ${e(
                        error?.message ||
                        "Support requests could not be loaded."
                    )}
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    id="adminSupportRetry"
                >
                    Retry
                </button>
            </div>
        `;

        document
            .getElementById("adminSupportRetry")
            ?.addEventListener(
                "click",
                () => supportCenterView()
            );
    }
}


/* =========================================================
   LOAD SUPPORT REQUESTS
   ========================================================= */

async function loadAdminSupportRequests() {

    adminSupportState.loading = true;

    const response = await api(
        "support_requests",
        {
            status:
                adminSupportState.status || undefined,

            support_type:
                adminSupportState.supportType || undefined,

            search:
                adminSupportState.search || undefined,

            offset: 0,
            limit: 50
        }
    );

    const requests =
        Array.isArray(response?.requests)
            ? response.requests
            : [];

    adminSupportState.loading = false;

    renderAdminSupportCenter(
        requests,
        response?.count || requests.length
    );
}


/* =========================================================
   SUPPORT CENTER UI
   ========================================================= */

function renderAdminSupportCenter(
    requests,
    totalCount
) {

    pageTitle.textContent = "Support Center";

    q.innerHTML = `
        <div class="admin-support-header">

            <div>
                <h2 class="admin-support-title">
                    Technician Support
                </h2>

                <p class="admin-support-subtitle">
                    Manage technician support requests,
                    conversations and status.
                </p>
            </div>

            <button
                type="button"
                class="btn btn-primary"
                id="adminSupportRefresh"
            >
                ↻ Refresh
            </button>

        </div>


        <div class="admin-support-stats">

            <div class="admin-support-stat">
                <small>Total Requests</small>
                <strong>${Number(totalCount) || 0}</strong>
            </div>

            <div class="admin-support-stat">
                <small>Open</small>
                <strong>
                    ${requests.filter(
                        x => x.status === "OPEN"
                    ).length}
                </strong>
            </div>

            <div class="admin-support-stat">
                <small>In Progress</small>
                <strong>
                    ${requests.filter(
                        x => x.status === "IN_PROGRESS"
                    ).length}
                </strong>
            </div>

            <div class="admin-support-stat">
                <small>Resolved</small>
                <strong>
                    ${requests.filter(
                        x => x.status === "RESOLVED"
                    ).length}
                </strong>
            </div>

        </div>


        <div class="admin-card admin-support-filter-card">

            <div class="row g-2">

                <div class="col-lg-5 col-md-6">

                    <label
                        class="form-label small fw-semibold"
                        for="adminSupportSearch"
                    >
                        Search
                    </label>

                    <input
                        id="adminSupportSearch"
                        type="search"
                        class="form-control"
                        placeholder="Token, appointment, technician..."
                        value="${e(
                            adminSupportState.search
                        )}"
                    >

                </div>


                <div class="col-lg-3 col-md-3">

                    <label
                        class="form-label small fw-semibold"
                        for="adminSupportStatus"
                    >
                        Status
                    </label>

                    <select
                        id="adminSupportStatus"
                        class="form-select"
                    >

                        <option value="">
                            All statuses
                        </option>

                        ${ADMIN_SUPPORT_STATUSES
                            .map(status => `
                                <option
                                    value="${status}"
                                    ${
                                        adminSupportState.status === status
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${adminSupportStatusLabel(status)}
                                </option>
                            `)
                            .join("")}

                    </select>

                </div>


                <div class="col-lg-3 col-md-3">

                    <label
                        class="form-label small fw-semibold"
                        for="adminSupportType"
                    >
                        Support Type
                    </label>

                    <select
                        id="adminSupportType"
                        class="form-select"
                    >

                        <option value="">
                            All types
                        </option>

                        ${ADMIN_SUPPORT_TYPES
                            .map(type => `
                                <option
                                    value="${type}"
                                    ${
                                        adminSupportState.supportType === type
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${adminSupportTypeLabel(type)}
                                </option>
                            `)
                            .join("")}

                    </select>

                </div>


                <div class="col-lg-1 col-md-12 d-flex align-items-end">

                    <button
                        type="button"
                        class="btn btn-outline-secondary w-100"
                        id="adminSupportClear"
                        title="Clear filters"
                    >
                        Clear
                    </button>

                </div>

            </div>

        </div>


        <div class="admin-card mt-3">

            <div class="d-flex justify-content-between align-items-center mb-3">

                <div>
                    <h2 class="h6 mb-1">
                        Support Requests
                    </h2>

                    <small class="text-muted">
                        ${requests.length} request${
                            requests.length === 1 ? "" : "s"
                        } shown
                    </small>
                </div>

            </div>

            ${renderAdminSupportRequestTable(requests)}

        </div>
    `;

    bindAdminSupportCenter();
}


/* =========================================================
   SUPPORT REQUEST TABLE
   ========================================================= */

function renderAdminSupportRequestTable(
    requests
) {

    if (!requests.length) {

        return `
            <div class="admin-support-empty">

                <div class="admin-support-empty-icon">
                    ?
                </div>

                <h3>
                    No support requests found
                </h3>

                <p>
                    There are no support requests matching
                    the selected filters.
                </p>

            </div>
        `;
    }

    return `
        <div class="table-responsive">

            <table class="table align-middle admin-support-table">

                <thead>
                    <tr>
                        <th>Support</th>
                        <th>Technician</th>
                        <th>Appointment</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>

                    ${requests.map(request => {

                        const technician =
                            request.technicians;

                        const appointment =
                            request.appointments;

                        return `
                            <tr>

                                <td>

                                    <div class="support-token">
                                        ${e(
                                            request.support_token
                                        )}
                                    </div>

                                    <small class="text-muted">
                                        ${e(
                                            String(
                                                request.id || ""
                                            ).slice(0, 8)
                                        )}
                                    </small>

                                </td>


                                <td>

                                    <strong>
                                        ${e(
                                            technician?.full_name ||
                                            "Unknown"
                                        )}
                                    </strong>

                                    <small class="d-block text-muted">
                                        ${e(
                                            technician?.technician_code ||
                                            "—"
                                        )}
                                    </small>

                                </td>


                                <td>

                                    <strong>
                                        ${e(
                                            appointment?.appointment_id ||
                                            "—"
                                        )}
                                    </strong>

                                    <small class="d-block text-muted">
                                        ${e(
                                            appointment?.customer_name ||
                                            "—"
                                        )}
                                    </small>

                                </td>


                                <td>
                                    ${e(
                                        adminSupportTypeLabel(
                                            request.support_type
                                        )
                                    )}
                                </td>


                                <td>

                                    <span
                                        class="
                                            support-status-badge
                                            ${adminSupportStatusClass(
                                                request.status
                                            )}
                                        "
                                    >
                                        ${e(
                                            adminSupportStatusLabel(
                                                request.status
                                            )
                                        )}
                                    </span>

                                </td>


                                <td>
                                    ${e(
                                        adminSupportFormatDate(
                                            request.created_at
                                        )
                                    )}
                                </td>


                                <td>

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary"
                                        data-admin-support-view="${e(
                                            request.id
                                        )}"
                                    >
                                        View
                                    </button>

                                </td>

                            </tr>
                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   SUPPORT CENTER EVENTS
   ========================================================= */

function bindAdminSupportCenter() {

    document
        .getElementById(
            "adminSupportRefresh"
        )
        ?.addEventListener(
            "click",
            () => loadAdminSupportRequests()
        );


    document
        .getElementById(
            "adminSupportStatus"
        )
        ?.addEventListener(
            "change",
            event => {

                adminSupportState.status =
                    event.target.value;

                loadAdminSupportRequests();
            }
        );


    document
        .getElementById(
            "adminSupportType"
        )
        ?.addEventListener(
            "change",
            event => {

                adminSupportState.supportType =
                    event.target.value;

                loadAdminSupportRequests();
            }
        );


    document
        .getElementById(
            "adminSupportSearch"
        )
        ?.addEventListener(
            "change",
            event => {

                adminSupportState.search =
                    String(
                        event.target.value || ""
                    ).trim();

                loadAdminSupportRequests();
            }
        );


    document
        .getElementById(
            "adminSupportClear"
        )
        ?.addEventListener(
            "click",
            () => {

                adminSupportState.status = "";
                adminSupportState.supportType = "";
                adminSupportState.search = "";

                loadAdminSupportRequests();
            }
        );


    document
        .querySelectorAll(
            "[data-admin-support-view]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openAdminSupportRequest(
                        button.dataset.adminSupportView
                    );
                }
            );

        });
}


/* =========================================================
   SUPPORT REQUEST DETAILS
   ========================================================= */

async function openAdminSupportRequest(
    requestId
) {

    const id =
        String(requestId || "").trim();

    if (!id) {
        flash(
            "Invalid support request.",
            false
        );
        return;
    }

    adminSupportState.requestId = id;

    q.innerHTML = `
        <div class="admin-support-loading">
            <div
                class="spinner-border spinner-border-sm"
                role="status"
            ></div>

            <span>
                Loading support request…
            </span>
        </div>
    `;

    try {

        const [
            requestResponse,
            messageResponse
        ] = await Promise.all([

            api(
                "support_get_request",
                {
                    request_id: id
                }
            ),

            api(
                "support_messages",
                {
                    support_request_id: id
                }
            )

        ]);

        const request =
            requestResponse?.request;

        const messages =
            Array.isArray(
                messageResponse?.messages
            )
                ? messageResponse.messages
                : [];

        if (!request?.id) {
            throw new Error(
                "Support request could not be loaded."
            );
        }

        renderAdminSupportDetails(
            request,
            messages
        );

    } catch (error) {

        console.error(
            "Admin support request load failed:",
            error
        );

        q.innerHTML = `
            <div class="admin-card">

                <button
                    type="button"
                    class="btn btn-link p-0 mb-3"
                    id="adminSupportBack"
                >
                    ← Back to Support Requests
                </button>

                <div class="alert alert-danger mb-0">
                    ${e(
                        error?.message ||
                        "Unable to load support request."
                    )}
                </div>

            </div>
        `;

        document
            .getElementById(
                "adminSupportBack"
            )
            ?.addEventListener(
                "click",
                () => supportCenterView()
            );
    }
}

/* =========================================================
   SUPPORT DETAILS UI
   ========================================================= */

function renderAdminSupportDetails(
    request,
    messages
) {

    const technician =
        request.technicians || {};

    const appointment =
        request.appointments || {};

    pageTitle.textContent =
        request.support_token ||
        "Support Request";


    q.innerHTML = `

        <div class="admin-support-detail-header">

            <div>

                <button
                    type="button"
                    class="btn btn-link p-0 mb-2"
                    id="adminSupportBack"
                >
                    ← Back to Support Requests
                </button>

                <h2 class="admin-support-title">
                    ${e(
                        request.support_token
                    )}
                </h2>

                <p class="admin-support-subtitle mb-0">
                    Support request created
                    ${e(
                        adminSupportFormatDate(
                            request.created_at
                        )
                    )}
                </p>

            </div>


            <span
                class="
                    support-status-badge
                    large
                    ${adminSupportStatusClass(
                        request.status
                    )}
                "
            >
                ${e(
                    adminSupportStatusLabel(
                        request.status
                    )
                )}
            </span>

        </div>


        <div class="detail-grid admin-support-detail-grid">

            <section>

                <h2 class="h6">
                    Technician
                </h2>

                <div class="admin-support-info">

                    <strong>
                        ${e(
                            technician.full_name ||
                            "—"
                        )}
                    </strong>

                    <span>
                        Code:
                        ${e(
                            technician.technician_code ||
                            "—"
                        )}
                    </span>

                    <span>
                        Mobile:
                        ${e(
                            technician.mobile ||
                            "—"
                        )}
                    </span>

                    <span>
                        Username:
                        ${e(
                            technician.username ||
                            "—"
                        )}
                    </span>

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Appointment
                </h2>

                <div class="admin-support-info">

                    <strong>
                        ${e(
                            appointment.appointment_id ||
                            "—"
                        )}
                    </strong>

                    <span>
                        Customer:
                        ${e(
                            appointment.customer_name ||
                            "—"
                        )}
                    </span>

                    <span>
                        Mobile:
                        ${e(
                            appointment.mobile ||
                            "—"
                        )}
                    </span>

                    <span>
                        Service:
                        ${e(
                            serviceCategoryLabel(
                                appointment.service_category
                            )
                        )}
                    </span>

                    <span>
                        ${e(
                            serviceTypeLabel(
                                appointment.service_type
                            )
                        )}
                    </span>

                    <span>
                        Appointment:
                        ${e(
                            adminSupportFormatAppointmentDate(
                                appointment.appointment_date,
                                appointment.appointment_time
                            )
                        )}
                    </span>

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Support Information
                </h2>

                <div class="admin-support-info">

                    <span>
                        Type:
                        <strong>
                            ${e(
                                adminSupportTypeLabel(
                                    request.support_type
                                )
                            )}
                        </strong>
                    </span>

                    <span>
                        Status:
                        ${e(
                            adminSupportStatusLabel(
                                request.status
                            )
                        )}
                    </span>

                    <span>
                        Created:
                        ${e(
                            adminSupportFormatDate(
                                request.created_at
                            )
                        )}
                    </span>

                    ${
                        request.location_url
                            ? `
                                <a
                                    href="${e(
                                        request.location_url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-sm btn-outline-primary mt-2"
                                >
                                    Open Technician Location
                                </a>
                            `
                            : ""
                    }

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Problem Details
                </h2>

                <div class="admin-support-problem">

                    ${e(
                        request.problem_details ||
                        "No problem details provided."
                    )}

                </div>

            </section>

        </div>


        <div class="admin-card mt-3">

            <div class="d-flex justify-content-between align-items-center mb-3">

                <div>

                    <h2 class="h6 mb-1">
                        Support Status
                    </h2>

                    <small class="text-muted">
                        Update the request status from the
                        available workflow.
                    </small>

                </div>

            </div>


            ${renderAdminSupportStatusControls(
                request
            )}

        </div>


        <div class="admin-card mt-3">

            <div class="d-flex justify-content-between align-items-center mb-3">

                <div>

                    <h2 class="h6 mb-1">
                        Support Conversation
                    </h2>

                    <small class="text-muted">
                        Technician and admin messages
                    </small>

                </div>

                <span class="badge text-bg-light">
                    ${messages.length}
                    message${messages.length === 1 ? "" : "s"}
                </span>

            </div>


            <div
                id="adminSupportMessages"
                class="admin-support-messages"
            >
                ${renderAdminSupportMessages(
                    messages
                )}
            </div>


            ${
                !["CLOSED", "CANCELLED"].includes(
                    request.status
                )
                    ? `
                        <form
                            id="adminSupportMessageForm"
                            class="admin-support-composer"
                        >

                            <textarea
                                id="adminSupportMessageInput"
                                class="form-control"
                                rows="3"
                                maxlength="4000"
                                placeholder="Write a reply to the technician..."
                                required
                            ></textarea>

                            <div class="d-flex justify-content-between align-items-center mt-2">

                                <small class="text-muted">
                                    Admin message
                                </small>

                                <button
                                    type="submit"
                                    class="btn btn-primary"
                                    id="adminSupportSendButton"
                                >
                                    Send Message
                                </button>

                            </div>

                        </form>
                    `
                    : `
                        <div class="alert alert-light border mb-0">
                            This support request is
                            ${e(
                                adminSupportStatusLabel(
                                    request.status
                                )
                            ).toLowerCase()}
                            and can no longer receive messages.
                        </div>
                    `
            }

        </div>

    `;


    document
        .getElementById(
            "adminSupportBack"
        )
        ?.addEventListener(
            "click",
            () => supportCenterView()
        );


    bindAdminSupportStatusControls(
        request
    );


    bindAdminSupportMessageComposer(
        request.id
    );
}


/* =========================================================
   STATUS CONTROLS
   ========================================================= */

function renderAdminSupportStatusControls(
    request
) {

    const status =
        String(request.status || "");

    if (
        status === "CLOSED" ||
        status === "CANCELLED"
    ) {

        return `
            <div class="admin-support-terminal">
                <strong>
                    ${e(
                        adminSupportStatusLabel(
                            status
                        )
                    )}
                </strong>

                <span>
                    This request is in a terminal state.
                </span>
            </div>
        `;
    }


    const transitions = {

        OPEN: [
            "ACKNOWLEDGED",
            "CANCELLED"
        ],

        ACKNOWLEDGED: [
            "IN_PROGRESS",
            "CANCELLED"
        ],

        IN_PROGRESS: [
            "RESOLVED",
            "CANCELLED"
        ],

        RESOLVED: [
            "CLOSED"
        ]

    };


    const available =
        transitions[status] || [];


    return `

        <div class="admin-support-status-actions">

            ${available.map(
                nextStatus => `
                    <button
                        type="button"
                        class="
                            btn
                            ${
                                nextStatus === "CANCELLED"
                                    ? "btn-outline-danger"
                                    : "btn-primary"
                            }
                        "
                        data-admin-support-status="${nextStatus}"
                    >
                        ${e(
                            adminSupportStatusLabel(
                                nextStatus
                            )
                        )}
                    </button>
                `
            ).join("")}

        </div>


        <div class="mt-3">

            <label
                class="form-label small fw-semibold"
                for="adminSupportStatusNote"
            >
                Optional note
            </label>

            <textarea
                id="adminSupportStatusNote"
                class="form-control"
                rows="2"
                maxlength="2000"
                placeholder="Optional note for the technician..."
            ></textarea>

        </div>
    `;
}


function bindAdminSupportStatusControls(
    request
) {

    document
        .querySelectorAll(
            "[data-admin-support-status]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const nextStatus =
                        button.dataset
                            .adminSupportStatus;

                    const note =
                        String(
                            document
                                .getElementById(
                                    "adminSupportStatusNote"
                                )
                                ?.value ||
                            ""
                        ).trim();

                    if (!nextStatus) {
                        return;
                    }


                    const confirmed =
                        window.confirm(
                            `Change support status to "${adminSupportStatusLabel(nextStatus)}"?`
                        );

                    if (!confirmed) {
                        return;
                    }


                    try {

                        button.disabled = true;

                        button.textContent =
                            "Updating…";


                        await api(
                            "support_status_update",
                            {
                                support_request_id:
                                    request.id,

                                status:
                                    nextStatus,

                                note
                            }
                        );


                        flash(
                            `Support status updated to ${adminSupportStatusLabel(nextStatus)}.`
                        );


                        await openAdminSupportRequest(
                            request.id
                        );


                    } catch (error) {

                        button.disabled = false;

                        button.textContent =
                            adminSupportStatusLabel(
                                nextStatus
                            );

                        flash(
                            error?.message ||
                            "Support status could not be updated.",
                            false
                        );
                    }

                }
            );

        });
}


/* =========================================================
   SUPPORT MESSAGES
   ========================================================= */

function renderAdminSupportMessages(
    messages
) {

    if (!messages.length) {

        return `
            <div class="admin-support-message-empty">
                No messages yet.
            </div>
        `;
    }


    return messages.map(
        message => {

            const sender =
                String(
                    message.sender_type || ""
                ).toUpperCase();

            const isAdmin =
                sender === "ADMIN";

            const isBot =
                sender === "BOT";


            return `
                <div
                    class="
                        admin-support-message
                        ${isAdmin ? "admin" : ""}
                        ${isBot ? "bot" : "technician"}
                    "
                    data-message-id="${e(
                        message.id
                    )}"
                >

                    <div class="admin-support-message-head">

                        <strong>
                            ${
                                isAdmin
                                    ? "Admin"
                                    : isBot
                                        ? "Support Bot"
                                        : "Technician"
                            }
                        </strong>

                        <small>
                            ${e(
                                adminSupportFormatDate(
                                    message.created_at
                                )
                            )}
                        </small>

                    </div>


                    <div class="admin-support-message-body">
                        ${e(
                            message.message ||
                            ""
                        ).replaceAll(
                            "\n",
                            "<br>"
                        )}
                    </div>

                </div>
            `;

        }
    ).join("");
}


/* =========================================================
   SEND ADMIN MESSAGE
   ========================================================= */

function bindAdminSupportMessageComposer(
    requestId
) {

    const form =
        document.getElementById(
            "adminSupportMessageForm"
        );

    const input =
        document.getElementById(
            "adminSupportMessageInput"
        );

    const button =
        document.getElementById(
            "adminSupportSendButton"
        );


    if (!form || !input || !button) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const message =
                String(
                    input.value || ""
                ).trim();


            if (!message) {

                input.focus();

                return;
            }


            try {

                button.disabled = true;

                button.textContent =
                    "Sending…";


                await api(
                    "support_message_send",
                    {
                        support_request_id:
                            requestId,

                        message
                    }
                );


                input.value = "";


                flash(
                    "Message sent successfully."
                );


                await openAdminSupportRequest(
                    requestId
                );


            } catch (error) {

                console.error(
                    "Admin support message send failed:",
                    error
                );

                flash(
                    error?.message ||
                    "Message could not be sent.",
                    false
                );

            } finally {

                button.disabled = false;

                button.textContent =
                    "Send Message";
            }

        }
    );
}

/* =========================================================
   ADMIN FLOATING SUPPORT CHAT
   PHASE 7 - ADMIN SIDE
   ========================================================= */

const adminFloatingSupportState = {

    initialized: false,

    /* Existing Support Request Realtime */
    realtimeChannel: null,

    /* Existing Request Chat */
    currentRequestId: "",
    currentRequest: null,
    currentMessages: [],

    /* Existing Request List */
    requests: [],

    /* Existing Request Unread */
    unread: new Map(),

    /* Existing Request Duplicate Protection */
    seenMessageIds: new Set(),

    /* -----------------------------------------------------
       DIRECT TECHNICIAN CHAT
       ----------------------------------------------------- */

    directConversations: [],

    currentDirectTechnicianId: "",
    currentDirectTechnician: null,
    currentDirectMessages: [],

    directUnread: new Map(),

    directSeenMessageIds: new Set(),

    /* Direct Chat Realtime */
    directRealtimeChannel: null,
    directRealtimeReady: false,
    directRealtimePending: [],

    /* Widget */
    open: false,
    loading: false
};


/* =========================================================
   FLOATING SUPPORT WIDGET
   ========================================================= */

function ensureAdminFloatingSupportWidget() {

    if (
        document.getElementById(
            "adminFloatingSupport"
        )
    ) {
        return;
    }

    const root =
        document.createElement("div");

    root.id =
        "adminFloatingSupport";

    root.innerHTML = `

        <button
            type="button"
            id="adminFloatingSupportButton"
            class="admin-floating-support-button"
            aria-label="Open Support"
        >

            <span class="admin-floating-support-icon">
                💬
            </span>

            <span class="admin-floating-support-label">
                Support
            </span>

            <span
                id="adminFloatingSupportBadge"
                class="admin-floating-support-badge"
                hidden
            >
                0
            </span>

        </button>


        <section
            id="adminFloatingSupportPanel"
            class="admin-floating-support-panel"
            hidden
            aria-label="Support chat"
        >

            <header class="admin-floating-support-header">

                <div class="admin-floating-support-heading">

                    <strong>
                        Support Center
                    </strong>

                    <small>
                        Live technician support
                    </small>

                </div>


                <button
                    type="button"
                    id="adminFloatingSupportClose"
                    class="admin-floating-support-close"
                    aria-label="Close Support"
                >
                    ×
                </button>

            </header>


            <div
                id="adminFloatingSupportBody"
                class="admin-floating-support-body"
            >

                <div
                    class="admin-floating-support-loading"
                >
                    Loading support requests…
                </div>

            </div>

        </section>

    `;

    document.body.appendChild(root);


    document
        .getElementById(
            "adminFloatingSupportButton"
        )
        ?.addEventListener(
            "click",
            toggleAdminFloatingSupport
        );


    document
        .getElementById(
            "adminFloatingSupportClose"
        )
        ?.addEventListener(
            "click",
            closeAdminFloatingSupport
        );


    adminFloatingSupportState.initialized =
        true;
}


/* =========================================================
   OPEN / CLOSE
   ========================================================= */

function toggleAdminFloatingSupport() {

    if (
        adminFloatingSupportState.open
    ) {
        closeAdminFloatingSupport();
        return;
    }

    openAdminFloatingSupport();
}


/* =========================================================
   OPEN FLOATING SUPPORT
   ========================================================= */

async function openAdminFloatingSupport() {

    ensureAdminFloatingSupportWidget();

    adminFloatingSupportState.open = true;

    const panel =
        document.getElementById(
            "adminFloatingSupportPanel"
        );

    if (panel) {
        panel.hidden = false;
    }

    await loadAdminFloatingSupportHome();
}


function closeAdminFloatingSupport() {

    adminFloatingSupportState.open = false;

    adminFloatingSupportState.currentRequestId = "";
    adminFloatingSupportState.currentRequest = null;
    adminFloatingSupportState.currentMessages = [];

    const panel =
        document.getElementById(
            "adminFloatingSupportPanel"
        );

    if (panel) {
        panel.hidden = true;
    }
}

/* =========================================================
   LOAD REQUESTS
   ========================================================= */

async function loadAdminFloatingSupportRequests() {

    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );

    if (!body) {
        return;
    }

    adminFloatingSupportState.loading =
        true;

    body.innerHTML = `
        <div
            class="admin-floating-support-loading"
        >
            <span class="spinner-border spinner-border-sm"></span>
            <span>Loading support requests…</span>
        </div>
    `;


    try {

        const response =
            await api(
                "support_requests",
                {
                    offset: 0,
                    limit: 50
                }
            );


        const requests =
            Array.isArray(
                response?.requests
            )
                ? response.requests
                : [];


        adminFloatingSupportState.requests =
            requests;


        renderAdminFloatingSupportRequestList(
            requests
        );


    } catch (error) {

        console.error(
            "Floating support request load failed:",
            error
        );

        body.innerHTML = `
            <div
                class="admin-floating-support-error"
            >

                <strong>
                    Unable to load support requests
                </strong>

                <span>
                    ${e(
                        error?.message ||
                        "Request loading failed."
                    )}
                </span>

                <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    id="adminFloatingSupportRetry"
                >
                    Retry
                </button>

            </div>
        `;


        document
            .getElementById(
                "adminFloatingSupportRetry"
            )
            ?.addEventListener(
                "click",
                () =>
                    loadAdminFloatingSupportRequests()
            );

    } finally {

        adminFloatingSupportState.loading =
            false;

    }
}

/* =========================================================
   LOAD FLOATING SUPPORT HOME
   REQUESTS + DIRECT CONVERSATIONS
   ========================================================= */

async function loadAdminFloatingSupportHome() {

    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );

    if (!body) {
        return;
    }

    adminFloatingSupportState.loading = true;

    body.innerHTML = `
        <div
            class="admin-floating-support-loading"
        >
            <span
                class="spinner-border spinner-border-sm"
            ></span>

            <span>
                Loading support…
            </span>
        </div>
    `;

    try {

        const [
            requestResponse,
            directResponse
        ] = await Promise.all([

            api(
                "support_requests",
                {
                    offset: 0,
                    limit: 50
                }
            ),

            api(
                "direct_support_conversations"
            )

        ]);


        const requests =
            Array.isArray(
                requestResponse?.requests
            )
                ? requestResponse.requests
                : [];


        const conversations =
            Array.isArray(
                directResponse?.conversations
            )
                ? directResponse.conversations
                : [];


        adminFloatingSupportState.requests =
            requests;


        adminFloatingSupportState.directConversations =
            conversations;


        /*
         * Refresh direct unread map
         */
        adminFloatingSupportState.directUnread.clear();


        conversations.forEach(
            conversation => {

                const technicianId =
                    String(
                        conversation?.technician_id ||
                        conversation?.technician?.id ||
                        ""
                    ).trim();


                if (!technicianId) {
                    return;
                }


                const unread =
                    Number(
                        conversation?.unread_count ||
                        conversation?.unread ||
                        0
                    );


                if (unread > 0) {

                    adminFloatingSupportState.directUnread.set(
                        technicianId,
                        unread
                    );

                }

            }
        );


        updateAdminFloatingSupportBadge();


        renderAdminFloatingSupportHome();


    } catch (error) {

        console.error(
            "Floating support home load failed:",
            error
        );


        body.innerHTML = `
            <div
                class="admin-floating-support-error"
            >

                <strong>
                    Unable to load Support
                </strong>

                <span>
                    ${e(
                        error?.message ||
                        "Support loading failed."
                    )}
                </span>

                <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    id="adminFloatingSupportRetry"
                >
                    Retry
                </button>

            </div>
        `;


        document
            .getElementById(
                "adminFloatingSupportRetry"
            )
            ?.addEventListener(
                "click",
                () =>
                    loadAdminFloatingSupportHome()
            );

    } finally {

        adminFloatingSupportState.loading =
            false;

    }
}

/* =========================================================
   FLOATING SUPPORT HOME
   REQUESTS + DIRECT TECHNICIAN CHAT
   ========================================================= */

function renderAdminFloatingSupportHome() {

    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );

    if (!body) {
        return;
    }


    const requests =
        Array.isArray(
            adminFloatingSupportState.requests
        )
            ? adminFloatingSupportState.requests
            : [];


    const conversations =
        Array.isArray(
            adminFloatingSupportState.directConversations
        )
            ? adminFloatingSupportState.directConversations
            : [];


    const activeRequests =
        requests.filter(
            request =>
                ![
                    "CLOSED",
                    "CANCELLED"
                ].includes(
                    String(
                        request.status || ""
                    ).toUpperCase()
                )
        );


    body.innerHTML = `

        <div
            class="admin-floating-support-home"
        >

            <!-- =========================================
                 ACTIVE REQUESTS
                 ========================================= -->

            <section
                class="admin-floating-support-section"
            >

                <div
                    class="admin-floating-support-list-header"
                >

                    <div>

                        <strong>
                            Active Requests
                        </strong>

                        <small>
                            ${activeRequests.length}
                            active conversation${
                                activeRequests.length === 1
                                    ? ""
                                    : "s"
                            }
                        </small>

                    </div>


                    <button
                        type="button"
                        id="adminFloatingSupportRefresh"
                        class="admin-floating-support-refresh"
                        title="Refresh"
                    >
                        ↻
                    </button>

                </div>


                ${
                    activeRequests.length
                        ? `

                            <div
                                class="admin-floating-support-request-list"
                            >

                                ${activeRequests.map(
                                    request => {

                                        const unread =
                                            Number(
                                                adminFloatingSupportState.unread.get(
                                                    request.id
                                                ) || 0
                                            );


                                        const technician =
                                            request.technicians || {};


                                        return `

                                            <button
                                                type="button"
                                                class="admin-floating-support-request"
                                                data-floating-support-request="${e(
                                                    request.id
                                                )}"
                                            >

                                                <div
                                                    class="admin-floating-support-request-main"
                                                >

                                                    <div
                                                        class="admin-floating-support-request-top"
                                                    >

                                                        <strong>
                                                            ${e(
                                                                request.support_token ||
                                                                "Support Request"
                                                            )}
                                                        </strong>


                                                        ${
                                                            unread > 0
                                                                ? `
                                                                    <span
                                                                        class="admin-floating-support-unread"
                                                                    >
                                                                        ${unread}
                                                                    </span>
                                                                `
                                                                : ""
                                                        }

                                                    </div>


                                                    <span>
                                                        ${e(
                                                            technician.full_name ||
                                                            "Unknown Technician"
                                                        )}
                                                    </span>


                                                    <small>
                                                        ${e(
                                                            adminSupportTypeLabel(
                                                                request.support_type
                                                            )
                                                        )}
                                                        ·
                                                        ${e(
                                                            adminSupportStatusLabel(
                                                                request.status
                                                            )
                                                        )}
                                                    </small>

                                                </div>


                                                <span
                                                    class="
                                                        admin-floating-support-status-dot
                                                        ${adminSupportStatusClass(
                                                            request.status
                                                        )}
                                                    "
                                                ></span>

                                            </button>

                                        `;

                                    }
                                ).join("")}

                            </div>

                        `
                        : `

                            <div
                                class="admin-floating-support-mini-empty"
                            >
                                No active support requests.
                            </div>

                        `
                }

            </section>


            <!-- =========================================
                 DIRECT TECHNICIAN CHAT
                 ========================================= -->

            <section
                class="admin-floating-support-section admin-floating-direct-section"
            >

                <div
                    class="admin-floating-support-list-header"
                >

                    <div>

                        <strong>
                            Direct Technician Chat
                        </strong>

                        <small>
                            ${
                                conversations.length
                            }
                            conversation${
                                conversations.length === 1
                                    ? ""
                                    : "s"
                            }
                        </small>

                    </div>

                </div>


                ${
                    conversations.length
                        ? `

                            <div
                                class="admin-floating-direct-list"
                            >

                                ${conversations.map(
                                    conversation => {

                                        const technicianId =
                                            String(
                                                conversation?.technician_id ||
                                                conversation?.technician?.id ||
                                                ""
                                            ).trim();


                                        const technician =
                                            conversation?.technician ||
                                            conversation?.technicians ||
                                            {};


                                        const technicianName =
                                            technician?.full_name ||
                                            conversation?.technician_name ||
                                            "Technician";


                                        const lastMessage =
                                            conversation?.last_message ||
                                            conversation?.message ||
                                            "";


                                        const lastMessageTime =
                                            conversation?.last_message_created_at ||
                                            conversation?.last_message_at ||
                                            conversation?.created_at ||
                                            "";


                                        const unread =
                                            Number(
                                                adminFloatingSupportState.directUnread.get(
                                                    technicianId
                                                ) ||
                                                conversation?.unread_count ||
                                                conversation?.unread ||
                                                0
                                            );


                                        return `

                                            <button
                                                type="button"
                                                class="admin-floating-direct-conversation"
                                                data-admin-direct-technician="${e(
                                                    technicianId
                                                )}"
                                            >

                                                <div
                                                    class="admin-floating-direct-avatar"
                                                >
                                                    ${e(
                                                        String(
                                                            technicianName
                                                        )
                                                            .trim()
                                                            .charAt(0)
                                                            .toUpperCase()
                                                    )}
                                                </div>


                                                <div
                                                    class="admin-floating-direct-main"
                                                >

                                                    <div
                                                        class="admin-floating-direct-top"
                                                    >

                                                        <strong>
                                                            ${e(
                                                                technicianName
                                                            )}
                                                        </strong>


                                                        ${
                                                            unread > 0
                                                                ? `
                                                                    <span
                                                                        class="admin-floating-support-unread"
                                                                    >
                                                                        ${unread}
                                                                    </span>
                                                                `
                                                                : ""
                                                        }

                                                    </div>


                                                    <span
                                                        class="admin-floating-direct-preview"
                                                    >
                                                        ${e(
                                                            lastMessage ||
                                                            "No messages yet."
                                                        )}
                                                    </span>


                                                    ${
                                                        lastMessageTime
                                                            ? `
                                                                <small>
                                                                    ${e(
                                                                        adminSupportFormatDate(
                                                                            lastMessageTime
                                                                        )
                                                                    )}
                                                                </small>
                                                            `
                                                            : ""
                                                    }

                                                </div>

                                            </button>

                                        `;

                                    }
                                ).join("")}

                            </div>

                        `
                        : `

                            <div
                                class="admin-floating-support-mini-empty"
                            >

                                No direct technician conversations yet.

                            </div>

                        `
                }

            </section>

        </div>

    `;


    /*
     * REQUEST REFRESH
     */

    document
        .getElementById(
            "adminFloatingSupportRefresh"
        )
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                loadAdminFloatingSupportHome();

            }
        );


    /*
     * REQUEST CHAT OPEN
     */

    document
        .querySelectorAll(
            "[data-floating-support-request]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openAdminFloatingSupportChat(
                            button.dataset
                                .floatingSupportRequest
                        );

                    }
                );

            }
        );


    /*
     * DIRECT CHAT OPEN
     */

    document
        .querySelectorAll(
            "[data-admin-direct-technician]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openAdminDirectSupportChat(
                            button.dataset
                                .adminDirectTechnician
                        );

                    }
                );

            }
        );

}

/* =========================================================
   REQUEST LIST COMPATIBILITY WRAPPER
   ========================================================= */

function renderAdminFloatingSupportRequestList(
    requests
) {

    adminFloatingSupportState.requests =
        Array.isArray(requests)
            ? requests
            : [];

    renderAdminFloatingSupportHome();
}

/* =========================================================
   OPEN DIRECT TECHNICIAN CHAT
   ========================================================= */

async function openAdminDirectSupportChat(
    technicianId
) {

    const id =
        String(
            technicianId || ""
        ).trim();


    if (!id) {
        return;
    }


    /*
     * Switch from Request Chat → Direct Chat
     */

    adminFloatingSupportState.currentRequestId =
        "";

    adminFloatingSupportState.currentRequest =
        null;

    adminFloatingSupportState.currentMessages =
        [];


    adminFloatingSupportState.currentDirectTechnicianId =
        id;


    adminFloatingSupportState.directUnread.delete(
        id
    );


    updateAdminFloatingSupportBadge();


    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );


    if (!body) {
        return;
    }


    body.innerHTML = `

        <div
            class="admin-floating-support-chat-loading"
        >

            <span
                class="spinner-border spinner-border-sm"
            ></span>

            <span>
                Opening direct chat…
            </span>

        </div>

    `;


    try {

        const response =
            await api(
                "direct_support_messages",
                {
                    technician_id: id
                }
            );


        const messages =
            Array.isArray(
                response?.messages
            )
                ? response.messages
                : [];


        const technician =
            response?.technician ||
            null;


        adminFloatingSupportState.currentDirectTechnician =
            technician;


        adminFloatingSupportState.currentDirectMessages =
            messages;


        messages.forEach(
            message => {

                if (message?.id) {

                    adminFloatingSupportState.directSeenMessageIds.add(
                        String(
                            message.id
                        )
                    );

                }

            }
        );


        renderAdminDirectSupportChat();


    } catch (error) {

        console.error(
            "Admin direct support chat failed:",
            error
        );


        body.innerHTML = `

            <div
                class="admin-floating-support-error"
            >

                <button
                    type="button"
                    class="btn btn-link p-0"
                    id="adminFloatingSupportBack"
                >
                    ← Back
                </button>


                <strong>
                    Unable to open direct chat
                </strong>


                <span>
                    ${e(
                        error?.message ||
                        "Direct conversation could not be loaded."
                    )}
                </span>

            </div>

        `;


        document
            .getElementById(
                "adminFloatingSupportBack"
            )
            ?.addEventListener(
                "click",
                () =>
                    loadAdminFloatingSupportHome()
            );

    }

}

/* =========================================================
   DIRECT CHAT UI
   ========================================================= */

function renderAdminDirectSupportChat() {

    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );


    const technician =
        adminFloatingSupportState
            .currentDirectTechnician;


    const messages =
        adminFloatingSupportState
            .currentDirectMessages;


    if (!body) {
        return;
    }


    const technicianName =
        technician?.full_name ||
        "Technician";


    body.innerHTML = `

        <div
            class="admin-floating-support-chat"
        >

            <header
                class="admin-floating-support-chat-header"
            >

                <button
                    type="button"
                    id="adminFloatingSupportBack"
                    class="admin-floating-support-back"
                    title="Back"
                >
                    ←
                </button>


                <div
                    class="admin-floating-support-chat-title"
                >

                    <strong>
                        Direct Chat
                    </strong>

                    <small>
                        ${e(
                            technicianName
                        )}
                    </small>

                </div>


                <span
                    class="admin-floating-direct-header-badge"
                >
                    Direct
                </span>

            </header>


            <div
                id="adminFloatingSupportMessages"
                class="admin-floating-support-messages"
            >

                ${renderAdminDirectSupportMessages(
                    messages
                )}

            </div>


            <form
                id="adminDirectSupportMessageForm"
                class="admin-floating-support-composer"
            >

                <textarea
                    id="adminDirectSupportMessageInput"
                    rows="2"
                    maxlength="2000"
                    placeholder="Write a message..."
                    required
                ></textarea>


                <button
                    type="submit"
                    id="adminDirectSupportSend"
                >
                    Send
                </button>

            </form>

        </div>

    `;


    document
        .getElementById(
            "adminFloatingSupportBack"
        )
        ?.addEventListener(
            "click",
            () => {

                adminFloatingSupportState.currentDirectTechnicianId =
                    "";

                adminFloatingSupportState.currentDirectTechnician =
                    null;

                adminFloatingSupportState.currentDirectMessages =
                    [];

                loadAdminFloatingSupportHome();

            }
        );


    bindAdminDirectSupportComposer();


    scrollAdminFloatingSupportMessages();

}

/* =========================================================
   DIRECT CHAT COMPOSER
   ========================================================= */

function bindAdminDirectSupportComposer() {

    const form =
        document.getElementById(
            "adminDirectSupportMessageForm"
        );


    const input =
        document.getElementById(
            "adminDirectSupportMessageInput"
        );


    const button =
        document.getElementById(
            "adminDirectSupportSend"
        );


    const technicianId =
        adminFloatingSupportState
            .currentDirectTechnicianId;


    if (
        !form ||
        !input ||
        !button ||
        !technicianId
    ) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const message =
                String(
                    input.value || ""
                ).trim();


            if (!message) {

                input.focus();

                return;

            }


            try {

                button.disabled = true;

                button.textContent =
                    "Sending…";


                const response =
                    await api(
                        "direct_support_message_send",
                        {
                            technician_id:
                                technicianId,

                            message
                        }
                    );


                input.value = "";


                const sentMessage =
                    response?.message ||
                    response?.data ||
                    null;


                /*
                 * Add immediately.
                 *
                 * Realtime may deliver the same
                 * message shortly afterwards.
                 */

                if (sentMessage?.id) {

                    addAdminDirectRealtimeMessage(
                        sentMessage
                    );

                }


                input.focus();


            } catch (error) {

                console.error(
                    "Admin direct message send failed:",
                    error
                );


                flash(
                    error?.message ||
                    "Message could not be sent.",
                    false
                );

            } finally {

                button.disabled = false;

                button.textContent =
                    "Send";

            }

        }
    );

}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openAdminFloatingSupportChat(
    requestId
) {

    const id =
        String(
            requestId || ""
        ).trim();


    if (!id) {
        return;
    }


    adminFloatingSupportState.currentRequestId =
        id;


    adminFloatingSupportState.unread.delete(
        id
    );


    updateAdminFloatingSupportBadge();


    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );


    if (!body) {
        return;
    }


    body.innerHTML = `

        <div
            class="admin-floating-support-chat-loading"
        >

            <span class="spinner-border spinner-border-sm"></span>

            <span>
                Opening conversation…
            </span>

        </div>

    `;


    try {

        const [
            requestResponse,
            messageResponse
        ] = await Promise.all([

            api(
                "support_get_request",
                {
                    request_id: id
                }
            ),

            api(
                "support_messages",
                {
                    support_request_id: id
                }
            )

        ]);


        const request =
            requestResponse?.request;


        const messages =
            Array.isArray(
                messageResponse?.messages
            )
                ? messageResponse.messages
                : [];


        if (!request?.id) {
            throw new Error(
                "Support request could not be loaded."
            );
        }


        adminFloatingSupportState.currentRequest =
            request;


        adminFloatingSupportState.currentMessages =
    messages;

messages.forEach(message => {
    if (message?.id) {
        adminFloatingSupportState.seenMessageIds.add(
            String(message.id)
        );
    }
});

renderAdminFloatingSupportChat();

    } catch (error) {

        console.error(
            "Admin floating support chat failed:",
            error
        );


        body.innerHTML = `

            <div
                class="admin-floating-support-error"
            >

                <button
                    type="button"
                    class="btn btn-link p-0"
                    id="adminFloatingSupportBack"
                >
                    ← Back
                </button>

                <strong>
                    Unable to open conversation
                </strong>

                <span>
                    ${e(
                        error?.message ||
                        "Conversation could not be loaded."
                    )}
                </span>

            </div>

        `;


        document
            .getElementById(
                "adminFloatingSupportBack"
            )
            ?.addEventListener(
                "click",
                () =>
                    renderAdminFloatingSupportRequestList(
                        adminFloatingSupportState.requests
                    )
            );

    }
}


/* =========================================================
   CHAT UI
   ========================================================= */

function renderAdminFloatingSupportChat() {

    const body =
        document.getElementById(
            "adminFloatingSupportBody"
        );


    const request =
        adminFloatingSupportState.currentRequest;


    const messages =
        adminFloatingSupportState.currentMessages;


    if (!body || !request) {
        return;
    }


    const technician =
        request.technicians || {};


    const closed =
        [
            "CLOSED",
            "CANCELLED"
        ].includes(
            String(
                request.status || ""
            ).toUpperCase()
        );


    body.innerHTML = `

        <div
            class="admin-floating-support-chat"
        >

            <header
                class="admin-floating-support-chat-header"
            >

                <button
                    type="button"
                    id="adminFloatingSupportBack"
                    class="admin-floating-support-back"
                    title="Back"
                >
                    ←
                </button>


                <div
                    class="admin-floating-support-chat-title"
                >

                    <strong>
                        ${e(
                            request.support_token
                        )}
                    </strong>

                    <small>
                        ${e(
                            technician.full_name ||
                            "Technician"
                        )}
                    </small>

                </div>


                <span
                    class="
                        support-status-badge
                        ${adminSupportStatusClass(
                            request.status
                        )}
                    "
                >
                    ${e(
                        adminSupportStatusLabel(
                            request.status
                        )
                    )}
                </span>

            </header>


            <div
                id="adminFloatingSupportMessages"
                class="admin-floating-support-messages"
            >

                ${renderAdminFloatingSupportMessages(
                    messages
                )}

            </div>


            ${
                closed
                    ? `
                        <div
                            class="admin-floating-support-closed"
                        >
                            This support request is closed.
                        </div>
                    `
                    : `
                        <form
                            id="adminFloatingSupportMessageForm"
                            class="admin-floating-support-composer"
                        >

                            <textarea
                                id="adminFloatingSupportMessageInput"
                                rows="2"
                                maxlength="2000"
                                placeholder="Write a reply..."
                                required
                            ></textarea>


                            <button
                                type="submit"
                                id="adminFloatingSupportSend"
                            >
                                Send
                            </button>

                        </form>
                    `
            }

        </div>

    `;


    document
        .getElementById(
            "adminFloatingSupportBack"
        )
        ?.addEventListener(
            "click",
            () => {

                adminFloatingSupportState.currentRequestId =
                    "";

                adminFloatingSupportState.currentRequest =
                    null;

                adminFloatingSupportState.currentMessages =
                    [];

                renderAdminFloatingSupportRequestList(
                    adminFloatingSupportState.requests
                );

            }
        );


    bindAdminFloatingSupportComposer();

    scrollAdminFloatingSupportMessages();

}


/* =========================================================
   MESSAGE HTML
   ========================================================= */

function renderAdminFloatingSupportMessages(
    messages
) {

    if (!messages.length) {

        return `
            <div
                class="admin-floating-support-no-messages"
            >
                No messages yet.
            </div>
        `;

    }


    return messages
        .map(message => {

            const sender =
                String(
                    message.sender_type || ""
                ).toUpperCase();


            const isAdmin =
                sender === "ADMIN";


            const isBot =
                sender === "BOT";


            return `

                <div
                    class="
                        admin-floating-support-message
                        ${isAdmin ? "admin" : ""}
                        ${isBot ? "bot" : "technician"}
                    "
                    data-floating-message-id="${e(
                        message.id
                    )}"
                >

                    <div
                        class="admin-floating-support-message-meta"
                    >

                        <strong>
                            ${
                                isAdmin
                                    ? "Admin"
                                    : isBot
                                        ? "Support Bot"
                                        : "Technician"
                            }
                        </strong>

                        <small>
                            ${e(
                                adminSupportFormatDate(
                                    message.created_at
                                )
                            )}
                        </small>

                    </div>


                    <div
                        class="admin-floating-support-message-text"
                    >
                        ${e(
                            message.message || ""
                        ).replaceAll(
                            "\n",
                            "<br>"
                        )}
                    </div>

                </div>

            `;

        })
        .join("");
}

/* =========================================================
   DIRECT CHAT MESSAGE HTML
   ADMIN DIRECT CHAT
   ========================================================= */

function renderAdminDirectSupportMessages(
    messages
) {

    if (
        !Array.isArray(messages) ||
        !messages.length
    ) {

        return `
            <div
                class="admin-floating-support-no-messages"
            >
                No messages yet.
            </div>
        `;

    }


    return messages
        .map(
            message => {

                const sender =
                    String(
                        message?.sender_type || ""
                    ).toUpperCase();


                const isAdmin =
                    sender === "ADMIN";


                /*
                 * Admin message is:
                 *
                 * Unseen =
                 * read_at_technician is NULL
                 *
                 * Seen =
                 * read_at_technician has value
                 */
                const isSeen =
                    isAdmin &&
                    Boolean(
                        message?.read_at_technician
                    );


                const time =
                    adminSupportFormatDate(
                        message?.created_at
                    );


                return `
                    <div
                        class="
                            admin-floating-support-message
                            ${isAdmin ? "admin" : "technician"}
                        "
                        data-direct-message-id="${e(
                            message?.id || ""
                        )}"
                    >

                        <div
                            class="
                                admin-floating-support-message-text
                            "
                        >
                            ${e(
                                message?.message || ""
                            ).replaceAll(
                                "\n",
                                "<br>"
                            )}
                        </div>


                        <div
                            class="
                                admin-floating-support-message-meta
                                direct-message-meta
                            "
                        >

                            <small>
                                ${e(time)}
                            </small>


                            ${
                                isAdmin
                                    ? `
                                        <span
                                            class="
                                                direct-message-seen
                                                ${
                                                    isSeen
                                                        ? "seen"
                                                        : "unseen"
                                                }
                                            "
                                            data-seen-message-id="${e(
                                                message?.id || ""
                                            )}"
                                            aria-label="${
                                                isSeen
                                                    ? "Seen"
                                                    : "Unseen"
                                            }"
                                            title="${
                                                isSeen
                                                    ? "Seen"
                                                    : "Unseen"
                                            }"
                                        >
                                            ${
                                                isSeen
                                                    ? "Seen"
                                                    : "Unseen"
                                            }
                                        </span>
                                    `
                                    : ""
                            }

                        </div>

                    </div>
                `;

            }
        )
        .join("");

}


/* =========================================================
   ADD REALTIME MESSAGE WITHOUT DUPLICATE
   ========================================================= */

function addAdminFloatingRealtimeMessage(message) {

    if (!message?.id) {
        return;
    }

    const messageId = String(message.id);
    const requestId = String(
        message.support_request_id || ""
    ).trim();

    if (!requestId) {
        return;
    }

    const sender = String(
        message.sender_type || ""
    ).toUpperCase();

    /*
     * Prevent duplicate realtime/API delivery.
     *
     * currentMessages only contains the currently
     * opened conversation, so duplicate protection
     * must also work when another conversation is closed.
     */
    if (!adminFloatingSupportState.seenMessageIds) {
        adminFloatingSupportState.seenMessageIds =
            new Set();
    }

    if (
        adminFloatingSupportState.seenMessageIds.has(
            messageId
        )
    ) {
        return;
    }

    adminFloatingSupportState.seenMessageIds.add(
        messageId
    );


    /*
     * ADMIN's own message never creates unread count.
     */
    const isAdmin =
        sender === "ADMIN";


    /*
     * Check whether this exact conversation is
     * currently visible to the admin.
     */
    const isCurrentChatVisible =
        adminFloatingSupportState.open === true &&
        adminFloatingSupportState.currentRequestId ===
            requestId &&
        document.getElementById(
            "adminFloatingSupportMessages"
        );


    /*
     * -----------------------------------------------------
     * CURRENTLY OPEN CONVERSATION
     * -----------------------------------------------------
     */
    if (isCurrentChatVisible) {

        adminFloatingSupportState.currentMessages.push(
            message
        );

        const container =
            document.getElementById(
                "adminFloatingSupportMessages"
            );

        if (!container) {
            return;
        }

        const empty =
            container.querySelector(
                ".admin-floating-support-no-messages"
            );

        if (empty) {
            empty.remove();
        }


        const isBot =
            sender === "BOT";


        const wrapper =
            document.createElement("div");

        wrapper.className =
            `
                admin-floating-support-message
                ${isAdmin ? "admin" : ""}
                ${isBot ? "bot" : "technician"}
            `;

        wrapper.dataset.floatingMessageId =
            messageId;


        wrapper.innerHTML = `

            <div
                class="admin-floating-support-message-meta"
            >

                <strong>
                    ${
                        isAdmin
                            ? "Admin"
                            : isBot
                                ? "Support Bot"
                                : "Technician"
                    }
                </strong>

                <small>
                    ${e(
                        adminSupportFormatDate(
                            message.created_at
                        )
                    )}
                </small>

            </div>


            <div
                class="admin-floating-support-message-text"
            >
                ${e(
                    message.message || ""
                ).replaceAll(
                    "\n",
                    "<br>"
                )}
            </div>

        `;


        container.appendChild(
            wrapper
        );

        scrollAdminFloatingSupportMessages();

        return;
    }


    /*
     * -----------------------------------------------------
     * CONVERSATION IS NOT CURRENTLY OPEN
     * -----------------------------------------------------
     *
     * Only technician messages create unread count.
     * Admin messages must never create unread count.
     */
    if (sender === "TECHNICIAN") {

        const currentUnread =
            Number(
                adminFloatingSupportState.unread.get(
                    requestId
                ) || 0
            );

        adminFloatingSupportState.unread.set(
            requestId,
            currentUnread + 1
        );

        updateAdminFloatingSupportBadge();


        /*
         * If the popup is showing the request LIST,
         * refresh the list so the per-request unread
         * count appears immediately.
         *
         * If a chat is currently open, do NOT replace
         * that chat with the request list.
         */
        if (
            adminFloatingSupportState.open &&
            !adminFloatingSupportState.currentRequestId
        ) {
            renderAdminFloatingSupportRequestList(
                adminFloatingSupportState.requests
            );
        }
    }
}

/* =========================================================
   DIRECT CHAT REALTIME - INSERT
   ========================================================= */

function addAdminDirectRealtimeMessage(
    message
) {

    if (!message?.id) {
        return;
    }


    const messageId =
        String(message.id);


    const technicianId =
        String(
            message.technician_id || ""
        ).trim();


    if (!technicianId) {
        return;
    }


    /* -----------------------------------------------------
       DUPLICATE PROTECTION
       ----------------------------------------------------- */

    if (
        adminFloatingSupportState.directSeenMessageIds.has(
            messageId
        )
    ) {

        return;

    }


    adminFloatingSupportState.directSeenMessageIds.add(
        messageId
    );


    const sender =
        String(
            message.sender_type || ""
        ).toUpperCase();


    /* -----------------------------------------------------
       CURRENT DIRECT CHAT OPEN
       ----------------------------------------------------- */

    const isCurrentChatVisible =
        adminFloatingSupportState.open === true &&

        adminFloatingSupportState.currentRequestId === "" &&

        String(
            adminFloatingSupportState.currentDirectTechnicianId
        ) === technicianId &&

        document.getElementById(
            "adminFloatingSupportMessages"
        );


    if (isCurrentChatVisible) {

        adminFloatingSupportState.currentDirectMessages
            .push(message);


        const container =
            document.getElementById(
                "adminFloatingSupportMessages"
            );


        if (!container) {
            return;
        }


        const empty =
            container.querySelector(
                ".admin-floating-support-no-messages"
            );


        if (empty) {
            empty.remove();
        }


        const isAdmin =
            sender === "ADMIN";


        const wrapper =
            document.createElement("div");


        wrapper.className =
            `
                admin-floating-support-message
                ${isAdmin ? "admin" : "technician"}
            `;


        wrapper.dataset.directMessageId =
            messageId;


        const isSeen =
            isAdmin &&
            Boolean(
                message.read_at_technician
            );


        wrapper.innerHTML = `

            <div
                class="admin-floating-support-message-text"
            >
                ${e(
                    message.message || ""
                ).replaceAll(
                    "\n",
                    "<br>"
                )}
            </div>


            <div
                class="
                    admin-floating-support-message-meta
                    direct-message-meta
                "
            >

                <small>
                    ${e(
                        adminSupportFormatDate(
                            message.created_at
                        )
                    )}
                </small>


                ${
    isAdmin
        ? `
            <span
                class="
                    direct-message-seen
                    ${
                        isSeen
                            ? "seen"
                            : "unseen"
                    }
                "
                data-seen-message-id="${e(
                    messageId
                )}"
                aria-label="${
                    isSeen
                        ? "Seen"
                        : "Unseen"
                }"
                title="${
                    isSeen
                        ? "Seen"
                        : "Unseen"
                }"
            >
                ${
                    isSeen
                        ? "Seen"
                        : "Unseen"
                }
            </span>
        `
        : ""
}

            </div>

        `;


        container.appendChild(
            wrapper
        );


        scrollAdminFloatingSupportMessages();


        return;
    }


    /* -----------------------------------------------------
       DIRECT CHAT NOT OPEN
       ----------------------------------------------------- */

    if (sender === "TECHNICIAN") {

        const currentUnread =
            Number(
                adminFloatingSupportState.directUnread.get(
                    technicianId
                ) || 0
            );


        adminFloatingSupportState.directUnread.set(
            technicianId,
            currentUnread + 1
        );


        updateAdminFloatingSupportBadge();

    }

}


/* =========================================================
   DIRECT CHAT REALTIME - UPDATE
   SEEN / UNSEEN
   ========================================================= */

function updateAdminDirectRealtimeMessage(
    message
) {

    if (!message?.id) {
        return;
    }


    const messageId =
        String(
            message.id
        ).trim();


    const technicianId =
        String(
            message.technician_id || ""
        ).trim();


    if (!technicianId) {
        return;
    }


    /* =====================================================
       ONLY CURRENT DIRECT CHAT
       ===================================================== */

    const isCurrentChatVisible =
        adminFloatingSupportState.open === true &&

        adminFloatingSupportState.currentRequestId === "" &&

        String(
            adminFloatingSupportState
                .currentDirectTechnicianId
        ) === technicianId;


    if (!isCurrentChatVisible) {
        return;
    }


    /* =====================================================
       FIND MESSAGE IN LOCAL STATE
       ===================================================== */

    const index =
        adminFloatingSupportState
            .currentDirectMessages
            .findIndex(
                item =>
                    String(
                        item?.id
                    ) === messageId
            );


    if (index === -1) {
        return;
    }


    /* =====================================================
       UPDATE LOCAL MESSAGE
       ===================================================== */

    adminFloatingSupportState
        .currentDirectMessages[
            index
        ] = {

            ...adminFloatingSupportState
                .currentDirectMessages[
                    index
                ],

            ...message

        };


    /* =====================================================
       FIND MESSAGE BUBBLE
       ===================================================== */

    const element =
        document.querySelector(
            `[data-direct-message-id="${CSS.escape(
                messageId
            )}"]`
        );


    if (!element) {
        return;
    }


    /* =====================================================
       ONLY ADMIN SENT MESSAGE
       ===================================================== */

    const sender =
        String(
            message?.sender_type ||
            adminFloatingSupportState
                .currentDirectMessages[
                    index
                ]
                ?.sender_type ||
            ""
        ).toUpperCase();


    if (
        sender !== "ADMIN"
    ) {
        return;
    }


    /* =====================================================
       SEEN STATE
       ===================================================== */

    const isSeen =
        Boolean(
            message?.read_at_technician
        );


    /* =====================================================
       FIND STATUS ELEMENT
       ===================================================== */

    const seenElement =
        element.querySelector(
            ".direct-message-seen"
        );


    if (!seenElement) {
        return;
    }


    /* =====================================================
       UPDATE TEXT
       ===================================================== */

    seenElement.textContent =
        isSeen
            ? "Seen"
            : "Unseen";


    /* =====================================================
       UPDATE CSS STATE
       ===================================================== */

    seenElement.classList.toggle(
        "seen",
        isSeen
    );

    seenElement.classList.toggle(
        "unseen",
        !isSeen
    );


    /*
     * Remove old class if any old version
     * of the markup still has it.
     */
    seenElement.classList.remove(
        "is-seen"
    );


    /* =====================================================
       ACCESSIBILITY
       ===================================================== */

    seenElement.setAttribute(
        "aria-label",
        isSeen
            ? "Seen"
            : "Unseen"
    );

    seenElement.setAttribute(
        "title",
        isSeen
            ? "Seen"
            : "Unseen"
    );

}


/* =========================================================
   REALTIME
   ========================================================= */

async function initAdminFloatingSupportRealtime() {

    if (!s) {
        console.error(
            "❌ ADMIN REALTIME: Supabase client missing."
        );
        return;
    }
    
    /* -----------------------------------------------------
   2B. ADMIN AUTH READINESS TEST
   ----------------------------------------------------- */

try {

    await s.auth.getUser();

} catch (error) {

    console.warn(
        "⚠️ ADMIN AUTH READINESS CHECK FAILED:",
        error
    );

}

    /* -----------------------------------------------------
       3. REMOVE OLD REALTIME CHANNEL
       ----------------------------------------------------- */

    if (window.__adminSupportRealtimeChannel) {

        console.log(
            "🧹 ADMIN REALTIME: removing previous channel..."
        );

        try {

            await s.removeChannel(
                window.__adminSupportRealtimeChannel
            );

            console.log(
                "✅ ADMIN REALTIME: previous channel removed."
            );

        } catch (error) {

            console.warn(
                "⚠️ ADMIN REALTIME: old channel cleanup failed:",
                error
            );

        }

        window.__adminSupportRealtimeChannel = null;
    }


    /* -----------------------------------------------------
       4. CREATE NEW REALTIME CHANNEL
       ----------------------------------------------------- */

    const channelName =
        "admin-floating-support-live";

    console.log(
        "📡 ADMIN REALTIME: creating channel:",
        channelName
    );

    const channel = s
        .channel(channelName)

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "support_messages"
            },
            payload => {

                /* -----------------------------------------
                   SEND EVENT TO FLOATING CHAT
                   ----------------------------------------- */

                if (
                    typeof addAdminFloatingRealtimeMessage ===
                    "function"
                ) {

                    addAdminFloatingRealtimeMessage(
                        payload?.new
                    );

                } else {

                    console.warn(
                        "⚠️ ADMIN REALTIME: addAdminFloatingRealtimeMessage() not found."
                    );

                }

            }
        )

        .subscribe(
            status => {

                console.log(
                    "📡 ADMIN SUPPORT REALTIME STATUS:",
                    status
                );

                if (status === "SUBSCRIBED") {

                    console.log(
                        "✅ ADMIN REALTIME: channel SUBSCRIBED successfully."
                    );

                    console.log(
                        "👂 ADMIN REALTIME: listening for INSERT on public.support_messages"
                    );

                }

                if (status === "CHANNEL_ERROR") {

                    console.error(
                        "❌ ADMIN REALTIME: CHANNEL_ERROR"
                    );

                }

                if (status === "TIMED_OUT") {

                    console.error(
                        "⏱️ ADMIN REALTIME: TIMED_OUT"
                    );

                }

                if (status === "CLOSED") {

                    console.warn(
                        "🔴 ADMIN REALTIME: channel CLOSED"
                    );

                }

            }
        );


    /* -----------------------------------------------------
       5. STORE CHANNEL GLOBALLY FOR THIS PAGE
       ----------------------------------------------------- */

    window.__adminSupportRealtimeChannel =
        channel;

    console.log(
        "✅ ADMIN REALTIME: initialization complete."
    );
}

/* =========================================================
   ADMIN DIRECT SUPPORT REALTIME
   INSERT + UPDATE
   ========================================================= */

async function initAdminDirectSupportRealtime() {

    if (!s) {

        console.error(
            "❌ ADMIN DIRECT REALTIME: Supabase client missing."
        );

        return;
    }


    /*
     * Remove previous direct channel
     */

    if (
        adminFloatingSupportState.directRealtimeChannel
    ) {

        try {

            await s.removeChannel(
                adminFloatingSupportState.directRealtimeChannel
            );

        } catch (error) {

            console.warn(
                "⚠️ ADMIN DIRECT REALTIME: old channel cleanup failed:",
                error
            );

        }

        adminFloatingSupportState.directRealtimeChannel =
            null;
    }


    const channelName =
        "admin-direct-support-live";


    const channel =
        s
            .channel(channelName)


            /* ---------------------------------------------
               NEW DIRECT MESSAGE
               --------------------------------------------- */

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "technician_direct_messages"
                },
                payload => {

                    addAdminDirectRealtimeMessage(
                        payload?.new
                    );

                }
            )


            /* ---------------------------------------------
               READ / SEEN UPDATE
               --------------------------------------------- */

            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "technician_direct_messages"
                },
                payload => {

                    updateAdminDirectRealtimeMessage(
                        payload?.new
                    );

                }
            )


            .subscribe(
                status => {

                    console.log(
                        "📡 ADMIN DIRECT REALTIME STATUS:",
                        status
                    );

                }
            );


    adminFloatingSupportState.directRealtimeChannel =
        channel;

}

/* =========================================================
   REALTIME CLEANUP
   ========================================================= */

function destroyAdminFloatingSupportRealtime() {

    if (
        !adminFloatingSupportState.realtimeChannel
    ) {
        return;
    }


    s
        ?.removeChannel(
            adminFloatingSupportState.realtimeChannel
        );


    adminFloatingSupportState.realtimeChannel =
        null;

}

/* =========================================================
   DIRECT REALTIME CLEANUP
   ========================================================= */

async function destroyAdminDirectSupportRealtime() {

    if (
        !adminFloatingSupportState.directRealtimeChannel
    ) {

        return;
    }


    try {

        await s?.removeChannel(
            adminFloatingSupportState.directRealtimeChannel
        );

    } catch (error) {

        console.warn(
            "⚠️ ADMIN DIRECT REALTIME cleanup failed:",
            error
        );

    }


    adminFloatingSupportState.directRealtimeChannel =
        null;

}

/* =========================================================
   COMPOSER
   ========================================================= */

function bindAdminFloatingSupportComposer() {

    const form =
        document.getElementById(
            "adminFloatingSupportMessageForm"
        );


    const input =
        document.getElementById(
            "adminFloatingSupportMessageInput"
        );


    const button =
        document.getElementById(
            "adminFloatingSupportSend"
        );


    const requestId =
        adminFloatingSupportState.currentRequestId;


    if (
        !form ||
        !input ||
        !button ||
        !requestId
    ) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const message =
                String(
                    input.value || ""
                ).trim();


            if (!message) {
                input.focus();
                return;
            }


            try {

                button.disabled =
                    true;

                button.textContent =
                    "Sending…";


                const response =
                    await api(
                        "support_message_send",
                        {
                            support_request_id:
                                requestId,

                            message
                        }
                    );


                input.value = "";


                const sentMessage =
                    response?.message ||
                    response?.data ||
                    null;


                /*
                 * Add immediately.
                 *
                 * Realtime may deliver the same
                 * message moments later.
                 * addAdminFloatingRealtimeMessage()
                 * prevents duplicates by message ID.
                 */

                if (sentMessage?.id) {

                    addAdminFloatingRealtimeMessage(
                        sentMessage
                    );

                }


                input.focus();


            } catch (error) {

                console.error(
                    "Admin floating support message failed:",
                    error
                );


                flash(
                    error?.message ||
                    "Message could not be sent.",
                    false
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Send";

            }

        }
    );

}


/* =========================================================
   SCROLL CHAT
   ========================================================= */

function scrollAdminFloatingSupportMessages() {

    requestAnimationFrame(
        () => {

            const container =
                document.getElementById(
                    "adminFloatingSupportMessages"
                );


            if (container) {

                container.scrollTop =
                    container.scrollHeight;

            }

        }
    );

}


/* =========================================================
   UNREAD BADGE
   REQUEST + DIRECT
   ========================================================= */

function updateAdminFloatingSupportBadge() {

    const badge =
        document.getElementById(
            "adminFloatingSupportBadge"
        );


    if (!badge) {
        return;
    }


    let total = 0;


    /*
     * Existing Request Chat unread
     */

    adminFloatingSupportState.unread
        .forEach(
            value => {

                total +=
                    Number(value) || 0;

            }
        );


    /*
     * Direct Technician Chat unread
     */

    adminFloatingSupportState.directUnread
        .forEach(
            value => {

                total +=
                    Number(value) || 0;

            }
        );


    if (total <= 0) {

        badge.hidden = true;

        badge.textContent =
            "0";

    } else {

        badge.hidden = false;

        badge.textContent =
            total > 99
                ? "99+"
                : String(total);

    }

}


/* =========================================================
   REMOVE CONVERSATION FROM OLD DETAIL PAGE
   ========================================================= */

renderAdminSupportDetails =
function (
    request,
    messages
) {

    const technician =
        request.technicians || {};


    const appointment =
        request.appointments || {};


    pageTitle.textContent =
        request.support_token ||
        "Support Request";


    q.innerHTML = `

        <div
            class="admin-support-detail-header"
        >

            <div>

                <button
                    type="button"
                    class="btn btn-link p-0 mb-2"
                    id="adminSupportBack"
                >
                    ← Back to Support Requests
                </button>


                <h2 class="admin-support-title">
                    ${e(
                        request.support_token
                    )}
                </h2>


                <p
                    class="admin-support-subtitle mb-0"
                >
                    Support request created
                    ${e(
                        adminSupportFormatDate(
                            request.created_at
                        )
                    )}
                </p>

            </div>


            <span
                class="
                    support-status-badge
                    large
                    ${adminSupportStatusClass(
                        request.status
                    )}
                "
            >
                ${e(
                    adminSupportStatusLabel(
                        request.status
                    )
                )}
            </span>

        </div>


        <div
            class="detail-grid admin-support-detail-grid"
        >

            <section>

                <h2 class="h6">
                    Technician
                </h2>


                <div
                    class="admin-support-info"
                >

                    <strong>
                        ${e(
                            technician.full_name ||
                            "—"
                        )}
                    </strong>

                    <span>
                        Code:
                        ${e(
                            technician.technician_code ||
                            "—"
                        )}
                    </span>

                    <span>
                        Mobile:
                        ${e(
                            technician.mobile ||
                            "—"
                        )}
                    </span>

                    <span>
                        Username:
                        ${e(
                            technician.username ||
                            "—"
                        )}
                    </span>

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Appointment
                </h2>


                <div
                    class="admin-support-info"
                >

                    <strong>
                        ${e(
                            appointment.appointment_id ||
                            "—"
                        )}
                    </strong>

                    <span>
                        Customer:
                        ${e(
                            appointment.customer_name ||
                            "—"
                        )}
                    </span>

                    <span>
                        Mobile:
                        ${e(
                            appointment.mobile ||
                            "—"
                        )}
                    </span>

                    <span>
                        Service:
                        ${e(
                            serviceCategoryLabel(
                                appointment.service_category
                            )
                        )}
                    </span>

                    <span>
                        ${e(
                            serviceTypeLabel(
                                appointment.service_type
                            )
                        )}
                    </span>

                    <span>
                        Appointment:
                        ${e(
                            adminSupportFormatAppointmentDate(
                                appointment.appointment_date,
                                appointment.appointment_time
                            )
                        )}
                    </span>

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Support Information
                </h2>


                <div
                    class="admin-support-info"
                >

                    <span>
                        Type:
                        <strong>
                            ${e(
                                adminSupportTypeLabel(
                                    request.support_type
                                )
                            )}
                        </strong>
                    </span>


                    <span>
                        Status:
                        ${e(
                            adminSupportStatusLabel(
                                request.status
                            )
                        )}
                    </span>


                    <span>
                        Created:
                        ${e(
                            adminSupportFormatDate(
                                request.created_at
                            )
                        )}
                    </span>


                    ${
                        request.location_url
                            ? `
                                <a
                                    href="${e(
                                        request.location_url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-sm btn-outline-primary mt-2"
                                >
                                    Open Technician Location
                                </a>
                            `
                            : ""
                    }

                </div>

            </section>


            <section>

                <h2 class="h6">
                    Problem Details
                </h2>


                <div
                    class="admin-support-problem"
                >
                    ${e(
                        request.problem_details ||
                        "No problem details provided."
                    )}
                </div>

            </section>

        </div>


        <div
            class="admin-card mt-3"
        >

            <div
                class="d-flex justify-content-between align-items-center mb-3"
            >

                <div>

                    <h2 class="h6 mb-1">
                        Support Status
                    </h2>

                    <small class="text-muted">
                        Update the request status from
                        the available workflow.
                    </small>

                </div>


                <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    id="openAdminFloatingChatFromDetail"
                >
                    💬 Open Live Chat
                </button>

            </div>


            ${renderAdminSupportStatusControls(
                request
            )}

        </div>

    `;


    document
        .getElementById(
            "adminSupportBack"
        )
        ?.addEventListener(
            "click",
            () => supportCenterView()
        );


    document
        .getElementById(
            "openAdminFloatingChatFromDetail"
        )
        ?.addEventListener(
            "click",
            async () => {

                ensureAdminFloatingSupportWidget();

                adminFloatingSupportState.open =
                    true;

                const panel =
                    document.getElementById(
                        "adminFloatingSupportPanel"
                    );

                if (panel) {
                    panel.hidden = false;
                }

                await openAdminFloatingSupportChat(
                    request.id
                );

            }
        );


    bindAdminSupportStatusControls(
        request
    );

};


/* =========================================================
   SUPPORT CENTER SEARCH FIX
   ========================================================= */

loadAdminSupportRequests =
async function () {

    adminSupportState.loading =
        true;


    try {

        const response =
            await api(
                "support_requests",
                {

                    filters: {

                        status:
                            adminSupportState.status ||
                            undefined,

                        support_type:
                            adminSupportState.supportType ||
                            undefined,

                        support_token:
                            adminSupportState.search ||
                            undefined

                    },

                    offset: 0,

                    limit: 50

                }
            );


        let requests =
            Array.isArray(
                response?.requests
            )
                ? response.requests
                : [];


        /*
         * Local search:
         * appointment / technician / customer
         */

        const search =
            String(
                adminSupportState.search ||
                ""
            )
                .trim()
                .toLowerCase();


        if (search) {

            requests =
                requests.filter(
                    request => {

                        const technician =
                            request.technicians || {};

                        const appointment =
                            request.appointments || {};


                        const haystack =
                            [

                                request.support_token,

                                technician.full_name,

                                technician.technician_code,

                                technician.mobile,

                                appointment.appointment_id,

                                appointment.appointment_code,

                                appointment.customer_name,

                                appointment.mobile,

                                request.problem_details

                            ]
                                .filter(Boolean)
                                .join(" ")
                                .toLowerCase();


                        return haystack.includes(
                            search
                        );

                    }
                );

        }


        adminSupportState.loading =
            false;


        renderAdminSupportCenter(
            requests,
            response?.count ||
            requests.length
        );


    } catch (error) {

        adminSupportState.loading =
            false;

        throw error;

    }

};


/* =========================================================
   START ADMIN SUPPORT REALTIME
   ========================================================= */

ensureAdminFloatingSupportWidget();


/*
 * Existing Request Chat Realtime
 * DO NOT REMOVE
 */

initAdminFloatingSupportRealtime();


/*
 * Direct Technician Chat Realtime
 */

initAdminDirectSupportRealtime();


/*
 * Initial unread badge
 */

updateAdminFloatingSupportBadge();