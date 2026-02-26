(() => {
    const form = document.getElementById("registerForm");
    const btn = document.getElementById("registerBtn");
    const errorBox = document.getElementById("error");

    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    // If already logged in → redirect
    if (localStorage.getItem("token")) {
        location.replace("swipe.html");
        return;
    }

    function showError(msg) {
        errorBox.style.display = "block";
        errorBox.textContent = msg;
    }

    function clearError() {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    function sanitize(str) {
        return str.replace(/[<>]/g, "");
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearError();

        if (btn.disabled) return;

        const username = sanitize(usernameInput.value.trim());
        const email = sanitize(emailInput.value.trim());
        const password = passwordInput.value;

        if (!username || !email || !password) {
            return showError("All fields are required");
        }

        if (username.length < 3) {
            return showError("Username too short");
        }

        if (password.length < 6) {
            return showError("Password must be at least 6 characters");
        }

        btn.disabled = true;
        btn.textContent = "Creating account...";

        try {
            /* ---------- REGISTER ---------- */
            const registerRes = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, email, password })
            });

            const registerData = await registerRes.json();

            if (!registerRes.ok) {
                btn.disabled = false;
                btn.textContent = "Register";
                return showError(registerData.error || "Registration failed");
            }

            /* ---------- AUTO LOGIN ---------- */
            const loginRes = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const loginData = await loginRes.json();

            if (!loginRes.ok || !loginData.token) {
                btn.disabled = false;
                btn.textContent = "Register";
                return showError("Account created, but login failed");
            }

            /* ---------- SAVE SESSION ---------- */
            localStorage.setItem("token", loginData.token);
            localStorage.setItem("username", loginData.user.username);
            localStorage.setItem("email", loginData.user.email);

            /* ---------- REDIRECT ---------- */
            location.replace("swipe.html");

        } catch (err) {
            showError("Network error. Check your connection.");
            btn.disabled = false;
            btn.textContent = "Register";
        }
    });
})();
