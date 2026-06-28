import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { ReglaAsignacion } from '../utils/RuleEngine';
import { RuleEngine } from '../utils/RuleEngine';

export const useRules = () => {
  const [rules, setRules] = useState<ReglaAsignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<{id: string; name: string}[]>([]);
  const [subzones, setSubzones] = useState<{id: string; name: string; zonaId: string; capacidadMaxima?: number | null}[]>([]);

  const sortRulesByPriority = (rulesToSort: ReglaAsignacion[]) =>
    [...rulesToSort].sort((a, b) => a.prioridad - b.prioridad);

  const getSubzoneKey = (zoneId?: string, subzoneName?: string) =>
    `${zoneId || ''}:${subzoneName || ''}`;

  const ensureSingleDefaultRule = async (rulesToNormalize: ReglaAsignacion[]) => {
    const rulesCollection = collection(db, 'reglas_asignacion');
    const defaultRules = rulesToNormalize.filter(rule => rule.esDefecto);

    if (defaultRules.length === 0) {
      const fallbackRule = RuleEngine.getReglasPorDefecto()[0];
      const docRef = await addDoc(rulesCollection, fallbackRule);
      return [...rulesToNormalize, { ...fallbackRule, id: docRef.id }];
    }

    if (defaultRules.length > 1) {
      const [defaultRuleToKeep, ...defaultRulesToDelete] = defaultRules;
      await Promise.all(defaultRulesToDelete.map(rule => deleteDoc(doc(db, 'reglas_asignacion', rule.id))));
      return rulesToNormalize.filter(rule => !rule.esDefecto || rule.id === defaultRuleToKeep.id);
    }

    return rulesToNormalize;
  };

  // Cargar zonas y subzonas desde Firebase
  const loadZonesAndSubzones = async () => {
    try {
      // Cargar zonas
      const zonesSnapshot = await getDocs(collection(db, 'zonas'));
      const zonesList = zonesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.nombre || data.name || doc.id
        };
      });
      setZones(zonesList);

      // Cargar subzonas con su zonaId
      const subzonesSnapshot = await getDocs(collection(db, 'subzonas'));
      const subzonesList = subzonesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.nombre || data.name || doc.id,
          zonaId: data.zonaId || '',
          capacidadMaxima: data.capacidadMaxima ?? null
        };
      });
      setSubzones(subzonesList);

    } catch (error) {
      console.error('Error cargando zonas y subzonas:', error);
    }
  };

  // Obtener subzonas para una zona específica
  const getSubzonesForZone = (zoneId: string) => {
    return subzones.filter(subzone => subzone.zonaId === zoneId);
  };

  const syncDefaultSubzone = async (zoneId: string, selectedSubzoneName: string) => {
    const subzonasSnapshot = await getDocs(collection(db, 'subzonas'));
    const batch = writeBatch(db);

    subzonasSnapshot.docs.forEach((subzonaDoc) => {
      const data = subzonaDoc.data();
      const subzoneName = data.nombre || data.name || subzonaDoc.id;
      const isDefaultSubzone = data.zonaId === zoneId && (subzoneName === selectedSubzoneName || subzonaDoc.id === selectedSubzoneName);
      batch.update(subzonaDoc.ref, {
        default: isDefaultSubzone
      });
    });

    await batch.commit();
  };

  // Cargar reglas desde Firebase - SIN LOCAL STORAGE
  useEffect(() => {
    const fetchRules = async () => {
      try {
        setLoading(true);
        await loadZonesAndSubzones();
        
        const rulesCollection = collection(db, 'reglas_asignacion');
        const snapshot = await getDocs(rulesCollection);
        
        let finalRules: ReglaAsignacion[];
        
        if (snapshot.empty) {
          const defaultRules = RuleEngine.getReglasPorDefecto();
          await Promise.all(
            defaultRules.map(rule => addDoc(rulesCollection, rule))
          );
          finalRules = defaultRules;
        } else {
          finalRules = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as ReglaAsignacion));
        }
        
        setRules(sortRulesByPriority(await ensureSingleDefaultRule(finalRules)));
        setError(null);
      } catch (err) {
        console.error('Error cargando reglas:', err);
        setError('Error al cargar las reglas de asignación');
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []); // Solo se ejecuta al montar el componente

  // Guardar nueva regla
  const saveRule = async (rule: Omit<ReglaAsignacion, 'id'>) => {
    try {
      const rulesCollection = collection(db, 'reglas_asignacion');
      const docRef = await addDoc(rulesCollection, rule);
      const newRule = { ...rule, id: docRef.id };
      setRules(prev => sortRulesByPriority([...prev, newRule]));
      return newRule;
    } catch (err) {
      console.error('Error guardando regla:', err);
      throw new Error('Error al guardar la regla');
    }
  };

  // Actualizar regla existente
  const updateRule = async (id: string, rule: Partial<ReglaAsignacion>) => {
    try {
      const previousRule = rules.find(existingRule => existingRule.id === id);
      const ruleToUpdate = previousRule?.esDefecto
        ? { ...rule, esDefecto: true, condiciones: [], activa: true }
        : rule;
      const ruleRef = doc(db, 'reglas_asignacion', id);
      await updateDoc(ruleRef, ruleToUpdate);
      if (previousRule?.esDefecto && ruleToUpdate.acciones?.zona && ruleToUpdate.acciones?.subzona) {
        await syncDefaultSubzone(ruleToUpdate.acciones.zona, ruleToUpdate.acciones.subzona);
      }
      setRules(prev => sortRulesByPriority(prev.map(r => r.id === id ? { ...r, ...ruleToUpdate } : r)));
    } catch (err) {
      console.error('Error actualizando regla:', err);
      throw new Error('Error al actualizar la regla');
    }
  };

  // Eliminar regla
  const deleteRule = async (id: string) => {
    try {
      const ruleToDelete = rules.find(rule => rule.id === id);
      if (ruleToDelete?.esDefecto) {
        throw new Error('La regla por defecto no se puede eliminar');
      }

      const ruleRef = doc(db, 'reglas_asignacion', id);
      await deleteDoc(ruleRef);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error eliminando regla:', err);
      throw new Error('Error al eliminar la regla');
    }
  };

  // Reordenar reglas
  const reorderRules = async (reorderedRules: ReglaAsignacion[]) => {
    try {
      const batch = reorderedRules.map((rule, index) => 
        updateDoc(doc(db, 'reglas_asignacion', rule.id), { prioridad: index + 1 })
      );
      await Promise.all(batch);
      setRules(sortRulesByPriority(reorderedRules.map((rule, index) => ({
        ...rule,
        prioridad: index + 1
      }))));
    } catch (err) {
      console.error('Error reordenando reglas:', err);
      throw new Error('Error al reordenar las reglas');
    }
  };

  // Restaurar posicionamiento de productos
  const restoreDefaults = async () => {
    try {
      const productosCollection = collection(db, 'productos');
      const snapshot = await getDocs(productosCollection);
      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          zona: '',
          subzona: '',
          posicion: ''
        });
      });
      
      await batch.commit();
    } catch (err) {
      console.error('Error limpiando posicionamiento de productos:', err);
      throw new Error('Error al limpiar el posicionamiento de productos');
    }
  };

  // Aplicar reglas a todos los palets
  const applyRulesToAll = async () => {
    try {
      const productosCollection = collection(db, 'productos');
      const snapshot = await getDocs(productosCollection);
      
      if (snapshot.empty) {
        return { success: true, message: 'No hay productos para procesar', count: 0 };
      }

      const ruleEngine = new RuleEngine(rules);
      const defaultRule = rules.find(rule => rule.esDefecto);
      const defaultZone = defaultRule?.acciones.zona || 'expediciones';
      const defaultSubzone = defaultRule?.acciones.subzona || 'H';
      const subzoneCapacities = new Map(
        subzones
          .filter(subzone => typeof subzone.capacidadMaxima === 'number' && subzone.capacidadMaxima > 0)
          .map(subzone => [getSubzoneKey(subzone.zonaId, subzone.name), subzone.capacidadMaxima!])
      );
      const allocatedBySubzone = new Map<string, number>();
      let processedCount = 0;
      let overflowToDefaultCount = 0;
      const unpositionedProducts: any[] = [];
      
      const updatePromises = snapshot.docs.map(async (docSnap) => {
        const producto = { ...docSnap.data(), id: docSnap.id } as any;
        const resultado = ruleEngine.evaluarProducto(producto);
        
        if (resultado?.zona && resultado?.subzona) {
          let targetZone = resultado.zona;
          let targetSubzone = resultado.subzona;
          const targetKey = getSubzoneKey(targetZone, targetSubzone);
          const targetCapacity = subzoneCapacities.get(targetKey);
          const alreadyAllocated = allocatedBySubzone.get(targetKey) || 0;

          if (
            targetCapacity !== undefined &&
            alreadyAllocated >= targetCapacity &&
            getSubzoneKey(targetZone, targetSubzone) !== getSubzoneKey(defaultZone, defaultSubzone)
          ) {
            targetZone = defaultZone;
            targetSubzone = defaultSubzone;
            overflowToDefaultCount++;
          } else {
            allocatedBySubzone.set(targetKey, alreadyAllocated + 1);
          }

          const docRef = doc(db, 'productos', docSnap.id);
          await updateDoc(docRef, {
            subzona: targetSubzone,
            zona: targetZone
          });
          processedCount++;
        } else {
          unpositionedProducts.push(producto);
        }
        
        return resultado;
      });

      await Promise.all(updatePromises);

      
      const overflowMessage = overflowToDefaultCount > 0
        ? ' Espacio insuficiente en esta subzona, los elementos sobrantes han sido enviados a la zona asignada por defecto'
        : '';

      return { 
        success: true, 
        message: `Reglas aplicadas a ${processedCount} productos.${overflowMessage}`, 
        count: processedCount,
        total: snapshot.size
      };
      
    } catch (err) {
      console.error('Error aplicando reglas a todos los palets:', err);
      throw new Error('Error al aplicar reglas a todos los palets');
    }
  };

  // Aplicar reglas solo a nuevos palets
  const applyRulesToNew = () => {
    return { 
      success: true, 
      message: 'Modo activado: Las reglas se aplicarán solo a nuevos palets' 
    };
  };

  // Obtener modo de aplicación
  const getApplicationMode = (): 'all' | 'new_only' | 'both' => 'both';
  
  // Establecer modo de aplicación
  const setApplicationMode = (_mode: 'all' | 'new_only' | 'both') => {
  };

  // Función de migración para mover datos de reglas_asignacion_v2 a reglas_asignacion
  const migrateRules = async () => {
    try {
      // 1. Leer datos de reglas_asignacion_v2
      const v2Collection = collection(db, 'reglas_asignacion_v2');
      const v2Snapshot = await getDocs(v2Collection);
      
      if (v2Snapshot.empty) {
        return { success: false, message: 'No hay datos para migrar' };
      }
      
      const v2Rules = v2Snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as ReglaAsignacion));
      
      
      // 2. Borrar colección reglas_asignacion si existe
      const oldCollection = collection(db, 'reglas_asignacion');
      const oldSnapshot = await getDocs(oldCollection);
      
      if (!oldSnapshot.empty) {
        await Promise.all(oldSnapshot.docs.map(doc => deleteDoc(doc.ref)));
      }
      
      // 3. Mover datos a reglas_asignacion
      const newCollection = collection(db, 'reglas_asignacion');
      const migrationPromises = v2Rules.map(rule => {
        const { id, ...ruleData } = rule;
        return addDoc(newCollection, ruleData);
      });
      
      await Promise.all(migrationPromises);
      
      // 4. Borrar colección reglas_asignacion_v2
      await Promise.all(v2Snapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      // 5. Recargar reglas desde la nueva colección
      const newSnapshot = await getDocs(newCollection);
      const finalRules = newSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as ReglaAsignacion));
      
      setRules(finalRules);
      
      return { 
        success: true, 
        message: `Migración completada: ${v2Rules.length} reglas movidas` 
      };
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      return { 
        success: false, 
        message: `Error en migración: ${(error as Error).message}` 
      };
    }
  };

  // Función para importar reglas hardcodeadas
  const importHardcodedRules = async () => {
    try {
      // Definir las reglas hardcodeadas en formato del motor de reglas
      const hardcodedRules = [
        {
          nombre: "DUSCHOLUX y VICOMAM a Mamparista",
          prioridad: 1,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene" as const,
            valor: "DUSCHOLUX"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "Mamparista"
          }
        },
        {
          nombre: "VICOMAM a Mamparista",
          prioridad: 2,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "VICOMAM"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "Mamparista"
          }
        },
        {
          nombre: "CENTERGLAS a H",
          prioridad: 3,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "CENTERGLAS"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "H"
          }
        },
        {
          nombre: "REUGLAS a H",
          prioridad: 4,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "REUGLAS"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "H"
          }
        },
        {
          nombre: "NAVAS a H",
          prioridad: 5,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "NAVAS"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "H"
          }
        },
        {
          nombre: "MACRISAL a H",
          prioridad: 6,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "MACRISAL"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "H"
          }
        },
        {
          nombre: "DINOR a H",
          prioridad: 7,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "DINOR"
          }],
          acciones: {
            zona: "expediciones",
            subzona: "H"
          }
        },
        {
          nombre: "VALLIRANA a E (Corte)",
          prioridad: 8,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "VALLIRANA"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "ESPINOSA a E (Corte)",
          prioridad: 9,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "ESPINOSA"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "RETANA a E (Corte)",
          prioridad: 10,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "RETANA"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "TANCAMENTS a E (Corte)",
          prioridad: 11,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "TANCAMENTS"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "NOUTEC a E (Corte)",
          prioridad: 12,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "NOUTEC"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "ALGE a E (Corte)",
          prioridad: 13,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "ALGE"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "WINDGLASS a E (Corte)",
          prioridad: 14,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "WINDGLASS"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "ALVICAT a E (Corte)",
          prioridad: 15,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "ALVICAT"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "FENSTER a E (Corte)",
          prioridad: 16,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "FENSTER"
          }],
          acciones: {
            zona: "corte",
            subzona: "E"
          }
        },
        {
          nombre: "OTERO a D (CMS)",
          prioridad: 17,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "OTERO"
          }],
          acciones: {
            zona: "cms",
            subzona: "D"
          }
        },
        {
          nombre: "CLEMENTE a D (CMS)",
          prioridad: 18,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "CLEMENTE"
          }],
          acciones: {
            zona: "cms",
            subzona: "D"
          }
        },
        {
          nombre: "FORNES a D (CMS)",
          prioridad: 19,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "FORNES"
          }],
          acciones: {
            zona: "cms",
            subzona: "D"
          }
        },
        {
          nombre: "IBERPERFIL a F (Pulidoras)",
          prioridad: 20,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "IBERPERFIL"
          }],
          acciones: {
            zona: "pulidoras",
            subzona: "F"
          }
        },
        {
          nombre: "VALVERDE a F (Pulidoras)",
          prioridad: 21,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "VALVERDE"
          }],
          acciones: {
            zona: "pulidoras",
            subzona: "F"
          }
        },
        {
          nombre: "BARCELONA a C (Bilateral)",
          prioridad: 22,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "BARCELONA"
          }],
          acciones: {
            zona: "bilateral_taladros",
            subzona: "C"
          }
        },
        {
          nombre: "COMPANY a C (Bilateral)",
          prioridad: 23,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "COMPANY"
          }],
          acciones: {
            zona: "bilateral_taladros",
            subzona: "C"
          }
        },
        {
          nombre: "PONSETI a B (Taladros)",
          prioridad: 24,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "PONSETI"
          }],
          acciones: {
            zona: "bilateral_taladros",
            subzona: "B"
          }
        },
        {
          nombre: "ALMANSA a B (Taladros)",
          prioridad: 25,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "ALMANSA"
          }],
          acciones: {
            zona: "bilateral_taladros",
            subzona: "B"
          }
        },
        {
          nombre: "GLORIA a ?? (Horno)",
          prioridad: 26,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "GLORIA"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "VIELMAR a ?? (Horno)",
          prioridad: 27,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "VIELMAR"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "GUSTAMAN a ?? (Horno)",
          prioridad: 28,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "GUSTAMAN"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "MOLALUM a ?? (Horno)",
          prioridad: 29,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "MOLALUM"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "THERMIA a ?? (Horno)",
          prioridad: 30,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "THERMIA"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "FAURA a ?? (Horno)",
          prioridad: 31,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "FAURA"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "BUCH a ?? (Horno)",
          prioridad: 32,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "BUCH"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "MODUL a ?? (Horno)",
          prioridad: 33,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene",
            valor: "MODUL"
          }],
          acciones: {
            zona: "horno",
            subzona: "??"
          }
        },
        {
          nombre: "Clientes no reconocidos a A (Horno)",
          prioridad: 34,
          activa: true,
          condiciones: [{
            campo: "nombre_abreviado",
            operador: "contiene" as const,
            valor: "DUSCHOLUX,VICOMAM,CENTERGLAS,REUGLAS,NAVAS,MACRISAL,DINOR,VALLIRANA,ESPINOSA,RETANA,TANCAMENTS,NOUTEC,ALGE,WINDGLASS,ALVICAT,FENSTER,OTERO,CLEMENTE,FORNES,IBERPERFIL,VALVERDE,BARCELONA,COMPANY,PONSETI,ALMANSA,GLORIA,VIELMAR,GUSTAMAN,MOLALUM,THERMIA,FAURA,BUCH,MODUL"
          }],
          acciones: {
            zona: "horno",
            subzona: "A"
          }
        }
      ];

      // Borrar reglas existentes
      const rulesCollection = collection(db, 'reglas_asignacion');
      const snapshot = await getDocs(rulesCollection);
      await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));

      // Añadir las nuevas reglas hardcodeadas
      const savePromises = hardcodedRules.map(rule => {
        // Corregir el tipo de operador para que coincida con el esperado
        const correctedRule = {
          ...rule,
          condiciones: rule.condiciones.map(condicion => ({
            ...condicion,
            operador: condicion.operador as "contiene" | "igual" | "mayor" | "menor" | "entre"
          }))
        };
        return saveRule(correctedRule);
      });
      await Promise.all(savePromises);

      return { 
        success: true, 
        message: `Se han importado ${hardcodedRules.length} reglas hardcodeadas correctamente` 
      };
      
    } catch (error) {
      console.error('❌ Error importando reglas hardcodeadas:', error);
      return { 
        success: false, 
        message: `Error importando reglas: ${(error as Error).message}` 
      };
    }
  };

  return {
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
    subzones,
    getSubzonesForZone
  };
};