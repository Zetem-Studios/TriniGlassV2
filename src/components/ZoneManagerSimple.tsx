import React from 'react';
import { X, Layers } from 'lucide-react';

interface ZoneManagerSimpleProps {
  onClose?: () => void;
}

export const ZoneManagerSimple: React.FC<ZoneManagerSimpleProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Layers size={24} />
            <h2 className="text-xl font-semibold">Gestión de Zonas y Subzonas</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600">
            <Layers size={48} className="mx-auto mb-4 text-gray-400 dark:text-slate-500" />
            <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Gestor de Zonas</h4>
            <p className="text-gray-500 dark:text-gray-400 mb-4">El componente se está cargando correctamente</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Si ves este mensaje, el problema no está en el componente básico</p>
          </div>
        </div>
      </div>
    </div>
  );
};
