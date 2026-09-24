import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const c = window.CFX_CONFIG || {};

const sb =
    c.supabaseUrl &&
    createClient(
        c.supabaseUrl,
        c.supabaseAnonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storage: window.localStorage,
                storageKey: "clickfix-technician-auth"
            }
        }
    );

const jobs = document.getElementById("jobs");
const detail = document.getElementById("detail");

const esc = value => {
    const e = document.createElement("div");
    e.textContent = value ?? "—";
    return e.innerHTML;
};


async function getValidAccessToken(){

    if(!sb){
        throw Error(
            "Technician portal is not configured."
        );
    }

    const {
        data,
        error
    } = await sb.auth.getSession();

    if(error){
        throw Error(error.message);
    }

    if(data?.session?.access_token){
        return data.session.access_token;
    }

    /*
     * Supabase may still be restoring the persisted
     * session immediately after a hard page refresh.
     * Give the client a moment to finish hydration.
     */
    await new Promise(resolve =>
        setTimeout(resolve, 300)
    );

    const {
        data:retryData,
        error:retryError
    } = await sb.auth.getSession();

    if(retryError){
        throw Error(retryError.message);
    }

    if(retryData?.session?.access_token){
        return retryData.session.access_token;
    }

    throw Error(
        "Sign in is required."
    );
}


async function api(action, body = {}){

    const token =
        await getValidAccessToken();

    const response =
        await fetch(
            `${c.supabaseUrl.replace(/\/$/, "")}/functions/v1/technician-api`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    apikey: c.supabaseAnonKey,
                    Authorization:
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    action,
                    ...body
                })
            }
        );

    const data =
        await response
            .json()
            .catch(() => ({}));

    if(!response.ok){

        throw Error(
            data?.error ||
            "Request failed."
        );
    }

    return data;
}

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
    .querySelectorAll(".tech-job-card")
    .forEach(card => {

        card.addEventListener("click", event => {

            /*
             * Completed job-এর ভিতরে যদি ভবিষ্যতে
             * আলাদা কোনো button/link থাকে, সেগুলোর click
             * যেন card click trigger না করে।
             */
            if (
                event.target.closest("a, button:not(.tech-job-card)")
            ) {
                return;
            }

            const id = card.dataset.id;

            if (!id) {
                return;
            }

            loadDetail(id);

        });

    });


    } catch (e) {

    console.error("Technician dashboard load failed:", e);

    if (detail) {
        detail.innerHTML = `
            <div class="tech-error-message">
                ${esc(e.message)}
            </div>
        `;
    }

}
}

