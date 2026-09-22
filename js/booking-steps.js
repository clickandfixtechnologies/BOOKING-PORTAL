document.addEventListener("DOMContentLoaded", function () {

    const bookingForm = document.getElementById("bookingForm");

    if (!bookingForm) {
        console.error("Booking form not found.");
        return;
    }

    const steps = document.querySelectorAll(".booking-step");
    const progressSteps = document.querySelectorAll(".booking-progress .progress-step");

    let currentStep = 1;
    let photoUploading = false;


    /* =====================================================
       SHOW STEP
       ===================================================== */

    function showStep(stepNumber) {

        currentStep = stepNumber;

        steps.forEach(function (step) {

            const stepValue = Number(step.dataset.step);

            if (stepValue === stepNumber) {
                step.classList.add("active");
            } else {
                step.classList.remove("active");
            }

        });


        /* Update progress indicators */

        progressSteps.forEach(function (step, index) {

            const stepNumberFromProgress = index + 1;

            if (stepNumberFromProgress <= stepNumber) {
                step.classList.add("active");
            } else {
                step.classList.remove("active");
            }

        });


        /* Scroll to top of booking area */

        const progress = document.querySelector(".booking-progress");

        if (progress) {
            progress.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }


        document.dispatchEvent(new CustomEvent("booking:stepchange", {
            detail: { step: stepNumber }
        }));

    }


    /* =====================================================
       VALIDATE CURRENT STEP
       ===================================================== */

    function validateStep(stepNumber) {

        const currentSection = document.querySelector(
            `.booking-step[data-step="${stepNumber}"]`
        );

        if (!currentSection) {
            return true;
        }

        const requiredFields = currentSection.querySelectorAll(
            "input[required], select[required], textarea[required]"
        );

        let valid = true;

        requiredFields.forEach(function (field) {

            if (field.type === "radio") {

                const group = currentSection.querySelectorAll(
                    `input[type="radio"][name="${field.name}"]`
                );

                const selected = Array.from(group).some(function (item) {
                    return item.checked;
                });

                group.forEach(function (item) {
                    item.classList.toggle("is-invalid", !selected);
                });

                valid = valid && selected;

                return;
            }


            if (field.type === "checkbox") {

                field.classList.toggle(
                    "is-invalid",
                    !field.checked
                );

                valid = valid && field.checked;

                return;
            }


            if (!field.value.trim()) {

                field.classList.add("is-invalid");

                valid = false;

            } else {

                field.classList.remove("is-invalid");

            }

        });


        /* Remove invalid state when user changes the field */

        requiredFields.forEach(function (field) {

            field.addEventListener("input", function () {

                if (field.value.trim()) {
                    field.classList.remove("is-invalid");
                }

            });

            field.addEventListener("change", function () {

                if (field.value.trim()) {
                    field.classList.remove("is-invalid");
                }

            });

        });


        if (!valid) {

            const firstInvalid = currentSection.querySelector(
                ".is-invalid"
            );

            if (firstInvalid) {
                firstInvalid.focus();
            }

        }


        return valid;

    }


    /* =====================================================
       PHOTO FILE CHANGE
       ===================================================== */

    const photoInput = document.getElementById("servicePhoto");

    if (photoInput) {

        photoInput.addEventListener("change", function () {

            /*
             * If customer selects a different photo,
             * previous uploaded photo reference is no longer valid.
             */

            window.CFX_uploadedPhotoPath = null;


            const progressBox =
                document.getElementById("photoUploadProgress");

            const progressBar =
                document.getElementById("photoUploadBar");

            const progressText =
                document.getElementById("photoUploadPercent");

            const progressStatus =
                document.getElementById("photoUploadStatus");


            if (progressBox) {
                progressBox.classList.add("d-none");
            }

            if (progressBar) {
                progressBar.style.width = "0%";
            }

            if (progressText) {
                progressText.textContent = "0%";
            }

            if (progressStatus) {
                progressStatus.textContent = "Uploading photo...";
                progressStatus.classList.remove("text-success");
                progressStatus.classList.add("text-muted");
            }

        });

    }


    /* =====================================================
       NEXT BUTTON
       ===================================================== */

    const nextButtons = document.querySelectorAll(".next-step");

    nextButtons.forEach(function (button) {

        button.addEventListener("click", async function () {

            const nextStep = Number(button.dataset.next);

            if (!nextStep) {
                return;
            }


            /* Prevent duplicate clicks while uploading */

            if (photoUploading) {
                return;
            }


            /* Validate current step first */

            if (!validateStep(currentStep)) {
                return;
            }


            /* =================================================
               PHOTO UPLOAD ON STEP 2 → CONTINUE
               ================================================= */

            if (
                currentStep === 2 &&
                photoInput &&
                photoInput.files &&
                photoInput.files.length > 0
            ) {

                const photo = photoInput.files[0];


                /* 5 MB limit */

                const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

                if (photo.size > MAX_PHOTO_SIZE) {

                    showPhotoUploadError(
                        "Photo size must be 5 MB or smaller."
                    );

                    return;
                }


                /* Make sure upload API exists */

                if (
                    !window.BookingApi ||
                    typeof window.BookingApi.uploadPhoto !== "function"
                ) {

                    showPhotoUploadError(
                        "Photo upload service is unavailable. Please try again."
                    );

                    return;
                }


                photoUploading = true;

                button.disabled = true;

                button.classList.add("btn-loading");


                try {

                    /*
                     * Show 0% IMMEDIATELY
                     * when Continue is clicked.
                     */

                    showPhotoUploadProgress(0);


                    const upload =
                        await window.BookingApi.uploadPhoto(
                            photo,
                            function (percent) {

                                showPhotoUploadProgress(
                                    percent
                                );

                            }
                        );


                    /*
                     * Save uploaded photo path globally.
                     * Final appointment submission will use this.
                     */

                    window.CFX_uploadedPhotoPath =
                        upload.path;


                    showPhotoUploadProgress(
                        100,
                        true
                    );


                    /*
                     * Small delay so customer can actually
                     * see the 100% success state.
                     */

                    await new Promise(function (resolve) {
                        setTimeout(resolve, 500);
                    });


                } catch (error) {

                    console.error(
                        "Photo upload failed:",
                        error
                    );

                    window.CFX_uploadedPhotoPath = null;

                    showPhotoUploadError(
                        error.message ||
                        "Photo upload failed. Please try again."
                    );

                    return;

                } finally {

                    photoUploading = false;

                    button.disabled = false;

                    button.classList.remove(
                        "btn-loading"
                    );

                }

            }


            /*
             * No photo selected OR photo uploaded successfully.
             * Now move to next step.
             */

            showStep(nextStep);

        });

    });


    /* =====================================================
       BACK BUTTON
       ===================================================== */

    const backButtons =
        document.querySelectorAll(".previous-step");

    backButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const previousStep =
                Number(button.dataset.previous);

            if (!previousStep) {
                return;
            }

            showStep(previousStep);

        });

    });


    /* =====================================================
       INITIAL STATE
       ===================================================== */

    showStep(1);

});


