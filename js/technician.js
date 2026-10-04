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
   SUPPORT CHAT REALTIME
   PHASE 5C
   ========================================================= */

let supportChatRealtimeChannel = null;

let supportChatRealtimeRequestId = null;

let supportChatRealtimeReady = false;

let supportChatRealtimePending = [];

let supportUnreadRealtimeChannel = null;

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

const isHistory =
    card.dataset.history === "true";

console.log(
    "Opening technician appointment:",
    id,
    isHistory ? "(READ-ONLY HISTORY)" : ""
);

loadDetail(
    id,
    isHistory
);

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

<!-- =================================================
                     CHANGE PASSWORD
                     ================================================= -->

                <div class="tech-detail-section tech-password-section">

                    <h3>
                        Change Password
                    </h3>

                    <p class="tech-password-help">
                        Update your technician portal password.
                        Your current password is not required.
                    </p>


                    <div class="tech-password-form">


                        <!-- NEW PASSWORD -->

                        <div class="tech-password-field">

                            <label
                                for="technicianNewPassword"
                            >
                                New Password
                            </label>

                            <div class="tech-password-input-wrap">

                                <input
                                    type="password"
                                    id="technicianNewPassword"
                                    class="tech-input"
                                    autocomplete="new-password"
                                    minlength="6"
                                    placeholder="Enter new password"
                                >

                                <button
                                    type="button"
                                    class="tech-password-toggle"
                                    data-password-target="technicianNewPassword"
                                    aria-label="Show password"
                                    title="Show password"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>

                            </div>

                        </div>


                        <!-- CONFIRM PASSWORD -->

                        <div class="tech-password-field">

                            <label
                                for="technicianConfirmPassword"
                            >
                                Confirm New Password
                            </label>

                            <div class="tech-password-input-wrap">

                                <input
                                    type="password"
                                    id="technicianConfirmPassword"
                                    class="tech-input"
                                    autocomplete="new-password"
                                    minlength="6"
                                    placeholder="Confirm new password"
                                >

                                <button
                                    type="button"
                                    class="tech-password-toggle"
                                    data-password-target="technicianConfirmPassword"
                                    aria-label="Show password"
                                    title="Show password"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>

                            </div>

                        </div>


                        <!-- PASSWORD MESSAGE -->

                        <p
                            id="technicianPasswordMessage"
                            class="tech-password-message"
                            aria-live="polite"
                        ></p>


                        <!-- CHANGE BUTTON -->

                        <button
                            type="button"
                            id="changeTechnicianPasswordBtn"
                            class="tech-action-button tech-password-change-btn"
                        >
                            <i class="fa-solid fa-key"></i>
                            Change Password
                        </button>

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


    /* =========================================================
       CHANGE PASSWORD EVENTS
       ========================================================= */

    const newPasswordInput =
        document.getElementById(
            "technicianNewPassword"
        );

    const confirmPasswordInput =
        document.getElementById(
            "technicianConfirmPassword"
        );

    const changePasswordButton =
        document.getElementById(
            "changeTechnicianPasswordBtn"
        );

    const passwordMessage =
        document.getElementById(
            "technicianPasswordMessage"
        );


    /* =========================================================
       PASSWORD SHOW / HIDE
       ========================================================= */

    document
        .querySelectorAll(
            ".tech-password-toggle"
        )
        .forEach(toggleButton => {

            toggleButton.addEventListener(
                "click",
                () => {

                    const targetId =
                        toggleButton.dataset
                            .passwordTarget;

                    const input =
                        document.getElementById(
                            targetId
                        );

                    if (!input) {
                        return;
                    }


                    const icon =
                        toggleButton.querySelector(
                            "i"
                        );


                    if (
                        input.type ===
                        "password"
                    ) {

                        input.type =
                            "text";

                        toggleButton.setAttribute(
                            "aria-label",
                            "Hide password"
                        );

                        toggleButton.setAttribute(
                            "title",
                            "Hide password"
                        );

                        if (icon) {

                            icon.className =
                                "fa-solid fa-eye-slash";

                        }

                    } else {

                        input.type =
                            "password";

                        toggleButton.setAttribute(
                            "aria-label",
                            "Show password"
                        );

                        toggleButton.setAttribute(
                            "title",
                            "Show password"
                        );

                        if (icon) {

                            icon.className =
                                "fa-solid fa-eye";

                        }

                    }

                }
            );

        });


    /* =========================================================
       CHANGE PASSWORD
       ========================================================= */

    if (changePasswordButton) {

        changePasswordButton.addEventListener(
            "click",
            async () => {

                const newPassword =
                    String(
                        newPasswordInput?.value ||
                        ""
                    );

                const confirmPassword =
                    String(
                        confirmPasswordInput?.value ||
                        ""
                    );


                if (passwordMessage) {

                    passwordMessage.textContent =
                        "";

                    passwordMessage.className =
                        "tech-password-message";

                }


                /* ---------------------------------------------
                   EMPTY CHECK
                   --------------------------------------------- */

                if (!newPassword) {

                    showTechnicianPasswordMessage(
                        "Please enter a new password.",
                        "error"
                    );

                    newPasswordInput?.focus();

                    return;
                }


                /* ---------------------------------------------
                   MINIMUM LENGTH
                   --------------------------------------------- */

                if (newPassword.length < 6) {

                    showTechnicianPasswordMessage(
                        "Password must be at least 6 characters long.",
                        "error"
                    );

                    newPasswordInput?.focus();

                    return;
                }


                /* ---------------------------------------------
                   CONFIRM PASSWORD
                   --------------------------------------------- */

                if (!confirmPassword) {

                    showTechnicianPasswordMessage(
                        "Please confirm your new password.",
                        "error"
                    );

                    confirmPasswordInput?.focus();

                    return;
                }


                /* ---------------------------------------------
                   PASSWORD MATCH
                   --------------------------------------------- */

                if (
                    newPassword !==
                    confirmPassword
                ) {

                    showTechnicianPasswordMessage(
                        "New password and confirm password do not match.",
                        "error"
                    );

                    confirmPasswordInput?.focus();

                    return;
                }


                /* ---------------------------------------------
                   LOADING STATE
                   --------------------------------------------- */

                changePasswordButton.disabled =
                    true;

                changePasswordButton.innerHTML = `
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Updating Password...
                `;


                try {

                    if (!sb) {

                        throw new Error(
                            "Technician portal is not configured."
                        );

                    }


                    /* -----------------------------------------
                       SUPABASE AUTH PASSWORD UPDATE

                       Existing authenticated session
                       is used automatically.
                       ----------------------------------------- */

                    const {
                        data,
                        error
                    } =
                        await sb.auth.updateUser({
                            password:
                                newPassword
                        });


                    if (error) {

                        console.error(
                            "SUPABASE PASSWORD UPDATE ERROR:",
                            error
                        );

                        throw error;

                    }


                    if (!data?.user) {

                        throw new Error(
                            "Password could not be updated."
                        );

                    }


                    /* -----------------------------------------
                       SUCCESS
                       ----------------------------------------- */

                    showTechnicianPasswordMessage(
                        "Password changed successfully.",
                        "success"
                    );


                    newPasswordInput.value =
                        "";

                    confirmPasswordInput.value =
                        "";


                    /* -----------------------------------------
                       SESSION MAINTENANCE

                       Supabase keeps the current authenticated
                       session. We intentionally do not sign
                       the technician out.
                       ----------------------------------------- */

                    console.log(
                        "Technician password changed successfully."
                    );


                } catch (error) {

                    console.error(
                        "Technician password change failed:",
                        error
                    );


                    let message =
                        error?.message ||
                        "Password could not be changed.";


                    /* -----------------------------------------
                       EXPIRED / INVALID SESSION
                       ----------------------------------------- */

                    const lowerMessage =
                        String(message)
                            .toLowerCase();


                    if (
                        lowerMessage.includes(
                            "session"
                        ) ||
                        lowerMessage.includes(
                            "jwt"
                        ) ||
                        lowerMessage.includes(
                            "token"
                        ) ||
                        lowerMessage.includes(
                            "not authenticated"
                        )
                    ) {

                        message =
                            "Your session has expired. Please sign in again.";

                    }


                    showTechnicianPasswordMessage(
                        message,
                        "error"
                    );


                } finally {

                    changePasswordButton.disabled =
                        false;

                    changePasswordButton.innerHTML = `
                        <i class="fa-solid fa-key"></i>
                        Change Password
                    `;

                }

            }
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

/* =========================================================
   TECHNICIAN PASSWORD MESSAGE
   ========================================================= */

function showTechnicianPasswordMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "technicianPasswordMessage"
        );

    if (!element) {
        return;
    }


    element.textContent =
        String(message || "");


    element.className =
        `tech-password-message tech-password-message-${type}`;

}

async function loadHistory() {

    jobs.innerHTML = `
        <div class="tech-loading-message">
            Loading service history...
        </div>
    `;

    detail.innerHTML = "";

    try {

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

                    <span
                        class="tech-section-count"
                        id="historyCount"
                    >
                        ${history.length}
                    </span>

                </div>


                <!-- HISTORY SEARCH -->

                <div class="tech-history-search">

                    <div class="tech-history-search-box">

                        <i class="fa-solid fa-magnifying-glass"></i>

                        <input
                            id="historySearchInput"
                            type="search"
                            autocomplete="off"
                            placeholder="Search by name, phone, appointment ID or Job ID"
                            aria-label="Search service history"
                        >

                        <button
                            id="historySearchClear"
                            type="button"
                            class="tech-history-search-clear"
                            aria-label="Clear search"
                            title="Clear search"
                            hidden
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>

                    </div>

                </div>


                <div
                    class="tech-job-list"
                    id="historyJobList"
                >

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
                                        ${esc(
                                            a.appointment_id ||
                                            "Appointment"
                                        )}
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
                                        ${esc(
                                            a.customer_name ||
                                            "—"
                                        )}
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
                                        ${formatDate(
                                            a.appointment_date
                                        )}
                                    </strong>
                                </div>


                                <div>
                                    <span>Job ID</span>

                                    <strong>
                                        ${esc(
                                            a.job_code ||
                                            "—"
                                        )}
                                    </strong>
                                </div>

                            </div>

                        </article>

                    `).join("")}

                </div>


                <!-- NO SEARCH RESULT -->

                <div
                    id="historyNoResults"
                    class="tech-empty-state"
                    style="display:none;"
                >

                    <i class="fa-solid fa-magnifying-glass"></i>

                    <h3>
                        No Matching History
                    </h3>

                    <p>
                        No completed service matches your search.
                    </p>

                </div>

            </section>
        `;


        detail.innerHTML = "";


        /* =====================================================
           HISTORY SEARCH
           ===================================================== */

        const searchInput =
            document.getElementById(
                "historySearchInput"
            );

        const clearButton =
            document.getElementById(
                "historySearchClear"
            );

        const historyJobList =
            document.getElementById(
                "historyJobList"
            );

        const historyNoResults =
            document.getElementById(
                "historyNoResults"
            );

        const historyCount =
            document.getElementById(
                "historyCount"
            );


        function performHistorySearch() {

            const query =
                String(
                    searchInput?.value || ""
                )
                .trim()
                .toLowerCase();


            const cards =
                historyJobList?.querySelectorAll(
                    ".tech-job-card"
                ) || [];


            let visibleCount = 0;


            cards.forEach(card => {

                const appointment =
                    card.querySelector(
                        ".tech-job-title"
                    )?.textContent || "";


                const customer =
                    card.querySelector(
                        ".tech-job-body div:nth-child(1) strong"
                    )?.textContent || "";


                const jobId =
                    card.querySelector(
                        ".tech-job-body div:nth-child(4) strong"
                    )?.textContent || "";


                const phone =
                    history.find(
                        item =>
                            String(item.id) ===
                            String(card.dataset.id)
                    )?.mobile || "";


                const searchableText = [

                    appointment,
                    customer,
                    phone,
                    jobId

                ]
                .join(" ")
                .toLowerCase();


                const matched =
                    !query ||
                    searchableText.includes(query);


                card.style.display =
                    matched
                        ? ""
                        : "none";


                if (matched) {
                    visibleCount++;
                }

            });


            if (historyCount) {

                historyCount.textContent =
                    visibleCount;

            }


            if (historyNoResults) {

                historyNoResults.style.display =
                    visibleCount === 0
                        ? ""
                        : "none";

            }


            if (clearButton) {

                clearButton.hidden =
                    !query;

            }

        }


        searchInput?.addEventListener(
            "input",
            performHistorySearch
        );


        clearButton?.addEventListener(
            "click",
            () => {

                if (!searchInput) {
                    return;
                }

                searchInput.value = "";

                performHistorySearch();

                searchInput.focus();

            }
        );

    } catch (error) {

        console.error(
            "Technician history load failed:",
            error
        );

        jobs.innerHTML = `

            <div class="tech-error-message">
                ${esc(error.message)}
            </div>

        `;

    }
}

/* =========================================================
   TECHNICIAN SUPPORT CENTER
   PHASE 2B + PHASE 5
   SUPPORT CENTER UI
   ========================================================= */

