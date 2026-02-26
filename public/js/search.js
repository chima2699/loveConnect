(() => {
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (!username || !token) {
    location.replace("index.html");
    return;
  }

  const authHeader = () => ({
    "Authorization": "Bearer " + token
  });

  const resultsBox = document.getElementById("results");
  let allUsers = [];
  let myProfile = null;
  let onlineUsers = [];

  /* ---------------- SOCKET ---------------- */
  const socket = io();
  socket.emit("user_online", username);
  socket.on("online_list", list => {
    onlineUsers = Array.isArray(list) ? list : [];
    render();
  });

  /* ---------------- HELPERS ---------------- */
  const safe = s =>
    String(s || "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c])
    );

  function distance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI/180;
    const dLon = (lon2 - lon1) * Math.PI/180;
    const a =
      Math.sin(dLat/2)**2 +
      Math.cos(lat1*Math.PI/180) *
      Math.cos(lat2*Math.PI/180) *
      Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  /* ---------------- LOAD DATA ---------------- */
  async function init() {
    try {
      const me = await fetch(`/api/profile?username=${encodeURIComponent(username)}`, {
        headers: authHeader()
      });
      myProfile = await me.json();

      const res = await fetch("/api/users/all", { headers: authHeader() });
      const data = await res.json();
      allUsers = Array.isArray(data)
        ? data.filter(u => !u.banned && u.username !== username)
        : [];
    } catch {
      resultsBox.innerHTML = "<p style='text-align:center;color:#777'>Failed to load users</p>";
    }
    render();
  }

  /* ---------------- RENDER ---------------- */
  function render() {
    resultsBox.innerHTML = "";

    if (!allUsers.length) {
      resultsBox.innerHTML = "<p style='text-align:center;color:#777'>No users found</p>";
      return;
    }

    const uname = usernameFilter.value.toLowerCase();
    const gender = genderFilter.value.toLowerCase();
    const interest = interestFilter.value.toLowerCase();
    const minAge = parseInt(ageMin.value) || 0;
    const maxAge = parseInt(ageMax.value) || 200;
    const verifiedOnly = verifiedOnlyBox.checked;

    let filtered = allUsers.filter(u =>
      u.username.toLowerCase().includes(uname) &&
      (!gender || (u.gender||"").toLowerCase() === gender) &&
      (!interest || (u.interestedIn||"").toLowerCase() === interest) &&
      (u.age||0) >= minAge &&
      (u.age||0) <= maxAge &&
      (!verifiedOnly || u.verified)
    );

    filtered = filtered.map(u => ({
      ...u,
      dist: distance(myProfile.lat, myProfile.lon, u.lat, u.lon)
    })).sort((a,b) => (a.dist ?? 9999) - (b.dist ?? 9999));

    if (!filtered.length) {
      resultsBox.innerHTML = "<p style='text-align:center;color:#777'>No matching users</p>";
      return;
    }

    filtered.forEach(u => {
      const div = document.createElement("div");
      div.className = "user-card";
      div.onclick = () =>
        location.href = "public_user.html?user=" + encodeURIComponent(u.username);

      div.innerHTML = `
        <img src="${safe(u.profilePhoto || "default.png")}">
        <div class="info">
          <div class="name">
            ${safe(u.username)}
            ${u.verified ? '<span class="verified">✔️</span>' : ''}
            ${onlineUsers.includes(u.username) ? '<span class="status-dot"></span>' : ''}
          </div>
          <div class="distance">
            ${u.dist != null ? u.dist.toFixed(1) + " km away" : "Distance hidden"}
          </div>
          <div class="bio">${safe((u.bio || "").slice(0, 60))}</div>
        </div>
      `;
      resultsBox.appendChild(div);
    });
  }

  /* ---------------- EVENTS ---------------- */
  const ids = [
    "usernameFilter","genderFilter","interestFilter",
    "ageMin","ageMax","verifiedOnly"
  ];

  const verifiedOnlyBox = document.getElementById("verifiedOnly");
  ids.forEach(id => {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });

  init();
})();