/* =========================================================
   PHOTO UPLOAD ERROR
   ========================================================= */

function showPhotoUploadError(message) {

    let error =
        document.getElementById("photoUploadError");


    if (!error) {

        error = document.createElement("div");

        error.id = "photoUploadError";

        error.className =
            "alert alert-danger mt-3 mb-0";

        const photoInput =
            document.getElementById("servicePhoto");

        if (photoInput) {

            photoInput.parentElement.appendChild(
                error
            );

        }

    }


    error.textContent = message;

    error.classList.remove("d-none");

    error.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================================================
   PHOTO UPLOAD PROGRESS
   ========================================================= */

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

        console.error(
            "Photo upload progress elements not found."
        );

        return;
    }


    percent = Math.max(
        0,
        Math.min(
            100,
            Number(percent) || 0
        )
    );


    /* Make progress box visible */

    box.classList.remove("d-none");


    /* Update progress */

    bar.style.width =
        percent + "%";

    percentText.textContent =
        percent + "%";


    if (completed || percent >= 100) {

        status.textContent =
            "✓ Photo uploaded successfully";

        status.classList.remove(
            "text-muted"
        );

        status.classList.add(
            "text-success"
        );

        bar.classList.remove(
            "bg-primary"
        );

        bar.classList.add(
            "bg-success"
        );

    } else {

        status.textContent =
            "Uploading photo...";

        status.classList.remove(
            "text-success"
        );

        status.classList.add(
            "text-muted"
        );

        bar.classList.remove(
            "bg-success"
        );

        bar.classList.add(
            "bg-primary"
        );

    }

}