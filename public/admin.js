(() => {
  "use strict";

  /* =====================================================
     AUTH & TOKEN HANDLING
  ===================================================== */
  const token = localStorage.getItem("adminToken");
  const adminUsername = localStorage.getItem("adminUsername") || "admin";

const socket = io("http://localhost:5000");

socket.on("connect", ()=>{
 console.log("Admin socket connected");
});

socket.on("admin:dashboard_update", ()=>{

 loadUsers();
});


socket.on("admin:dashboard_update", ()=>{
 loadDashboard();
 loadSettings();
});

  if (!token) {
    location.replace("admin_login.html");
    return;
  }

  function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}


  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "x-admin-token": token
    };
  }

  /* =====================================================
     DOM HELPER
  ===================================================== */
  const $ = id => document.getElementById(id);

  /* =====================================================
     API CALLER (with better error handling)
  ===================================================== */
  async function api(url, options = {}) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders(),
          ...(options.headers || {})
        }
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status} - ${res.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`API error (${url}):`, err);
      throw err; // Let caller handle UI feedback
    }
  }

  /* =====================================================
     NAVIGATION
  ===================================================== */
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;

      if (page === "logout") {
        localStorage.removeItem("adminToken");
        location.replace("admin_login.html");
        return;
      }

      document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      $(page)?.classList.add("active");

      if (page === "dashboard") loadDashboard();
      if (page === "users") loadUsers();
      if (page === "transactions") loadTransactions();
      if (page === "settings") loadSettings();
    });
  });

  $("#adminPaymentsBtn")?.addEventListener("click", () => {
    location.href = "admin_payments.html";
  });

  $("#adminWithdrawalsBtn")?.addEventListener("click", () => {
    location.href = "admin_withdrawals.html";
  });

  /* =====================================================
     DASHBOARD – LOAD OVERVIEW
  ===================================================== */
  async function loadDashboard() {
    try {
      const d = await api("/api/admin/overview");

      $("#statRevenue") && ($("#statRevenue").textContent = "₦" + (d.revenue || 0).toLocaleString());
      $("#coins") && ($("#coins").textContent = d.coinsSold || 0);
      $("#withdraw") && ($("#withdraw").textContent = "₦" + (d.withdrawals || 0).toLocaleString());
      $("#statUsers") && ($("#statUsers").textContent = d.users || 0);

      await Promise.all([loadCallAnalytics(), loadLockedPostAnalytics()]);
    } catch (err) {
      console.error("Dashboard load failed:", err);
      // Optional: show message in UI
      // $("#dashboard").innerHTML += `<p style="color:red">Failed to load dashboard: ${err.message}</p>`;
    }
  }

  /* =====================================================
     CALL ANALYTICS
  ===================================================== */
  async function loadCallAnalytics() {
    try {
      const d = await api("/api/admin/analytics/calls");

      $("#totalCallSeconds") && ($("#totalCallSeconds").textContent = d.totalSeconds || 0);
      $("#adminRevenue") && ($("#adminRevenue").textContent = d.adminRevenue || 0);
      $("#creatorRevenue") && ($("#creatorRevenue").textContent = d.creatorRevenue || 0);
    } catch (err) {
      console.error("Call analytics failed:", err);
    }
  }

  /* =====================================================
     LOCKED POST ANALYTICS
  ===================================================== */
  async function loadLockedPostAnalytics() {
    try {
      const d = await api("/api/admin/analytics/locked-posts");

      $("#lockedRevenue") && ($("#lockedRevenue").textContent = (d.totalRevenue || 0) + " coins");
      $("#adminEarnings") && ($("#adminEarnings").textContent = (d.adminEarnings || 0) + " coins");
    } catch (err) {
      console.error("Locked post analytics failed:", err);
    }
  }

  /* =====================================================
     USERS TABLE
  ===================================================== */
  async function loadUsers() {
    try {
      const users = await api("/api/admin/users");
      const table = $("#usersTable");
      if (!table) return;

      table.innerHTML = `
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Total Coins</th>
          <th>Status</th>
        </tr>
      `;

      if (!users?.length) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;padding:20px;color:#777">No users found</td></tr>`;
        return;
      }

      users.forEach(u => {
        const totalCoins = (u.bonusCoins || 0) + (u.purchasedCoins || 0);
        const status = u.isBanned ? "Banned" :
                       u.isSuspended ? "Suspended" : "Active";

        table.innerHTML += `
          <tr>
            <td>${esc(u.username)}</td>
            <td>${esc(u.email || "-")}</td>
            <td>${totalCoins}</td>
            <td style="color: ${status === "Banned" ? "red" : status === "Suspended" ? "orange" : "green"}">
              ${status}
            </td>
          </tr>
        `;
      });
    } catch (err) {
      console.error("Users load failed:", err);
      $("#usersTable") && ($("#usersTable").innerHTML = `<tr><td colspan="4" style="color:red">Failed to load users: ${err.message}</td></tr>`);
    }
  }

  /* =====================================================
     TRANSACTIONS TABLE
  ===================================================== */
  async function loadTransactions() {
    try {
      const res = await api("/api/admin/transactions?limit=50");
      const list = res.transactions || res || [];

      const table = $("#txTable");
      if (!table) return;

      table.innerHTML = `
        <tr>
          <th>User</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Date</th>
        </tr>
      `;

      if (!list.length) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;padding:20px;color:#777">No transactions yet</td></tr>`;
        return;
      }

      list.forEach(tx => {
        table.innerHTML += `
          <tr>
            <td>${esc(tx.username)}</td>
            <td>${esc(tx.type)}</td>
            <td>${tx.amount ?? "-"}</td>
            <td>${new Date(tx.createdAt || tx.timestamp).toLocaleString()}</td>
          </tr>
        `;
      });
    } catch (err) {
      console.error("Transactions load failed:", err);
      $("#txTable") && ($("#txTable").innerHTML = `<tr><td colspan="4" style="color:red">Failed to load: ${err.message}</td></tr>`);
    }
  }

  /* =====================================================
     SETTINGS – LOAD & SAVE
  ===================================================== */
