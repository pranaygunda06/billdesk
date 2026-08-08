import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyABd7rGGzcCmm3kEYD_ywWLssB_VrZmKDA",
  authDomain: "ps-billdesk.firebaseapp.com",
  projectId: "ps-billdesk",
  storageBucket: "ps-billdesk.firebasestorage.app",
  messagingSenderId: "206137573785",
  appId: "1:206137573785:web:f197adcc7f8448fcd99308",
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

/** Save a short-link payload so any device can open it */
export async function saveShareToFirebase(shortId: string, data: {
  invoiceId: string;
  token: string;
}) {
  try {
    await setDoc(doc(dbFirestore, 'shares', shortId), {
      ...data,
      createdAt: serverTimestamp(),
      accessedAt: null,
    });
    return true;
  } catch (e) {
    console.error('Firebase saveShare failed', e);
    return false;
  }
}

/** Load short-link payload from Firebase (works on any device) */
export async function getShareFromFirebase(shortId: string): Promise<{ token: string; invoiceId: string } | null> {
  try {
    const snap = await getDoc(doc(dbFirestore, 'shares', shortId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { token: d.token as string, invoiceId: d.invoiceId as string };
  } catch (e) {
    console.error('Firebase getShare failed', e);
    return null;
  }
}
