(() => {
"use strict";

/* ================= AUTH ================= */
const username = localStorage.getItem("username");
const token = localStorage.getItem("token");
if (!username || !token) {
    location.replace("index.html");
    return;
}

const authHeaders = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
};

const params = new URLSearchParams(location.search);
const otherUser = params.get("user");
if (!otherUser || otherUser === username) {
    location.replace("home.html");
    return;
}

/* ================= DOM ================= */
const el = id => document.getElementById(id);
el("profileName").textContent = otherUser;

/* ================= SOCKET ================= */
const socket = io({ auth: { token } });

socket.on("online_list", list => {
    if (Array.isArray(list) && list.includes(otherUser)) {
        el("onlineDot").className = "online-dot";
        el("statusText").textContent = "Online";
    } else {
        el("onlineDot").className = "";
        el("statusText").textContent = "Offline";
    }
});

/* ================= LOAD PROFILE ================= */
async function loadProfile() {
    try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(otherUser)}`, {
            headers: authHeaders
        });

        if (!res.ok) throw new Error("Profile not found");
        const u = await res.json();

        el("mainPhoto").src = u.profilePhoto || "default.png";

        renderGallery(u.photos || []);
        renderInfo(u);
        await updateFollowStatus();
        calculateDistance(u.lat, u.lon);

    } catch {
        alert("Unable to load user profile.");
        location.replace("home.html");
    }
}

function renderGallery(photos) {
    const gallery = el("photoGallery");
    gallery.innerHTML = "";
    photos.forEach(src => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Photo";
        img.addEventListener("click", () => window.open(src, "_blank"));
        gallery.appendChild(img);
    });
}

function renderInfo(u) {
    el("basicInfo").innerHTML = `
        <b>Age:</b> ${u.age ?? "-"}<br>
        <b>Gender:</b> ${u.gender ?? "-"}<br>
        <b>Interested In:</b> ${u.interestedIn ?? "-"}<br>
        <b>Location:</b> ${u.location ?? "-"}
    `;

    el("aboutBox").innerHTML = `
        <b>Bio:</b> ${u.bio ?? "-"}<br>
        <b>Interests:</b> ${u.interests ?? "-"}<br>
        <b>Goal:</b> ${u.goal ?? "-"}
    `;
}

/* ================= FOLLOW ================= */
async function updateFollowStatus() {
    const res = await fetch(`/api/follows/check?me=${username}&them=${otherUser}`, {
        headers: authHeaders
    });
    const data = await res.json();

    const btn = el("followBtn");
    if (data.following) {
        btn.textContent = "Unfollow";
        btn.className = "btn unfollow-btn";
    } else {
        btn.textContent = "Follow";
        btn.className = "btn follow-btn";
    }
}

el("followBtn").addEventListener("click", async () => {
    await fetch("/api/follows/toggle", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ follower: username, followee: otherUser })
    });
    updateFollowStatus();
});

/* ================= DISTANCE ================= */
async function calculateDistance(lat2, lon2) {
    if (!lat2 || !lon2) {
        el("distanceBox").textContent = "Not available";
        return;
    }

    const me = await fetch(`/api/profile?username=${username}`, {
        headers: authHeaders
    }).then(r => r.json());

    if (!me.lat || !me.lon) {
        el("distanceBox").textContent = "Not available";
        return;
    }

    const toRad = v => v * Math.PI / 180;
    const R = 6371;

    const dLat = toRad(lat2 - me.lat);
    const dLon = toRad(lon2 - me.lon);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(me.lat)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    el("distanceBox").textContent = d.toFixed(1) + " km away";
}

/* ================= ACTIONS ================= */
el("messageBtn").addEventListener("click", () => {
    location.href = `message.html?user=${encodeURIComponent(otherUser)}`;
});

el("voiceCallBtn").addEventListener("click", () => {
    location.href = `call.html?user=${encodeURIComponent(otherUser)}&type=voice`;
});

el("videoCallBtn").addEventListener("click", () => {
    location.href = `call.html?user=${encodeURIComponent(otherUser)}&type=video`;
});

el("blockBtn").addEventListener("click", async () => {
    if (!confirm("Block this user?")) return;
    await fetch("/api/block", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ blocker: username, blocked: otherUser })
    });
    alert("User blocked");
    location.replace("home.html");
});

el("reportBtn").addEventListener("click", async () => {
    const reason = prompt("Reason for reporting?");
    if (!reason) return;

    await fetch("/api/report", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ reporter: username, reported: otherUser, reason })
    });

    alert("Report submitted");
});

/* ================= INIT ================= */
loadProfile();

})();
