/*
 * Copy this file to runtime-config.js during deployment and set the two PUBLIC
 * Supabase values. Load runtime-config.js before app-config.js if used.
 * Never add SUPABASE_SERVICE_ROLE_KEY, Brevo, Formspree, or VAPID private keys.
 */
window.CFX_RUNTIME_CONFIG = {
    supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
    vapidPublicKey: "YOUR_VAPID_PUBLIC_KEY"
};
