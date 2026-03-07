(() => {
  "use strict";

  /* ================= AUTH ================= */
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (!username || !token) {
    location.replace("index.html");
    return;
  }

  function auth() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    };
  }

  /* ================= STATE ================= */
  let currentPricing = null;
  let busy = false;
  let allUsers = [];

  /* ================= DOM ================= */
  const totalBal = document.getElementById("totalBal");
  const withdrawableBal = document.getElementById("withdrawableBal");
  const purchasedBal = document.getElementById("purchasedBal");
  const bonusBal = document.getElementById("bonusBal");

  const buyCoins = document.getElementById("buyCoins");
  const buyCalc = document.getElementById("buyCalc");
  const calcBtn = document.getElementById("calcBtn");
  const buyBtn = document.getElementById("buyBtn");

  const sendTo = document.getElementById("sendTo");
  const sendAmount = document.getElementById("sendAmount");
  const sendBtn = document.getElementById("sendBtn");

  const withdrawCoins = document.getElementById("withdrawCoins");
  const withdrawBtn = document.getElementById("withdrawBtn");
  const withdrawNote = document.getElementById("withdrawNote");

  const txList = document.getElementById("txList");
  const suggestionsBox = document.getElementById("userSuggestions");

  /* =====================================================
     LOAD PRICING (JSON CONFIG)
  ===================================================== */
  async function loadPricing() {
    try {
      const res = await fetch("/api/config/public");
      if (!res.ok) return;

      const data = await res.json();
      if (typeof data.coinPrice === "number") {
        currentPricing = data;
      }
    } catch (err) {
      console.warn("Pricing load failed");
    }
  }

  /* =====================================================
     SOCKET
  ===================================================== */
  const socket = io({
    auth: { token },
    transports: ["websocket"]
  });

  socket.on("pricing:update", data => {
    if (data && typeof data.coinPrice === "number") {
      currentPricing = data;
      const coins = Number(buyCoins?.value);
      if (coins > 0) updatePreview(coins);
    }
  });

  socket.on("wallet_update", d => {
    if (d.username === username) {
      loadBalance();
      loadTransactions();
    }
  });

  /* =====================================================
     BALANCE
  ===================================================== */
  async function loadBalance() {
    try {
      const res = await fetch("/api/wallet/balance", { headers: auth() });
      if (!res.ok) throw new Error();

      const b = await res.json();

      totalBal.textContent = b.total || 0;
      purchasedBal.textContent = b.purchased || 0;
      bonusBal.textContent = b.bonus || 0;

      withdrawableBal.textContent =
        Math.max(0, (b.total || 0) - (b.bonus || 0));

    } catch {
      totalBal.textContent = "0";
      purchasedBal.textContent = "0";
      bonusBal.textContent = "0";
      withdrawableBal.textContent = "0";
    }
  }

  /* =====================================================
     TRANSACTIONS
  ===================================================== */
 async function loadTransactions() {
  if (!txList) return;

  txList.innerHTML =
    "<p style='color:#777;text-align:center'>Loading transactions...</p>";

  try {
    const res = await fetch("/api/wallet/transactions", { headers: auth() });

    if (!res.ok) {
      throw new Error("Failed to fetch transactions");
    }

    const data = await res.json();
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    if (!transactions.length) {
      txList.innerHTML =
        "<p style='color:#777;text-align:center'>No transactions yet</p>";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Coins</th>
            <th>Reference</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    transactions.forEach(tx => {
      const coins = Number(tx.coins ?? tx.amount ?? 0);
      const positive = coins > 0;

      const type = (tx.type || "unknown")
        .replace(/_/g, " ")
        .toUpperCase();

      const reference = tx.reference
        ? escapeHtml(tx.reference)
        : "-";

      const dateValue = tx.createdAt || tx.timestamp;
      const formattedDate = dateValue
        ? new Date(dateValue).toLocaleString()
        : "-";

      html += `
        <tr>
          <td>${type}</td>
          <td class="${positive ? "green" : "red"}">
            ${positive ? "+" : ""}${coins}
          </td>
          <td>${reference}</td>
          <td>${formattedDate}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    txList.innerHTML = html;

  } catch (err) {
    console.error("Transaction load error:", err);

    txList.innerHTML =
      "<p style='color:red;text-align:center'>Failed to load transactions</p>";
  }
}


  function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[m]);
}


  /* =====================================================
     BUY PREVIEW
  ===================================================== */
  function updatePreview(coins) {
    const cost = coins * currentPricing.coinPrice;
    buyCalc.textContent = `${coins} coins = ₦${cost.toFixed(2)}`;
    buyBtn.style.display = "block";
  }

  calcBtn?.addEventListener("click", () => {
    const coins = Number(buyCoins.value);
    if (!coins || coins <= 0) return alert("Enter valid coin amount");

    if (!currentPricing) return alert("Pricing not loaded");

    updatePreview(coins);
  });

  /* =====================================================
     BUY COINS
  ===================================================== */
  buyBtn?.addEventListener("click", async () => {
    if (busy) return;

    const coins = Number(buyCoins.value);
    if (!coins || coins <= 0) return;

    if (!currentPricing) return alert("Pricing not loaded");

    busy = true;
    buyBtn.disabled = true;

    try {
      const res = await fetch("/api/paystack/init", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ coins })
      });

      const json = await res.json();
      if (!json.authorization_url) throw new Error();

      window.location.href = json.authorization_url;

    } catch {
      alert("Payment failed");
      buyBtn.disabled = false;
      busy = false;
    }
  });

  /* =====================================================
     SEND COINS
  ===================================================== */
  sendBtn?.addEventListener("click", async () => {
    if (busy) return;

    const to = sendTo.value.trim();
    const coins = Number(sendAmount.value);

    if (!to || !coins || coins <= 0)
      return alert("Invalid details");

    if (to === username)
      return alert("Cannot send to yourself");

    busy = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch("/api/wallet/coins/gift", {
  method:"POST",
  headers:auth(),
  body:JSON.stringify({to,amount:coins})
});

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert("Coins sent 🎁");

      sendTo.value = "";
      sendAmount.value = "";

      loadBalance();
      loadTransactions();

    } catch (err) {
      alert(err.message || "Transfer failed");
    }

    busy = false;
    sendBtn.disabled = false;
  });

  /* =====================================================
     WITHDRAW
  ===================================================== */
  withdrawBtn?.addEventListener("click", async () => {
    if (busy) return;

    const coins = Number(withdrawCoins.value);
    if (!coins || coins <= 0)
      return alert("Invalid amount");

    if (!confirm(`Withdraw ${coins} coins?`)) return;

    busy = true;
    withdrawBtn.disabled = true;

    try {
      const res = await fetch("/api/wallet/withdraw/request", {
  method:"POST",
  headers:auth(),
  body:JSON.stringify({coins})
});

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      withdrawCoins.value = "";
      withdrawNote.textContent = "Withdrawal submitted ⏳";

      loadBalance();
      loadTransactions();

    } catch (err) {
      alert(err.message || "Withdrawal failed");
    }

    busy = false;
    withdrawBtn.disabled = false;
  });

  /* =====================================================
     USER SUGGESTIONS
  ===================================================== */
  async function loadUserSuggestions() {
    try {
      const res = await fetch("/api/users/all", { headers: auth() });
      const users = await res.json();
      allUsers = users.map(u => u.username)
        .filter(u => u !== username);
    } catch {
      allUsers = [];
    }
  }

  sendTo?.addEventListener("input", () => {
    const q = sendTo.value.toLowerCase();
    suggestionsBox.innerHTML = "";

    if (!q) return (suggestionsBox.style.display = "none");

    const matches = allUsers
      .filter(u => u.toLowerCase().includes(q))
      .slice(0, 6);

    if (!matches.length)
      return (suggestionsBox.style.display = "none");

    matches.forEach(name => {
      const d = document.createElement("div");
      d.textContent = name;
      d.onclick = () => {
        sendTo.value = name;
        suggestionsBox.style.display = "none";
      };
      suggestionsBox.appendChild(d);
    });

    suggestionsBox.style.display = "block";
  });

  /* =====================================================
     INIT
  ===================================================== */
  (async () => {
    await loadPricing();
    await loadBalance();
    await loadTransactions();
    await loadUserSuggestions();
  })();

})();
