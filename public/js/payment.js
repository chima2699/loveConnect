(() => {
    "use strict";

    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!token || !username) {
        location.replace("index.html");
        return;
    }

    const coinsInput = document.getElementById("coinsInput");
    const calcBtn = document.getElementById("calcBtn");
    const summary = document.getElementById("summary");
    const methods = document.getElementById("paymentMethods");

    const paystackBtn = document.getElementById("paystackBtn");
    const flutterwaveBtn = document.getElementById("flutterwaveBtn");
    const stripeBtn = document.getElementById("stripeBtn");

    let coins = 0;
    let amount = 0;
    let locked = false;

    const auth = () => ({
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    });

    /* ----------------------------
       Calculate price (SERVER-TRUSTED)
    ----------------------------- */
    calcBtn.addEventListener("click", async () => {
        if (locked) return;

        coins = Number(coinsInput.value);
        if (!coins || coins < 1) {
            alert("Enter a valid coin amount");
            return;
        }

        locked = true;
        calcBtn.disabled = true;

        try {
            const res = await fetch("/api/pay/quote", {
                method: "POST",
                headers: auth(),
                body: JSON.stringify({ coins })
            });

            if (!res.ok) throw new Error("Quote failed");

            const data = await res.json();
            amount = data.amount;

            summary.style.display = "block";
            summary.innerHTML = `
                <b>Coins:</b> ${coins}<br>
                <b>Total:</b> ₦${amount.toFixed(2)}
            `;

            methods.style.display = "block";
        } catch {
            alert("Unable to calculate price");
        } finally {
            locked = false;
            calcBtn.disabled = false;
        }
    });

    /* ----------------------------
       Payment Redirects
    ----------------------------- */
    function startPayment(gateway) {
        if (locked) return;
        locked = true;

        window.location.href =
            `/api/pay/${gateway}?coins=${coins}`;
    }

    paystackBtn.onclick = () => startPayment("paystack");
    flutterwaveBtn.onclick = () => startPayment("flutterwave");
    stripeBtn.onclick = () => startPayment("stripe");

})();
