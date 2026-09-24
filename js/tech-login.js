import {
    createClient
} from "https://esm.sh/@supabase/supabase-js@2";


const c = window.CFX_CONFIG || {};


const sb =
    c.supabaseUrl &&
    createClient(
        c.supabaseUrl,
        c.supabaseAnonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        }
    );


const form =
    document.getElementById("techLoginForm");

const email =
    document.getElementById("email");

const password =
    document.getElementById("password");

const signIn =
    document.getElementById("signIn");

const loginError =
    document.getElementById("loginError");

    const togglePassword =
    document.getElementById("togglePassword");


togglePassword?.addEventListener(
    "click",
    () => {

        const isHidden =
            password.type === "password";


        password.type =
            isHidden
                ? "text"
                : "password";


        togglePassword.innerHTML =
            isHidden
                ? '<i class="fa-regular fa-eye-slash"></i>'
                : '<i class="fa-regular fa-eye"></i>';


        togglePassword.setAttribute(
            "aria-label",
            isHidden
                ? "Hide password"
                : "Show password"
        );


        togglePassword.title =
            isHidden
                ? "Hide password"
                : "Show password";

    }
);

/*
 * If a valid technician session already exists,
 * there is no reason to show the login page.
 */
async function checkExistingSession() {

    if (!sb) {
        loginError.textContent =
            "Technician portal is not configured.";

        return;
    }


    const {
        data
    } = await sb.auth.getSession();


    if (data?.session) {

        window.location.replace(
            "./index.html"
        );

    }

}


checkExistingSession();


/*
 * Technician login
 */

form?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!sb) {

            loginError.textContent =
                "Technician portal is not configured.";

            return;

        }


        const loginEmail =
            email.value.trim();

        const loginPassword =
            password.value;


        if (
            !loginEmail ||
            !loginPassword
        ) {

            loginError.textContent =
                "Enter your technician email and password.";

            return;

        }


        signIn.disabled = true;

        signIn.textContent =
            "Signing in...";

        loginError.textContent = "";


        try {

            const {
                error
            } =
                await sb.auth.signInWithPassword({
                    email: loginEmail,
                    password: loginPassword
                });


            if (error) {
                throw error;
            }


            /*
             * Login successful.
             *
             * Go to the separate technician dashboard.
             */

            window.location.replace(
                "./index.html"
            );


        } catch (error) {

            loginError.textContent =
                error.message ||
                "Unable to sign in.";


            signIn.disabled = false;

            signIn.textContent =
                "Sign in";

        }

    }
);