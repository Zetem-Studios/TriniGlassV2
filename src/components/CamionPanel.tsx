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
    <div className="fixed top-0 right-0 h-full w-[440px] bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800/80 z-50 shadow-xl animate-in slide-in-from-right duration-200 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-lg text-brand-600 dark:text-brand-400">
            <Truck size={18} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {isEdit ? "Editar camión" : "Registrar camión"}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200/80 dark:border-red-500/20 rounded-lg">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
            className="w-full px-3 py-2 border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {isEdit && (
            <p className="text-[11px] text-slate-500 -mt-1">
              La matrícula identifica al camión y no puede modificarse.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Truck size={14} /> Tipo
          </label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm"
          >
            {TIPOS_CAMION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <User size={14} /> Conductor
          </label>
          <input
            type="text"
            value={form.conductor}
            onChange={(e) => setForm({ ...form, conductor: e.target.value })}
            placeholder="Nombre y apellidos"
            className="w-full px-3 py-2 border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
              className="w-full px-3 py-2 border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm"
            />
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
              className="w-full px-3 py-2 border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {isEdit && (
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                confirmDelete
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15"
              } disabled:opacity-50`}
            >
              {deleting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {confirmDelete ? "Confirmar eliminación" : "Eliminar camión"}
            </button>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-200/80 dark:border-slate-800/80 flex gap-3 bg-white dark:bg-slate-900 shrink-0">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/80 dark:border-slate-700/80 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check size={14} />
              {isEdit ? "Guardar cambios" : "Registrar"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
