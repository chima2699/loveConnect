/* AUTH */
const token = localStorage.getItem("token");
const me = localStorage.getItem("username");
if (!token || !me) location.href = "index.html";

const params = new URLSearchParams(location.search);
const profileUser = params.get("user");
if (!profileUser) location.href = "swipe.html";

const auth = () => ({
    "Authorization":"Bearer "+token,
    "Content-Type":"application/json"
});

/* DOM */
const photo = document.getElementById("photo");
const onlineDot = document.getElementById("onlineDot");
const usernameLabel = document.getElementById("usernameLabel");
const locationLabel = document.getElementById("locationLabel");
const distanceLabel = document.getElementById("distanceLabel");
const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const followBtn = document.getElementById("followBtn");
const msgBtn = document.getElementById("msgBtn");
const blockBtn = document.getElementById("blockBtn");
const voiceBtn = document.getElementById("voiceCallBtn");
const videoBtn = document.getElementById("videoCallBtn");
const reportBtn = document.getElementById("reportBtn");
const userAbout = document.getElementById("userAbout");
const compatibilityBox = document.getElementById("compatibilityBox");
const postsArea = document.getElementById("postsArea");

/* PHOTO GALLERY */
let photos = [];
let photoIndex = 0;

document.getElementById("nextPhoto").onclick = ()=>{
    if(photoIndex < photos.length-1){
        photoIndex++;
        photo.src = photos[photoIndex];
    }
};
document.getElementById("prevPhoto").onclick = ()=>{
    if(photoIndex > 0){
        photoIndex--;
        photo.src = photos[photoIndex];
    }
};

document.getElementById("giftBtn").addEventListener("click", async () => {
  const to = prompt("Enter username to gift");
  const amount = Number(prompt("Enter amount"));

  if (!to || !amount || amount <= 0) return alert("Invalid input");

  const res = await fetch("/api/coins/gift", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ to, amount })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  alert("Coins gifted successfully");
});


/* PROFILE */
async function loadProfile(){
    const res = await fetch(`/api/profile?username=${profileUser}`,{headers:auth()});
    const u = await res.json();

    usernameLabel.textContent = profileUser;
    locationLabel.textContent = u.location || "";

    photos = (u.profilePhotos && u.profilePhotos.length)
        ? u.profilePhotos
        : [u.profilePhoto || "/public/default.png"];
    photo.src = photos[0];

    if(u.online) onlineDot.style.display = "block";

    userAbout.innerHTML = `
        <b>Age:</b> ${u.age || ""}<br>
        <b>Gender:</b> ${u.gender || ""}<br>
        <b>Interested In:</b> ${u.interestedIn || ""}<br>
        <b>Goal:</b> ${u.goal || ""}<br>
        <b>Interests:</b> ${u.interests || ""}<br>
        <b>Bio:</b> ${u.bio || ""}
    `;
}

/* DISTANCE */
function haversine(a,b,c,d){
    const R=6371;
    const dLat=(c-a)*Math.PI/180;
    const dLon=(d-b)*Math.PI/180;
    const x=Math.sin(dLat/2)**2 +
        Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180) *
        Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

async function loadDistance(){
    const meP = await fetch(`/api/profile?username=${me}`,{headers:auth()}).then(r=>r.json());
    const them = await fetch(`/api/profile?username=${profileUser}`,{headers:auth()}).then(r=>r.json());
    if(meP.lat && them.lat){
        const d = haversine(meP.lat,meP.lon,them.lat,them.lon);
        distanceLabel.textContent = d < 1 ? "Less than 1 km away" : `${d.toFixed(1)} km away`;
    }
}

/* FOLLOW */
async function loadFollow(){
    const res = await fetch("/api/follows/all",{headers:auth()});
    const list = await res.json();
    followersCount.textContent = list.filter(f=>f.followee===profileUser).length;
    followingCount.textContent = list.filter(f=>f.follower===profileUser).length;

    const iFollow = list.some(f=>f.follower===me && f.followee===profileUser);
    followBtn.textContent = iFollow ? "Unfollow" : "Follow";
    followBtn.className = "btn " + (iFollow?"unfollow-btn":"follow-btn");
}

followBtn.onclick = async () => {
  followBtn.disabled = true;

  try {
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...auth()
      },
      body: JSON.stringify({ followee: profileUser })
    });

    const data = await res.json();
    if (!data.success) throw new Error("Failed");

    // ✅ update UI from backend truth
    followBtn.textContent =
      data.action === "followed" ? "Unfollow" : "Follow";

    followersCount.textContent = data.followers;

  } catch (err) {
    alert("Action failed");
  } finally {
    followBtn.disabled = false;
  }
};



/* MATCH CHECK */
async function checkMatch(){
    const res = await fetch(`/api/match/check?user=${profileUser}`,{headers:auth()});
    const {matched} = await res.json();
    msgBtn.disabled = !matched;
    msgBtn.textContent = matched ? "Message" : "Match to Chat";
}

/* ACTIONS */
msgBtn.onclick = ()=>location.href=`message.html?user=${profileUser}`;
voiceBtn.onclick = ()=>location.href=`call.html?user=${profileUser}&type=voice`;
videoBtn.onclick = ()=>location.href=`call.html?user=${profileUser}&type=video`;

blockBtn.onclick = async ()=>{
    await fetch("/api/block/toggle",{method:"POST",headers:auth(),body:JSON.stringify({target:profileUser})});
};

reportBtn.onclick = async ()=>{
    const reason = prompt("Reason?");
    if(reason){
        await fetch("/api/report",{method:"POST",headers:auth(),body:JSON.stringify({target:profileUser,reason})});
        alert("Reported");
    }
};

/* COMPATIBILITY */
async function compatibility(){
    const [meP,them] = await Promise.all([
        fetch(`/api/profile?username=${me}`,{headers:auth()}).then(r=>r.json()),
        fetch(`/api/profile?username=${profileUser}`,{headers:auth()}).then(r=>r.json())
    ]);

    let score = 0;
    if(meP.gender===them.interestedIn) score+=35;
    if(them.gender===meP.interestedIn) score+=35;
    if(meP.goal===them.goal) score+=15;

    const mi=(meP.interests||"").split(",");
    const ti=(them.interests||"").split(",");
    score += mi.filter(x=>ti.includes(x)).length*5;

    compatibilityBox.innerHTML = `<b>${Math.min(score,100)}% match</b>`;
}

/* POSTS */
async function loadPosts(){
    const res = await fetch("/api/posts",{headers:auth()});
    const posts = (await res.json()).filter(p=>p.username===profileUser);
    postsArea.innerHTML = posts.length ? "" : "<p>No posts yet.</p>";
    posts.reverse().forEach(p=>{
        const div=document.createElement("div");
        div.className="post";
        div.innerHTML=`
            <b>${p.username}</b>
            <div style="font-size:12px;color:#777">${new Date(p.timestamp).toLocaleString()}</div>
            <div>${p.content}</div>
            ${p.image?`<img src="${p.image}">`:""}
        `;
        postsArea.appendChild(div);
    });
}

/* INIT */
(async()=>{
    await loadProfile();
    await loadFollow();
    await loadDistance();
    await checkMatch();
    await compatibility();
    await loadPosts();
})();
