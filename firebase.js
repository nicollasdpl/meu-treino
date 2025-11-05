// firebase.js — drop-in
// Liga/desliga Firebase por flag e expõe helpers de Auth/Sync.

export const enableFirebase = true;           // <<< LIGADO
export const ENABLE_FIREBASE = enableFirebase; // compat

const config = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let app, auth, db, storage, user = null;
const listeners = new Set();

async function boot() {
  if (!enableFirebase) throw new Error("Firebase desativado");
  if (app) return { app, auth, db, storage };
  const v = "10.12.2";
  const [{ initializeApp }] =
    await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`)
    ]);
  const [
    { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged },
    { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where },
    { getStorage, ref, uploadBytes, getDownloadURL }
  ] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-storage.js`)
  ]);

  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Trata retorno de redirect (iOS/PWA)
  try { await getRedirectResult(auth); } catch {}

  onAuthStateChanged(auth, (u) => {
    user = u || null;
    listeners.forEach(fn => fn(user));
  });

  // Exponho alguns helpers no objeto para reuso
  Object.assign(boot, {
    GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut,
    doc, setDoc, getDoc, collection, getDocs, query, where, ref, uploadBytes, getDownloadURL
  });

  return { app, auth, db, storage };
}

export function onAuthChange(cb) {
  listeners.add(cb);
  cb(user);
}

export function currentUser() { return user; }

export async function loginWithGoogle() {
  if (!enableFirebase) throw new Error("Firebase desativado");
  const { auth } = await boot();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = boot;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // popup bloqueado? cai no redirect
    await signInWithRedirect(auth, provider);
  }
}

export async function logout() {
  if (!enableFirebase) return;
  const { auth } = await boot();
  await boot.signOut(auth);
}

/* **************
 * Opcional: EXEMPLOS de sync (cole quando quiser usar Firestore/Storage)
 **************
export async function pushSession(uid, date, payload) {
  const { db } = await boot();
  const { doc, setDoc } = boot;
  await setDoc(doc(db, `users/${uid}/sessoes/${date}`), payload, { merge: true });
}
*/
