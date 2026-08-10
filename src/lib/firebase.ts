import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/** Like Swart: each item is its own Firestore document */
export async function fsSet(col: string, id: string, data: DocumentData): Promise<boolean> {
  try {
    await withTimeout(setDoc(doc(dbFirestore, col, id), data, { merge: true }), 10000, `set ${col}`);
    return true;
  } catch (e) {
    console.error(`Firestore set ${col}/${id} failed`, e);
    return false;
  }
}

export async function fsDelete(col: string, id: string): Promise<boolean> {
  try {
    await withTimeout(deleteDoc(doc(dbFirestore, col, id)), 8000, `del ${col}`);
    return true;
  } catch (e) {
    console.error(`Firestore delete ${col}/${id} failed`, e);
    return false;
  }
}

export async function fsGetAll<T extends { id: string }>(col: string): Promise<T[]> {
  try {
    const snap = await withTimeout(getDocs(collection(dbFirestore, col)), 12000, `getAll ${col}`);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  } catch (e) {
    console.error(`Firestore getAll ${col} failed`, e);
    return [];
  }
}

export async function fsGet<T>(col: string, id: string): Promise<T | null> {
  try {
    const snap = await withTimeout(getDoc(doc(dbFirestore, col, id)), 8000, `get ${col}`);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (e) {
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
    createdAt: serverTimestamp(),
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
    updatedAt: serverTimestamp(),
  });
}

export async function loadUserDataFromCloud(_uid: string): Promise<unknown | null> {
  const d = await fsGet<{ payload?: unknown }>('business', 'ps-billdesk');
  return d?.payload ?? null;
}
