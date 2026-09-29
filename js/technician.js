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

    const id =
        card.dataset.id;

    if (!id) {
        console.error(
            "Technician job card has no appointment ID."
        );

        return;
    }


    /* =====================================================
       HISTORY JOBS ARE READ-ONLY
       ===================================================== */

    if (
        card.dataset.history === "true"
    ) {

        console.log(
            "Opening history appointment in read-only mode:",
            id
        );

        loadHistoryDetail(id);

        return;
    }


    /* =====================================================
       NORMAL JOBS
       ===================================================== */

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

function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
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
        await loadTechnicianHeaderProfile();

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

        <div class="tech-welcome-text">

            <h1>
                <span class="tech-welcome-hand">
                    <i class="fa-solid fa-hand"></i>
                </span>

                Hello, ${esc(technicianName)}!
            </h1>

            <p>
                Here are your assigned jobs.
            </p>

        </div>

    </div>


    <!-- Work Summary -->

<div class="tech-work-summary">

    <div class="tech-summary-intro">

        <div class="tech-summary-main-icon">
            <i class="fa-solid fa-briefcase"></i>
        </div>

        <div class="tech-summary-text">

            <h2>
                Your Work Summary
            </h2>

            <p>
                Quick overview of your jobs
            </p>

        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <!-- Today's Jobs -->

    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-today">
            <i class="fa-solid fa-calendar-check"></i>
        </div>

        <div class="tech-summary-stat-content">

            <strong>
                ${(d.today || []).length}
            </strong>

            <span>
                Today's Jobs
            </span>

        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <!-- Upcoming -->

    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-upcoming">
            <i class="fa-regular fa-calendar"></i>
        </div>

        <div class="tech-summary-stat-content">

            <strong>
                ${(d.upcoming || []).length}
            </strong>

            <span>
                Upcoming
            </span>

        </div>

    </div>


    <div class="tech-summary-divider"></div>


    <!-- Completed -->

    <div class="tech-summary-stat">

        <div class="tech-summary-icon tech-summary-icon-completed">
            <i class="fa-solid fa-circle-check"></i>
        </div>

        <div class="tech-summary-stat-content">

            <strong>
                ${(d.completed || []).length}
            </strong>

            <span>
                Completed
            </span>

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

