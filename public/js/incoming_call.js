/* -----------------------------------------
   AUTH CHECK
------------------------------------------ */
const username = localStorage.getItem("username");
const token = localStorage.getItem("token");

if (!username || !token) {
    location.href = "index.html";
}

/* -----------------------------------------
   URL PARAMS
------------------------------------------ */
const params = new URLSearchParams(location.search);
const fromUser = params.get("from");
const callType = params.get("type") || "voice";

if (!fromUser) {
    alert("Call data missing.");
    location.href = "swipe.html";
}

/* -----------------------------------------
   UI ELEMENTS
------------------------------------------ */
const callerNameEl = document.getElementById("callerName");
const callTypeTextEl = document.getElementById("callTypeText");
const callerPhotoEl = document.getElementById("callerPhoto");
const ringtone = document.getElementById("ringtone");

callerNameEl.innerText = fromUser;
callTypeTextEl.innerText = callType === "video" ? "Video Call" : "Voice Call";

/* -----------------------------------------
   LOAD CALLER PHOTO
------------------------------------------ */
fetch(`/api/profile?username=${encodeURIComponent(fromUser)}`, {
    headers: { "Authorization": "Bearer " + token }
})
.then(r => r.json())
.then(u => {
    if (u?.profilePhoto) callerPhotoEl.src = u.profilePhoto;
})
.catch(() => {});

/* -----------------------------------------
   RINGTONE + VIBRATION (MOBILE)
------------------------------------------ */
ringtone.play().catch(() => {});

let vibrationInterval = null;
if (navigator.vibrate) {
    navigator.vibrate([800, 400, 800]);
    vibrationInterval = setInterval(() => {
        navigator.vibrate([800, 400, 800]);
    }, 2000);
}

function stopAlertEffects() {
    ringtone.pause();
    ringtone.currentTime = 0;
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        navigator.vibrate(0);
    }
}

/* -----------------------------------------
   SOCKET
------------------------------------------ */
const socket = io();
socket.emit("user_online", username);

/* -----------------------------------------
   ACCEPT CALL
------------------------------------------ */
document.getElementById("acceptBtn").addEventListener("click", () => {
    stopAlertEffects();

    socket.emit("call_accept", {
        from: username,
        to: fromUser,
        type: callType
    });

    location.href =
        `call.html?user=${encodeURIComponent(fromUser)}&type=${callType}&incoming=1`;
});

/* -----------------------------------------
   REJECT CALL
------------------------------------------ */
document.getElementById("rejectBtn").addEventListener("click", () => {
    stopAlertEffects();

    socket.emit("call_reject", {
        from: username,
        to: fromUser
    });

    location.href = "message_list.html";
});

/* -----------------------------------------
   CALLER CANCELLED
------------------------------------------ */
socket.on("call_cancelled", data => {
    if (data.from === fromUser) {
        stopAlertEffects();
        alert("Caller ended the call");
        location.href = "message_list.html";
    }
});

/* -----------------------------------------
   MISSED CALL (AUTO TIMEOUT)
------------------------------------------ */
const MISSED_CALL_TIMEOUT = 25000;

setTimeout(async () => {
    stopAlertEffects();

    socket.emit("call_reject", {
        from: username,
        to: fromUser
    });

    // 🔔 STORE MISSED CALL NOTIFICATION
    await fetch("/api/notifications/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            to: username,
            from: fromUser,
            type: "missed_call",
            message: "missed your call."
        })
    }).catch(() => {});

    alert("Missed call");
    location.href = "message_list.html";
}, MISSED_CALL_TIMEOUT);
