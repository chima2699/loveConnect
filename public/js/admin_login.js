(() => {
"use strict";

/* ========================
   ELEMENTS
======================== */
const loginForm = document.getElementById("loginForm");
const otpForm   = document.getElementById("otpForm");

const emailInput = document.getElementById("email");
const passInput  = document.getElementById("password");
const otpInput   = document.getElementById("otp");

const loginBtn = document.getElementById("loginBtn");
const otpBtn   = document.getElementById("otpBtn");

const errorBox = document.getElementById("error");

/* ========================
   SECURITY HELPERS
======================== */
function showError(msg){
    errorBox.style.display = "block";
    errorBox.innerText = msg;
}
function clearError(){
    errorBox.style.display = "none";
    errorBox.innerText = "";
}
function disable(btn){
    btn.disabled = true;
}
function enable(btn){
    btn.disabled = false;
}

/* ========================
   AUTO REDIRECT IF LOGGED
======================== */
if (localStorage.getItem("adminToken")) {
    location.replace("admin.html");
}

/* ========================
   STEP 1: LOGIN
======================== */
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    clearError();
    disable(loginBtn);

    const email = emailInput.value.trim();
    const password = passInput.value.trim();

    try {
        const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({
                username: email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            enable(loginBtn);
            return showError(data.error || "Login failed");
        }

        localStorage.setItem("adminToken", data.token);
        location.replace("admin.html");

    } catch {
        enable(loginBtn);
        showError("Network error");
    }
});


/* ========================
   STEP 2: OTP VERIFY
======================== */
otpForm.addEventListener("submit", async e => {
    e.preventDefault();
    clearError();
    disable(otpBtn);

    const otp = otpInput.value.trim();
    const email = emailInput.value.trim();

    if (!otp || otp.length !== 6) {
        enable(otpBtn);
        return showError("Enter valid 6-digit OTP");
    }

    try {
        const res = await fetch("/api/admin/verify-otp", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            enable(otpBtn);
            return showError(data.error || "OTP verification failed");
        }

        localStorage.setItem("adminToken", data.token);
        location.replace("admin.html");

    } catch {
        enable(otpBtn);
        showError("Network error");
    }
});

})();
