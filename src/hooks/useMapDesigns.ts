import { useState, useEffect } from 'react';
import { mapDesignsService, type MapDesign } from '../services/mapDesignsService';

export interface UseMapDesignsReturn {
  designs: MapDesign[];
  loading: boolean;
  error: string | null;
  saveDesign: (design: MapDesign) => Promise<string>;
  loadDesign: (id: string) => Promise<MapDesign | null>;
  deleteDesign: (id: string) => Promise<void>;
  refreshDesigns: () => Promise<void>;
  nameExists: (name: string, excludeId?: string) => Promise<boolean>;
}

export const useMapDesigns = (): UseMapDesignsReturn => {
  const [designs, setDesigns] = useState<MapDesign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar todos los diseños
  const refreshDesigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const allDesigns = await mapDesignsService.getAllDesigns();
      setDesigns(allDesigns);
    } catch (err) {
      setError('Error al cargar los diseños');
      console.error('Error en refreshDesigns:', err);
    } finally {
      setLoading(false);
    }
  };

  // Guardar o actualizar un diseño
  const saveDesign = async (design: MapDesign): Promise<string> => {
    try {
      setError(null);
      let id: string;
      
      if (design.id) {
        // Actualizar diseño existente
        await mapDesignsService.updateDesign(design.id, design);
        id = design.id;
      } else {
        // Guardar nuevo diseño
        const designToSave = design as Omit<MapDesign, 'id' | 'createdAt' | 'updatedAt'>;
        id = await mapDesignsService.saveDesign(designToSave);
      }
      
      await refreshDesigns(); // Recargar la lista
      return id;
    } catch (err) {
      setError('Error al guardar el diseño');
      console.error('Error en saveDesign:', err);
      throw err;
    }
  };

  // Cargar un diseño específico
  const loadDesign = async (id: string): Promise<MapDesign | null> => {
    try {
      setError(null);
      const design = await mapDesignsService.getDesign(id);
      return design;
    } catch (err) {
      setError('Error al cargar el diseño');
      console.error('Error en loadDesign:', err);
      throw err;
    }
  };

  // Eliminar un diseño
  const deleteDesign = async (id: string): Promise<void> => {
    try {
      setError(null);
      console.log('Hook: Iniciando eliminación del diseño:', id);
      
      // Eliminar de Firebase primero
      await mapDesignsService.deleteDesign(id);
      
      // Luego actualizar el estado local con los datos de Firebase para asegurar consistencia
      const updatedDesigns = await mapDesignsService.getAllDesigns();
      console.log('Hook: Diseños actualizados desde Firebase:', updatedDesigns.map(d => ({ id: d.id, name: d.name })));
      console.log('Hook: Detalle completo de diseños desde Firebase:', updatedDesigns);
      
      // Verificar si el diseño eliminado todavía está ahí
      const deletedDesignStillExists = updatedDesigns.some(d => d.id === id);
      console.log('Hook: ¿El diseño eliminado todavía existe en Firebase?', deletedDesignStillExists);
      
      if (deletedDesignStillExists) {
        console.error('¡ERROR CRÍTICO! El diseño eliminado todavía existe en Firebase. Esto indica un problema de persistencia.');
      }
      
      setDesigns(updatedDesigns);
      console.log('Hook: Estado local actualizado');
    } catch (err) {
      setError('Error al eliminar el diseño');
      console.error('Error en deleteDesign:', err);
      // No recargar automáticamente para evitar bucles
      throw err;
    }
  };

  // Verificar si un nombre ya existe
  const nameExists = async (name: string, excludeId?: string): Promise<boolean> => {
    try {
      setError(null);
      return await mapDesignsService.nameExists(name, excludeId);
    } catch (err) {
      setError('Error al verificar el nombre');
      console.error('Error en nameExists:', err);
      return false;
    }
  };

  // Cargar diseños al montar el componente
  useEffect(() => {
    refreshDesigns();
  }, []);

  return {
    designs,
    loading,
    error,
    saveDesign,
    loadDesign,
    deleteDesign,
    refreshDesigns,
    nameExists
  };
};
