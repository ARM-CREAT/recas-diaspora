/* ============================================================
   RECAS — Synchronisation temps réel (Firebase Firestore)
   ------------------------------------------------------------
   Quand un membre adhère/cotise, ou quand le bureau publie une
   annonce ou confirme une cotisation, la modification apparaît
   INSTANTANÉMENT sur tous les appareils connectés.

   ▶ À FAIRE UNE SEULE FOIS :
   1. Collez ci-dessous la configuration de VOTRE projet Firebase.
      Vous pouvez réutiliser le MÊME projet que vos autres sites
      (copiez l'objet firebaseConfig de leur firebase-config.js).
      RECAS écrit dans son propre document, il n'écrase rien.
   2. Dans la console Firebase : activez « Firestore Database ».
   3. Réglez les règles de sécurité (voir le bas de ce fichier).
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* 🔧 1. Configuration Firebase (projet dédié « recas-diaspora ») */
const firebaseConfig = {
  apiKey:            "AIzaSyCEAb0xRKr47VCR0BpuLuTsXiKHWOm0IOQ",
  authDomain:        "recas-diaspora.firebaseapp.com",
  projectId:         "recas-diaspora",
  storageBucket:     "recas-diaspora.firebasestorage.app",
  messagingSenderId: "188306361865",
  appId:             "1:188306361865:web:0858e91d8ebd2db6bdb2d8"
};

/* ------------------------------------------------------------ */
/* Tant que la config n'est pas remplie, le site fonctionne     */
/* normalement en local (sans synchro). Aucune erreur affichée. */
if (firebaseConfig.apiKey.includes("VOTRE")) {
  console.log("ℹ️ RECAS : renseignez firebase-config.js pour activer le temps réel.");
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const db  = getFirestore(app);
    const ref = doc(db, "recas_app", "state");   // document unique de RECAS

    let applyingRemote = false;   // on applique une mise à jour reçue → ne pas la réécrire
    const clientId = "c_" + Math.random().toString(36).slice(2) + Date.now(); // identité unique de cet appareil
    let writeTimer = null;

    function pushNow() {
      setDoc(ref, { state: JSON.stringify(window.state), writer: clientId, ts: Date.now() })
        .catch(e => console.warn("RECAS sync (écriture) :", e.message));
    }
    window.RECAS_pushNow = pushNow;

    /* 1) ÉCOUTE TEMPS RÉEL — toute modification distante met à jour le site */
    onSnapshot(ref, (snap) => {
      if (!snap.exists()) { pushNow(); return; }        // 1er démarrage : on initialise le doc
      const data = snap.data();
      if (!data || !data.state) return;
      if (data.writer === clientId) return;             // notre propre écho → ignorer
      try {
        const incoming = JSON.parse(data.state);
        // ne pas écraser la session admin ouverte localement
        if (window.state && window.state.auth && window.state.auth.logged)
          incoming.auth = window.state.auth;
        applyingRemote = true;
        window.state = incoming;
        if (typeof renderAll === "function") renderAll();
        applyingRemote = false;
      } catch (e) { applyingRemote = false; }
    }, (err) => console.warn("RECAS sync (écoute) :", err.message));

    /* 2) ÉCRITURE — on enveloppe save() pour pousser l'état (anti-rebond 0,4 s) */
    const _save = window.save;
    window.save = function () {
      if (typeof _save === "function") _save();   // garde la sauvegarde locale (hors-ligne)
      if (applyingRemote) return;                 // ne pas réémettre ce qu'on vient de recevoir
      clearTimeout(writeTimer);
      writeTimer = setTimeout(pushNow, 400);
    };

    console.log("✅ RECAS : synchronisation temps réel active.");
  } catch (e) {
    console.warn("RECAS : Firebase non initialisé —", e.message);
  }
}

/* ============================================================
   RÈGLES DE SÉCURITÉ FIRESTORE (à coller dans la console Firebase
   → Firestore Database → Règles) :

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /recas_app/state {
         allow read, write: if true;   // ouvert (MVP). À restreindre ensuite.
       }
     }
   }

   ⚠️ « allow write: if true » laisse tout le monde écrire. Pour une
   mise en production durable, protégez l'écriture (Firebase Auth, ou
   séparation lecture publique / écriture réservée). Je peux vous
   aider à mettre ça en place quand vous voudrez.
   ============================================================ */
