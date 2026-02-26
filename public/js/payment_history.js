(() => {
"use strict";

const token = localStorage.getItem("token");
if (!token) location.href = "index.html";

fetch("/api/pay/history", {
    headers: { Authorization: "Bearer " + token }
})
.then(r => r.json())
.then(data => {
    const list = document.getElementById("list");
    if (!data.length) {
        list.innerHTML = "<p style='text-align:center;color:#777'>No payments yet</p>";
        return;
    }

    data.reverse().forEach(p => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            <b>${p.coins} coins</b><br>
            ₦${p.amount}<br>
            <span class="status-${p.status}">${p.status.toUpperCase()}</span>
            <div class="small">${new Date(p.createdAt).toLocaleString()}</div>
        `;
        list.appendChild(div);
    });
});
})();