async function loadProfile() {

    jobs.innerHTML = `
        <div class="tech-loading-message">
            Loading profile...
        </div>
    `;

    detail.innerHTML = "";

    const result = await api("profile");

    const p = result?.profile;

    if (!p) {
        throw new Error("Technician profile was not returned.");
    }
    updateTechnicianHeaderAvatar(p);

    const specialization = Array.isArray(p.specialization)
        ? p.specialization.join(", ")
        : "Not specified";

    const workingDays = Array.isArray(p.working_days)
        ? p.working_days.join(", ")
        : "Not specified";

    const workingHours =
        p.working_start && p.working_end
            ? `${formatTime(p.working_start)} - ${formatTime(p.working_end)}`
            : "Not specified";

    const statusClass = p.is_active
        ? "tech-status-completed"
        : "tech-status-default";

    const profileImageUrl =
        p.profile_image_url || "";

    const avatarContent = profileImageUrl
        ? `
            <img
                src="${esc(profileImageUrl)}"
                alt="${esc(p.full_name || "Technician")}"
                class="tech-profile-avatar-image"
                id="technicianProfileAvatar"
            >
        `
        : `
            <div
                class="tech-profile-avatar-fallback"
                id="technicianProfileAvatar"
            >
                ${esc(getTechnicianInitials(p.full_name))}
            </div>
        `;

    jobs.innerHTML = `

        <section class="tech-detail-card">

            <div class="tech-detail-header">

                <div>

                    <p class="tech-detail-label">
                        TECHNICIAN PROFILE
                    </p>

                    <h2 class="tech-detail-title">
                        ${esc(p.full_name || "Technician")}
                    </h2>

                </div>

                <span class="tech-status-badge ${statusClass}">
                    ${p.is_active ? "Active" : "Inactive"}
                </span>

            </div>


            <div class="tech-detail-body">


                <!-- =================================================
                     PROFILE PHOTO
                     ================================================= -->

                <div class="tech-detail-section tech-profile-photo-section">

                    <h3>
                        Profile Photo
                    </h3>

                    <div class="tech-profile-photo-wrapper">

                        <div class="tech-profile-avatar-container">

                            ${avatarContent}

                        </div>

                        <div class="tech-profile-photo-content">

                            <div class="tech-profile-photo-title">
                                Your Profile Picture
                            </div>

                            <p class="tech-profile-photo-help">
                                Upload a clear photo. JPG, PNG or WebP.
                                Maximum size 5 MB.
                            </p>

                            <div class="tech-profile-photo-actions">

                                <button
                                    type="button"
                                    class="tech-profile-photo-btn"
                                    id="changeTechnicianPhotoBtn"
                                >
                                    Change Photo
                                </button>

                                ${
                                    profileImageUrl
                                        ? `
                                            <button
                                                type="button"
                                                class="tech-profile-photo-remove-btn"
                                                id="removeTechnicianPhotoBtn"
                                            >
                                                Remove Photo
                                            </button>
                                        `
                                        : ""
                                }

                            </div>

                            <input
                                type="file"
                                id="technicianProfilePhotoInput"
                                accept="image/jpeg,image/png,image/webp"
                                hidden
                            >

                        </div>

                    </div>

                </div>


                <!-- =================================================
                     PERSONAL INFORMATION
                     ================================================= -->

                <div class="tech-detail-section">

                    <h3>
                        Personal Information
                    </h3>

                    <div class="tech-detail-info-grid">

                        <div>
                            <span>Full Name</span>
                            <strong>
                                ${esc(p.full_name || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Mobile</span>
                            <strong>
                                ${esc(p.mobile || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Email</span>
                            <strong>
                                ${esc(p.email || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Username</span>
                            <strong>
                                ${esc(p.username || "—")}
                            </strong>
                        </div>

                    </div>

                </div>


                <!-- =================================================
                     PROFESSIONAL INFORMATION
                     ================================================= -->

                <div class="tech-detail-section">

                    <h3>
                        Professional Information
                    </h3>

                    <div class="tech-detail-info-grid">

                        <div>
                            <span>Technician ID</span>
                            <strong>
                                ${esc(p.technician_code || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Specialization</span>
                            <strong>
                                ${esc(specialization)}
                            </strong>
                        </div>

                        <div>
                            <span>Working Days</span>
                            <strong>
                                ${esc(workingDays)}
                            </strong>
                        </div>

                        <div>
                            <span>Working Hours</span>
                            <strong>
                                ${esc(workingHours)}
                            </strong>
                        </div>

                    </div>

                </div>


                <!-- =================================================
                     ACCOUNT INFORMATION
                     ================================================= -->

                <div class="tech-detail-section">

                    <h3>
                        Account Information
                    </h3>

                    <div class="tech-detail-info-grid">

                        <div>
                            <span>Account Status</span>
                            <strong>
                                ${p.is_active ? "Active" : "Inactive"}
                            </strong>
                        </div>

                        <div>
                            <span>Account Created</span>
                            <strong>
                                ${formatDateTime(p.created_at)}
                            </strong>
                        </div>

                    </div>

                </div>

            </div>

        </section>
    `;


    /* =========================================================
       PROFILE PHOTO EVENTS
       ========================================================= */

    const changePhotoBtn =
        document.getElementById(
            "changeTechnicianPhotoBtn"
        );

    const photoInput =
        document.getElementById(
            "technicianProfilePhotoInput"
        );

    const removePhotoBtn =
        document.getElementById(
            "removeTechnicianPhotoBtn"
        );


    if (
        changePhotoBtn &&
        photoInput
    ) {

        changePhotoBtn.addEventListener(
            "click",
            () => {
                photoInput.click();
            }
        );

        photoInput.addEventListener(
            "change",
            handleTechnicianProfilePhotoSelected
        );
    }


    if (removePhotoBtn) {

        removePhotoBtn.addEventListener(
            "click",
            handleTechnicianProfilePhotoRemove
        );
    }
}

