document.addEventListener("DOMContentLoaded", function () {
    const locationChoices = document.querySelectorAll('input[name="serviceLocationType"]');
    const gpsSection = document.getElementById("gpsSection");
    const addressSection = document.getElementById("addressSection");
    const address = document.getElementById("serviceAddress");
    const latitude = document.getElementById("latitude");
    const longitude = document.getElementById("longitude");
    const mapsUrl = document.getElementById("googleMapsUrl");
    const status = document.getElementById("locationStatus");
    const capture = document.getElementById("captureLocationBtn");

    function setStatus(message, type) {
        status.textContent = message;
        status.className = "location-status " + (type || "");
    }

    function clearCoordinates() {
        latitude.value = "";
        longitude.value = "";
        mapsUrl.value = "";
    }

    function updateLocationRequirements() {
        const type = document.querySelector('input[name="serviceLocationType"]:checked');
        const homeOffice = type && type.value === "home_office";
        gpsSection.classList.toggle("d-none", !homeOffice);
        addressSection.classList.toggle("d-none", !homeOffice);
        address.required = Boolean(homeOffice);
        latitude.required = Boolean(homeOffice);
        longitude.required = Boolean(homeOffice);
        if (!homeOffice) {
            clearCoordinates();
            setStatus("", "");
        }
    }

    locationChoices.forEach(function (choice) { choice.addEventListener("change", updateLocationRequirements); });
    capture.addEventListener("click", function () {
        if (!navigator.geolocation) {
            setStatus("Location is not supported by this browser. Please use a supported browser to book a Home / Office visit.", "error");
            return;
        }
        capture.disabled = true;
        setStatus("Getting your current location…", "loading");
        navigator.geolocation.getCurrentPosition(function (position) {
            const lat = Number(position.coords.latitude);
            const lng = Number(position.coords.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                setStatus("We could not verify your location. Please try again.", "error");
                return;
            }
            latitude.value = lat.toFixed(7);
            longitude.value = lng.toFixed(7);
            mapsUrl.value = "https://www.google.com/maps/dir/?api=1&destination=" + latitude.value + "," + longitude.value;
            setStatus("Location captured successfully.", "success");
            capture.disabled = false;
        }, function (error) {
            clearCoordinates();
            const messages = {
                1: "Location permission was denied. Location is required for a Home / Office visit.",
                2: "Your location is unavailable. Please move to an area with GPS/network access and try again.",
                3: "Location request timed out. Please try again."
            };
            setStatus(messages[error.code] || "We could not get your location. Please try again.", "error");
            capture.disabled = false;
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
    });
});
