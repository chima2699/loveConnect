/* ===============================
   AUTH & INIT
================================ */
const username = localStorage.getItem("username");
const token = localStorage.getItem("token");
const params = new URLSearchParams(location.search);
const otherUser = params.get("user");

if (!username || !token || !otherUser) {
    location.replace("message_list.html");
}

const chatName = document.getElementById("chatName");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const typingBox = document.getElementById("typing");
const userPhoto = document.getElementById("userPhoto");

chatName.textContent = otherUser;

const backBtn = document.getElementById("backBtn");

if (backBtn) {
  backBtn.onclick = () => {
    window.location.href = "message_list.html";
  };
}


/* ===============================
   HELPERS
================================ */
const authHeader = () => ({
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
});

function escapeText(text) {
    return text.replace(/[&<>"']/g, m =>
        ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])
    );
}

function formatTime(t) {
    return new Date(t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* ===============================
   LOAD PROFILE
================================ */
(async () => {
    try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(otherUser)}`, {
            headers: authHeader()
        });
        const data = await res.json();
        userPhoto.src = data.profilePhoto || "default.png";
    } catch {
        userPhoto.src = "default.png";
    }
})();

/* ===============================
   SOCKET
================================ */
const socket = io({ auth: { token } });
socket.emit("user_online", username);

/* ===============================
   CHAT STATE
================================ */
let chatId = null;
let messages = [];
let sending = false;

/* ===============================
   INIT CHAT
================================ */
(async function initChat() {
    const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ b: otherUser })
    });

    const data = await res.json();
    chatId = data.chatId;
    messages = data.messages || [];
    renderMessages();
})();

/* ===============================
   RENDER
================================ */
function renderMessages() {
    chatBox.innerHTML = "";

    messages.forEach(m => {
        const wrap = document.createElement("div");
        wrap.style.clear = "both";

        const bubble = document.createElement("div");
        bubble.className = `bubble ${m.from === username ? "me" : "them"}`;

        bubble.textContent = escapeText(m.text);

        const time = document.createElement("div");
        time.className = "msg-time";
        time.textContent = formatTime(m.time || Date.now());

        bubble.appendChild(time);
        wrap.appendChild(bubble);
        chatBox.appendChild(wrap);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

/* ===============================
   SEND MESSAGE
================================ */
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    if (sending) return;

    const text = msgInput.value.trim();
    if (!text) return;

    sending = true;
    sendBtn.disabled = true;

    try {
        const pay = await fetch("/api/spend/message", {
            method: "POST",
            headers: authHeader()
        }).then(r => r.json());

        if (pay.error) {
            alert("Not enough coins");
            return;
        }

        await fetch("/api/chat/msg", {
            method: "POST",
            headers: authHeader(),
            body: JSON.stringify({ chatId, text })
        });

        messages.push({
            from: username,
            text,
            time: Date.now(),
            delivered: true
        });

        renderMessages();
        msgInput.value = "";

    } catch {
        alert("Message failed");
    } finally {
        sending = false;
        sendBtn.disabled = false;
    }
}


const chatUsername = params.get("user"); // auto-detected

document.getElementById("giftBtn").addEventListener("click", async () => {
  // Pre-fill recipient
 const giftBtn = document.getElementById("giftBtn");

if (giftBtn) {
  giftBtn.addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const chatUsername = params.get("user");

    const to = prompt(
      "Gift coins to (change if needed):",
      chatUsername || ""
    );

    if (!to) return;

    const amount = Number(prompt("Enter amount of coins"));
    if (!amount || amount <= 0) {
      return alert("Invalid amount");
    }

    const res = await fetch("/api/coins/gift", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ to, amount })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Gift failed");

    alert(`🎁 Successfully gifted ${amount} coins to ${to}`);
  });
}


  const data = await res.json();
  if (!res.ok) {
    return alert(data.error || "Gift failed");
  }

  alert(`🎁 Successfully gifted ${amount} coins to ${to}`);
});


/* ===============================
   RECEIVE MESSAGE
================================ */
socket.on("chat_message", data => {
    if (data.chatId !== chatId) return;
    messages.push(data.message);
    renderMessages();
});

/* ===============================
   TYPING
================================ */
msgInput.addEventListener("input", () => {
    socket.emit("typing", { from: username, to: otherUser });
});

socket.on("typing", d => {
    if (d.from === otherUser) {
        typingBox.textContent = `${otherUser} is typing...`;
        setTimeout(() => typingBox.textContent = "", 900);
    }
});

/* ===============================
   CALLS
================================ */
document.getElementById("voiceCall").onclick = () => {
    location.href = `call.html?user=${encodeURIComponent(otherUser)}&type=voice`;
};

document.getElementById("videoCall").onclick = () => {
    location.href = `call.html?user=${encodeURIComponent(otherUser)}&type=video`;
};
