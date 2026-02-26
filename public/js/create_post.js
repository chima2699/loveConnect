// 📍 FILE: public/js/create_post.js

const token = localStorage.getItem("token");
if (!token) location.href = "index.html";

const form = document.getElementById("postForm");
const postBtn = document.getElementById("postBtn");
const lockCheckbox = document.getElementById("lockPost");
const lockPriceInput = document.getElementById("lockPrice");

/* ================= LOCK TOGGLE ================= */
lockCheckbox.addEventListener("change", () => {
  lockPriceInput.style.display = lockCheckbox.checked ? "block" : "none";
});

/* ================= SUBMIT ================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const content = document.getElementById("content").value.trim();
  const file = document.getElementById("media").files[0];

  if (!file && !content) {
    alert("Write something or select media");
    return;
  }

  const locked = lockCheckbox.checked;
  const lockPrice = locked ? Number(lockPriceInput.value || 0) : 0;

  if (locked && lockPrice <= 0) {
    alert("Enter a valid lock price");
    return;
  }

  // 🎥 Video duration check (30s max)
  if (file && file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(video.src);

      if (video.duration > 30) {
        alert("Video must be 30 seconds or less");
        return;
      }

      await uploadPost(content, file, locked, lockPrice);
    };
  } else {
    await uploadPost(content, file, locked, lockPrice);
  }
});

/* ================= UPLOAD ================= */
async function uploadPost(content, file, locked, lockPrice) {
  const fd = new FormData();
  fd.append("content", content);
  if (file) fd.append("media", file);
  fd.append("locked", locked);
  fd.append("lockPrice", lockPrice);

  postBtn.disabled = true;
  postBtn.innerText = "Posting...";

  try {
    const res = await fetch("/api/posts/create", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      },
      body: fd
    });

    // ✅ SAFE JSON HANDLING (CRITICAL FIX)
    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Server returned non-JSON:", text);
      alert("Upload failed. Server error.");
      return;
    }

    if (!res.ok) {
      alert(data.error || "Post failed");
      return;
    }

    location.href = "posts.html";

  } catch (err) {
    console.error(err);
    alert("Network error");
  } finally {
    postBtn.disabled = false;
    postBtn.innerText = "Post";
  }
}