/* ============================================================
   RECAS — Synchronisation temps réel (Firebase « compat »)
   Projet : recas-diaspora
   ------------------------------------------------------------
   ⚠️ NE PAS ajouter de "import" ici : ce fichier est chargé
   comme script classique. index.html charge déjà le SDK Firebase
   (firebase-app-compat.js + firebase-firestore-compat.js) AVANT
   ce fichier. On utilise donc l'objet global "firebase".
   ============================================================ */

var RECAS_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCEAb0xRKr47VCR0BpuLuTsXiKHWOm0IOQ",
  authDomain:        "recas-diaspora.firebaseapp.com",
  projectId:         "recas-diaspora",
  storageBucket:     "recas-diaspora.firebasestorage.app",
  messagingSenderId: "188306361865",
  appId:             "1:188306361865:web:0858e91d8ebd2db6bdb2d8"
};

(function () {
  /* Bandeau discret : ne s'affiche qu'en cas de PROBLÈME de connexion.
     Quand tout va bien, aucun message n'apparaît à l'écran (juste dans la console). */
function showStatus(text, ok){
  if (ok) return;   // rien à l'écran quand la synchro fonctionne
  var el = document.getElementById("recas-fb-status");
  if (!el) {
    el = document.createElement("div");
    el.id = "recas-fb-status";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;padding:9px 14px;font:600 13px/1.4 system-ui,sans-serif;text-align:center;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)";
    el.onclick = function(){ el.style.display = "none"; };
    (document.body || document.documentElement).appendChild(el);
  }
  el.style.display = "block";
  el.style.background = "#cf2e2e";
  el.textContent = "⚠️ " + text + "  ·  (toucher pour masquer)";
}
function notify(m){
  // plus de toast ni de bandeau pour les messages de succès — uniquement la console
  var estErreur = m.indexOf("⚠️") === 0;
  if (estErreur) {
    try { if (typeof window.toast === "function") window.toast(m); } catch(e){}
    showStatus(m.replace(/^[✅⚠️]\s*/, ""), false);
  }
  console.log("RECAS:", m);
}
  window.RECAS_FB_STATUS = "init";

  if (typeof firebase === "undefined") {
    notify("⚠️ SDK Firebase non chargé (vérifier les <script> dans index.html).");
    return;
  }

  try {
    firebase.initializeApp(RECAS_FIREBASE_CONFIG);
    var db  = firebase.firestore();
    var ref = db.collection("recas_app").doc("state");

    var clientId = "c_" + Math.random().toString(36).slice(2) + Date.now();
    var applyingRemote = false, connected = false, timer = null;

    function pushNow(){
      var snap = {};                                   // copie de l'état SANS les identifiants admin
      for (var k in window.state) { if (k !== "auth") snap[k] = window.state[k]; }
      ref.set({ state: JSON.stringify(snap), writer: clientId, ts: Date.now() })
        .then(function(){ window.RECAS_FB_STATUS = "ok"; })
        .catch(function(e){ window.RECAS_FB_STATUS = "error:" + (e.code || e.message); notify("⚠️ Envoi temps réel échoué : " + (e.code || e.message)); });
    }
    window.RECAS_pushNow = pushNow;

    /* 1) ÉCOUTE TEMPS RÉEL */
    ref.onSnapshot(function (snap) {
      if (!connected) { connected = true; window.RECAS_FB_STATUS = "ok"; notify("✅ Temps réel connecté"); }
      if (!snap.exists) { pushNow(); return; }        // 1er démarrage : on initialise le document
      var data = snap.data();
      if (!data || !data.state) return;
      if (data.writer === clientId) return;           // notre propre écho → ignorer
      try {
        var incoming = JSON.parse(data.state);
        incoming.auth = (window.state && window.state.auth) ? window.state.auth : incoming.auth;  // identifiants admin = locaux uniquement
        applyingRemote = true;
        window.state = incoming;
        if (typeof renderAll === "function") renderAll();
        applyingRemote = false;
      } catch (e) { applyingRemote = false; }
    }, function (err) {
      window.RECAS_FB_STATUS = "error:" + (err.code || err.message);
      if (err.code === "permission-denied") notify("⚠️ Temps réel bloqué : règles Firestore à publier (recas_app).");
      else if (err.code === "unavailable" || err.code === "failed-precondition") notify("⚠️ Temps réel : base Firestore non activée pour ce projet.");
      else notify("⚠️ Temps réel non connecté : " + (err.code || err.message));
      console.warn("RECAS sync (écoute) :", err);
    });

    /* 2) ÉCRITURE — on enveloppe save() pour pousser l'état (anti-rebond 0,4 s) */
    var _save = window.save;
    window.save = function () {
      if (typeof _save === "function") _save();   // sauvegarde locale conservée (hors-ligne)
      if (applyingRemote) return;                 // ne pas réémettre ce qu'on vient de recevoir
      clearTimeout(timer);
      timer = setTimeout(pushNow, 400);
    };
    if (typeof _save !== "function") notify("⚠️ Site pas tout à fait prêt, rechargez la page.");

    console.log("RECAS : Firebase compat initialisé (projet recas-diaspora).");
  } catch (e) {
    window.RECAS_FB_STATUS = "fatal:" + e.message;
    notify("⚠️ Firebase non initialisé : " + e.message);
    console.warn("RECAS : Firebase non initialisé —", e);
  }
})();

/* ============================================================
   RAPPEL — console Firebase du projet recas-diaspora :
   1) Firestore Database → Créer une base de données.
   2) Règles → coller puis Publier :
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /recas_app/{id} { allow read, write: if true; }
     }
   }
   ============================================================ */
