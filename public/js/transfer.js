/* ================================
   AUTH PROTECTION
================================ */
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token || !username) {
  location.replace("index.html");
}

function authHeaders() {
  return { Authorization: "Bearer " + token };
}

/* ================================
   STATE
================================ */
let allTransactions = [];
let currentPage = 1;
const LIMIT = 20;

/* ================================
   SAFE TEXT (ANTI-XSS)
================================ */
function safe(text = "") {
  return String(text).replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[s])
  );
}

/* ================================
   LOAD TRANSACTIONS (PAGINATED)
================================ */
async function loadTransactions(page = 1) {
  try {
    currentPage = page;

    const res = await fetch(
      `/api/transactions?page=${page}&limit=${LIMIT}`,
      { headers: authHeaders() }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to load transactions");
      return;
    }

    allTransactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    renderTransactions();
    updatePagination(data.hasMore);

  } catch (err) {
    console.error(err);
    document.getElementById("txContainer").innerHTML =
      `<p class="empty">Network error loading transactions.</p>`;
  }
}

/* ================================
   FILTER + SEARCH
================================ */
document.getElementById("typeFilter")?.addEventListener("change", renderTransactions);
document.getElementById("searchBox")?.addEventListener("input", renderTransactions);

/* ================================
   RENDER TRANSACTIONS
================================ */
function renderTransactions() {
  const type = document.getElementById("typeFilter")?.value || "";
  const search = (document.getElementById("searchBox")?.value || "").toLowerCase();

  const filtered = allTransactions.filter(t =>
    (!type || t.type === type) &&
    JSON.stringify(t).toLowerCase().includes(search)
  );

  const box = document.getElementById("txContainer");
  box.innerHTML = "";

  if (!filtered.length) {
    box.innerHTML = `<p class="empty">No transactions found.</p>`;
    return;
  }

  let html = `
    <table class="tx-table">
      <tr>
        <th>Type</th>
        <th>Coins</th>
        <th>Reference</th>
        <th>Date</th>
      </tr>
  `;

  filtered.forEach(t => {
    const isPositive = ["purchase","gift_received","bonus"].includes(t.type);
    const amountClass = isPositive ? "positive" : "negative";
    const amountText = (isPositive ? "+" : "-") + t.amount;

    html += `
      <tr>
        <td>${safe(t.type.replace("_"," "))}</td>
        <td class="${amountClass}">${amountText}</td>
        <td>${safe(t.reference || "-")}</td>
        <td>${new Date(t.createdAt).toLocaleString()}</td>
      </tr>
    `;
  });

  html += "</table>";
  box.innerHTML = html;
}

/* ================================
   PAGINATION
================================ */
function updatePagination(hasMore) {
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");

  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = !hasMore;
}

document.getElementById("prevPage")?.addEventListener("click", () => {
  if (currentPage > 1) loadTransactions(currentPage - 1);
});

document.getElementById("nextPage")?.addEventListener("click", () => {
  loadTransactions(currentPage + 1);
});

/* ================================
   INIT
================================ */
loadTransactions();
