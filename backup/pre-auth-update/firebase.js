/*
  Módulo de integração opcional com Firebase.

  Este arquivo isola toda a lógica de autenticação e sincronização com o
  Firestore. O restante do aplicativo funciona normalmente sem
  dependências do Firebase, bastando definir `enableFirebase` como
  `false`. Quando ativado e o usuário faz login, as sessões e hábitos
  locais são mesclados com a nuvem, preservando sempre a versão com
  mais sets preenchidos. Habits são gravados em `users/{uid}/habitos/{data}`
  e sessões em `users/{uid}/sessoes/{data}`.
*/

export const enableFirebase = true;

// Configuração do projeto Firebase. Caso deseje utilizar outro
// projeto, altere os valores abaixo. Estes dados são públicos e
// correspondem ao ambiente de demonstração.
const FIREBASE_CFG = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.appspot.com",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

export let firebaseOk = false;
export const fb = { app:null, auth:null, provider:null, db:null, user:null, _:{} };

/**
 * Inicializa o Firebase de forma assíncrona. Se a flag
 * `enableFirebase` estiver desligada ou ocorrer algum erro, a
 * aplicação continua funcionando em modo local.
 */
export async function initFirebase(onAuthChange){
  if(!enableFirebase){
    firebaseOk = false;
    return;
  }
  try{
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }, { getFirestore, doc, setDoc, getDoc, collection, getDocs }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js')
    ]);
    fb.app = initializeApp(FIREBASE_CFG);
    fb.auth = getAuth(fb.app);
    fb.provider = new GoogleAuthProvider();
    fb.db = getFirestore(fb.app);
    fb._ = { doc, setDoc, getDoc, collection, getDocs, onAuthStateChanged, signInWithPopup, signOut };
    firebaseOk = true;

    // Monitorar mudança de usuário
    fb._.onAuthStateChanged(fb.auth, async (user)=>{
      fb.user = user || null;
      if(typeof onAuthChange === 'function'){
        await onAuthChange(user);
      }
    });
  }catch(e){
    console.warn('Firebase indisponível', e);
    firebaseOk = false;
  }
}

/** Efetua login com popup Google. */
export async function loginWithGoogle(){
  if(!firebaseOk) return;
  try{ await fb._.signInWithPopup(fb.auth, fb.provider); }catch(e){ console.error('Falha no login', e); throw e; }
}

/** Efetua logout. */
export async function logout(){
  if(!firebaseOk) return;
  try{ await fb._.signOut(fb.auth); }catch(_){ }
}

/**
 * Sincroniza as sessões locais com as do Firestore. Aceita funções
 * getLocal() e setLocal(arr) fornecidas pelo app para ler e gravar
 * localmente. A fusão preserva a versão com maior número de sets
 * preenchidos para uma mesma data.
 */
export async function pullAllSessionsAndMerge(getLocal, setLocal){
  if(!firebaseOk || !fb.user) return;
  const { collection, getDocs } = fb._;
  const ref = collection(fb.db, 'users', fb.user.uid, 'sessoes');
  const snap = await getDocs(ref);
  const cloud = [];
  snap.forEach(d => cloud.push(d.data()));
  const local = getLocal();
  const byDate = new Map();
  [...local, ...cloud].forEach(s=>{
    const old = byDate.get(s.data);
    if(!old) byDate.set(s.data, s);
    else{
      const pick = (old.exercicios?.length||0) >= (s.exercicios?.length||0) ? old : s;
      byDate.set(s.data, pick);
    }
  });
  const merged = [...byDate.values()].sort((a,b)=> a.data.localeCompare(b.data));
  setLocal(merged);
}

/**
 * Envia uma sessão específica para o Firestore. O documento é
 * mesclado (merge:true) para permitir múltiplos campos. Ignora se
 * usuário não estiver logado.
 */
export async function pushSession(sessao){
  if(!firebaseOk || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
}

/**
 * Define (ou atualiza) um hábito para uma determinada data. Cada
 * hábito é salvo como campo booleano em um documento por dia.
 */
export async function setHabit(dateStr, key, val){
  if(!firebaseOk || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'habitos', dateStr);
  await setDoc(ref, { [key]: val }, { merge:true });
}