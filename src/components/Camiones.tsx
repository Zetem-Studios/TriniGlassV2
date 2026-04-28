import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  Loader2,
  Weight,
  Box,
  User,
  AlertCircle,
} from "lucide-react";
import type { Camion, EstadoCamion } from "../../services/CamionService";
import { ESTADOS_CAMION, getCamiones } from "../../services/CamionService";
import CamionPanel from "./CamionPanel";

const ESTADO_STYLES: Record<EstadoCamion, string> = {
  disponible:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  en_ruta:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  mantenimiento:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  fuera_de_servicio:
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900/50",
};

const labelEstado = (estado: EstadoCamion) =>
  ESTADOS_CAMION.find((e) => e.value === estado)?.label ?? estado;

export default function Camiones() {
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoCamion | "todos">(
    "todos"
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Camion | null>(null);

  const loadCamiones = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const data = await getCamiones();
      setCamiones(data);
    } catch (e: unknown) {
      console.error("Error cargando camiones:", e);
      setLoadError(
        e instanceof Error ? e.message : "No se pudo cargar la flota"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCamiones();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return camiones.filter((c) => {
      if (estadoFilter !== "todos" && c.estado !== estadoFilter) return false;
      if (!term) return true;
      return (
        c.matricula.toLowerCase().includes(term) ||
        c.conductor.toLowerCase().includes(term) ||
        c.tipo.toLowerCase().includes(term)
      );
    });
  }, [camiones, searchTerm, estadoFilter]);

  const counts = useMemo(() => {
    const base: Record<EstadoCamion, number> = {
      disponible: 0,
      en_ruta: 0,
      mantenimiento: 0,
      fuera_de_servicio: 0,
    };
    camiones.forEach((c) => {
      base[c.estado] = (base[c.estado] ?? 0) + 1;
    });
    return base;
  }, [camiones]);

  const openCreate = () => {
    setSelected(null);
    setPanelMode("create");
    setPanelOpen(true);
  };

  const openEdit = (camion: Camion) => {
    setSelected(camion);
    setPanelMode("edit");
    setPanelOpen(true);
  };

  const handleSaved = (camion: Camion) => {
    setCamiones((prev) => {
      const idx = prev.findIndex((c) => c.matricula === camion.matricula);
      if (idx === -1) return [...prev, camion].sort((a, b) =>
        a.matricula.localeCompare(b.matricula)
      );
      const next = [...prev];
      next[idx] = camion;
      return next;
    });
    setPanelOpen(false);
  };

  const handleDeleted = (matricula: string) => {
    setCamiones((prev) => prev.filter((c) => c.matricula !== matricula));
    setPanelOpen(false);
  };

  return (
    <div className="min-h-full text-slate-900 dark:text-white font-sans">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">
                Flota de Camiones
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {camiones.length} vehículos registrados
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all uppercase tracking-wider"
          >
            <Plus size={18} /> Nuevo camión
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ESTADOS_CAMION.map((e) => (
            <button
              key={e.value}
              onClick={() =>
                setEstadoFilter((prev) => (prev === e.value ? "todos" : e.value))
              }
              className={`p-4 rounded-2xl border text-left transition-all ${
                estadoFilter === e.value
                  ? ESTADO_STYLES[e.value]
                  : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                {e.label}
              </p>
              <p className="text-2xl font-black mt-1">{counts[e.value]}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por matrícula, conductor o tipo..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-14 pr-6 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          {estadoFilter !== "todos" && (
            <button
              onClick={() => setEstadoFilter("todos")}
              className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Quitar filtro
            </button>
          )}
        </div>

        {loadError && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl">
            <AlertCircle size={20} className="text-red-500" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {loadError}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="animate-spin mr-3" size={24} />
            <span className="font-semibold">Cargando flota...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Truck size={32} className="text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-600 dark:text-slate-300">
              {camiones.length === 0
                ? "Aún no hay camiones registrados"
                : "No hay camiones que coincidan con el filtro"}
            </p>
            {camiones.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-4 text-sm font-black text-blue-600 hover:text-blue-500 uppercase tracking-wider"
              >
                Registrar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <button
                key={c.matricula}
                onClick={() => openEdit(c)}
                className="text-left bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">
                      Matrícula
                    </p>
                    <p className="text-xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                      {c.matricula}
                    </p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                      {c.tipo}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${ESTADO_STYLES[c.estado]}`}
                  >
                    {labelEstado(c.estado)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <User size={14} className="text-slate-400" />
                    <span className="font-semibold truncate">
                      {c.conductor || "Sin conductor"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Weight size={14} className="text-slate-400" />
                      <span className="font-bold">{c.capacidadPeso} kg</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Box size={14} className="text-slate-400" />
                      <span className="font-bold">{c.capacidadVolumen} m³</span>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CamionPanel
        isOpen={panelOpen}
        mode={panelMode}
        initial={selected}
        onClose={() => setPanelOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
