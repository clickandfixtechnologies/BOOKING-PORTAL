/*
 * Public browser configuration only. Never put a service-role key here.
 *
 * A production host may inject `window.CFX_RUNTIME_CONFIG` before this file,
 * or the deployment may set these public values directly below.  Preserving an
 * injected value fixes the previous behaviour where this file overwrote it
 * with empty strings on every page load.
 */
(function () {
    const injected = window.CFX_RUNTIME_CONFIG || window.CFX_CONFIG || {};

    window.CFX_CONFIG = {
        supabaseUrl: injected.supabaseUrl || "",
        supabaseAnonKey: injected.supabaseAnonKey || "",
        vapidPublicKey: injected.vapidPublicKey || ""
    };
}());
