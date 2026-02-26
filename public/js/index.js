/* ===============================
   LoveConnect – Auth Controller
   index.js
   =============================== */

(() => {
  "use strict";

  /* ---------- DOM ---------- */
  const form = document.getElementById("authForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const usernameInput = document.getElementById("username"); // optional (register only)
  const submitBtn = document.getElementById("submitBtn");
  const errorBox = document.getElementById("errorBox");

  if (!form || !emailInput || !passwordInput || !submitBtn) return;

  /* ---------- STATE ---------- */
  let isSubmitting = false;
  const MODE = form.dataset.mode || "login"; // login | register

  /* ---------- AUTO REDIRECT ---------- */
  if (localStorage.getItem("token")) {
    location.replace("swipe.html");
    return;
  }

  /* ---------- HELPERS ---------- */
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  function lockButton(text = "Please wait…") {
    submitBtn.disabled = true;
    submitBtn.textContent = text;
  }

  function unlockButton(text) {
    submitBtn.disabled = false;
    submitBtn.textContent = text;
  }

  /* ---------- SUBMIT ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (isSubmitting) return; // 🔒 prevent double submit
    isSubmitting = true;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput ? usernameInput.value.trim() : null;

    if (!email || !password || (MODE === "register" && !username)) {
      isSubmitting = false;
      return showError("All fields are required");
    }

    if (MODE === "register" && password.length < 6) {
      isSubmitting = false;
      return showError("Password must be at least 6 characters");
    }

    lockButton(MODE === "register" ? "Creating account…" : "Logging in…");

    try {
      const endpoint =
        MODE === "register" ? "/api/register" : "/api/login";

      const payload =
        MODE === "register"
          ? { username, email, password }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          data.errors?.[0]?.msg ||
          "Request failed"
        );
      }

      /* ---------- AUTO LOGIN AFTER REGISTER ---------- */
      if (MODE === "register") {
        const loginRes = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.token) {
          throw new Error("Account created, but auto-login failed");
        }

        saveSession(loginData);
      } else {
        saveSession(data);
      }

      location.replace("swipe.html");

    } catch (err) {
      showError(err.message || "Network error");
    } finally {
      isSubmitting = false;
      unlockButton(MODE === "register" ? "Create Account" : "Login");
    }
  });

  /* ---------- SESSION ---------- */
  function saveSession(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.user.username);
    localStorage.setItem("email", data.user.email);
  }

})();
