// ================= AUTH CHECK =================
const username = localStorage.getItem("username");
const token = localStorage.getItem("token");

if (!username || !token) {
    location.href = "index.html";
}

// ================= SOCKET =================
const socket = io({
    auth: { token }
});

// ================= HELPERS =================
function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    };
}

// ================= LOAD NOTIFICATIONS =================
async function loadNotifications() {
    try {
        const res = await fetch("/api/notifications", {
            headers: authHeaders()
        });

        const data = await res.json();
        const list = document.getElementById("notificationsList");
        list.innerHTML = "";

        if (!Array.isArray(data) || !data.length) {
            list.innerHTML =
                "<p style='text-align:center;color:gray;margin-top:20px;'>No notifications</p>";
            return;
        }

        data.reverse().forEach(n => drawNotification(n));
    } catch (err) {
        console.error("Failed to load notifications", err);
    }
}

// ================= DRAW CARD =================
function drawNotification(note) {
    const list = document.getElementById("notificationsList");

    const icons = {
        like: "❤️",
        comment: "💬",
        follow: "👥",
        match: "🔥",
        system: "🔔",
        wallet: "💰",
        missed_call: "📞",
        video_call: "🎥"
    };

    const icon = icons[note.type] || "🔔";

    const div = document.createElement("div");
    div.className = "note";
    div.dataset.id = note._id || "";

    div.innerHTML = `
        <span class="note-icon">${icon}</span>
        <strong>${note.from}</strong> ${note.message}
        <span class="delete-btn">✖</span>
        <div class="note-time">${new Date(note.timestamp).toLocaleString()}</div>
    `;

    div.querySelector(".delete-btn").addEventListener("click", () =>
        deleteNotification(div.dataset.id, div)
    );

    list.prepend(div);
}

// ================= DELETE ONE =================
async function deleteNotification(id, element) {
    if (!id) {
        element.remove();
        return;
    }

    try {
        await fetch("/api/notifications/delete", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ id })
        });
    } catch (err) {
        console.error("Delete failed", err);
    }

    element.remove();
}

// ================= CLEAR ALL =================
async function markAllRead() {
    try {
        await fetch("/api/notifications/clear", {
            method: "POST",
            headers: authHeaders()
        });
    } catch (err) {
        console.error("Clear failed", err);
    }

    loadNotifications();
}

// ================= SOCKET EVENTS =================
socket.on("follow_notification", d => {
    if (d.to === username) {
        drawNotification({
            from: d.from,
            message: d.message,
            type: "follow",
            timestamp: new Date().toISOString()
        });
    }
});

socket.on("new_match", d => {
    const partner = d.user1 === username ? d.user2 : d.user1;

    drawNotification({
        from: partner,
        message: `You matched with ${partner}! 🎉`,
        type: "match",
        timestamp: new Date().toISOString()
    });
});

socket.on("post_liked", d => {
    if (d.postOwner === username && d.username !== username) {
        drawNotification({
            from: d.username,
            message: "liked your post.",
            type: "like",
            timestamp: new Date().toISOString()
        });
    }
});

socket.on("post_commented", d => {
    if (d.postOwner === username && d.username !== username) {
        drawNotification({
            from: d.username,
            message: "commented on your post.",
            type: "comment",
            timestamp: new Date().toISOString()
        });
    }
});

socket.on("missed_call", d => {
    if (d.to === username) {
        drawNotification({
            from: d.from,
            message: "missed your call.",
            type: "missed_call",
            timestamp: new Date().toISOString()
        });
    }
});

socket.on("video_call_notify", d => {
    if (d.to === username) {
        drawNotification({
            from: d.from,
            message: "started a video call with you.",
            type: "video_call",
            timestamp: new Date().toISOString()
        });
    }
});

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    const markBtn = document.querySelector(".mark-read");
    if (markBtn) markBtn.addEventListener("click", markAllRead);

    loadNotifications();
});