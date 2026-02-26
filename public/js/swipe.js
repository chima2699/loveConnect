/* ================= AUTH ================= */
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token || !username) location.href = "index.html";

const cardList = document.getElementById("cardList");

let users = [];
let index = 0;

function resolvePhoto(src) {
  if (!src || typeof src !== "string") return "/default.png";
  if (src.startsWith("/uploads/")) return src;
  return "/default.png";
}

/* ================= LOAD USERS ================= */
async function loadUsers(){
  const res = await fetch("/api/swipe-users", {
    headers:{ Authorization:"Bearer "+token }
  });
  users = await res.json();
  index = 0;
  renderCards();
}

/* ================= RENDER ================= */
function renderCards(){
  cardList.innerHTML = "";

  if (users.length === 0) return;

  if (index >= users.length) {
    index = 0; // 🔁 restart
  }

  const u = users[index];

  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <a href="user_profile.html?user=${encodeURIComponent(u.username)}">
      <img src="${resolvePhoto(u.profilePhoto)}" alt="${u.username}">
    </a>
    <div class="card-info">
      <h3>${u.username}${u.age ? ", " + u.age : ""}</h3>
      <p>${u.location || ""}</p>
    </div>
  `;

  enableSwipe(card);
  cardList.appendChild(card);
}


/* ================= SWIPE HANDLER ================= */
function enableSwipe(card){
  let startX = 0;

  card.addEventListener("touchstart", e=>{
    startX = e.touches[0].clientX;
  });

  card.addEventListener("touchmove", e=>{
    const dx = e.touches[0].clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx/12}deg)`;
  });

  card.addEventListener("touchend", e=>{
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > 120) swipe("right");
    else if (dx < -120) swipe("left");
    else card.style.transform = "";
  });
}

/* ================= ACTIONS ================= */
function swipeLeft(){ swipe("left"); }
function swipeRight(){ swipe("right"); }

async function swipe(dir){
  if (users.length === 0) return;

  const user = users[index];

  await fetch("/api/like", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      toUser: user.username,
      liked: dir === "right"
    })
  });

  index++;
  renderCards();
}



document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnNope")?.addEventListener("click", swipeLeft);
  document.getElementById("btnYes")?.addEventListener("click", swipeRight);
});


/* INIT */
loadUsers();
