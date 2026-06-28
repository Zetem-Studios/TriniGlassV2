import { createContext } from "react";
import type { User } from "firebase/auth";
import type { Rol } from "../../services/UserService";

export interface AuthContextType {
  user: User | null;
  rol: Rol | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  rol: null,
  loading: true,
});