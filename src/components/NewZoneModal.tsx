import { useState } from "react";
import { Plus, Check, X, AlertCircle, Trash2 } from "lucide-react";
import { createCompleteZone } from "../firebase";

interface NewZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onZoneCreated: (zoneId: string) => void;
}

export default function NewZoneModal({ isOpen, onClose, onZoneCreated }: NewZoneModalProps) {
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState<"produccion" | "almacenamiento" | "expedicion">("almacenamiento");
  const [newZoneLayout, setNewZoneLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [newZonePositions, setNewZonePositions] = useState<Array<{ name: string; locations: number }>>([{ name: "A", locations: 10 }]);
  const [modalError, setModalError] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

  const handleAddZone = async () => {
    setModalError("");

    if (!newZoneName.trim()) {
      setModalError("El nombre de la zona es obligatorio");
      return;
    }
    if (newZonePositions.length === 0) {
      setModalError("Debes agregar al menos una posición");
      return;
    }
    if (newZonePositions.some(p => !p.name.trim() || p.locations <= 0)) {
      setModalError("Todas las posiciones deben tener nombre y ubicaciones > 0");
      return;
    }

    setIsCreatingZone(true);
    try {
      const zoneId = newZoneName
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");

      if (!zoneId) {
        setModalError("El nombre no puede contener solo caracteres especiales");
        setIsCreatingZone(false);
        return;
      }

      await createCompleteZone(zoneId, newZoneName, newZoneType, newZoneLayout, newZonePositions);

      setNewZoneName("");
      setNewZoneType("almacenamiento");
      setNewZoneLayout("horizontal");
      setNewZonePositions([{ name: "A", locations: 10 }]);
      setModalError("");
      onZoneCreated(zoneId);
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

  const closeModal = () => {
    setNewZoneName("");
    setNewZoneType("almacenamiento");
    setNewZoneLayout("horizontal");
    setNewZonePositions([{ name: "A", locations: 10 }]);
    setModalError("");
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
                value={newZoneName}
                onChange={(e) => { setNewZoneName(e.target.value); setModalError(""); }}
                placeholder="Ej: CMS"
                className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
              />
            </div>

            <div className="flex flex-col gap-3 col-span-1">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tipo de Zona</label>
              <select
                value={newZoneType}
                onChange={(e) => setNewZoneType(e.target.value as "produccion" | "almacenamiento" | "expedicion")}
                className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
              >
                <option value="produccion">Producción</option>
                <option value="almacenamiento">Almacenamiento</option>
                <option value="expedicion">Expedición</option>
              </select>
            </div>
          </div>

          {/* Layout */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Layout de posiciones</label>
            <div className="flex gap-3">
              <button
                onClick={() => setNewZoneLayout("horizontal")}
                className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-colors ${
                  newZoneLayout === "horizontal"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                ↔ Horizontal
              </button>
              <button
                onClick={() => setNewZoneLayout("vertical")}
                className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-colors ${
                  newZoneLayout === "vertical"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                ↕ Vertical
              </button>
            </div>
          </div>

          {/* Posiciones */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Posiciones con Ubicaciones</label>
              <button
                onClick={() => setNewZonePositions([...newZonePositions, { name: String.fromCharCode(65 + newZonePositions.length), locations: 10 }])}
                className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider flex items-center gap-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {newZonePositions.map((pos, idx) => (
                <div key={idx} className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Posición</label>
                    <input
                      type="text"
                      value={pos.name}
                      onChange={(e) => {
                        const updated = [...newZonePositions];
                        updated[idx].name = e.target.value.toUpperCase();
                        setNewZonePositions(updated);
                        setModalError("");
                      }}
                      placeholder="A, B, C..."
                      maxLength={3}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Ubicaciones</label>
                    <input
                      type="number"
                      value={pos.locations}
                      onChange={(e) => {
                        const updated = [...newZonePositions];
                        updated[idx].locations = parseInt(e.target.value) || 1;
                        setNewZonePositions(updated);
                        setModalError("");
                      }}
                      min="1"
                      placeholder="10"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-sm"
                    />
                  </div>
                  {newZonePositions.length > 1 && (
                    <button
                      onClick={() => setNewZonePositions(newZonePositions.filter((_, i) => i !== idx))}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-2xl">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              📊 Se crearán: <strong>{newZonePositions.length} posiciones con {newZonePositions.reduce((sum, p) => sum + p.locations, 0)} ubicaciones totales</strong>
            </p>
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
