import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

export type Rol = 'operario' | 'encargado' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  rol: Rol;
  creadoEn: Timestamp;
  nombreCompleto?: string;
}

const USERS_COLLECTION = 'usuarios';

export async function registerUserInSystem(email: string, password: string): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await updateProfile(user, { displayName: email.split('@')[0] });

  const userProfile: Omit<UserProfile, 'uid'> = {
    email: user.email!,
    rol: 'operario',
    creadoEn: Timestamp.now(),
    nombreCompleto: user.displayName ?? undefined,
  };

  await addDoc(collection(db, USERS_COLLECTION), {
    ...userProfile,
    uid: user.uid,
  });

  return { uid: user.uid, ...userProfile };
}

export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  })) as UserProfile[];
}

export async function setUserRole(uid: string, nuevoRol: Rol): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userRef, { rol: nuevoRol });
}

export async function deleteUser(uid: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await deleteDoc(userRef);
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { uid: doc.id, ...doc.data() } as UserProfile;
}

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}