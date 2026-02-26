(() => {
  "use strict";

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (!token || !username) {
    location.href = "index.html";
    return;
  }

  const $ = id => document.getElementById(id);

  /* ================= LOAD PROFILE ================= */
  (async () => {
    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`, {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) throw new Error("Failed");

      const p = await res.json();

      $("fullname").value = p.fullname || "";
      $("age").value = p.age || "";
      $("gender").value = p.gender || "";
      $("interestedIn").value = p.interestedIn || "";
      $("location").value = p.location || "";
      $("bio").value = p.bio || "";

    } catch (err) {
      alert("Failed to load profile");
    }
  })();

  /* ================= SAVE PROFILE ================= */
  $("saveBtn").onclick = async () => {
    $("saveBtn").disabled = true;

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullname: $("fullname").value.trim(),
          age: $("age").value,
          gender: $("gender").value,
          interestedIn: $("interestedIn").value,
          location: $("location").value.trim(),
          bio: $("bio").value.trim()
        })
      });

      if (!res.ok) throw new Error("Save failed");

      location.href = "profile.html";

    } catch (err) {
      alert("Failed to save profile");
      $("saveBtn").disabled = false;
    }
  };

})();
