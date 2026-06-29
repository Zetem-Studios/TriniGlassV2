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
  PackagePlus,
  Flag,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Camion, EstadoCamion } from "../../services/CamionService";
import {
  ESTADOS_CAMION,
  subscribeToCamiones,
  updateEstadoCamion,
} from "../../services/CamionService";
import {
  subscribeToCargas,
  finalizarRuta,
  cancelarRuta,
  type CargaCamion as CargaCamionType,
} from "../../services/CargaCamionService";
import { useAuth } from "../context/useAuth";
import CamionPanel from "./CamionPanel";

const ESTADO_STYLES: Record<EstadoCamion, string> = {
  disponible:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20",
  en_ruta:
    "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 border-brand-200/80 dark:border-brand-500/20",
  no_disponible:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/20",
  mantenimiento:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20",
};

const labelEstado = (estado: EstadoCamion) =>
  ESTADOS_CAMION.find((e) => e.value === estado)?.label ?? estado;

export default function Camiones() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [cargas, setCargas] = useState<Record<string, CargaCamionType>>({});
  const [finalizandoMatricula, setFinalizandoMatricula] = useState<string | null>(
    null
  );
  const [confirmFinalizar, setConfirmFinalizar] = useState<string | null>(null);
  const [marcandoDisponible, setMarcandoDisponible] = useState<string | null>(
    null
  );
  const [cancelandoMatricula, setCancelandoMatricula] = useState<string | null>(
    null
  );
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCargas(setCargas);
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    const unsub = subscribeToCamiones((data) => {
      setCamiones(data);
      setLoading(false);
    });
    return () => unsub();
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
      no_disponible: 0,
      mantenimiento: 0,
    };
    camiones.forEach((c) => {
      if (base[c.estado] !== undefined) {
        base[c.estado] += 1;
      }
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

  const handleFinalizarRuta = async (matricula: string) => {
    if (confirmFinalizar !== matricula) {
      setConfirmFinalizar(matricula);
      return;
    }
    setFinalizandoMatricula(matricula);
    setLoadError("");
    try {
      await finalizarRuta(matricula, user?.email ?? "anónimo");
      setCamiones((prev) =>
        prev.map((c) =>
          c.matricula === matricula ? { ...c, estado: "no_disponible" } : c
        )
      );
      setConfirmFinalizar(null);
    } catch (e: unknown) {
      setLoadError(
        e instanceof Error ? e.message : "No se pudo finalizar la ruta"
      );
    } finally {
      setFinalizandoMatricula(null);
    }
  };

  const handleCancelarRuta = async (matricula: string) => {
    if (confirmCancelar !== matricula) {
      setConfirmCancelar(matricula);
      return;
    }
    setCancelandoMatricula(matricula);
    setLoadError("");
    try {
      await cancelarRuta(matricula, user?.email ?? "anónimo");
      setCamiones((prev) =>
        prev.map((c) =>
          c.matricula === matricula ? { ...c, estado: "disponible" } : c
        )
      );
      setConfirmCancelar(null);
    } catch (e: unknown) {
      setLoadError(
        e instanceof Error ? e.message : "No se pudo cancelar la ruta"
      );
    } finally {
      setCancelandoMatricula(null);
    }
  };

  const handleMarcarDisponible = async (matricula: string) => {
    setMarcandoDisponible(matricula);
    setLoadError("");
    try {
      await updateEstadoCamion(matricula, "disponible");
      setCamiones((prev) =>
        prev.map((c) =>
          c.matricula === matricula ? { ...c, estado: "disponible" } : c
        )
      );
    } catch (e: unknown) {
      setLoadError(
        e instanceof Error ? e.message : "No se pudo actualizar el camión"
      );
    } finally {
      setMarcandoDisponible(null);
    }
  };

  return (
    <div className="min-h-full text-slate-900 dark:text-white font-sans">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-500/10 rounded-xl text-brand-600 dark:text-brand-400">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Flota de Camiones
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {camiones.length} vehículos registrados
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Nuevo camión
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ESTADOS_CAMION.map((e) => (
            <button
              key={e.value}
              aria-pressed={estadoFilter === e.value}
              onClick={() =>
                setEstadoFilter((prev) => (prev === e.value ? "todos" : e.value))
              }
              className={`p-4 rounded-xl border text-left transition-all duration-150 ${
                estadoFilter === e.value
                  ? ESTADO_STYLES[e.value]
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {e.label}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">{counts[e.value]}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por matrícula, conductor o tipo..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
            />
          </div>
          {estadoFilter !== "todos" && (
            <button
              onClick={() => setEstadoFilter("todos")}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Quitar filtro
            </button>
          )}
        </div>

        {loadError && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200/80 dark:border-red-500/20 rounded-lg">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {loadError}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="animate-spin mr-3" size={20} />
            <span className="text-sm font-medium">Cargando flota...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200/80 dark:border-slate-800/80">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Truck size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {camiones.length === 0
                ? "Aún no hay camiones registrados"
                : "No hay camiones que coincidan con el filtro"}
            </p>
            {camiones.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Registrar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div
                key={c.matricula}
                role="button"
                tabIndex={0}
                onClick={() => openEdit(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEdit(c);
                  }
                }}
                className="text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                      Matrícula
                    </p>
                    <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      {c.matricula}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.tipo}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border ${ESTADO_STYLES[c.estado]}`}
                  >
                    {labelEstado(c.estado)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <User size={14} className="text-slate-400" />
                    <span className="font-medium truncate">
                      {c.conductor || "Sin conductor"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Weight size={14} className="text-slate-400" />
                      <span className="font-medium tabular-nums">{c.capacidadPeso} kg</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Box size={14} className="text-slate-400" />
                      <span className="font-medium tabular-nums">{c.capacidadVolumen} m³</span>
                    </span>
                  </div>
                </div>

                {(() => {
                  const paletsCargados = cargas[c.matricula]?.palets.length ?? 0;
                  const finalizando = finalizandoMatricula === c.matricula;
                  const enConfirmacion = confirmFinalizar === c.matricula;

                  if (c.estado === "en_ruta") {
                    const cancelando = cancelandoMatricula === c.matricula;
                    const enConfirmacionCancelar = confirmCancelar === c.matricula;
                    return (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={cancelando || finalizando}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelarRuta(c.matricula);
                          }}
                          onBlur={() => {
                            if (enConfirmacionCancelar && !cancelando)
                              setConfirmCancelar(null);
                          }}
                          className={`px-3 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-60 ${
                            enConfirmacionCancelar
                              ? "bg-red-600 hover:bg-red-500 text-white"
                              : "bg-slate-500 hover:bg-slate-400 text-white"
                          }`}
                        >
                          {cancelando ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {cancelando
                            ? "Cancelando..."
                            : enConfirmacionCancelar
                              ? "Confirmar"
                              : "Cancelar ruta"}
                        </button>
                        <button
                          type="button"
                          disabled={finalizando || cancelando}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFinalizarRuta(c.matricula);
                          }}
                          onBlur={() => {
                            if (enConfirmacion && !finalizando)
                              setConfirmFinalizar(null);
                          }}
                          className={`px-3 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-60 ${
                            enConfirmacion
                              ? "bg-red-600 hover:bg-red-500 text-white"
                              : "bg-amber-500 hover:bg-amber-400 text-white"
                          }`}
                        >
                          {finalizando ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Flag size={14} />
                          )}
                          {finalizando
                            ? "Finalizando..."
                            : enConfirmacion
                              ? `Confirmar (${paletsCargados})`
                              : "Finalizar ruta"}
                        </button>
                      </div>
                    );
                  }

                  if (c.estado === "disponible") {
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/camiones/cargar/${encodeURIComponent(c.matricula)}`
                          );
                        }}
                        className="mt-4 w-full bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <PackagePlus size={14} /> Cargar
                      </button>
                    );
                  }

                  if (c.estado === "no_disponible") {
                    const marcando = marcandoDisponible === c.matricula;
                    return (
                      <button
                        type="button"
                        disabled={marcando}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarcarDisponible(c.matricula);
                        }}
                        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                      >
                        {marcando ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        {marcando ? "Actualizando..." : "Marcar disponible"}
                      </button>
                    );
                  }

                  return null;
                })()}
              </div>
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
