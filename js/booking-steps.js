document.addEventListener("DOMContentLoaded", function () {

    const bookingForm = document.getElementById("bookingForm");

    if (!bookingForm) {
        console.error("Booking form not found.");
        return;
    }

    const steps = document.querySelectorAll(".booking-step");
    const progressSteps = document.querySelectorAll(".booking-progress .progress-step");

    let currentStep = 1;


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
                field.classList.toggle("is-invalid", !field.checked);
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
       NEXT BUTTON
       ===================================================== */

    const nextButtons = document.querySelectorAll(".next-step");

    nextButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const nextStep = Number(button.dataset.next);

            if (!nextStep) {
                return;
            }


            /* Validate current step first */

            if (!validateStep(currentStep)) {
                return;
            }


            showStep(nextStep);

        });

    });


    /* =====================================================
       BACK BUTTON
       ===================================================== */

    const backButtons = document.querySelectorAll(".previous-step");

    backButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const previousStep = Number(button.dataset.previous);

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

