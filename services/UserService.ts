import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../src/firebase";

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

// Iniciar sesión
export const loginUser = async (email: string, pass: string) => {
  const userCred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCred.user;
};

// Cerrar sesión
export const logoutUser = async () => {
  await signOut(auth);
};