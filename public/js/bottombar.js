(function () {
  const path = location.pathname.toLowerCase();

  // ❌ Pages that MUST NOT show bottombar
  const disabledPages = [
    "index.html",
    "login.html",
    "register.html"
  ];

  // ❌ Full-screen pages (hide bottombar)
  const fullscreenPages = [
    "message.html",
    "call.html",
    "video_call.html"
  ];

  const currentPage = path.split("/").pop();

  // Stop completely on login/register
  if (disabledPages.includes(currentPage)) {
    return;
  }

  async function loadBottomBar() {
    const container = document.getElementById("bottomBarContainer");
    if (!container) return;

    const res = await fetch("/partials/bottombar.html");
    const html = await res.text();
    container.innerHTML = html;

    // Hide on fullscreen pages (chat / calls)
    if (fullscreenPages.includes(currentPage)) {
      container.style.display = "none";
      document.body.style.paddingBottom = "0";
      return;
    }

    // Highlight active icon
    const pageName = currentPage.replace(".html", "");
    document.querySelectorAll(".bottombar a").forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add("active");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", loadBottomBar);
})();
