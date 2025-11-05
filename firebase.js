// firebase.js
export const enableFirebase = true; // ← se quiser deixar opcional troque para false

// SUA CONFIG (a mesma do seu projeto)
const firebaseConfig = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let _app,_auth,_fs,_st,_modsLoaded=false;

async function loadMods(){
  if(_modsLoaded) return;
  const app    = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const auth   = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const store  = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const storage= await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  _app = app.initializeApp(firebaseConfig);
  _auth = auth.getAuth(_app);
  _fs   = store.getFirestore(_app);
  _st   = storage.getStorage(_app);
  _modsLoaded = true;
  // tenta capturar resultado de redirects anteriores (iOS bloqueia popup)
  try{ await auth.getRedirectResult(_auth); }catch{}
  return {app,auth,store,storage};
}

export async function onAuthChange(cb){
  if(!enableFirebase){ cb(null); return; }
  const {auth} = await loadMods();
  auth.onAuthStateChanged(_auth, u=>cb(u));
}

export async function loginWithGoogle(){
  if(!enableFirebase) throw new Error('FIREBASE_DISABLED');
  const {auth} = await loadMods();
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try{
    const res = await auth.signInWithPopup(_auth, provider);
    return res.user;
  }catch(e){
    // fallback para iOS / bloqueio de popup
    if(String(e.code||'').includes('popup') || String(e.message||'').includes('popup')){
      await auth.signInWithRedirect(_auth, provider);
      return null; // redirecionará
    }
    throw e;
  }
}

export async function logout(){
  if(!enableFirebase) return;
  const {auth} = await loadMods();
  await auth.signOut(_auth);
}

// (Exports opcionais de Firestore/Storage – deixe assim por enquanto)
export function isFirebaseEnabled(){ return enableFirebase; }