async function loadSupport() {

    jobs.innerHTML = `

        <section class="tech-support-center">


            <!-- =================================================
                 HERO
                 ================================================= -->

            <div class="tech-support-hero">

                <div class="tech-support-hero-icon">
                    <i class="fa-solid fa-headset"></i>
                </div>


                <div class="tech-support-hero-content">

                    <p class="tech-support-eyebrow">
                        TECHNICAL SUPPORT
                    </p>

                    <h2>
                        Need help with a service?
                    </h2>

                    <p>
                        Get quick assistance from Click &amp; Fix Technologies.
                    </p>

                    <span>
                        We’re here whenever you need support — during or after your job.
                    </span>

                </div>

            </div>



            <!-- =================================================
                 MAIN SUPPORT ACTIONS
                 ================================================= -->

            <div class="tech-support-grid">


                <!-- =================================================
                     RAISE A REQUEST
                     ================================================= -->

                <button
                    type="button"
                    class="tech-support-card tech-support-card-primary"
                    id="raiseSupportRequest"
                >

                    <div class="tech-support-card-icon">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                    </div>


                    <div class="tech-support-card-content">

                        <h3>
                            Raise a Request
                        </h3>

                        <p>
                            Report an issue or get technical help
                            for your service.
                        </p>

                        <span class="tech-support-card-link">

                            Create Request

                            <i class="fa-solid fa-arrow-right"></i>

                        </span>

                    </div>

                </button>



                <!-- =================================================
                     SUPPORT CHAT
                     ================================================= -->

                <button
                    type="button"
                    class="tech-support-card"
                    id="openSupportChat"
                >

                    <div class="tech-support-card-icon">
                        <i class="fa-solid fa-comments"></i>
                    </div>


                    <div class="tech-support-card-content">

                        <h3>
                            Support Chat
                        </h3>

                        <p>
                            Chat with our team instantly
                            for quick assistance.
                        </p>

                        <span class="tech-support-card-link">

                            Start Chat

                            <i class="fa-solid fa-arrow-right"></i>

                        </span>

                    </div>

                </button>



                <!-- =================================================
                     MY REQUESTS
                     ================================================= -->

                <button
                    type="button"
                    class="tech-support-card"
                    id="openMySupportRequests"
                >

                    <div class="tech-support-card-icon">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>


                    <div class="tech-support-card-content">

                        <h3>
                            My Requests
                        </h3>

                        <p>
                            View your past requests, status
                            and conversations.
                        </p>

                        <span class="tech-support-card-link">

                            View Requests

                            <i class="fa-solid fa-arrow-right"></i>

                        </span>

                    </div>

                </button>



                <!-- =================================================
                     CONTACT SUPPORT
                     ================================================= -->

                <button
                    type="button"
                    class="tech-support-card"
                    id="openCompanySupport"
                >

                    <div class="tech-support-card-icon">
                        <i class="fa-solid fa-phone-volume"></i>
                    </div>


                    <div class="tech-support-card-content">

                        <h3>
                            Contact Support
                        </h3>

                        <p>
                            Get help directly from
                            our team.
                        </p>

                        <span class="tech-support-card-link">

                            Get in Touch

                            <i class="fa-solid fa-arrow-right"></i>

                        </span>

                    </div>

                </button>


            </div>

            <!-- =================================================
                 COMPANY CONTACT
                 ================================================= -->

            <div
                class="tech-support-contact"
                id="supportContactPanel"
            >


                <div class="tech-support-contact-main">


                    <div class="tech-support-contact-icon">

                        <i class="fa-solid fa-headset"></i>

                    </div>


                    <div>

                        <p>
                            STILL NEED HELP?
                        </p>

                        <h3>
                            Talk to Click &amp; Fix
                        </h3>

                        <span>
                            Your support number is hidden
                            until you choose to reveal it.
                        </span>

                    </div>


                </div>



                <div class="tech-support-contact-actions">


                    <!-- =================================================
                         REVEAL PHONE
                         ================================================= -->

                    <button
                        type="button"
                        class="tech-support-contact-button"
                        id="revealSupportPhone"
                    >

                        <i class="fa-solid fa-phone"></i>

                        Speak to Click &amp; Fix

                    </button>



                    <!-- =================================================
                         WHATSAPP
                         ================================================= -->

                    <a
                        href="https://wa.me/917098889990"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="tech-support-whatsapp-button"
                    >

                        <i class="fa-brands fa-whatsapp"></i>

                        WhatsApp

                    </a>


                </div>



                <!-- =================================================
                     HIDDEN PHONE
                     IMPORTANT:
                     Do NOT use hidden attribute.
                     CSS class controls visibility.
                     ================================================= -->

                <div
                    class="tech-support-phone-revealed is-hidden"
                    id="supportPhoneRevealed"
                >

                    <div>

                        <span>
                            Contact Number
                        </span>

                        <a href="tel:+917098889990">
                            +91 70988 89990
                        </a>

                    </div>

                </div>


            </div>


        </section>

    `;



    /* =========================================================
       SUPPORT CHAT
       PHASE 5B
       ========================================================= */

    document
        .getElementById("openSupportChat")
        ?.addEventListener(
            "click",
            async () => {

                await openSupportChat();

            }
        );



    /* =========================================================
       RAISE SUPPORT REQUEST
       ========================================================= */

    document
        .getElementById("raiseSupportRequest")
        ?.addEventListener(
            "click",
            () => {

                openRaiseSupportRequestModal();

            }
        );



    /* =========================================================
       MY SUPPORT REQUESTS
       PHASE 4B
       ========================================================= */

    document
        .getElementById("openMySupportRequests")
        ?.addEventListener(
            "click",
            async () => {

                await loadMySupportRequests();

            }
        );



    /* =========================================================
       CONTACT SUPPORT
       ========================================================= */

    document
        .getElementById("openCompanySupport")
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById("supportContactPanel")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

            }
        );

    /* =========================================================
   REVEAL SUPPORT PHONE
   ========================================================= */

document
    .getElementById("revealSupportPhone")
    ?.addEventListener(
        "click",
        () => {

            const phone =
                document.getElementById(
                    "supportPhoneRevealed"
                );

            const button =
                document.getElementById(
                    "revealSupportPhone"
                );


            if (!phone || !button) {

                return;

            }


            /* -----------------------------------------
               CHECK CURRENT STATE
               ----------------------------------------- */

            const isHidden =
                phone.classList.contains(
                    "is-hidden"
                );


            /* -----------------------------------------
               SHOW PHONE
               ----------------------------------------- */

            if (isHidden) {

                phone.classList.remove(
                    "is-hidden"
                );


                /* CHANGE BUTTON COLOR */

                button.classList.add(
                    "is-revealed"
                );


                button.innerHTML = `

                    <i class="fa-solid fa-phone"></i>

                    Hide Number

                `;


                button.setAttribute(
                    "aria-label",
                    "Hide Click and Fix Support Number"
                );


            }


            /* -----------------------------------------
               HIDE PHONE
               ----------------------------------------- */

            else {

                phone.classList.add(
                    "is-hidden"
                );


                /* RESTORE BUTTON COLOR */

                button.classList.remove(
                    "is-revealed"
                );


                button.innerHTML = `

                    <i class="fa-solid fa-phone"></i>

                    Speak to Click &amp; Fix

                `;


                button.setAttribute(
                    "aria-label",
                    "Reveal Click and Fix Support Number"
                );

            }

        }
    );
}

/* =========================================================
   PHASE 2B
   RAISE SUPPORT REQUEST MODAL
   UI ONLY
   ========================================================= */

function openRaiseSupportRequestModal() {

    const existing =
        document.getElementById(
            "raiseSupportRequestModal"
        );

    if (existing) {
        existing.remove();
    }


    const overlay =
        document.createElement("div");

    overlay.id =
        "raiseSupportRequestModal";

    overlay.className =
        "tech-support-modal";


    overlay.innerHTML = `

        <div
            class="tech-support-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="raiseSupportTitle"
        >

            <!-- HEADER -->

            <div class="tech-support-modal-header">

                <div>

                    <p class="tech-support-modal-eyebrow">
                        TECHNICIAN SUPPORT
                    </p>

                    <h2 id="raiseSupportTitle">
                        Raise Support Request
                    </h2>

                    <p>
                        Tell us what help you need with your service.
                    </p>

                </div>


                <button
                    type="button"
                    class="tech-support-modal-close"
                    id="closeRaiseSupportModal"
                    aria-label="Close"
                >

                    <i class="fa-solid fa-xmark"></i>

                </button>

            </div>


            <!-- BODY -->

            <div class="tech-support-modal-body">


                <!-- JOB -->

                <div class="tech-support-form-group">

                    <label for="supportJobSelect">
                        Select Service / Job
                        <span>*</span>
                    </label>

                    <select
                        id="supportJobSelect"
                        class="tech-support-form-control"
                    >

                        <option value="">
                            Select your assigned service
                        </option>

                    </select>

                    <small>
                        Your assigned service will be available here.
                    </small>

                </div>


                <!-- CUSTOMER PREVIEW -->

                <div
                    class="tech-support-job-preview"
                    id="supportJobPreview"
                    hidden
                >

                    <div class="tech-support-job-preview-header">

                        <i class="fa-solid fa-briefcase"></i>

                        <strong>
                            Selected Service
                        </strong>

                    </div>


                    <div class="tech-support-job-preview-grid">

                        <div>

                            <span>
                                Customer
                            </span>

                            <strong
                                id="supportPreviewCustomer"
                            >
                                —
                            </strong>

                        </div>


                        <div>

                            <span>
                                Mobile
                            </span>

                            <strong
                                id="supportPreviewMobile"
                            >
                                —
                            </strong>

                        </div>


                        <div>

                            <span>
                                Service
                            </span>

                            <strong
                                id="supportPreviewService"
                            >
                                —
                            </strong>

                        </div>


                        <div>

                            <span>
                                Appointment
                            </span>

                            <strong
                                id="supportPreviewAppointment"
                            >
                                —
                            </strong>

                        </div>

                    </div>

                </div>


                <!-- SUPPORT TYPE -->

                <div class="tech-support-form-group">

                    <label for="supportTypeSelect">
                        Support Type
                        <span>*</span>
                    </label>

                    <select
                        id="supportTypeSelect"
                        class="tech-support-form-control"
                    >

                        <option value="">
                            Select support type
                        </option>

                        <option value="TECHNICAL_PROBLEM">
                            Technical Problem
                        </option>

                        <option value="APPOINTMENT_JOB">
                            Appointment / Job
                        </option>

                        <option value="CCTV_PROBLEM">
                            CCTV Problem
                        </option>

                        <option value="COMPUTER_LAPTOP">
                            Computer / Laptop
                        </option>

                        <option value="JOB_ID_BILLING">
                            Job ID / Billing
                        </option>

                        <option value="TECHNICIAN_SUPPORT">
                            Technician Support
                        </option>

                        <option value="OTHER">
                            Other
                        </option>

                    </select>

                </div>


                <!-- PROBLEM DETAILS -->

                <div class="tech-support-form-group">

                    <label for="supportProblemDetails">
                        Problem Details
                        <span>*</span>
                    </label>

                    <textarea
                        id="supportProblemDetails"
                        class="tech-support-form-control tech-support-textarea"
                        rows="6"
                        maxlength="2000"
                        placeholder="Describe the problem clearly..."
                    ></textarea>

                    <div class="tech-support-character-count">

                        <span>
                            Please provide enough details
                            for our support team.
                        </span>

                        <strong id="supportProblemCount">
                            0 / 2000
                        </strong>

                    </div>

                </div>


                

                <!-- LOCATION -->

<div class="tech-support-location-box">

    <div class="tech-support-location-icon">

        <i class="fa-solid fa-location-crosshairs"></i>

    </div>


    <div class="tech-support-location-content">

        <strong>
            Current Location
        </strong>

        <span>
            Your current location will be attached
            to this support request.
        </span>


        <div
            class="tech-support-location-status"
            id="supportLocationStatus"
        >

            <i class="fa-solid fa-location-crosshairs"></i>

            <span>
                Detecting your current location...
            </span>

        </div>


        <button
            type="button"
            class="tech-support-location-retry"
            id="retrySupportLocation"
            hidden
        >

            <i class="fa-solid fa-rotate-right"></i>

            Retry Location

        </button>

    </div>

</div>


                <!-- ERROR -->

                <div
                    class="tech-support-form-error"
                    id="supportRequestFormError"
                    hidden
                ></div>


                <!-- ACTIONS -->

                <div class="tech-support-modal-actions">

                    <button
                        type="button"
                        class="tech-support-modal-secondary"
                        id="cancelRaiseSupport"
                    >

                        Cancel

                    </button>


                    <button
                        type="button"
                        class="tech-support-modal-primary"
                        id="submitSupportRequest"
                    >

                        <i class="fa-solid fa-paper-plane"></i>

                        Submit Support Request

                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
    overlay
);

    populatePhase2SupportJobs();

    captureSupportLocation();
    /* =====================================================
       ELEMENTS
       ===================================================== */

    const closeButton =
        document.getElementById(
            "closeRaiseSupportModal"
        );

    const cancelButton =
        document.getElementById(
            "cancelRaiseSupport"
        );

    const problemTextarea =
        document.getElementById(
            "supportProblemDetails"
        );

    const problemCount =
        document.getElementById(
            "supportProblemCount"
        );

    /* =========================================================
   SUBMIT SUPPORT REQUEST
   PHASE 3D
   ========================================================= */

const submitSupportRequest =
    document.getElementById(
        "submitSupportRequest"
    );


if (submitSupportRequest) {

    submitSupportRequest.addEventListener(
        "click",
        async () => {

            const select =
                document.getElementById(
                    "supportJobSelect"
                );

            const supportType =
                document.getElementById(
                    "supportTypeSelect"
                );

            const problemDetails =
                document.getElementById(
                    "supportProblemDetails"
                );

            const errorBox =
                document.getElementById(
                    "supportRequestFormError"
                );

            const modal =
                document.getElementById(
                    "raiseSupportRequestModal"
                );


            /* =================================================
               RESET ERROR
               ================================================= */

            if (errorBox) {

                errorBox.hidden = true;

                errorBox.textContent = "";

            }


            /* =================================================
               READ VALUES
               ================================================= */

            const appointmentId =
                select?.value?.trim() ||
                "";


            const selectedSupportType =
                supportType?.value?.trim() ||
                "";


            const details =
                problemDetails?.value?.trim() ||
                "";


            const latitude =
                Number(
                    modal?.dataset?.latitude
                );


            const longitude =
                Number(
                    modal?.dataset?.longitude
                );


            /* =================================================
               VALIDATION
               ================================================= */

            if (!appointmentId) {

                showSupportRequestError(
                    errorBox,
                    "Please select an assigned service."
                );

                select?.focus();

                return;
            }


            if (!selectedSupportType) {

                showSupportRequestError(
                    errorBox,
                    "Please select a support type."
                );

                supportType?.focus();

                return;
            }


            if (
                !details ||
                details.length < 10
            ) {

                showSupportRequestError(
                    errorBox,
                    "Please provide at least 10 characters describing the problem."
                );

                problemDetails?.focus();

                return;
            }


            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                showSupportRequestError(
                    errorBox,
                    "Current location is required. Please capture your location before submitting."
                );

                captureSupportLocation();

                return;
            }


            if (
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {

                showSupportRequestError(
                    errorBox,
                    "Invalid location detected. Please capture your location again."
                );

                captureSupportLocation();

                return;
            }


            /* =================================================
               LOADING STATE
               ================================================= */

            const originalButtonHTML =
                submitSupportRequest.innerHTML;


            submitSupportRequest.disabled =
                true;


            submitSupportRequest.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Creating Support Request...
            `;


            if (select) {
                select.disabled = true;
            }

            if (supportType) {
                supportType.disabled = true;
            }

            if (problemDetails) {
                problemDetails.disabled = true;
            }


            try {

                /* =============================================
                   REAL BACKEND REQUEST
                   ============================================= */

                const result =
                    await api(
                        "support_create",
                        {
                            appointment_id:
                                appointmentId,

                            support_type:
                                selectedSupportType,

                            problem_details:
                                details,

                            latitude:
                                latitude,

                            longitude:
                                longitude
                        }
                    );


                console.log(
                    "Support request created:",
                    result
                );


                /* =============================================
                   VERIFY RESPONSE
                   ============================================= */

                const support =
                    result?.support;


                if (
                    !support ||
                    !support.id ||
                    !support.support_token
                ) {

                    throw new Error(
                        "Support request was created but the server returned an invalid response."
                    );

                }


                /* =============================================
                   SUCCESS SCREEN
                   ============================================= */

                showSupportRequestSuccessPreview(
                    support,
                    result?.appointment
                );


            } catch (error) {

                console.error(
                    "Support request creation failed:",
                    error
                );


                showSupportRequestError(
                    errorBox,
                    error?.message ||
                    "Unable to create the support request."
                );


                /* =============================================
                   RESTORE FORM
                   ============================================= */

                submitSupportRequest.disabled =
                    false;


                submitSupportRequest.innerHTML =
                    originalButtonHTML;


                if (select) {
                    select.disabled = false;
                }

                if (supportType) {
                    supportType.disabled = false;
                }

                if (problemDetails) {
                    problemDetails.disabled = false;
                }

            }

        }
    );

}


    /* =====================================================
       CLOSE
       ===================================================== */

    const closeModal =
        () => {

            overlay.remove();

            document.removeEventListener(
                "keydown",
                escapeHandler
            );

        };


    const escapeHandler =
        event => {

            if (
                event.key === "Escape"
            ) {
                closeModal();
            }

        };


    closeButton
        ?.addEventListener(
            "click",
            closeModal
        );


    cancelButton
        ?.addEventListener(
            "click",
            closeModal
        );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {
                closeModal();
            }

        }
    );


    document.addEventListener(
        "keydown",
        escapeHandler
    );


    /* =====================================================
       CHARACTER COUNTER
       ===================================================== */

    problemTextarea
        ?.addEventListener(
            "input",
            () => {

                const length =
                    problemTextarea.value.length;

                if (problemCount) {

                    problemCount.textContent =
                        `${length} / 2000`;

                }

            }
        );


    /* =====================================================
       SUBMIT
       PHASE 2B = UI VALIDATION ONLY
       ===================================================== */

    submitButton
        ?.addEventListener(
            "click",
            () => {

                const job =
                    document.getElementById(
                        "supportJobSelect"
                    )?.value
                    ?.trim();


                const type =
                    document.getElementById(
                        "supportTypeSelect"
                    )?.value
                    ?.trim();


                const problem =
                    document.getElementById(
                        "supportProblemDetails"
                    )?.value
                    ?.trim();


                const errorBox =
                    document.getElementById(
                        "supportRequestFormError"
                    );


                if (!job) {

                    showSupportRequestError(
                        errorBox,
                        "Please select the service or job for which you need support."
                    );

                    return;

                }


                if (!type) {

                    showSupportRequestError(
                        errorBox,
                        "Please select a support type."
                    );

                    return;

                }


                if (!problem) {

                    showSupportRequestError(
                        errorBox,
                        "Please describe the problem before submitting the request."
                    );

                    return;

                }


                if (problem.length < 10) {

                    showSupportRequestError(
                        errorBox,
                        "Please provide a little more detail about the problem."
                    );

                    return;

                }


                /*
                 * IMPORTANT:
                 * Phase 2B does NOT send anything to Supabase.
                 *
                 * Phase 3 will replace this section with:
                 *
                 * 1. Appointment validation
                 * 2. GPS capture
                 * 3. support_requests INSERT
                 * 4. support token generation
                 * 5. success screen
                 */

                showSupportRequestSuccessPreview(
                    closeModal
                );

            }
        );

    

}

