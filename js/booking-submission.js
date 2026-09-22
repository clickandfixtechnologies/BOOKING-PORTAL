document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("bookingForm");
    const summary = document.getElementById("bookingSummary");
    const submit = document.getElementById("submitBookingBtn");
    let submitting = false;
    if (!form) return;
    document.addEventListener("booking:stepchange", function (event) { if (event.detail.step === 4) renderSummary(); });
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (submitting || !form.checkValidity()) { form.classList.add("was-validated"); return; }
        const data = readBooking();
        if (data.service_location_type === "home_office" && (!data.latitude || !data.longitude || !data.service_address)) return showSubmissionError("A verified GPS location and service address are required for a Home / Office visit.");
        submitting = true; submit.disabled = true; submit.classList.add("btn-loading");
        try { const photo = document.getElementById("servicePhoto").files[0];

if (photo) {
    showPhotoUploadProgress(0);

    const upload = await window.BookingApi.uploadPhoto(
        photo,
        function (percent) {
            showPhotoUploadProgress(percent);
        }
    );

    showPhotoUploadProgress(100, true);

    data.photo_references = [upload.path];
} const result = await window.BookingApi.createAppointment(data); result.appointment.service = selectedText("serviceCategory") + (data.service_type ? " — " + selectedText("serviceType") : ""); result.appointment.location = document.querySelector('input[name="serviceLocationType"]:checked').nextElementSibling.textContent.trim(); sessionStorage.setItem("cfx-booking-confirmation", JSON.stringify(result.appointment)); window.location.assign("success.html"); }
        catch (error) { showSubmissionError(error.message || "We could not create your appointment. Please try again."); }
        finally { submitting = false; submit.disabled = false; submit.classList.remove("btn-loading"); }
    });
    function value(id) { return document.getElementById(id).value.trim(); }
    function selectedText(id) { const element = document.getElementById(id); return element.options[element.selectedIndex] ? element.options[element.selectedIndex].text : ""; }
    function readBooking() { const location = document.querySelector('input[name="serviceLocationType"]:checked'); return { customer_name: value("customerName"), mobile: value("mobile"), email: value("email"), service_category: value("serviceCategory"), service_type: value("serviceType") || null, problem_description: value("problemDescription") || null, service_location_type: location ? location.value : "", service_address: value("serviceAddress") || null, landmark: value("landmark") || null, latitude: value("latitude") || null, longitude: value("longitude") || null, google_maps_url: value("googleMapsUrl") || null, appointment_date: value("appointmentDate"), appointment_time: value("appointmentTime"), additional_notes: value("additionalNotes") || null }; }
    function renderSummary() { const data = readBooking(); const location = document.querySelector('input[name="serviceLocationType"]:checked'); const items = [["Service", selectedText("serviceCategory") + (data.service_type ? " — " + selectedText("serviceType") : "")], ["Location", location ? location.nextElementSibling.textContent.trim() : "—"], ["Date", data.appointment_date || "—"], ["Time", selectedText("appointmentTime") || "—"], ["Customer", data.customer_name || "—"], ["Mobile", data.mobile || "—"], ["Email", data.email || "—"]]; summary.innerHTML = items.map(function () { return '<div class="summary-item"><span class="summary-label"></span><strong class="summary-value"></strong></div>'; }).join(""); summary.querySelectorAll(".summary-item").forEach(function (row, index) { row.querySelector(".summary-label").textContent = items[index][0]; row.querySelector(".summary-value").textContent = items[index][1]; }); }
    function showSubmissionError(message) { let error = document.getElementById("submissionError"); if (!error) { error = document.createElement("div"); error.id = "submissionError"; error.className = "alert alert-danger mt-3"; submit.closest(".step-actions").before(error); } error.textContent = message; error.scrollIntoView({ behavior: "smooth", block: "center" }); }
});

function showPhotoUploadProgress(percent, completed) {

    const box =
        document.getElementById("photoUploadProgress");

    const bar =
        document.getElementById("photoUploadBar");

    const percentText =
        document.getElementById("photoUploadPercent");

    const status =
        document.getElementById("photoUploadStatus");

    if (!box || !bar || !percentText || !status) {
        return;
    }

    percent = Math.max(
        0,
        Math.min(100, Number(percent) || 0)
    );

    box.classList.remove("d-none");

    bar.style.width = percent + "%";

    percentText.textContent =
        percent + "%";

    box.setAttribute(
        "aria-valuenow",
        String(percent)
    );

    if (completed || percent >= 100) {

        status.textContent =
            "✓ Photo uploaded successfully";

        status.classList.remove("text-muted");
        status.classList.add("text-success");

        bar.classList.remove("bg-primary");
        bar.classList.add("bg-success");

    } else {

        status.textContent =
            "Uploading photo...";

        status.classList.remove("text-success");
        status.classList.add("text-muted");

        bar.classList.remove("bg-success");
        bar.classList.add("bg-primary");
    }
}