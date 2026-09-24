import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const c=window.CFX_CONFIG||{}, sb=c.supabaseUrl&&createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}), jobs=document.getElementById("jobs"), detail=document.getElementById("detail");let refreshInFlight;
const esc=value=>{const e=document.createElement("div");e.textContent=value??"—";return e.innerHTML};
async function getValidAccessToken(){const{data:{session}}=await sb.auth.getSession();if(!session)throw Error("Sign in is required.");if(!session.expires_at||session.expires_at*1000-Date.now()>60000)return session.access_token;refreshInFlight??=sb.auth.refreshSession().finally(()=>{refreshInFlight=null});const{data,error}=await refreshInFlight;if(error||!data.session)throw Error("Your session has expired. Please sign in again.");return data.session.access_token}
async function api(action,body={}){const token=await getValidAccessToken();const r=await fetch(`${c.supabaseUrl.replace(/\/$/,"")}/functions/v1/technician-api`,{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:`Bearer ${token}`},body:JSON.stringify({action,...body})}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Request failed.");return data}
async function load() {

    try {

        const d = await api("dashboard");

        const technicianName =
            d.technician?.name ||
            d.technician?.full_name ||
            "TECHNICIAN";


        const userNameElement =
            document.getElementById("techUserName");

        if (userNameElement) {

            userNameElement.textContent =
                String(technicianName).toUpperCase();

        }


        jobs.innerHTML = `

            <div class="tech-dashboard-grid">

                ${section(
                    "Today's Jobs",
                    d.today || [],
                    "today"
                )}

                ${section(
                    "Upcoming Jobs",
                    d.upcoming || [],
                    "upcoming"
                )}

            </div>


            ${section(
                "Completed Jobs",
                d.completed || [],
                "completed"
            )}

        `;


        document
            .querySelectorAll(".tech-job-button")
            .forEach(x => {

                x.onclick = () =>
                    loadDetail(x.dataset.id);

            });


    } catch (e) {

        loginError.textContent =
            e.message;

    }
}

function section(title, items, type = "") {

    const isToday = type === "today";
    const isUpcoming = type === "upcoming";
    const isCompleted = type === "completed";

    if (isToday || isUpcoming) {

        const icon = isToday
            ? "fa-regular fa-calendar-days"
            : "fa-solid fa-clock";

        const iconClass = isToday
            ? ""
            : "indigo";

        return `
            <section class="tech-panel">

                <h2 class="tech-panel-title">
                    ${esc(title)}
                </h2>

                ${
                    items.length
                        ? `
                            <div class="tech-job-list">
                                ${items.map(jobCard).join("")}
                            </div>
                          `
                        : `
                            <div class="tech-empty">

                                <div class="tech-empty-icon ${iconClass}">
                                    <i class="${icon}"></i>
                                </div>

                                <p class="tech-empty-text">
                                    No jobs scheduled for this time
                                </p>

                            </div>
                          `
                }

            </section>
        `;
    }


    if (isCompleted) {

        return `
            <section class="tech-completed-section">

                <h2 class="tech-completed-title">
                    Completed Jobs
                </h2>

                ${
                    items.length
                        ? items.map(completedJobCard).join("")
                        : `
                            <div class="tech-empty">

                                <div class="tech-empty-icon">
                                    <i class="fa-solid fa-circle-check"></i>
                                </div>

                                <p class="tech-empty-text">
                                    No completed jobs yet
                                </p>

                            </div>
                          `
                }

            </section>
        `;
    }


    return "";
}

function jobCard(a) {

    return `
        <button
            type="button"
            class="tech-job-card tech-job-button"
            data-id="${esc(a.id)}"
        >

            <div class="tech-job-header">

                <span class="tech-job-id">
                    ${esc(a.appointment_id)}
                </span>

                <span class="tech-job-date">

                    <i class="fa-regular fa-calendar"></i>

                    ${esc(a.appointment_date)}
                    ${esc(a.appointment_time)}

                </span>

            </div>


            <div class="tech-job-body">

                <div class="tech-job-info">

                    <p class="tech-job-line">
                        Client:
                        <span>
                            ${esc(a.customer_name)}
                        </span>
                    </p>

                    <p class="tech-job-line">
                        Phone:

                        <span>

                            <i class="fa-solid fa-phone"></i>

                            ${esc(a.mobile)}

                        </span>
                    </p>

                </div>


                <hr class="tech-job-divider">


                <div>

                    <p class="tech-service-label">
                        Service Details
                    </p>

                    <p class="tech-service-value">

                        ${esc(a.service_category)}

                        <span class="tech-service-separator">
                            /
                        </span>

                        ${esc(a.service_type)}

                    </p>

                </div>


                <div class="tech-job-footer">

                    <span class="tech-status">

                        <i class="fa-solid fa-circle-check"></i>

                        ${esc(
                            String(a.status || "")
                                .replaceAll("_", " ")
                                .toUpperCase()
                        )}

                    </span>


                    <span class="tech-feedback">

                        <i class="fa-regular fa-comment-dots"></i>

                        Feedback/Notes

                    </span>

                </div>

            </div>

        </button>
    `;
}


function completedJobCard(a) {

    return `
        <article class="tech-job-card">

            <div class="tech-job-header">

                <span class="tech-job-id">
                    ${esc(a.appointment_id)}
                </span>

                <span class="tech-job-date">

                    <i class="fa-regular fa-calendar"></i>

                    ${esc(a.appointment_date)}
                    ${esc(a.appointment_time)}

                </span>

            </div>


            ${
                a.customer_name
                    ? `
                        <div class="tech-job-body">

                            <div class="tech-job-info">

                                <p class="tech-job-line">
                                    Client:
                                    <span>
                                        ${esc(a.customer_name)}
                                    </span>
                                </p>

                                <p class="tech-job-line">

                                    Phone:

                                    <span>

                                        <i class="fa-solid fa-phone"></i>

                                        ${esc(a.mobile)}

                                    </span>

                                </p>

                            </div>


                            <hr class="tech-job-divider">


                            <div>

                                <p class="tech-service-label">
                                    Service Details
                                </p>

                                <p class="tech-service-value">

                                    ${esc(a.service_category)}

                                    <span class="tech-service-separator">
                                        /
                                    </span>

                                    ${esc(a.service_type)}

                                </p>

                            </div>


                            <div class="tech-job-footer">

                                <span class="tech-status">

                                    <i class="fa-solid fa-circle-check"></i>

                                    COMPLETED

                                </span>


                                <button
                                    type="button"
                                    class="tech-feedback"
                                    data-feedback-id="${esc(a.id)}"
                                >

                                    <i class="fa-regular fa-comment-dots"></i>

                                    Feedback/Notes

                                </button>

                            </div>

                        </div>
                      `
                    : `
                        <div class="tech-job-body">

                            <div class="tech-empty-feedback">

                                <p class="tech-empty-feedback-text">
                                    Feedback/Notes
                                </p>

                                <button
                                    type="button"
                                    class="tech-feedback"
                                    data-feedback-id="${esc(a.id)}"
                                >

                                    <i class="fa-regular fa-comment-dots"></i>

                                    Feedback/Notes

                                </button>

                            </div>

                        </div>
                      `
            }

        </article>
    `;
}

async function loadDetail(id){try{const {appointment:a}=await api("appointment",{id});const map=a.google_maps_url?`<a class="btn btn-outline-primary" target="_blank" rel="noopener" href="${esc(a.google_maps_url)}">Open in Google Maps</a>`:"";detail.innerHTML=`<div class="booking-card"><h2 class="h4">${esc(a.appointment_id)}</h2><p><strong>${esc(a.customer_name)}</strong> · ${esc(a.mobile)}<br>${esc(a.service_category)} ${esc(a.service_type)}<br>${esc(a.appointment_date)} ${esc(a.appointment_time)}<br>${esc(a.service_address)}<br>${esc(a.problem_description)}</p>${map}<hr><p>Current status: <strong>${esc(a.status)}</strong></p><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary action" data-status="on_the_way">Mark On The Way</button><button class="btn btn-outline-primary action" data-status="in_progress">Mark In Progress</button></div><div class="input-group mt-3"><input id="jobCode" class="form-control" value="${esc(a.job_code||"")}" placeholder="CFX-JOB-2026-00452"><button id="saveJob" class="btn btn-outline-primary">Save Job ID</button></div>${["in_progress","job_id_created"].includes(a.status)?`<button id="complete" class="btn btn-success mt-3">${a.status==="job_id_created"?"Complete Job":"Complete Service"}</button><div id="otpArea" class="mt-3"></div>`:""}<p id="techMessage" class="small mt-2"></p></div>`;document.querySelectorAll(".action").forEach(b=>b.onclick=()=>status(id,b.dataset.status));saveJob.onclick=()=>status(id,"job_id_created",jobCode.value);complete?.addEventListener("click",()=>startOtp(id))}catch(e){detail.innerHTML=`<p class="text-danger">${esc(e.message)}</p>`}}
async function status(id,status,job_code){try{await api("set_status",{id,status,job_code});await loadDetail(id);await load()}catch(e){techMessage.textContent=e.message}}
async function startOtp(id){try{await api("start_completion",{id});otpArea.innerHTML=`<div class="alert alert-info">Customer Verification Required. A verification OTP has been sent to the customer's registered email.</div><div class="input-group"><input id="otp" class="form-control" inputmode="numeric" maxlength="6" placeholder="Enter OTP"><button id="verify" class="btn btn-success">Verify & Complete</button></div><button id="resend" class="btn btn-link btn-sm">Resend OTP</button>`;verify.onclick=()=>verifyOtp(id);resend.onclick=()=>startOtp(id)}catch(e){techMessage.textContent=e.message}}
async function verifyOtp(id){try{await api("verify_completion",{id,otp:otp.value});detail.innerHTML=`<div class="alert alert-success">Appointment completed successfully.</div>`;load()}catch(e){techMessage.textContent=e.message}}
signIn.onclick=async()=>{if(!sb)return loginError.textContent="Technician portal is not configured.";const loginEmail=email.value.trim(),loginPassword=password.value;if(!loginEmail||!loginPassword)return loginError.textContent="Enter your technician email and password.";try{const{error}=await sb.auth.signInWithPassword({email:loginEmail,password:loginPassword});if(error)throw error;load()}catch(e){loginError.textContent=e.message}}

signOut.onclick = async () => {

    try {

        await sb.auth.signOut();

    } finally {

        window.location.replace(
            "./tech%20login.html"
        );

    }

};
    
    if (sb) {

    sb.auth.getSession()
        .then(({ data: { session } }) => {

            if (!session) {

                window.location.replace(
                    "./tech%20login.html"
                );

                return;
            }

            load();

        })
        .catch(() => {

            window.location.replace(
                "./tech%20login.html"
            );

        });

}

const techMenuBtn =
    document.getElementById("techMenuBtn");

const techSidebar =
    document.getElementById("techSidebar");

const techSidebarOverlay =
    document.getElementById("techSidebarOverlay");


function closeTechnicianMenu() {

    techSidebar?.classList.remove("open");

    techSidebarOverlay?.classList.remove("open");
}


function toggleTechnicianMenu() {

    techSidebar?.classList.toggle("open");

    techSidebarOverlay?.classList.toggle("open");
}


techMenuBtn?.addEventListener(
    "click",
    toggleTechnicianMenu
);


techSidebarOverlay?.addEventListener(
    "click",
    closeTechnicianMenu
);


document
    .querySelectorAll(".tech-nav-item")
    .forEach(item => {

        item.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".tech-nav-item")
                    .forEach(nav =>
                        nav.classList.remove("active")
                    );

                item.classList.add("active");

                closeTechnicianMenu();

            }
        );

    });