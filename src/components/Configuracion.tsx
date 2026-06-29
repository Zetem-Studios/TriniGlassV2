import { ShieldCheck, Map, ChevronRight, Settings, Layers, FileText } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZoneManager } from "./ZoneManager";

const opciones = [
  {
    icon: ShieldCheck,
    iconBg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    titulo: "Gestión de usuarios",
    descripcion: "Consulta todos los usuarios y cambia sus roles entre operario, encargado y admin.",
    destino: "/configuracion/usuarios",
    externo: false,
  },
  {
    icon: Layers,
    iconBg: "bg-purple-50 dark:bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    titulo: "Gestión de zonas y subzonas",
    descripcion: "Crea y administra las zonas y subzonas del almacén.",
    destino: "zone-manager",
    externo: false,
  },
  {
    icon: Map,
    iconBg: "bg-brand-50 dark:bg-brand-500/10",
    iconColor: "text-brand-600 dark:text-brand-400",
    titulo: "Editor de mapas",
    descripcion: "Crea y edita diseños de almacenamiento personalizados con el editor visual.",
    destino: "/canvas-test",
    externo: false,
  },
  {
    icon: FileText,
    iconBg: "bg-green-50 dark:bg-green-500/10",
    iconColor: "text-green-600 dark:text-green-400",
    titulo: "Presupuesto comercial",
    descripcion: "Consulta y descarga el presupuesto del producto con planes, precios y mejoras.",
    destino: "/presupuesto",
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
    <div className="max-w-2xl mx-auto mt-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg">
          <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Configuración</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Herramientas de administración</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all duration-150 text-left group"
          >
            <div className={`${op.iconBg} p-2.5 rounded-lg shrink-0`}>
              <op.icon className={`w-5 h-5 ${op.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white font-medium text-sm">{op.titulo}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{op.descripcion}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
