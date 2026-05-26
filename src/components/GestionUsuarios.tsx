import { useEffect, useState } from "react";
import { Users, ShieldCheck, Loader2, ChevronLeft, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listUsers, setUserRole, deleteUser } from "../../services/UserService";
import type { UserProfile, Rol } from "../../services/UserService";
import { useAuth } from "../context/useAuth";

const ROL_LABELS: Record<Rol, string> = {
  operario: "Operario",
  encargado: "Encargado",
  admin: "Admin",
};

const ROL_BADGE: Record<Rol, string> = {
  operario: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  encargado: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400",
  admin: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
};

export default function GestionUsuarios() {
  const { user, rol: rolActual } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [changingUid, setChangingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = rolActual === "admin";

  useEffect(() => {
    listUsers()
      .then(setUsuarios)
      .catch(() => setError("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoadingList(false));
  }, []);

  const handleDeleteUser = async (uid: string) => {
    const usuario = usuarios.find(u => u.uid === uid);
    if (!usuario) return;

    const confirmar = window.confirm(
      `¿Eliminar al usuario "${usuario.email}"? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setDeletingUid(uid);
    setError(null);
    try {
      await deleteUser(uid);
      setUsuarios(prev => prev.filter(u => u.uid !== uid));
    } catch {
      setError(`No se pudo eliminar a ${usuario.email}.`);
    } finally {
      setDeletingUid(null);
    }
  };

  const handleRolChange = async (uid: string, nuevoRol: Rol) => {
    const usuario = usuarios.find(u => u.uid === uid);
    if (!usuario || usuario.rol === nuevoRol) return;

    const confirmar = window.confirm(
      `¿Cambiar el rol de "${usuario.email}" de ${ROL_LABELS[usuario.rol]} a ${ROL_LABELS[nuevoRol]}?`
    );
    if (!confirmar) return;

    setChangingUid(uid);
    setError(null);
    try {
      await setUserRole(uid, nuevoRol);
      setUsuarios(prev =>
        prev.map(u => (u.uid === uid ? { ...u, rol: nuevoRol } : u))
      );
    } catch {
      setError(`No se pudo cambiar el rol de ${usuario.email}.`);
    } finally {
      setChangingUid(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/configuracion")}
            aria-label="Volver a configuración"
            className="p-1.5 -ml-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Gestión de usuarios</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Administra los roles del equipo</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200/80 dark:border-red-500/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loadingList ? (
          <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando usuarios...</span>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80">
                  <th className="px-6 pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Email
                    </div>
                  </th>
                  <th className="px-4 pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Rol actual</th>
                  <th className="px-4 pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Cambiar rol</th>
                  <th className="px-4 pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Alta</th>
                  {esAdmin && <th className="px-6 pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {usuarios.map(u => {
                  const esMismoUsuario = u.uid === user?.uid;
                  const cambiando = changingUid === u.uid;
                  const eliminando = deletingUid === u.uid;

                  return (
                    <tr key={u.uid}>
                      <td className="py-3 px-6 font-medium text-slate-900 dark:text-white max-w-[220px] truncate">
                        {u.email}
                        {esMismoUsuario && (
                          <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">(tú)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${ROL_BADGE[u.rol]}`}>
                          {ROL_LABELS[u.rol]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {esMismoUsuario ? (
                          <span className="text-xs text-slate-400 dark:text-slate-600 italic">No puedes cambiar tu propio rol</span>
                        ) : (
                          <div className="relative">
                            {cambiando && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
                            )}
                            <select
                              value={u.rol}
                              disabled={cambiando}
                              onChange={e => handleRolChange(u.uid, e.target.value as Rol)}
                              className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-sm rounded-md px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="operario">Operario</option>
                              <option value="encargado">Encargado</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs tabular-nums">
                        {u.creadoEn
                          ? u.creadoEn.toLocaleDateString("es-ES")
                          : "—"}
                      </td>
                      {esAdmin && (
                        <td className="py-3 px-6">
                          {esMismoUsuario ? (
                            <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteUser(u.uid)}
                              disabled={eliminando || cambiando}
                              title="Eliminar usuario"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {eliminando ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Eliminar</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
