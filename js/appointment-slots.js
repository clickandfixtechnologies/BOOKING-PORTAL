/* Availability is displayed client-side but is always rechecked by the server on booking. */
document.addEventListener("DOMContentLoaded", function () {
    const appointmentDate = document.getElementById("appointmentDate");
    const appointmentTime = document.getElementById("appointmentTime");
    const slotMessage = document.getElementById("slotMessage");
    let requestedDate = "";
    if (!appointmentDate || !appointmentTime) return;
    appointmentDate.min = localDate();
    appointmentTime.disabled = true;
    setMessage("Please select an appointment date first.", "info");
    appointmentDate.addEventListener("change", async function () {
        const date = appointmentDate.value;
        // Invalidate any in-flight response before clearing the old options.
        requestedDate = date;
        clearTimeSlots();
        if (!date) return disable("Please select an appointment date first.", "info");
        if (date < localDate()) { appointmentDate.value = ""; return disable("Please select today or a future date.", "error"); }
        appointmentTime.disabled = true;
        setMessage("Checking available slots…", "info");
        try {
            const result = await window.BookingApi.getAvailability(date);
            if (requestedDate !== date) return;
            addSlots(result.slots || []);
            if (!result.slots || result.slots.length === 0) return disable(result.message || "No appointment slots are available for this date.", "error");
            appointmentTime.disabled = false;
            setMessage(result.message || "Please select an available appointment time.", "info");
        } catch (error) { if (requestedDate === date) disable(error.message, "error"); }
    });
    function addSlots(slots) { slots.forEach(function (slot) { const option = document.createElement("option"); option.value = slot.value; option.textContent = slot.label; appointmentTime.appendChild(option); }); }
    function clearTimeSlots() { appointmentTime.innerHTML = '<option value="" selected disabled>Select time</option>'; appointmentTime.value = ""; }
    function disable(message, type) { appointmentTime.disabled = true; setMessage(message, type); }
    function localDate() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());
        const value = function (type) {
            const part = parts.find(function (item) { return item.type === type; });
            return part ? part.value : "";
        };
        return value("year") + "-" + value("month") + "-" + value("day");
    }
    function setMessage(message, type) { slotMessage.textContent = message; slotMessage.className = "slot-message mt-3 " + (type || ""); }
});
