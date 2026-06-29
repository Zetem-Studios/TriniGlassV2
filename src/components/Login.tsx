import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Box, Eye, EyeOff, Loader2 } from 'lucide-react';
import { loginUser } from "../../services/UserService";
import { useToast } from "./ui/Toast";

// Traduce los códigos de error de Firebase Auth a mensajes claros en español.
function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/invalid-email":
      return "El correo electrónico no tiene un formato válido.";
    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada. Contacta con el administrador.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "Sin conexión. Comprueba tu red e inténtalo de nuevo.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginUser(email, password, remember);
      void navigate("/");
    } catch (error: unknown) {
      console.error("Error en login:", error);
      addToast({ type: "error", title: "Error al iniciar sesión", message: friendlyAuthError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm w-full max-w-sm border border-slate-200/80 dark:border-slate-800/80">

        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2 rounded-lg">
              <Box className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">TriniGlass</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Almacén & Flota</p>
          <h2 className="text-base font-medium text-slate-700 dark:text-slate-300 mt-6">Acceso al sistema</h2>
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              </div>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.usuario@triniglass.com"
                className="w-full h-10 pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-slate-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full h-10 pl-9 pr-10 py-2 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="remember_me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400">
                Recordar sesión
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-10 mt-2 flex items-center justify-center gap-2 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
              loading
              ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed"
              : "bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 focus:ring-slate-900 dark:focus:ring-white"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
