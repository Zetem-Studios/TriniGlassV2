import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Check, MapPin, Layers, X } from 'lucide-react';
import { ZoneEditModal } from './ZoneEditModal';

// Definir interfaces localmente para evitar problemas de importación
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

interface ZoneManagerProps {
  onClose?: () => void;
}

export const ZoneManager: React.FC<ZoneManagerProps> = ({ onClose }) => {
  const [zonas, setZonas] = useState<(Zona & { subzonas: Subzona[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados para edición modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editType, setEditType] = useState<'zona' | 'subzona'>('zona');
  const [editingItem, setEditingItem] = useState<Zona | Subzona | null>(null);


  // Cargar zonas y subzonas y crear las faltantes directamente
  useEffect(() => {
    const loadAndCreateMissingZones = async () => {
      try {
        console.log('🔍 Verificando y creando zonas y subzonas faltantes...');
        
        // Importar funciones de Firebase
        const { db, collection, getDocs, doc, writeBatch, Timestamp, auth } = await import('../firebase');
        
        // Verificar autenticación
        const currentUser = auth.currentUser;
        console.log('👤 Usuario autenticado:', currentUser ? 'SÍ' : 'NO');
        if (currentUser) {
          console.log('📧 Email:', currentUser.email);
          console.log('🆔 UID:', currentUser.uid);
        } else {
          console.log('❌ No hay usuario autenticado - esto podría causar problemas de permisos');
        }
        
        // Definir todas las zonas y subzonas que deberían existir
        const allZonesData = [
          {
            id: 'expediciones',
            nombre: 'Expediciones',
            tipo: 'expedicion' as const,
            descripcion: 'Área de preparación y expedición de pedidos',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'H', nombre: 'H', color: '#EF4444' },
              { id: 'mamparista', nombre: 'Mamparista', color: '#F59E0B' }
            ]
          },
          {
            id: 'pulidoras',
            nombre: 'Pulidoras',
            tipo: 'produccion' as const,
            descripcion: 'Área de pulido de cristales',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'F', nombre: 'F', color: '#10B981' }
            ]
          },
          {
            id: 'corte',
            nombre: 'Corte',
            tipo: 'produccion' as const,
            descripcion: 'Área de corte de vidrio',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'E', nombre: 'E', color: '#3B82F6' }
            ]
          },
          {
            id: 'cms',
            nombre: 'CMS',
            tipo: 'produccion' as const,
            descripcion: 'Área de trabajo con máquinas CNC',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'D', nombre: 'D', color: '#8B5CF6' }
            ]
          },
          {
            id: 'bilateral_taladros',
            nombre: 'Bilateral/Taladros',
            tipo: 'produccion' as const,
            descripcion: 'Área de perforación y trabajo bilateral',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'C', nombre: 'C', color: '#EC4899' },
              { id: 'B', nombre: 'B', color: '#F97316' }
            ]
          },
          {
            id: 'horno',
            nombre: 'Horno',
            tipo: 'produccion' as const,
            descripcion: 'Área de templado y tratamiento térmico',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'A', nombre: 'A', color: '#06B6D4' },
              { id: 'temp', nombre: 'Templado', color: '#84CC16' }
            ]
          },
          {
            id: 'barnaglass',
            nombre: 'Barnaglass',
            tipo: 'produccion' as const,
            descripcion: 'Área de barnizado y acabados',
            capacidadMaxima: null,
            activa: true,
            subzonas: [
              { id: 'Bcnglss', nombre: 'Bcnglss', color: '#14B8A6' }
            ]
          }
        ];
        
        // Cargar datos existentes
        const zonasSnapshot = await getDocs(collection(db, 'zonas'));
        const subzonasSnapshot = await getDocs(collection(db, 'subzonas'));
        
        console.log(`📋 Encontradas ${zonasSnapshot.size} zonas existentes`);
        console.log(`📋 Encontradas ${subzonasSnapshot.size} subzonas existentes`);
        
        const existingZoneIds = new Set();
        const existingSubzoneIds = new Set();
        
        zonasSnapshot.forEach((doc) => existingZoneIds.add(doc.id));
        subzonasSnapshot.forEach((doc) => existingSubzoneIds.add(doc.id));
        
        // Identificar zonas y subzonas faltantes
        const missingZones = allZonesData.filter(zona => !existingZoneIds.has(zona.id));
        const allMissingSubzones: typeof allZonesData[0]['subzonas'] = [];
        
        allZonesData.forEach((zona) => {
          zona.subzonas.forEach((subzona) => {
            if (!existingSubzoneIds.has(subzona.id)) {
              allMissingSubzones.push(subzona);
            }
          });
        });
        
        console.log(`📊 Zonas faltantes: ${missingZones.length}`);
        console.log(`📍 Subzonas faltantes: ${allMissingSubzones.length}`);
        
        // Crear zonas y subzonas faltantes
        if (missingZones.length > 0 || allMissingSubzones.length > 0) {
          console.log('🔧 Creando zonas y subzonas faltantes...');
          
          const batch = writeBatch(db);
          const now = Timestamp.now();
          
          // Crear zonas faltantes
          missingZones.forEach((zonaData) => {
            console.log(`🏭 Creando zona: ${zonaData.nombre}`);
            
            const zonaRef = doc(db, 'zonas', zonaData.id);
            const zonaDoc = {
              id: zonaData.id,
              nombre: zonaData.nombre,
              tipo: zonaData.tipo,
              descripcion: zonaData.descripcion,
              capacidadMaxima: zonaData.capacidadMaxima,
              fechaCreacion: now,
              activa: zonaData.activa
            };
            
            batch.set(zonaRef, zonaDoc);
          });
          
          // Crear subzonas faltantes
          allMissingSubzones.forEach((subzonaData) => {
            console.log(`   📍 Creando subzona: ${subzonaData.nombre}`);
            
            // Encontrar a qué zona pertenece esta subzona
            const parentZone = allZonesData.find(zona => 
              zona.subzonas.some(sub => sub.id === subzonaData.id)
            );
            
            if (parentZone) {
              const subzonaRef = doc(db, 'subzonas', subzonaData.id);
              const subzonaDoc = {
                id: subzonaData.id,
                nombre: subzonaData.nombre,
                zonaId: parentZone.id,
                posiciones: [],
                capacidadMaxima: null,
                color: subzonaData.color,
                activa: true,
                fechaCreacion: now
              };
              
              batch.set(subzonaRef, subzonaDoc);
            }
          });
          
          // Ejecutar el batch
          console.log('🔄 Ejecutando batch de operaciones...');
          try {
            await batch.commit();
            console.log('✅ Zonas y subzonas faltantes creadas exitosamente');
          } catch (batchError: any) {
            console.error('❌ Error en batch.commit():', batchError);
            console.error('Código de error:', batchError.code);
            console.error('Mensaje de error:', batchError.message);
            throw batchError;
          }
          
          // Recargar los datos después de la creación
          const newZonasSnapshot = await getDocs(collection(db, 'zonas'));
          const newSubzonasSnapshot = await getDocs(collection(db, 'subzonas'));
          
          // Cargar datos actualizados
          const loadedZonas: (Zona & { subzonas: Subzona[] })[] = [];
          
          newZonasSnapshot.forEach((zonaDoc) => {
            const zonaData = zonaDoc.data() as Zona;
            const zonaSubzonas: Subzona[] = [];
            
            newSubzonasSnapshot.forEach((subzonaDoc) => {
              const subzonaData = subzonaDoc.data() as Subzona;
              if (subzonaData.zonaId === zonaData.id) {
                zonaSubzonas.push(subzonaData);
              }
            });
            
            loadedZonas.push({
              ...zonaData,
              subzonas: zonaSubzonas
            });
          });
          
          console.log(`📊 Total final: ${loadedZonas.length} zonas`);
          console.log(`📍 Total final: ${loadedZonas.reduce((total, zona) => total + zona.subzonas.length, 0)} subzonas`);
          
          setZonas(loadedZonas);
          setLoading(false);
          setError(null);
          showMessage('success', `✅ Se crearon ${missingZones.length} zonas y ${allMissingSubzones.length} subzonas. Total: ${loadedZonas.length} zonas`);
          
        } else {
          // Cargar datos existentes si no faltan
          const loadedZonas: (Zona & { subzonas: Subzona[] })[] = [];
          
          zonasSnapshot.forEach((zonaDoc) => {
            const zonaData = zonaDoc.data() as Zona;
            const zonaSubzonas: Subzona[] = [];
            
            subzonasSnapshot.forEach((subzonaDoc) => {
              const subzonaData = subzonaDoc.data() as Subzona;
              if (subzonaData.zonaId === zonaData.id) {
                zonaSubzonas.push(subzonaData);
              }
            });
            
            loadedZonas.push({
              ...zonaData,
              subzonas: zonaSubzonas
            });
          });
          
          console.log(`✅ Todas las zonas ya existen. Cargadas ${loadedZonas.length} zonas`);
          
          setZonas(loadedZonas);
          setLoading(false);
          setError(null);
          showMessage('success', `✅ Todas las zonas ya están configuradas (${loadedZonas.length} zonas)`);
        }
        
      } catch (error) {
        console.error('❌ Error al cargar/crear zonas:', error);
        setError('Error al cargar las zonas');
        setLoading(false);
        showMessage('error', 'Error al cargar las zonas - revisa la consola');
      }
    };

    loadAndCreateMissingZones();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Función auxiliar para manejar fechas de Firebase
  const formatDate = (fecha: any) => {
    if (!fecha) return 'N/A';
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate().toLocaleDateString();
    }
    if (fecha instanceof Date) {
      return fecha.toLocaleDateString();
    }
    return 'N/A';
  };

  // Funciones para Zonas
  const handleCreateZona = () => {
    setEditType('zona');
    setEditingItem(null);
    setEditModalOpen(true);
  };

  const handleEditZona = (zona: Zona & { subzonas: Subzona[] }) => {
    setEditType('zona');
    setEditingItem(zona);
    setEditModalOpen(true);
  };

  const handleSaveZona = async (data: Partial<Zona>) => {
    try {
      if (!data.nombre?.trim()) {
        showMessage('error', 'El nombre de la zona es obligatorio');
        return;
      }

      if (editingItem) {
        // Actualizar zona existente
        const { db, doc } = await import('../firebase');
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'zonas', editingItem.id), {
          ...data
        });
        
        setZonas(prev => prev.map(zona => 
          zona.id === editingItem.id ? { ...zona, ...data } : zona
        ));
        showMessage('success', 'Zona actualizada correctamente');
      } else {
        // Crear nueva zona
        const { db, doc, setDoc, Timestamp } = await import('../firebase');
        const nuevaZona: Zona = {
          id: `zona-${Date.now()}`,
          nombre: data.nombre!,
          tipo: data.tipo as 'produccion' | 'almacenamiento' | 'expedicion',
          descripcion: data.descripcion,
          capacidadMaxima: data.capacidadMaxima || null,
          activa: data.activa!,
          fechaCreacion: new Date()
        };
        
        await setDoc(doc(db, 'zonas', nuevaZona.id), {
          ...nuevaZona,
          fechaCreacion: Timestamp.now()
        });
        
        setZonas(prev => [...prev, { ...nuevaZona, subzonas: [] }]);
        showMessage('success', 'Zona creada correctamente');
      }
    } catch (err) {
      console.error('Error al guardar zona:', err);
      showMessage('error', 'Error al guardar la zona');
    }
  };

  const handleDeleteZona = async (zona: Zona & { subzonas: Subzona[] }) => {
    if (!confirm(`¿Estás seguro de eliminar la zona "${zona.nombre}"? También se eliminarán ${zona.subzonas.length} subzonas asociadas.`)) {
      return;
    }

    try {
      const { db, doc, writeBatch } = await import('../firebase');
      const batch = writeBatch(db);
      
      // Eliminar subzonas asociadas
      zona.subzonas.forEach(subzona => {
        batch.delete(doc(db, 'subzonas', subzona.id));
      });
      
      // Eliminar zona
      batch.delete(doc(db, 'zonas', zona.id));
      
      await batch.commit();
      
      setZonas(prev => prev.filter(z => z.id !== zona.id));
      showMessage('success', 'Zona eliminada correctamente');
    } catch (err) {
      console.error('Error al eliminar zona:', err);
      showMessage('error', 'Error al eliminar la zona');
    }
  };


  // Funciones para Subzonas
  const handleCreateSubzona = (zonaId: string) => {
    setEditType('subzona');
    setEditingItem(null);
    setEditModalOpen(true);
    // Guardar el zonaId para pasarlo al modal
    (window as any).tempZonaId = zonaId;
  };

  const handleEditSubzona = (subzona: Subzona) => {
    setEditType('subzona');
    setEditingItem(subzona);
    setEditModalOpen(true);
  };

  const handleSaveSubzona = async (data: Partial<Subzona>) => {
    try {
      if (!data.nombre?.trim() || !data.zonaId) {
        showMessage('error', 'El nombre y la zona son obligatorios');
        return;
      }

      if (editingItem && editingItem.id) {
        // Actualizar subzona existente
        const { db, doc } = await import('../firebase');
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'subzonas', editingItem.id), {
          ...data,
          color: '#6B7280', // Forzar color gris oscuro
          fechaModificacion: new Date()
        });
        
        setZonas(prev => prev.map(zona => 
          zona.id === data.zonaId
            ? {
                ...zona,
                subzonas: zona.subzonas.map(sub => 
                  sub.id === editingItem.id ? { ...sub, ...data, color: '#6B7280' } : sub
                )
              }
            : zona
        ));
        showMessage('success', 'Subzona actualizada correctamente');
      } else {
        // Crear nueva subzona
        const { db, doc, setDoc, Timestamp } = await import('../firebase');
        const nuevaSubzona: Subzona = {
          id: `subzona-${Date.now()}`,
          nombre: data.nombre!,
          zonaId: data.zonaId!,
          posiciones: [], // Se actualizará automáticamente desde el mapa
          capacidadMaxima: data.capacidadMaxima || null,
          color: '#6B7280', // Gris oscuro fijo para subzonas
          activa: data.activa!,
          fechaCreacion: new Date()
        };
        
        await setDoc(doc(db, 'subzonas', nuevaSubzona.id), {
          ...nuevaSubzona,
          fechaCreacion: Timestamp.now()
        });
        
        setZonas(prev => prev.map(zona => 
          zona.id === data.zonaId
            ? { ...zona, subzonas: [...zona.subzonas, nuevaSubzona] }
            : zona
        ));
        showMessage('success', 'Subzona creada correctamente');
      }
    } catch (err) {
      console.error('Error al guardar subzona:', err);
      showMessage('error', 'Error al guardar la subzona');
    }
  };

  const handleDeleteSubzona = async (subzona: Subzona) => {
    if (!confirm(`¿Estás seguro de eliminar la subzona "${subzona.nombre}"?`)) {
      return;
    }

    try {
      const { db, doc } = await import('../firebase');
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'subzonas', subzona.id));
      
      setZonas(prev => prev.map(zona => 
        zona.id === subzona.zonaId
          ? { ...zona, subzonas: zona.subzonas.filter(sub => sub.id !== subzona.id) }
          : zona
      ));
      
      showMessage('success', 'Subzona eliminada correctamente');
    } catch (err) {
      console.error('Error al eliminar subzona:', err);
      showMessage('error', 'Error al eliminar la subzona');
    }
  };


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Cargando zonas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden">
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
        <div className="p-6 overflow-y-auto flex-1">

          {error ? (
            <div className="text-center py-8 text-red-500">
              <AlertCircle size={24} className="mx-auto mb-2" />
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sección de Zonas */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <MapPin size={20} />
                    Zonas
                  </h3>
                  <button
                    onClick={handleCreateZona}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Nueva Zona
                  </button>
                </div>

                {/* Lista de Zonas */}
                <div className="space-y-3">
                  {zonas.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600">
                      <MapPin size={48} className="mx-auto mb-4 text-gray-400 dark:text-slate-500" />
                      <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No hay zonas configuradas</h4>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">Comienza creando tu primera zona para organizar el almacén</p>
                      <button
                        onClick={handleCreateZona}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                      >
                        <Plus size={20} />
                        Crear Primera Zona
                      </button>
                    </div>
                  ) : (
                    zonas.map((zona) => (
                    <div key={zona.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-800 dark:text-white">{zona.nombre}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              zona.tipo === 'produccion' ? 'bg-blue-100 text-blue-800' :
                              zona.tipo === 'almacenamiento' ? 'bg-green-100 text-green-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {zona.tipo}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              zona.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {zona.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          {zona.descripcion && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{zona.descripcion}</p>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                            <p>Capacidad: {zona.capacidadMaxima} posiciones</p>
                            <p>Subzonas: {zona.subzonas.length}</p>
                            <p>Creada: {formatDate(zona.fechaCreacion)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditZona(zona)}
                            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition-colors"
                            title="Editar zona"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteZona(zona)}
                            className="bg-red-600 text-white p-2 rounded-md hover:bg-red-700 transition-colors"
                            title="Eliminar zona"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Subzonas de esta zona */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Subzonas:</h5>
                          <button
                            onClick={() => handleCreateSubzona(zona.id)}
                            className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1 text-xs"
                          >
                            <Plus size={12} />
                            Nueva Subzona
                          </button>
                        </div>
                        {zona.subzonas.length > 0 ? (
                          <div className="pl-4 border-l-2 border-gray-200 dark:border-slate-600 space-y-2">
                            {zona.subzonas.map((subzona) => (
                              <div key={subzona.id} className="bg-gray-50 dark:bg-slate-700 rounded p-3">
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-gray-800 dark:text-white">{subzona.nombre}</span>
                                      <div 
                                        className="w-4 h-4 rounded-full border border-gray-300"
                                        style={{ backgroundColor: '#6B7280' }} // Color gris oscuro fijo
                                      ></div>
                                      <span className={`px-2 py-1 text-xs rounded-full ${
                                        subzona.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {subzona.activa ? 'Activa' : 'Inactiva'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      <p>Posiciones: {subzona.posiciones.length > 0 ? subzona.posiciones.join(', ') : 'Sin asignar'}</p>
                                      <p>Capacidad: {subzona.capacidadMaxima || 'Sin límite'}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditSubzona(subzona)}
                                      className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600 transition-colors"
                                      title="Editar subzona"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubzona(subzona)}
                                      className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors"
                                      title="Eliminar subzona"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-gray-50 dark:bg-slate-700 rounded text-sm text-gray-500 dark:text-gray-400">
                            No hay subzonas configuradas
                          </div>
                        )}
                      </div>
                    </div>
                  )))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal de edición */}
        <ZoneEditModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          editType={editType}
          item={editingItem || undefined}
          zonas={zonas}
          onSave={editType === 'zona' ? handleSaveZona : handleSaveSubzona}
          preselectedZonaId={(window as any).tempZonaId}
        />
      </div>
    </div>
  );
};
