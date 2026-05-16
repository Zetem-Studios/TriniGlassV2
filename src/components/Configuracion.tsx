import { ShieldCheck, Map, ChevronRight, Settings, Layers } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZoneManager } from "./ZoneManager";

const opciones = [
  {
    icon: ShieldCheck,
    iconBg: "bg-amber-600/20",
    iconColor: "text-amber-500",
    titulo: "Gestión de usuarios",
    descripcion: "Consulta todos los usuarios y cambia sus roles entre operario, encargado y admin.",
    destino: "/configuracion/usuarios",
    externo: false,
  },
  {
    icon: Layers,
    iconBg: "bg-purple-600/20",
    iconColor: "text-purple-400",
    titulo: "Gestión de zonas y subzonas",
    descripcion: "Crea y administra las zonas y subzonas del almacén.",
    destino: "zone-manager",
    externo: false,
  },
  {
    icon: Map,
    iconBg: "bg-blue-600/20",
    iconColor: "text-blue-400",
    titulo: "Editor de mapas",
    descripcion: "Crea y edita diseños de almacenamiento personalizados con el editor visual.",
    destino: "/canvas-test",
    externo: false,
  },
];

export default function Configuracion() {
  const navigate = useNavigate();
  const [showZoneManager, setShowZoneManager] = useState(false);

  if (showZoneManager) {
    return <ZoneManager onClose={() => setShowZoneManager(false)} />;
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-slate-700/40 p-3 rounded-xl">
          <Settings className="w-6 h-6 text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configuración</h2>
          <p className="text-slate-400 text-sm">Herramientas de administración</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {opciones.map(op => (
          <button
            key={op.destino}
            onClick={() => {
              if (op.destino === "zone-manager") {
                setShowZoneManager(true);
                return;
              }
              navigate(op.destino);
            }}
            className="w-full flex items-center gap-5 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-slate-600 hover:bg-slate-800/50 transition-all text-left group"
          >
            <div className={`${op.iconBg} p-4 rounded-xl shrink-0`}>
              <op.icon className={`w-7 h-7 ${op.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base">{op.titulo}</p>
              <p className="text-slate-400 text-sm mt-1">{op.descripcion}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
