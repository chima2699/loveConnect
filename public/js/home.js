const username = localStorage.getItem("username");
if (!username) location.href = "index.html";

document.getElementById("helloUser").innerText = "Hi, " + username;

const socket = io(); // ✅ works on localhost + hosted
let currentTab = "following";

socket.on("post_created", loadFeed);
socket.on("post_liked", loadFeed);
socket.on("post_deleted", loadFeed);

/* STORIES */
async function loadStories() {
  const bar = document.getElementById("storiesBar");
  bar.innerHTML = "";

  try {
    const res = await fetch("/api/users/online");
    const users = await res.json();

    users.slice(0, 10).forEach(u => {
      bar.innerHTML += `
        <div class="story">
          <img src="${u.avatar || 'https://img.icons8.com/fluency/48/user-male-circle--v1.png'}">
          <span>${u.username}</span>
        </div>
      `;
    });
  } catch {}
}

loadStories();

/* TABS */
document.getElementById("tabFollowing").onclick = () => switchTab("following");
document.getElementById("tabExplore").onclick = () => switchTab("explore");

function switchTab(tab) {
  currentTab = tab;
  document.getElementById("tabFollowing").classList.toggle("active", tab === "following");
  document.getElementById("tabExplore").classList.toggle("active", tab === "explore");
  loadFeed();
}

/* FEED */
async function loadFeed() {
  const box = document.getElementById("feedContainer");
  box.innerHTML = "<p class='empty'>Loading feed...</p>";

  try {
    let posts = await (await fetch("/api/posts")).json();
    posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (currentTab === "following") {
      const follows = await (await fetch(`/api/follows/list?username=${username}`)).json();
      const followees = follows.map(f => f.followee);
      posts = posts.filter(p => p.username === username || followees.includes(p.username));
    }

    box.innerHTML = "";
    if (!posts.length) {
      box.innerHTML = `<p class="empty">No posts available</p>`;
      return;
    }

    posts.forEach(p => {
      const liked = p.likes?.includes(username);
      box.innerHTML += `
        <div class="post-card">
          <div class="post-header">
            <div class="post-user">
              <a href="user_profile.html?user=${p.username}">${p.username}</a>
            </div>
            <div class="post-time">${new Date(p.timestamp).toLocaleString()}</div>
          </div>

          <div>${p.content || ""}</div>
          ${p.image ? `<img src="${p.image}" style="width:100%;margin-top:6px;border-radius:10px">` : ""}

          <div class="post-actions">
            <span class="${liked ? "liked" : ""}" onclick="likePost('${p._id}')">
              ❤️ ${p.likes?.length || 0}
            </span>
            <span onclick="openComments('${p._id}')">
              💬 ${p.comments?.length || 0}
            </span>
          </div>
        </div>
      `;
    });

  } catch {
    box.innerHTML = "<p class='empty'>Failed to load feed</p>";
  }
}

async function likePost(id) {
  await fetch("/api/posts/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: id, username })
  });
  loadFeed();
}

function openComments(id) {
  location.href = `comments.html?post=${id}`;
}

loadFeed();
