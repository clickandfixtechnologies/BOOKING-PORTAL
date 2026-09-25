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

/* =========================================================
   TECHNICIAN JOB CARD CLICK HANDLER
   Event Delegation
   ========================================================= */

jobs?.addEventListener("click", event => {

    const card =
        event.target.closest(".tech-job-card");

    if (!card) {
        return;
    }

    const id = card.dataset.id;

    if (!id) {
        console.error(
            "Technician job card has no appointment ID."
        );

        return;
    }

    console.log(
        "Opening technician appointment:",
        id
    );

    loadDetail(id);
});

const esc = value => {
    const e = document.createElement("div");
    e.textContent = value ?? "—";
    return e.innerHTML;
};

function formatStatus(status) {

    if (!status) {
        return "—";
    }

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}


function formatServiceType(value) {

    if (!value) {
        return "—";
    }

    return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/\bCctv\b/g, "CCTV")
        .replace(/\bId\b/g, "ID")
        .replace(/\bOtp\b/g, "OTP");
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function formatTime(value) {

    if (!value) {
        return "—";
    }

    const parts = String(value).split(":");

    if (parts.length < 2) {
        return value;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
    ) {
        return value;
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

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

    <!-- Dashboard Welcome -->

    <div class="tech-dashboard-welcome">

        <div class="tech-work-summary">

    <div class="tech-summary-intro">

        <div class="tech-summary-main-icon">
            <i class="fa-solid fa-briefcase"></i>
        </div>

        <div class="tech-summary-text">
            <h2>Your Work Summary</h2>
            <p>Quick overview of your jobs</p>
        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-today">
            <i class="fa-solid fa-calendar-check"></i>
        </div>

        <div class="tech-summary-stat-content">
            <strong>${(d.today || []).length}</strong>
            <span>Today's Jobs</span>
        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-upcoming">
            <i class="fa-regular fa-calendar"></i>
        </div>

        <div class="tech-summary-stat-content">
            <strong>${(d.upcoming || []).length}</strong>
            <span>Upcoming</span>
        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-completed">
            <i class="fa-solid fa-circle-check"></i>
        </div>

        <div class="tech-summary-stat-content">
            <strong>${(d.completed || []).length}</strong>
            <span>Completed</span>
        </div>

    </div>

</div>


    <!-- Today's + Upcoming -->

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


    <!-- Completed -->

    ${section(
        "Completed Jobs",
        d.completed || [],
        "completed"
    )}

`;


        


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

function getServiceIcon(category, serviceType) {

    const cat = String(category || "")
        .toLowerCase()
        .replace(/[_-]/g, " ");

    const type = String(serviceType || "")
        .toLowerCase()
        .replace(/[_-]/g, " ");

    const value = `${cat} ${type}`;


    // =====================================================
    // CCTV Installation / Service
    // =====================================================

    if (
        cat.includes("cctv") ||
        cat.includes("camera") ||
        value.includes("cctv") ||
        value.includes("camera")
    ) {
        return `
            <i class="fa-solid fa-video"></i>
        `;
    }


    // =====================================================
    // Networking / IT Support
    // =====================================================

    if (
        cat.includes("network") ||
        cat.includes("it support") ||
        value.includes("network") ||
        value.includes("wifi") ||
        value.includes("router")
    ) {
        return `
            <i class="fa-solid fa-wifi"></i>
        `;
    }


    // =====================================================
    // Data Recovery
    // =====================================================

    if (
        cat.includes("data recovery") ||
        value.includes("data recovery") ||
        value.includes("hard disk") ||
        value.includes("hard drive") ||
        value.includes("ssd recovery")
    ) {
        return `
            <i class="fa-solid fa-hard-drive"></i>
        `;
    }


    // =====================================================
    // Printer / Peripheral Service
    // =====================================================

    if (
        cat.includes("printer") ||
        cat.includes("peripheral") ||
        value.includes("printer")
    ) {
        return `
            <i class="fa-solid fa-print"></i>
        `;
    }


    // =====================================================
    // Computer / Laptop Service
    // =====================================================

    if (
        cat.includes("computer") ||
        cat.includes("laptop")
    ) {

        // Laptop Repair
        if (
            type.includes("laptop")
        ) {
            return `
                <i class="fa-solid fa-laptop"></i>
            `;
        }


        // Desktop / Computer Repair
        if (
            type.includes("desktop") ||
            type.includes("computer repair")
        ) {
            return `
                <i class="fa-solid fa-desktop"></i>
            `;
        }


        // Windows / Software
        if (
            type.includes("windows") ||
            type.includes("software")
        ) {
            return `
                <i class="fa-brands fa-windows"></i>
            `;
        }


        // SSD
        if (
            type.includes("ssd") ||
            type.includes("storage")
        ) {
            return `
                <i class="fa-solid fa-hard-drive"></i>
            `;
        }


        // RAM
        if (
            type.includes("ram") ||
            type.includes("memory")
        ) {
            return `
                <i class="fa-solid fa-memory"></i>
            `;
        }


        // Motherboard
        if (
            type.includes("motherboard")
        ) {
            return `
                <i class="fa-solid fa-microchip"></i>
            `;
        }


        // Default Computer / Laptop
        return `
            <i class="fa-solid fa-laptop"></i>
        `;
    }


    // =====================================================
    // Other Service
    // =====================================================

    if (
        cat.includes("other")
    ) {
        return `
            <i class="fa-solid fa-screwdriver-wrench"></i>
        `;
    }


    // =====================================================
    // Default
    // =====================================================

    return `
        <i class="fa-solid fa-screwdriver-wrench"></i>
    `;
}

function section(title, items) {

    const isToday =
        title === "Today's Jobs";

    const isUpcoming =
        title === "Upcoming Jobs";

    const isCompleted =
        title === "Completed Jobs";


    const sectionIcon =
        isToday
            ? `
                <i class="fa-solid fa-calendar-days"></i>
              `
            : isUpcoming
                ? `
                    <i class="fa-solid fa-calendar-days"></i>
                  `
                : `
                    <i class="fa-solid fa-circle-check"></i>
                  `;


    const sectionIconClass =
        isToday
            ? "tech-section-icon-blue"
            : isUpcoming
                ? "tech-section-icon-purple"
                : "tech-section-icon-green";


    const sectionClass =
        isCompleted
            ? "tech-job-section tech-completed-section"
            : "tech-job-section tech-top-section";


    if (!items.length) {

        return `
            <section class="${sectionClass}">

                <div class="tech-section-heading">

                    <div class="
                        tech-section-icon
                        ${sectionIconClass}
                    ">
                        ${sectionIcon}
                    </div>

                    <div>

                        <h2 class="tech-section-title">
                            ${esc(title)}
                        </h2>

                        <p class="tech-section-subtitle">
                            ${
                                isToday
                                    ? "Jobs scheduled for today"
                                    : isUpcoming
                                        ? "Jobs scheduled for later"
                                        : "Recently completed jobs"
                            }
                        </p>

                    </div>

                </div>


                <div class="tech-empty-job">

                    <div class="tech-empty-icon ${
                        isToday
                            ? "tech-empty-icon-blue"
                            : "tech-empty-icon-indigo"
                    }">

                        ${sectionIcon}

                    </div>

                    <p>
                        ${
                            isCompleted
                                ? "No completed jobs"
                                : "No jobs scheduled for this time"
                        }
                    </p>

                </div>

            </section>
        `;
    }


    return `
        <section class="${sectionClass}">

            <div class="tech-section-heading">

                <div class="
                    tech-section-icon
                    ${sectionIconClass}
                ">
                    ${sectionIcon}
                </div>

                <div>

                    <h2 class="tech-section-title">
                        ${esc(title)}
                    </h2>

                    <p class="tech-section-subtitle">
                        ${
                            isToday
                                ? "Jobs scheduled for today"
                                : isUpcoming
                                    ? "Jobs scheduled for later"
                                    : "Recently completed jobs"
                        }
                    </p>

                </div>

            </div>


            <div class="${
                isCompleted
                    ? "tech-completed-list"
                    : "tech-job-grid"
            }">


                ${items.map(a => {

                    const serviceIcon =
                        getServiceIcon(
                            a.service_category,
                            a.service_type
                        );


                    const statusClass =
                        isToday
                            ? "tech-job-status-today"
                            : isUpcoming
                                ? "tech-job-status-upcoming"
                                : "tech-job-status-completed";


                    const statusIcon =
                        isToday
                            ? `
                                <i class="fa-solid fa-circle"></i>
                              `
                            : isUpcoming
                                ? `
                                    <i class="fa-regular fa-clock"></i>
                                  `
                                : `
                                    <i class="fa-solid fa-circle-check"></i>
                                  `;


                    const statusText =
                        isToday
                            ? "Today's Job"
                            : isUpcoming
                                ? "Upcoming"
                                : "Completed";


                    return `

                        <button
                            type="button"
                            class="tech-job-card"
                            data-id="${esc(a.id)}"
                        >


                            <!-- Appointment Header -->

                            <div class="tech-job-card-header">

                                <strong class="tech-job-card-id">
                                    ${esc(a.appointment_id)}
                                </strong>


                                <span class="
                                    tech-job-status
                                    ${statusClass}
                                ">
                                    ${statusIcon}
                                    ${statusText}
                                </span>

                            </div>


                            <!-- Card Divider -->

                            <div class="tech-card-divider"></div>


                            <!-- Main Card Content -->

                            <div class="tech-job-card-main">


                                <!-- Service Icon -->

                                <div class="
                                    tech-service-icon
                                    ${
                                        isUpcoming
                                            ? "tech-service-icon-purple"
                                            : ""
                                    }
                                ">
                                    ${serviceIcon}
                                </div>


                                <!-- Customer Information -->

                                <div class="tech-job-information">


                                    <h3 class="tech-job-service-title">

                                        ${formatServiceType(
                                            a.service_category
                                        )}

                                        <span>/</span>

                                        ${formatServiceType(
                                            a.service_type
                                        )}

                                    </h3>


                                    <div class="tech-job-info-row">

                                        <i class="fa-regular fa-user"></i>

                                        <span class="tech-info-label">
                                            Client
                                        </span>

                                        <strong>
                                            ${esc(a.customer_name)}
                                        </strong>

                                    </div>


                                    <div class="tech-job-info-row">

                                        <i class="fa-solid fa-phone"></i>

                                        <span class="tech-info-label">
                                            Phone
                                        </span>

                                        <strong>
                                            ${esc(a.mobile)}
                                        </strong>

                                    </div>


                                    <div class="tech-job-info-row">

                                        <i class="fa-solid fa-screwdriver-wrench"></i>

                                        <span class="tech-info-label">
                                            Service Details
                                        </span>

                                        <strong>
                                            ${formatServiceType(
                                                a.service_category
                                            )}

                                            /

                                            ${formatServiceType(
                                                a.service_type
                                            )}
                                        </strong>

                                    </div>

                                </div>


                                <!-- Date / Time -->

                                <div class="tech-job-date-box">

                                    <i class="
                                        fa-regular
                                        fa-calendar-days
                                    "></i>

                                    <div>

                                        <strong>
                                            ${formatDate(
                                                a.appointment_date
                                            )}
                                        </strong>

                                        <span>
                                            ${formatTime(
                                                a.appointment_time
                                            )}
                                        </span>

                                    </div>

                                </div>

                            </div>


                            <!-- Card Footer -->

                            <div class="tech-job-card-footer">


                                <span class="tech-view-details">

                                    <i class="
                                        fa-solid
                                        fa-check
                                    "></i>

                                    View Details

                                </span>


                                <span class="tech-card-arrow">

                                    <i class="
                                        fa-solid
                                        fa-chevron-right
                                    "></i>

                                </span>

                            </div>


                        </button>

                    `;

                }).join("")}


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

    console.log(
        "loadDetail() called with appointment ID:",
        id
    );


    detail.innerHTML = `
        <div class="tech-loading-message">
            Loading appointment details...
        </div>
    `;

    try{

        console.log(
            "Calling technician API for appointment:",
            id
        );

        const result = await api(
            "appointment",
            { id }
        );

        console.log(
            "Appointment API response:",
            result
        );

        const { appointment:a } = result;

        if(!a){
            throw new Error(
                "Appointment details were not returned."
            );
        }


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
    <div class="tech-detail-heading">
        <p class="tech-detail-label">APPOINTMENT</p>

        <div class="tech-detail-title-row">
            <h2 class="tech-detail-title">
                ${esc(a.appointment_id)}
            </h2>

            <div class="tech-contact-buttons">

                <a
                    class="tech-contact-button tech-call-button"
                    href="tel:${esc(a.mobile)}"
                    aria-label="Call customer"
                    title="Call customer"
                >
                    <i class="fa-solid fa-phone"></i>
                </a>

                <a
                    class="tech-contact-button tech-whatsapp-button"
                    href="https://wa.me/91${String(a.mobile || "").replace(/\D/g,"")}"
                    target="_blank"
                    rel="noopener"
                    aria-label="WhatsApp customer"
                    title="WhatsApp customer"
                >
                    <i class="fa-brands fa-whatsapp"></i>
                </a>

            </div>
        </div>
    </div>

    <span class="tech-status-badge tech-status-default">
        ${formatStatus(a.status)}
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
                                ${formatServiceType(a.service_category)}
                                </strong>
                            </div>

                            <div>
                                <span>Service Type</span>
                                <strong>
                                ${formatServiceType(a.service_type)}
                                </strong>
                            </div>

                            <div>
    <span>Date</span>
    <strong>
        ${formatDate(a.appointment_date)}
    </strong>
</div>

<div>
    <span>Time</span>
    <strong>
        ${formatTime(a.appointment_time)}
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
        ${a.status !== "technician_assigned" ? "disabled" : ""}
    >
        <i class="fa-solid fa-route"></i>
        Mark On The Way
    </button>


    <button
        type="button"
        class="tech-action-button"
        data-status="in_progress"
        ${a.status !== "on_the_way" ? "disabled" : ""}
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
            value="${esc(a.job_code || "")}"
            placeholder="CFX-JOB-2026-00452"
            ${a.status !== "in_progress" || a.job_code ? "readonly" : ""}
        >

        <button
            id="saveJob"
            type="button"
            class="tech-action-button"
            ${a.status !== "in_progress" || a.job_code ? "disabled" : ""}
        >
            <i class="fa-solid fa-floppy-disk"></i>
            Save Job ID
        </button>

        ${
            a.status === "job_id_created" && a.job_code
                ? `
                    <button
                        id="editJob"
                        type="button"
                        class="tech-action-button tech-edit-job-button"
                    >
                        <i class="fa-solid fa-pen"></i>
                        Edit Job ID
                    </button>
                  `
                : ""
        }

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


        detail.style.display = "block";
detail.style.visibility = "visible";
detail.style.opacity = "1";
detail.style.height = "auto";
detail.style.overflow = "visible";

detail.scrollIntoView({
    behavior: "smooth",
    block: "start"
});

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

const editJobButton =
    document.getElementById("editJob");

const jobCode =
    document.getElementById("jobCode");


saveJobButton?.addEventListener(
    "click",
    () => {

        const value =
            jobCode?.value.trim();

        if (!value) {

            const message =
                document.getElementById("techMessage");

            if (message) {
                message.textContent =
                    "Please enter a Job ID.";
            }

            jobCode?.focus();

            return;
        }

        status(
            id,
            "job_id_created",
            value
        );

    }
);


editJobButton?.addEventListener(
    "click",
    () => {

        if (!jobCode) {
            return;
        }

        jobCode.readOnly = false;

        jobCode.focus();

        jobCode.select();

        if (saveJobButton) {
            saveJobButton.disabled = false;
        }

    }
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
async function status(id, status, job_code) {

    try {

        await api(
            "set_status",
            {
                id,
                status,
                job_code
            }
        );

        await loadDetail(id);

        await load();

    } catch (e) {

        const message =
            document.getElementById("techMessage");

        if (message) {
            message.textContent = e.message;
        }

        console.error(
            "Technician status update failed:",
            e
        );
    }
}

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

document.addEventListener("click", event => {

    if (
        !techSidebar?.classList.contains("open")
    ) {
        return;
    }

    const clickedInsideSidebar =
        techSidebar.contains(event.target);

    const clickedMenuButton =
        techMenuBtn?.contains(event.target);

    if (
        !clickedInsideSidebar &&
        !clickedMenuButton
    ) {
        closeTechnicianMenu();
    }

});

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