async function openTechnicianPhotoCropper(file) {

    return new Promise((resolve, reject) => {

        const objectUrl = URL.createObjectURL(file);

        const modal = document.createElement("div");

        modal.className = "tech-photo-crop-modal";

        modal.innerHTML = `
            <div class="tech-photo-crop-backdrop"></div>

            <div class="tech-photo-crop-dialog">

                <div class="tech-photo-crop-header">

                    <div>
                        <div class="tech-photo-crop-title">
                            Adjust Profile Photo
                        </div>

                        <div class="tech-photo-crop-subtitle">
                            Move and zoom the image to fit the square
                        </div>
                    </div>

                    <button
                        type="button"
                        class="tech-photo-crop-close"
                        id="techPhotoCropClose"
                        aria-label="Close"
                    >
                        ×
                    </button>

                </div>


                <div class="tech-photo-crop-stage">

                    <div class="tech-photo-crop-frame">

                        <canvas
                            id="technicianPhotoCropCanvas"
                            width="640"
                            height="640"
                        ></canvas>

                    </div>

                </div>


                <div class="tech-photo-crop-controls">

                    <label
                        for="technicianPhotoZoom"
                        class="tech-photo-crop-zoom-label"
                    >
                        Zoom
                    </label>

                    <input
                        type="range"
                        id="technicianPhotoZoom"
                        min="1"
                        max="3"
                        step="0.01"
                        value="1"
                    >

                </div>


                <div class="tech-photo-crop-actions">

                    <button
                        type="button"
                        class="tech-photo-crop-cancel"
                        id="techPhotoCropCancel"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        class="tech-photo-crop-confirm"
                        id="techPhotoCropConfirm"
                    >
                        Use This Photo
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(modal);

        const canvas =
            modal.querySelector(
                "#technicianPhotoCropCanvas"
            );

        const ctx =
            canvas.getContext("2d");

        const zoomInput =
            modal.querySelector(
                "#technicianPhotoZoom"
            );

        const closeButton =
            modal.querySelector(
                "#techPhotoCropClose"
            );

        const cancelButton =
            modal.querySelector(
                "#techPhotoCropCancel"
            );

        const confirmButton =
            modal.querySelector(
                "#techPhotoCropConfirm"
            );

        const backdrop =
            modal.querySelector(
                ".tech-photo-crop-backdrop"
            );


        const image =
            new Image();

        image.onload = () => {

            initializeCropper();

        };

        image.onerror = () => {

            cleanup();

            reject(
                new Error(
                    "The selected image could not be loaded."
                )
            );

        };

        image.src = objectUrl;


        let scale = 1;

        let minScale = 1;

        let offsetX = 0;

        let offsetY = 0;

        let dragging = false;

        let startPointerX = 0;

        let startPointerY = 0;

        let startOffsetX = 0;

        let startOffsetY = 0;


        function initializeCropper() {

            const imageAspect =
                image.width / image.height;

            if (imageAspect > 1) {

                minScale =
                    canvas.height / image.height;

            } else {

                minScale =
                    canvas.width / image.width;

            }

            scale = minScale;

            zoomInput.value = "1";

            offsetX =
                (canvas.width -
                    image.width * scale) / 2;

            offsetY =
                (canvas.height -
                    image.height * scale) / 2;

            draw();

            requestAnimationFrame(() => {

                modal.classList.add(
                    "is-visible"
                );

            });

        }


        function draw() {

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            ctx.fillStyle = "#111";

            ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );


            const drawWidth =
                image.width * scale;

            const drawHeight =
                image.height * scale;


            ctx.drawImage(
                image,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight
            );


            /*
             * Square crop boundary.
             * Canvas itself is already 1:1,
             * so the whole canvas is the crop area.
             */

            ctx.save();

            ctx.strokeStyle =
                "rgba(255,255,255,0.85)";

            ctx.lineWidth = 4;

            ctx.strokeRect(
                2,
                2,
                canvas.width - 4,
                canvas.height - 4
            );

            ctx.restore();

        }


        function updateZoom(newZoom) {

            const oldScale = scale;

            const zoomRatio =
                Number(newZoom);

            scale =
                minScale *
                zoomRatio;


            /*
             * Keep image centered while
             * changing zoom.
             */

            const centerX =
                canvas.width / 2;

            const centerY =
                canvas.height / 2;


            const imagePointX =
                (centerX - offsetX) /
                oldScale;

            const imagePointY =
                (centerY - offsetY) /
                oldScale;


            offsetX =
                centerX -
                imagePointX * scale;

            offsetY =
                centerY -
                imagePointY * scale;


            constrainImage();

            draw();

        }


        function constrainImage() {

            const width =
                image.width * scale;

            const height =
                image.height * scale;


            /*
             * Image must always cover
             * the complete square.
             */

            if (width <= canvas.width) {

                offsetX =
                    (canvas.width - width) / 2;

            } else {

                const minX =
                    canvas.width - width;

                const maxX = 0;

                offsetX =
                    Math.min(
                        maxX,
                        Math.max(
                            minX,
                            offsetX
                        )
                    );

            }


            if (height <= canvas.height) {

                offsetY =
                    (canvas.height - height) / 2;

            } else {

                const minY =
                    canvas.height - height;

                const maxY = 0;

                offsetY =
                    Math.min(
                        maxY,
                        Math.max(
                            minY,
                            offsetY
                        )
                    );

            }

        }


        function pointerDown(event) {

            dragging = true;

            const point =
                getPointerPosition(event);

            startPointerX =
                point.x;

            startPointerY =
                point.y;

            startOffsetX =
                offsetX;

            startOffsetY =
                offsetY;


            canvas.setPointerCapture(
                event.pointerId
            );

        }


        function pointerMove(event) {

            if (!dragging) {

                return;

            }


            const point =
                getPointerPosition(event);


            offsetX =
                startOffsetX +
                (
                    point.x -
                    startPointerX
                );


            offsetY =
                startOffsetY +
                (
                    point.y -
                    startPointerY
                );


            constrainImage();

            draw();

        }


        function pointerUp(event) {

            dragging = false;

            try {

                canvas.releasePointerCapture(
                    event.pointerId
                );

            } catch (_) {}

        }


        function getPointerPosition(event) {

            const rect =
                canvas.getBoundingClientRect();

            const scaleX =
                canvas.width /
                rect.width;

            const scaleY =
                canvas.height /
                rect.height;


            return {

                x:
                    (
                        event.clientX -
                        rect.left
                    ) * scaleX,

                y:
                    (
                        event.clientY -
                        rect.top
                    ) * scaleY

            };

        }


        function cleanup() {

            URL.revokeObjectURL(
                objectUrl
            );

            modal.remove();

        }


        function closeCropper() {

            cleanup();

            resolve(null);

        }


        zoomInput.addEventListener(
            "input",
            () => {

                updateZoom(
                    zoomInput.value
                );

            }
        );


        canvas.addEventListener(
            "pointerdown",
            pointerDown
        );


        canvas.addEventListener(
            "pointermove",
            pointerMove
        );


        canvas.addEventListener(
            "pointerup",
            pointerUp
        );


        canvas.addEventListener(
            "pointercancel",
            pointerUp
        );


        closeButton.addEventListener(
            "click",
            closeCropper
        );


        cancelButton.addEventListener(
            "click",
            closeCropper
        );


        backdrop.addEventListener(
            "click",
            closeCropper
        );


        confirmButton.addEventListener(
            "click",
            async () => {

                try {

                    confirmButton.disabled =
                        true;

                    confirmButton.textContent =
                        "Preparing...";


                    const blob =
                        await createTechnicianWebP(
                            canvas,
                            0.82
                        );


                    cleanup();


                    await uploadTechnicianProfilePhoto(
                        blob
                    );


                    resolve(true);

                } catch (error) {

                    console.error(
                        "Profile photo crop/upload failed:",
                        error
                    );


                    cleanup();

                    reject(error);

                }

            }
        );

    });

}

async function createTechnicianWebP(
    canvas,
    quality = 0.82
) {

    return new Promise((resolve, reject) => {

        canvas.toBlob(
            (blob) => {

                if (!blob) {

                    reject(
                        new Error(
                            "Could not create WebP image."
                        )
                    );

                    return;

                }


                resolve(blob);

            },
            "image/webp",
            quality
        );

    });

}


async function uploadTechnicianProfilePhoto(
    blob
) {

    if (!(blob instanceof Blob)) {

        throw new Error(
            "Invalid profile photo."
        );

    }


    if (blob.size <= 0) {

        throw new Error(
            "The generated image is empty."
        );

    }


    const maxSize =
        5 * 1024 * 1024;


    if (blob.size > maxSize) {

        throw new Error(
            "The profile photo is larger than 5 MB."
        );

    }


    const token =
        await getValidAccessToken();


    const formData =
        new FormData();


    formData.append(
        "action",
        "upload"
    );


    formData.append(
        "file",
        blob,
        "profile.webp"
    );


    showTechnicianPhotoUploadState(
        true
    );


    try {

        const response =
            await fetch(
                `${c.supabaseUrl.replace(/\/$/, "")}/functions/v1/technician-profile-photo`,
                {
                    method: "POST",

                    headers: {
                        apikey:
                            c.supabaseAnonKey,

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: formData
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data?.error ||
                "Profile photo upload failed."
            );

        }


        if (!data?.success) {

            throw new Error(
                "Profile photo upload failed."
            );

        }


        await loadProfile();


    } finally {

        showTechnicianPhotoUploadState(
            false
        );

    }

}


async function removeTechnicianProfilePhoto() {

    const token =
        await getValidAccessToken();


    const formData =
        new FormData();


    formData.append(
        "action",
        "remove"
    );


    showTechnicianPhotoUploadState(
        true
    );


    try {

        const response =
            await fetch(
                `${c.supabaseUrl.replace(/\/$/, "")}/functions/v1/technician-profile-photo`,
                {
                    method: "POST",

                    headers: {
                        apikey:
                            c.supabaseAnonKey,

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: formData
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data?.error ||
                "Profile photo could not be removed."
            );

        }


        if (!data?.success) {

            throw new Error(
                "Profile photo could not be removed."
            );

        }


        await loadProfile();


    } finally {

        showTechnicianPhotoUploadState(
            false
        );

    }

}


function showTechnicianPhotoUploadState(
    loading
) {

    const changeButton =
        document.getElementById(
            "changeTechnicianPhotoBtn"
        );

    const removeButton =
        document.getElementById(
            "removeTechnicianPhotoBtn"
        );


    if (changeButton) {

        changeButton.disabled =
            loading;

        changeButton.textContent =
            loading
                ? "Uploading..."
                : "Change Photo";

    }


    if (removeButton) {

        removeButton.disabled =
            loading;

    }

}


/* =========================================================
   TECHNICIAN HEADER AVATAR
   ========================================================= */

function updateTechnicianHeaderAvatar(profile) {

    const avatar =
        document.getElementById(
            "techUserAvatar"
        );

    if (!avatar) {
        return;
    }


    const imageUrl =
        profile?.profile_image_url || "";


    if (imageUrl) {

        avatar.src = imageUrl;

        avatar.alt =
            profile?.full_name ||
            "Technician";

        avatar.style.display = "block";

        return;
    }


    /*
     * No profile image:
     * use initials avatar through CSS/data.
     */

    const initials =
        getTechnicianInitials(
            profile?.full_name
        );


    avatar.removeAttribute("src");

    avatar.alt =
        profile?.full_name ||
        "Technician";


    avatar.style.display =
        "flex";


    avatar.style.objectFit =
        "cover";


    avatar.style.background =
        "#eef2ff";


    avatar.style.color =
        "#4f46e5";


    avatar.style.fontSize =
        "14px";


    avatar.style.fontWeight =
        "700";


    avatar.style.alignItems =
        "center";


    avatar.style.justifyContent =
        "center";


    /*
     * IMG element cannot directly display
     * text initials, so use a generated SVG.
     */

    const svg =
        `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
            viewBox="0 0 100 100"
        >
            <rect
                width="100"
                height="100"
                rx="50"
                fill="#eef2ff"
            />

            <text
                x="50"
                y="55"
                text-anchor="middle"
                dominant-baseline="middle"
                fill="#4f46e5"
                font-size="30"
                font-family="Arial, sans-serif"
                font-weight="700"
            >
                ${escapeSvgText(initials)}
            </text>
        </svg>
        `;


    avatar.src =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg);

}

function escapeSvgText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}

async function loadTechnicianHeaderProfile() {

    try {

        const result =
            await api("profile");

        const profile =
            result?.profile;

        if (!profile) {
            return;
        }

        updateTechnicianHeaderAvatar(
            profile
        );

    } catch (error) {

        console.error(
            "Technician header profile load failed:",
            error
        );

    }

}

/* =========================================================
   TECHNICIAN PROFILE PHOTO - INITIALS
   ========================================================= */

function getTechnicianInitials(name) {

    const value =
        String(name || "")
            .trim();

    if (!value) {
        return "T";
    }

    const parts =
        value
            .split(/\s+/)
            .filter(Boolean);

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


/* =========================================================
   PROFILE PHOTO - FILE SELECTED
   ========================================================= */

async function handleTechnicianProfilePhotoSelected(event) {

    const input =
        event.currentTarget;

    const file =
        input?.files?.[0];

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        alert(
            "Please select a JPG, PNG or WebP image."
        );

        input.value = "";
        return;
    }

    if (
        file.size >
        5 * 1024 * 1024
    ) {

        alert(
            "Profile photo must be 5 MB or smaller."
        );

        input.value = "";
        return;
    }


    /*
     * Crop modal will be opened here
     * in the next part of Step 4.
     */

    await openTechnicianPhotoCropper(
        file
    );

    input.value = "";
}


/* =========================================================
   PROFILE PHOTO - REMOVE
   ========================================================= */

async function handleTechnicianProfilePhotoRemove() {

    const confirmed =
        window.confirm(
            "Are you sure you want to remove your profile photo?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const button =
            document.getElementById(
                "removeTechnicianPhotoBtn"
            );

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Removing...";
        }


        /*
         * api() currently sends JSON.
         *
         * Profile-photo Edge Function uses
         * multipart/form-data, so upload/remove
         * will use a dedicated request helper.
         *
         * This will be connected in the next part.
         */

        await removeTechnicianProfilePhoto();


        await loadProfile();

    } catch (error) {

        console.error(
            "Technician profile photo removal failed:",
            error
        );

        alert(
            error?.message ||
            "Profile photo could not be removed."
        );
    }
}

async function loadHistory() {

    jobs.innerHTML = `
        <div class="tech-loading-message">
            Loading service history...
        </div>
    `;

    detail.innerHTML = "";

    const result = await api("history");

    const history = Array.isArray(result?.history)
        ? result.history
        : [];

    if (!history.length) {

        jobs.innerHTML = `
            <section class="tech-detail-card">

                <div class="tech-detail-body">

                    <div class="tech-empty-state">

                        <i class="fa-solid fa-clock-rotate-left"></i>

                        <h3>
                            No Service History
                        </h3>

                        <p>
                            You have no completed appointments yet.
                        </p>

                    </div>

                </div>

            </section>
        `;

        return;
    }


    jobs.innerHTML = `

        <section class="tech-section">

            <div class="tech-section-header">

                <div>
                    <p class="tech-section-kicker">
                        SERVICE RECORD
                    </p>

                    <h2 class="tech-section-title">
                        Service History
                    </h2>
                </div>

                <span class="tech-section-count">
                    ${history.length}
                </span>

            </div>


            <div class="tech-job-list">

                ${history.map(a => `

                    <article
    class="tech-job-card"
    data-id="${esc(a.id)}"
    data-history="true"
>

                        <div class="tech-job-header">

                            <div>

                                <p class="tech-job-label">
                                    APPOINTMENT
                                </p>

                                <h3 class="tech-job-title">
                                    ${esc(a.appointment_id || "Appointment")}
                                </h3>

                            </div>

                            <span class="tech-status-badge tech-status-completed">
                                Completed
                            </span>

                        </div>


                        <div class="tech-job-body">

                            <div>
                                <span>Customer</span>
                                <strong>
                                    ${esc(a.customer_name || "—")}
                                </strong>
                            </div>

                            <div>
                                <span>Service</span>
                                <strong>
                                    ${esc(
                                        formatServiceType(
                                            a.service_category
                                        )
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Date</span>
                                <strong>
                                    ${formatDate(a.appointment_date)}
                                </strong>
                            </div>

                            <div>
                                <span>Job ID</span>
                                <strong>
                                    ${esc(a.job_code || "—")}
                                </strong>
                            </div>

                        </div>

                    </article>

                `).join("")}

            </div>

        </section>
    `;

    detail.innerHTML = "";
}

async function loadSupport() {

    jobs.innerHTML = `
        <div class="tech-loading-message">
            Loading support...
        </div>
    `;

    detail.innerHTML = "";

    const result = await api("support");

    const support = result?.support;

    if (!support) {
        throw new Error("Support information was not returned.");
    }

    const company = support.company || {};
    const contact = support.contact || {};
    const channels = support.channels || {};

    jobs.innerHTML = `

        <section class="tech-detail-card">

            <div class="tech-detail-header">

                <div>

                    <p class="tech-detail-label">
                        TECHNICIAN SUPPORT
                    </p>

                    <h2 class="tech-detail-title">
                        Support Center
                    </h2>

                </div>

                <div class="tech-summary-main-icon">
                    <i class="fa-solid fa-circle-question"></i>
                </div>

            </div>


            <div class="tech-detail-body">

                <div class="tech-detail-section">

                    <h3>
                        Company Support
                    </h3>

                    <p class="tech-detail-description">
                        Need help with your technician account,
                        assigned service, or portal access?
                        Contact Click &amp; Fix Technologies.
                    </p>

                </div>


                <div class="tech-detail-section">

                    <h3>
                        Contact
                    </h3>

                    <div class="tech-detail-info-grid">

                        <div>
                            <span>Company</span>
                            <strong>
                                ${esc(company.name || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Phone</span>
                            <strong>
                                ${esc(contact.phone || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Email</span>
                            <strong>
                                ${esc(contact.email || "—")}
                            </strong>
                        </div>

                    </div>

                </div>


                <div class="tech-detail-section">

                    <h3>
                        Contact Support
                    </h3>

                    <div class="tech-action-row">

                        <a
                            class="tech-action-button"
                            href="${esc(channels.phone || "#")}"
                        >
                            <i class="fa-solid fa-phone"></i>
                            Call
                        </a>


                        <a
                            class="tech-action-button"
                            href="${esc(channels.whatsapp || "#")}"
                            target="_blank"
                            rel="noopener"
                        >
                            <i class="fa-brands fa-whatsapp"></i>
                            WhatsApp
                        </a>


                        <a
                            class="tech-action-button"
                            href="${esc(channels.email || "#")}"
                        >
                            <i class="fa-solid fa-envelope"></i>
                            Email
                        </a>

                    </div>

                </div>

            </div>

        </section>
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

/* =========================================================
   TECHNICIAN HEADER USER AREA -> PROFILE
   ========================================================= */

const techUserName =
    document.getElementById("techUserName");

const techUserAvatar =
    document.getElementById("techUserAvatar");

const techProfileNav =
    document.querySelector(
        '[data-nav="profile"]'
    );


function openTechnicianProfile() {

    if (techProfileNav) {
        techProfileNav.click();
    }

}


/* =========================================================
   TECHNICIAN NAME
   ========================================================= */

if (techUserName) {

    techUserName.style.cursor = "pointer";

    techUserName.addEventListener(
        "click",
        openTechnicianProfile
    );

    techUserName.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                openTechnicianProfile();

            }

        }
    );

}


/* =========================================================
   TECHNICIAN PROFILE IMAGE
   ========================================================= */

if (techUserAvatar) {

    techUserAvatar.style.cursor = "pointer";

    techUserAvatar.addEventListener(
        "click",
        openTechnicianProfile
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

        item.addEventListener("click", async () => {

            document
                .querySelectorAll(".tech-nav-item")
                .forEach(nav => {
                    nav.classList.remove("active");
                });

            item.classList.add("active");

            closeTechnicianMenu();

            const nav = item.dataset.nav;

            try {

                if (nav === "dashboard") {
                    await load();
                    return;
                }

                if (nav === "profile") {
                    await loadProfile();
                    return;
                }

                if (nav === "history") {
                    await loadHistory();
                    return;
                }

                if (nav === "support") {
                    await loadSupport();
                    return;
                }

            } catch (error) {

                console.error(
                    `Technician ${nav} view failed:`,
                    error
                );

                jobs.innerHTML = `
                    <div class="tech-error-message">
                        ${esc(
                            error?.message ||
                            "Unable to load this section."
                        )}
                    </div>
                `;

                detail.innerHTML = "";

            }

        });

    });