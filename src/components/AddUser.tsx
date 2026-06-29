import { useState } from "react";
import { UserPlus, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { registerUserInSystem } from "../../services/UserService";
import { useToast } from "./ui/Toast";

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo electrónico.";
    case "auth/invalid-email":
      return "El correo electrónico no tiene un formato válido.";
    case "auth/weak-password":
      return "La contraseña es demasiado débil (mínimo 6 caracteres).";
    default:
      return error instanceof Error ? error.message : "No se pudo crear el usuario";
  }
}

export default function AddUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailTrim = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      addToast({ type: "error", title: "Correo no válido", message: "Introduce un correo electrónico con formato válido." });
      return;
    }
    if (password.length < 6) {
      addToast({ type: "error", title: "Contraseña demasiado corta", message: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    setLoading(true);
    try {
      await registerUserInSystem(emailTrim, password);
      addToast({ type: "success", title: "Usuario registrado correctamente" });
      setEmail("");
      setPassword("");
    } catch (error: unknown) {
      addToast({ type: "error", title: "Error", message: friendlyAuthError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-6">

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-lg">
            <UserPlus className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Añadir Operario</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Registra un nuevo acceso para la flota</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@triniglass.com"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-lg py-2 pl-9 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-2 mt-2 rounded-lg text-sm font-medium text-white transition-colors ${
              loading
                ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Registrar nuevo usuario"
            )}
          </button>
        </form>

        <div className="mt-5 p-3 bg-brand-50 dark:bg-brand-500/5 border border-brand-200/80 dark:border-brand-500/15 rounded-lg">
          <p className="text-xs text-brand-700 dark:text-brand-300 text-center">
            El usuario será creado con el rol de <strong className="font-semibold">Operario</strong> por defecto. Podrás editar los permisos más tarde desde Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}
