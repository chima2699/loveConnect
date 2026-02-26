const token = localStorage.getItem("adminToken");
if (!token) location.href = "admin_login.html";

const headers = {
  "Authorization": "Bearer " + token,
  "Content-Type": "application/json"
};

async function loadWithdrawals() {
  const res = await fetch("/api/admin/withdrawals", { headers });
  const data = await res.json();

  const body = document.getElementById("withdrawBody");
  body.innerHTML = "";

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No withdrawals</td></tr>`;
    return;
  }

  data.forEach(w => {
    const fee = Math.round(w.coins * (w.feePercent / 100));
    const net = w.coins - fee;

    body.innerHTML += `
      <tr>
        <td>${w.username}</td>
        <td>${w.coins}</td>
        <td>${fee}</td>
        <td>${net}</td>
        <td>${w.bank?.bankName || "-"}<br>${w.bank?.accountNumber || "-"}</td>
        <td>
          <span class="badge ${w.status}">
            ${w.status.toUpperCase()}
          </span>
        </td>
        <td>
          ${w.status === "pending" ? `
            <button class="approve" onclick="approve('${w._id}')">Approve</button>
            <button class="reject" onclick="reject('${w._id}')">Reject</button>
          ` : "-"}
        </td>
      </tr>
    `;
  });
}

async function approve(id) {
  if (!confirm("Approve this withdrawal?")) return;
  await fetch(`/api/admin/withdrawals/${id}/approve`, {
    method: "POST",
    headers
  });
  loadWithdrawals();
}

async function reject(id) {
  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  await fetch(`/api/admin/withdrawals/${id}/reject`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason })
  });
  loadWithdrawals();
}

loadWithdrawals();
