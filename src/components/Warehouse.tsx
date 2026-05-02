// SUBZONE_MAP eliminado: la lógica de asignación está embebida en mapProductoToBlock
import { useState, useEffect } from "react";
import { 
  Search, Plus, ChevronDown, Check, X, Package, 
  Layers, Maximize2, View, Zap, DoorOpen
} from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc as firestoreDoc } from "firebase/firestore";
import Map from "./Map";
import Zone from "./Zone";


// 1. CONFIGURACIÓN DE ZONAS CON SUBZONAS Y POSICIONES
const ZONE_CONFIGS = {
  expediciones: {
    name: "Expediciones",
    subzones: {
      H: ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5'],
      Mamparista: ['D1','D2','D3','D4','D5','E1','E2','E3','E4','E5']
    }
  },
  pulidoras: {
    name: "Pulidoras",
    subzones: {
      F: ['A5']
    }
  },
  corte: {
    name: "Corte",
    subzones: {
      E: ['A4']
    }
  },
  cms: {
    name: "CMS",
    subzones: {
      D: ['A1','A2','A3','A4','B1','B2','B3','B4']
    }
  },
  bilateral_taladros: {
    name: "Bilateral/Taladros",
    subzones: {
      C: ['A5'],
      B: ['E5']
    }
  },
  horno: {
    name: "Horno",
    subzones: {
      A: ['A1','A2','A3','B1','B2','B3','C1','C2','C3'],
      '??': ['A6','B6']
    }
  }
};

const ZONES = Object.entries(ZONE_CONFIGS).map(([id, config]) => ({
  id,
  name: config.name,
  areas: Object.keys(config.subzones),
  subzones: config.subzones,
  layout: id === 'expediciones' || id === 'bilateral_taladros' ? 'horizontal' : id === 'horno' ? 'vertical' : 'single'
}));

const INITIAL_ZONES = ZONES;

const parseFechaLineaPedido = (fecha: unknown): Date | null => {
  if (!fecha) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    .replace(/\u00A0/g, ' ')        // NBSP
    .replace(/\u202F/g, ' ')        // narrow no-break
    .replace(/\s+/g, ' ')           // espacios múltiples
    .trim();

  // Ej: "10 de marzo de 2026 a las 1:00:00 a.m. UTC+1"
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

  // Fallback: parse directo si posible
  const parsed = Date.parse(normalized.replace('UTC', 'GMT'));
  return isNaN(parsed) ? null : new Date(parsed);
};

// Mapear productos de Firebase a estructura de bloques
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

