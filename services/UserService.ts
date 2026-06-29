import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { doc, setDoc, serverTimestamp, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { firebaseConfig } from "../src/firebase";

export type Rol = "operario" | "encargado" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date | null;
}

// Registrar nuevo usuario y crear su perfil en Firestore.
// Se usa una app de Firebase secundaria para crear la cuenta sin reemplazar
// la sesión del administrador que está dando de alta al usuario.
export const registerUserInSystem = async (email: string, pass: string) => {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), pass);
    const uid = userCred.user.uid;

    await setDoc(doc(db, "usuarios", uid), {
      email: email.toLowerCase().trim(),
      rol: "operario",
      activo: true,
      creadoEn: serverTimestamp(),
      uid: uid
    });

    return { success: true, uid };
  } finally {
    // Cerrar sesión en la app secundaria y eliminarla para liberar recursos
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
};

// Obtener todos los usuarios
export const listUsers = async (): Promise<UserProfile[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email ?? "",
      rol: data.rol as Rol,
      activo: data.activo ?? true,
      creadoEn: data.creadoEn?.toDate?.() ?? null,
    };
  });
};

// Cambiar el rol de un usuario
export const setUserRole = async (uid: string, rol: Rol): Promise<void> => {
  await updateDoc(doc(db, "usuarios", uid), { rol });
};

// Eliminar el perfil de un usuario en Firestore.
// Nota: la cuenta en Firebase Auth permanece — borrarla requiere Admin SDK (Cloud Function).
export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, "usuarios", uid));
};

// Iniciar sesión. `remember` controla si la sesión persiste tras cerrar el navegador.
export const loginUser = async (email: string, pass: string, remember = true) => {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const userCred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCred.user;
};

// Cerrar sesión
export const logoutUser = async () => {
  await signOut(auth);
};