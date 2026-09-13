document.addEventListener("DOMContentLoaded", function () {

    const serviceCategory = document.getElementById("serviceCategory");
    const serviceType = document.getElementById("serviceType");

    if (!serviceCategory || !serviceType) {
        console.error("Service category or service type element not found.");
        return;
    }

    const serviceOptions = {

        computer_laptop: [
            ["laptop_repair", "Laptop Repair"],
            ["desktop_repair", "Desktop / Computer Repair"],
            ["windows_software", "Windows / Software Installation"],
            ["ssd_upgrade", "SSD Upgrade / Replacement"],
            ["ram_upgrade", "RAM Upgrade / Replacement"],
            ["motherboard_repair", "Motherboard Repair"],
            ["other_computer", "Other Computer / Laptop Service"]
        ],

        cctv: [
            ["new_cctv_installation", "New CCTV Installation"],
            ["cctv_repair", "CCTV Repair / Service"],
            ["camera_replacement", "Camera Replacement"],
            ["dvr_nvr_service", "DVR / NVR Service"],
            ["cctv_configuration", "CCTV Configuration"],
            ["other_cctv", "Other CCTV Service"]
        ],

        data_recovery: [
            ["hard_disk_recovery", "Hard Disk Data Recovery"],
            ["ssd_data_recovery", "SSD Data Recovery"],
            ["pendrive_recovery", "Pen Drive / USB Data Recovery"],
            ["memory_card_recovery", "Memory Card Data Recovery"],
            ["other_data_recovery", "Other Data Recovery"]
        ],

        networking_it: [
            ["network_setup", "Network Setup"],
            ["router_configuration", "Router Configuration"],
            ["wifi_troubleshooting", "Wi-Fi Troubleshooting"],
            ["lan_cabling", "LAN / Network Cabling"],
            ["it_support", "General IT Support"],
            ["other_networking", "Other Networking / IT Service"]
        ],

        printer_peripheral: [
            ["printer_repair", "Printer Repair / Service"],
            ["printer_installation", "Printer Installation"],
            ["printer_configuration", "Printer Configuration"],
            ["scanner_service", "Scanner Service"],
            ["peripheral_service", "Other Peripheral Service"]
        ],

        other: [
            ["other_service", "Other Service"]
        ]

    };


    function resetServiceType() {

        serviceType.innerHTML = "";

        const defaultOption = document.createElement("option");

        defaultOption.value = "";
        defaultOption.textContent = "Select service type";
        defaultOption.selected = true;
        defaultOption.disabled = true;

        serviceType.appendChild(defaultOption);

        serviceType.disabled = true;
    }


    function updateServiceType() {

        const category = serviceCategory.value;

        resetServiceType();

        if (!category) {
            return;
        }

        const options = serviceOptions[category];

        if (!options) {
            return;
        }

        options.forEach(function (item) {

            const option = document.createElement("option");

            option.value = item[0];
            option.textContent = item[1];

            serviceType.appendChild(option);

        });

        serviceType.disabled = false;
    }


    serviceCategory.addEventListener("change", updateServiceType);


    resetServiceType();

});