const mapProductoToBlock = (producto: Producto, index: number) => {
  // Calcular días en storage desde fecha_linea_pedido
  const fechaPedido = parseFechaLineaPedido(producto.fecha_linea_pedido);
  const hoy = new Date();
  let daysInStorage = 0;

  if (fechaPedido) {
    daysInStorage = Math.max(0, Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    console.warn(`⚠️ Fecha inválida para producto ${producto.codigo_barra || producto.id} -> fecha_linea_pedido='${producto.fecha_linea_pedido}'`);
  }
  // zoneId se define más abajo según lógica

  // Determinar tipo de vidrio
  const tipoVidrio = producto.vidrio_simple ? "Vidrio Simple" : "Doble Acristalamiento";

  // Determinar prioridad según días en storage
  let priority = "Normal";
  if (daysInStorage > 30) priority = "Alta";
  else if (daysInStorage > 20) priority = "Media";

  // --- NUEVA LÓGICA: Priorizar subzona si existe ---

  let area = "";
  let zoneId = "";
  if (typeof producto.subzona === "string" && producto.subzona.trim() !== "") {
    area = producto.subzona.trim();
    // Buscar a qué zona pertenece esta subzona
    const zonaEncontrada = Object.entries(ZONE_CONFIGS).find(([, config]) =>
      Object.keys(config.subzones).includes(area)
    );
    if (zonaEncontrada) {
      zoneId = zonaEncontrada[0];
    } else {
      // Si la subzona no existe en la config, fallback a lógica antigua
      area = "";
    }
  }

  // Si no hay subzona válida, usar lógica antigua
  if (!area) {
    area = "H";
    zoneId = "expediciones";
    if (typeof producto.nombre_abreviado === "string") {
      const nombre = producto.nombre_abreviado.toUpperCase().trim();
      if (nombre === "DUSCHOLUX" || nombre === "VICOMAM") {
        area = "Mamparista";
        zoneId = "expediciones";
      } else {
        const H_KEYS = ["CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR"];
        if (H_KEYS.some(key => nombre.includes(key))) {
          area = "H";
          zoneId = "expediciones";
        } else {
          const E_KEYS = ["VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER"];
          if (E_KEYS.some(key => nombre.includes(key))) {
            area = "E";
            zoneId = "corte";
          } else {
            const D_KEYS = ["OTERO", "CLEMENTE", "FORNES"];
            if (D_KEYS.some(key => nombre.includes(key))) {
              area = "D";
              zoneId = "cms";
            } else {
              const F_KEYS = ["IBERPERFIL", "VALVERDE"];
              if (F_KEYS.some(key => nombre.includes(key))) {
                area = "F";
                zoneId = "pulidoras";
              } else {
                const C_KEYS = ["BARCELONA", "COMPANY"];
                if (C_KEYS.some(key => nombre.includes(key))) {
                  area = "C";
                  zoneId = "bilateral_taladros";
                } else {
                  const B_KEYS = ["PONSETI", "ALMANSA"];
                  if (B_KEYS.some(key => nombre.includes(key))) {
                    area = "B";
                    zoneId = "bilateral_taladros";
                  } else {
                    const A_KEYS = ["GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"];
                    if (A_KEYS.some(key => nombre.includes(key))) {
                      area = "??";
                      zoneId = "horno";
                    } else {
                      const ALL_KEYS = [
                        "DUSCHOLUX", "VICOMAM", // Mamparista
                        "CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR", // H
                        "VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER", // Corte/E
                        "OTERO", "CLEMENTE", "FORNES", // CMS/D
                        "IBERPERFIL", "VALVERDE", // Pulidoras/F
                        "BARCELONA", "COMPANY", // Bilateral/C
                        "PONSETI", "ALMANSA", // Taladros/B
                        "GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL" // Horno/??
                      ];
                      if (!ALL_KEYS.some(key => nombre.includes(key))) {
                        area = "A";
                        zoneId = "horno";
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`✅ ${producto.nombre_abreviado} (${producto.codigo_barra}) → Zona ${zoneId} / Subzona ${area}`);

  return {
    id, // id interno de Firestore
    codigo_barra: producto.codigo_barra || '', // para mostrar en la UI
    zoneId: zoneId,
    area: area,
    type: tipoVidrio,
    daysInStorage: daysInStorage,
    client: producto.apellido_cliente || producto.nombre_abreviado || "Cliente Desconocido",
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
    numeroCliente: producto.numero_cliente,
    numeroLineaPedido: producto.numero_linea_pedido,
    estadoPedido: producto.estado_pedido,
    empresa: producto.empresa,
    referencias: producto.referencia_linea_pedido
  };
};

export default function Warehouse() {
  // MODO TEST/ENTREGA: Cambiar a false para modo entrega (cargar todos los datos)
  const TEST_MODE = true; // true = modo test (solo 200 lecturas), false = modo entrega (todos los datos)
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZone, setSelectedZone] = useState("expediciones");
  const [selectedBlock, setSelectedBlock] = useState<typeof blocks[number] | null>(null);
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isNewZoneModalOpen, setIsNewZoneModalOpen] = useState(false);
  const [zones, setZones] = useState<typeof INITIAL_ZONES>(INITIAL_ZONES);
  const [blocks, setBlocks] = useState<ReturnType<typeof mapProductoToBlock>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado para alta de pallet
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
  // Estado para mover pallet
  const [moveMode, setMoveMode] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Handler para click en hueco vacío
  const handleEmptySlotClick = (zoneId: string, subzone: string) => {
    setAddPalletZone(zoneId);
    setAddPalletSubzone(subzone);
    setAddPalletForm((prev: any) => ({ ...prev, subzona: subzone }));
    setShowAddModal(true);
  };

  // Cargar zonas nuevas de Firebase y añadirlas al dropdown (sin duplicar las hardcodeadas)
  useEffect(() => {
    getZones().then(data => {
      const normalized = data.map((z: typeof data[number]) => ({
        id: z.id.toLowerCase(),
        name: z.name,
        areas: z.posiciones,
        subzones: z.subzones,
        layout: 'horizontal' as const,
      }));
      const nuevas = normalized.filter(fz => !INITIAL_ZONES.some(iz => iz.id.toLowerCase() === fz.id.toLowerCase()));
      if (nuevas.length > 0) setZones([...INITIAL_ZONES, ...nuevas]);
    }).catch(() => {});
  }, []);

  // Handler para cambio en formulario
  const handleAddPalletFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddPalletForm((prev: any) => ({ ...prev, [name]: value }));
  };

  // Cargar productos desde Firebase
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        console.log("🔥 Iniciando conexión a Firebase...");
        console.log("Proyecto:", db.app.options.projectId);
        console.log("📦 Buscando colección: 'productos'");
        
        const productosCollection = collection(db, "productos");
        const snapshot = await getDocs(productosCollection);
        
        console.log(`✅ Conexión exitosa. Documentos encontrados: ${snapshot.size}`);
        
        if (snapshot.size === 0) {
          console.warn("⚠️ La colección 'productos' está vacía o no existe.");
          setError("La colección 'productos' está vacía");
          setBlocks([]);
          setLoading(false);
          return;
        }

        // MODO TEST: Limitar a 200 documentos para ahorrar lecturas de Firebase
        const docsToProcess = TEST_MODE ? snapshot.docs.slice(0, 200) : snapshot.docs;
        if (TEST_MODE) {
          console.log(`🧪 MODO TEST: Procesando solo los primeros ${docsToProcess.length} documentos de ${snapshot.size} totales`);
        }
        


          // Filtrar productos para Mamparista, H, Corte/E y CMS/D según lógica robusta
          const productos = docsToProcess
            .map((doc, index) => {
              const data = doc.data() as any;
              // Pasar el id de Firestore explícitamente
              return { ...data, id: doc.id, docIndex: index };
            })
            .filter((prod: any) => {
              if (typeof prod.nombre_abreviado !== "string") return false;
              const nombre = prod.nombre_abreviado.toUpperCase().trim();
              // Mamparista: solo DUSCHOLUX y VICOMAM exactos
              if (nombre === "DUSCHOLUX" || nombre === "VICOMAM") return true;
              // H: flexible, incluye variantes y espacios
              const H_KEYS = ["CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR"];
              if (H_KEYS.some(key => nombre.includes(key))) return true;
              // Corte/E: contiene alguna de las cadenas
              const E_KEYS = ["VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER"];
              if (E_KEYS.some(key => nombre.includes(key))) return true;
              // CMS/D: contiene alguna de las cadenas
              const D_KEYS = ["OTERO", "CLEMENTE", "FORNES"];
              if (D_KEYS.some(key => nombre.includes(key))) return true;
              // Zona 1/F: contiene alguna de las cadenas
              const F_KEYS = ["IBERPERFIL", "VALVERDE"];
              if (F_KEYS.some(key => nombre.includes(key))) return true;
              // Zona 2/C: contiene BARCELONA o COMPANY
              const C_KEYS = ["BARCELONA", "COMPANY"];
              if (C_KEYS.some(key => nombre.includes(key))) return true;
              // Zona 2/B: contiene PONSETI o ALMANSA
              const B_KEYS = ["PONSETI", "ALMANSA"];
              if (B_KEYS.some(key => nombre.includes(key))) return true;
              // Zona 3/??: contiene GLORIA, VIELMAR, GUSTAMAN, MOLALUM, THERMIA, FAURA, BUCH o MODUL
              const A_KEYS = ["GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"];
              if (A_KEYS.some(key => nombre.includes(key))) return true;
              // Zona 3/A: no contiene ninguna de las cadenas de todas las zonas y subzonas anteriores
              const ALL_KEYS = [
                "DUSCHOLUX", "VICOMAM", // Mamparista
                "CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR", // H
                "VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER", // Corte/E
                "OTERO", "CLEMENTE", "FORNES", // CMS/D
                "IBERPERFIL", "VALVERDE", // Zona 1/F
                "BARCELONA", "COMPANY", // Zona 2/C
                "PONSETI", "ALMANSA", // Zona 2/B
                "GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL" // Zona 3/??
              ];
              if (!ALL_KEYS.some(key => nombre.includes(key))) return true;
              return false;
            })
            .map((prod: any, index: number) => mapProductoToBlock(prod, index, prod.id));
        
        console.log(`✅ ${productos.length} productos MAFER mapeados correctamente`);
        setBlocks(productos);
        setError(null);
      } catch (err) {
        console.error("❌ Error cargando productos:", err);
        console.error("   Tipo de error:", (err as Error).name);
        console.error("   Mensaje:", (err as Error).message);
        setError(`Error: ${(err as Error).message}`);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  // Lógica de búsqueda automática: te lleva a la zona y abre detalles
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
      const normalized = data.map((z: typeof data[number]) => ({
        id: z.id.toLowerCase(),
        name: z.name,
        areas: z.posiciones,
        layout: "horizontal" as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subzones: z.subzones as any,
      }));
      const nuevas = normalized.filter(fz => !INITIAL_ZONES.some(iz => iz.id.toLowerCase() === fz.id.toLowerCase()));
      setZones([...INITIAL_ZONES, ...nuevas]);
      setSelectedZone(zoneId.toLowerCase());
    } catch (error) {
      console.error("❌ Error refrescando zonas después de crear:", error);
      setError("Error al actualizar la lista de zonas");
    } finally {
      setIsNewZoneModalOpen(false);
    }
  };

  const handleAddPalletFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddPalletForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddPalletSave = async () => {
    try {
      setAddPalletLoading(true);
      setAddPalletError(null);
      // Add your save logic here
      // await addDoc(collection(db, 'productos'), addPalletForm);
      setShowAddModal(false);
      setSelectedBlock(null);
      // Reload products if needed
    } catch {
      setAddPalletError('Error al guardar el pallet');
    } finally {
      setAddPalletLoading(false);
    }
  };

  const renderBlock = (block: ReturnType<typeof mapProductoToBlock>) => {
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

  const renderArea = (areaName: string) => {
    const areaBlocks = blocks.filter(b => b.area === areaName && (selectedZone === b.zoneId));
    if (areaBlocks.length === 0 && selectedZone !== "zona_3") return null;
    
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
      
      {/* Mostrar estado de carga o error */}
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

      {/* Panel de debug - Ver datos cargados */}
      {!loading && blocks.length > 0 && (
        <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 px-6 py-4 rounded-2xl m-6">
          <p className="font-bold text-blue-700 dark:text-blue-200">
            ✅ {blocks.length} productos cargados 
            {TEST_MODE && <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-bold">MODO TEST</span>}
            {!TEST_MODE && <span className="ml-2 text-xs bg-green-400 text-green-900 px-2 py-1 rounded-full font-bold">MODO ENTREGA</span>}
          </p>
          <details className="text-sm text-blue-600 dark:text-blue-300 mt-2 cursor-pointer">
            <summary>Ver distribución por zonas</summary>
            <pre className="mt-2 text-xs bg-white dark:bg-slate-800 p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(
                {
                  total: blocks.length,
                  "expediciones": blocks.filter(b => b.zoneId === "expediciones").length,
                  "pulidoras": blocks.filter(b => b.zoneId === "pulidoras").length,
                  "corte": blocks.filter(b => b.zoneId === "corte").length,
                  "cms": blocks.filter(b => b.zoneId === "cms").length,
                  "bilateral_taladros": blocks.filter(b => b.zoneId === "bilateral_taladros").length,
                  "horno": blocks.filter(b => b.zoneId === "horno").length,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-6 p-6">
        
        {/* CABECERA */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <h1 className="text-xl font-black flex items-center gap-2 italic uppercase tracking-tighter text-blue-600">
            <Zap size={24} /> Triniglass <span className="text-slate-400 font-light not-italic text-sm">| Gestión Real</span>
          </h1>
          <div className="flex gap-5 text-[10px] font-black uppercase tracking-wider">
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-slate-300 dark:bg-slate-700"></div> <span>Libre</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-blue-400 shadow-lg shadow-blue-500/20"></div> <span>&lt; 10d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-yellow-400 shadow-lg shadow-yellow-500/20"></div> <span>10-20d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-orange-400 shadow-lg shadow-orange-500/20"></div> <span>20-30d</span></div>
             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-red-500 shadow-lg shadow-red-500/20"></div> <span>&gt; 30d</span></div>
          </div>
        </div>

        {/* ESCÁNER GLOBAL HOLOGRÁFICO CON PUERTAS SEGÚN MAPAALMACEN.PNG [1] */}
        <div className="h-[350px] relative bg-white dark:bg-black rounded-[2.5rem] border border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] shrink-0" style={{ paddingLeft: '80px', paddingRight: '80px', paddingTop: '24px', paddingBottom: '24px' }}>
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2 text-cyan-400 font-black text-[9px] uppercase tracking-widest italic animate-pulse">
            <View size={12}/> Mapa de Calor Navegable [Heat Map Mode]
          </div>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '25px 25px' }}></div>

          {/* PUERTA ENTRADA EXP (Izquierda, más alejada y texto vertical) */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-cyan-500/30 px-3">
            <DoorOpen size={28} />
            <span className="text-[12px] font-black uppercase" style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Entrada Exp</span>
          </div>

          <div className="h-full overflow-hidden">
            <Map
              zones={zones}
              blocks={blocks}
              selectedZone={selectedZone}
              selectedBlock={selectedBlock}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onBlockClick={(block: any) => setSelectedBlock(block)}
              preview={true}
              disableInteraction={true}
            />
          </div>

          {/* PUERTA SALIDA HORNO (Derecha, más alejada y texto vertical) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-cyan-500/30 px-3">
            <span className="text-[12px] font-black uppercase" style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Salida Horno</span>
            <DoorOpen size={28} className="rotate-0" />
          </div>
        </div>

        {/* INTERACCIÓN POR ZONA CON ALTURA ADAPTABLE */}
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
              <input type="text" placeholder="Buscar por ID (H-105) o cliente..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-14 pr-6 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-500/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

      {/* SIDEBAR DE DETALLES: OVERLAY CON ID REDUCIDO (text-5xl) */}
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
                  <div className="text-[11px] text-slate-500 mb-1">Ejemplo: 1234567890 (solo números, sin espacios)</div>
                  <input name="codigo_barra" value={addPalletForm.codigo_barra} onChange={handleAddPalletFormChange} placeholder="Código de barra" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</label>
                  <div className="text-[11px] text-slate-500 mb-1">Nombre completo o razón social</div>
                  <input name="apellido_cliente" value={addPalletForm.apellido_cliente} onChange={handleAddPalletFormChange} placeholder="Cliente" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nombre abreviado</label>
                  <div className="text-[11px] text-slate-500 mb-1">Ejemplo: ACME</div>
                  <input name="nombre_abreviado" value={addPalletForm.nombre_abreviado} onChange={handleAddPalletFormChange} placeholder="Nombre abreviado" className="input w-full" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Altura (mm)</label>
                    <div className="text-[11px] text-slate-500 mb-1">Solo números. Ej: 2400</div>
                    <input name="altura" value={addPalletForm.altura} onChange={handleAddPalletFormChange} placeholder="Altura (mm)" className="input w-full" type="number" required />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Longitud (mm)</label>
                    <div className="text-[11px] text-slate-500 mb-1">Solo números. Ej: 3200</div>
                    <input name="longitud" value={addPalletForm.longitud} onChange={handleAddPalletFormChange} placeholder="Longitud (mm)" className="input w-full" type="number" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Peso total (kg)</label>
                    <div className="text-[11px] text-slate-500 mb-1">Solo números. Ej: 1200</div>
                    <input name="peso_total_kg" value={addPalletForm.peso_total_kg} onChange={handleAddPalletFormChange} placeholder="Peso total (kg)" className="input w-full" type="number" required />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cantidad encargada</label>
                    <div className="text-[11px] text-slate-500 mb-1">Solo números. Ej: 10</div>
                    <input name="cantidad_encargada" value={addPalletForm.cantidad_encargada} onChange={handleAddPalletFormChange} placeholder="Cantidad encargada" className="input w-full" type="number" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                  <div className="text-[11px] text-slate-500 mb-1">Breve descripción del producto</div>
                  <input name="descripcion_producido_longitud" value={addPalletForm.descripcion_producido_longitud} onChange={handleAddPalletFormChange} placeholder="Descripción" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Referencia pedido</label>
                  <div className="text-[11px] text-slate-500 mb-1">Opcional. Ejemplo: REF-2026-001</div>
                  <input name="referencia_linea_pedido" value={addPalletForm.referencia_linea_pedido} onChange={handleAddPalletFormChange} placeholder="Referencia pedido" className="input w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fecha entrega</label>
                    <div className="text-[11px] text-slate-500 mb-1">Formato: YYYY-MM-DD</div>
                    <input name="fecha_entrega" value={addPalletForm.fecha_entrega} onChange={handleAddPalletFormChange} placeholder="Fecha entrega" className="input w-full" type="date" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fecha pedido</label>
                    <div className="text-[11px] text-slate-500 mb-1">Formato: YYYY-MM-DD</div>
                    <input name="fecha_linea_pedido" value={addPalletForm.fecha_linea_pedido} onChange={handleAddPalletFormChange} placeholder="Fecha pedido" className="input w-full" type="date" />
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
                {/* Cabecera visual destacada */}
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
                {/* Detalles del pallet */}
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
                {/* Botones de acción debajo */}
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
    </div>
  );
}
