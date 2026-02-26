const token = localStorage.getItem("token");
if (!token) location.href = "index.html";

const headers = {
  "Authorization": "Bearer " + token,
  "Content-Type": "application/json"
};

const balanceInput = document.getElementById("balance");
const amountInput = document.getElementById("amount");
const feeEl = document.getElementById("fee");
const netEl = document.getElementById("net");
const btn = document.getElementById("withdrawBtn");
const warning = document.getElementById("warning");

let config = {};
let balance = 0;

async function init() {
  // wallet
  const w = await fetch("/api/wallet/balance", { headers }).then(r=>r.json());
  balance = w.total;
  balanceInput.value = balance;

  // withdrawal config
  const c = await fetch("/api/withdraw/config", { headers }).then(r=>r.json());
  config = c;

  if (!c.phoneVerified) {
    warning.style.display = "block";
    warning.innerHTML = "⚠ Verify your phone number to withdraw.";
    btn.disabled = true;
  }
}
init();

amountInput.addEventListener("input", () => {
  const coins = Number(amountInput.value) || 0;
  const fee = Math.ceil(coins * (config.feePercent / 100));
  const net = coins - fee;

  feeEl.textContent = fee;
  netEl.textContent = net;
});

btn.onclick = async () => {
  const coins = Number(amountInput.value);

  if (coins < config.minCoins || coins > config.maxCoins) {
    alert(`Withdraw between ${config.minCoins} and ${config.maxCoins} coins`);
    return;
  }

  if (coins > balance) {
    alert("Insufficient balance");
    return;
  }

  btn.disabled = true;

  const res = await fetch("/api/withdraw/request", {
    method: "POST",
    headers,
    body: JSON.stringify({ coins })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Withdrawal failed");
    btn.disabled = false;
    return;
  }

  alert("Withdrawal request submitted for approval");
  location.href = "wallet.html";
};
