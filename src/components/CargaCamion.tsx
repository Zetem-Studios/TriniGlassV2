import { useEffect, useMemo, useRef, useState } from "react";
import {
  Truck,
  Search,
  Loader2,
  Weight,
  Box,
  AlertTriangle,
  X,
  Package,
  Wifi,
  ArrowLeft,
  CheckCircle2,
  GripVertical,
  Trash2,
  Play,
  MapPin,
  Flag,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  subscribeToPalets,
  subscribeToCargas,
  assignPaletToCamion,
  removePaletFromCamion,
  vaciarCamion,
  validarCarga,
  iniciarRuta,
  computeParadasFromPalets,
  type PaletPendiente,
  type CargaCamion as CargaCamionType,
  type Parada,
} from "../../services/CargaCamionService";
import { getCamiones, type Camion } from "../../services/CamionService";
import { useAuth } from "../context/useAuth";

const formatNumber = (n: number, decimals = 0) =>
  Number.isFinite(n) ? n.toFixed(decimals) : "0";

const ORIGEN_STORAGE_KEY = "triniglass:cargaCamion:origen";

const PaletCard = ({
  palet,
  onDragStart,
  onDragEnd,
  isDragging,
  isDraggable,
}: {
  palet: PaletPendiente;
  onDragStart: (palet: PaletPendiente) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDraggable: boolean;
}) => (
  <div
    draggable={isDraggable}
    onDragStart={(e) => {
      if (!isDraggable) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", palet.docId);
      onDragStart(palet);
    }}
    onDragEnd={onDragEnd}
    className={`group flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border rounded-2xl cursor-grab active:cursor-grabbing transition-all ${
      isDragging
        ? "opacity-40 border-blue-500"
        : "border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md"
    } ${!isDraggable ? "opacity-60 cursor-not-allowed hover:border-slate-200 hover:shadow-none" : ""}`}
  >
    <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
      <Package size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-black text-sm text-slate-900 dark:text-white truncate">
          {palet.codigoBarra}
        </p>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
          {palet.estado}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {palet.cliente}
      </p>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1">
          <Weight size={11} className="text-slate-400" />
          {formatNumber(palet.pesoKg)} kg
        </span>
        <span className="flex items-center gap-1">
          <Box size={11} className="text-slate-400" />
          {formatNumber(palet.volumenM3, 2)} m³
        </span>
        {palet.subzona && (
          <span className="text-slate-400">· {palet.subzona}</span>
        )}
      </div>
    </div>
    <GripVertical
      size={16}
      className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
    />
  </div>
);

