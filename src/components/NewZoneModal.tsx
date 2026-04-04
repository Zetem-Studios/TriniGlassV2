import { useState } from "react";
import { Plus, Check, X, AlertCircle, Trash2 } from "lucide-react";
import { createCompleteZone } from "../firebase";

interface NewZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onZoneCreated: (zoneId: string) => void;
}

export default function NewZoneModal({ isOpen, onClose, onZoneCreated }: NewZoneModalProps) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"produccion" | "almacenamiento" | "expedicion">("almacenamiento");
  const [posiciones, setPosiciones] = useState<string[]>(["A"]);
  const [descripcion, setDescripcion] = useState("");
  const [modalError, setModalError] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

  const handleAddZone = async () => {
    setModalError("");

    if (!nombre.trim()) {
      setModalError("El nombre de la zona es obligatorio");
      return;
    }
    if (posiciones.length === 0) {
      setModalError("Debes agregar al menos una posición");
      return;
    }
    if (posiciones.some(p => !p.trim())) {
      setModalError("Las posiciones no pueden estar vacías");
      return;
    }

    setIsCreatingZone(true);
    try {
      const codigo = await createCompleteZone(nombre, tipo, posiciones, descripcion);
      resetForm();
      onZoneCreated(codigo);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("❌ Error creando zona:", error);
      if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
        setModalError("Sin permisos en Firebase. Revisa las reglas de Firestore.");
      } else if (msg.includes("offline") || msg.includes("network")) {
        setModalError("Sin conexión. Comprueba tu internet.");
      } else {
        setModalError(`Error: ${msg}`);
      }
    } finally {
      setIsCreatingZone(false);
    }
  };

  const resetForm = () => {
    setNombre("");
    setTipo("almacenamiento");
    setPosiciones(["A"]);
    setDescripcion("");
    setModalError("");
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg"><Plus size={24} /></div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">Nueva Zona Almacén</h2>
          </div>
          <button onClick={closeModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Error Message */}
          {modalError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">{modalError}</p>
            </div>
          )}

          {/* Grid de 2 columnas */}
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-3 col-span-1">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nombre de la Zona</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setModalError(""); }}
                placeholder="Ej: Expediciones"
                className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
              />
            </div>

            <div className="flex flex-col gap-3 col-span-1">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tipo de Zona</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "produccion" | "almacenamiento" | "expedicion")}
                className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
              >
                <option value="produccion">Producción</option>
                <option value="almacenamiento">Almacenamiento</option>
                <option value="expedicion">Expedición</option>
              </select>
            </div>
          </div>

          {/* Posiciones */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Posiciones</label>
              <button
                onClick={() => setPosiciones([...posiciones, String.fromCharCode(65 + posiciones.length)])}
                className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider flex items-center gap-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {posiciones.map((pos, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={pos}
                    onChange={(e) => {
                      const updated = [...posiciones];
                      updated[idx] = e.target.value.toUpperCase();
                      setPosiciones(updated);
                      setModalError("");
                    }}
                    maxLength={20}
                    className="w-24 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-sm"
                  />
                  {posiciones.length > 1 && (
                    <button
                      onClick={() => setPosiciones(posiciones.filter((_, i) => i !== idx))}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Zona de salida de material terminado..."
              rows={2}
              className="w-full px-5 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 sticky bottom-0 bg-white dark:bg-slate-900">
          <button
            onClick={closeModal}
            disabled={isCreatingZone}
            className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl uppercase text-sm tracking-wider transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddZone}
            disabled={isCreatingZone}
            className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-black rounded-2xl uppercase text-sm tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isCreatingZone ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check size={18} /> Crear Zona
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
