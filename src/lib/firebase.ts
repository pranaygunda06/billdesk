import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  type DocumentData,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyABd7rGGzcCmm3kEYD_ywWLssB_VrZmKDA',
  authDomain: 'ps-billdesk.firebaseapp.com',
  projectId: 'ps-billdesk',
  storageBucket: 'ps-billdesk.firebasestorage.app',
  messagingSenderId: '206137573785',
  appId: '1:206137573785:web:f197adcc7f8448fcd99308',
};

const app = initializeApp(firebaseConfig);
export const dbFirestore = getFirestore(app);
export const auth = getAuth(app);

function clean(data: DocumentData): DocumentData {
  return JSON.parse(JSON.stringify(data));
}

export async function adminLogin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function adminLogout() {
  await signOut(auth);
}

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

let _lastError = '';
export function getLastFirebaseError() {
  return _lastError;
}

export async function fsSet(col: string, id: string, data: DocumentData): Promise<boolean> {
  try {
    _lastError = '';
    await setDoc(doc(dbFirestore, col, id), clean(data), { merge: true });
    return true;
  } catch (e: any) {
    _lastError = e?.code || e?.message || String(e);
    console.error(`Firestore set ${col}/${id} failed`, e);
    return false;
  }
}

export async function fsDelete(col: string, id: string): Promise<boolean> {
  try {
    _lastError = '';
    await deleteDoc(doc(dbFirestore, col, id));
    return true;
  } catch (e: any) {
    _lastError = e?.code || e?.message || String(e);
    console.error(`Firestore delete ${col}/${id} failed`, e);
    return false;
  }
}

export async function fsGetAll<T extends { id: string }>(col: string): Promise<T[]> {
  try {
    _lastError = '';
    const snap = await getDocs(collection(dbFirestore, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  } catch (e: any) {
    _lastError = e?.code || e?.message || String(e);
    console.error(`Firestore getAll ${col} failed`, e);
    return [];
  }
}

export async function fsGet<T>(col: string, id: string): Promise<T | null> {
  try {
    _lastError = '';
    const snap = await getDoc(doc(dbFirestore, col, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (e: any) {
    _lastError = e?.code || e?.message || String(e);
    console.error(`Firestore get ${col}/${id} failed`, e);
    return null;
  }
}

export async function saveShareToFirebase(
  shortId: string,
  data: { invoiceId: string; token: string },
): Promise<boolean> {
  return fsSet('shares', shortId, {
    invoiceId: data.invoiceId,
    token: data.token,
    createdAt: new Date().toISOString(),
  });
}

export async function getShareFromFirebase(
  shortId: string,
): Promise<{ token: string; invoiceId: string } | null> {
  const d = await fsGet<{ token?: string; invoiceId?: string }>('shares', shortId);
  if (!d?.token) return null;
  return { token: d.token, invoiceId: d.invoiceId || '' };
}

export async function saveUserDataToCloud(_uid: string, data: unknown): Promise<boolean> {
  return fsSet('business', 'ps-billdesk', {
    payload: data,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadUserDataFromCloud(_uid: string): Promise<unknown | null> {
  const d = await fsGet<{ payload?: unknown }>('business', 'ps-billdesk');
  return d?.payload ?? null;
}
