/* ================= AUTH ================= */
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token || !username) {
  location.href = "index.html";
}

/* ================= SOCKET ================= */
let socket = null;
try {
  socket = io({ auth: { token } });
  socket.on("post_update", () => loadPosts());
} catch {}

/* ================= HELPERS ================= */
function esc(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[m]);
}

/* ================= MEDIA RESOLVER ================= */
function resolveMedia(post) {
  const raw =
    post.mediaUrl ||
    post.media ||
    post.image ||
    null;

  if (!raw) return null;

  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/")) return raw;
  return `/uploads/posts/${raw}`;
}

/* ================= RENDER POST ================= */
function renderPost(post) {
  const unlocked =
    !post.locked ||
    post.username === username ||
    (post.unlocks || []).includes(username);

  const mediaUrl = resolveMedia(post);
  const isVideo =
    post.mediaType === "video" ||
    /\.(mp4|webm|ogg)$/i.test(mediaUrl || "");

  let mediaHTML = "";

  if (mediaUrl) {
    if (unlocked) {
      mediaHTML = isVideo
        ? `
          <video
            controls
            playsinline
            preload="metadata"
            class="post-video"
            src="${mediaUrl}"
            onerror="this.remove()">
          </video>
        `
        : `
          <img
            src="${mediaUrl}"
            class="post-img"
            loading="lazy"
            onerror="this.remove()">
        `;
    } else {
      mediaHTML = `
        <div class="locked">
          ${
            isVideo
              ? `<video muted preload="metadata" class="blur" src="${mediaUrl}"></video>`
              : `<img class="blur" src="${mediaUrl}">`
          }
         <button
  class="unlock-btn"
  data-id="${post._id}"
  data-price="${post.lockPrice}">
  🔓 Unlock (${post.lockPrice} coins)
</button>
        </div>
      `;
    }
  }

  return `
    <div class="post">
      ${mediaHTML}
      ${post.content ? `<p>${esc(post.content)}</p>` : ""}
    </div>
  `;
}

/* ================= CREATE POST ================= */
document.addEventListener("DOMContentLoaded", () => {
  const postBtn = document.getElementById("postBtn");
  const postText = document.getElementById("postText");
  const postImage = document.getElementById("postImage");
  const lockCheckbox = document.getElementById("lockPost");
  const lockPriceInput = document.getElementById("lockPrice");

  if (lockCheckbox && lockPriceInput) {
    lockCheckbox.addEventListener("change", () => {
      lockPriceInput.style.display =
        lockCheckbox.checked ? "block" : "none";
    });
  }

  postBtn?.addEventListener("click", async () => {
    const text = postText.value.trim();
    const file = postImage.files[0];

    if (!text && !file) {
      alert("Write something or select a file");
      return;
    }

    if (file?.type.startsWith("video/") && file.size > 30 * 1024 * 1024) {
      alert("Video must be 30 seconds or less");
      return;
    }

    const fd = new FormData();
    fd.append("content", text);
    if (file) fd.append("media", file);

    const isLocked = lockCheckbox?.checked || false;
    const price = Number(lockPriceInput?.value || 0);

    fd.append("locked", isLocked);
    fd.append("lockPrice", isLocked ? price : 0);

    postBtn.disabled = true;
    postBtn.textContent = "Posting...";

    try {
      const res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: fd
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      postText.value = "";
      postImage.value = "";
      if (lockCheckbox) lockCheckbox.checked = false;
      if (lockPriceInput) {
        lockPriceInput.value = "";
        lockPriceInput.style.display = "none";
      }

      loadPosts();
      socket?.emit("post_update");
    } catch (err) {
      alert(err.message || "Post failed");
    }

    postBtn.disabled = false;
    postBtn.textContent = "Post";
  });
});

