import { useEffect, useState } from "react";
import {
  Truck,
  X,
  Check,
  AlertCircle,
  Hash,
  User,
  Weight,
  Box,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Camion, EstadoCamion } from "../../services/CamionService";
import {
  ESTADOS_CAMION,
  TIPOS_CAMION,
  saveCamion,
  deleteCamion,
  normalizeMatricula,
} from "../../services/CamionService";

interface CamionPanelProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initial?: Camion | null;
  onClose: () => void;
  onSaved: (camion: Camion) => void;
  onDeleted?: (matricula: string) => void;
}

const EMPTY_FORM = {
  matricula: "",
  tipo: TIPOS_CAMION[0] as string,
  conductor: "",
  capacidadPeso: "",
  capacidadVolumen: "",
  estado: "disponible" as EstadoCamion,
};

export default function CamionPanel({
  isOpen,
  mode,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: CamionPanelProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setConfirmDelete(false);
    if (mode === "edit" && initial) {
      setForm({
        matricula: initial.matricula,
        tipo: initial.tipo,
        conductor: initial.conductor,
        capacidadPeso: String(initial.capacidadPeso),
        capacidadVolumen: String(initial.capacidadVolumen),
        estado: initial.estado,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, mode, initial]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError("");
    const camion: Camion = {
      matricula: normalizeMatricula(form.matricula),
      tipo: form.tipo,
      conductor: form.conductor.trim(),
      capacidadPeso: Number(form.capacidadPeso),
      capacidadVolumen: Number(form.capacidadVolumen),
      estado: form.estado,
    };

    setSaving(true);
    try {
      const saved = await saveCamion(camion, { isNew: mode === "create" });
      onSaved(saved);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
        setError("Sin permisos en Firebase. Revisa las reglas de Firestore.");
      } else if (msg.includes("offline") || msg.includes("network")) {
        setError("Sin conexión. Comprueba tu internet.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== "edit" || !initial) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteCamion(initial.matricula);
      onDeleted?.(initial.matricula);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const isEdit = mode === "edit";

  return (
    <div className="fixed top-0 right-0 h-full w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 shadow-[-20px_0_60px_rgba(0,0,0,0.2)] animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg">
            <Truck size={24} />
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white leading-none">
            {isEdit ? "Editar Camión" : "Registrar Camión"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors"
        >
          <X size={28} strokeWidth={3} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Hash size={14} /> Matrícula
          </label>
          <input
            type="text"
            value={form.matricula}
            disabled={isEdit}
            onChange={(e) =>
              setForm({ ...form, matricula: e.target.value.toUpperCase() })
            }
            placeholder="Ej: 1234-ABC"
            maxLength={12}
            className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-bold tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {isEdit && (
            <p className="text-[11px] text-slate-500 -mt-1">
              La matrícula identifica al camión y no puede modificarse.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Truck size={14} /> Tipo
          </label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
          >
            {TIPOS_CAMION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <User size={14} /> Conductor
          </label>
          <input
            type="text"
            value={form.conductor}
            onChange={(e) => setForm({ ...form, conductor: e.target.value })}
            placeholder="Nombre y apellidos"
            className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Weight size={14} /> Peso (kg)
            </label>
            <input
              type="number"
              min={1}
              value={form.capacidadPeso}
              onChange={(e) =>
                setForm({ ...form, capacidadPeso: e.target.value })
              }
              placeholder="Ej: 3500"
              className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
            />
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Box size={14} /> Volumen (m³)
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={form.capacidadVolumen}
              onChange={(e) =>
                setForm({ ...form, capacidadVolumen: e.target.value })
              }
              placeholder="Ej: 18"
              className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            Estado
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ESTADOS_CAMION.map((opt) => {
              const active = form.estado === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, estado: opt.value })}
                  className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {isEdit && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                confirmDelete
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
              } disabled:opacity-50`}
            >
              {deleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {confirmDelete ? "Confirmar eliminación" : "Eliminar camión"}
            </button>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900 shrink-0">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl uppercase text-xs tracking-wider transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-black rounded-2xl uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={3} />
              {isEdit ? "Guardar cambios" : "Registrar"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
