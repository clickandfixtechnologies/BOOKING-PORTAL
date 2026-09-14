import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CFX_CONFIG || {};
const form = document.getElementById("adminLoginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const error = document.getElementById("loginError");
const submit = document.getElementById("signIn");
const toggle = document.getElementById("togglePassword");
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;

function showError(message) { error.textContent = message; }
function setBusy(busy) { submit.disabled = busy; submit.textContent = busy ? "Signing in…" : "Sign in"; }

toggle.addEventListener("click", () => {
  const hidden = password.type === "password";
  password.type = hidden ? "text" : "password";
  toggle.textContent = hidden ? "Hide" : "Show";
  toggle.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  if (!supabase) return showError("Administrator sign-in is not configured.");
  if (!email.value.trim() || !password.value) return showError("Enter your email address and password.");
  setBusy(true);
  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (signInError) throw signInError;
    location.replace("./");
  } catch (cause) {
    showError(cause?.message === "Invalid login credentials" ? "The email address or password is incorrect." : (cause?.message || "Sign-in could not be completed. Check your connection and try again."));
  } finally { setBusy(false); }
});

if (supabase) supabase.auth.getSession().then(({ data: { session } }) => { if (session) location.replace("./"); });
