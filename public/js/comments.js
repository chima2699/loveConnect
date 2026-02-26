const username = localStorage.getItem("username");
const token = localStorage.getItem("token");
if (!username || !token) location.href = "index.html";

const params = new URLSearchParams(location.search);
const postId = params.get("post");
if (!postId) history.back();

const commentsBox = document.getElementById("commentsBox");
const input = document.getElementById("commentInput");
const sendBtn = document.getElementById("sendBtn");
const backBtn = document.getElementById("backBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const typingIndicator = document.getElementById("typingIndicator");

let page = 1;
let loading = false;

backBtn.onclick = () => history.back();

const socket = io();
socket.emit("join_post", postId);

/* ---------- HELPERS ---------- */
function auth() {
    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };
}

/* ---------- TYPING ---------- */
input.addEventListener("input", () => {
    socket.emit("typing_comment", { postId, from: username });
});

socket.on("typing_comment", d => {
    if (d.from !== username) {
        typingIndicator.innerText = `${d.from} is typing...`;
        typingIndicator.style.display = "block";
        setTimeout(() => typingIndicator.style.display = "none", 1500);
    }
});

/* ---------- LOAD COMMENTS (PAGINATION) ---------- */
async function loadComments(reset = false) {
    if (loading) return;
    loading = true;

    if (reset) {
        page = 1;
        commentsBox.innerHTML = "";
    }

    const res = await fetch(`/api/posts/comments?postId=${postId}&page=${page}`, {
        headers: auth()
    });
    const data = await res.json();

    data.comments.forEach(drawComment);

    loadMoreBtn.style.display = data.hasMore ? "block" : "none";
    loading = false;
}

loadMoreBtn.onclick = () => {
    page++;
    loadComments();
};

/* ---------- DRAW COMMENT ---------- */
function drawComment(c) {
    const div = document.createElement("div");
    div.className = "comment-card";

    div.innerHTML = `
        <div class="comment-user">${c.username}</div>
        <div class="comment-text" id="text-${c._id}">${c.text}</div>

        <div class="comment-actions">
            <span data-like="${c._id}">❤️ ${c.likes.length}</span>
            <span data-reply="${c._id}">Reply</span>
            ${c.username === username ? `<span data-edit="${c._id}">Edit</span>
            <span data-delete="${c._id}" style="color:red;">Delete</span>` : ""}
        </div>

        <div class="replies" id="replies-${c._id}">
            ${(c.replies || []).map(r =>
                `<div class="reply"><b>${r.username}:</b> ${r.text}</div>`
            ).join("")}
        </div>

        <div class="comment-time">${new Date(c.timestamp).toLocaleString()}</div>
    `;

    commentsBox.appendChild(div);
}

/* ---------- ACTION HANDLERS ---------- */
commentsBox.onclick = async e => {
    const like = e.target.dataset.like;
    const del = e.target.dataset.delete;
    const edit = e.target.dataset.edit;
    const reply = e.target.dataset.reply;

    if (like) {
        await fetch("/api/posts/comment/like", {
            method: "POST",
            headers: auth(),
            body: JSON.stringify({ commentId: like })
        });
        reload();
    }

    if (del) {
        if (!confirm("Delete comment?")) return;
        await fetch("/api/posts/comment/delete", {
            method: "POST",
            headers: auth(),
            body: JSON.stringify({ commentId: del })
        });
        reload();
    }

    if (edit) {
        const el = document.getElementById("text-" + edit);
        const newText = prompt("Edit comment:", el.innerText);
        if (!newText) return;

        await fetch("/api/posts/comment/edit", {
            method: "POST",
            headers: auth(),
            body: JSON.stringify({ commentId: edit, text: newText })
        });
        reload();
    }

    if (reply) {
        const text = prompt("Reply:");
        if (!text) return;

        await fetch("/api/posts/comment/reply", {
            method: "POST",
            headers: auth(),
            body: JSON.stringify({ commentId: reply, text })
        });
        reload();
    }
};

/* ---------- SEND COMMENT ---------- */
sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    await fetch("/api/posts/comment", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ postId, text })
    });

    input.value = "";
    reload();
};

/* ---------- REALTIME UPDATE ---------- */
socket.on("new_comment", d => {
    if (d.postId === postId) reload();
});

/* ---------- RELOAD ---------- */
function reload() {
    loadComments(true);
}

/* INIT */
loadComments(true);
