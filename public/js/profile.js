(() => {
  "use strict";

  /* ================= AUTH ================= */
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (!token || !username) {
    location.href = "index.html";
    return;
  }

  const $ = id => document.getElementById(id);

  /* ================= STATE ================= */
  let cropper = null;
  let submitting = false;

  /* ================= SOCKET ================= */
  const socket = io({ auth: { token } });
  socket.on("online_list", list => {
    const el = $("onlineStatus");
    if (el) el.textContent = list.includes(username) ? "Online" : "Offline";
  });

  const followBtn = document.getElementById("followBtn");

  /* ================= BASIC UI ================= */
  const usernameLabel = $("usernameLabel");
  if (usernameLabel) usernameLabel.textContent = username;

  /* ================= LOAD PROFILE ================= */
  async function loadProfile() {
    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`, {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) throw new Error("Profile fetch failed");

      const p = await res.json();
if (followBtn) {
  followBtn.textContent = p.isFollowing ? "Unfollow" : "Follow";
}

      const mainPhoto = $("mainPhoto");
      if (mainPhoto) {
        mainPhoto.src = p.profilePhoto || "/default.png";
      }

      const basicInfo = $("basicInfo");
      if (basicInfo) {
        basicInfo.innerHTML = `
          Age: ${p.age || "-"}<br>
          Gender: ${p.gender || "-"}<br>
          Location: ${p.location || "-"}
        `;
      }

      if (followBtn) {
  followBtn.textContent = p.isFollowing ? "Unfollow" : "Follow";
}

      const aboutBox = $("aboutBox");
      if (aboutBox) aboutBox.textContent = p.bio || "—";

      const gallery = $("photoGallery");
      if (gallery) {
        gallery.innerHTML = "";
        (p.photos || []).forEach(src => {
          const img = document.createElement("img");
          img.src = src;
          gallery.appendChild(img);
        });
      }

    } catch (err) {
      console.error("Load profile error:", err);
      alert("Failed to load profile");
    }
  }

  /* ================= PHOTO PICK ================= */
  const picker = $("photoPicker");
  if (picker) {
    picker.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const cropImg = $("cropImage");
        const modal = $("cropModal");
        if (!cropImg || !modal) return;

        cropImg.src = reader.result;
        modal.style.display = "flex";

        try {
          cropper?.destroy();
          cropper = new Cropper(cropImg, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: "move"
          });
        } catch (e) {
          console.error("Cropper init failed:", e);
        }
      };

      reader.readAsDataURL(file);
    });
  }

  /* ================= SAVE (CROP & UPLOAD) ================= */
  const cropBtn = $("cropBtn");
  if (cropBtn) {
    cropBtn.addEventListener("click", async () => {
      if (!cropper || submitting) return;
      submitting = true;

      try {
        cropper.getCroppedCanvas({ width: 600, height: 600 })
          .toBlob(async blob => {
            try {
              const fd = new FormData();
              fd.append("photo", blob, "profile.jpg");

              const res = await fetch("/api/profile/photo", {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: fd
              });

              const json = res.headers.get("content-type")?.includes("application/json")
                ? await res.json()
                : {};

              if (!res.ok) {
                console.error("Upload failed:", json);
                alert(json.error || "Upload failed");
              } else {
                await loadProfile();
              }

            } catch (err) {
              console.error("Upload error:", err);
              alert("Upload error");
            } finally {
              submitting = false;
              closeCropModal();
            }
          }, "image/jpeg", 0.9);

      } catch (err) {
        submitting = false;
        console.error("Crop error:", err);
      }
    });
  }

  /* ================= CANCEL ================= */
  const cancelBtn = $("cancelCrop");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeCropModal);
  }

  function closeCropModal() {
    const modal = $("cropModal");
    if (modal) modal.style.display = "none";
    try { cropper?.destroy(); } catch {}
    cropper = null;
    submitting = false;
  }

  async function loadCreatorEarnings() {
  const token = localStorage.getItem("token");

  const res = await fetch("/api/creator/earnings", {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();
  if (!res.ok) return;

  document.getElementById("totalEarned").textContent =
    data.totalEarned + " coins";

  const list = document.getElementById("postEarnings");
  list.innerHTML = "";

  data.posts.forEach(p => {
    list.innerHTML += `
      <li>
        🖼️ Post ${p._id}<br>
        💰 ${p.earned} coins<br>
        🔓 ${p.unlocks} unlocks
      </li>
    `;
  });
}

loadCreatorEarnings();


  /* ================= NAV ================= */
  const editBtn = $("editProfile");
  if (editBtn) editBtn.onclick = () => location.href = "profile_edit.html";

  const msgBtn = $("messageBtn");
  if (msgBtn) msgBtn.onclick = () => location.href = `message.html?user=${encodeURIComponent(username)}`;

  /* ================= LOGOUT ================= */
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (confirm("Logout?")) {
        localStorage.clear();
        location.href = "index.html";
      }
    };
  }

  /* ================= INIT ================= */
  loadProfile();

})();
