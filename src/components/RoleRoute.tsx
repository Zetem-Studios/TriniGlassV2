import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { Rol } from "../../services/UserService";

type RoleRouteProps = {
  children: ReactNode;
  requiredRol: Rol;
};

export const RoleRoute = ({ children, requiredRol }: RoleRouteProps) => {
  const { rol, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-700 dark:text-slate-300">
        Cargando...
      </div>
    );
  }

  if (rol !== requiredRol) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};