/* =========================================================
   PHASE 2B
   SUPPORT REQUEST ERROR
   ========================================================= */

function showSupportRequestError(
    errorBox,
    message
) {

    if (!errorBox) {
        return;
    }

    errorBox.hidden = false;

    errorBox.innerHTML = `
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>
            ${esc(message)}
        </span>
    `;

}


/* =========================================================
   SUPPORT REQUEST SUCCESS
   PHASE 3D
   ========================================================= */

function showSupportRequestSuccessPreview(
    support,
    appointment
) {

    const modal =
        document.getElementById(
            "raiseSupportRequestModal"
        );


    if (!modal) {
        return;
    }


    const modalBox =
        modal.querySelector(
            ".tech-support-modal-box"
        );


    if (!modalBox) {
        return;
    }


    const token =
        support?.support_token ||
        "—";


    const status =
        support?.status ||
        "OPEN";


    const customerName =
        appointment?.customer_name ||
        "—";


    const appointmentCode =
        appointment?.appointment_code ||
        "—";


    const supportType =
        support?.support_type ||
        "—";


    modalBox.innerHTML = `

        <div class="tech-support-request-success">

            <div class="tech-support-success-icon">

                <i class="fa-solid fa-circle-check"></i>

            </div>


            <p class="tech-support-modal-eyebrow">
                SUPPORT REQUEST CREATED
            </p>


            <h2>
                Your support request has been submitted
            </h2>


            <p class="tech-support-success-description">
                Our support team can now review your request
                through the technician support system.
            </p>


            <div class="tech-support-token-card">

                <span>
                    SUPPORT TOKEN
                </span>

                <strong>
                    ${esc(token)}
                </strong>

            </div>


            <div class="tech-support-success-details">

                <div>

                    <span>
                        Customer
                    </span>

                    <strong>
                        ${esc(customerName)}
                    </strong>

                </div>


                <div>

                    <span>
                        Appointment
                    </span>

                    <strong>
                        ${esc(appointmentCode)}
                    </strong>

                </div>


                <div>

                    <span>
                        Support Type
                    </span>

                    <strong>
                        ${esc(
                            formatSupportType(
                                supportType
                            )
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Status
                    </span>

                    <strong>
                        ${esc(
                            status
                        )}
                    </strong>

                </div>

            </div>


            <div class="tech-support-success-note">

                <i class="fa-solid fa-location-dot"></i>

                <span>
                    Your current location was attached
                    to this support request.
                </span>

            </div>


            <button
                type="button"
                class="tech-support-modal-primary"
                id="closeSupportSuccess"
            >

                <i class="fa-solid fa-check"></i>

                Done

            </button>

        </div>

    `;


    const closeButton =
        document.getElementById(
            "closeSupportSuccess"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                modal.remove();

            }
        );

    }

}


/* =========================================================
   SUPPORT TYPE LABEL
   ========================================================= */

function formatSupportType(
    type
) {

    const labels = {

        TECHNICAL_PROBLEM:
            "Technical Problem",

        APPOINTMENT_JOB:
            "Appointment / Job",

        CCTV_PROBLEM:
            "CCTV Problem",

        COMPUTER_LAPTOP:
            "Computer / Laptop",

        JOB_ID_BILLING:
            "Job ID / Billing",

        TECHNICIAN_SUPPORT:
            "Technician Support",

        OTHER:
            "Other"

    };


    return (
        labels[type] ||
        String(type || "")
            .replaceAll(
                "_",
                " "
            )
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            )
    );

}

/* =========================================================
   POPULATE SUPPORT JOBS
   PHASE 3B
   ========================================================= */

async function populatePhase2SupportJobs() {

    const select =
        document.getElementById(
            "supportJobSelect"
        );

    const preview =
        document.getElementById(
            "supportJobPreview"
        );


    if (!select) {

        console.error(
            "Support job select element not found."
        );

        return;
    }


    /* =====================================================
       RESET
       ===================================================== */

    select.disabled = true;

    select.innerHTML = `
        <option value="">
            Loading assigned services...
        </option>
    `;


    if (preview) {

        preview.hidden = true;

    }


    try {

        /* =================================================
           LOAD ASSIGNED JOBS
           ================================================= */

        const result =
            await api(
                "support_jobs"
            );


        console.log(
            "Support jobs response:",
            result
        );


        const jobs =
            Array.isArray(
                result?.jobs
            )
                ? result.jobs
                : [];


        /* =================================================
           NO JOBS
           ================================================= */

        if (!jobs.length) {

            select.innerHTML = `
                <option value="">
                    No active assigned services found
                </option>
            `;

            select.disabled = true;


            if (preview) {

                preview.hidden = false;

                preview.innerHTML = `
                    <div class="tech-support-job-preview-empty">
                        You currently have no active assigned
                        service available for support.
                    </div>
                `;

            }

            return;
        }


        /* =================================================
           POPULATE DROPDOWN
           ================================================= */

        select.innerHTML = `
            <option value="">
                Select an assigned service
            </option>
        `;


        jobs.forEach(
            (job) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    job.id;


                const date =
                    job.appointment_date
                        ? formatSupportJobDate(
                            job.appointment_date
                        )
                        : "";


                const time =
                    job.appointment_time
                        ? formatSupportJobTime(
                            job.appointment_time
                        )
                        : "";


                option.textContent =
                    [
                        job.appointment_code,
                        job.customer_name,
                        job.service_category,
                        date,
                        time
                    ]
                    .filter(Boolean)
                    .join(" • ");


                option.dataset.job =
                    JSON.stringify(
                        job
                    );


                select.appendChild(
                    option
                );

            }
        );


        select.disabled = false;


        /* =================================================
           JOB SELECTION
           ================================================= */

        select.onchange = () => {

            const selectedOption =
                select.options[
                    select.selectedIndex
                ];


            if (
                !selectedOption ||
                !selectedOption.dataset.job
            ) {

                if (preview) {

                    preview.hidden = true;

                }

                return;
            }


            let job;


            try {

                job =
                    JSON.parse(
                        selectedOption.dataset.job
                    );

            } catch (error) {

                console.error(
                    "Support job data parse failed:",
                    error
                );

                if (preview) {

                    preview.hidden = false;

                    preview.innerHTML = `
                        <div class="tech-support-form-error">
                            Unable to load the selected service.
                        </div>
                    `;

                }

                return;
            }


            renderSupportJobPreview(
                job
            );

        };


    } catch (error) {

        console.error(
            "Support jobs load failed:",
            error
        );


        select.innerHTML = `
            <option value="">
                Unable to load assigned services
            </option>
        `;


        select.disabled = true;


        if (preview) {

            preview.hidden = false;

            preview.innerHTML = `
                <div class="tech-support-form-error">
                    ${esc(
                        error?.message ||
                        "Unable to load assigned services."
                    )}
                </div>
            `;

        }

    }

}


/* =========================================================
   SUPPORT JOB PREVIEW
   ========================================================= */

function renderSupportJobPreview(
    job
) {

    const preview =
    document.getElementById(
        "supportJobPreview"
    );


    if (!preview) {
        return;
    }


    const appointmentCode =
        job.appointment_code ||
        "—";


    const jobCode =
        job.job_code ||
        "Not generated";


    const customerName =
        job.customer_name ||
        "—";


    const mobile =
        job.mobile ||
        "—";


    const category =
        job.service_category ||
        "—";


    const serviceType =
        job.service_type ||
        "—";


    const address =
        job.service_address ||
        "Address not available";


    const status =
        job.status ||
        "—";


    const date =
        job.appointment_date
            ? formatSupportJobDate(
                job.appointment_date
            )
            : "—";


    const time =
        job.appointment_time
            ? formatSupportJobTime(
                job.appointment_time
            )
            : "—";


    preview.innerHTML = `

        <div class="tech-support-job-preview-grid">

            <div class="tech-support-job-preview-item">
                <span>Customer</span>
                <strong>
                    ${esc(customerName)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Mobile</span>
                <strong>
                    ${esc(mobile)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Appointment</span>
                <strong>
                    ${esc(appointmentCode)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Job ID</span>
                <strong>
                    ${esc(jobCode)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Service</span>
                <strong>
                    ${esc(category)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Service Type</span>
                <strong>
                    ${esc(serviceType)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Appointment Date</span>
                <strong>
                    ${esc(date)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Appointment Time</span>
                <strong>
                    ${esc(time)}
                </strong>
            </div>


            <div class="tech-support-job-preview-item">
                <span>Status</span>
                <strong>
                    ${esc(
                        formatSupportJobStatus(
                            status
                        )
                    )}
                </strong>
            </div>


            <div class="tech-support-job-preview-item tech-support-job-preview-full">
                <span>Service Address</span>
                <strong>
                    ${esc(address)}
                </strong>
            </div>

        </div>

    `;
}


