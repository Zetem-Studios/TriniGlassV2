import { useState } from "react";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react"; // Iconos para que se vea pro
import { registerUserInSystem } from "../../services/userService"; // Corregido a un solo nivel

export default function AddUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUserInSystem(email, password);
      alert(" Usuario registrado correctamente en el sistema");
      setEmail(""); 
      setPassword("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo crear el usuario";
      alert("❌ Error: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
        
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-blue-600/20 p-3 rounded-xl">
            <UserPlus className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Añadir Operario</h2>
            <p className="text-slate-400 text-sm">Registra un nuevo acceso para la flota</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="ejemplo@triniglass.com" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" 
                required 
              />
            </div>
          </div>

          {/* Campo Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Mínimo 6 caracteres" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" 
                required 
              />
            </div>
          </div>

          {/* Botón de acción */}
          <button 
            disabled={loading} 
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all shadow-lg shadow-blue-900/20 ${
              loading 
                ? "bg-slate-800 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando en base de datos...
              </>
            ) : (
              "Registrar nuevo usuario"
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-400 text-center">
            El usuario será creado con el rol de <strong>Operario</strong> por defecto. Podrás editar los permisos más tarde desde Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}