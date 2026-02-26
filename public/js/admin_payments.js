(() => {
"use strict";

const adminToken = localStorage.getItem("adminToken");
if (!adminToken) location.href = "admin_login.html";

fetch("/api/admin/payments", {
    headers: { Authorization: "Bearer " + adminToken }
})
.then(r => r.json())
.then(data => {
    const tbl = document.getElementById("tbl");
    data.reverse().forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.username}</td>
            <td>${p.coins}</td>
            <td>₦${p.amount}</td>
            <td class="${p.status}">${p.status}</td>
            <td>${p.reference}</td>
        `;
        tbl.appendChild(tr);
    });
});
})();
