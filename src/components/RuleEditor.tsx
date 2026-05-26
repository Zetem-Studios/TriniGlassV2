import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Save, X, ChevronUp, ChevronDown, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import type { ReglaAsignacion } from '../utils/RuleEngine';
import { useRules } from '../hooks/useRules';
import { db } from '../firebase';

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
    zones,
    getSubzonesForZone
  } = useRules();
  const [editingRule, setEditingRule] = useState<ReglaAsignacion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [applicationMode, setLocalApplicationMode] = useState<'all' | 'new_only' | 'both'>(getApplicationMode());
  const [isApplyingAllRules, setIsApplyingAllRules] = useState(false);
  const [isApplyingNewRules, setIsApplyingNewRules] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [productFields, setProductFields] = useState<string[]>([]);
  const [productFieldTypes, setProductFieldTypes] = useState<Record<string, string>>({});
  const conditionFieldOptions = Array.from(
    new Set([
      ...productFields,
      ...rules.flatMap(rule => rule.condiciones.map(condition => condition.campo).filter(Boolean))
    ])
  ).sort((a, b) => a.localeCompare(b));

  // Formulario para nueva regla
  const [newRule, setNewRule] = useState<Partial<ReglaAsignacion>>({
    nombre: '',
    prioridad: rules.length + 1,
    activa: true,
    condiciones: [{
      campo: '',
      operador: 'contiene',
      valor: ''
    }],
    acciones: {
      zona: 'expediciones',
      subzona: 'H'
    }
  });

  const createEmptyCondition = (): ReglaAsignacion['condiciones'][number] => ({
    campo: conditionFieldOptions[0] || '',
    operador: 'contiene',
    valor: ''
  });

  const getFieldType = (field: string): 'number' | 'string' | 'date' => {
    const type = productFieldTypes[field];
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    const inferredType = inferFieldType(field, undefined);
    if (inferredType !== 'string') return inferredType;
    return 'string';
  };

  const getOperatorOptions = (field: string): { value: ReglaAsignacion['condiciones'][number]['operador']; label: string }[] => {
    const fieldType = getFieldType(field);

    if (fieldType === 'number') {
      return [
        { value: 'igual', label: '=' },
        { value: 'menor', label: '<' },
        { value: 'mayor', label: '>' },
        { value: 'menor_igual', label: '=<' },
        { value: 'mayor_igual', label: '=>' },
        { value: 'entre', label: 'Rango' }
      ];
    }

    if (fieldType === 'date') {
      return [
        { value: 'fecha_antes', label: 'Antes de' },
        { value: 'fecha_despues', label: 'Después de' },
        { value: 'fecha_entre', label: 'Entre' }
      ];
    }

    return [
      { value: 'igual', label: 'Igual a' },
      { value: 'contiene', label: 'Contiene la cadena' }
    ];
  };

  const getValidOperator = (
    field: string,
    operator: ReglaAsignacion['condiciones'][number]['operador']
  ): ReglaAsignacion['condiciones'][number]['operador'] => {
    const options = getOperatorOptions(field);
    return options.some(option => option.value === operator) ? operator : options[0].value;
  };

  const getRangeValues = (value: ReglaAsignacion['condiciones'][number]['valor']) => {
    const [from = '', to = ''] = Array.isArray(value)
      ? value.map(item => String(item))
      : String(value || '').split(';');

    return { from, to };
  };

  function inferFieldType(field: string, value: unknown): 'number' | 'string' | 'date' {
    const normalizedField = field.toLowerCase();
    if (normalizedField.includes('fecha')) return 'date';
    if (value instanceof Date || (value && typeof value === 'object' && typeof (value as any).toDate === 'function')) return 'date';

    if (
      normalizedField.includes('peso') ||
      normalizedField.endsWith('_kg') ||
      normalizedField.includes('altura') ||
      normalizedField.includes('longitud') ||
      normalizedField.includes('ancho') ||
      normalizedField.includes('cantidad') ||
      normalizedField.includes('dias')
    ) {
      return 'number';
    }

    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && value.trim() !== '') {
      const numericValue = Number(value.trim().replace(',', '.'));
      if (!Number.isNaN(numericValue)) return 'number';
    }

    return 'string';
  }

  const mergeFieldType = (
    currentType: string | undefined,
    nextType: 'number' | 'string' | 'date'
  ) => {
    if (currentType === 'date' || nextType === 'date') return 'date';
    if (currentType === 'number' || nextType === 'number') return 'number';
    return nextType;
  };

  const updateRangeValue = (
    currentValue: ReglaAsignacion['condiciones'][number]['valor'],
    side: 'from' | 'to',
    value: string
  ) => {
    const rangeValues = getRangeValues(currentValue);
    const nextRangeValues = {
      ...rangeValues,
      [side]: value
    };

    return `${nextRangeValues.from};${nextRangeValues.to}`;
  };

  useEffect(() => {
    const loadProductFields = async () => {
      try {
        const productosQuery = query(collection(db, 'productos'), limit(25));
        const snapshot = await getDocs(productosQuery);
        const fields = Array.from(
          new Set(snapshot.docs.flatMap(docSnap => Object.keys(docSnap.data())))
        ).sort((a, b) => a.localeCompare(b));
        const fieldTypes = snapshot.docs.reduce<Record<string, string>>((types, docSnap) => {
          Object.entries(docSnap.data()).forEach(([field, value]) => {
            if (value !== null && value !== undefined) {
              types[field] = mergeFieldType(types[field], inferFieldType(field, value));
            }
          });

          return types;
        }, {});

        setProductFields(fields);
        setProductFieldTypes(fieldTypes);
      } catch (error) {
        console.error('Error cargando atributos de productos:', error);
      }
    };

    loadProductFields();
  }, []);

  useEffect(() => {
    if (Object.keys(productFieldTypes).length === 0) return;

    setNewRule(currentRule => ({
      ...currentRule,
      condiciones: currentRule.condiciones?.map(condition => ({
        ...condition,
        operador: getValidOperator(condition.campo, condition.operador)
      }))
    }));

    setEditingRule(currentRule => currentRule
      ? {
          ...currentRule,
          condiciones: currentRule.condiciones.map(condition => ({
            ...condition,
            operador: getValidOperator(condition.campo, condition.operador)
          }))
        }
      : currentRule
    );
  }, [productFieldTypes]);

  const updateNewRuleCondition = (index: number, field: keyof ReglaAsignacion['condiciones'][number], value: string) => {
    const condiciones = [...(newRule.condiciones && newRule.condiciones.length > 0 ? newRule.condiciones : [createEmptyCondition()])];
    const nextCondition = {
      ...condiciones[index],
      [field]: field === 'operador' ? value as ReglaAsignacion['condiciones'][number]['operador'] : value
    };
    condiciones[index] = {
      ...nextCondition,
      operador: getValidOperator(nextCondition.campo, nextCondition.operador)
    };
    setNewRule({ ...newRule, condiciones });
  };

  const addNewRuleCondition = () => {
    setNewRule({
      ...newRule,
      condiciones: [...(newRule.condiciones || []), createEmptyCondition()]
    });
  };

  const removeNewRuleCondition = (index: number) => {
    const condiciones = (newRule.condiciones || []).filter((_, conditionIndex) => conditionIndex !== index);
    setNewRule({ ...newRule, condiciones: condiciones.length > 0 ? condiciones : [createEmptyCondition()] });
  };

  const updateEditingRuleCondition = (index: number, field: keyof ReglaAsignacion['condiciones'][number], value: string) => {
    if (!editingRule) return;
    const condiciones = [...(editingRule.condiciones && editingRule.condiciones.length > 0 ? editingRule.condiciones : [createEmptyCondition()])];
    const nextCondition = {
      ...condiciones[index],
      [field]: field === 'operador' ? value as ReglaAsignacion['condiciones'][number]['operador'] : value
    };
    condiciones[index] = {
      ...nextCondition,
      operador: getValidOperator(nextCondition.campo, nextCondition.operador)
    };
    setEditingRule({ ...editingRule, condiciones });
  };

  const addEditingRuleCondition = () => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      condiciones: [...(editingRule.condiciones || []), createEmptyCondition()]
    });
  };

  const removeEditingRuleCondition = (index: number) => {
    if (!editingRule) return;
    const condiciones = (editingRule.condiciones || []).filter((_, conditionIndex) => conditionIndex !== index);
    setEditingRule({ ...editingRule, condiciones: condiciones.length > 0 ? condiciones : [createEmptyCondition()] });
  };

  const normalizeRuleDecimalValues = (rule: ReglaAsignacion): ReglaAsignacion => ({
    ...rule,
    condiciones: rule.condiciones.map(condition => ({
      ...condition,
      valor: typeof condition.valor === 'string' && /^\s*-?\d+,\d+\s*$/.test(condition.valor)
        ? condition.valor.trim().replace(',', '.')
        : condition.valor
    }))
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
      
      await saveRule(normalizeRuleDecimalValues(newRule as ReglaAsignacion));
      setNewRule({
        nombre: '',
        prioridad: rules.length + 2,
        activa: true,
        condiciones: [{
          campo: conditionFieldOptions[0] || '',
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
      await updateRule(editingRule.id, normalizeRuleDecimalValues(editingRule));
      setEditingRule(null);
    } catch (err) {
      alert('Error al actualizar la regla');
    }
  };

  const handleToggleRuleActive = async (rule: ReglaAsignacion) => {
    if (rule.esDefecto) return;

    try {
      setTogglingRuleId(rule.id);
      await updateRule(rule.id, { activa: !rule.activa });
    } catch (err) {
      alert('Error al cambiar el estado de la regla');
    } finally {
      setTogglingRuleId(null);
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

  // Restaurar posicionamiento de productos
  const handleRestoreDefaults = async () => {
    if (!confirm('¿Estás seguro de limpiar el posicionamiento de todos los productos? Las reglas no se eliminarán.')) return;
    
    try {
      await restoreDefaults();
    } catch (err) {
      alert('Error al limpiar el posicionamiento de los productos');
    }
  };

  const handleApplyRulesToAll = async () => {
    if (isApplyingAllRules) return;

    setIsApplyingAllRules(true);
    try {
      const result = await applyRulesToAll();
      alert(`✅ ${result.message}`);
    } catch (error) {
      alert(`❌ Error: ${(error as Error).message}`);
    } finally {
      setIsApplyingAllRules(false);
    }
  };

  const handleApplyRulesToNew = () => {
    if (isApplyingNewRules) return;

    setIsApplyingNewRules(true);
    try {
      const result = applyRulesToNew();
      alert(`✅ ${result.message}`);
    } catch (error) {
      alert(`❌ Error: ${(error as Error).message}`);
    } finally {
      setIsApplyingNewRules(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
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
              Restaurar posicionamiento
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600"
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
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-6">
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
                    <option key={subzone.id} value={subzone.name}>
                      {subzone.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">Ubicación exacta dentro de la zona</p>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-black">Condiciones:</h4>
                <button
                  type="button"
                  onClick={addNewRuleCondition}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  <Plus size={14} />
                  Añadir condición
                </button>
              </div>
              <div className="space-y-2">
                {(newRule.condiciones && newRule.condiciones.length > 0 ? newRule.condiciones : [createEmptyCondition()]).map((condition, conditionIndex) => (
                  <div key={conditionIndex} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <select
                      value={condition.campo}
                      onChange={(e) => updateNewRuleCondition(conditionIndex, 'campo', e.target.value)}
                      className="px-3 py-2 border rounded text-black"
                    >
                      <option value="">Selecciona un atributo</option>
                      {conditionFieldOptions.map(field => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                    <select
                      value={condition.operador}
                      onChange={(e) => updateNewRuleCondition(conditionIndex, 'operador', e.target.value)}
                      className="px-3 py-2 border rounded text-black"
                    >
                      {getOperatorOptions(condition.campo).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {condition.operador === 'entre' || condition.operador === 'fecha_entre' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type={condition.operador === 'fecha_entre' ? 'date' : 'number'}
                          placeholder="Desde"
                          value={getRangeValues(condition.valor).from}
                          onChange={(e) => updateNewRuleCondition(conditionIndex, 'valor', updateRangeValue(condition.valor, 'from', e.target.value))}
                          className="px-3 py-2 border rounded text-black"
                        />
                        <input
                          type={condition.operador === 'fecha_entre' ? 'date' : 'number'}
                          placeholder="Hasta"
                          value={getRangeValues(condition.valor).to}
                          onChange={(e) => updateNewRuleCondition(conditionIndex, 'valor', updateRangeValue(condition.valor, 'to', e.target.value))}
                          className="px-3 py-2 border rounded text-black"
                        />
                      </div>
                    ) : (
                      <input
                        type={
                          condition.operador === 'fecha_antes' || condition.operador === 'fecha_despues'
                            ? 'date'
                            : getFieldType(condition.campo) === 'number'
                              ? 'number'
                              : 'text'
                        }
                        placeholder="Valor"
                        value={condition.valor as string || ''}
                        onChange={(e) => updateNewRuleCondition(conditionIndex, 'valor', e.target.value)}
                        className="px-3 py-2 border rounded text-black"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeNewRuleCondition(conditionIndex)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={(newRule.condiciones?.length || 1) <= 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
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
                          <option key={subzone.id} value={subzone.name}>
                            {subzone.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Ubicación exacta dentro de la zona</p>
                    </div>
                  </div>
                  
                  {!editingRule.esDefecto && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-black">Condiciones:</h4>
                        <button
                          type="button"
                          onClick={addEditingRuleCondition}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          <Plus size={14} />
                          Añadir condición
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(editingRule.condiciones && editingRule.condiciones.length > 0 ? editingRule.condiciones : [createEmptyCondition()]).map((condition, conditionIndex) => (
                        <div key={conditionIndex} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                          <select
                            value={condition.campo}
                            onChange={(e) => updateEditingRuleCondition(conditionIndex, 'campo', e.target.value)}
                            className="px-3 py-2 border rounded text-black"
                          >
                            <option value="">Selecciona un atributo</option>
                            {conditionFieldOptions.map(field => (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            ))}
                          </select>
                          <select
                            value={condition.operador}
                            onChange={(e) => updateEditingRuleCondition(conditionIndex, 'operador', e.target.value)}
                            className="px-3 py-2 border rounded text-black"
                          >
                            {getOperatorOptions(condition.campo).map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {condition.operador === 'entre' || condition.operador === 'fecha_entre' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type={condition.operador === 'fecha_entre' ? 'date' : 'number'}
                                placeholder="Desde"
                                value={getRangeValues(condition.valor).from}
                                onChange={(e) => updateEditingRuleCondition(conditionIndex, 'valor', updateRangeValue(condition.valor, 'from', e.target.value))}
                                className="px-3 py-2 border rounded text-black"
                              />
                              <input
                                type={condition.operador === 'fecha_entre' ? 'date' : 'number'}
                                placeholder="Hasta"
                                value={getRangeValues(condition.valor).to}
                                onChange={(e) => updateEditingRuleCondition(conditionIndex, 'valor', updateRangeValue(condition.valor, 'to', e.target.value))}
                                className="px-3 py-2 border rounded text-black"
                              />
                            </div>
                          ) : (
                            <input
                              type={
                                condition.operador === 'fecha_antes' || condition.operador === 'fecha_despues'
                                  ? 'date'
                                  : getFieldType(condition.campo) === 'number'
                                    ? 'number'
                                    : 'text'
                              }
                              placeholder="Valor"
                              value={condition.valor as string || ''}
                              onChange={(e) => updateEditingRuleCondition(conditionIndex, 'valor', e.target.value)}
                              className="px-3 py-2 border rounded text-black"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeEditingRuleCondition(conditionIndex)}
                            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={(editingRule.condiciones?.length || 1) <= 1}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                        {rule.esDefecto && (
                          <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                            Por defecto
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <strong>Condiciones:</strong>
                        <div className="mt-1 space-y-1">
                          {rule.esDefecto ? (
                            <div>Posicionamiento de los palets que no tienen reglas de colocación asignadas, su zona o subzona asignada ya está llena o ha sido borrada</div>
                          ) : (
                            rule.condiciones.map((condition, conditionIndex) => (
                              <div key={conditionIndex}>
                                {conditionIndex + 1}. {condition.campo} {condition.operador} "{condition.valor}"
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Acción:</strong> zona: {rule.acciones.zona}, subzona: {rule.acciones.subzona}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => moveRule(index, 'up')}
                        disabled={index === 0 || rule.esDefecto}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => moveRule(index, 'down')}
                        disabled={index === rules.length - 1 || rule.esDefecto}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                      {!rule.esDefecto && (
                        <button
                          onClick={() => handleToggleRuleActive(rule)}
                          disabled={togglingRuleId === rule.id}
                          className={`p-1 disabled:opacity-40 ${
                            rule.activa
                              ? 'text-green-600 hover:text-green-800'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          title={rule.activa ? 'Desactivar regla' : 'Activar regla'}
                          aria-label={rule.activa ? 'Desactivar regla' : 'Activar regla'}
                        >
                          {rule.activa ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingRule(rule)}
                        className="p-1 text-brand-500 hover:text-brand-700"
                      >
                        <Edit size={16} />
                      </button>
                      {!rule.esDefecto && (
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
                    ? 'bg-brand-500 border-brand-500 text-white' 
                    : 'bg-white border-gray-300 text-gray-700 hover:border-brand-300'
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
                onClick={handleApplyRulesToAll}
                disabled={isApplyingAllRules}
                className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                  isApplyingAllRules
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isApplyingAllRules && (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                )}
                {isApplyingAllRules ? 'Aplicando reglas...' : 'Aplicar a Todos los Palets'}
              </button>
            )}
            
            {applicationMode === 'new_only' && (
              <button
                onClick={handleApplyRulesToNew}
                disabled={isApplyingNewRules}
                className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                  isApplyingNewRules
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isApplyingNewRules && (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                )}
                {isApplyingNewRules ? 'Activando...' : 'Activar Modo Nuevos Palets'}
              </button>
            )}
            
            {applicationMode === 'both' && (
              <div className="flex gap-3 flex-1">
                <button
                  onClick={handleApplyRulesToAll}
                  disabled={isApplyingAllRules}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                    isApplyingAllRules
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isApplyingAllRules && (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  )}
                  {isApplyingAllRules ? 'Aplicando...' : 'Aplicar a Todos'}
                </button>
                <button
                  onClick={handleApplyRulesToNew}
                  disabled={isApplyingNewRules}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                    isApplyingNewRules
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isApplyingNewRules && (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  )}
                  {isApplyingNewRules ? 'Activando...' : 'Activar para Nuevos'}
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
