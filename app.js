// ==== Configuration Firebase (remplacez avec la vôtre) ====
const firebaseConfig = {
  apiKey: "AIzaSyD4FuUOmGCb00GLt2gmdcayaSliaOS7DX0",
  authDomain: "g-tchat-a1d75.firebaseapp.com",
  databaseURL: "https://g-tchat-a1d75-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "g-tchat-a1d75",
  storageBucket: "g-tchat-a1d75.appspot.com",
  messagingSenderId: "248087967340",
  appId: "1:248087967340:web:602ad89b69877f9178ca49"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
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
const googleLoginBtn = document.getElementById("googleLoginBtn");

// Auth anonyme auto
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    try { await checkBan(user.uid, currentIp); } catch { return; }
    adminsRef.child(user.uid).on("value", snap => { isAdmin = snap.exists(); });
  } else {
    firebase.auth().signInAnonymously();
  }
});

// Connexion Google
googleLoginBtn.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert(err.message));
});

// Lecture messages
messagesRef.limitToLast(200).on("child_added", snapshot => {
  appendMessage(snapshot.val());
});

// Envoi message
sendBtn.addEventListener("click", sendMessage);
textEl.addEventListener("keydown", e => {
  if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); }
});
function sendMessage(){
  const nick = (nickEl.value || "Anon").trim().slice(0,30);
  const text = (textEl.value || "").trim().slice(0,1000);
  if(!text) return;
  const payload = {
    uid: currentUser.uid,
    ip: currentIp,
    nick,
    text,
    photo: currentUser.photoURL || null,
    ts: Date.now()
  };
  const msgRef = messagesRef.push(payload).then(()=>{ textEl.value=""; return payload; });
}

// Ajout message DOM
function appendMessage(m){
  const el = document.createElement("div"); el.className="message";

  const avatar = document.createElement("div"); avatar.className="avatar";
  if(m.photo){ const img=document.createElement("img"); img.src=m.photo; avatar.appendChild(img); }
  else{ avatar.textContent=(m.nick||"A").slice(0,2).toUpperCase(); }

  const bubble = document.createElement("div"); bubble.className="bubble";
  const metaRow = document.createElement("div"); metaRow.className="meta-row";
  const nameSpan=document.createElement("strong"); 
  nameSpan.textContent=m.nick||"Anon";
  if(m.isAdmin) nameSpan.classList.add("admin");
  const timeSpan=document.createElement("span"); timeSpan.textContent=new Date(m.ts).toLocaleString();
  metaRow.appendChild(nameSpan); metaRow.appendChild(timeSpan);

  // Bannir si admin
  if(isAdmin && m.uid && m.uid!==currentUser.uid){
    const banBtn=document.createElement("button"); banBtn.textContent="🚫 Bannir";
    banBtn.addEventListener("click",()=>{ if(m.uid)bansRef.child(m.uid).set(true); if(m.ip)bansRef.child(m.ip).set(true); alert(m.nick+" a été banni."); });
    metaRow.appendChild(banBtn);
  }

  const txt=document.createElement("div"); txt.textContent=m.text||"";
  bubble.appendChild(metaRow); bubble.appendChild(txt); el.appendChild(avatar); el.appendChild(bubble);
  messagesEl.appendChild(el);
  messagesEl.scrollTop=messagesEl.scrollHeight;

  // Supprimer le message après 5 secondes
  setTimeout(() => { 
    if(el.parentNode) el.parentNode.removeChild(el); 
  }, 5000);
}

// Filtre
filterEl.addEventListener("input",()=>{
  const q=filterEl.value.trim().toLowerCase();
  Array.from(messagesEl.children).forEach(item=>{
    const text=item.innerText.toLowerCase();
    item.style.display=!q||text.includes(q)?"":"none";
  });
});
scrollBottomBtn.addEventListener("click",()=>{ messagesEl.scrollTop=messagesEl.scrollHeight; });
