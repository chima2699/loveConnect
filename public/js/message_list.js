(() => {
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");

    if (!username || !token) {
        location.href = "index.html";
        return;
    }

    const chatList = document.getElementById("chatList");

    const auth = () => ({
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    });

    let onlineUsers = [];
    let typingUsers = {};

    /* SOCKET */
    const socket = io({ auth: { token } });
    socket.emit("user_online");

    socket.on("online_list", list => {
        onlineUsers = list || [];
        loadChats();
    });

    socket.on("typing", ({ from }) => {
        typingUsers[from] = true;
        loadChats();
        setTimeout(() => {
            delete typingUsers[from];
            loadChats();
        }, 2000);
    });

    /* LOAD CHAT LIST */
    async function loadChats() {
        try {
            const res = await fetch("/api/messages/list", {
                headers: auth()
            });

            if (!res.ok) throw new Error("Failed");

            const chats = await res.json();
            chatList.innerHTML = "";

            if (!Array.isArray(chats) || chats.length === 0) {
                chatList.innerHTML = `
                    <p style="text-align:center;color:#777;margin-top:30px;">
                        No conversations yet
                    </p>`;
                return;
            }

            // ✅ newest messages first (WhatsApp behavior)
            chats.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

            chats.forEach(c => {
                if (!c.username) return; // 🔐 safety check

                const div = document.createElement("div");
                div.className = "chat-item";

                div.onclick = () =>
                    location.href = `message.html?user=${encodeURIComponent(c.username)}`;

                let preview = c.lastMessage || "Tap to chat";
                if (c.lastType === "image") preview = "📷 Photo";
                if (c.lastType === "audio") preview = "🎤 Voice note";

                div.innerHTML = `
                    <img src="${c.photo || '/default.png'}">
                    <div class="chat-info">
                        <div class="chat-name">
                            ${c.username}
                            ${onlineUsers.includes(c.username)
                                ? `<span class="online-dot"></span>` : ""}
                        </div>
                        ${
                            typingUsers[c.username]
                                ? `<div class="typing">Typing…</div>`
                                : `<div class="chat-last">${preview}</div>`
                        }
                    </div>
                    ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ""}
                `;

                chatList.appendChild(div);
            });

        } catch (err) {
            console.error(err);
            chatList.innerHTML = `
                <p style="text-align:center;color:red;margin-top:30px;">
                    Failed to load messages
                </p>`;
        }
    }

    loadChats();
})();