const Gauge = ({
  label,
  unit,
  value,
  capacity,
  exceeds,
  preview,
}: {
  label: string;
  unit: string;
  value: number;
  capacity: number;
  exceeds: boolean;
  preview: number | null;
}) => {
  const pct = capacity > 0 ? Math.min(100, (value / capacity) * 100) : 0;
  const previewPct =
    preview !== null && capacity > 0
      ? Math.min(100, (preview / capacity) * 100)
      : null;
  const baseColor = exceeds
    ? "bg-red-500"
    : pct > 85
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div
      className={`p-4 rounded-2xl border ${
        exceeds
          ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900/60"
          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p
          className={`text-xs font-black ${
            exceeds ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
          }`}
        >
          {formatNumber(value, unit === "m³" ? 2 : 0)} / {formatNumber(capacity, unit === "m³" ? 2 : 0)}{" "}
          {unit}
        </p>
      </div>
      <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${baseColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
        {previewPct !== null && previewPct > pct && (
          <div
            className={`absolute top-0 h-full ${
              exceeds ? "bg-red-400/70" : "bg-blue-400/60"
            } transition-all`}
            style={{
              left: `${pct}%`,
              width: `${previewPct - pct}%`,
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{formatNumber(pct, 0)}%</span>
        {previewPct !== null && (
          <span
            className={
              exceeds ? "text-red-500" : "text-blue-500 dark:text-blue-400"
            }
          >
            previsto: {formatNumber(previewPct, 0)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default function CargaCamion() {
  const { matricula: matriculaParam } = useParams<{ matricula?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [palets, setPalets] = useState<PaletPendiente[]>([]);
  const [cargas, setCargas] = useState<Record<string, CargaCamionType>>({});
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [selectedMatricula, setSelectedMatricula] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draggingPalet, setDraggingPalet] = useState<PaletPendiente | null>(null);
  const [isDropHovering, setIsDropHovering] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loadingCamiones, setLoadingCamiones] = useState(true);
  const [loadingPalets, setLoadingPalets] = useState(true);
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const [confirmVaciar, setConfirmVaciar] = useState(false);
  const [iniciandoRuta, setIniciandoRuta] = useState(false);
  const [confirmIniciarRuta, setConfirmIniciarRuta] = useState(false);
  const [origen, setOrigen] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ORIGEN_STORAGE_KEY) ?? "";
  });
  const [ordenClientes, setOrdenClientes] = useState<string[]>([]);

  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingCamiones(true);
    getCamiones()
      .then((cs) => {
        if (!mounted) return;
        setCamiones(cs);
        if (cs.length) {
          const candidate =
            (matriculaParam && cs.find((c) => c.matricula === matriculaParam)?.matricula) ||
            cs.find((c) => c.estado === "disponible")?.matricula ||
            cs[0].matricula;
          setSelectedMatricula(candidate);
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "No se pudo cargar la flota")
      )
      .finally(() => mounted && setLoadingCamiones(false));

    const unsubPalets = subscribeToPalets((list) => {
      setPalets(list);
      setLoadingPalets(false);
    });
    const unsubCargas = subscribeToCargas((map) => {
      setCargas(map);
      setLoadingCargas(false);
    });

    return () => {
      mounted = false;
      unsubPalets();
      unsubCargas();
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, [matriculaParam]);

  const showInfo = (msg: string) => {
    setInfo(msg);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => setInfo(""), 3500);
  };

  const selectedCamion = useMemo(
    () => camiones.find((c) => c.matricula === selectedMatricula) ?? null,
    [camiones, selectedMatricula]
  );

  const isCamionEnRuta = selectedCamion?.estado === "en_ruta";
  const canEditarCarga = !!selectedCamion && !isCamionEnRuta;

  const cargaActual = cargas[selectedMatricula];

  useEffect(() => {
    setConfirmVaciar(false);
    setConfirmIniciarRuta(false);
    setOrdenClientes([]);
  }, [selectedMatricula]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (origen) window.localStorage.setItem(ORIGEN_STORAGE_KEY, origen);
    else window.localStorage.removeItem(ORIGEN_STORAGE_KEY);
  }, [origen]);

  const assignedDocIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(cargas).forEach((c) =>
      c.palets.forEach((p) => set.add(p.docId))
    );
    return set;
  }, [cargas]);

  const pendientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return palets
      .filter((p) => !assignedDocIds.has(p.docId))
      .filter((p) => {
        if (!term) return true;
        return (
          p.codigoBarra.toLowerCase().includes(term) ||
          p.cliente.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term)
        );
      });
  }, [palets, assignedDocIds, search]);

  const validacion = useMemo(() => {
    if (!selectedCamion || !canEditarCarga)
      return null;
    return validarCarga(
      cargaActual?.palets ?? [],
      draggingPalet
        ? { pesoKg: draggingPalet.pesoKg, volumenM3: draggingPalet.volumenM3 }
        : null,
      {
        peso: selectedCamion.capacidadPeso,
        volumen: selectedCamion.capacidadVolumen,
      }
    );
  }, [cargaActual, draggingPalet, selectedCamion, canEditarCarga]);

  const dropBlocked =
    !canEditarCarga ||
    !!draggingPalet &&
    !!validacion &&
    (validacion.excedePeso || validacion.excedeVolumen);

  const handleDragStart = (palet: PaletPendiente) => {
    if (!canEditarCarga) return;
    setError("");
    setDraggingPalet(palet);
  };

  const handleDragEnd = () => {
    setDraggingPalet(null);
    setIsDropHovering(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canEditarCarga) return;
    e.preventDefault();
    if (!draggingPalet) return;
    e.dataTransfer.dropEffect = dropBlocked ? "none" : "move";
    if (!isDropHovering) setIsDropHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as Node).contains(e.relatedTarget as Node)) return;
    setIsDropHovering(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropHovering(false);
    if (!canEditarCarga || !draggingPalet || !selectedCamion) {
      if (isCamionEnRuta) {
        setError("El camión está en ruta y no se puede modificar su carga.");
      }
      return;
    }
    setError("");
    setSaving(true);
    try {
      await assignPaletToCamion({
        matricula: selectedCamion.matricula,
        palet: {
          docId: draggingPalet.docId,
          codigoBarra: draggingPalet.codigoBarra,
          cliente: draggingPalet.cliente,
          descripcion: draggingPalet.descripcion,
          pesoKg: draggingPalet.pesoKg,
          volumenM3: draggingPalet.volumenM3,
        },
        capacidad: {
          peso: selectedCamion.capacidadPeso,
          volumen: selectedCamion.capacidadVolumen,
        },
        email: user?.email ?? "anónimo",
      });
      showInfo(
        `Palet ${draggingPalet.codigoBarra} cargado en ${selectedCamion.matricula}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo asignar el palet");
    } finally {
      setSaving(false);
      setDraggingPalet(null);
    }
  };

  const handleRemove = async (docId: string, codigo: string) => {
    if (!canEditarCarga || !selectedCamion) {
      if (isCamionEnRuta) {
        setError("El camión está en ruta y no se puede retirar ningún palet.");
      }
      return;
    }
    setError("");
    try {
      await removePaletFromCamion(selectedCamion.matricula, docId);
      showInfo(`Palet ${codigo} retirado del camión`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo retirar el palet");
    }
  };

  const handleVaciar = async () => {
    if (!canEditarCarga || !selectedCamion) {
      if (isCamionEnRuta) {
        setError("El camión está en ruta y no se puede vaciar.");
      }
      return;
    }
    if (!confirmVaciar) {
      setConfirmVaciar(true);
      return;
    }
    setError("");
    setVaciando(true);
    try {
      const removed = await vaciarCamion(selectedCamion.matricula);
      showInfo(
        removed === 0
          ? "El camión ya estaba vacío"
          : `Camión vaciado (${removed} palet${removed === 1 ? "" : "s"} retirado${removed === 1 ? "" : "s"})`
      );
      setConfirmVaciar(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo vaciar el camión");
    } finally {
      setVaciando(false);
    }
  };

  const cargaPalets = cargaActual?.palets ?? [];

  const paradas: Parada[] = useMemo(
    () => computeParadasFromPalets(cargaPalets, ordenClientes),
    [cargaPalets, ordenClientes]
  );

  const moverParada = (cliente: string, direccion: -1 | 1) => {
    const orden = paradas.map((p) => p.cliente);
    const idx = orden.indexOf(cliente);
    if (idx < 0) return;
    const nuevoIdx = idx + direccion;
    if (nuevoIdx < 0 || nuevoIdx >= orden.length) return;
    const next = [...orden];
    [next[idx], next[nuevoIdx]] = [next[nuevoIdx], next[idx]];
    setOrdenClientes(next);
  };

  const handleIniciarRuta = async () => {
    if (!selectedCamion) return;
    if (selectedCamion.estado !== "disponible") {
      setError("Solo se puede iniciar la ruta desde un camión disponible.");
      return;
    }
    if (cargaPalets.length === 0) {
      setError("Carga al menos un palet antes de iniciar la ruta.");
      return;
    }
    if (!origen.trim()) {
      setError("Indica el origen de la ruta antes de iniciarla.");
      return;
    }
    if (paradas.length === 0) {
      setError("La ruta debe tener al menos una parada.");
      return;
    }
    if (!confirmIniciarRuta) {
      setConfirmIniciarRuta(true);
      return;
    }
    setError("");
    setIniciandoRuta(true);
    try {
      await iniciarRuta({
        matricula: selectedCamion.matricula,
        conductor: selectedCamion.conductor,
        tipo: String(selectedCamion.tipo),
        email: user?.email ?? "anónimo",
        origen: origen.trim(),
        paradas,
      });
      setCamiones((prev) =>
        prev.map((c) =>
          c.matricula === selectedCamion.matricula
            ? { ...c, estado: "en_ruta" }
            : c
        )
      );
      setConfirmIniciarRuta(false);
      showInfo(
        `Ruta iniciada para ${selectedCamion.matricula} (${cargaPalets.length} palet${cargaPalets.length === 1 ? "" : "s"} en tránsito)`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar la ruta"
      );
    } finally {
      setIniciandoRuta(false);
    }
  };

  return (
    <div className="min-h-full text-slate-900 dark:text-white font-sans">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/camiones")}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              title="Volver a la flota"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">
                Carga de camión
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
                <Wifi size={12} className="text-emerald-500" /> Sincronizado en
                tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Camión
            </label>
            <select
              value={selectedMatricula}
              onChange={(e) => setSelectedMatricula(e.target.value)}
              disabled={loadingCamiones || !camiones.length}
              className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black tracking-wider outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
            >
              {camiones.map((c) => {
                const carga = cargas[c.matricula];
                const total = carga?.palets.length ?? 0;
                return (
                  <option key={c.matricula} value={c.matricula}>
                    {c.matricula} · {c.tipo} · {total} palets
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {isCamionEnRuta && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-800 dark:text-amber-300">
                Camión en ruta
              </p>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-200 mt-0.5">
                La carga queda bloqueada mientras esté en ruta: no se pueden añadir ni retirar palets.
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl">
            <AlertTriangle size={20} className="text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black text-red-700 dark:text-red-400">
                Operación bloqueada
              </p>
              <p className="text-xs font-semibold text-red-600 dark:text-red-300 mt-0.5">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {info && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {info}
            </p>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-5">
          {/* PALETS PENDIENTES */}
          <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Palets pendientes
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-black tracking-wider">
                  {pendientes.length}
                </span>
              </div>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Código de barras, cliente..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[640px]">
              {loadingPalets ? (
                <div className="flex items-center justify-center py-10 text-slate-500">
                  <Loader2 className="animate-spin mr-2" size={18} />
                  <span className="text-sm font-bold">Cargando palets…</span>
                </div>
              ) : pendientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Package size={26} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    No hay palets pendientes
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Todos están asignados o no pasan el filtro.
                  </p>
                </div>
              ) : (
                pendientes.map((p) => (
                  <PaletCard
                    key={p.docId}
                    palet={p}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingPalet?.docId === p.docId}
                    isDraggable={canEditarCarga}
                  />
                ))
              )}
            </div>
          </section>

          {/* PLANO DEL CAMIÓN */}
          <section className="flex flex-col gap-4">
            {/* Info camión */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              {!selectedCamion ? (
                <p className="text-sm font-bold text-slate-500">
                  Selecciona un camión para empezar a cargar.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Matrícula
                      </p>
                      <p className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                        {selectedCamion.matricula}
                      </p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedCamion.tipo} · {selectedCamion.conductor || "Sin conductor"}
                      </p>
                    </div>

                    {selectedCamion.estado === "disponible" &&
                      cargaPalets.length > 0 && (
                        <div className="flex flex-col gap-3 w-full sm:w-auto sm:min-w-70">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <MapPin size={12} />
                            Origen
                          </div>
                          <input
                            type="text"
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            placeholder="Ej. Almacén Central"
                            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                          />

                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span className="flex items-center gap-2">
                              <Flag size={12} />
                              Paradas
                            </span>
                            <span>{paradas.length}</span>
                          </div>
                          <ul className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                            {paradas.map((p, idx) => (
                              <li
                                key={p.cliente}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                              >
                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-[10px] font-black">
                                  {idx + 1}
                                </span>
                                <span className="flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                                  {p.cliente}
                                </span>
                                <span className="text-[10px] font-black tracking-wider text-slate-400">
                                  {p.totalPalets} pal{p.totalPalets === 1 ? "" : "s"}
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moverParada(p.cliente, -1)}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Subir parada"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === paradas.length - 1}
                                  onClick={() => moverParada(p.cliente, 1)}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Bajar parada"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            disabled={iniciandoRuta}
                            onClick={handleIniciarRuta}
                            onBlur={() => {
                              if (confirmIniciarRuta && !iniciandoRuta)
                                setConfirmIniciarRuta(false);
                            }}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md active:scale-95 transition-all disabled:opacity-60 ${
                              confirmIniciarRuta
                                ? "bg-blue-700 hover:bg-blue-600 text-white"
                                : "bg-blue-600 hover:bg-blue-500 text-white"
                            }`}
                          >
                            {iniciandoRuta ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                            {iniciandoRuta
                              ? "Iniciando..."
                              : confirmIniciarRuta
                                ? `Confirmar (${paradas.length} parada${paradas.length === 1 ? "" : "s"})`
                                : "Marcar en ruta"}
                          </button>
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1 min-w-[280px]">
                    <Gauge
                      label="Peso"
                      unit="kg"
                      value={validacion?.pesoTotal ?? 0}
                      capacity={selectedCamion.capacidadPeso}
                      exceeds={validacion?.excedePeso ?? false}
                      preview={
                        draggingPalet ? validacion?.pesoTotal ?? null : null
                      }
                    />
                    <Gauge
                      label="Volumen"
                      unit="m³"
                      value={validacion?.volumenTotal ?? 0}
                      capacity={selectedCamion.capacidadVolumen}
                      exceeds={validacion?.excedeVolumen ?? false}
                      preview={
                        draggingPalet ? validacion?.volumenTotal ?? null : null
                      }
                    />
                  </div>
                </div>
              )}

              {/* Banner de validación en vivo */}
              {draggingPalet && validacion && (
                <div
                  className={`mt-4 p-3 rounded-2xl border flex items-start gap-3 ${
                    dropBlocked
                      ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900/50"
                      : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50"
                  }`}
                >
                  <AlertTriangle
                    size={18}
                    className={
                      dropBlocked
                        ? "text-red-500 mt-0.5"
                        : "text-blue-500 mt-0.5"
                    }
                  />
                  <div className="text-xs font-bold">
                    {dropBlocked ? (
                      <p className="text-red-700 dark:text-red-300">
                        {validacion.excedePeso && "Peso excede el máximo. "}
                        {validacion.excedeVolumen && "Volumen excede el máximo. "}
                        Suelta este palet en otro camión.
                      </p>
                    ) : (
                      <p className="text-blue-700 dark:text-blue-300">
                        Al soltar:{" "}
                        {formatNumber(validacion.pesoTotal, 0)} kg ·{" "}
                        {formatNumber(validacion.volumenTotal, 2)} m³
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PLANO */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-3xl border-2 border-dashed p-5 min-h-[420px] transition-all ${
                isDropHovering
                  ? dropBlocked
                    ? "bg-red-50 dark:bg-red-950/20 border-red-400"
                    : "bg-blue-50 dark:bg-blue-950/20 border-blue-400"
                  : isCamionEnRuta
                    ? "bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700"
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700"
              } ${!canEditarCarga ? "opacity-90" : ""}`}
            >
              {/* Cabina */}
              <div className="absolute top-5 left-5 w-16 h-20 bg-slate-300 dark:bg-slate-700 rounded-l-2xl rounded-r-md flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                <Truck size={20} />
                <span className="text-[9px] font-black uppercase tracking-wider mt-1">
                  Cabina
                </span>
              </div>

              {/* Cargo bed */}
              <div className="ml-24 mr-2 h-full">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
                    Plano del remolque
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedCamion && (
                      <p className="text-[11px] font-black text-slate-500">
                        {cargaPalets.length} palet{cargaPalets.length === 1 ? "" : "s"}
                      </p>
                    )}
                    {selectedCamion && cargaPalets.length > 0 && (
                      <button
                        type="button"
                        onClick={handleVaciar}
                        onBlur={() => {
                          if (confirmVaciar && !vaciando) setConfirmVaciar(false);
                        }}
                        disabled={vaciando || !canEditarCarga}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-60 ${
                          confirmVaciar
                            ? "bg-red-600 hover:bg-red-500 text-white border-red-700"
                            : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50"
                        }`}
                        title="Vaciar camión"
                      >
                        {vaciando ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        {vaciando
                          ? "Vaciando..."
                          : confirmVaciar
                            ? `Confirmar (${cargaPalets.length})`
                            : "Vaciar camión"}
                      </button>
                    )}
                  </div>
                </div>

                {loadingCargas ? (
                  <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 className="animate-spin mr-2" size={18} />
                    <span className="text-sm font-bold">
                      Cargando estado del camión…
                    </span>
                  </div>
                ) : !selectedCamion ? null : cargaPalets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center mb-3">
                      <Truck size={28} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-wider text-slate-500">
                      Camión vacío
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Arrastra palets desde la izquierda al plano para cargarlos.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {cargaPalets.map((p) => (
                      <div
                        key={p.docId}
                        className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-sm hover:border-blue-400 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="p-1 bg-blue-100 dark:bg-blue-950/40 rounded-md text-blue-600 dark:text-blue-400">
                            <Package size={12} />
                          </div>
                          <p className="text-[11px] font-black truncate flex-1">
                            {p.codigoBarra}
                          </p>
                          <button
                            onClick={() => handleRemove(p.docId, p.codigoBarra)}
                            disabled={!canEditarCarga}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                            title="Retirar palet"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {p.cliente}
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1.5">
                          <span>{formatNumber(p.pesoKg)} kg</span>
                          <span>{formatNumber(p.volumenM3, 2)} m³</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drag hint overlay */}
              {isDropHovering && (
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none rounded-3xl ${
                    dropBlocked ? "bg-red-500/10" : "bg-blue-500/10"
                  }`}
                >
                  <div
                    className={`px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest border-2 ${
                      dropBlocked
                        ? "bg-red-500 text-white border-red-600"
                        : "bg-blue-600 text-white border-blue-700"
                    }`}
                  >
                    {isCamionEnRuta
                      ? "Carga bloqueada en ruta"
                      : dropBlocked
                      ? "No cabe en este camión"
                      : saving
                        ? "Guardando…"
                        : "Soltar para cargar"}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
