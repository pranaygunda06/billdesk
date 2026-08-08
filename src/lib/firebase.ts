import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
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

/** Email/password admin login */
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

/** Save full app data for this admin user (multi-device sync) */
export async function saveUserDataToCloud(uid: string, data: unknown): Promise<boolean> {
  try {
    await withTimeout(
      setDoc(
        doc(dbFirestore, 'users', uid, 'data', 'main'),
        {
          payload: data,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      15000,
      'saveUserData',
    );
    return true;
  } catch (e) {
    console.error('Firebase saveUserData failed', e);
    return false;
  }
}

/** Load full app data for this admin user */
export async function loadUserDataFromCloud(uid: string): Promise<unknown | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(dbFirestore, 'users', uid, 'data', 'main')),
      15000,
      'loadUserData',
    );
    if (!snap.exists()) return null;
    const d = snap.data();
    return d.payload ?? null;
  } catch (e) {
    console.error('Firebase loadUserData failed', e);
    return null;
  }
}

/**
 * Save a short-link so ANY phone can open the invoice (no login).
 * Token is the full encoded invoice payload.
 */
export async function saveShareToFirebase(
  shortId: string,
  data: { invoiceId: string; token: string },
): Promise<boolean> {
  try {
    await withTimeout(
      setDoc(doc(dbFirestore, 'shares', shortId), {
        invoiceId: data.invoiceId,
        token: data.token,
        createdAt: serverTimestamp(),
        accessedAt: null,
      }),
      15000,
      'saveShare',
    );
    return true;
  } catch (e) {
    console.error('Firebase saveShare failed', e);
    return false;
  }
}

/** Load short-link payload (public — customer device) */
export async function getShareFromFirebase(
  shortId: string,
): Promise<{ token: string; invoiceId: string } | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(dbFirestore, 'shares', shortId)),
      12000,
      'getShare',
    );
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d?.token) return null;
    return { token: d.token as string, invoiceId: (d.invoiceId as string) || '' };
  } catch (e) {
    console.error('Firebase getShare failed', e);
    return null;
  }
}
