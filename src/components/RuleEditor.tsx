import { useState } from 'react';
import { Plus, Trash2, Edit, Save, X, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import type { ReglaAsignacion } from '../utils/RuleEngine';
import { useRules } from '../hooks/useRules';

const RuleEditor = () => {
  const { 
    rules, 
    loading, 
    error, 
    saveRule, 
    updateRule, 
    deleteRule, 
    reorderRules, 
    restoreDefaults,
    applyRulesToAll,
    applyRulesToNew,
    getApplicationMode,
    setApplicationMode,
    migrateRules,
    importHardcodedRules,
    zones,
    getSubzonesForZone
  } = useRules();
  const [editingRule, setEditingRule] = useState<ReglaAsignacion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [applicationMode, setLocalApplicationMode] = useState<'all' | 'new_only' | 'both'>(getApplicationMode());

  // Formulario para nueva regla
  const [newRule, setNewRule] = useState<Partial<ReglaAsignacion>>({
    nombre: '',
    prioridad: rules.length + 1,
    activa: true,
    condiciones: [{
      campo: 'nombre_abreviado',
      operador: 'contiene',
      valor: ''
    }],
    acciones: {
      zona: 'expediciones',
      subzona: 'H'
    }
  });

  // Mover regla hacia arriba o abajo
  const moveRule = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newRules.length) {
      [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];
      
      // Actualizar prioridades
      const reorderedRules = newRules.map((rule, idx) => ({
        ...rule,
        prioridad: idx + 1
      }));
      
      await reorderRules(reorderedRules);
    }
  };

  // Guardar nueva regla
  const handleSaveRule = async () => {
    try {
      if (!newRule.nombre || newRule.nombre.trim() === '') {
        alert('El nombre de la regla es obligatorio');
        return;
      }
      
      await saveRule(newRule as ReglaAsignacion);
      setNewRule({
        nombre: '',
        prioridad: rules.length + 2,
        activa: true,
        condiciones: [{
          campo: 'nombre_abreviado',
          operador: 'contiene',
          valor: ''
        }],
        acciones: {
          zona: 'expediciones',
          subzona: 'H'
        }
      });
      setIsCreating(false);
    } catch (err) {
      alert('Error al guardar la regla');
    }
  };

  // Actualizar regla existente
  const handleUpdateRule = async () => {
    if (!editingRule) return;
    
    try {
      await updateRule(editingRule.id, editingRule);
      setEditingRule(null);
    } catch (err) {
      alert('Error al actualizar la regla');
    }
  };

  // Eliminar regla
  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    
    try {
      await deleteRule(id);
    } catch (err) {
      alert('Error al eliminar la regla');
    }
  };

  // Restaurar reglas por defecto
  const handleRestoreDefaults = async () => {
    if (!confirm('¿Estás seguro de restaurar las reglas por defecto? Se eliminarán todas las reglas actuales.')) return;
    
    try {
      await restoreDefaults();
    } catch (err) {
      alert('Error al restaurar las reglas por defecto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-4">Cargando reglas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ENCABEZADO Y BOTONERA ESTÁTICOS - ABSOLUTAMENTE FIJOS */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Editor de Reglas de Asignación</h1>
          <div className="flex gap-2">
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              <RotateCcw size={16} />
              Restaurar por Defecto
            </button>
            <button
              onClick={async () => {
                if (confirm('¿Estás seguro de migrar las reglas? Esto moverá todos los datos de reglas_asignacion_v2 a reglas_asignacion y borrará la colección v2.')) {
                  try {
                    const result = await migrateRules();
                    if (result.success) {
                      alert(`✅ ${result.message}`);
                    } else {
                      alert(`❌ ${result.message}`);
                    }
                  } catch (error) {
                    alert(`❌ Error: ${(error as Error).message}`);
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              <RotateCcw size={16} />
              Migrar Reglas
            </button>
            <button
              onClick={async () => {
                if (confirm('¿Estás seguro de importar las reglas hardcodeadas? Esto borrará todas las reglas existentes y añadirá las 34 reglas del sistema antiguo.')) {
                  try {
                    const result = await importHardcodedRules();
                    if (result.success) {
                      alert(`✅ ${result.message}`);
                    } else {
                      alert(`❌ ${result.message}`);
                    }
                  } catch (error) {
                    alert(`❌ Error: ${(error as Error).message}`);
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              <RotateCcw size={16} />
              Importar Reglas Hardcodeadas
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Plus size={16} />
              Nueva Regla
            </button>
          </div>
        </div>
      </div>

      {/* CONTENEDOR CON SCROLL SOLO PARA EL RESTO */}
      <div className="flex-1 overflow-y-auto scrollbar-vertical-custom p-6">
        {/* Formulario de nueva regla */}
        {isCreating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-4 text-black">Nueva Regla</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Nombre de la Regla</label>
                <input
                  type="text"
                  placeholder="Ej: Productos pesados a expediciones"
                  value={newRule.nombre}
                  onChange={(e) => setNewRule({...newRule, nombre: e.target.value})}
                  className="px-3 py-2 border rounded text-black w-full"
                />
                <p className="text-xs text-gray-600 mt-1">Nombre descriptivo para identificar la regla</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Zona de Destino</label>
                <select
                  value={newRule.acciones?.zona}
                  onChange={(e) => setNewRule({...newRule, acciones: {...newRule.acciones!, zona: e.target.value}})}
                  className="px-3 py-2 border rounded text-black w-full"
                >
                  <option value="">Selecciona una zona</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">Área donde se asignarán los productos</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Subzona Específica</label>
                <select
                  value={newRule.acciones?.subzona}
                  onChange={(e) => setNewRule({...newRule, acciones: {...newRule.acciones!, subzona: e.target.value}})}
                  className="px-3 py-2 border rounded text-black w-full"
                >
                  <option value="">Selecciona una subzona</option>
                  {newRule.acciones?.zona && getSubzonesForZone(newRule.acciones.zona).map((subzone: any) => (
                    <option key={subzone.id} value={subzone.id}>
                      {subzone.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">Ubicación exacta dentro de la zona</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-black mb-1">Condición:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={newRule.condiciones?.[0]?.campo}
                  onChange={(e) => setNewRule({
                    ...newRule, 
                    condiciones: [{...newRule.condiciones![0], campo: e.target.value}]
                  })}
                  className="px-3 py-2 border rounded text-black"
                >
                  <option value="nombre_abreviado">Nombre Abreviado</option>
                  <option value="peso_total_kg">Peso Total (kg)</option>
                  <option value="vidrio_simple">Vidrio Simple</option>
                  <option value="altura">Altura</option>
                  <option value="longitud">Longitud</option>
                  <option value="fecha_entrega">Fecha Entrega</option>
                </select>
                <select
                  value={newRule.condiciones?.[0]?.operador}
                  onChange={(e) => setNewRule({
                    ...newRule, 
                    condiciones: [{...newRule.condiciones![0], operador: e.target.value as any}]
                  })}
                  className="px-3 py-2 border rounded text-black"
                >
                  <option value="contiene">Contiene</option>
                  <option value="igual">Igual</option>
                  <option value="mayor">Mayor que</option>
                  <option value="menor">Menor que</option>
                  <option value="entre">Entre</option>
                </select>
                <input
                  type="text"
                  placeholder="Valor"
                  value={newRule.condiciones?.[0]?.valor as string || ''}
                  onChange={(e) => setNewRule({
                    ...newRule, 
                    condiciones: newRule.condiciones && newRule.condiciones.length > 0 
                      ? [{...newRule.condiciones[0], valor: e.target.value}]
                      : [{campo: 'nombre_abreviado', operador: 'contiene', valor: e.target.value}]
                  })}
                  className="px-3 py-2 border rounded text-black"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveRule}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <Save size={16} />
                Guardar
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                <X size={16} />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de reglas existentes */}
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={rule.id} className={`border rounded-lg p-4 ${rule.activa ? 'bg-white' : 'bg-gray-50'}`}>
              {editingRule?.id === rule.id ? (
                // Modo edición
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Nombre de la Regla</label>
                      <input
                        type="text"
                        placeholder="Ej: Productos pesados a expediciones"
                        value={editingRule.nombre}
                        onChange={(e) => setEditingRule({...editingRule, nombre: e.target.value})}
                        className="px-3 py-2 border rounded text-black w-full"
                      />
                      <p className="text-xs text-gray-600 mt-1">Nombre descriptivo para identificar la regla</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Zona de Destino</label>
                      <select
                        value={editingRule.acciones?.zona}
                        onChange={(e) => setEditingRule({...editingRule, acciones: {...editingRule.acciones!, zona: e.target.value}})}
                        className="px-3 py-2 border rounded text-black w-full"
                      >
                        <option value="">Selecciona una zona</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Área donde se asignarán los productos</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Subzona Específica</label>
                      <select
                        value={editingRule.acciones?.subzona}
                        onChange={(e) => setEditingRule({...editingRule, acciones: {...editingRule.acciones!, subzona: e.target.value}})}
                        className="px-3 py-2 border rounded text-black w-full"
                      >
                        <option value="">Selecciona una subzona</option>
                        {editingRule.acciones?.zona && getSubzonesForZone(editingRule.acciones.zona).map((subzone: any) => (
                          <option key={subzone.id} value={subzone.id}>
                            {subzone.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Ubicación exacta dentro de la zona</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <h4 className="font-medium md:col-span-3 text-black mb-1">Condición:</h4>
                    <select
                      value={editingRule.condiciones?.[0]?.campo}
                      onChange={(e) => setEditingRule({
                        ...editingRule, 
                        condiciones: [{...editingRule.condiciones![0], campo: e.target.value}]
                      })}
                      className="px-3 py-2 border rounded text-black"
                    >
                      <option value="nombre_abreviado">Nombre Abreviado</option>
                      <option value="peso_total_kg">Peso Total (kg)</option>
                      <option value="vidrio_simple">Vidrio Simple</option>
                      <option value="altura">Altura</option>
                      <option value="longitud">Longitud</option>
                      <option value="fecha_entrega">Fecha Entrega</option>
                    </select>
                    <select
                      value={editingRule.condiciones?.[0]?.operador}
                      onChange={(e) => setEditingRule({
                        ...editingRule, 
                        condiciones: [{...editingRule.condiciones![0], operador: e.target.value as any}]
                      })}
                      className="px-3 py-2 border rounded text-black"
                    >
                      <option value="contiene">Contiene</option>
                      <option value="igual">Igual</option>
                      <option value="mayor">Mayor que</option>
                      <option value="menor">Menor que</option>
                      <option value="entre">Entre</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Valor"
                      value={editingRule.condiciones?.[0]?.valor as string || ''}
                      onChange={(e) => setEditingRule({
                        ...editingRule, 
                        condiciones: [{...editingRule.condiciones![0], valor: e.target.value}]
                      })}
                      className="px-3 py-2 border rounded text-black"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateRule}
                      className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      <Save size={14} />
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingRule(null)}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      <X size={14} />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                // Modo visualización
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-black">{rule.nombre}</span>
                        <span className="text-sm text-gray-500">Prioridad: {rule.prioridad}</span>
                        <span className={`px-2 py-1 text-xs rounded ${rule.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {rule.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <strong>Condición:</strong> {rule.condiciones[0]?.campo} {rule.condiciones[0]?.operador} "{rule.condiciones[0]?.valor}"
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Acción:</strong> zona: {rule.acciones.zona}, subzona: {rule.acciones.subzona}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => moveRule(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => moveRule(index, 'down')}
                        disabled={index === rules.length - 1}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={() => setEditingRule(rule)}
                        className="p-1 text-blue-500 hover:text-blue-700"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {rules.length === 0 && !isCreating && (
          <div className="text-center py-8 text-gray-500">
            <p>No hay reglas configuradas.</p>
            <p>Crea tu primera regla para empezar a automatizar la asignación de palets.</p>
          </div>
        )}
        
        {/* Sección de aplicación de reglas */}
        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Aplicación de Reglas</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Modo de aplicación:</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setLocalApplicationMode('all');
                  setApplicationMode('all');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  applicationMode === 'all' 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="font-bold">Todos los palets</div>
                <div className="text-xs mt-1">Reposiciona todos los productos existentes</div>
              </button>
              
              <button
                onClick={() => {
                  setLocalApplicationMode('new_only');
                  setApplicationMode('new_only');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  applicationMode === 'new_only' 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : 'bg-white border-gray-300 text-gray-700 hover:border-green-300'
                }`}
              >
                <div className="font-bold">Solo nuevos palets</div>
                <div className="text-xs mt-1">Se aplica solo a productos nuevos</div>
              </button>
              
              <button
                onClick={() => {
                  setLocalApplicationMode('both');
                  setApplicationMode('both');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  applicationMode === 'both' 
                    ? 'bg-purple-500 border-purple-500 text-white' 
                    : 'bg-white border-gray-300 text-gray-700 hover:border-purple-300'
                }`}
              >
                <div className="font-bold">Ambos modos</div>
                <div className="text-xs mt-1">Aplica a todos y mantiene para nuevos</div>
              </button>
            </div>
          </div>
          
          <div className="flex gap-3">
            {applicationMode === 'all' && (
              <button
                onClick={async () => {
                  try {
                    const result = await applyRulesToAll();
                    alert(`✅ ${result.message}`);
                  } catch (error) {
                    alert(`❌ Error: ${(error as Error).message}`);
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold transition-colors"
              >
                Aplicar a Todos los Palets
              </button>
            )}
            
            {applicationMode === 'new_only' && (
              <button
                onClick={() => {
                  try {
                    const result = applyRulesToNew();
                    alert(`✅ ${result.message}`);
                  } catch (error) {
                    alert(`❌ Error: ${(error as Error).message}`);
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold transition-colors"
              >
                Activar Modo Nuevos Palets
              </button>
            )}
            
            {applicationMode === 'both' && (
              <div className="flex gap-3 flex-1">
                <button
                  onClick={async () => {
                    try {
                      const result = await applyRulesToAll();
                      alert(`✅ ${result.message}`);
                    } catch (error) {
                      alert(`❌ Error: ${(error as Error).message}`);
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold transition-colors"
                >
                  Aplicar a Todos
                </button>
                <button
                  onClick={() => {
                    try {
                      const result = applyRulesToNew();
                      alert(`✅ ${result.message}`);
                    } catch (error) {
                      alert(`❌ Error: ${(error as Error).message}`);
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold transition-colors"
                >
                  Activar para Nuevos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleEditor;