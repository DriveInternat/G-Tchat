// ==== Configuration Firebase (remplacez avec la vôtre) ====
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJECT.firebaseapp.com",
  databaseURL: "https://VOTRE_PROJECT.firebaseio.com",
  projectId: "VOTRE_PROJECT",
  storageBucket: "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Références DB
const messagesRef = db.ref("messages");
const bansRef = db.ref("bans");
const adminsRef = db.ref("admins");

let currentUser = null;
let currentIp = null;
let isAdmin = false;

// Récupérer IP publique
fetch("https://api.ipify.org?format=json")
  .then(res => res.json())
  .then(data => { currentIp = data.ip; });

// Vérifie si banni
function checkBan(uid, ip) {
  return Promise.all([
    bansRef.child(uid).once("value"),
    bansRef.child(ip).once("value")
  ]).then(([uidSnap, ipSnap]) => {
    if (uidSnap.exists() || ipSnap.exists()) {
      document.body.innerHTML = "<h1>⛔ Vous êtes banni du chat</h1>";
      throw new Error("Banni");
    }
  });
}

// UI
const messagesEl = document.getElementById("messages");
const nickEl = document.getElementById("nick");
const textEl = document.getElementById("text");
const sendBtn = document.getElementById("send");
const filterEl = document.getElementById("filter");
const scrollBottomBtn = document.getElementById("scrollBottom");
const loginPopup = document.getElementById("loginPopup");

// Connexion anonyme par défaut
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    try {
      await checkBan(user.uid, currentIp);
    } catch { return; }
    enableChatUI();
    // Vérifie admin
    adminsRef.child(user.uid).on("value", snap => {
      isAdmin = snap.exists();
    });
  } else {
    firebase.auth().signInAnonymously();
  }
});

// Connexion Google
document.getElementById("googleLoginBtn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then(() => loginPopup.style.display = "none")
    .catch(err => alert(err.message));
});

// Connexion Email
document.getElementById("loginEmailBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(() => loginPopup.style.display = "none")
    .catch(err => alert(err.message));
});

// Inscription Email
document.getElementById("registerEmailBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(() => loginPopup.style.display = "none")
    .catch(err => alert(err.message));
});

// Activer chat
function enableChatUI() {
  nickEl.disabled = false;
  textEl.disabled = false;
  sendBtn.disabled = false;
  loginPopup.style.display = "none";
}

// Écoute des messages
messagesRef.limitToLast(200).on("child_added", snapshot => {
  const m = snapshot.val();
  appendMessage(m, snapshot.key);
});

// Envoyer message
sendBtn.addEventListener("click", sendMessage);
textEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const nick = (nickEl.value || "Anon").trim().slice(0, 30);
  const text = (textEl.value || "").trim().slice(0, 1000);
  if (!text) return;
  const payload = {
    uid: currentUser.uid,
    ip: currentIp,
    nick,
    text,
    photo: currentUser.photoURL || null,
    ts: Date.now()
  };
  messagesRef.push(payload).then(() => { textEl.value = ""; });
}

// Affichage message
function appendMessage(m, key) {
  const el = document.createElement("div");
  el.className = "message";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (m.photo) {
    const img = document.createElement("img");
    img.src = m.photo;
    avatar.appendChild(img);
  } else {
    avatar.textContent = (m.nick || "A").slice(0,2).toUpperCase();
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const metaRow = document.createElement("div");
  metaRow.className = "meta-row";

  const nameSpan = document.createElement("strong");
  nameSpan.textContent = m.nick || "Anon";

  const timeSpan = document.createElement("span");
  timeSpan.textContent = new Date(m.ts).toLocaleString();

  metaRow.appendChild(nameSpan);
  metaRow.appendChild(timeSpan);

  // Bouton bannir si admin
  if (isAdmin && m.uid && m.uid !== currentUser.uid) {
    const banBtn = document.createElement("button");
    banBtn.textContent = "🚫 Bannir";
    banBtn.addEventListener("click", () => {
      if (m.uid) bansRef.child(m.uid).set(true);
      if (m.ip) bansRef.child(m.ip).set(true);
      alert(m.nick + " a été banni.");
    });
    metaRow.appendChild(banBtn);
  }

  const txt = document.createElement("div");
  txt.textContent = m.text || "";

  bubble.appendChild(metaRow);
  bubble.appendChild(txt);
  el.appendChild(avatar);
  el.appendChild(bubble);
  messagesEl.appendChild(el);

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Filtre
filterEl.addEventListener("input", applyFilter);
function applyFilter() {
  const q = filterEl.value.trim().toLowerCase();
  Array.from(messagesEl.children).forEach(item => {
    const text = item.innerText.toLowerCase();
    item.style.display = !q || text.includes(q) ? "" : "none";
  });
}

scrollBottomBtn.addEventListener("click", () => {
  messagesEl.scrollTop = messagesEl.scrollHeight;
});