/* =========================================================
   SUPPORT GPS LOCATION
   PHASE 3C
   ========================================================= */

function captureSupportLocation() {

    const status =
        document.getElementById(
            "supportLocationStatus"
        );

    const retryButton =
        document.getElementById(
            "retrySupportLocation"
        );


    if (!status) {
        return;
    }


    /* =====================================================
       BROWSER SUPPORT CHECK
       ===================================================== */

    if (
        !navigator.geolocation
    ) {

        status.innerHTML = `
            <i class="fa-solid fa-circle-xmark"></i>

            <span>
                Location is not supported by this browser.
            </span>
        `;


        status.classList.add(
            "error"
        );


        if (retryButton) {
            retryButton.hidden = true;
        }


        return;
    }


    /* =====================================================
       LOADING STATE
       ===================================================== */

    status.classList.remove(
        "success",
        "error"
    );


    status.innerHTML = `
        <i class="fa-solid fa-location-crosshairs"></i>

        <span>
            Detecting your current location...
        </span>
    `;


    if (retryButton) {
        retryButton.hidden = true;
    }


    /* =====================================================
       REQUEST BROWSER LOCATION
       ===================================================== */

    navigator.geolocation.getCurrentPosition(

        (position) => {

            const latitude =
                Number(
                    position.coords.latitude
                );


            const longitude =
                Number(
                    position.coords.longitude
                );


            const accuracy =
                Number(
                    position.coords.accuracy
                );


            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                handleSupportLocationError(
                    "Unable to read your current location."
                );

                return;
            }


            /* =============================================
               STORE LOCATION ON MODAL
               ============================================= */

            const modal =
                document.getElementById(
                    "raiseSupportRequestModal"
                );


            if (modal) {

                modal.dataset.latitude =
                    String(latitude);

                modal.dataset.longitude =
                    String(longitude);

                modal.dataset.accuracy =
                    Number.isFinite(accuracy)
                        ? String(accuracy)
                        : "";

                modal.dataset.locationCaptured =
                    "true";

            }


            /* =============================================
               SUCCESS UI
               ============================================= */

            status.classList.remove(
                "error"
            );


            status.classList.add(
                "success"
            );


            const accuracyText =
                Number.isFinite(accuracy)
                    ? `Accuracy ±${Math.round(accuracy)} m`
                    : "Location captured";


            status.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>

                <span>
                    Location captured successfully.
                    ${esc(accuracyText)}
                </span>
            `;


            if (retryButton) {
                retryButton.hidden = false;
            }


            console.log(
                "Support GPS location captured:",
                {
                    latitude,
                    longitude,
                    accuracy
                }
            );

        },


        (error) => {

            console.error(
                "Support GPS capture failed:",
                error
            );


            const messages = {

                1:
                    "Location permission was denied. Please allow location access.",

                2:
                    "Your current location could not be determined.",

                3:
                    "Location request timed out. Please try again."

            };


            handleSupportLocationError(
                messages[
                    error?.code
                ] ||
                "Unable to capture your current location."
            );

        },


        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );

}

const retrySupportLocation =
    document.getElementById(
        "retrySupportLocation"
    );


if (retrySupportLocation) {

    retrySupportLocation.addEventListener(
        "click",
        () => {

            captureSupportLocation();

        }
    );

}

/* =========================================================
   GPS ERROR HANDLER
   ========================================================= */

function handleSupportLocationError(
    message
) {

    const status =
        document.getElementById(
            "supportLocationStatus"
        );

    const retryButton =
        document.getElementById(
            "retrySupportLocation"
        );


    const modal =
        document.getElementById(
            "raiseSupportRequestModal"
        );


    if (modal) {

        modal.dataset.locationCaptured =
            "false";

        delete modal.dataset.latitude;
        delete modal.dataset.longitude;
        delete modal.dataset.accuracy;

    }


    if (status) {

        status.classList.remove(
            "success"
        );


        status.classList.add(
            "error"
        );


        status.innerHTML = `
            <i class="fa-solid fa-circle-exclamation"></i>

            <span>
                ${esc(message)}
            </span>
        `;

    }


    if (retryButton) {

        retryButton.hidden = false;

    }

}

/* =========================================================
   MY SUPPORT REQUESTS
   PHASE 4B
   LOAD TECHNICIAN SUPPORT REQUEST HISTORY
   ========================================================= */

async function loadMySupportRequests() {

    const supportCenter =
        jobs.querySelector(
            ".tech-support-center"
        );

    if (!supportCenter) {
        return;
    }


    /* =====================================================
       LOADING STATE
       ===================================================== */

    const existingPanel =
        supportCenter.querySelector(
            "#mySupportRequestsPanel"
        );

    if (existingPanel) {

        existingPanel.remove();

    }


    const panel =
        document.createElement(
            "section"
        );

    panel.id =
        "mySupportRequestsPanel";

    panel.className =
        "tech-support-requests-panel";

    panel.innerHTML = `
        <div class="tech-support-requests-loading">

            <i class="fa-solid fa-spinner fa-spin"></i>

            <span>
                Loading your support requests...
            </span>

        </div>
    `;


    supportCenter.appendChild(
        panel
    );


    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    try {

        /* =================================================
           BACKEND REQUEST
           ================================================= */

        const response =
            await api(
                "support_my_requests"
            );


        const requests =
            Array.isArray(
                response?.requests
            )
                ? response.requests
                : [];


        /* =================================================
           EMPTY STATE
           ================================================= */

        if (!requests.length) {

            panel.innerHTML = `

                <div class="tech-support-requests-header">

                    <div>

                        <p class="tech-support-eyebrow">
                            SUPPORT HISTORY
                        </p>

                        <h3>
                            My Support Requests
                        </h3>

                    </div>

                </div>


                <div class="tech-support-empty-state">

                    <div class="tech-support-empty-icon">

                        <i class="fa-solid fa-clipboard-check"></i>

                    </div>

                    <h4>
                        No support requests yet
                    </h4>

                    <p>
                        You have not created any support
                        requests yet.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================================
           REQUEST LIST
           ================================================= */

        panel.innerHTML = `

            <div class="tech-support-requests-header">

                <div>

                    <p class="tech-support-eyebrow">
                        SUPPORT HISTORY
                    </p>

                    <h3>
                        My Support Requests
                    </h3>

                    <p>
                        View the status and details of
                        your submitted support requests.
                    </p>

                </div>

                <div class="tech-support-request-count">

                    ${requests.length}

                    <span>
                        Request${requests.length === 1 ? "" : "s"}
                    </span>

                </div>

            </div>


            <div
                class="tech-support-request-list"
                id="mySupportRequestList"
            ></div>

        `;


        const list =
            panel.querySelector(
                "#mySupportRequestList"
            );


        if (!list) {
            return;
        }


        /* =================================================
           RENDER REQUESTS
           ================================================= */

        requests.forEach(
            (request) => {

                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "tech-support-request-item";


                const status =
                    String(
                        request?.status ||
                        "OPEN"
                    ).toUpperCase();


                const supportType =
                    formatSupportType(
                        request?.support_type
                    );


                const createdAt =
                    formatSupportDate(
                        request?.created_at
                    );


                const problemDetails =
                    String(
                        request?.problem_details ||
                        "No problem description provided."
                    );


                const appointmentReference =
                request?.appointment_reference ||
                request?.appointment_code ||
                "Not linked";


                const supportToken =
                    request?.support_token
                        ? String(
                            request.support_token
                        )
                        : "Unavailable";


                card.innerHTML = `

                    <div class="tech-support-request-top">

                        <div>

                            <span class="tech-support-request-token">
                                ${esc(supportToken)}
                            </span>

                            <span class="tech-support-request-type">
                                ${esc(supportType)}
                            </span>

                        </div>

                        <span
                            class="tech-support-request-status status-${esc(
                                status.toLowerCase()
                            )}"
                        >
                            ${esc(status)}
                        </span>

                    </div>


                    <div class="tech-support-request-body">

                        <p class="tech-support-request-problem">
                            ${esc(problemDetails)}
                        </p>

                    </div>


                    <div class="tech-support-request-meta">

                        <div>

                            <i class="fa-solid fa-calendar-days"></i>

                            <span>
                                ${esc(createdAt)}
                            </span>

                        </div>


                        <div>

                            <i class="fa-solid fa-briefcase"></i>

                            <span>
                                Appointment:
                                ${esc(appointmentReference)}
                            </span>

                        </div>

                    </div>


                    <div class="tech-support-request-actions">

                        ${
                            request?.location_url
                                ? `
                                    <a
                                        href="${esc(
                                            request.location_url
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="tech-support-request-action"
                                    >
                                        <i class="fa-solid fa-location-dot"></i>
                                        View Location
                                    </a>
                                `
                                : ""
                        }


                        <button
                            type="button"
                            class="tech-support-request-action tech-support-request-view"
                            data-support-id="${esc(
                                request?.id || ""
                            )}"
                        >

                            <i class="fa-solid fa-eye"></i>

                            View Details

                        </button>

                    </div>

                `;


                list.appendChild(
                    card
                );


                const viewButton =
                    card.querySelector(
                        ".tech-support-request-view"
                    );


                viewButton?.addEventListener(
    "click",
    async () => {

        await viewSupportRequest(
            request.id
        );

    }
);

            }
        );


    } catch (error) {

        console.error(
            "My Support Requests failed:",
            error
        );


        panel.innerHTML = `

            <div class="tech-support-error-state">

                <div class="tech-support-error-icon">

                    <i class="fa-solid fa-triangle-exclamation"></i>

                </div>

                <h4>
                    Unable to load support requests
                </h4>

                <p>
                    ${esc(
                        error?.message ||
                        "Something went wrong while loading your support requests."
                    )}
                </p>


                <button
                    type="button"
                    class="tech-support-retry-button"
                    id="retryMySupportRequests"
                >

                    <i class="fa-solid fa-rotate-right"></i>

                    Try Again

                </button>

            </div>

        `;


        panel
            .querySelector(
                "#retryMySupportRequests"
            )
            ?.addEventListener(
                "click",
                () => {

                    loadMySupportRequests();

                }
            );

    }

}

/* =========================================================
   VIEW SUPPORT REQUEST
   PHASE 4C
   LOAD FRESH DATA FROM SECURE BACKEND
   ========================================================= */

async function viewSupportRequest(
    requestId
) {

    const id =
        String(
            requestId || ""
        ).trim();

    if (!id) {

        console.error(
            "View Support Request: Missing request ID."
        );

        return;

    }

    /*
     * Show loading state first.
     */
    showMySupportRequestDetailsLoading();


    try {

        const response =
            await api(
                "support_get_request",
                {
                    request_id: id
                }
            );


        const request =
            response?.request;


        if (
            !request ||
            !request.id
        ) {

            throw new Error(
                "Support request details could not be loaded."
            );

        }


        /*
         * Render fresh backend data.
         */
        showMySupportRequestDetails(
            request
        );


    } catch (error) {

        console.error(
            "Support request detail load failed:",
            error
        );


        showMySupportRequestDetailsError(
            error?.message ||
            "Unable to load support request details."
        );

    }

}

/* =========================================================
   SUPPORT REQUEST DETAIL
   LOADING STATE
   ========================================================= */

