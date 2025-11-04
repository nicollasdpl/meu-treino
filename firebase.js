/* Firebase helper for Meu Treino 2.0
 * This module conditionally loads Firebase when ENABLE_FIREBASE is true.
 * It provides Google Auth login and sync functions for sessions, habits and photos.
 */

// When true the app requires Google login and syncs with Firestore/Storage.
// Set to false to run completely offline.  Updated to true by default so
// that the login button works.
export const ENABLE_FIREBASE = true;

// Firebase config provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let app = null;
let auth = null;
let firestore = null;
let storage = null;
let user = null;

/**
 * Lazy-load Firebase modules and initialize the app if not already.
 */
async function initFirebase() {
  if (!ENABLE_FIREBASE) return;
  if (app) return;
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js');
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
  const { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js');

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);

  return { auth, firestore, storage, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, collection, getDocs, query, where, onSnapshot, ref, uploadBytes, getDownloadURL };
}

/**
 * Prompt the user to sign in with Google.
 */
export async function loginWithGoogle() {
  if (!ENABLE_FIREBASE) return null;
  const fb = await initFirebase();
  const provider = new fb.GoogleAuthProvider();
  try {
    // Try the popup first. Some browsers or PWA contexts block pop‑ups.
    const result = await fb.signInWithPopup(fb.auth, provider);
    user = result.user;
    return user;
  } catch (e) {
    console.warn('Popup login failed, falling back to redirect', e);
    try {
      await fb.signInWithRedirect(fb.auth, provider);
      // After redirect the page will reload and onAuthStateChanged will fire.
      return null;
    } catch (e2) {
      console.error('Redirect login error', e2);
      alert('Erro ao entrar: ' + e2.message);
      throw e2;
    }
  }
}

/**
 * Sign the user out.
 */
export async function logout() {
  if (!ENABLE_FIREBASE || !auth) return;
  await auth.signOut();
  user = null;
}

export function getCurrentUser() {
  return user;
}

/**
 * Watch for auth state changes and invoke callback with user or null.
 */
export async function onAuthChange(callback) {
  if (!ENABLE_FIREBASE) {
    callback(null);
    return;
  }
  const fb = await initFirebase();
  fb.onAuthStateChanged(fb.auth, u => {
    user = u;
    callback(u);
  });
}

/**
 * Pull all sessions from Firestore and return a map keyed by date.
 */
export async function pullSessions(uid) {
  if (!ENABLE_FIREBASE) return {};
  const fb = await initFirebase();
  const sessionsRef = fb.collection(fb.firestore, `users/${uid}/sessoes`);
  const snap = await fb.getDocs(sessionsRef);
  const map = {};
  snap.forEach(doc => { map[doc.id] = doc.data(); });
  return map;
}

/**
 * Push or update a session document to Firestore.
 */
export async function pushSession(uid, date, session) {
  if (!ENABLE_FIREBASE) return;
  const fb = await initFirebase();
  const docRef = fb.doc(fb.firestore, `users/${uid}/sessoes/${date}`);
  await fb.setDoc(docRef, session, { merge: true });
}

/**
 * Pull all habits.
 */
export async function pullHabits(uid) {
  if (!ENABLE_FIREBASE) return {};
  const fb = await initFirebase();
  const habitsRef = fb.collection(fb.firestore, `users/${uid}/habitos`);
  const snap = await fb.getDocs(habitsRef);
  const map = {};
  snap.forEach(doc => { map[doc.id] = doc.data(); });
  return map;
}

/**
 * Set habits for a date.
 */
export async function pushHabits(uid, date, habits) {
  if (!ENABLE_FIREBASE) return;
  const fb = await initFirebase();
  const docRef = fb.doc(fb.firestore, `users/${uid}/habitos/${date}`);
  await fb.setDoc(docRef, habits, { merge: true });
}

/**
 * Upload a photo blob to Firebase Storage and return its download URL.
 */
export async function uploadPhoto(uid, file, ym) {
  if (!ENABLE_FIREBASE) return null;
  const fb = await initFirebase();
  const id = Date.now().toString(36);
  const path = `users/${uid}/evolucao/${ym}/${id}.jpg`;
  const storageRef = fb.ref(fb.storage, path);
  await fb.uploadBytes(storageRef, file);
  const url = await fb.getDownloadURL(storageRef);
  // Also store metadata in Firestore
  const meta = { url, createdAt: Date.now() };
  const docRef = fb.doc(fb.firestore, `users/${uid}/fotos/${ym}/${id}`);
  await fb.setDoc(docRef, meta, { merge: true });
  return url;
}