function section(title,items){

    const titleIcon =
        title === "Today's Jobs"
            ? '<i class="fa-regular fa-calendar-days"></i>'
            : title === "Upcoming Jobs"
                ? '<i class="fa-solid fa-clock"></i>'
                : '';

    if(!items.length){

        return `
            <section class="tech-job-section ${title === "Completed Jobs" ? "tech-completed-section" : ""}">

                <h2 class="tech-section-title">
                    ${esc(title)}
                </h2>

                <div class="tech-empty-job">

                    ${
                        titleIcon
                            ? `
                                <div class="tech-empty-icon ${
                                    title === "Today's Jobs"
                                        ? "tech-empty-icon-blue"
                                        : "tech-empty-icon-indigo"
                                }">
                                    ${titleIcon}
                                </div>
                              `
                            : ""
                    }

                    <p>No jobs scheduled for this time</p>

                </div>

            </section>
        `;
    }


    return `
        <section class="tech-job-section ${
            title === "Completed Jobs"
                ? "tech-completed-section"
                : "tech-top-section"
        }">

            <h2 class="tech-section-title">
                ${esc(title)}
            </h2>

            <div class="${
                title === "Completed Jobs"
                    ? "tech-completed-list"
                    : "tech-job-grid"
            }">

                ${items.map(a => `

                    <button
                        type="button"
                        class="tech-job-card"
                        data-id="${esc(a.id)}"
                    >

                        <div class="tech-job-card-header">

                            <strong>
                                ${esc(a.appointment_id)}
                            </strong>

                            <span class="tech-job-date">
                                <i class="fa-regular fa-calendar"></i>
                                ${esc(a.appointment_date)}
                                ${esc(a.appointment_time)}
                            </span>

                        </div>


                        <div class="tech-job-card-body">

                            <div class="tech-job-customer">

                                <p>
                                    <strong>Client:</strong>
                                    <span>
                                        ${esc(a.customer_name)}
                                    </span>
                                </p>

                                <p>
                                    <strong>Phone:</strong>

                                    <span>
                                        <i class="fa-solid fa-phone"></i>
                                        ${esc(a.mobile)}
                                    </span>
                                </p>

                            </div>


                            <div class="tech-job-divider"></div>


                            <div class="tech-service-details">

                                <p class="tech-service-label">
                                    SERVICE DETAILS
                                </p>

                                <p class="tech-service-value">
                                    ${esc(a.service_category)}

                                    <span>/</span>

                                    ${esc(a.service_type)}
                                </p>

                            </div>


                            <div class="tech-job-footer">

                                <span class="tech-status-badge ${
                                    a.status === "completed"
                                        ? "tech-status-completed"
                                        : "tech-status-default"
                                }">

                                    ${
                                        a.status === "completed"
                                            ? '<i class="fa-solid fa-circle-check"></i> COMPLETED'
                                            : esc(a.status)
                                    }

                                </span>


                                ${
                                    a.status === "completed"
                                        ? `
                                            <span class="tech-feedback-link">
                                                <i class="fa-regular fa-comment-dots"></i>
                                                Feedback/Notes
                                            </span>
                                          `
                                        : ""
                                }

                            </div>

                        </div>

                    </button>

                `).join("")}

            </div>

        </section>
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

async function loadDetail(id){

    try{

        const {
            appointment:a
        } = await api(
            "appointment",
            {id}
        );


        const map = a.google_maps_url
            ? `
                <a
                    class="tech-action-button tech-map-button"
                    target="_blank"
                    rel="noopener"
                    href="${esc(a.google_maps_url)}"
                >
                    <i class="fa-solid fa-location-dot"></i>
                    Open in Google Maps
                </a>
              `
            : "";


        detail.innerHTML = `

            <div class="tech-detail-card">

                <div class="tech-detail-header">

                    <div>

                        <p class="tech-detail-label">
                            APPOINTMENT
                        </p>

                        <h2 class="tech-detail-title">
                            ${esc(a.appointment_id)}
                        </h2>

                    </div>

                    <span class="tech-status-badge tech-status-default">
                        ${esc(a.status)}
                    </span>

                </div>


                <div class="tech-detail-body">

                    <div class="tech-detail-section">

                        <h3>
                            Customer Details
                        </h3>

                        <div class="tech-detail-info-grid">

                            <div>
                                <span>Customer</span>
                                <strong>
                                    ${esc(a.customer_name)}
                                </strong>
                            </div>

                            <div>
                                <span>Phone</span>
                                <strong>
                                    ${esc(a.mobile)}
                                </strong>
                            </div>

                            <div>
                                <span>Service</span>
                                <strong>
                                    ${esc(a.service_category)}
                                </strong>
                            </div>

                            <div>
                                <span>Service Type</span>
                                <strong>
                                    ${esc(a.service_type)}
                                </strong>
                            </div>

                            <div>
                                <span>Date</span>
                                <strong>
                                    ${esc(a.appointment_date)}
                                </strong>
                            </div>

                            <div>
                                <span>Time</span>
                                <strong>
                                    ${esc(a.appointment_time)}
                                </strong>
                            </div>

                        </div>

                    </div>


                    <div class="tech-detail-section">

                        <h3>
                            Service Address
                        </h3>

                        <p class="tech-detail-address">
                            ${esc(a.service_address)}
                        </p>

                        ${map}

                    </div>


                    <div class="tech-detail-section">

                        <h3>
                            Problem Description
                        </h3>

                        <p class="tech-detail-description">
                            ${esc(a.problem_description)}
                        </p>

                    </div>


                    <div class="tech-detail-section">

                        <h3>
                            Update Job Status
                        </h3>

                        <div class="tech-detail-actions">

                            <button
                                type="button"
                                class="tech-action-button"
                                data-status="on_the_way"
                            >
                                <i class="fa-solid fa-route"></i>
                                Mark On The Way
                            </button>


                            <button
                                type="button"
                                class="tech-action-button"
                                data-status="in_progress"
                            >
                                <i class="fa-solid fa-screwdriver-wrench"></i>
                                Mark In Progress
                            </button>

                        </div>

                    </div>


                    <div class="tech-detail-section">

                        <h3>
                            Job ID
                        </h3>

                        <div class="tech-job-id-row">

                            <input
                                id="jobCode"
                                class="tech-input"
                                value="${esc(a.job_code||"")}"
                                placeholder="CFX-JOB-2026-00452"
                            >

                            <button
                                id="saveJob"
                                type="button"
                                class="tech-action-button"
                            >
                                <i class="fa-solid fa-floppy-disk"></i>
                                Save Job ID
                            </button>

                        </div>

                    </div>


                    ${
                        ["in_progress","job_id_created"].includes(a.status)
                            ? `

                                <div class="tech-detail-section">

                                    <button
                                        id="complete"
                                        type="button"
                                        class="tech-complete-button"
                                    >
                                        <i class="fa-solid fa-circle-check"></i>

                                        ${
                                            a.status === "job_id_created"
                                                ? "Complete Job"
                                                : "Complete Service"
                                        }

                                    </button>


                                    <div
                                        id="otpArea"
                                        class="tech-otp-area"
                                    ></div>

                                </div>

                              `
                            : ""
                    }


                    <p
                        id="techMessage"
                        class="tech-message"
                    ></p>

                </div>

            </div>
        `;


        document
            .querySelectorAll(".tech-action-button[data-status]")
            .forEach(b => {

                b.onclick = () =>
                    status(
                        id,
                        b.dataset.status
                    );

            });


        const saveJobButton =
            document.getElementById("saveJob");

        const jobCode =
            document.getElementById("jobCode");


        saveJobButton?.addEventListener(
            "click",
            () =>
                status(
                    id,
                    "job_id_created",
                    jobCode.value
                )
        );


        const completeButton =
            document.getElementById("complete");


        completeButton?.addEventListener(
            "click",
            () => startOtp(id)
        );


    }catch(e){

        detail.innerHTML = `

            <div class="tech-error-message">
                ${esc(e.message)}
            </div>

        `;

    }

}
async function status(id,status,job_code){try{await api("set_status",{id,status,job_code});await loadDetail(id);await load()}catch(e){techMessage.textContent=e.message}}
async function startOtp(id){

    try{

        await api(
            "start_completion",
            {id}
        );


        otpArea.innerHTML = `

            <div class="tech-otp-message">

                <i class="fa-solid fa-envelope-circle-check"></i>

                <div>

                    <strong>
                        Customer Verification Required
                    </strong>

                    <p>
                        A verification OTP has been sent
                        to the customer's registered email.
                    </p>

                </div>

            </div>


            <div class="tech-otp-row">

                <input
                    id="otp"
                    class="tech-input"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="Enter 6-digit OTP"
                >

                <button
                    id="verify"
                    type="button"
                    class="tech-complete-button"
                >
                    Verify &amp; Complete
                </button>

            </div>


            <button
                id="resend"
                type="button"
                class="tech-resend-button"
            >
                Resend OTP
            </button>

        `;


        verify.onclick =
            () => verifyOtp(id);


        resend.onclick =
            () => startOtp(id);


    }catch(e){

        techMessage.textContent =
            e.message;

    }

}
async function verifyOtp(id){

    try{

        await api(
            "verify_completion",
            {
                id,
                otp:otp.value
            }
        );


        detail.innerHTML = `

            <div class="tech-success-message">

                <i class="fa-solid fa-circle-check"></i>

                <div>

                    <h3>
                        Appointment completed successfully.
                    </h3>

                    <p>
                        The job has been marked as completed.
                    </p>

                </div>

            </div>

        `;


        load();


    }catch(e){

        techMessage.textContent =
            e.message;

    }

}


signOut.onclick = async () => {

    try {

        const { error } =
            await sb.auth.signOut({
                scope: "local"
            });

        if (error) {
            console.error(
                "Technician sign out error:",
                error
            );
        }

    } finally {

        window.location.replace(
            "./login.html"
        );

    }

};
    
    if(sb){

    sb.auth.onAuthStateChange(
        async (event, session) => {

            if(
                event === "INITIAL_SESSION" ||
                event === "SIGNED_IN"
            ){

                if(!session){

                    window.location.replace(
                        "./login.html"
                    );

                    return;
                }

                await load();

            }

        }
    );

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