/* ================= UNLOCK POST ================= */
async function unlockPost(postId, price) {
  if (!postId) return;
  if (!confirm(`Unlock this post for ${price} coins?`)) return;

  try {
    const res = await fetch(`/api/posts/unlock/${postId}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      }
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid server response");
    }

    // ❌ NOT ENOUGH COINS
    if (!res.ok) {
      if (data?.error === "Not enough coins") {
        showBuyCoinsPrompt();
        return;
      }
      throw new Error(data?.error || "Unlock failed");
    }

    // ✅ UPDATE UI (NO RELOAD)
    const card = document.querySelector(`.card[data-id="${postId}"]`);
    if (!card) return;

    card.querySelectorAll(".blur").forEach(el => {
      el.classList.remove("blur");
      el.removeAttribute("muted");
      el.setAttribute("controls", true);
    });

    const btn = card.querySelector(".unlock-btn");
    if (btn) btn.remove();

  } catch (err) {
    console.error("Unlock error:", err);
    alert(err.message || "Network error");
  }
}

/* ================= LOAD POSTS ================= */
async function loadPosts() {
  const box = document.getElementById("posts");
  if (!box) return;

  try {
    const res = await fetch("/api/posts", {
  headers: { Authorization: "Bearer " + token }
});
    const posts = await res.json();

    box.innerHTML = "";

    posts.forEach(p => {
      const div = document.createElement("div");
      div.className = "card";
      div.dataset.id = p._id;

      div.innerHTML = `
        <a href="user_profile.html?user=${encodeURIComponent(p.username)}"
           style="font-weight:600;text-decoration:none;color:inherit;">
          ${esc(p.username)}
        </a>

        ${renderPost(p)}



        <div class="actions">
          <button class="like-btn">❤️ ${p.likes?.length || 0}</button>
          <button class="comment-toggle">💬 ${p.comments?.length || 0}</button>
          ${
            p.username === username
              ? `<button class="edit-btn">✏️</button>
                 <button class="delete-btn">🗑</button>`
              : ""
          }
        </div>

        <div class="comments" style="display:none">
          ${(p.comments || []).map((c, i) => `
            <div class="comment" data-id="${c._id}">
             <b>${esc(c.username)}</b>: ${esc(c.text)}
              ${(c.replies || []).map(r => `
                <div class="reply">
                  ↳<b>${esc(r.username)}</b>: ${esc(r.text)}
                </div>
              `).join("")}
              <input class="reply-input" placeholder="Reply...">
              <button class="reply-btn">Reply</button>
            </div>
          `).join("")}

          <input class="comment-input" placeholder="Write a comment...">
          <button class="comment-btn">Comment</button>
        </div>
      `;

      box.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load posts", err);
  }
}

document.addEventListener("click", e => {
  const btn = e.target.closest(".unlock-btn");
  if (!btn) return;

  const postId = btn.dataset.id;
  const price = Number(btn.dataset.price);

  unlockPost(postId, price);
});

/* ================= EVENTS ================= */
document.addEventListener("DOMContentLoaded", () => {
  const postsBox = document.getElementById("posts");
  if (!postsBox) return;

  postsBox.addEventListener("click", async e => {
    const card = e.target.closest(".card");
    if (!card) return;
    const postId = card.dataset.id;

    if (e.target.closest(".like-btn")) {
      await fetch("/api/posts/like", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ postId })
      });
      loadPosts();
    }

    if (e.target.closest(".comment-toggle")) {
      const c = card.querySelector(".comments");
      if (c) c.style.display = c.style.display === "none" ? "block" : "none";
    }

    if (e.target.closest(".comment-btn")) {
      const input = card.querySelector(".comment-input");
      if (!input || !input.value.trim()) return;

      await fetch("/api/posts/comment", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ postId, text: input.value })
      });

      input.value = "";
      loadPosts();
    }

    if (e.target.closest(".reply-btn")) {
      const comment = e.target.closest(".comment");
      if (!comment) return;

      const commentId = comment.dataset.id;
      const input = comment.querySelector(".reply-input");
      if (!input || !input.value.trim()) return;

      await fetch("/api/posts/reply", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          postId,
          commentId,
          text: input.value
        })
      });

      input.value = "";
      loadPosts();
    }

    if (e.target.closest(".delete-btn")) {
      if (!confirm("Delete post?")) return;

      await fetch("/api/posts/delete", {
  method: "DELETE",
  headers: {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ postId })
  });
      loadPosts();
    }

    if (e.target.closest(".edit-btn")) {
      const text = prompt("Edit post");
      if (!text) return;

      await fetch("/api/posts/edit", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ postId, content: text })
      });
      loadPosts();
    }
  });
});

function showBuyCoinsPrompt() {
  if (confirm("You don't have enough coins. Buy coins now?")) {
    window.location.href = "/wallet.html";
  }
}

/* ================= INIT ================= */
loadPosts();
