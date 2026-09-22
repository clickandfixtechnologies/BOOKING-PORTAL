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

let filter={},refreshInFlight;async function getValidAccessToken(){let{data:{session}}=await s.auth.getSession();if(!session)throw Error("Sign in is required.");if(!session.expires_at||session.expires_at*1000-Date.now()>60000)return session.access_token;refreshInFlight??=s.auth.refreshSession().finally(()=>{refreshInFlight=null});let{data,error}=await refreshInFlight;if(error||!data.session)throw Error("Your session has expired. Please sign in again.");return data.session.access_token}async function api(action,more={}){let token=await getValidAccessToken(),r=await fetch(c.supabaseUrl.replace(/\/$/,"")+"/functions/v1/admin-api",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify({action,...more})}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed.");return d}function flash(x,ok=true){flashBox.innerHTML=`<div class="alert alert-${ok?"success":"danger"} py-2">${e(x)}</div>`;setTimeout(()=>flashBox.textContent="",3500)}async function dashboard(){pageTitle.textContent="Dashboard";q.innerHTML="Loading…";let[d,a]=await Promise.all([api("dashboard"),api("appointments",{filters:filter})]);q.innerHTML=`<div class="kpis">${[["Today's Appointments",d.today],["Pending",d.counts.pending],["Confirmed",d.counts.confirmed],["In Progress",d.counts.in_progress],["Completed",d.counts.completed]].map(x=>`<div class="kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("")}</div><div class="admin-card mt-3"><div class="status-tabs"><button data-status="" class="${!filter.status?"active":""}">All (${Object.values(d.counts).reduce((x,y)=>x+y,0)})</button>${S.map(x=>`<button data-status="${x}" class="${filter.status===x?"active":""}">${L(x)} (${d.counts[x]})</button>`).join("")}</div>${filters()}${table(a.appointments)}</div>`;bind()}
function filters(){return`<div class="row g-2 mb-3"><div class="col-md-4"><input id="search" class="form-control" placeholder="ID, code, customer or mobile" value="${e(filter.search||"")}"></div><div class="col-md-3"><input id="dateFilter" type="date" class="form-control" value="${e(filter.date||"")}"></div><div class="col-md-3"><select id="statusFilter" class="form-select"><option value="">All statuses</option>${S.map(x=>`<option value="${x}" ${filter.status===x?"selected":""}>${L(x)}</option>`).join("")}</select></div><div class="col-md-2"><button id="clear" class="btn btn-outline-secondary w-100">Clear filters</button></div></div>`}function table(a){return`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Date / Time</th><th>Technician</th><th>Job</th><th>Status</th><th>Actions</th></tr></thead><tbody>${a.map(x=>`<tr><td>${e(x.appointment_id)}</td><td>${e(x.customer_name)}<br><small>${e(x.mobile)} · ${e(x.email)}</small></td><td>${e(serviceCategoryLabel(x.service_category))}<br><small>${e(serviceTypeLabel(x.service_type))}</small></td><td>${e(x.appointment_date)}<br>${e(x.appointment_time)}</td><td>${e(x.technicians?.full_name)}</td><td>${e(x.job_code)}</td><td><span class="badge text-bg-secondary status-badge">${L(x.status)}</span></td><td class="actions"><button class="btn btn-sm btn-outline-primary" data-view-id="${x.id}">View</button>${x.status==="pending"?`<button class="btn btn-sm btn-primary" data-set="confirmed" data-id="${x.id}">Confirm</button>`:""}${!["completed","cancelled","no_show"].includes(x.status)?`<button class="btn btn-sm btn-outline-success" data-set="completed" data-id="${x.id}">Complete</button>`:""}</td></tr>`).join("")||'<tr><td colspan="8" class="text-center text-muted">No appointments match these filters.</td></tr>'}</tbody></table></div>`}
function bind(){document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{filter.status=b.dataset.status;dashboard()});search.onchange=()=>{filter.search=search.value;dashboard()};dateFilter.onchange=()=>{filter.date=dateFilter.value;dashboard()};statusFilter.onchange=()=>{filter.status=statusFilter.value;dashboard()};clear.onclick=()=>{filter={};dashboard()};document.querySelectorAll("[data-view-id]").forEach(b=>b.onclick=()=>detail(b.dataset.viewId));document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>set(b.dataset.id,b.dataset.set))}async function set(id,status,extra={}){try{await api("update_appointment",{id,status,...extra});flash(`Appointment ${L(status)} successfully.`);dashboard()}catch(x){flash(x.message,false)}}
signIn.onclick=async()=>{try{let{error:x}=await s.auth.signInWithPassword({email:email.value,password:password.value});if(x)throw x;login.hidden=true;panel.hidden=false;dashboard()}catch(x){error.textContent=x.message}};signOut.onclick=()=>s.auth.signOut().then(()=>location.reload());document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));b.classList.add("active");({dashboard,appointments:dashboard,calendar:calendarView,availability:availabilityView,technicians:techniciansView,notifications:notificationsView}[b.dataset.view]||dashboard)()});menuToggle.onclick=()=>document.querySelector(".admin-sidebar").classList.toggle("open");s?.auth.getSession().then(({data:{session}})=>{if(session){login.hidden=true;panel.hidden=false;dashboard()}});
async function calendarView(){pageTitle.textContent="Calendar";let a=(await api("appointments",{filters:{}})).appointments;q.innerHTML=`<div class="admin-card"><h2 class="h6">Appointments by date</h2>${a.map(x=>`<button class="btn btn-light w-100 text-start mb-1" data-view-id="${x.id}">${e(x.appointment_date)} ${e(x.appointment_time)} · ${e(x.customer_name)} · ${L(x.status)}</button>`).join("")||"No appointments."}</div>`;document.querySelectorAll("[data-view-id]").forEach(b=>b.onclick=()=>detail(b.dataset.viewId))}
async function availabilityView(){pageTitle.textContent="Availability";let x=await api("availability");let z=x.settings;q.innerHTML=`<div class="admin-card"><h2 class="h6">Business settings</h2><div class="row g-2"><div class="col-12"><label>Business days (1=Mon … 7=Sun)</label><input id="days" class="form-control" value="${z.business_days.join(",")}"></div>${[["open","Opening time",z.opening_time],["close","Closing time",z.closing_time],["duration","Slot minutes",z.slot_duration_minutes],["buffer","Buffer minutes",z.buffer_minutes],["capacity","Maximum appointments",z.max_appointments_per_slot],["advance","Minimum advance minutes",z.minimum_advance_minutes],["future","Maximum future days",z.maximum_future_days]].map(v=>`<div class="col-md-4"><label>${v[1]}</label><input id="${v[0]}" class="form-control" value="${v[2]}"></div>`).join("")}</div><button id="saveAvailability" class="btn btn-primary mt-3">Save settings</button></div><div class="admin-card mt-3"><h2 class="h6">Holiday / blocked date or slot</h2><input id="blockDate" type="date" class="form-control mb-2"><input id="blockStart" type="time" class="form-control mb-2"><input id="blockEnd" type="time" class="form-control mb-2"><input id="blockReason" class="form-control mb-2" placeholder="Reason"><button id="addBlock" class="btn btn-outline-primary">Save block</button><ul class="mt-3">${x.blocks.map(b=>`<li>${e(b.block_date)} ${e(b.starts_at||"All day")} ${e(b.reason)} <button class="btn btn-sm btn-link" data-delete-block="${b.id}">Delete</button></li>`).join("")}</ul></div>`;saveAvailability.onclick=async()=>{await api("save_availability",{settings:{business_days:days.value.split(",").map(Number),opening_time:open.value,closing_time:close.value,slot_duration_minutes:duration.value,buffer_minutes:buffer.value,max_appointments_per_slot:capacity.value,minimum_advance_minutes:advance.value,maximum_future_days:future.value}});flash("Availability saved");availabilityView()};addBlock.onclick=async()=>{await api("save_block",{block:{block_date:blockDate.value,starts_at:blockStart.value||null,ends_at:blockEnd.value||null,reason:blockReason.value}});availabilityView()};document.querySelectorAll("[data-delete-block]").forEach(b=>b.onclick=async()=>{await api("delete_block",{id:b.dataset.deleteBlock});availabilityView()})}
async function notificationsView(){pageTitle.textContent="Notifications";let[n,l]=await Promise.all([api("notifications"),api("notification_logs")]);n=n.notifications;q.innerHTML=`<div class="admin-card"><h2 class="h6">Appointment notifications</h2><p>Permission: <b>${Notification.permission==="granted"?"Enabled":"Not Enabled"}</b></p><button id="enablePush" class="btn btn-primary">Enable Appointment Notifications</button></div><div class="admin-card mt-3"><h2 class="h6">Admin inbox</h2>${n.map(x=>`<div class="border rounded p-2 mb-2"><b>${e(x.title)}</b> · ${x.is_read?"Read":"Unread"}<br><small>${e(x.body)} · ${new Date(x.created_at).toLocaleString()}</small><div class="actions mt-1">${x.appointments?.appointment_id?`<button class="btn btn-sm btn-outline-primary" data-notification-appointment="${x.appointment_id}">View appointment</button>`:""}${!x.is_read?`<button class="btn btn-sm btn-outline-secondary" data-read="${x.id}">Mark as read</button>`:""}</div></div>`).join("")||"No notifications yet."}</div><div class="admin-card mt-3"><h2 class="h6">Delivery log</h2><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Type</th><th>Channel</th><th>Status</th><th>Appointment</th><th>Created</th><th>Sent</th><th>Error</th></tr></thead><tbody>${l.logs.map(x=>`<tr><td>${e(x.type)}</td><td>${e(x.channel)}</td><td>${e(x.status)}</td><td>${e(x.appointments?.appointment_id)}</td><td>${new Date(x.created_at).toLocaleString()}</td><td>${x.sent_at?new Date(x.sent_at).toLocaleString():"—"}</td><td>${e(x.error)}</td></tr>`).join("")||'<tr><td colspan="7" class="text-muted">No delivery attempts recorded.</td></tr>'}</tbody></table></div></div>`;document.getElementById("enablePush").onclick=enablePushNotifications;document.querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{await api("mark_notification_read",{id:b.dataset.read});notificationsView()});document.querySelectorAll("[data-notification-appointment]").forEach(b=>b.onclick=()=>detail(b.dataset.notificationAppointment))}
async function enablePush(){try{if(!("serviceWorker" in navigator)||!window.CFX_CONFIG.vapidPublicKey)throw Error("Push notifications are not configured for this deployment.");let p=await Notification.requestPermission();if(p!=="granted")throw Error("Notification permission was not granted.");let reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64(window.CFX_CONFIG.vapidPublicKey)}),token=await getValidAccessToken();let r=await fetch(c.supabaseUrl.replace(/\/$/,"")+"/functions/v1/register-push-subscription",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify({subscription:sub,device_name:navigator.platform,browser:navigator.userAgent})}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Subscription could not be saved.");flash("Appointment notifications enabled.");notificationsView()}catch(x){flash(x.message,false)}}function base64(v){let x=v.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(x+"=".repeat((4-x.length%4)%4)),a=>a.charCodeAt(0))}
function days(v){return(v||[1,2,3,4,5,6]).join(",")}function renderTechForm(t={}){return`<form id="techForm" class="row g-2"><div class="col-md-4"><input name="technician_code" class="form-control" required placeholder="CFX-TECH-2026-0001" value="${e(t.technician_code||"")}" ${t.id?"readonly":""}></div><div class="col-md-4"><input name="full_name" class="form-control" required placeholder="Name" value="${e(t.full_name||"")}"></div><div class="col-md-4"><input name="mobile" class="form-control" required inputmode="tel" placeholder="10-digit mobile" value="${e(t.mobile||"")}"></div><div class="col-md-4"><input name="username" class="form-control" required placeholder="Username" value="${e(t.username||"")}"></div><div class="col-md-4"><input name="email" class="form-control" type="email" placeholder="Login email" ${t.id?"disabled":""}></div><div class="col-md-4"><input name="password" class="form-control" type="password" ${t.id?"disabled":"required minlength=12"} placeholder="${t.id?"Password managed separately":"12+ character password"}"></div><div class="col-md-4"><input name="specialization" class="form-control" placeholder="Specializations, comma separated" value="${e((t.specialization||[]).join(","))}"></div><div class="col-md-4"><input name="working_days" class="form-control" required value="${days(t.working_days)}" placeholder="1,2,3,4,5,6"></div><div class="col-md-2"><input name="working_start" type="time" class="form-control" value="${e(t.working_start||"10:00")}"></div><div class="col-md-2"><input name="working_end" type="time" class="form-control" value="${e(t.working_end||"19:00")}"></div><div class="col-12"><button class="btn btn-primary">${t.id?"Save technician":"Create technician"}</button></div></form>`}async function techniciansView(){pageTitle.textContent="Technicians";let t=(await api("technicians")).technicians;q.innerHTML=`<div class="admin-card"><h2 class="h6">${window.editTech?"Edit technician":"Add technician"}</h2>${renderTechForm(window.editTech||{})}</div><div class="admin-card mt-3"><h2 class="h6">Technicians</h2>${t.map(x=>`<div class="border rounded p-2 mb-2"><b>${e(x.technician_code)}</b> ${e(x.full_name)} · ${e(x.mobile)} · ${x.is_active?"Active":"Inactive"}<div class="actions float-end"><button class="btn btn-sm btn-outline-primary" data-edit-tech="${x.id}">Edit</button><button class="btn btn-sm btn-outline-secondary" data-toggle-tech="${x.id}">${x.is_active?"Deactivate":"Activate"}</button></div></div>`).join("")||"No technicians yet."}</div>`;const techFormElement=document.getElementById("techForm");techFormElement.onsubmit=async ev=>{ev.preventDefault();let f=new FormData(techFormElement),x=Object.fromEntries(f);x.specialization=x.specialization.split(",").map(v=>v.trim()).filter(Boolean);x.working_days=x.working_days.split(",").map(Number);try{if(window.editTech){x.id=window.editTech.id;await api("update_technician",{technician:x})}else await api("create_technician",{technician:x});window.editTech=null;flash("Technician saved.");techniciansView()}catch(err){flash(err.message,false)}};document.querySelectorAll("[data-edit-tech]").forEach(b=>b.onclick=()=>{window.editTech=t.find(x=>x.id===b.dataset.editTech);techniciansView()});document.querySelectorAll("[data-toggle-tech]").forEach(b=>b.onclick=async()=>{let x=t.find(x=>x.id===b.dataset.toggleTech);try{await api("update_technician",{technician:{...x,is_active:!x.is_active}});flash("Technician updated.");techniciansView()}catch(err){flash(err.message,false)}})}async function detail(id){let[{appointment:a},{technicians}]=await Promise.all([api("appointment",{id}),api("technicians")]);let active=technicians.filter(x=>x.is_active);const hasGps=Number.isFinite(Number(a.latitude))&&Number.isFinite(Number(a.longitude));const mapsUrl=hasGps?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.latitude},${a.longitude}`)}`:"";const locationType=a.service_location_type==="home_office"?"Home / Office Visit":a.service_location_type||"—";pageTitle.textContent=a.appointment_id;q.innerHTML=`<button id="back" class="btn btn-link p-0 mb-3">← Back</button><div class="detail-grid"><section><h2 class="h6">Customer</h2><p>${e(a.customer_name)}<br>${e(a.mobile)}<br>${e(a.email)}</p></section><section><h2 class="h6">Service Location</h2><p><strong>Location Type:</strong> ${e(locationType)}<br><strong>Address:</strong> ${e(a.service_address||"—")}<br><strong>Landmark:</strong> ${e(a.landmark||"—")}</p>${hasGps?`<div class="mt-2"><strong>GPS Coordinates:</strong><div>${e(String(a.latitude))}, ${e(String(a.longitude))}</div></div>`:`<p class="text-muted mb-0">GPS location not available.</p>`}${hasGps?`<div class="mt-3"><a class="btn btn-sm btn-primary" href="${e(mapsUrl)}" target="_blank" rel="noopener noreferrer">Open Customer Location in Google Maps</a></div>`:""}</section>

<section><h2 class="h6">Service</h2><p>${e(serviceCategoryLabel(a.service_category))} - ${e(serviceTypeLabel(a.service_type))}<br>${e(a.problem_description)}</p></section><section><h2 class="h6">Additional Notes</h2><p class="mb-0">${e(a.additional_notes||"No additional notes provided.")}</p></section>

<section><h2 class="h6">Appointment</h2><p>${e(a.appointment_id)}<br>${e(a.appointment_date)} ${e(a.appointment_time)}<br><b>${L(a.status)}</b></p></section><section><h2 class="h6">Technician</h2><p>${e(a.technicians?.full_name)}</p><select id="techAssign" class="form-select mb-2"><option value="">Select active technician</option>${active.map(x=>`<option value="${x.id}" ${a.technician_id===x.id?"selected":""}>${e(x.full_name)} — ${e(x.technician_code)}</option>`).join("")}</select><button id="assignTech" class="btn btn-sm btn-primary" ${a.status==="confirmed"?"":"disabled"}>Assign technician</button></section>

<section><h2 class="h6">Job</h2><input id="job" class="form-control mb-2" value="${e(a.job_code||"")}" placeholder="CFX-JOB-2026-00452"><button id="jobSave" class="btn btn-sm btn-primary">Save Job ID</button></section></div>

<div class="admin-card mt-3"><div class="actions">${a.status==="pending"?'<button id="confirm" class="btn btn-primary">Confirm Appointment</button>':""}<button id="way" class="btn btn-outline-primary" ${a.status==="technician_assigned"?"":"disabled"}>On The Way</button><button id="progress" class="btn btn-outline-primary" ${a.status==="on_the_way"?"":"disabled"}>In Progress</button><button id="jobCreated" class="btn btn-outline-primary" ${a.status==="in_progress"?"":"disabled"}>Job ID Created</button><button id="complete" class="btn btn-success" ${a.status==="job_id_created"?"":"disabled"}>Mark Completed</button><button id="cancel" class="btn btn-outline-danger" ${["completed","cancelled","no_show"].includes(a.status)?"disabled":""}>Cancel</button></div></div>

<div class="admin-card mt-3"><h2 class="h6">Status History</h2><ol>${(a.appointment_status_history||[]).map(h=>`<li>${L(h.old_status||"Created")} → <b>${L(h.new_status)}</b><br><small>${new Date(h.changed_at).toLocaleString()} ${e(h.note||"")}</small></li>`).join("")}</ol></div>`;back.onclick=dashboard;assignTech.onclick=()=>set(id,"technician_assigned",{technician_id:techAssign.value});confirm&&(confirm.onclick=()=>set(id,"confirmed"));way.onclick=()=>set(id,"on_the_way");progress.onclick=()=>set(id,"in_progress");jobCreated.onclick=()=>set(id,"job_id_created",{job_code:job.value});complete.onclick=()=>set(id,"completed");cancel.onclick=()=>set(id,"cancelled");jobSave.onclick=()=>set(id,a.status,{job_code:job.value})}
renderTechForm=function(t={}){const needsAccount=Boolean(t.id&&!t.auth_user_id);return`<form id="techForm" class="row g-2"><div class="col-md-4"><input name="technician_code" class="form-control" required placeholder="CFX-TECH-2026-0001" value="${e(t.technician_code||"")}" ${t.id?"readonly":""}></div><div class="col-md-4"><input name="full_name" class="form-control" required placeholder="Name" value="${e(t.full_name||"")}"></div><div class="col-md-4"><input name="mobile" class="form-control" required inputmode="tel" placeholder="10-digit mobile" value="${e(t.mobile||"")}"></div><div class="col-md-4"><input name="username" class="form-control" required placeholder="Username" value="${e(t.username||"")}"></div><div class="col-md-4"><input name="email" class="form-control" type="email" placeholder="Login email" ${t.id&&!needsAccount?"disabled":"required"}></div><div class="col-md-4"><input name="password" class="form-control" type="password" ${t.id&&!needsAccount?"disabled":"required minlength=12"} placeholder="${needsAccount?"Create 12+ character password":t.id?"Password managed separately":"12+ character password"}"></div>${needsAccount?'<div class="col-12"><small class="text-warning">This older technician has no portal account. Saving creates and links one securely.</small></div>':""}<div class="col-md-4"><input name="specialization" class="form-control" placeholder="Specializations, comma separated" value="${e((t.specialization||[]).join(","))}"></div><div class="col-md-4"><input name="working_days" class="form-control" required value="${days(t.working_days)}" placeholder="1,2,3,4,5,6"></div><div class="col-md-2"><input name="working_start" type="time" class="form-control" value="${e(t.working_start||"10:00")}"></div><div class="col-md-2"><input name="working_end" type="time" class="form-control" value="${e(t.working_end||"19:00")}"></div><div class="col-12"><button class="btn btn-primary">${t.id?"Save technician":"Create technician"}</button></div></form>`};const sidebar=document.querySelector(".admin-sidebar"),sidebarOverlay=document.createElement("div"),menuClose=document.createElement("button"),closeSidebar=()=>{sidebar.classList.remove("open");sidebarOverlay.hidden=true;document.body.classList.remove("sidebar-open")},openSidebar=()=>{sidebar.classList.add("open");sidebarOverlay.hidden=false;document.body.classList.add("sidebar-open")};sidebarOverlay.id="sidebarOverlay";sidebarOverlay.className="sidebar-overlay";sidebarOverlay.hidden=true;document.querySelector(".admin-shell").prepend(sidebarOverlay);menuClose.type="button";menuClose.id="menuClose";menuClose.className="btn btn-sm btn-outline-light d-md-none";menuClose.setAttribute("aria-label","Close menu");menuClose.textContent="×";sidebar.prepend(menuClose);menuToggle.onclick=()=>sidebar.classList.contains("open")?closeSidebar():openSidebar();menuClose.onclick=closeSidebar;sidebarOverlay.onclick=closeSidebar;document.addEventListener("keydown",event=>{if(event.key==="Escape")closeSidebar()});document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{if(matchMedia("(max-width: 767px)").matches)closeSidebar()}));
const existingDetail=detail;table=function(rows){return`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Date / Time</th><th>Technician</th><th>Job</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${e(item.appointment_id)}</td><td>${e(item.customer_name)}<br><small>${e(item.mobile)} · ${e(item.email)}</small></td><td>${e(serviceCategoryLabel(item.service_category))}<br><small>${e(serviceTypeLabel(item.service_type))}</small></td><td>${e(item.appointment_date)}<br>${e(item.appointment_time)}</td><td>${e(item.technicians?.full_name)}</td><td>${e(item.job_code)}</td><td><span class="badge status-badge">${L(item.status)}</span></td><td class="actions"><button class="btn btn-sm btn-outline-primary" data-view-id="${item.id}">View</button>${item.status==="pending"?`<button class="btn btn-sm btn-primary" data-set="confirmed" data-id="${item.id}">Confirm</button>`:""}${!["completed","cancelled","no_show"].includes(item.status)?`<button class="btn btn-sm btn-outline-success" data-set="completed" data-id="${item.id}">Complete</button>`:""}<button class="btn btn-sm btn-outline-danger" data-delete-id="${item.id}">Delete</button></td></tr>`).join("")||'<tr><td colspan="8" class="text-center text-muted">No appointments match these filters.</td></tr>'}</tbody></table></div>`};bind=function(){search.onchange=()=>{filter.search=search.value;dashboard()};dateFilter.onchange=()=>{filter.date=dateFilter.value;dashboard()};statusFilter.onchange=()=>{filter.status=statusFilter.value;dashboard()};clear.onclick=()=>{filter={};dashboard()};document.querySelectorAll("[data-view-id]").forEach(button=>button.onclick=()=>detail(button.dataset.viewId));document.querySelectorAll("[data-set]").forEach(button=>button.onclick=()=>set(button.dataset.id,button.dataset.set));document.querySelectorAll("[data-delete-id]").forEach(button=>button.onclick=async()=>{if(!window.confirm("Delete this appointment permanently? This cannot be undone."))return;button.disabled=true;try{await api("delete_appointment",{id:button.dataset.deleteId});flash("Appointment deleted.");dashboard()}catch(error){button.disabled=false;flash(error.message,false)}})};dashboard=async function(){pageTitle.textContent="Dashboard";q.innerHTML="Loading…";let[summary,list]=await Promise.all([api("dashboard"),api("appointments",{filters:filter})]);q.innerHTML=`<div class="kpis">${[["Today's Appointments",summary.today],["Pending",summary.counts.pending],["Confirmed",summary.counts.confirmed],["In Progress",summary.counts.in_progress],["Completed",summary.counts.completed]].map(item=>`<div class="kpi"><small>${item[0]}</small><b>${item[1]}</b></div>`).join("")}</div><div class="admin-card mt-3">${filters()}${table(list.appointments)}</div>`;bind()};detail=async function(id){await existingDetail(id);const current=await api("appointment",{id});if(current.appointment.status==="completed"){const cancelButton=document.getElementById("cancel");if(cancelButton){cancelButton.disabled=true;cancelButton.title="Completed appointments cannot be cancelled"}}};
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
