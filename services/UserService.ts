import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../src/firebase";

export type Rol = "operario" | "encargado" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date | null;
};

// Registrar nuevo usuario y crear su perfil en Firestore
export const registerUserInSystem = async (email: string, pass: string) => {
  const userCred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const uid = userCred.user.uid;

  await setDoc(doc(db, "usuarios", uid), {
    email: email.toLowerCase().trim(),
    rol: "operario",
    activo: true,
    creadoEn: serverTimestamp(),
    uid: uid
  });

  return { success: true, uid };
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

// Iniciar sesión
export const loginUser = async (email: string, pass: string) => {
  const userCred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCred.user;
};

// Cerrar sesión
export const logoutUser = async () => {
  await signOut(auth);
};