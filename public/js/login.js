"use strict";

/* -----------------------------------
   DOM ELEMENTS
----------------------------------- */
const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorBox = document.getElementById("error");
const loginBtn = document.getElementById("loginBtn");

/* -----------------------------------
   AUTO REDIRECT IF LOGGED IN
----------------------------------- */
if (localStorage.getItem("token")) {
    location.replace("swipe.html");
}

/* -----------------------------------
   HELPERS
----------------------------------- */
function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
}

function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
}

/* -----------------------------------
   PREVENT DOUBLE SUBMISSION
----------------------------------- */
let isSubmitting = false;

/* -----------------------------------
   LOGIN HANDLER
----------------------------------- */
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;
    loginBtn.disabled = true;
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showError("Please enter email and password.");
        resetSubmit();
        return;
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            showError(data.error || "Invalid login credentials");
            resetSubmit();
            return;
        }

        /* ✅ Store session safely */
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("email", data.user.email);

        /* ✅ Redirect */
        location.replace("swipe.html");

    } catch (err) {
        showError("Network error. Please try again.");
        resetSubmit();
    }
});

/* -----------------------------------
   RESET SUBMIT STATE
----------------------------------- */
function resetSubmit() {
    isSubmitting = false;
    loginBtn.disabled = false;
}
