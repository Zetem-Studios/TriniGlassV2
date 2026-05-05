// Warehouse2.tsx - Implementación dinámica sin hardcode
import { useState, useEffect } from "react";
import { 
  Search, Plus, ChevronDown, Check, X, Package, 
  Layers, Maximize2, View, Zap, DoorOpen, Box
} from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, writeBatch, doc, updateDoc, doc as firestoreDoc } from "firebase/firestore";
import Map from "./Map";
import Zone from "./Zone";
import RuleEditor from "./RuleEditor";
import { useMapDesigns } from '../hooks/useMapDesigns';

// Interfaces para tipado dinámico
interface ZoneConfig {
  id: string;
  name: string;
  subzones: { [key: string]: string[] };
  layout: 'horizontal' | 'vertical' | 'single';
}

interface Producto {
  codigo_barra?: string;
  fecha_linea_pedido?: unknown;
  fecha_entrega?: unknown;
  altura?: number;
  longitud?: number;
  peso_total_kg?: number;
  vidrio_simple?: boolean;
  subzona?: string;
  nombre_abreviado?: string;
  apellido_cliente?: string;
  [key: string]: unknown;
}

interface Block {
  id: string;
  codigo_barra: string;
  zoneId: string;
  area: string;
  type: string;
  daysInStorage: number;
  client: string;
  occupied: boolean;
  dimensions: string;
  weight: string;
  priority: string;
  lastUpdate: string;
  numeroCliente?: string;
  numeroLineaPedido?: string;
  estadoPedido?: string;
  empresa?: string;
  referencias?: string;
}

// Función para parsear fechas
const parseFechaLineaPedido = (fecha: unknown): Date | null => {
  if (!fecha) return null;

  const anyFecha = fecha as any;
  if (fecha instanceof Date) {
    return fecha;
  }

  if (typeof fecha === 'object' && anyFecha.toDate instanceof Function) {
    return anyFecha.toDate();
  }

  if (typeof fecha !== 'string') {
    const parsed = Date.parse(String(fecha));
    return isNaN(parsed) ? null : new Date(parsed);
  }

  const normalized = fecha
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const meses: { [key: string]: number } = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  const match = normalized.match(/(\d{1,2}) de (\w+) de (\d{4}) a las (\d{1,2}:\d{2}:\d{2})\s*([ap]\.m\.)\s*UTC\s*([+-]?\d+)/i);
  if (match) {
    const [, diaStr, mesStr, yearStr, horaStr, ampm, tz] = match;
    const dia = Number(diaStr);
    const mes = meses[mesStr.toLowerCase()];
    const year = Number(yearStr);
    if (mes === undefined || Number.isNaN(dia) || Number.isNaN(year)) return null;

    const hourParts = horaStr.split(':').map(Number);
    let hora = hourParts[0];
    const minuto = hourParts[1];
    const segundo = hourParts[2];
    if ([hora, minuto, segundo].some(val => Number.isNaN(val))) return null;

    const ampmNormalized = ampm.toLowerCase().replace(/\./g, '').trim();
    if ((ampmNormalized === 'p' || ampmNormalized === 'pm') && hora < 12) hora += 12;
    if ((ampmNormalized === 'a' || ampmNormalized === 'am') && hora === 12) hora = 0;

    const offset = Number(tz);
    if (Number.isNaN(offset)) return null;

    const utcMillis = Date.UTC(year, mes, dia, hora, minuto, segundo) - offset * 3600 * 1000;
    return new Date(utcMillis);
  }

  const parsed = Date.parse(normalized.replace('UTC', 'GMT'));
  return isNaN(parsed) ? null : new Date(parsed);
};

// Función para obtener zonas de Firebase
const getZones = async (): Promise<ZoneConfig[]> => {
  try {
    const zonesCollection = collection(db, "zonas");
    const snapshot = await getDocs(zonesCollection);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || doc.id,
        subzones: data.subzones || {},
        layout: data.layout || 'single'
      };
    });
  } catch (error) {
    console.error("Error cargando zonas:", error);
    return [];
  }
};

