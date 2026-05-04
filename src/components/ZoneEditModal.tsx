import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

// Interfaces
interface Zona {
  id: string;
  nombre: string;
  tipo: "produccion" | "almacenamiento" | "expedicion";
  descripcion?: string;
  capacidadMaxima: number | null;
  fechaCreacion: Date;
  activa: boolean;
}

interface Subzona {
  id: string;
  nombre: string;
  zonaId: string;
  posiciones: string[];
  capacidadMaxima: number | null;
  color?: string;
  activa: boolean;
  fechaCreacion: Date;
}

interface ZoneEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editType: 'zona' | 'subzona';
  item?: Zona | Subzona;
  zonas?: Zona[];
  onSave: (data: Partial<Zona | Subzona>) => void;
  preselectedZonaId?: string;
}

export const ZoneEditModal: React.FC<ZoneEditModalProps> = ({
  isOpen,
  onClose,
  editType,
  item,
  zonas = [],
  onSave,
  preselectedZonaId
}) => {
  const [formData, setFormData] = useState(() => {
    if (editType === 'zona') {
      const zona = item as Zona;
      return {
        nombre: zona?.nombre || '',
        tipo: zona?.tipo || 'almacenamiento',
        descripcion: zona?.descripcion || '',
        capacidadMaxima: zona?.capacidadMaxima || null,
        activa: zona?.activa ?? true
      };
    } else {
      const subzona = item as Subzona;
      return {
        nombre: subzona?.nombre || '',
        zonaId: subzona?.zonaId || preselectedZonaId || '',
        capacidadMaxima: subzona?.capacidadMaxima || null,
        activa: subzona?.activa ?? true
      };
    }
  });

  // Efecto para actualizar formData cuando el item cambia
  useEffect(() => {
    if (editType === 'zona') {
      const zona = item as Zona;
      setFormData({
        nombre: zona?.nombre || '',
        tipo: zona?.tipo || 'almacenamiento',
        descripcion: zona?.descripcion || '',
        capacidadMaxima: zona?.capacidadMaxima || null,
        activa: zona?.activa ?? true
      });
    } else {
      const subzona = item as Subzona;
      setFormData({
        nombre: subzona?.nombre || '',
        zonaId: subzona?.zonaId || preselectedZonaId || '',
        capacidadMaxima: subzona?.capacidadMaxima || null,
        activa: subzona?.activa ?? true
      });
    }
  }, [item, editType, preselectedZonaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      return;
    }

    if (editType === 'subzona' && !formData.zonaId) {
      return;
    }

    onSave(formData);
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {editType === 'zona' ? 'Editar Zona' : 'Editar Subzona'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder={editType === 'zona' ? 'Ej: Expediciones' : 'Ej: H, Mamparista'}
                required
              />
            </div>

            {/* Campos específicos para Zonas */}
            {editType === 'zona' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => handleChange('tipo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="produccion">Producción</option>
                    <option value="almacenamiento">Almacenamiento</option>
                    <option value="expedicion">Expedición</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capacidad Máxima
                  </label>
                  <input
                    type="number"
                    value={formData.capacidadMaxima || ''}
                    onChange={(e) => handleChange('capacidadMaxima', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    min="1"
                    placeholder="Sin límite"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    placeholder="Describe brevemente esta zona..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Campos específicos para Subzonas */}
            {editType === 'subzona' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Zona *
                  </label>
                  <select
                    value={formData.zonaId}
                    onChange={(e) => handleChange('zonaId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    required
                  >
                    <option value="">Selecciona una zona...</option>
                    {zonas.map((zona) => (
                      <option key={zona.id} value={zona.id}>{zona.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capacidad Máxima
                  </label>
                  <input
                    type="number"
                    value={formData.capacidadMaxima || ''}
                    onChange={(e) => handleChange('capacidadMaxima', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    min="1"
                    placeholder="Sin límite"
                  />
                </div>

                {/* Información sobre posiciones */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Posiciones</h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Las posiciones se actualizan automáticamente desde el mapa cuando la zona o subzona está asignada a un área.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Información sobre color */}
                <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-gray-600 dark:text-gray-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Color</h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                        {editType === 'zona' 
                          ? 'Las zonas tienen un color gris fijo.'
                          : 'Las subzonas tienen un color gris oscuro fijo.'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                value={formData.activa.toString()}
                onChange={(e) => handleChange('activa', e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                Guardar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