function showMySupportRequestDetailsLoading() {

    const existing =
        document.getElementById(
            "techSupportRequestModal"
        );

    if (existing) {

        existing.remove();

    }


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "techSupportRequestModal";

    modal.className =
        "tech-support-request-modal";


    modal.innerHTML = `

        <div
            class="tech-support-request-modal-backdrop"
        ></div>


        <div
            class="tech-support-request-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Support request details"
        >

            <div
                class="tech-support-request-modal-header"
            >

                <div>

                    <span
                        class="tech-support-request-modal-eyebrow"
                    >
                        SUPPORT REQUEST
                    </span>

                    <h2>
                        Loading Details
                    </h2>

                </div>


                <button
                    type="button"
                    class="tech-support-request-modal-close"
                    id="closeTechSupportRequestModal"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>


            <div
                class="tech-support-request-modal-body"
            >

                <div
                    class="tech-support-request-loading"
                >

                    <div
                        class="tech-support-request-spinner"
                    ></div>

                    <p>
                        Loading support request details...
                    </p>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    modal
        .querySelector(
            ".tech-support-request-modal-backdrop"
        )
        ?.addEventListener(
            "click",
            () => {
                modal.remove();
            }
        );


    modal
        .querySelector(
            "#closeTechSupportRequestModal"
        )
        ?.addEventListener(
            "click",
            () => {
                modal.remove();
            }
        );

}

/* =========================================================
   SUPPORT REQUEST DETAIL
   ERROR STATE
   ========================================================= */

function showMySupportRequestDetailsError(
    message
) {

    const existing =
        document.getElementById(
            "techSupportRequestModal"
        );

    if (existing) {

        existing.remove();

    }


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "techSupportRequestModal";

    modal.className =
        "tech-support-request-modal";


    modal.innerHTML = `

        <div
            class="tech-support-request-modal-backdrop"
        ></div>


        <div
            class="tech-support-request-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Support request details"
        >

            <div
                class="tech-support-request-modal-header"
            >

                <div>

                    <span
                        class="tech-support-request-modal-eyebrow"
                    >
                        SUPPORT REQUEST
                    </span>

                    <h2>
                        Unable to Load
                    </h2>

                </div>


                <button
                    type="button"
                    class="tech-support-request-modal-close"
                    id="closeTechSupportRequestModal"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>


            <div
                class="tech-support-request-modal-body"
            >

                <div
                    class="tech-support-request-error"
                >

                    <div
                        class="tech-support-request-error-icon"
                    >
                        <i
                            class="fa-solid fa-circle-exclamation"
                        ></i>
                    </div>


                    <h3>
                        Unable to load details
                    </h3>


                    <p>
                        ${esc(
                            message ||
                            "Something went wrong while loading this support request."
                        )}
                    </p>


                    <button
                        type="button"
                        class="tech-support-request-modal-action"
                        id="closeSupportRequestError"
                    >
                        Close
                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    const closeModal =
        () => {

            modal.remove();

        };


    modal
        .querySelector(
            ".tech-support-request-modal-backdrop"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    modal
        .querySelector(
            "#closeTechSupportRequestModal"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    modal
        .querySelector(
            "#closeSupportRequestError"
        )
        ?.addEventListener(
            "click",
            closeModal
        );

}

/* =========================================================
   SUPPORT CHAT REALTIME
   CLEANUP
   ========================================================= */

async function stopSupportChatRealtime() {

    supportChatRealtimeReady = false;

    supportChatRealtimePending = [];

    supportChatRealtimeRequestId = null;

    if (
        supportChatRealtimeChannel
    ) {

        try {

            await sb.removeChannel(
    supportChatRealtimeChannel
);

        } catch (error) {

            console.warn(
                "Support chat realtime cleanup failed:",
                error
            );

        }

        supportChatRealtimeChannel = null;

    }

}



/* =========================================================
   SUPPORT CHAT REALTIME
   SUBSCRIBE + DIAGNOSTICS
   ========================================================= */

async function startSupportChatRealtime(requestId) {

    const id =
        String(requestId || "").trim();

    if (!id) {
        return;
    }

    await stopSupportChatRealtime();

    supportChatRealtimeRequestId = id;
    supportChatRealtimeReady = false;

    const channelName =
        `support-chat-${id}`;

    supportChatRealtimeChannel =
        sb
            .channel(channelName)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "support_messages"
                },
                (payload) => {

                    handleSupportChatRealtimeMessage(
                        payload
                    );

                }
            )
            .subscribe();

}

/* =========================================================
   SUPPORT UNREAD COUNT REALTIME
   ========================================================= */

async function startSupportUnreadRealtime() {

    /*
     * Get currently authenticated technician.
     */
    const {
        data,
        error
    } = await sb.auth.getUser();

    if (error || !data?.user?.id) {
        return;
    }

    const authUserId =
        data.user.id;

    /*
     * Get technician profile ID.
     *
     * support_requests.technician_id
     * uses technicians.id, not auth user id.
     */
    const {
        data: technician,
        error: technicianError
    } = await sb
        .from("technicians")
        .select("id")
        .eq(
            "auth_user_id",
            authUserId
        )
        .maybeSingle();

    if (
        technicianError ||
        !technician?.id
    ) {
        return;
    }

    /*
     * Remove previous unread channel.
     */
    if (supportUnreadRealtimeChannel) {

        try {

            await sb.removeChannel(
                supportUnreadRealtimeChannel
            );

        } catch (error) {
            console.warn(
                "Support unread realtime cleanup failed:",
                error
            );
        }

        supportUnreadRealtimeChannel =
            null;

    }

    const technicianId =
        technician.id;

    const channelName =
        `support-unread-${technicianId}`;

    supportUnreadRealtimeChannel =
        sb
            .channel(channelName)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "support_messages"
                },
                async (payload) => {

                    const message =
                        payload?.new;

                    if (!message?.id) {
                        return;
                    }

                    /*
                     * Only ADMIN messages are unread
                     * for the technician.
                     */
                    const senderType =
                        String(
                            message?.sender_type ||
                            ""
                        ).toUpperCase();

                        if (
                    senderType === "ADMIN"
                    ) {

                    playSupportMessageSound();

                    }

                    if (
                        senderType !== "ADMIN"
                    ) {
                        return;
                    }

                    /*
                     * If the message is already marked
                     * as read, do not increase the badge.
                     */
                    if (
                        message?.read_at_technician
                    ) {
                        return;
                    }

                    await refreshTechnicianSupportUnreadBadge();

                }
            )
            .subscribe();

}

/* =========================================================
   SUPPORT UNREAD COUNT
   REFRESH BADGE FROM SERVER
   ========================================================= */

async function refreshTechnicianSupportUnreadBadge() {

    try {

        const response =
            await api(
                "support_my_requests"
            );

        const totalUnreadCount =
            Math.max(
                0,
                Number(
                    response?.total_unread_count
                ) || 0
            );

        const badge =
            document.getElementById(
                "technicianFloatingSupportBadge"
            );

        if (!badge) {
            return;
        }

        if (totalUnreadCount > 0) {

            badge.textContent =
                totalUnreadCount > 99
                    ? "99+"
                    : String(
                        totalUnreadCount
                    );

            badge.hidden =
                false;

        } else {

            badge.textContent =
                "0";

            badge.hidden =
                true;

        }

    } catch (error) {

        console.warn(
            "Support unread badge refresh failed:",
            error
        );

    }

}



/* =========================================================
   SUPPORT CHAT REALTIME
   MESSAGE HANDLER
   ========================================================= */

function handleSupportChatRealtimeMessage(payload) {

    const message = payload?.new;

    if (!message?.id) {
        return;
    }

    if (
        String(message.support_request_id) !==
        String(supportChatRealtimeRequestId)
    ) {
        return;
    }

    if (!supportChatRealtimeReady) {

        const alreadyQueued =
            supportChatRealtimePending.some(
                item =>
                    String(item.id) ===
                    String(message.id)
            );

        if (!alreadyQueued) {
            supportChatRealtimePending.push(message);
        }

        return;
    }

    appendSupportChatMessageIfNew(message);

}

/* =========================================================
   SUPPORT CHAT REALTIME
   FLUSH PENDING
   ========================================================= */

function flushSupportChatRealtimePending() {

    if (
        !Array.isArray(
            supportChatRealtimePending
        ) ||
        !supportChatRealtimePending.length
    ) {

        return;

    }

    const pendingMessages =
        [
            ...supportChatRealtimePending
        ];

    supportChatRealtimePending =
        [];

    pendingMessages.forEach(
        message => {

            appendSupportChatMessageIfNew(
                message
            );

        }
    );

}

/* =========================================================
   SUPPORT CHAT REALTIME
   DUPLICATE SAFE APPEND
   ========================================================= */

function appendSupportChatMessageIfNew(
    message
) {

    const messageId =
        String(
            message?.id || ""
        ).trim();

    if (!messageId) {
        return;
    }

    const container =
        document.getElementById(
            "supportChatMessages"
        );

    if (!container) {
        return;
    }

    /*
     * Already rendered?
     */

    const existing =
        container.querySelector(
            `[data-message-id="${CSS.escape(messageId)}"]`
        );

    if (existing) {

        return;

    }

    appendSupportChatMessage(
        message
    );

}

/* =========================================================
   SUPPORT CHAT
   LIVE UNREAD BADGE INCREMENT
   ========================================================= */

function incrementTechnicianSupportUnreadBadge() {

    const badge =
        document.getElementById(
            "technicianFloatingSupportBadge"
        );

    if (!badge) {
        return;
    }

    const currentCount =
        Math.max(
            0,
            Number(
                String(
                    badge.textContent || "0"
                ).replace("+", "")
            ) || 0
        );

    const newCount =
        currentCount + 1;

    badge.textContent =
        newCount > 99
            ? "99+"
            : String(newCount);

    badge.hidden = false;

}

/* =========================================================
   SUPPORT CHAT
   OPEN CHAT
   PHASE 5B
   ========================================================= */

async function openSupportChat() {

    showSupportChatLoading();

    try {

        const response = await api(
            "support_my_requests"
        );

        const requests =
            Array.isArray(response?.requests)
                ? response.requests
                : [];

                        /*
         * Only support requests that are
         * still relevant for conversation.
         */
        const activeRequests =
            requests.filter(
                request => {

                    const status =
                        String(
                            request?.status || ""
                        ).toUpperCase();

                    return (
                        status !== "CLOSED" &&
                        status !== "CANCELLED"
                    );

                }
            );

/* =====================================================
   UPDATE FLOATING SUPPORT UNREAD BADGE
   ===================================================== */

const floatingSupportBadge =
    document.getElementById(
        "technicianFloatingSupportBadge"
    );

const totalUnreadCount =
    Math.max(
        0,
        Number(
            response?.total_unread_count
        ) || 0
    );

if (floatingSupportBadge) {

    if (totalUnreadCount > 0) {

        floatingSupportBadge.textContent =
            totalUnreadCount > 99
                ? "99+"
                : String(totalUnreadCount);

        floatingSupportBadge.hidden =
            false;

    } else {

        floatingSupportBadge.textContent =
            "0";

        floatingSupportBadge.hidden =
            true;

    }

}

        /*
         * Only support requests that are
         * still relevant for conversation.
         */

        /* =====================================================
   SUPPORT REQUESTS
   PHASE 5 - INCLUDE CLOSED REQUESTS
   ===================================================== */

const supportRequests =
    requests;

if (!supportRequests.length) {

    /*
     * No previous support request.
     * Open Bot directly.
     */

    showSupportBotStandalone();

    return;

}


/*
 * If only one support request exists,
 * open it directly.
 */

if (
    supportRequests.length === 1
) {

    await openSupportRequestChat(
        supportRequests[0].id
    );

    /* =====================================================
       REFRESH FLOATING SUPPORT UNREAD BADGE
       AFTER MESSAGE READ
       ===================================================== */

    try {

        const updatedResponse =
            await api(
                "support_my_requests"
            );

        const updatedUnreadCount =
            Math.max(
                0,
                Number(
                    updatedResponse?.total_unread_count
                ) || 0
            );

        const updatedFloatingBadge =
            document.getElementById(
                "technicianFloatingSupportBadge"
            );

        if (updatedFloatingBadge) {

            if (updatedUnreadCount > 0) {

                updatedFloatingBadge.textContent =
                    updatedUnreadCount > 99
                        ? "99+"
                        : String(updatedUnreadCount);

                updatedFloatingBadge.hidden =
                    false;

            } else {

                updatedFloatingBadge.textContent =
                    "0";

                updatedFloatingBadge.hidden =
                    true;

            }

        }

    } catch (error) {

        console.warn(
            "Support unread badge refresh after chat open failed:",
            error
        );

    }

    return;

}


/*
 * Multiple requests.
 * Include OPEN + CLOSED + CANCELLED
 * so previous conversations remain accessible.
 */

showSupportChatRequestPicker(
    supportRequests
);

        /*
         * If only one active support request exists,
         * open it directly.
         */

        if (
    activeRequests.length === 1
) {

    await openSupportRequestChat(
        activeRequests[0].id
    );

    /* =====================================================
       REFRESH FLOATING SUPPORT UNREAD BADGE
       AFTER MESSAGE READ
       ===================================================== */

    try {

        const updatedResponse =
            await api(
                "support_my_requests"
            );

        const updatedUnreadCount =
            Math.max(
                0,
                Number(
                    updatedResponse?.total_unread_count
                ) || 0
            );

        const updatedFloatingBadge =
            document.getElementById(
                "technicianFloatingSupportBadge"
            );

        if (updatedFloatingBadge) {

            if (updatedUnreadCount > 0) {

                updatedFloatingBadge.textContent =
                    updatedUnreadCount > 99
                        ? "99+"
                        : String(updatedUnreadCount);

                updatedFloatingBadge.hidden =
                    false;

            } else {

                updatedFloatingBadge.textContent =
                    "0";

                updatedFloatingBadge.hidden =
                    true;

            }

        }

    } catch (error) {

        console.warn(
            "Support unread badge refresh after chat open failed:",
            error
        );

    }

    return;

}

        /*
         * Multiple active requests.
         * Let technician choose one.
         */

        showSupportChatRequestPicker(
            activeRequests
        );

    } catch (error) {

        console.error(
            "Support chat request load failed:",
            error
        );

        showSupportChatError(
            error?.message ||
            "Unable to load support requests."
        );

    }

}

/* =========================================================
   SUPPORT CHAT
   LOADING
   ========================================================= */

function showSupportChatLoading() {

    removeSupportChatModal();

    const modal =
        document.createElement("div");

    modal.id =
        "techSupportChatModal";

    modal.className =
        "tech-support-chat-modal";

    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>

        <div
            class="tech-support-chat-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Support Chat"
        >

            <div class="tech-support-chat-header">

                <div>

                    <span class="tech-support-chat-eyebrow">
                        TECHNICIAN SUPPORT
                    </span>

                    <h3>
                        Support Chat
                    </h3>

                </div>

                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>

            <div class="tech-support-chat-loading">

                <div class="tech-support-chat-spinner">
                    <i class="fa-solid fa-spinner"></i>
                </div>

                <p>
                    Loading support requests...
                </p>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    bindSupportChatClose(modal);

}


/* =========================================================
   SUPPORT CHAT
   REQUEST PICKER
   ========================================================= */

