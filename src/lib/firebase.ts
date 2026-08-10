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

/** Shared shop document — ALL staff see the same inventory & invoices */
const BUSINESS_DOC = doc(dbFirestore, 'business', 'ps-billdesk');

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

/**
 * Save full shop data (products, customers, invoices…).
 * Shared for every staff login — not per-email, not per-device.
 */
export async function saveUserDataToCloud(_uid: string, data: unknown): Promise<boolean> {
  try {
    await withTimeout(
      setDoc(
        BUSINESS_DOC,
        {
          payload: data,
          updatedAt: serverTimestamp(),
          updatedBy: _uid || null,
        },
        { merge: true },
      ),
      8000,
      'saveBusinessData',
    );
    return true;
  } catch (e) {
    console.error('Firebase saveBusinessData failed', e);
    return false;
  }
}

/** Load shared shop data (same for owner + all staff) */
export async function loadUserDataFromCloud(_uid: string): Promise<unknown | null> {
  try {
    const snap = await withTimeout(getDoc(BUSINESS_DOC), 8000, 'loadBusinessData');
    if (snap.exists()) {
      const d = snap.data();
      if (d?.payload) return d.payload;
    }

    // One-time migration: if old per-user data exists, use it and copy to shared
    if (_uid) {
      try {
        const oldSnap = await getDoc(doc(dbFirestore, 'users', _uid, 'data', 'main'));
        if (oldSnap.exists()) {
          const old = oldSnap.data()?.payload;
          if (old) {
            await setDoc(
              BUSINESS_DOC,
              { payload: old, updatedAt: serverTimestamp(), migratedFrom: _uid },
              { merge: true },
            );
            return old;
          }
        }
      } catch {
        /* ignore migration errors */
      }
    }
    return null;
  } catch (e) {
    console.error('Firebase loadBusinessData failed', e);
    return null;
  }
}

/** Short link for customers (public read) */
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
      8000,
      'saveShare',
    );
    return true;
  } catch (e) {
    console.error('Firebase saveShare failed', e);
    return false;
  }
}

export async function getShareFromFirebase(
  shortId: string,
): Promise<{ token: string; invoiceId: string } | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(dbFirestore, 'shares', shortId)),
      6000,
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
