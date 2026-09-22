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
        
        
        ,uploadPhoto: function (file, onProgress) {
    return new Promise(function (resolve, reject) {
        if (configurationError()) {
            reject(new Error("Booking service is not configured."));
            return;
        }

        const xhr = new XMLHttpRequest();

        xhr.open(
            "POST",
            window.CFX_CONFIG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/upload-photo",
            true
        );

        xhr.setRequestHeader(
            "apikey",
            window.CFX_CONFIG.supabaseAnonKey
        );

        xhr.setRequestHeader(
            "Authorization",
            "Bearer " + window.CFX_CONFIG.supabaseAnonKey
        );

        xhr.upload.addEventListener("progress", function (event) {
            if (event.lengthComputable && typeof onProgress === "function") {
                const percent = Math.round(
                    (event.loaded / event.total) * 100
                );

                onProgress(percent);
            }
        });

        xhr.addEventListener("load", function () {
            let payload = {};

            try {
                payload = JSON.parse(xhr.responseText || "{}");
            } catch (_) {
                payload = {};
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                reject(
                    new Error(
                        payload.error || "Photo upload failed."
                    )
                );
                return;
            }

            if (typeof onProgress === "function") {
                onProgress(100);
            }

            resolve(payload);
        });

        xhr.addEventListener("error", function () {
            reject(new Error("Photo upload failed. Please try again."));
        });

        xhr.addEventListener("abort", function () {
            reject(new Error("Photo upload was cancelled."));
        });

        const formData = new FormData();
        formData.append("photo", file);

        xhr.send(formData);
    });
}
    };
}());