async function loadSettings() {
  const cfg = await api("/api/admin/config");

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };

  /* ===== CORE ===== */
  set("coinPrice", cfg.coinPrice);

  /* ===== WITHDRAWAL ===== */
  set("withdrawalFeePercent", cfg.withdrawal?.feePercent);

  /* ===== USAGE PRICING ===== */
  set("usageMessage", cfg.messages?.pricePerLetter);
  set("usageVoice", cfg.calls?.voicePerSecond);
  set("usageVideo", cfg.calls?.videoPerSecond);
  set("usagePicturePost", cfg.usage?.picturePost);
  set("usageVideoPost", cfg.usage?.videoPost);

  /* ===== ADMIN PERCENT ===== */
  set("adminLockedPost", cfg.unlock?.adminPercent);

  /* ===== BONUS ===== */
  set("bonusNewUser", cfg.bonus?.newUser);
  set("bonusDailyLogin", cfg.bonus?.dailyLogin);
}




  async function saveSettings() {
    const btn = $("#saveSettingsBtn");
    if (btn) btn.disabled = true;

    try {
      const payload = {
        coinPrice: Number($("#coinPrice")?.value || 1),
withdrawalFeePercent: Number($("#withdrawalFeePercent")?.value || 0),

usagePrices: {
  message: Number($("#usageMessage")?.value || 0),
  voice: Number($("#usageVoice")?.value || 0),
  video: Number($("#usageVideo")?.value || 0),
  picturePost: Number($("#usagePicturePost")?.value || 0),
  videoPost: Number($("#usageVideoPost")?.value || 0)
},

       adminPercents: {
  lockedPost: Number($("#adminLockedPost")?.value || 0),
  voiceCall: Number($("#adminVoiceCall")?.value || 0),
  videoCall: Number($("#adminVideoCall")?.value || 0),
  message: Number($("#adminMessage")?.value || 0)
},

       bonusRules: {
  newUser: Number($("#bonusNewUser")?.value || 0),
  dailyLogin: Number($("#bonusDailyLogin")?.value || 0)
},

        updatedBy: adminUsername,
        reason: $("#configReason")?.value?.trim() || "Admin update"
      };

      // Basic validation
      if (payload.coinPrice <= 0) throw new Error("Coin price must be > 0");
      if (payload.withdrawalFeePercent < 0 || payload.withdrawalFeePercent > 100) {
        throw new Error("Withdrawal fee % must be between 0 and 100");
      }

      await api("/api/admin/config", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      alert("✅ Settings saved successfully!");
      await loadSettings();
      await loadDashboard();
      if ($("#configReason")) $("#configReason").value = "";

    } catch (err) {
      alert("Failed to save: " + (err.message || "Unknown error"));
      console.error("Save settings error:", err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  $("#saveSettingsBtn")?.addEventListener("click", e => {
    e.preventDefault();
    saveSettings();
  });

  /* =====================================================
     GRANT BONUS
  ===================================================== */
  $("#grantBonusBtn")?.addEventListener("click", async () => {
    const btn = $("#grantBonusBtn");
    btn.disabled = true;

    try {
      const username = $("#bonusUsername").value.trim();
      const amount = Number($("#bonusAmount").value);

      if (!username) throw new Error("Enter username");
      if (!amount || amount <= 0) throw new Error("Enter valid bonus amount");

      await api("/api/admin/grant-bonus", {
        method: "POST",
        body: JSON.stringify({ username, amount })
      });

      $("#bonusMsg").textContent = "Bonus granted successfully ✅";
      $("#bonusUsername").value = "";
      $("#bonusAmount").value = "";

    } catch (err) {
      $("#bonusMsg").textContent = "Error: " + (err.message || "Failed to grant bonus");
    } finally {
      btn.disabled = false;
    }
  });

  /* =====================================================
     USER STATUS (BAN/SUSPEND)
  ===================================================== */
  $("#applyUserStatus")?.addEventListener("click", async () => {
    const btn = $("#applyUserStatus");
    btn.disabled = true;

    try {
      const username = $("#statusUsername").value.trim();
      const action = $("#userAction").value;
      const suspendUntil = $("#suspendUntil").value;

      if (!username) throw new Error("Enter username");
      if (!action) throw new Error("Select action");

      await api("/api/admin/user-status", {
        method: "POST",
        body: JSON.stringify({
          username,
          action,
          suspendUntil: suspendUntil || null
        })
      });

      $("#statusMsg").textContent = "User status updated ✅";

    } catch (err) {
      $("#statusMsg").textContent = "Error: " + (err.message || "Failed to update status");
    } finally {
      btn.disabled = false;
    }
  });

  /* =====================================================
     INIT – Load everything on page ready
  ===================================================== */
  loadDashboard();
  loadSettings();

  document.getElementById("refreshBtn")?.addEventListener("click", () => {
  loadDashboard();
  loadSettings();
});


  // Optional: auto-refresh dashboard every 30s (uncomment if wanted)
  // setInterval(loadDashboard, 30000);

  // Small utility to escape HTML
  function esc(str = "") {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

document.addEventListener("DOMContentLoaded", () => {
   console.log("ADMIN JS LOADED");

  const btn = document.getElementById("saveSettingsBtn");

  if (!btn) {
    console.error("❌ Save button not found");
    return;
  }

  console.log("✅ Save button connected");

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    saveSettings();
  });

  loadSettings();
  loadDashboard();
});


})();