function showSupportChatRequestPicker(requests) {

    removeSupportChatModal();

    const modal = document.createElement("div");

    modal.id = "techSupportChatModal";
    modal.className = "tech-support-chat-modal";

    const requestCards = requests
        .map(request => {

            const status = String(
                request?.status || "OPEN"
            ).toUpperCase();

            const appointment =
                request?.appointment_reference ||
                request?.appointment_code ||
                "Service Request";

            const supportToken =
                request?.support_token || "—";

            // Unread message count for this request
            const unreadCount = Math.max(
                0,
                Number(request?.unread_count) || 0
            );

            const supportType = formatSupportType(
                request?.support_type
            );

            return `

                <button
                    type="button"
                    class="tech-support-chat-request"
                    data-support-request-id="${escapeHtml(
                        request.id
                    )}"
                >

                    <div
                        class="tech-support-chat-request-icon"
                    >
                        <i class="fa-solid fa-comments"></i>
                    </div>

                    <div
                        class="tech-support-chat-request-content"
                    >

                        <div
                            class="tech-support-chat-request-top"
                        >

                            <strong>
                                ${escapeHtml(appointment)}
                            </strong>

                            <div class="tech-support-chat-request-indicators">

                                <span
                                    class="
                                        tech-support-chat-status
                                        ${getSupportStatusClass(status)}
                                    "
                                >
                                    ${escapeHtml(status)}
                                </span>

                                ${
                                    unreadCount > 0
                                        ? `
                                            <span
                                                class="tech-support-chat-unread-badge"
                                                aria-label="${unreadCount} unread messages"
                                            >
                                                ${unreadCount}
                                            </span>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                        <span>
                            ${escapeHtml(supportToken)}
                        </span>

                        <small>
                            ${escapeHtml(supportType)}
                        </small>

                    </div>

                    <i
                        class="fa-solid fa-chevron-right
                               tech-support-chat-request-arrow"
                    ></i>

                </button>

            `;

        })
        .join("");

    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>

        <div
            class="tech-support-chat-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Select Support Request"
        >

            <div class="tech-support-chat-header">

                <div>

                    <span class="tech-support-chat-eyebrow">
                        TECHNICIAN SUPPORT
                    </span>

                    <h3>
                        Select Support Request
                    </h3>

                </div>

                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>

            <div class="tech-support-chat-picker">

                <p class="tech-support-chat-picker-intro">
                    Select the support request you want
                    to continue the conversation for.
                </p>

                <div class="tech-support-chat-request-list">

                    ${requestCards}

                </div>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    bindSupportChatClose(modal);

    modal
        .querySelectorAll("[data-support-request-id]")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const requestId =
                        button.getAttribute(
                            "data-support-request-id"
                        );

                    if (!requestId) {
                        return;
                    }

                    await openSupportRequestChat(requestId);

                }
            );

        });

}

/* =========================================================
   SUPPORT CHAT
   OPEN REQUEST CHAT
   PHASE 5B + 5C
   ========================================================= */

async function openSupportRequestChat(
    requestId
) {

    const id =
        String(
            requestId || ""
        ).trim();

    if (!id) {

        showSupportChatError(
            "Invalid support request."
        );

        return;

    }

    showSupportChatLoading();

    try {

        /*
         * Start Realtime BEFORE loading messages.
         *
         * This reduces the chance of missing a message
         * while the initial message list is loading.
         */

        await startSupportChatRealtime(
            id
        );

        /*
         * Load request details.
         */

        const requestResponse =
            await api(
                "support_get_request",
                {
                    request_id: id
                }
            );

        const request =
            requestResponse?.request;

        if (
            !request ||
            !request.id
        ) {

            throw new Error(
                "Support request could not be loaded."
            );

        }

        /*
         * Load existing messages.
         */

        const messageResponse =
            await api(
                "support_messages",
                {
                    support_request_id: id
                }
            );

        const messages =
            Array.isArray(
                messageResponse?.messages
            )
                ? messageResponse.messages
                : [];

        /*
         * Render existing conversation.
         */

        renderSupportChat(
            request,
            messages
        );

        /*
         * Mark initial conversation as ready.
         *
         * Any Realtime message received during
         * initial loading will now be flushed.
         */

        supportChatRealtimeReady =
            true;

        flushSupportChatRealtimePending();

    } catch (error) {

        console.error(
            "Support chat load failed:",
            error
        );

        await stopSupportChatRealtime();

        showSupportChatError(
            error?.message ||
            "Unable to load support chat."
        );

    }

}

/* =========================================================
   SUPPORT CHAT
   RENDER CHAT
   ========================================================= */

function renderSupportChat(
    request,
    messages
) {

    removeSupportChatModal();

    const modal =
        document.createElement("div");

    modal.id =
        "techSupportChatModal";

    modal.className =
        "tech-support-chat-modal";

    const status =
        String(
            request?.status ||
            "OPEN"
        ).toUpperCase();

    const appointment =
        request?.appointment_reference ||
        request?.appointment_code ||
        "Service Request";

    const supportToken =
        request?.support_token ||
        "—";

        const unreadCount = Math.max(
    0,
    Number(request?.unread_count) || 0
);

    const supportType =
        formatSupportType(
            request?.support_type
        );

    const isClosed =
        status === "CLOSED" ||
        status === "CANCELLED";

    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>

        <div
            class="tech-support-chat-dialog
                   tech-support-chat-dialog-live"
            role="dialog"
            aria-modal="true"
            aria-label="Support Chat"
        >

            <!-- HEADER -->

            <div class="tech-support-chat-header">

                <div
                    class="tech-support-chat-header-main"
                >

                    <span class="tech-support-chat-eyebrow">
                        SUPPORT CONVERSATION
                    </span>

                    <h3>
                        ${escapeHtml(
                            appointment
                        )}
                    </h3>

                    <div
                        class="tech-support-chat-meta"
                    >

                        <span>
                            ${escapeHtml(
                                supportToken
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                supportType
                            )}
                        </span>

                        <span
                            class="
                                tech-support-chat-status
                                ${getSupportStatusClass(status)}
                            "
                        >
                            ${escapeHtml(status)}
                        </span>

                    </div>

                </div>

                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>


            <!-- MESSAGES -->

            <div
                class="tech-support-chat-messages"
                id="supportChatMessages"
            ></div>

            <!-- =====================================================
                                SUPPORT BOT
                                  PHASE 5
                 ===================================================== -->

<div
    class="tech-support-bot-panel"
    id="supportChatBotPanel"
>
</div>

            <!-- COMPOSER -->

            <div
                class="tech-support-chat-composer"
                ${isClosed ? "data-chat-closed='true'" : ""}
            >

                ${
                    isClosed
                        ? `
                            <div
                                class="tech-support-chat-closed"
                            >

                                <i
                                    class="fa-solid fa-lock"
                                ></i>

                                <span>
                                    This support request is
                                    ${escapeHtml(
                                        status.toLowerCase()
                                    )}.
                                    New messages are not available.
                                </span>

                            </div>
                        `
                        : `
                            <form
                                id="supportChatForm"
                                class="tech-support-chat-form"
                            >

                                <textarea
                                    id="supportChatInput"
                                    class="tech-support-chat-input"
                                    rows="1"
                                    maxlength="2000"
                                    placeholder="Type your message..."
                                    autocomplete="off"
                                ></textarea>

                                <button
                                    type="submit"
                                    class="tech-support-chat-send"
                                    id="supportChatSend"
                                    aria-label="Send message"
                                >
                                    <i
                                        class="fa-solid fa-paper-plane"
                                    ></i>
                                </button>

                            </form>

                            <div
                                class="tech-support-chat-compose-hint"
                            >
                                Maximum 2000 characters
                            </div>
                        `
                }

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    bindSupportChatClose(modal);

   renderSupportChatMessages(
    messages
);

if (!isClosed) {

    bindSupportChatComposer(
        modal,
        request.id
    );

}


/* =====================================================
   SUPPORT BOT
   INITIALIZE
   ===================================================== */

initializeSupportBot(
    request,
    messages
);

}

/* =========================================================
   SUPPORT CHAT
   RENDER MESSAGES
   ========================================================= */

function renderSupportChatMessages(
    messages
) {

    const container =
        document.getElementById(
            "supportChatMessages"
        );

    if (!container) {
        return;
    }

    if (
        !Array.isArray(messages) ||
        !messages.length
    ) {

        container.innerHTML = `

            <div
                class="tech-support-chat-empty"
            >

                <div
                    class="tech-support-chat-empty-icon"
                >
                    <i class="fa-solid fa-comments"></i>
                </div>

                <h4>
                    No messages yet
                </h4>

                <p>
                    Send a message to start the
                    conversation with Click &amp; Fix support.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        messages
            .map(
                message => {

                    const senderType =
                        String(
                            message?.sender_type ||
                            ""
                        ).toUpperCase();

                    const isTechnician =
                        senderType === "TECHNICIAN";

                    const senderLabel =
                        isTechnician
                            ? "You"
                            : senderType === "BOT"
                                ? "Click & Fix Bot"
                                : "Click & Fix Support";

                    const time =
                        formatSupportChatTime(
                            message?.created_at
                        );

                    return `

                        <div
                            class="
                                tech-support-chat-message
                                ${isTechnician
                                    ? "is-technician"
                                    : "is-support"
                                }
                            "
                        >

                            <div
                                class="tech-support-chat-message-label"
                            >
                                ${escapeHtml(
                                    senderLabel
                                )}

                                <span>
                                    ${escapeHtml(
                                        time
                                    )}
                                </span>
                            </div>

                            <div
                                class="tech-support-chat-bubble"
                            >
                                ${escapeHtml(
                                    message?.message || ""
                                ).replace(
                                    /\n/g,
                                    "<br>"
                                )}
                            </div>

                        </div>

                    `;

                }
            )
            .join("");

    requestAnimationFrame(
        () => {

            container.scrollTop =
                container.scrollHeight;

        }
    );

}

/* =========================================================
   SUPPORT BOT
   PHASE 5
   ========================================================= */

/* =========================================================
   INITIALIZE BOT
   ========================================================= */

async function initializeSupportBot(
    request,
    messages
) {

    const panel =
        document.getElementById(
            "supportChatBotPanel"
        );

    if (!panel) {
        return;
    }


    /*
     * If this request already contains BOT messages,
     * don't create a duplicate greeting.
     */

    const hasBotMessage =
        Array.isArray(messages) &&
        messages.some(
            message =>
                String(
                    message?.sender_type || ""
                ).toUpperCase() === "BOT"
        );


    if (
        hasBotMessage
    ) {

        renderSupportBotPanel(
            panel,
            {
                message:
                    "How can I help you with this support issue?",

                options: [

                    {
                        id:
                            "START",

                        label:
                            "Troubleshoot Problem"
                    },

                    {
                        id:
                            "CREATE_SUPPORT_REQUEST",

                        label:
                            "Create New Support Request"
                    }

                ],

                next_action:
                    "START"
            },

            request
        );

        return;

    }


    /*
     * First Bot greeting.
     */

    try {

        renderSupportBotLoading(
            panel
        );


        const response =
    await api(
        "support_bot",
        {
            support_request_id:
                request.id,

            bot_action:
                "START"
        }
    );


        const bot =
            response?.bot;


        if (!bot) {

            throw new Error(
                "Invalid Bot response."
            );

        }


        /*
         * Save first Bot message
         * into support_messages.
         */

        const saved =
            await saveSupportBotMessage(
                request.id,
                bot.message
            );


        if (
            saved
        ) {

            /*
             * Use realtime-safe append.
             */

            appendSupportChatMessageIfNew(
                saved
            );

        }


        renderSupportBotPanel(
            panel,
            bot,
            request
        );


    } catch (error) {

        console.error(
            "Support Bot initialization failed:",
            error
        );


        renderSupportBotPanel(
            panel,
            {
                message:
                    "Unable to start the Support Bot. Please try again.",

                options: [

                    {
                        id:
                            "RETRY",

                        label:
                            "Try Again"
                    }

                ],

                next_action:
                    "START"
            },

            request
        );

    }

}


/* =========================================================
   BOT LOADING
   ========================================================= */

function renderSupportBotLoading(
    panel
) {

    panel.innerHTML = `

        <div class="tech-support-bot-header">

            <div class="tech-support-bot-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>

            <div>

                <strong>
                    Click &amp; Fix Bot
                </strong>

                <span>
                    Checking support options...
                </span>

            </div>

        </div>

        <div class="tech-support-bot-loading">

            <i class="fa-solid fa-spinner fa-spin"></i>

            <span>
                Please wait...
            </span>

        </div>

    `;

}


/* =========================================================
   BOT PANEL
   ========================================================= */

function renderSupportBotPanel(
    panel,
    bot,
    request
) {

    if (!panel) {
        return;
    }


    const message =
        String(
            bot?.message ||
            "How can I help you?"
        );


    const options =
        Array.isArray(
            bot?.options
        )
            ? bot.options
            : [];


    panel.innerHTML = `

        <div class="tech-support-bot-header">

            <div class="tech-support-bot-avatar">

                <i class="fa-solid fa-robot"></i>

            </div>

            <div>

                <strong>
                    Click &amp; Fix Bot
                </strong>

                <span>
                    Troubleshooting Assistant
                </span>

            </div>

        </div>


        <div class="tech-support-bot-message">

            ${escapeHtml(
                message
            ).replace(
                /\n/g,
                "<br>"
            )}

        </div>


        ${
            options.length
                ? `
                    <div class="tech-support-bot-options">

                        ${options
                            .map(
                                option => `

                                    <button
                                        type="button"
                                        class="tech-support-bot-option"
                                        data-bot-action="${escapeHtml(
                                            option?.id || ""
                                        )}"
                                    >

                                        ${escapeHtml(
                                            option?.label ||
                                            "Continue"
                                        )}

                                    </button>

                                `
                            )
                            .join("")}

                    </div>
                `
                : ""
        }

    `;

    const botHeader =
    panel.querySelector(
        ".tech-support-bot-header"
    );


if (botHeader) {

    botHeader.addEventListener(
        "click",
        () => {

            panel.classList.toggle(
                "bot-open"
            );

        }
    );

}


    panel
        .querySelectorAll(
            "[data-bot-action]"
        )
        .forEach(
            button => {

               button.addEventListener(
    "click",
    async () => {

        const action =
            button.getAttribute(
                "data-bot-action"
            );

        if (!action) {
            return;
        }


        await handleSupportBotAction(
            action,
            request,
            bot?.next_action || null
        );

    }
);

            }
        );

}

/* =========================================================
   BOT ACTION HANDLER
   ========================================================= */

async function handleSupportBotAction(
    selectedAction,
    request,
    nextAction = null
) {

    const panel =
        document.getElementById(
            "supportChatBotPanel"
        );

    if (!panel) {
        return;
    }


    /*
     * New Support Request.
     */

    if (
        selectedAction ===
        "CREATE_SUPPORT_REQUEST"
    ) {

        openRaiseSupportRequestModal();

        return;

    }


    /*
     * Start / Retry.
     */

    if (
        selectedAction === "START" ||
        selectedAction === "RETRY"
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "START"
            }
        );

        return;

    }


    /*
     * Category selection.
     */

    const categoryActions = [

        "TECHNICAL_PROBLEM",
        "APPOINTMENT_JOB",
        "CCTV_PROBLEM",
        "COMPUTER_LAPTOP",
        "JOB_ID_BILLING",
        "TECHNICIAN_SUPPORT",
        "OTHER"

    ];


    if (
        categoryActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_CATEGORY",

                category:
                    selectedAction
            }
        );

        return;

    }


    /*
     * Technical Problem subcategory.
     */

    const technicalActions = [

        "WEBSITE_PORTAL",
        "LOGIN_PROBLEM",
        "APP_BROWSER",
        "NETWORK_INTERNET",
        "ERROR_MESSAGE",
        "TECHNICAL_OTHER"

    ];


    if (
        technicalActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "TECHNICAL_PROBLEM",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


    /*
     * Appointment / Job subcategory.
     */

    const appointmentJobActions = [

        "APPOINTMENT_STATUS",
        "TECHNICIAN_VISIT",
        "JOB_RESCHEDULE",
        "JOB_CANCEL",
        "JOB_DETAILS",
        "OTHER_JOB_ISSUE"

    ];


    if (
        appointmentJobActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "APPOINTMENT_JOB",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


    /*
     * CCTV subcategory.
     */

    const cctvActions = [

        "CAMERA_OFFLINE",
        "NO_DISPLAY",
        "RECORDING_PROBLEM",
        "NETWORK_PROBLEM",
        "REMOTE_VIEWING",
        "CCTV_OTHER"

    ];


    if (
        cctvActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "CCTV_PROBLEM",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


    /*
     * Computer / Laptop subcategory.
     */

    const computerActions = [

        "COMPUTER_NOT_STARTING",
        "COMPUTER_SLOW",
        "WINDOWS_PROBLEM",
        "SOFTWARE_PROBLEM",
        "COMPUTER_NETWORK",
        "HARDWARE_PROBLEM",
        "COMPUTER_OTHER"

    ];


    if (
        computerActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "COMPUTER_LAPTOP",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


    /*
     * Job ID / Billing subcategory.
     */

    const billingActions = [

        "JOB_ID_NOT_RECEIVED",
        "JOB_ID_PROBLEM",
        "INVOICE_BILL",
        "PAYMENT_PROBLEM",
        "PAYMENT_CONFIRMATION",
        "BILLING_OTHER"

    ];


    if (
        billingActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "JOB_ID_BILLING",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


    /*
     * Technician Support subcategory.
     */

    const technicianActions = [

        "TECHNICIAN_NOT_ASSIGNED",
        "TECHNICIAN_NOT_CONTACTING",
        "TECHNICIAN_VISIT_DELAY",
        "TECHNICIAN_BEHAVIOUR",
        "TECHNICIAN_JOB_ISSUE",
        "TECHNICIAN_OTHER"

    ];


    if (
        technicianActions.includes(
            selectedAction
        )
    ) {

        await requestSupportBotStep(
            request,
            {
                action:
                    "SELECT_SUBCATEGORY",

                category:
                    "TECHNICIAN_SUPPORT",

                subcategory:
                    selectedAction
            }
        );

        return;

    }


     /*
  * Resolution / Close Flow YES / NO.
  */

 if (
     selectedAction === "YES" ||
     selectedAction === "NO"
 ) {

     /*
      * Close confirmation flow.
      */

     if (
         nextAction === "CLOSE_FLOW"
     ) {

         await requestSupportBotStep(
             request,
             {
                 action:
                     "CLOSE_FLOW",

                 subcategory:
                     selectedAction
             }
         );

         return;

     }


     /*
      * Normal resolution check.
      */

     await requestSupportBotStep(
         request,
         {
             action:
                 "CHECK_RESOLUTION",

             subcategory:
                 selectedAction
         }
     );

     return;

 }



    /*
     * Anything else.
     */

    console.warn(
        "Unknown Support Bot action:",
        selectedAction
    );

}


/* =========================================================
   REQUEST BOT STEP
   ========================================================= */

async function requestSupportBotStep(
    request,
    payload
) {

    const panel =
        document.getElementById(
            "supportChatBotPanel"
        );

    if (
        !panel ||
        !request?.id
    ) {
        return;
    }


    /*
     * Disable buttons while processing.
     */

    panel
        .querySelectorAll(
            "[data-bot-action]"
        )
        .forEach(
            button => {

                button.disabled =
                    true;

            }
        );


    renderSupportBotLoading(
        panel
    );


    try {

        const response =
    await api(
        "support_bot",
        {
            support_request_id:
                request.id,

            bot_action:
                payload?.action ||
                "START",

            category:
                payload?.category,

            subcategory:
                payload?.subcategory
        }
    );


        const bot =
            response?.bot;


        if (!bot) {

            throw new Error(
                "Invalid Bot response."
            );

        }


        /*
         * Save Bot response.
         */

        const saved =
            await saveSupportBotMessage(
                request.id,
                bot.message
            );


        if (
            saved
        ) {

            appendSupportChatMessageIfNew(
                saved
            );

        }


        renderSupportBotPanel(
            panel,
            bot,
            request
        );


    } catch (error) {

        console.error(
            "Support Bot step failed:",
            error
        );


        renderSupportBotPanel(
            panel,
            {
                message:
                    error?.message ||
                    "Unable to process your request.",

                options: [

                    {
                        id:
                            "START",

                        label:
                            "Start Again"
                    },

                    {
                        id:
                            "CREATE_SUPPORT_REQUEST",

                        label:
                            "Create Support Request"
                    }

                ],

                next_action:
                    "START"
            },

            request
        );

    }

}


/* =========================================================
   SAVE BOT MESSAGE
   ========================================================= */

async function saveSupportBotMessage(
    requestId,
    message
) {

    const cleanMessage =
        String(
            message || ""
        ).trim();


    if (
        !requestId ||
        !cleanMessage
    ) {
        return null;
    }


    try {

        const response =
            await api(
                "support_bot_message",
                {
                    support_request_id:
                        requestId,

                    message:
                        cleanMessage
                }
            );


        return (
            response?.message ||
            null
        );

    } catch (error) {

        console.error(
            "Support Bot message save failed:",
            error
        );

        return null;

    }

}

/* =========================================================
   SUPPORT CHAT
   SEND MESSAGE
   ========================================================= */

function bindSupportChatComposer(
    modal,
    requestId
) {

    const form =
        modal.querySelector(
            "#supportChatForm"
        );

    const input =
        modal.querySelector(
            "#supportChatInput"
        );

    const sendButton =
        modal.querySelector(
            "#supportChatSend"
        );

    if (
        !form ||
        !input ||
        !sendButton
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

            if (
                message.length > 2000
            ) {

                alert(
    "Message cannot exceed 2000 characters."
);

                return;

            }

            input.disabled = true;
            sendButton.disabled = true;

            try {

                const response =
                    await api(
                        "support_message_send",
                        {
                            support_request_id:
                                requestId,

                            message:
                                message
                        }
                    );

                const newMessage =
                    response?.message;

                if (
                    !newMessage ||
                    !newMessage.id
                ) {

                    throw new Error(
                        "Message was not sent."
                    );

                }

                /*
                 * Add message immediately.
                 * Realtime will be handled in Phase 5C.
                 */

                appendSupportChatMessage(
                    newMessage
                );

                input.value = "";

                input.style.height =
                    "auto";

            } catch (error) {

                console.error(
                    "Support message send failed:",
                    error
                );

                alert(
    error?.message ||
    "Unable to send message."
);

            } finally {

                input.disabled = false;
                sendButton.disabled = false;

                input.focus();

            }

        }
    );

    /*
     * Enter = send
     * Shift + Enter = new line
     */

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                form.requestSubmit();

            }

        }
    );

    /*
     * Auto-grow textarea.
     */

    input.addEventListener(
        "input",
        () => {

            input.style.height =
                "auto";

            input.style.height =
                Math.min(
                    input.scrollHeight,
                    140
                ) + "px";

        }
    );

}

