/* =====================================================
   LoveConnect Call Logic (Voice + Video)
===================================================== */

"use strict";

/* -------------------------
   AUTH + PARAMS
-------------------------- */
const username = localStorage.getItem("username");
const token = localStorage.getItem("token");
if (!username || !token) location.href = "index.html";

const params = new URLSearchParams(location.search);
const peerUser = params.get("user");
const callType = params.get("type"); // voice | video
const incoming = params.get("incoming") === "1";

document.getElementById("ringUser").innerText = peerUser;

/* -------------------------
   SOCKET (AUTHENTICATED)
-------------------------- */
const socket = io({
  auth: { token }
});

/* -------------------------
   STATE
-------------------------- */
let localStream = null;
let pc = null;
let seconds = 0;
let timer = null;
let balance = 0;
const costPerSeconds = callType === "video" ? 5 : 2;

/* -------------------------
   UI
-------------------------- */
const remoteVideo = document.getElementById("remoteVideo");
const localVideo = document.getElementById("localVideo");
const timerBox = document.getElementById("timerBox");
const coinCost = document.getElementById("coinCost");
const ringingScreen = document.getElementById("ringingScreen");
const ringtone = document.getElementById("ringtone");
const cameraBtn = document.getElementById("cameraBtn");




/* -------------------------
   BALANCE
-------------------------- */
(async function loadBalance(){
  try {
    const res = await fetch("/api/wallet/balance", {
      headers:{ Authorization:"Bearer "+token }
    });
    const data = await res.json();
    balance = Number(data.balance || 0);
  } catch {}
})();

coinCost.textContent = `${costPerSeconds} coins / min`;

/* -------------------------
   TIMER & BILLING
-------------------------- */

function startCall() {
  if (balance <= 0) {
    alert("You don’t have enough coins to start this call");
    return;
  }

  seconds = 0;
  startTimer();
}


async function startTimer(peer, callType) {
  timer = setInterval(async () => {
    seconds++;

    timerBox.textContent =
      `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

    // 🔴 Charge EVERY SECOND
    const res = await fetch("/api/call/charge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        peer,
        type: callType,
        seconds: 1
      })
    });

    const data = await res.json();

    // 🔥 BALANCE HIT ZERO → END CALL
    if (!data.ok && data.error === "Not enough coins") {
      alert("Call ended — insufficient balance");
      endCall();     // your existing function
      stopTimer();
    }

  }, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
}

async function stopTimer(peer) {
  if (timer) clearInterval(timer);

  if (seconds <= 0) return;

  try {
    const res = await fetch("/api/call/charge", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        peer,
        type: callType,   // "voice" | "video"
        seconds
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    balance -= data.charged;
    updateBalanceUI();

  } catch (err) {
    alert(err.message || "Call charge failed");
  }

  seconds = 0;
}

/* -------------------------
   MEDIA
-------------------------- */
async function startMedia(){
  localStream = await navigator.mediaDevices.getUserMedia({
    audio:true,
    video: callType === "video"
  });
  localVideo.srcObject = localStream;
}

/* -------------------------
   PEER CONNECTION
-------------------------- */
function createPeer(){
  pc = new RTCPeerConnection({
    iceServers:[{ urls:"stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("call_ice", {
        to: peerUser,
        candidate: e.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      ringingScreen.style.display = "none";
      ringtone.pause();
      if (!timer) startTimer();
    }
  };
}

/* -------------------------
   OUTGOING
-------------------------- */
async function startOutgoing(){
  createPeer();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("call_offer", {
    to: peerUser,
    offer,
    type: callType
  });
}

/* -------------------------
   SIGNALING
-------------------------- */
socket.on("call_offer", async d => {
  if (!incoming) return;
  await pc.setRemoteDescription(d.offer);
});

socket.on("call_answer", async d => {
  await pc.setRemoteDescription(d.answer);
});

socket.on("call_ice", async d => {
  try { await pc.addIceCandidate(d.candidate); } catch {}
});

socket.on("end_call", endCall);

/* -------------------------
   UI CONTROLS
-------------------------- */
document.getElementById("muteBtn").onclick = () => {
  const t = localStream.getAudioTracks()[0];
  t.enabled = !t.enabled;
};

cameraBtn.onclick = () => {
  if (callType !== "video") return;
  const t = localStream.getVideoTracks()[0];
  t.enabled = !t.enabled;
};

document.getElementById("endBtn").onclick = () => {
  socket.emit("end_call",{ to:peerUser });
  endCall();
};

document.getElementById("acceptBtn").onclick = async () => {
  ringtone.pause();
  ringingScreen.style.display = "none";
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("call_answer",{ to:peerUser, answer });
};

document.getElementById("rejectBtn").onclick = endCall;

/* -------------------------
   CLEANUP
-------------------------- */
function endCall(){
  stopTimer();
  if (localStream) localStream.getTracks().forEach(t=>t.stop());
  if (pc) pc.close();
  location.href = `message.html?user=${peerUser}`;
}

/* -------------------------
   INIT
-------------------------- */
(async function init(){
  await startMedia();
  createPeer();

  if (incoming) {
    ringtone.play();
    ringingScreen.style.display = "flex";
    cameraBtn.style.display = callType === "video" ? "flex" : "none";
  } else {
    ringingScreen.style.display = "none";
    await startOutgoing();
  }

  socket.emit("user_online", username);
})();
