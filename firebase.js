// firebase.js
export const enableFirebase = true; // coloque false se quiser deixar off

// SUA config do Firebase (já estava correta)
const firebaseConfig = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let app, auth, provider;
let _inited = false;

async function init() {
  if (_inited || !enableFirebase) return;
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const {
    getAuth, GoogleAuthProvider, onAuthStateChanged,
    signInWithPopup, signInWithRedirect, getRedirectResult, signOut
  } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();

  // guardar refs nas funções exportadas
  Object.assign(exportsObj, {
    _onAuthStateChanged: onAuthStateChanged,
    _signInWithPopup: signInWithPopup,
    _signInWithRedirect: signInWithRedirect,
    _getRedirectResult: getRedirectResult,
    _signOut: signOut
  });

  // tenta resolver login por redirect, se houver
  try { await getRedirectResult(auth); } catch {}

  _inited = true;
}

const exportsObj = {
  enableFirebase,
  async onAuthChange(cb){
    if (!enableFirebase) { cb(null); return; }
    await init();
    exportsObj._onAuthStateChanged(auth, u => cb(u));
  },
  async loginWithGoogle(){
    if (!enableFirebase) return;
    await init();
    try {
      await exportsObj._signInWithPopup(auth, provider);
    } catch (e) {
      // iOS/Safari pode bloquear popup → fallback redirect
      await exportsObj._signInWithRedirect(auth, provider);
    }
  },
  async logout(){
    if (!enableFirebase) return;
    await init();
    await exportsObj._signOut(auth);
  }
};

export const { onAuthChange, loginWithGoogle, logout } = exportsObj;