/* =========================================================
   SUPPORT CHAT
   APPEND NEW MESSAGE
   ========================================================= */

function appendSupportChatMessage(
    message
) {

    const container =
        document.getElementById(
            "supportChatMessages"
        );

    if (!container) {
        return;
    }

    /*
     * Remove empty state if present.
     */

    const emptyState =
        container.querySelector(
            ".tech-support-chat-empty"
        );

    if (emptyState) {
        emptyState.remove();
    }

    const senderType =
        String(
            message?.sender_type ||
            ""
        ).toUpperCase();

    const isTechnician =
        senderType === "TECHNICIAN";

    const senderLabel =
        isTechnician
            ? "You"
            : senderType === "BOT"
                ? "Click & Fix Bot"
                : "Click & Fix Support";

    const time =
        formatSupportChatTime(
            message?.created_at
        );

    const wrapper =
        document.createElement("div");

    wrapper.className =
        `tech-support-chat-message ${
            isTechnician
                ? "is-technician"
                : "is-support"
        }`;

    wrapper.dataset.messageId =
        message?.id || "";

    wrapper.innerHTML = `

        <div
            class="tech-support-chat-message-label"
        >
            ${escapeHtml(senderLabel)}

            <span>
                ${escapeHtml(time)}
            </span>
        </div>

        <div
            class="tech-support-chat-bubble"
        >
            ${escapeHtml(
                message?.message || ""
            ).replace(
                /\n/g,
                "<br>"
            )}
        </div>

    `;

    container.appendChild(
        wrapper
    );

    requestAnimationFrame(
        () => {

            container.scrollTop =
                container.scrollHeight;

        }
    );

}

function playSupportMessageSound() {

    const audio =
        new Audio(
            "/assets/sounds/new-message.mp3"
        );

    audio.volume = 0.6;

    audio.play().catch(
        () => {}
    );

}

/* =========================================================
   SUPPORT CHAT
   EMPTY STATE
   ========================================================= */

function showSupportChatEmpty() {

    removeSupportChatModal();

    const modal =
        document.createElement("div");

    modal.id =
        "techSupportChatModal";

    modal.className =
        "tech-support-chat-modal";

    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>

        <div
            class="tech-support-chat-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Support Chat"
        >

            <div class="tech-support-chat-header">

                <div>

                    <span class="tech-support-chat-eyebrow">
                        TECHNICIAN SUPPORT
                    </span>

                    <h3>
                        Support Chat
                    </h3>

                </div>

                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>

            <div class="tech-support-chat-empty-state">

                <div class="tech-support-chat-empty-icon">
                    <i class="fa-solid fa-comments"></i>
                </div>

                <h3>
                    No Active Support Request
                </h3>

                <p>
                    You don't have an active support request
                    available for chat.
                </p>

                <button
                    type="button"
                    class="tech-support-chat-primary-button"
                    data-close-support-chat="true"
                >
                    Close
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    bindSupportChatClose(
        modal
    );

}

/* =========================================================
   SUPPORT BOT
   STANDALONE MODE
   NO SUPPORT REQUEST YET
   ========================================================= */

function showSupportBotStandalone() {

    removeSupportChatModal();

    const modal =
        document.createElement("div");

    modal.id =
        "techSupportChatModal";

    modal.className =
        "tech-support-chat-modal";


    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>


        <div
            class="tech-support-chat-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Click and Fix Support Bot"
        >

            <div class="tech-support-chat-header">

                <div>

                    <span class="tech-support-chat-eyebrow">
                        TECHNICIAN SUPPORT
                    </span>

                    <h3>
                        Support Assistant
                    </h3>

                </div>


                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                    aria-label="Close"
                >

                    <i class="fa-solid fa-xmark"></i>

                </button>

            </div>


            <div
                class="tech-support-chat-messages"
                id="supportChatMessages"
            >

                <div
                    class="tech-support-chat-empty"
                >

                    <div
                        class="tech-support-chat-empty-icon"
                    >
                        <i class="fa-solid fa-robot"></i>
                    </div>

                    <h4>
                        Click &amp; Fix Support Bot
                    </h4>

                    <p>
                        I can help troubleshoot common problems
                        before you create a Support Request.
                    </p>

                </div>

            </div>


            <div
                class="tech-support-bot-panel"
                id="supportChatBotPanel"
            >
            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    bindSupportChatClose(
        modal
    );


    const panel =
        modal.querySelector(
            "#supportChatBotPanel"
        );


    /*
     * Standalone Bot does not have a
     * support_request_id yet.
     *
     * Therefore we only call support_bot
     * and do NOT save the greeting.
     */

    requestStandaloneSupportBot(
        panel
    );

}


