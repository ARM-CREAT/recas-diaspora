/* ============================================================
   RECAS — Synchronisation temps réel (Firebase Firestore)
   Projet : recas-diaspora
   ------------------------------------------------------------
   Affiche l'état du temps réel directement dans le site
   (message « connecté » ou « non connecté » à l'ouverture),
   pour diagnostiquer sans ouvrir la console.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCEAb0xRKr47VCR0BpuLuTsXiKHWOm0IOQ",
  authDomain:        "recas-diaspora.firebaseapp.com",
  projectId:         "recas-diaspora",
  storageBucket:     "recas-diaspora.firebasestorage.app",
  messagingSenderId: "188306361865",
  appId:             "1:188306361865:web:0858e91d8ebd2db6bdb2d8"
};

/* Petit message visible dans le site (utilise le toast de l'app si présent) */
function notify(msg){
  try { if (typeof window.toast === "function") window.toast(msg); } catch(e){}
  console.log("RECAS:", msg);
}
window.RECAS_FB_STATUS = "init";

try {
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const ref = doc(db, "recas_app", "state");

  let applyingRemote = false;
  let connected = false;
  const clientId = "c_" + Math.random().toString(36).slice(2) + Date.now();
  let writeTimer = null;

  function pushNow(){
    setDoc(ref, { state: JSON.stringify(window.state), writer: clientId, ts: Date.now() })
      .then(()=>{ window.RECAS_FB_STATUS = "ok"; })
      .catch(e=>{
        window.RECAS_FB_STATUS = "error:" + (e.code || e.message);
        notify("⚠️ Envoi temps réel échoué : " + (e.code || e.message));
      });
  }
  window.RECAS_pushNow = pushNow;

  /* 1) ÉCOUTE TEMPS RÉEL */
  onSnapshot(ref, (snap) => {
    if (!connected){ connected = true; window.RECAS_FB_STATUS = "ok"; notify("✅ Temps réel connecté"); }
    if (!snap.exists()){ pushNow(); return; }      // 1er démarrage : on initialise le document
    const data = snap.data();
    if (!data || !data.state) return;
    if (data.writer === clientId) return;          // notre propre écho → ignorer
    try {
      const incoming = JSON.parse(data.state);
      if (window.state && window.state.auth && window.state.auth.logged)
        incoming.auth = window.state.auth;          // ne pas déconnecter la session admin locale
      applyingRemote = true;
      window.state = incoming;
      if (typeof renderAll === "function") renderAll();
      applyingRemote = false;
    } catch(e){ applyingRemote = false; }
  }, (err) => {
    window.RECAS_FB_STATUS = "error:" + (err.code || err.message);
    if (err.code === "permission-denied")
      notify("⚠️ Temps réel bloqué : règles Firestore à publier (recas_app).");
    else if (err.code === "unavailable" || err.code === "failed-precondition")
      notify("⚠️ Temps réel : base Firestore non activée pour ce projet.");
    else
      notify("⚠️ Temps réel non connecté : " + (err.code || err.message));
    console.warn("RECAS sync (écoute) :", err);
  });

  /* 2) ÉCRITURE — on enveloppe save() pour pousser l'état (anti-rebond 0,4 s) */
  const _save = window.save;
  window.save = function(){
    if (typeof _save === "function") _save();   // sauvegarde locale (hors-ligne) conservée
    if (applyingRemote) return;                 // ne pas réémettre ce qu'on vient de recevoir
    clearTimeout(writeTimer);
    writeTimer = setTimeout(pushNow, 400);
  };

  if (typeof _save !== "function")
    notify("⚠️ Temps réel : le site n'était pas prêt, rechargez la page.");

  console.log("RECAS : module Firebase chargé (projet recas-diaspora).");
} catch (e) {
  window.RECAS_FB_STATUS = "fatal:" + e.message;
  notify("⚠️ Firebase non initialisé : " + e.message);
  console.warn("RECAS : Firebase non initialisé —", e);
}

/* ============================================================
   RAPPEL — console Firebase du projet recas-diaspora :
   1) Firestore Database → Créer une base de données.
   2) Onglet Règles → coller puis Publier :
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /recas_app/{id} { allow read, write: if true; }
     }
   }
   ============================================================ */
