import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AuthContext } from "./AuthContext";
import type { Rol } from "../../services/UserService";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setRol(null);
        setLoading(false);
        return;
      }

      // Escuchar el documento del usuario en tiempo real
      const userRef = doc(db, "usuarios", firebaseUser.uid);
      const unsubscribeDoc = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setRol((snap.data().rol as Rol) ?? null);
        } else {
          setRol(null);
        }
        setLoading(false);
      });

      // Limpiar el listener de Firestore cuando cambie el usuario de Auth
      return unsubscribeDoc;
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, rol, loading }}>
      {children}
    </AuthContext.Provider>
  );
};