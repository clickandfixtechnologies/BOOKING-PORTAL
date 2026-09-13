/*
 * Copy this file to runtime-config.js during deployment and set the two PUBLIC
 * Supabase values. Load runtime-config.js before app-config.js if used.
 * Never add SUPABASE_SERVICE_ROLE_KEY, Brevo, Formspree, or VAPID private keys.
 */
window.CFX_RUNTIME_CONFIG = {
    supabaseUrl: "https://arjmqjnykhdekbtujvil.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyam1xam55a2hkZWtidHVqdmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDAwNTksImV4cCI6MjEwNDg3NjA1OX0.KcRJ8ILqMp6JbZs23040TdF1-UDO2PZ0MzwHBg5qVaQ",
    vapidPublicKey: "YOUR_VAPID_PUBLIC_KEY"
};
