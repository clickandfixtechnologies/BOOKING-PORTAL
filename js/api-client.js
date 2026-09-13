(function () {
    function configurationError() {
        if (!window.CFX_CONFIG || !window.CFX_CONFIG.supabaseAnonKey) {
            return true;
        }

        try {
            const url = new URL(window.CFX_CONFIG.supabaseUrl);
            return url.protocol !== "https:";
        } catch (_) {
            return true;
        }
    }

    async function invoke(functionName, body) {
        if (configurationError()) {
            throw new Error("Booking service configuration is incomplete. Please contact Click & Fix Technologies.");
        }

        const response = await fetch(
            window.CFX_CONFIG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + functionName,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": window.CFX_CONFIG.supabaseAnonKey,
                    "Authorization": "Bearer " + window.CFX_CONFIG.supabaseAnonKey
                },
                body: JSON.stringify(body || {})
            }
        );

        const payload = await response.json().catch(function () { return {}; });
        if (!response.ok) {
            throw new Error(payload.error || "The booking service is temporarily unavailable.");
        }
        return payload;
    }

    window.BookingApi = {
        getAvailability: function (date) { return invoke("availability", { date: date }); },
        createAppointment: function (booking) { return invoke("book-appointment", booking); },
        registerPushSubscription: function (subscription) { return invoke("register-push-subscription", subscription); }
        ,uploadPhoto: async function (file) {
            if (configurationError()) throw new Error("Booking service is not configured.");
            const formData = new FormData(); formData.append("photo", file);
            const response = await fetch(window.CFX_CONFIG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/upload-photo", { method: "POST", headers: { "apikey": window.CFX_CONFIG.supabaseAnonKey, "Authorization": "Bearer " + window.CFX_CONFIG.supabaseAnonKey }, body: formData });
            const payload = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(payload.error || "Photo upload failed.");
            return payload;
        }
    };
}());
