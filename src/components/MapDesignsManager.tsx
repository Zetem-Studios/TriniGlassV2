import React, { useState } from 'react';
import { useMapDesigns } from '../hooks/useMapDesigns';
import { type MapDesign } from '../services/mapDesignsService';
import { Timestamp } from 'firebase/firestore';
import { X, Save, FolderOpen, Trash2, Check, AlertCircle } from 'lucide-react';

interface MapDesignsManagerProps {
  onLoadDesign: (design: MapDesign) => void;
  onClose: () => void;
  getCurrentCanvasDesign: () => Omit<MapDesign, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'>;
}

export const MapDesignsManager: React.FC<MapDesignsManagerProps> = ({ onLoadDesign, onClose, getCurrentCanvasDesign }) => {
  const { designs, loading, error, saveDesign, deleteDesign, nameExists } = useMapDesigns();
  const [saveMode, setSaveMode] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);

  // Función para guardar el diseño actual
  const handleSaveDesign = async () => {
    if (!editingName.trim()) {
      setMessage({ type: 'error', text: 'El nombre es requerido' });
      return;
    }

    try {
      setSaving(true);
      
      // Obtener el diseño actual del canvas
      const currentDesign = getCurrentCanvasDesign();
      
      const designToSave = {
        ...currentDesign,
        name: editingName.trim(),
        description: editingDescription.trim() || undefined
      };

      if (editingDesignId) {
        // Actualizar diseño existente
        const existingDesign = designs.find(d => d.id === editingDesignId);
        
        // Verificar si el nombre ya existe (excluyendo el diseño actual)
        if (existingDesign?.name.toLowerCase() !== editingName.trim().toLowerCase()) {
          const nameAlreadyExists = await nameExists(editingName.trim(), editingDesignId);
          if (nameAlreadyExists) {
            setMessage({ type: 'error', text: 'Ya existe un diseño con ese nombre' });
            return;
          }
        }
        
        const designToUpdate = {
          id: editingDesignId,
          ...designToSave,
          createdAt: existingDesign?.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now()
        } as MapDesign;
        await saveDesign(designToUpdate);
        setMessage({ type: 'success', text: 'Diseño actualizado exitosamente' });
      } else {
        // Verificar si el nombre ya existe para nuevos diseños
        const nameAlreadyExists = await nameExists(editingName.trim());
        if (nameAlreadyExists) {
          setMessage({ type: 'error', text: 'Ya existe un diseño con ese nombre' });
          return;
        }
        
        // Crear nuevo diseño con timestamps
        const newDesign = {
          ...designToSave,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        } as MapDesign;
        
        await saveDesign(newDesign);
        setMessage({ type: 'success', text: 'Diseño guardado exitosamente' });
      }
      
      setSaveMode(false);
      setEditingName('');
      setEditingDescription('');
      setEditingDesignId(null);
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al guardar el diseño' });
    } finally {
      setSaving(false);
    }
  };

  // Función para cargar un diseño
  const handleLoadDesign = async (design: MapDesign) => {
    try {
      onLoadDesign(design);
      onClose();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar el diseño' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Función para eliminar un diseño
  const handleDeleteDesign = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el diseño "${name}"?`)) {
      return;
    }

    try {
      await deleteDesign(id);
      setMessage({ type: 'success', text: 'Diseño eliminado exitosamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      if (err.message.includes('recrean automáticamente')) {
        setMessage({ 
          type: 'error', 
          text: '⚠️ Problema de configuración de Firebase detectado. Los diseños se recrean automáticamente. Contacta al administrador para revisar Firebase Functions o reglas de seguridad.'
        });
        // Mantener el mensaje por más tiempo para este error específico
        setTimeout(() => setMessage(null), 10000);
      } else {
        setMessage({ type: 'error', text: 'Error al eliminar el diseño' });
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  // Función para editar un diseño existente
  const handleEditDesign = (design: MapDesign) => {
    setEditingDesignId(design.id || null);
    setEditingName(design.name);
    setEditingDescription(design.description || '');
    setSaveMode(true);
  };

  // Función para cancelar la edición
  const handleCancelEdit = () => {
    setSaveMode(false);
    setEditingName('');
    setEditingDescription('');
    setEditingDesignId(null);
  };

  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Gestión de Diseños de Mapa</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-brand-700 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
          {/* Save Design Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingDesignId ? 'Actualizar Diseño Existente' : 'Guardar Diseño Actual'}
              </h3>
              {!saveMode && (
                <button
                  onClick={() => setSaveMode(true)}
                  className="bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Nuevo Diseño
                </button>
              )}
            </div>

            {saveMode && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Diseño *
                    </label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-black dark:text-black bg-white dark:bg-white"
                      placeholder="Ej: Diseño Principal"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-black dark:text-black bg-white dark:bg-white"
                      placeholder="Describe brevemente este diseño..."
                      rows={3}
                      maxLength={200}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDesign}
                      disabled={saving || !editingName.trim()}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Save size={16} />
                      {saving ? (editingDesignId ? 'Actualizando...' : 'Guardando...') : (editingDesignId ? 'Actualizar Diseño' : 'Guardar Diseño')}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Saved Designs List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Diseños Guardados</h3>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-2"></div>
                Cargando diseños...
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <AlertCircle size={24} className="mx-auto mb-2" />
                {error}
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen size={24} className="mx-auto mb-2" />
                No hay diseños guardados
              </div>
            ) : (
              <div className="grid gap-4">
                {designs.map((design, index) => (
                  <div
                    key={`${design.id || 'new'}-${index}`}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">{design.name}</h4>
                        {design.description && (
                          <p className="text-sm text-gray-600 mb-2">{design.description}</p>
                        )}
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Áreas: {design.areas.length}</p>
                          <p>Creado: {design.createdAt.toDate().toLocaleDateString()}</p>
                          <p>Actualizado: {design.updatedAt.toDate().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleLoadDesign(design)}
                          className="bg-brand-600 text-white p-2 rounded-md hover:bg-brand-700 transition-colors"
                          title="Cargar diseño"
                        >
                          <FolderOpen size={16} />
                        </button>
                        <button
                          onClick={() => handleEditDesign(design)}
                          className="bg-orange-600 text-white p-2 rounded-md hover:bg-orange-700 transition-colors"
                          title="Actualizar diseño"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => design.id && handleDeleteDesign(design.id, design.name)}
                          className="bg-red-600 text-white p-2 rounded-md hover:bg-red-700 transition-colors"
                          title="Eliminar diseño"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