/* =========================================================
   STANDALONE BOT REQUEST
   ========================================================= */

async function requestStandaloneSupportBot(
    panel
) {

    if (!panel) {
        return;
    }


    renderSupportBotLoading(
        panel
    );


    try {

        const response =
    await api(
        "support_bot",
        {
            bot_action:
                "START"
        }
    );


        const bot =
            response?.bot;


        if (!bot) {

            throw new Error(
                "Invalid Bot response."
            );

        }


        renderStandaloneSupportBotPanel(
            panel,
            bot
        );


    } catch (error) {

        console.error(
            "Standalone Support Bot failed:",
            error
        );


        panel.innerHTML = `

            <div class="tech-support-bot-message">

                Unable to start the Support Bot.

            </div>

        `;

    }

}


/* =========================================================
   STANDALONE BOT PANEL
   ========================================================= */

function renderStandaloneSupportBotPanel(
    panel,
    bot
) {

    if (!panel) {
        return;
    }


    const options =
        Array.isArray(
            bot?.options
        )
            ? bot.options
            : [];


    panel.innerHTML = `

        <div class="tech-support-bot-header">

            <div class="tech-support-bot-avatar">

                <i class="fa-solid fa-robot"></i>

            </div>

            <div>

                <strong>
                    Click &amp; Fix Bot
                </strong>

                <span>
                    Support Assistant
                </span>

            </div>

        </div>


        <div class="tech-support-bot-message">

            ${escapeHtml(
                bot?.message ||
                "How can I help you?"
            )}

        </div>


        <div class="tech-support-bot-options">

            ${options
                .map(
                    option => `

                        <button
                            type="button"
                            class="tech-support-bot-option"
                            data-standalone-bot-action="${escapeHtml(
                                option?.id || ""
                            )}"
                        >

                            ${escapeHtml(
                                option?.label ||
                                "Continue"
                            )}

                        </button>

                    `
                )
                .join("")}

        </div>

    `;


    panel
        .querySelectorAll(
            "[data-standalone-bot-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const action =
                            button.getAttribute(
                                "data-standalone-bot-action"
                            );


                        if (
                            action ===
                            "CREATE_SUPPORT_REQUEST"
                        ) {

                            openRaiseSupportRequestModal();

                            return;

                        }


                        /*
                         * Category selected.
                         *
                         * There is no support request yet,
                         * so we cannot save Bot messages.
                         * Continue using the Bot engine.
                         */

                        if (
                            [
                                "TECHNICAL_PROBLEM",
                                "APPOINTMENT_JOB",
                                "CCTV_PROBLEM",
                                "COMPUTER_LAPTOP",
                                "JOB_ID_BILLING",
                                "TECHNICIAN_SUPPORT",
                                "OTHER"
                            ].includes(
                                action
                            )
                        ) {

                            panel.innerHTML = `
                                <div class="tech-support-bot-message">
                                    To troubleshoot this issue,
                                    please create a Support Request
                                    so the conversation can be linked
                                    to your service job.
                                </div>

                                <div class="tech-support-bot-options">

                                    <button
                                        type="button"
                                        class="tech-support-bot-option"
                                        id="standaloneCreateSupportRequest"
                                    >
                                        Create Support Request
                                    </button>

                                </div>
                            `;


                            panel
                                .querySelector(
                                    "#standaloneCreateSupportRequest"
                                )
                                ?.addEventListener(
                                    "click",
                                    () => {

                                        openRaiseSupportRequestModal();

                                    }
                                );

                        }

                    }
                );

            }
        );

}

/* =========================================================
   SUPPORT CHAT
   ERROR STATE
   ========================================================= */

function showSupportChatError(
    message
) {

    removeSupportChatModal();

    const modal =
        document.createElement("div");

    modal.id =
        "techSupportChatModal";

    modal.className =
        "tech-support-chat-modal";

    modal.innerHTML = `

        <div
            class="tech-support-chat-modal-backdrop"
            data-close-support-chat="true"
        ></div>

        <div
            class="tech-support-chat-dialog"
            role="dialog"
            aria-modal="true"
        >

            <div class="tech-support-chat-header">

                <div>

                    <span class="tech-support-chat-eyebrow">
                        TECHNICIAN SUPPORT
                    </span>

                    <h3>
                        Support Chat
                    </h3>

                </div>

                <button
                    type="button"
                    class="tech-support-chat-close"
                    data-close-support-chat="true"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>

            <div class="tech-support-chat-error">

                <div class="tech-support-chat-error-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>
                    Unable to load chat
                </h3>

                <p>
                    ${escapeHtml(
                        message ||
                        "Something went wrong."
                    )}
                </p>

                <button
                    type="button"
                    class="tech-support-chat-primary-button"
                    data-close-support-chat="true"
                >
                    Close
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    bindSupportChatClose(
        modal
    );

}

/* =========================================================
   SUPPORT CHAT
   CLOSE MODAL
   ========================================================= */

function bindSupportChatClose(
    modal
) {

    if (!modal) {
        return;
    }

    modal
        .querySelectorAll(
            "[data-close-support-chat='true']"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        removeSupportChatModal();

                    }
                );

            }
        );

}

/* =========================================================
   SUPPORT CHAT
   REMOVE MODAL
   ========================================================= */

function removeSupportChatModal() {

    document
        .getElementById(
            "techSupportChatModal"
        )
        ?.remove();

}

/* =========================================================
   SUPPORT CHAT
   HELPERS
   ========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}

function getSupportStatusClass(
    status
) {

    const value =
        String(
            status || ""
        )
            .toLowerCase();

    return `status-${value}`;

}


function formatSupportChatTime(
    value
) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}

/* =========================================================
   SUPPORT DATE FORMATTER
   ========================================================= */

function formatSupportDate(
    value
) {

    if (!value) {
        return "Date unavailable";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            value
        );

    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    );

}



/* =========================================================
   SUPPORT REQUEST DETAILS
   PHASE 4C
   FRESH BACKEND DATA
   ========================================================= */

function showMySupportRequestDetails(
    request
) {

    if (!request) {
        return;
    }


    /*
     * IMPORTANT:
     * Remove any existing loading/detail modal first.
     * This prevents the old "Loading Details" modal
     * from remaining underneath the fresh details modal.
     */
    const existingModal =
        document.getElementById(
            "techSupportRequestModal"
        );


    if (existingModal) {

        existingModal.remove();

    }


    const status =
        String(
            request.status ||
            "OPEN"
        ).toUpperCase();


    const supportType =
        formatSupportType(
            request.support_type
        );


    const createdAt =
        formatSupportDate(
            request.created_at
        );


    const updatedAt =
        formatSupportDate(
            request.updated_at
        );


    const supportToken =
        String(
            request.support_token ||
            "Unavailable"
        );


    const appointmentReference =
        request?.appointment_reference ||
        request?.appointment_code ||
        "Not linked";


    const problemDetails =
        String(
            request.problem_details ||
            "No problem description provided."
        );


    const locationUrl =
        request.location_url
            ? String(
                request.location_url
            )
            : "";


    const modal =
        document.createElement(
            "div"
        );


    /*
     * SAME ID AS LOADING MODAL
     *
     * This makes sure there can only be
     * one support request modal at a time.
     */
    modal.id =
        "techSupportRequestModal";


    modal.className =
        "tech-support-request-modal";


    modal.innerHTML = `

        <div
            class="tech-support-request-modal-backdrop"
            data-close-support-modal="true"
        ></div>


        <div
            class="tech-support-request-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Support request details"
        >

            <div
                class="tech-support-request-modal-header"
            >

                <div>

                    <p
                        class="tech-support-eyebrow"
                    >
                        SUPPORT REQUEST
                    </p>


                    <h3>
                        ${esc(supportToken)}
                    </h3>

                </div>


                <button
                    type="button"
                    class="tech-support-request-modal-close"
                    aria-label="Close"
                    data-close-support-modal="true"
                >

                    <i
                        class="fa-solid fa-xmark"
                    ></i>

                </button>

            </div>


            <div
                class="tech-support-request-modal-status"
            >

                <span
                    class="tech-support-request-status status-${esc(
                        status.toLowerCase()
                    )}"
                >
                    ${esc(status)}
                </span>

            </div>


            <div
                class="tech-support-request-detail-grid"
            >

                <div>

                    <span>
                        Support Type
                    </span>

                    <strong>
                        ${esc(supportType)}
                    </strong>

                </div>


                <div>

                    <span>
                        Appointment
                    </span>

                    <strong>
                        ${esc(
                            appointmentReference
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Created
                    </span>

                    <strong>
                        ${esc(createdAt)}
                    </strong>

                </div>


                <div>

                    <span>
                        Last Updated
                    </span>

                    <strong>
                        ${esc(updatedAt)}
                    </strong>

                </div>

            </div>


            <div
                class="tech-support-request-detail-description"
            >

                <span>
                    Problem Details
                </span>


                <p>
                    ${esc(problemDetails)}
                </p>

            </div>


            <div
                class="tech-support-request-modal-actions"
            >

                ${
                    locationUrl
                        ? `
                            <a
                                href="${esc(locationUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="tech-support-request-action"
                            >
                                <i
                                    class="fa-solid fa-location-dot"
                                ></i>

                                Open Location
                            </a>
                        `
                        : ""
                }


                <button
                    type="button"
                    class="tech-support-request-action"
                    data-close-support-modal="true"
                >

                    <i
                        class="fa-solid fa-xmark"
                    ></i>

                    Close

                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    /*
     * CLOSE MODAL
     */
    const closeModal =
        () => {

            if (
                modal &&
                modal.isConnected
            ) {

                modal.remove();

            }


            /*
             * Remove Escape listener as well.
             */
            document.removeEventListener(
                "keydown",
                escapeHandler
            );

        };


    /*
     * Backdrop + X + Close button
     */
    modal
        .querySelectorAll(
            "[data-close-support-modal]"
        )
        .forEach(
            (element) => {

                element.addEventListener(
                    "click",
                    closeModal
                );

            }
        );


    /*
     * ESC key support
     */
    const escapeHandler =
        (event) => {

            if (
                event.key === "Escape"
            ) {

                closeModal();

            }

        };


    document.addEventListener(
        "keydown",
        escapeHandler
    );

}

/* =========================================================
   DATE FORMATTER
   ========================================================= */

function formatSupportJobDate(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   TIME FORMATTER
   ========================================================= */

function formatSupportJobTime(
    value
) {

    if (!value) {
        return "";
    }


    const parts =
        String(value)
            .split(":");


    if (
        parts.length < 2
    ) {
        return value;
    }


    const hour =
        Number(
            parts[0]
        );


    const minute =
        Number(
            parts[1]
        );


    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute)
    ) {
        return value;
    }


    const date =
        new Date();


    date.setHours(
        hour,
        minute,
        0,
        0
    );


    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    );

}


/* =========================================================
   STATUS FORMATTER
   ========================================================= */

function formatSupportJobStatus(
    status
) {

    const labels = {

        pending:
            "Pending",

        confirmed:
            "Confirmed",

        technician_assigned:
            "Technician Assigned",

        on_the_way:
            "On The Way",

        in_progress:
            "In Progress",

        job_id_created:
            "Job ID Created",

        rescheduled:
            "Rescheduled"

    };


    return (
        labels[status] ||
        String(status || "")
            .replaceAll(
                "_",
                " "
            )
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            )
    );

}



async function loadDetail(
    id,
    readOnly = false
){

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


                    ${
    !readOnly
        ? `
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
        `
        : ""
}


                    <div class="tech-detail-section">

    <h3>
        Job ID
    </h3>

    ${
        readOnly
            ? `
                <div class="tech-job-id-row">

                    <div class="tech-detail-info-grid">
                        <div>
                            <span>Job ID</span>
                            <strong>
                                ${esc(a.job_code || "—")}
                            </strong>
                        </div>
                    </div>

                </div>
              `
            : `
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
              `
    }

</div>


                    ${
    !readOnly &&
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

        if (!readOnly) {

    document
        .querySelectorAll(
            ".tech-action-button[data-status]"
        )
        .forEach(b => {

            b.onclick = () =>
                status(
                    id,
                    b.dataset.status
                );

        });

}


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

await startSupportUnreadRealtime();

/* =====================================================
   INITIAL SUPPORT UNREAD BADGE
   ===================================================== */

try {

    const response =
        await api(
            "support_my_requests"
        );

    const totalUnreadCount =
        Math.max(
            0,
            Number(
                response?.total_unread_count
            ) || 0
        );

    const floatingSupportBadge =
        document.getElementById(
            "technicianFloatingSupportBadge"
        );

    if (floatingSupportBadge) {

        if (totalUnreadCount > 0) {

            floatingSupportBadge.textContent =
                totalUnreadCount > 99
                    ? "99+"
                    : String(totalUnreadCount);

            floatingSupportBadge.hidden =
                false;

        } else {

            floatingSupportBadge.textContent =
                "0";

            floatingSupportBadge.hidden =
                true;

        }

    }

} catch (error) {

    console.warn(
        "Initial support unread badge refresh failed:",
        error
    );

}

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

/* =========================================================
   TECHNICIAN FLOATING SUPPORT
   OPEN SUPPORT CHAT
   GLOBAL
   ========================================================= */

document
    .getElementById(
        "technicianFloatingSupportButton"
    )
    ?.addEventListener(
        "click",
        async () => {

            await openSupportChat();

        }
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