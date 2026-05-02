import { useEffect, useState } from "react";
import { Users, ShieldCheck, Loader2 } from "lucide-react";
import { listUsers, setUserRole } from "../../services/UserService";
import type { UserProfile, Rol } from "../../services/UserService";
import { useAuth } from "../context/useAuth";

const ROL_LABELS: Record<Rol, string> = {
  operario: "Operario",
  encargado: "Encargado",
  admin: "Admin",
};

const ROL_BADGE: Record<Rol, string> = {
  operario: "bg-slate-700/50 text-slate-300",
  encargado: "bg-blue-900/40 text-blue-300",
  admin: "bg-amber-900/40 text-amber-300",
};

export default function Configuracion() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [changingUid, setChangingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsuarios)
      .catch(() => setError("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoadingList(false));
  }, []);

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
    <div className="max-w-4xl mx-auto mt-8 p-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">

        <div className="flex items-center gap-4 mb-8">
          <div className="bg-amber-600/20 p-3 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Gestión de usuarios</h2>
            <p className="text-slate-400 text-sm">Administra los roles del equipo</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800/40 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {loadingList ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando usuarios...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="pb-3 font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Email
                  </th>
                  <th className="pb-3 font-medium px-4">Rol actual</th>
                  <th className="pb-3 font-medium px-4">Cambiar rol</th>
                  <th className="pb-3 font-medium px-4">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {usuarios.map(u => {
                  const esMismoUsuario = u.uid === user?.uid;
                  const cambiando = changingUid === u.uid;

                  return (
                    <tr key={u.uid} className="text-slate-300">
                      <td className="py-4 pr-4 font-medium text-white max-w-[220px] truncate">
                        {u.email}
                        {esMismoUsuario && (
                          <span className="ml-2 text-xs text-slate-500">(tú)</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROL_BADGE[u.rol]}`}>
                          {ROL_LABELS[u.rol]}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {esMismoUsuario ? (
                          <span className="text-xs text-slate-600 italic">No puedes cambiar tu propio rol</span>
                        ) : (
                          <div className="relative">
                            {cambiando && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                            )}
                            <select
                              value={u.rol}
                              disabled={cambiando}
                              onChange={e => handleRolChange(u.uid, e.target.value as Rol)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="operario">Operario</option>
                              <option value="encargado">Encargado</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-xs">
                        {u.creadoEn
                          ? u.creadoEn.toLocaleDateString("es-ES")
                          : "—"}
                      </td>
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