// Función para obtener reglas de asignación de Firebase
const getAssignmentRules = async (): Promise<any[]> => {
  try {
    const rulesCollection = collection(db, "assignment_rules");
    const snapshot = await getDocs(rulesCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error cargando reglas de asignación:", error);
    return [];
  }
};

// Función para mapear productos a bloques usando reglas dinámicas
const mapProductoToBlock = async (producto: Producto, rules: any[], index: number): Promise<Block> => {
  const fechaPedido = parseFechaLineaPedido(producto.fecha_linea_pedido);
  const hoy = new Date();
  let daysInStorage = 0;

  if (fechaPedido) {
    daysInStorage = Math.max(0, Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    console.warn(`⚠️ Fecha inválida para producto ${producto.codigo_barra || producto.id}`);
  }

  const tipoVidrio = producto.vidrio_simple ? "Vidrio Simple" : "Doble Acristalamiento";

  // Determinar prioridad según días en storage
  let priority = "Normal";
  if (daysInStorage > 30) priority = "Alta";
  else if (daysInStorage > 20) priority = "Media";

  // Aplicar reglas de asignación dinámicas
  let area = "";
  let zoneId = "";

  // Primero intentar usar subzona si existe
  if (typeof producto.subzona === "string" && producto.subzona.trim() !== "") {
    area = producto.subzona.trim();
    // Buscar zona correspondiente
    const zones = await getZones();
    const zonaEncontrada = zones.find(zone => 
      Object.keys(zone.subzones).includes(area)
    );
    if (zonaEncontrada) {
      zoneId = zonaEncontrada.id;
    }
  }

  // Si no hay subzona válida, aplicar reglas de asignación
  if (!area && rules.length > 0) {
    const nombre = producto.nombre_abreviado?.toUpperCase().trim() || "";
    
    // Buscar regla que coincida
    for (const rule of rules) {
      if (rule.type === 'client' && nombre.includes(rule.pattern)) {
        area = rule.subzone;
        zoneId = rule.zoneId;
        break;
      } else if (rule.type === 'default') {
        area = rule.subzone;
        zoneId = rule.zoneId;
      }
    }
  }

  // Fallback a valores por defecto si no hay reglas
  if (!area) {
    area = "H";
    zoneId = "expediciones";
  }

  console.log(`✅ ${producto.nombre_abreviado} (${producto.codigo_barra}) → Zona ${zoneId} / Subzona ${area}`);

  return {
    id: producto.id || `block-${index}`,
    codigo_barra: producto.codigo_barra || '',
    zoneId: zoneId,
    area: area,
    type: tipoVidrio,
    daysInStorage: daysInStorage,
    client: (producto.apellido_cliente as string) || (producto.nombre_abreviado as string) || "Cliente Desconocido",
    occupied: true,
    dimensions: `${producto.altura || 0} x ${producto.longitud || 0} mm`,
    weight: `${producto.peso_total_kg || 0} kg`,
    priority: priority,
    lastUpdate: (() => {
      const fechaEntregaDate = parseFechaLineaPedido(producto.fecha_entrega);
      if (fechaEntregaDate) return fechaEntregaDate.toLocaleDateString('es-ES');
      if (producto.fecha_entrega) {
        const fechaPlain = Date.parse(String(producto.fecha_entrega));
        if (!isNaN(fechaPlain)) return new Date(fechaPlain).toLocaleDateString('es-ES');
      }
      return "N/A";
    })(),
    numeroCliente: producto.numero_cliente as string,
    numeroLineaPedido: producto.numero_linea_pedido as string,
    estadoPedido: producto.estado_pedido as string,
    empresa: producto.empresa as string,
    referencias: producto.referencia_linea_pedido as string
  };
};

export default function Warehouse2() {
  const TEST_MODE = true;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isNewZoneModalOpen, setIsNewZoneModalOpen] = useState(false);
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPalletZone, setAddPalletZone] = useState<string | null>(null);
  const [addPalletSubzone, setAddPalletSubzone] = useState<string | null>(null);
  const [addPalletForm, setAddPalletForm] = useState<any>({
    codigo_barra: '',
    apellido_cliente: '',
    nombre_abreviado: '',
    altura: '',
    longitud: '',
    peso_total_kg: '',
    cantidad_encargada: 1,
    descripcion_producido_longitud: '',
    referencia_linea_pedido: '',
    fecha_entrega: '',
    fecha_linea_pedido: '',
    subzona: '',
  });
  const [addPalletLoading, setAddPalletLoading] = useState(false);
  const [addPalletError, setAddPalletError] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [selectedMapDesign, setSelectedMapDesign] = useState("default");
  const [isMapDesignDropdownOpen, setIsMapDesignDropdownOpen] = useState(false);
  const [assignmentRules, setAssignmentRules] = useState<any[]>([]);

  const { designs, loading: designsLoading, error: designsError } = useMapDesigns();

  // Cargar el mapa activo desde Firebase al montar el componente y cuando cambien los diseños
  useEffect(() => {
    // Solo ejecutar si los diseños están cargados
    if (!designsLoading && designs.length > 0) {
      loadActiveMapFromFirebase();
    }
  }, [designs, designsLoading]);

  // Función para cargar el mapa activo desde Firebase
  const loadActiveMapFromFirebase = () => {
    console.log('=== ESTADO DEL ATRIBUTO "activo" EN TODOS LOS DISEÑOS ===');
    designs.forEach(design => {
      console.log(`Mapa: ${design.name} | ID: ${design.id} | activo: ${design.activo}`);
    });
    console.log('================================================');
    
    // Buscar el mapa que tenga activo: true
    const activeMap = designs.find(design => design.activo === true);
    if (activeMap && activeMap.id) {
      console.log(`✅ Mapa activo encontrado: ${activeMap.name}`);
      setSelectedMapDesign(activeMap.id);
    } else {
      console.log('❌ No hay ningún mapa con activo: true');
    }
  };

  // Función para activar un mapa en Firebase (simultáneo)
  const activateMapInFirebase = async (mapId: string) => {
    try {
      // Crear un batch para actualizar todos los mapas simultáneamente
      const batch = writeBatch(db);
      const mapDesignsCollection = collection(db, 'mapDesigns');
      
      // Obtener todos los documentos de mapDesigns
      const querySnapshot = await getDocs(mapDesignsCollection);
      
      // Preparar todas las actualizaciones en el batch
      querySnapshot.forEach((docSnapshot) => {
        const docRef = doc(db, 'mapDesigns', docSnapshot.id);
        if (docSnapshot.id === mapId) {
          // Activar el mapa seleccionado
          batch.update(docRef, { activo: true });
        } else {
          // Desactivar todos los demás
          batch.update(docRef, { activo: false });
        }
      });
      
      // Ejecutar todas las actualizaciones simultáneamente
      await batch.commit();
      
    } catch (error) {
      console.error('Error al activar mapa en Firebase:', error);
    }
  };

  // Función para calcular el tamaño del mapa seleccionado basado en zonas extremas
  const calculateMapSize = () => {
    if (selectedMapDesign === "default") {
      return {
        totalSquaresWidth: 0,
        totalSquaresHeight: 0,
        description: "Diseño por defecto - sin tamaño definido"
      };
    }

    const selectedDesign = designs.find(d => d.id === selectedMapDesign);
    if (!selectedDesign || !selectedDesign.areas || selectedDesign.areas.length === 0) {
      return {
        totalSquaresWidth: 0,
        totalSquaresHeight: 0,
        description: "Diseño no encontrado o sin áreas"
      };
    }

    // Función auxiliar para convertir columna (A, B, C, ..., AA, AB) a número
    const colToNumber = (col: string): number => {
      let result = 0;
      for (let i = 0; i < col.length; i++) {
        result = result * 26 + (col.charCodeAt(i) - 64);
      }
      return result;
    };

    // Buscar la zona más desplazada hacia abajo (máxima fila)
    let maxRow = 0;
    let maxCol = 0;

    // Convertir de píxeles a coordenadas de cuadrícula usando GridSize
    const cellWidth = selectedDesign.gridSize?.cellWidth || 40;
    const cellHeight = selectedDesign.gridSize?.cellHeight || 40;

    // Analizar todas las áreas y subáreas
    selectedDesign.areas.forEach(area => {
      // Convertir coordenadas de píxeles a coordenadas de cuadrícula
      const gridRow = Math.floor(area.y / cellHeight) + 1;
      const gridCol = colToNumber(area.col); // area.col ya está en formato de letra
      const gridWidth = Math.floor(area.width / cellWidth);
      const gridHeight = Math.floor(area.height / cellHeight);
      
      // Calcular posición final en cuadrícula
      const areaEndRow = gridRow + gridHeight - 1;
      const areaEndCol = gridCol + gridWidth - 1;

      if (areaEndRow > maxRow) {
        maxRow = areaEndRow;
      }

      if (areaEndCol > maxCol) {
        maxCol = areaEndCol;
      }

      // También analizar subáreas
      if (area.subAreas && area.subAreas.length > 0) {
        area.subAreas.forEach(subArea => {
          const subGridRow = Math.floor(subArea.y / cellHeight) + 1;
          const subGridCol = colToNumber(subArea.col);
          const subGridWidth = Math.floor(subArea.width / cellWidth);
          const subGridHeight = Math.floor(subArea.height / cellHeight);
          
          const subAreaEndRow = subGridRow + subGridHeight - 1;
          const subAreaEndCol = subGridCol + subGridWidth - 1;

          if (subAreaEndRow > maxRow) {
            maxRow = subAreaEndRow;
          }

          if (subAreaEndCol > maxCol) {
            maxCol = subAreaEndCol;
          }
        });
      }
    });

    return {
      totalSquaresWidth: maxCol,
      totalSquaresHeight: maxRow,
      description: `Mapa: ${maxCol}x${maxRow} cuadrados`
    };
  };

  const handleEmptySlotClick = (zoneId: string, subzone: string) => {
    setAddPalletZone(zoneId);
    setAddPalletSubzone(subzone);
    setAddPalletForm((prev: any) => ({ ...prev, subzona: subzone }));
    setShowAddModal(true);
  };

  const handleAddPalletFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddPalletForm((prev: any) => ({ ...prev, [name]: value }));
  };

  // Cargar zonas y reglas de Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [zonesData, rulesData] = await Promise.all([
          getZones(),
          getAssignmentRules()
        ]);
        
        setZones(zonesData);
        setAssignmentRules(rulesData);
        
        // Seleccionar primera zona por defecto
        if (zonesData.length > 0) {
          setSelectedZone(zonesData[0].id);
        }
      } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        setError("Error al cargar configuración inicial");
      }
    };

    loadData();
  }, []);

  // Cargar productos desde Firebase
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        console.log("🔥 Iniciando conexión a Firebase...");
        
        const productosCollection = collection(db, "productos");
        const snapshot = await getDocs(productosCollection);
        
        console.log(`✅ Conexión exitosa. Documentos encontrados: ${snapshot.size}`);
        
        if (snapshot.size === 0) {
          console.warn("⚠️ La colección 'productos' está vacía");
          setError("La colección 'productos' está vacía");
          setBlocks([]);
          setLoading(false);
          return;
        }

        const docsToProcess = TEST_MODE ? snapshot.docs.slice(0, 200) : snapshot.docs;
        if (TEST_MODE) {
          console.log(`🧪 MODO TEST: Procesando solo los primeros ${docsToProcess.length} documentos`);
        }

        const productos = docsToProcess
          .map((doc, index) => {
            const data = doc.data() as any;
            return { ...data, id: doc.id, docIndex: index };
          });

        // Procesar productos de forma secuencial para evitar problemas con Promise
        const processedBlocks: Block[] = [];
        for (let i = 0; i < productos.length; i++) {
          const block = await mapProductoToBlock(productos[i], assignmentRules, i);
          processedBlocks.push(block);
        }
        setBlocks(processedBlocks);
        
        console.log(`✅ ${productos.length} productos mapeados correctamente`);
        setError(null);
      } catch (err) {
        console.error("❌ Error cargando productos:", err);
        setError(`Error: ${(err as Error).message}`);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    };

    if (zones.length > 0 && assignmentRules.length >= 0) {
      fetchProductos();
    }
  }, [zones, assignmentRules]);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length >= 3) {
      const foundBlock = blocks.find(b => 
        b.id.toLowerCase() === term || 
        (b.occupied && b.client.toLowerCase().includes(term))
      );

      if (foundBlock) {
        setSelectedZone(foundBlock.zoneId);
        setSelectedBlock(foundBlock);
      }
    }
  }, [searchTerm, blocks]);

  const handleZoneCreated = async (zoneId: string) => {
    try {
      const data = await getZones();
      setZones(data);
      setSelectedZone(zoneId.toLowerCase());
    } catch (error) {
      console.error("❌ Error refrescando zonas:", error);
      setError("Error al actualizar la lista de zonas");
    } finally {
      setIsNewZoneModalOpen(false);
    }
  };

  const handleAddPalletSave = async () => {
    try {
      setAddPalletLoading(true);
      setAddPalletError(null);
      // await addDoc(collection(db, 'productos'), addPalletForm);
      setShowAddModal(false);
      setSelectedBlock(null);
    } catch {
      setAddPalletError('Error al guardar el pallet');
    } finally {
      setAddPalletLoading(false);
    }
  };

  const renderBlock = (block: Block) => {
    const isSelected = selectedBlock?.id === block.id;
    let colors = "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-400";
    if (block.occupied) {
      if (block.daysInStorage > 30) colors = "bg-red-100 dark:bg-red-500/20 border-red-400 text-red-600";
      else if (block.daysInStorage > 20) colors = "bg-orange-100 dark:bg-orange-500/20 border-orange-400 text-orange-600";
      else if (block.daysInStorage > 10) colors = "bg-yellow-100 dark:bg-yellow-500/20 border-yellow-400 text-yellow-700 dark:text-yellow-500";
      else colors = "bg-blue-100 dark:bg-blue-500/20 border-blue-400 text-blue-600";
    }

    return (
      <button
        key={block.id}
        onClick={() => setSelectedBlock(block)}
        className={`rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 shadow-sm shrink-0 ${colors} ${isSelected ? 'ring-4 ring-cyan-500 scale-110 z-10' : 'hover:scale-105'} min-w-[105px] min-h-[80px]`}
      >
        {block.occupied ? (
          <>
            <span className="text-[11px] font-black tracking-tighter uppercase">{block.id}</span>
            <Box size={14} strokeWidth={2.5} />
          </>
        ) : (
          <span className="text-[10px] font-bold tracking-tight uppercase opacity-50">Vacío</span>
        )}
      </button>
    );
  };

  const renderArea = (areaName: string, zone: ZoneConfig) => {
    const areaBlocks = blocks.filter(b => b.area === areaName && (selectedZone === zone.id));
    if (areaBlocks.length === 0) return null;
    
    return (
      <div key={areaName} className="flex flex-col gap-4 min-w-max">
        <h3 className="font-black text-slate-400 dark:text-slate-500 uppercase text-xs tracking-[0.4em] text-center">{areaName}</h3>
        <div className={`grid grid-cols-3 gap-2.5 p-6 bg-white dark:bg-slate-900/40 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl shrink-0`}>
          {areaBlocks.map(b => renderBlock(b))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white transition-colors duration-300 font-sans">
      
      {loading && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-2xl">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-bold text-slate-700 dark:text-white">Cargando productos...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-6 py-4 rounded-2xl m-6 flex items-center gap-3">
          <X size={24} strokeWidth={3} />
          <div>
            <p className="font-bold">Error al cargar datos</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!loading && blocks.length > 0 && (
        <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 px-6 py-4 rounded-2xl m-6">
          <p className="font-bold text-blue-700 dark:text-blue-200">
            ✅ {blocks.length} productos cargados 
            {TEST_MODE && <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-bold">MODO TEST</span>}
            {!TEST_MODE && <span className="ml-2 text-xs bg-green-400 text-green-900 px-2 py-1 rounded-full font-bold">MODO ENTREGA</span>}
          </p>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-6 p-6">
        
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <h1 className="text-xl font-black flex items-center gap-2 italic uppercase tracking-tighter text-blue-600">
            <Zap size={24} /> Triniglass <span className="text-slate-400 font-light not-italic text-sm">| Gestión Dinámica</span>
          </h1>
          <div className="flex gap-5 text-[10px] font-black uppercase tracking-wider">
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-slate-300 dark:bg-slate-700"></div> <span>Libre</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-blue-400 shadow-lg shadow-blue-500/20"></div> <span>&lt; 10d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-yellow-400 shadow-lg shadow-yellow-500/20"></div> <span>10-20d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-orange-400 shadow-lg shadow-orange-500/20"></div> <span>20-30d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-red-500 shadow-lg shadow-red-500/20"></div> <span>&gt; 30d</span></div>
             <button 
               onClick={() => setShowRuleEditor(true)}
               className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-colors"
             >
               <Layers size={14} />
               Configurar Reglas
             </button>
          </div>
        </div>

        {/* DESPLEGABLE DE SELECCIÓN DE DISEÑO DE MAPA */}
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <button 
              onClick={() => setIsMapDesignDropdownOpen(!isMapDesignDropdownOpen)} 
              className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3.5 text-sm font-black shadow-md uppercase"
            >
              <Layers size={18} className="text-purple-500" />
              <span>Diseño del Mapa: {selectedMapDesign === "default" ? "Diseño por Defecto" : designs.find(d => d.id === selectedMapDesign)?.name || selectedMapDesign}</span>
              <ChevronDown size={16} />
            </button>
            {isMapDesignDropdownOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <button 
                  className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-purple-50 dark:hover:bg-slate-700 flex items-center justify-between" 
                  onClick={() => { setSelectedMapDesign("default"); setIsMapDesignDropdownOpen(false); }}
                >
                  Diseño por Defecto {selectedMapDesign === "default" && <Check size={16} className="text-purple-500" />}
                </button>
                {designsLoading ? (
                  <div className="w-full text-left px-6 py-4 text-sm text-gray-500">
                    Cargando diseños...
                  </div>
                ) : designsError ? (
                  <div className="w-full text-left px-6 py-4 text-sm text-red-500">
                    Error: {designsError}
                  </div>
                ) : designs.length === 0 ? (
                  <div className="w-full text-left px-6 py-4 text-sm text-gray-500">
                    No hay diseños guardados
                  </div>
                ) : (
                  designs.map((design) => (
                    <button 
                      key={design.id}
                      className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-purple-50 dark:hover:bg-slate-700 flex items-center justify-between" 
                      onClick={async () => { 
                      if (design.id) {
                        await activateMapInFirebase(design.id);
                        setSelectedMapDesign(design.id); 
                        setIsMapDesignDropdownOpen(false); 
                      }
                    }}
                    >
                      {design.name} {selectedMapDesign === design.id && <Check size={16} className="text-purple-500" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ESCÁNER GLOBAL HOLOGRÁFICO */}
        <div className="h-[350px] relative bg-white dark:bg-black rounded-[2.5rem] border border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] shrink-0" style={{ paddingLeft: '80px', paddingRight: '80px', paddingTop: '24px', paddingBottom: '24px' }}>
          <div className="w-full h-full flex items-center justify-center">
            {selectedMapDesign === "default" ? (
              <div className="text-gray-500 text-center">
                <div className="text-lg font-bold">Diseño por Defecto</div>
                <div className="text-sm">Selecciona un mapa para ver la cuadrícula</div>
              </div>
            ) : (() => {
              const mapSize = calculateMapSize();
              // Usar toda la altura disponible del div (302px = 350px - 48px padding)
              const availableHeight = 302;
              const cellSize = availableHeight / mapSize.totalSquaresHeight;
              
              // Obtener el diseño del mapa seleccionado
              const selectedDesign = designs.find(d => d.id === selectedMapDesign);
              if (!selectedDesign) return null;
              
              // Función para convertir columna de letra a número
              const colToNumber = (col: string): number => {
                let result = 0;
                for (let i = 0; i < col.length; i++) {
                  result = result * 26 + (col.charCodeAt(i) - 64);
                }
                return result;
              };
              
              // Función para obtener el área y subárea de una celda
              const getCellArea = (row: number, col: number) => {
                for (const area of selectedDesign.areas) {
                  const areaStartRow = Math.floor(area.y / 40) + 1;
                  const areaStartCol = colToNumber(area.col);
                  const areaEndRow = areaStartRow + Math.floor(area.height / 40) - 1;
                  const areaEndCol = areaStartCol + Math.floor(area.width / 40) - 1;
                  
                  if (row >= areaStartRow && row <= areaEndRow && col >= areaStartCol && col <= areaEndCol) {
                    // Buscar subárea
                    if (area.subAreas && area.subAreas.length > 0) {
                      for (const subArea of area.subAreas) {
                        const subStartRow = Math.floor(subArea.y / 40) + 1;
                        const subStartCol = colToNumber(subArea.col);
                        const subEndRow = subStartRow + Math.floor(subArea.height / 40) - 1;
                        const subEndCol = subStartCol + Math.floor(subArea.width / 40) - 1;
                        
                        if (row >= subStartRow && row <= subEndRow && col >= subStartCol && col <= subEndCol) {
                          return { area, subArea };
                        }
                      }
                    }
                    return { area, subArea: null };
                  }
                }
                return { area: null, subArea: null };
              };
              
              return (
                <div 
                  className="grid relative"
                  style={{
                    width: `${mapSize.totalSquaresWidth * cellSize}px`,
                    height: `${availableHeight}px`,
                    gridTemplateColumns: `repeat(${mapSize.totalSquaresWidth}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${mapSize.totalSquaresHeight}, ${cellSize}px)`
                  }}
                >
                  {Array.from({ length: mapSize.totalSquaresWidth * mapSize.totalSquaresHeight }).map((_, index) => {
                    const row = Math.floor(index / mapSize.totalSquaresWidth) + 1;
                    const col = (index % mapSize.totalSquaresWidth) + 1;
                    const colLetter = String.fromCharCode(64 + col);
                    const position = `${colLetter}${row}`;
                    
                    const { area, subArea } = getCellArea(row, col);
                    
                    // Determinar qué bordes específicos debe tener la celda
                    const getCellBorders = (row: number, col: number, area: any) => {
                      const areaStartRow = Math.floor(area.y / 40) + 1;
                      const areaStartCol = colToNumber(area.col);
                      const areaEndRow = areaStartRow + Math.floor(area.height / 40) - 1;
                      const areaEndCol = areaStartCol + Math.floor(area.width / 40) - 1;
                      
                      let borderTop = '';
                      let borderBottom = '';
                      let borderLeft = '';
                      let borderRight = '';
                      
                      // Borde superior (solo en la primera fila del área)
                      if (row === areaStartRow) {
                        borderTop = 'border-t border-t-gray-500/50';
                      }
                      
                      // Borde inferior (solo en la última fila del área)
                      if (row === areaEndRow) {
                        borderBottom = 'border-b border-b-gray-500/50';
                      }
                      
                      // Borde izquierdo (solo en la primera columna del área)
                      if (col === areaStartCol) {
                        borderLeft = 'border-l border-l-gray-500/50';
                      }
                      
                      // Borde derecho (solo en la última columna del área)
                      if (col === areaEndCol) {
                        borderRight = 'border-r border-r-gray-500/50';
                      }
                      
                      return `${borderTop} ${borderBottom} ${borderLeft} ${borderRight}`;
                    };
                    
                    // Determinar qué bordes específicos debe tener la subárea
                    const getSubAreaBorders = (row: number, col: number, subArea: any) => {
                      const subStartRow = Math.floor(subArea.y / 40) + 1;
                      const subStartCol = colToNumber(subArea.col);
                      const subEndRow = subStartRow + Math.floor(subArea.height / 40) - 1;
                      const subEndCol = subStartCol + Math.floor(subArea.width / 40) - 1;
                      
                      let borderTop = '';
                      let borderBottom = '';
                      let borderLeft = '';
                      let borderRight = '';
                      
                      // Borde superior (solo en la primera fila de la subárea)
                      if (row === subStartRow) {
                        borderTop = 'border-t border-t-gray-700/50';
                      }
                      
                      // Borde inferior (solo en la última fila de la subárea)
                      if (row === subEndRow) {
                        borderBottom = 'border-b border-b-gray-700/50';
                      }
                      
                      // Borde izquierdo (solo en la primera columna de la subárea)
                      if (col === subStartCol) {
                        borderLeft = 'border-l border-l-gray-700/50';
                      }
                      
                      // Borde derecho (solo en la última columna de la subárea)
                      if (col === subEndCol) {
                        borderRight = 'border-r border-r-gray-700/50';
                      }
                      
                      return `${borderTop} ${borderBottom} ${borderLeft} ${borderRight}`;
                    };
                    
                    // Determinar color y borde basado en el área y subárea
                    let bgColor = 'bg-transparent';
                    let borderClass = '';
                    
                    if (area) {
                      if (subArea) {
                        // Subárea: color más oscuro con bordes exteriores
                        bgColor = 'bg-gray-500/40';
                        borderClass = getSubAreaBorders(row, col, subArea);
                      } else {
                        // Área principal: color gris claro con bordes exteriores
                        bgColor = 'bg-gray-300/30';
                        borderClass = getCellBorders(row, col, area);
                      }
                    }
                    
                    return (
                      <div
                        key={index}
                        className={`overflow-hidden ${bgColor} ${borderClass}`}
                        title={`${position}${area ? ` - ${area.name}` : ''}${subArea ? ` (${subArea.name})` : ''}`}
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`
                        }}
                      />
                    );
                  })}
                  
                  {/* Capa de etiquetas para zonas y subzonas */}
                  {selectedDesign.areas.map((area, areaIndex) => {
                    const areaStartRow = Math.floor(area.y / 40) + 1;
                    const areaStartCol = colToNumber(area.col);
                    const areaEndRow = areaStartRow + Math.floor(area.height / 40) - 1;
                    const areaEndCol = areaStartCol + Math.floor(area.width / 40) - 1;
                    
                    // Calcular centro del área
                    const areaCenterRow = Math.floor((areaStartRow + areaEndRow) / 2);
                    const areaCenterCol = Math.floor((areaStartCol + areaEndCol) / 2);
                    
                    return (
                      <div key={`area-label-${areaIndex}`}>
                        {/* Etiqueta del área principal - anclada arriba y centrada */}
                        <div
                          className="absolute flex items-center justify-center pointer-events-none dark:text-white text-black"
                          style={{
                            left: `${(areaStartCol - 1) * cellSize}px`,
                            top: `${(areaStartRow - 1) * cellSize - 25}px`,
                            width: `${(areaEndCol - areaStartCol + 1) * cellSize}px`,
                            height: `${cellSize}px`,
                            fontSize: `${Math.max(14, cellSize / 2.5)}px`,
                            fontWeight: 'bold',
                            zIndex: 10
                          }}
                        >
                          {area.name}
                        </div>
                        
                        {/* Etiquetas de subáreas - centradas perfectamente */}
                        {area.subAreas && area.subAreas.map((subArea, subIndex) => {
                          const subStartRow = Math.floor(subArea.y / 40) + 1;
                          const subStartCol = colToNumber(subArea.col);
                          const subEndRow = subStartRow + Math.floor(subArea.height / 40) - 1;
                          const subEndCol = subStartCol + Math.floor(subArea.width / 40) - 1;
                          
                          // Calcular centro exacto de la subárea
                          const subCenterRow = (subStartRow + subEndRow) / 2;
                          const subCenterCol = (subStartCol + subEndCol) / 2;
                          
                          return (
                            <div
                              key={`subarea-label-${areaIndex}-${subIndex}`}
                              className="absolute flex items-center justify-center pointer-events-none dark:text-white text-black"
                              style={{
                                left: `${(subStartCol + subEndCol - 1) * cellSize / 2}px`,
                                top: `${(subStartRow + subEndRow - 1) * cellSize / 2}px`,
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                                transform: 'translate(-50%, -50%)',
                                fontSize: `${Math.max(12, cellSize / 3)}px`,
                                fontWeight: '600',
                                zIndex: 11
                              }}
                            >
                              {subArea.name}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* INTERACCIÓN POR ZONA */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3.5 text-sm font-black shadow-md uppercase">
                <Layers size={18} className="text-blue-500" />
                <span>{zones.find(z => z.id === selectedZone)?.name}</span>
                <ChevronDown size={16} />
              </button>
              {isZoneDropdownOpen && (
                <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {zones.map(zone => (
                    <button key={zone.id} className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between" onClick={() => { setSelectedZone(zone.id); setIsZoneDropdownOpen(false); setSelectedBlock(null); }}>
                      {zone.name} {selectedZone === zone.id && <Check size={16} className="text-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar por ID o cliente..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-14 pr-6 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-500/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={20} /> Nueva Zona</button>
          </div>

          <div className="bg-white/40 dark:bg-slate-950/40 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-12 overflow-x-auto shadow-inner relative">
            {zones.find(z => z.id === selectedZone) && (
              <Zone
                zoneId={selectedZone}
                zoneName={zones.find(z => z.id === selectedZone)?.name || ''}
                subzones={zones.find(z => z.id === selectedZone)?.subzones || {}}
                blocks={blocks.filter(b => b.zoneId === selectedZone)}
                selectedBlock={selectedBlock}
                onBlockClick={setSelectedBlock}
                onEmptySlotClick={handleEmptySlotClick}
                preview={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* SIDEBAR DE DETALLES */}
      {(selectedBlock || showAddModal) && (
        <div className="fixed top-0 right-0 h-full w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 shadow-[-20px_0_60px_rgba(0,0,0,0.2)] animate-in slide-in-from-right duration-500 flex flex-col overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg"><Package size={24} /></div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white leading-none">
                {showAddModal ? 'Nuevo Pallet' : 'Detalle del Palet'}
              </h2>
            </div>
            <button onClick={() => { setSelectedBlock(null); setShowAddModal(false); }} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500"><X size={32} strokeWidth={3}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {showAddModal ? (
              <form className="space-y-5" onSubmit={e => { e.preventDefault(); handleAddPalletSave(); }}>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Código de barra</label>
                  <input name="codigo_barra" value={addPalletForm.codigo_barra} onChange={handleAddPalletFormChange} placeholder="Código de barra" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</label>
                  <input name="apellido_cliente" value={addPalletForm.apellido_cliente} onChange={handleAddPalletFormChange} placeholder="Cliente" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nombre abreviado</label>
                  <input name="nombre_abreviado" value={addPalletForm.nombre_abreviado} onChange={handleAddPalletFormChange} placeholder="Nombre abreviado" className="input w-full" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Altura (mm)</label>
                    <input name="altura" value={addPalletForm.altura} onChange={handleAddPalletFormChange} placeholder="Altura (mm)" className="input w-full" type="number" required />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Longitud (mm)</label>
                    <input name="longitud" value={addPalletForm.longitud} onChange={handleAddPalletFormChange} placeholder="Longitud (mm)" className="input w-full" type="number" required />
                  </div>
                </div>
                {addPalletError && <div className="text-red-500 text-xs mt-2">{addPalletError}</div>}
                <div className="flex gap-3 pt-4">
                  <button type="button" className="w-1/2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase transition-all shadow-sm" onClick={() => { setShowAddModal(false); setSelectedBlock(null); }}>Cancelar</button>
                  <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase transition-all shadow-sm" disabled={addPalletLoading}>{addPalletLoading ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </form>
            ) : selectedBlock ? (
              <>
                <div className="bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-blue-900 dark:via-slate-900 dark:to-slate-800 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden shadow-lg">
                  <div className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-black mb-2 tracking-[0.4em]">GLASS ID</div>
                  <div className="text-5xl font-black tracking-tighter text-blue-600 dark:text-blue-400 leading-none break-all uppercase drop-shadow-lg">{selectedBlock.codigo_barra || 'Sin código'}</div>
                  <div className="flex justify-center gap-2 mt-6">
                    {selectedBlock.occupied && (
                      <div className="inline-flex px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-black uppercase tracking-widest border border-blue-500/20">Prioridad {selectedBlock.priority || 'N/A'}</div>
                    )}
                    {!selectedBlock.occupied && (
                      <div className="inline-flex px-4 py-1.5 rounded-full bg-slate-500/10 text-slate-500 text-[11px] font-black uppercase tracking-widest border border-slate-500/20">Disponible</div>
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 mt-2 grid grid-cols-1 gap-3 shadow-inner">
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Código de barras</span><span className="text-sm font-mono">{selectedBlock.codigo_barra || 'Sin código'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Cliente</span><span className="text-sm font-mono">{selectedBlock.client || 'Desconocido'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Dimensiones</span><span className="text-sm font-mono">{selectedBlock.dimensions || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Peso total</span><span className="text-sm font-mono">{selectedBlock.weight || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Estado pedido</span><span className="text-sm font-mono">{selectedBlock.estadoPedido || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Referencia pedido</span><span className="text-sm font-mono">{selectedBlock.referencias || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Fecha entrega</span><span className="text-sm font-mono">{selectedBlock.lastUpdate || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Zona</span><span className="text-sm font-mono">{selectedBlock.zoneId || 'N/A'}</span></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Subzona</span><span className="text-sm font-mono">{selectedBlock.area || 'N/A'}</span></div>
                </div>
                <div className="flex flex-row gap-3 mt-6 mb-2 justify-center">
                  <button
                    className={`bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all ${moveMode ? 'ring-2 ring-green-400' : ''}`}
                    onClick={() => setMoveMode(m => !m)}
                    disabled={moveLoading}
                  >
                    <Maximize2 size={16}/> {moveMode ? 'Cancelar' : 'Mover'}
                  </button>
                  <button className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all"><Package size={16}/> Despachar</button>
                  <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all"><X size={16}/> Eliminar</button>
                </div>
                {moveMode && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200 dark:border-blue-700 shadow-2xl p-8 flex flex-col items-center min-w-[320px] max-w-[400px] w-full mx-4 relative">
                      <div className="text-lg font-black mb-6 text-blue-700 dark:text-blue-300 text-center">Selecciona la nueva subzona</div>
                      <div className="w-full grid grid-cols-2 gap-4 mb-4">
                        {zones.flatMap(zone => Object.keys(zone.subzones).map(subzone => ({ zoneId: zone.id, zoneName: zone.name, subzone }))).map(({ zoneId, zoneName, subzone }) => (
                          <button
                            key={zoneId + '-' + subzone}
                            className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold py-4 rounded-xl text-base hover:bg-blue-200 dark:hover:bg-blue-800 transition-all border border-blue-200 dark:border-blue-700 shadow"
                            onClick={async () => {
                              if (!selectedBlock) return;
                              setMoveLoading(true);
                              setMoveError(null);
                              try {
                                const docRef = firestoreDoc(db, 'productos', selectedBlock.id);
                                await updateDoc(docRef, { subzona: subzone, zona: zoneId });
                                setMoveMode(false);
                                setSelectedBlock(null);
                                window.location.reload();
                              } catch (err) {
                                setMoveError('Error al mover el pallet');
                              } finally {
                                setMoveLoading(false);
                              }
                            }}
                            disabled={moveLoading}
                          >
                            {zoneName} - {subzone}
                          </button>
                        ))}
                      </div>
                      {moveError && <div className="text-red-500 text-xs mb-2 text-center">{moveError}</div>}
                      <button
                        className="mt-2 px-6 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                        onClick={() => setMoveMode(false)}
                        disabled={moveLoading}
                      >Cancelar</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-500">
                <p>Selecciona una ubicación para ver detalles</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* MODAL DE EDITOR DE REGLAS */}
      {showRuleEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-8 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurar Reglas de Asignación Dinámica</h2>
              <button 
                onClick={() => setShowRuleEditor(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700"
              >
                <X size={24} />
              </button>
            </div>
            <RuleEditor />
          </div>
        </div>
      )}
    </div>
  );
}
