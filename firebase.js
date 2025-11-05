/* ===========================
   Firebase (opcional)
   ===========================

   - Não exige login para usar o app
   - Só aparece na aba Perfil
   - Quando enableFirebase = true:
       * Login Google (popup com fallback redirect)
       * Sincroniza:
         users/{uid}/sessoes/{YYYY-MM-DD}
         users/{uid}/habitos/{YYYY-MM-DD}
         users/{uid}/fotos/{id}
*/

export const enableFirebase = true; // <- mude para true se quiser sincronizar

const cfg = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let app, auth, db, storage, user;
let mod = {};

async function boot(){
  if(!enableFirebase || app) return;
  const [{ initializeApp }, A, F, S] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js'),
  ]);
  app = initializeApp(cfg);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
  storage = S.getStorage(app);
  mod = { A, F, S };
}

export async function onAuthChange(cb){
  if(!enableFirebase){ cb(null); return; }
  await boot();
  mod.A.onAuthStateChanged(auth, (u)=>{ user = u||null; cb(user); });
}

export async function loginWithGoogle(){
  if(!enableFirebase) return null;
  await boot();
  const provider = new mod.A.GoogleAuthProvider();
  try{ const r = await mod.A.signInWithPopup(auth, provider); user=r.user; return user; }
  catch{ await mod.A.signInWithRedirect(auth, provider); return null; }
}
export async function logout(){ if(enableFirebase && auth) await mod.A.signOut(auth); }

function getLocal(){ try{ return JSON.parse(localStorage.getItem('sessoes')||'[]'); }catch{ return []; } }
function setLocal(a){ localStorage.setItem('sessoes', JSON.stringify(a)); }

export async function pushSession(sess){
  if(!enableFirebase || !user) return;
  await boot();
  const ref = mod.F.doc(db, 'users', user.uid, 'sessoes', sess.data);
  await mod.F.setDoc(ref, sess, { merge:true });
}
export async function pushHabits(date, habits){
  if(!enableFirebase || !user) return;
  await boot();
  const ref = mod.F.doc(db, 'users', user.uid, 'habitos', date);
  await mod.F.setDoc(ref, habits, { merge:true });
}
export async function uploadPhoto(fileBlob, ym){
  if(!enableFirebase || !user) return null;
  await boot();
  const id = Date.now().toString(36);
  const path = `users/${user.uid}/fotos/${ym}/${id}.jpg`;
  const r = mod.S.ref(storage, path);
  await mod.S.uploadBytes(r, fileBlob);
  const url = await mod.S.getDownloadURL(r);
  const metaRef = mod.F.doc(db, 'users', user.uid, 'fotos', id);
  await mod.F.setDoc(metaRef, { url, ym, createdAt: Date.now() }, { merge:true });
  return url;
}

export async function pullAndMerge(){
  if(!enableFirebase || !user) return;
  await boot();
  const q = mod.F.collection(db, 'users', user.uid, 'sessoes');
  const snap = await mod.F.getDocs(q);
  const cloud=[]; snap.forEach(d=> cloud.push(d.data()));
  const local=getLocal();
  const byDate = new Map();
  const setsLen = x=> (x.exercicios||[]).reduce((acc,e)=>acc+(e.sets?.length||0),0);
  [...local, ...cloud].forEach(s=>{
    const old=byDate.get(s.data);
    if(!old) byDate.set(s.data,s);
    else byDate.set(s.data, setsLen(old)>=setsLen(s)?old:s);
  });
  setLocal([...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data)));
}
