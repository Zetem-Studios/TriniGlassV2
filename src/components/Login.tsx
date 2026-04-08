import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Box } from 'lucide-react';
import { loginUser } from "../../services/userService";

const Login = () => {
  // 1. Estados para capturar los datos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 2. Función que maneja el envío del formulario
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginUser(email, password);
      navigate("/"); // Si todo va bien, vamos al panel principal
    } catch (error: any) {
      console.error("Error en login:", error);
      alert(`Error al iniciar sesión: ${error.code || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-slate-900 text-white p-2.5 rounded-xl">
              <Box className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-slate-900 leading-none">TriniGlass</h1>
              <p className="text-xs font-semibold text-slate-500 tracking-wider mt-1 uppercase">Almacén & Flota</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mt-6">Acceso al sistema</h2>
        </div>

        {/* 3. Conectamos el handleSubmit al form */}
        <form className="space-y-5" onSubmit={handleLogin}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 block">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
              </div>
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.usuario@triniglass.com"
                className="w-full h-11 pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 block">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
              </div>
              <input
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full h-11 pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                className="h-4 w-4 bg-white border-slate-300 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember_me" className="ml-2 block text-sm text-slate-700">
                Recordar sesión
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-12 mt-2 text-white rounded-lg font-semibold shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              loading 
              ? "bg-slate-400 cursor-not-allowed" 
              : "bg-slate-900 hover:bg-slate-800 focus:ring-slate-900"
            }`}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;