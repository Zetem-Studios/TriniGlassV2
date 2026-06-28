// Warehouse.tsx - Implementación dinámica sin hardcode
import { useState, useEffect, type KeyboardEvent } from "react";
import {
  Search, ChevronDown, Check, X, Package, 
  Layers, Maximize2, Zap, Box
} from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, writeBatch, doc, getDoc } from "firebase/firestore";
import RuleEditor from "./RuleEditor";
import { useMapDesigns } from '../hooks/useMapDesigns';

// Estilos CSS personalizados para barras de scroll
const customScrollbarStyles = `
  /* Estilos para scroll vertical */
  .scrollbar-vertical-custom::-webkit-scrollbar {
    width: 8px;
  }
  
  .scrollbar-vertical-custom::-webkit-scrollbar-track {
    background: linear-gradient(to bottom, #dbeafe, #e0e7ff);
    border-radius: 4px;
  }
  
  .scrollbar-vertical-custom::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #3b82f6, #6366f1);
    border-radius: 4px;
    border: 1px solid #1e40af;
  }
  
  .scrollbar-vertical-custom::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #2563eb, #4f46e5);
    border-color: #1d4ed8;
  }
  
  /* Estilos para modo oscuro */
  .dark .scrollbar-vertical-custom::-webkit-scrollbar-track {
    background: linear-gradient(to bottom, #1e293b, #334155);
  }
  
  .dark .scrollbar-vertical-custom::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #475569, #64748b);
    border: 1px solid #334155;
  }
  
  .dark .scrollbar-vertical-custom::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #64748b, #94a3b8);
    border-color: #475569;
  }
  
  /* Estilos para scroll horizontal */
  .scrollbar-horizontal-custom::-webkit-scrollbar {
    height: 8px;
  }
  
  .scrollbar-horizontal-custom::-webkit-scrollbar-track {
    background: linear-gradient(to right, #dbeafe, #e0e7ff);
    border-radius: 4px;
  }
  
  .scrollbar-horizontal-custom::-webkit-scrollbar-thumb {
    background: linear-gradient(to right, #3b82f6, #6366f1);
    border-radius: 4px;
    border: 1px solid #1e40af;
  }
  
  .scrollbar-horizontal-custom::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to right, #2563eb, #4f46e5);
    border-color: #1d4ed8;
  }
  
  /* Estilos para modo oscuro - scroll horizontal */
  .dark .scrollbar-horizontal-custom::-webkit-scrollbar-track {
    background: linear-gradient(to right, #1e293b, #334155);
  }
  
  .dark .scrollbar-horizontal-custom::-webkit-scrollbar-thumb {
    background: linear-gradient(to right, #475569, #64748b);
    border: 1px solid #334155;
  }
  
  .dark .scrollbar-horizontal-custom::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to right, #64748b, #94a3b8);
    border-color: #475569;
  }

  .text-\\[8px\\] {
    font-size: 10px !important;
  }
`;

// Interfaces para tipado dinámico
interface ZoneConfig {
  id: string;
  name: string;
  subzones: Record<string, string[]>;
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
  fila?: number;
  columna?: number;
  referencias?: string;
  posicion?: string | null;
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

  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  const match = /(\d{1,2}) de (\w+) de (\d{4}) a las (\d{1,2}:\d{2}:\d{2})\s*([ap]\.m\.)\s*UTC\s*([+-]?\d+)/i.exec(normalized);
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


// Función para mapear productos a bloques (posicionamiento ahora viene de BD)
const mapProductoToBlock = async (producto: Producto, _rules: any[], index: number): Promise<Block> => {
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

  // El posicionamiento viene directamente de los campos actualizados por reglas
  // Sin hardcoded - todo dinámico desde la BD
  const zoneId = (producto as any).zona;
  const area = (producto as any).subzona;


  return {
    id: String(producto.id) || `block-${index}`,
    codigo_barra: producto.codigo_barra || '',
    zoneId: zoneId,
    area: area,
    type: tipoVidrio,
    daysInStorage: daysInStorage,
    client: (producto.apellido_cliente!) || (producto.nombre_abreviado!) || "Cliente Desconocido",
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


// Función para generar clave de agrupación para productos
const generarClaveAgrupacion = (producto: any): string => {
  // Solo agrupar si tiene código de barras
  if (producto.codigo_barra && producto.codigo_barra.trim() !== '') {
    return producto.codigo_barra.trim();
  }
  
  // Si no tiene código de barras, generar clave única para que no se agrupe
  return `UNICO_${producto.id}`;
};

// Función para generar código de ubicación
const generarCodigoUbicacion = (zoneName: string, subZoneName: string, fila: number, columna: number): string => {
  const zonaCode = zoneName.substring(0, 3).toUpperCase();
  const subzonaCode = subZoneName.substring(0, 3).toUpperCase();
  return `${zonaCode}${subzonaCode}${fila}${columna}`;
};

const getSlotFromPosition = (posicion?: string | null): { fila: number; columna: number } | null => {
  if (!posicion) return null;
  const legacyMatch = /F(\d+)C(\d+)$/i.exec(posicion);
  if (legacyMatch) {
    return {
      fila: Number(legacyMatch[1]),
      columna: Number(legacyMatch[2])
    };
  }
  const shortMatch = /(\d)(\d+)$/.exec(posicion);
  if (!shortMatch) return null;
  return {
    fila: Number(shortMatch[1]),
    columna: Number(shortMatch[2])
  };
};

const DEFAULT_SUBZONE_CAPACITIES: Record<string, number> = {
  'cms:D': 13,
};

const getDefaultSubzoneCapacity = (zoneId: string, subzone: string) =>
  DEFAULT_SUBZONE_CAPACITIES[`${zoneId}:${subzone}`] ?? null;

const getObservedCardsPerRow = (pallets: Block[]) => {
  const slots = pallets
    .map((pallet) => getSlotFromPosition(pallet.posicion))
    .filter((slot): slot is { fila: number; columna: number } => Boolean(slot));

  if (slots.length === 0) return 0;
  return Math.max(...slots.map((slot) => slot.columna));
};

const isLegacyPositionCode = (posicion?: string | null): boolean => {
  return Boolean(posicion?.match(/F\d+C\d+$/i));
};

const getBlockZone = (block: Block): string => {
  return ((block as any).zona as string) || block.zoneId;
};

const getBlockSubzone = (block: Block): string => {
  return ((block as any).subzona as string) || block.area;
};

const getAggregatedDimensions = (pallets: Block[]): string => {
  const parsedDimensions = pallets
    .map((pallet) => {
      const matches = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i.exec(pallet.dimensions);
      if (!matches) return null;
      return {
        width: Number(matches[1].replace(',', '.')),
        length: Number(matches[2].replace(',', '.'))
      };
    })
    .filter((dimensions): dimensions is { width: number; length: number } => Boolean(dimensions));

  if (parsedDimensions.length === 0) return 'N/A';

  const maxWidth = Math.max(...parsedDimensions.map((dimensions) => dimensions.width));
  const maxLength = Math.max(...parsedDimensions.map((dimensions) => dimensions.length));

  return `${maxWidth} x ${maxLength} mm`;
};

const getAggregatedWeight = (pallets: Block[]): string => {
  const weights = pallets
    .map((pallet) => {
      const match = /(\d+(?:[.,]\d+)?)/.exec(pallet.weight);
      return match ? Number(match[1].replace(',', '.')) : null;
    })
    .filter((weight): weight is number => typeof weight === 'number' && !Number.isNaN(weight));

  if (weights.length === 0) return 'N/A';

  return `${Number(weights.reduce((total, weight) => total + weight, 0).toFixed(2))} kg`;
};

const getStorageBorderClasses = (daysInStorage: number): string => {
  if (daysInStorage > 30) return 'border-red-500 dark:border-red-400 hover:border-red-600 dark:hover:border-red-300';
  if (daysInStorage > 20) return 'border-orange-400 dark:border-orange-300 hover:border-orange-500 dark:hover:border-orange-200';
  if (daysInStorage >= 10) return 'border-yellow-400 dark:border-yellow-300 hover:border-yellow-500 dark:hover:border-yellow-200';
  return 'border-brand-400 dark:border-brand-300 hover:border-brand-500 dark:hover:border-brand-200';
};

// Versión síncrona simplificada para usar en el bucle
/* const mapProductoToBlockSimple = (producto: Producto, index: number): Block => {
  const fechaPedido = parseFechaLineaPedido(producto.fecha_linea_pedido);
  const hoy = new Date();
  let daysInStorage = 0;

  if (fechaPedido) {
    daysInStorage = Math.max(0, Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const tipoVidrio = producto.vidrio_simple ? "Vidrio Simple" : "Doble Acristalamiento";
  
  let priority = "Normal";
  if (daysInStorage > 30) priority = "Alta";
  else if (daysInStorage > 20) priority = "Media";

  // Usar los campos zona y subzona que se guardan en la BD (actualizados por reglas)
  // Si no existen, usar la lógica de determinación original
  let area = (producto as any).subzona || '';
  let zoneId = (producto as any).zona || '';
  
  
  // Sistema completamente dinámico - sin hardcoded
  // Los productos deben tener sus campos zona y subzona correctamente asignados
  // Si no tienen valores, se mostrarán como undefined/null y se filtrarán correctamente

  return {
    id: String(producto.id) || `block-${index}`,
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
}; */

export default function Warehouse() {
  // Inyectar estilos CSS personalizados
  useEffect(() => {
    const styleId = 'custom-scrollbar-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = customScrollbarStyles;
      document.head.appendChild(style);
    }
  }, []);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Block[]>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedPalletGroup, setSelectedPalletGroup] = useState<Block[]>([]);
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subzonas, setSubzonas] = useState<any[]>([]);
  const [expandedSubzones, setExpandedSubzones] = useState<Set<string>>(new Set());
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [selectedMapDesign, setSelectedMapDesign] = useState("default");
  const [isMapDesignDropdownOpen, setIsMapDesignDropdownOpen] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  // const [assignmentRules, setAssignmentRules] = useState<any[]>([]);

  const { designs, loading: designsLoading, error: designsError } = useMapDesigns();

  // Cargar el mapa activo desde Firebase al montar el componente y cuando cambien los diseños
  useEffect(() => {
    // Solo ejecutar si los diseños están cargados
    if (!designsLoading && designs.length > 0) {
      loadActiveMapFromFirebase();
    }
  }, [designs, designsLoading]);

  // MODO TEST/ENTREGA: Cambiar a false para modo entrega (cargar todos los datos)
  const TEST_MODE = false; // true = modo test (solo 200 lecturas), false = modo entrega (todos los datos)

  // Función para cargar el mapa activo desde Firebase
  const loadActiveMapFromFirebase = () => {
    
    // Buscar el mapa que tenga activo: true
    const activeMap = designs.find(design => design.activo === true);
    if (activeMap?.id) {
      setSelectedMapDesign(activeMap.id);
    } else {
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
    if (!selectedDesign?.areas || selectedDesign.areas.length === 0) {
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

  // Función para toggle de subzonas expandidas
  const toggleSubzone = (subzoneId: string) => {
    setExpandedSubzones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subzoneId)) {
        newSet.delete(subzoneId);
      } else {
        newSet.add(subzoneId);
      }
      return newSet;
    });
  };

  // Cargar zonas y reglas de Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const zonesData = await getZones();
        
        setZones(zonesData);
        
        // Seleccionar primera zona por defecto (usando el mismo ordenamiento que el desplegable)
        if (zonesData.length > 0) {
          // Ordenar zonas según la posición en el mapa (misma lógica que getZonesOrderedByPosition)
          const orderedZones = zonesData.map(zone => {
            const map = designs.find((d) => d.id === selectedMapDesign);
            if (!map?.areas) {
              return { ...zone, x: Infinity, y: Infinity };
            }
            
            const mainArea = map.areas.find(area => {
              const normalizedAreaName = area.name.toLowerCase().replace(/_/g, '/');
              const normalizedZoneName = zone.name.toLowerCase().replace(/_/g, '/');
              return normalizedAreaName === normalizedZoneName;
            });

            if (mainArea) {
              return { ...zone, x: mainArea.x, y: mainArea.y };
            } else {
              return { ...zone, x: Infinity, y: Infinity };
            }
          }).sort((a, b) => {
            if (a.y !== b.y) {
              return a.y - b.y;
            }
            return a.x - b.x;
          });
          
          setSelectedZone(orderedZones[0].id);
        }
      } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        setError("Error al cargar configuración inicial");
      }
    };

    loadData();
  }, [selectedMapDesign]);

  // Cargar subzonas de Firebase
  useEffect(() => {
    const loadSubzonas = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const subzonasSnapshot = await getDocs(collection(db, 'subzonas'));
        const subzonasData = subzonasSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setSubzonas(subzonasData);
      } catch (error) {
        console.error("Error cargando subzonas:", error);
      }
    };

    loadSubzonas();
  }, []);

  // Cargar productos desde Firebase
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        
        const productosCollection = collection(db, "productos");
        const snapshot = await getDocs(productosCollection);
        
        
        if (snapshot.size === 0) {
          setError("La colección 'productos' está vacía");
          setBlocks([]);
          setLoading(false);
          return;
        }

        const docsToProcess = TEST_MODE ? snapshot.docs.slice(0, 200) : snapshot.docs;
        if (TEST_MODE) {
        }

        const productos = docsToProcess
          .map((doc, index) => {
            const data = doc.data() as any;
            return { ...data, id: doc.id, docIndex: index };
          })
          .filter(
            (producto) =>
              producto.estado_pedido !== "Entregado" &&
              producto.estado_pedido !== "En tránsito"
          );

        // Procesar productos de forma secuencial para evitar problemas con Promise
        const processedBlocks: Block[] = [];
        for (let i = 0; i < productos.length; i++) {
          const block = {
            ...await mapProductoToBlock(productos[i], [], i),
            posicion: productos[i].posicion ?? null,
            posicionFieldExists: Object.prototype.hasOwnProperty.call(productos[i], 'posicion')
          };
          processedBlocks.push(block);
        }

        const pendingPositionUpdates: { id: string; posicion: string | null }[] = [];

        processedBlocks.forEach((block) => {
          const currentPosition = typeof block.posicion === 'string' && block.posicion.trim() !== ''
            ? block.posicion.trim()
            : null;

          if (!block.zoneId || !block.area) {
            if (block.posicion !== null || !(block as any).posicionFieldExists) {
              block.posicion = null;
              pendingPositionUpdates.push({ id: block.id, posicion: null });
            }
            return;
          }

          if (!currentPosition) {
            if (block.posicion !== null || !(block as any).posicionFieldExists) {
              block.posicion = null;
              pendingPositionUpdates.push({ id: block.id, posicion: null });
            }
            return;
          }

          const slot = getSlotFromPosition(currentPosition);
          const zoneName = zones.find(z => z.id === block.zoneId)?.name || block.zoneId;

          if (!slot) {
            block.posicion = null;
            pendingPositionUpdates.push({ id: block.id, posicion: null });
            return;
          }

          const normalizedPosition = generarCodigoUbicacion(zoneName, block.area, slot.fila, slot.columna);
          if (isLegacyPositionCode(currentPosition) || currentPosition !== normalizedPosition) {
            block.posicion = normalizedPosition;
            pendingPositionUpdates.push({ id: block.id, posicion: normalizedPosition });
          } else {
            block.posicion = currentPosition;
          }

        });

        const usedPositionsByLocation = new Map<string, Set<string>>();
        processedBlocks.forEach((block) => {
          if (!block.zoneId || !block.area || !block.posicion) return;
          const key = `${block.zoneId}__${block.area}`;
          if (!usedPositionsByLocation.has(key)) usedPositionsByLocation.set(key, new Set());
          usedPositionsByLocation.get(key)?.add(block.posicion);
        });

        // Agrupar productos sin posición por zona/subzona para asignar posiciones consecutivas
        const blocksWithoutPosition = processedBlocks.filter(block => !block.zoneId || !block.area || !block.posicion);
        const groupedByLocation = new Map<string, Block[]>();
        blocksWithoutPosition.forEach(block => {
          if (!block.zoneId || !block.area) return;
          const locationKey = `${block.zoneId}__${block.area}`;
          if (!groupedByLocation.has(locationKey)) {
            groupedByLocation.set(locationKey, []);
          }
          groupedByLocation.get(locationKey)!.push(block);
        });

        // Asignar posiciones consecutivas a cada grupo
        groupedByLocation.forEach((blocks, locationKey) => {
          const [zoneId, area] = locationKey.split('__');
          const zoneName = zones.find(z => z.id === zoneId)?.name || zoneId;
          const subzonaConfig = subzonas.find(sub => sub.zonaId === zoneId && sub.nombre === area);
          const capacidad = subzonaConfig?.capacidadMaxima;
          const tarjetasPorFila = capacidad
            ? Math.ceil(capacidad / 2)
            : Math.ceil((blocks.length + 1) / 2);

          let positionIndex = 0;
          blocks.forEach((block) => {
            const fila = positionIndex < tarjetasPorFila ? 1 : 2;
            const columna = fila === 1 ? positionIndex + 1 : positionIndex - tarjetasPorFila + 1;
            const assignedPosition = generarCodigoUbicacion(zoneName, area, fila, columna);

            block.posicion = assignedPosition;
            pendingPositionUpdates.push({ id: block.id, posicion: assignedPosition });

            positionIndex++;
          });
        });

        for (let i = 0; i < pendingPositionUpdates.length; i += 500) {
          const batch = writeBatch(db);
          pendingPositionUpdates.slice(i, i + 500).forEach((item) => {
            batch.update(doc(db, 'productos', item.id), { posicion: item.posicion });
          });
          await batch.commit();
        }

        setBlocks(processedBlocks);
        
        setError(null);
      } catch (err) {
        console.error("❌ Error cargando productos:", err);
        setError(`Error: ${(err as Error).message}`);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    };

    if (zones.length > 0 && subzonas.length > 0) {
      fetchProductos();
    }
  }, [zones, subzonas]);

  const selectSearchResult = (block: Block) => {
    const blockZone = getBlockZone(block);
    const blockSubzone = getBlockSubzone(block);
    const palletsAtPosition = blocks.filter(currentBlock =>
      getBlockZone(currentBlock) === blockZone &&
      getBlockSubzone(currentBlock) === blockSubzone &&
      currentBlock.posicion &&
      currentBlock.posicion === block.posicion
    );
    const subzoneConfig = subzonas.find(sub =>
      sub.zonaId === blockZone &&
      sub.nombre === blockSubzone
    );

    setSelectedZone(blockZone);
    setSelectedBlock(block);
    setSelectedPalletGroup(palletsAtPosition.length > 0 ? palletsAtPosition : [block]);
    setSearchResults([]);

    if (subzoneConfig?.id) {
      setExpandedSubzones(current => new Set([...current, subzoneConfig.id]));
    }
  };

  const handleSearch = () => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setSearchResults([]);
      return;
    }

    const foundBlocks = blocks.filter(b => {
      const searchableFields = [
        b.id,
        b.codigo_barra,
        b.client,
        b.numeroCliente,
        b.numeroLineaPedido,
        b.estadoPedido,
        b.empresa,
        b.referencias,
        b.posicion
      ];

      return searchableFields.some(value =>
        String(value ?? "").toLowerCase().includes(term)
      );
    });

    const uniqueFoundBlocks = foundBlocks.filter((block, index, self) => {
      const blockKey = block.codigo_barra?.trim() || block.id;
      return self.findIndex(currentBlock => (currentBlock.codigo_barra?.trim() || currentBlock.id) === blockKey) === index;
    });

    if (uniqueFoundBlocks.length === 1) {
      selectSearchResult(uniqueFoundBlocks[0]);
      return;
    }

    setSearchResults(uniqueFoundBlocks);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };


  const getSelectedPallets = (): Block[] => {
    if (selectedPalletGroup.length > 0) return selectedPalletGroup;
    return selectedBlock ? [selectedBlock] : [];
  };

  const getSelectedPalletsExpandedByPosition = (): Block[] => {
    const selectedPallets = getSelectedPallets();
    const selectedIds = new Set(selectedPallets.map(pallet => pallet.id));
    const selectedPositions = selectedPallets
      .filter(pallet => pallet.posicion)
      .map(pallet => ({
        zoneId: getBlockZone(pallet),
        subzone: getBlockSubzone(pallet),
        posicion: pallet.posicion
      }));

    return blocks.filter(block =>
      selectedIds.has(block.id) ||
      selectedPositions.some(position =>
        getBlockZone(block) === position.zoneId &&
        getBlockSubzone(block) === position.subzone &&
        block.posicion === position.posicion
      )
    );
  };

  const getAvailablePositions = (zoneId: string, subzone: string): string[] => {
    const selectedPallets = getSelectedPalletsExpandedByPosition();
    const movingIds = selectedPallets.map(pallet => pallet.id);
    const movingPositions = selectedPallets
      .filter(pallet => getBlockZone(pallet) === zoneId && getBlockSubzone(pallet) === subzone && pallet.posicion)
      .map(pallet => pallet.posicion?.trim());
    const zoneName = zones.find(z => z.id === zoneId)?.name || zoneId;
    const subzonaConfig = subzonas.find(sub => sub.zonaId === zoneId && sub.nombre === subzone);
    const capacidad = subzonaConfig?.capacidadMaxima;
    const blocksInSubzone = blocks.filter(block => getBlockZone(block) === zoneId && getBlockSubzone(block) === subzone);
    const maxColumnInUse = Math.max(
      0,
      ...blocksInSubzone
        .map(block => getSlotFromPosition(block.posicion)?.columna || 0)
    );
    const tarjetasPorFila = capacidad
      ? Math.ceil(capacidad / 2)
      : Math.max(maxColumnInUse + 1, Math.ceil((blocksInSubzone.length + 1) / 2), 1);
    const occupiedPositions = new Set(
      blocks
        .map(block => ({
          ...block,
          normalizedPosition: typeof block.posicion === 'string' ? block.posicion.trim() : null
        }))
        .filter(block => getBlockZone(block) === zoneId && getBlockSubzone(block) === subzone && !movingIds.includes(block.id) && block.normalizedPosition && !movingPositions.includes(block.normalizedPosition))
        .map(block => block.normalizedPosition)
    );
    const positions: string[] = [];

    for (let columna = 1; columna <= tarjetasPorFila; columna++) {
      const posicion = generarCodigoUbicacion(zoneName, subzone, 1, columna);
      if (!occupiedPositions.has(posicion)) positions.push(posicion);
    }

    for (let columna = 1; columna <= tarjetasPorFila; columna++) {
      const posicion = generarCodigoUbicacion(zoneName, subzone, 2, columna);
      if (!occupiedPositions.has(posicion)) positions.push(posicion);
    }

    return positions;
  };

  const handleMovePallets = async (zoneId: string, subzone: string, position: string) => {
    const palletsToMove = getSelectedPalletsExpandedByPosition();
    if (palletsToMove.length === 0) return;
    if (!position) {
      setMoveError('Selecciona una posición de destino');
      return;
    }

    setMoveLoading(true);
    setMoveError(null);

    try {
      const batch = writeBatch(db);
      const newPosition = position;

      palletsToMove.forEach((pallet) => {
        const productRef = doc(db, 'productos', pallet.id);
        batch.update(productRef, { zona: zoneId, subzona: subzone, posicion: newPosition });
      });

      await batch.commit();

      setBlocks((currentBlocks) =>
        currentBlocks.map((block) =>
          palletsToMove.some((pallet) => pallet.id === block.id)
            ? { ...block, zoneId, area: subzone, posicion: newPosition }
            : block
        )
      );

      if (selectedBlock) {
        setSelectedBlock({ ...selectedBlock, zoneId, area: subzone, posicion: newPosition });
      }
      setSelectedPalletGroup((currentGroup) =>
        currentGroup.map((pallet) => ({ ...pallet, zoneId, area: subzone, posicion: newPosition }))
      );
      setSelectedZone(zoneId);
      setMoveMode(false);
    } catch {
      setMoveError('Error al mover el pallet');
    } finally {
      setMoveLoading(false);
    }
  };

  const handleDeletePallets = async () => {
    const palletsToDelete = getSelectedPalletsExpandedByPosition();
    if (palletsToDelete.length === 0) return;

    const confirmed = window.confirm(`¿Eliminar ${palletsToDelete.length} pedido${palletsToDelete.length === 1 ? '' : 's'} del palet?`);
    if (!confirmed) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const batch = writeBatch(db);

      for (const pallet of palletsToDelete) {
        const productRef = doc(db, 'productos', pallet.id);
        const deletedProductRef = doc(db, 'productos_eliminados', pallet.id);
        const productSnapshot = await getDoc(productRef);

        if (productSnapshot.exists()) {
          const deletedProductData = productSnapshot.data();
          delete deletedProductData.posicion;
          batch.set(deletedProductRef, deletedProductData);
          batch.delete(productRef);
        }
      }

      await batch.commit();

      const deletedIds = new Set(palletsToDelete.map((pallet) => pallet.id));
      setBlocks((currentBlocks) => currentBlocks.filter((block) => !deletedIds.has(block.id)));
      setSelectedBlock(null);
      setSelectedPalletGroup([]);
      setMoveMode(false);
      setDeleteError(null);
    } catch {
      setDeleteError('Error al eliminar el pallet');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Función para ordenar zonas según su posición en el mapa
  const handleReleasePalletPosition = async () => {
    const palletsToRelease = getSelectedPalletsExpandedByPosition();
    if (palletsToRelease.length === 0) return;

    const confirmed = window.confirm(
      `Liberar la ubicacion de ${palletsToRelease.length} pedido${palletsToRelease.length === 1 ? '' : 's'} sin eliminarlo${palletsToRelease.length === 1 ? '' : 's'}?`
    );
    if (!confirmed) return;

    setReleaseLoading(true);
    setReleaseError(null);

    try {
      const batch = writeBatch(db);

      palletsToRelease.forEach((pallet) => {
        const productRef = doc(db, 'productos', pallet.id);
        batch.update(productRef, { zona: null, subzona: null, posicion: null });
      });

      await batch.commit();

      const releasedIds = new Set(palletsToRelease.map((pallet) => pallet.id));
      setBlocks((currentBlocks) =>
        currentBlocks.map((block) =>
          releasedIds.has(block.id)
            ? { ...block, zoneId: '', area: '', posicion: null }
            : block
        )
      );
      setSelectedBlock(null);
      setSelectedPalletGroup([]);
      setMoveMode(false);
      setReleaseError(null);
    } catch {
      setReleaseError('Error al liberar el hueco');
    } finally {
      setReleaseLoading(false);
    }
  };

const getZonesOrderedByPosition = () => {
  if (!selectedMapDesign || selectedMapDesign === "default") {
    return zones;
  }

  const map = designs.find((d) => d.id === selectedMapDesign);
  if (!map?.areas) {
    return zones;
  }

  // Para cada zona, encontrar su área principal en el mapa y obtener sus coordenadas
  const zonesWithPosition = zones.map(zone => {
    // Buscar el área principal que corresponde a esta zona por nombre
    const mainArea = map.areas.find(area => {
      // Normalizar ambos nombres: reemplazar guiones bajos con diagonales y viceversa
      const normalizedAreaName = area.name.toLowerCase().replace(/_/g, '/');
      const normalizedZoneName = zone.name.toLowerCase().replace(/_/g, '/');
      
      // Comparar nombres normalizados (ignorando mayúsculas/minúsculas y guiones vs diagonales)
      return normalizedAreaName === normalizedZoneName;
    });

    if (mainArea) {
      return {
        ...zone,
        x: mainArea.x,
        y: mainArea.y,
        areaName: mainArea.name
      };
    } else {
      return {
        ...zone,
        x: Infinity,
        y: Infinity,
        areaName: null
      };
    }
  });

  // Ordenar por Y ascendente (arriba a abajo), y dentro de cada Y, por X ascendente (izquierda a derecha)
  const orderedZones = zonesWithPosition.sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y; // Primero ordenar por Y (arriba a abajo)
    }
    return a.x - b.x; // Si mismo Y, ordenar por X (izquierda a derecha)
  });

  return orderedZones;
};

// Función para renderizar subzonas según el mapa activo
const renderSubzonesFromMap = () => {
  if (!selectedMapDesign || selectedMapDesign === "default") {
    return null;
  }
  
  const map = designs.find((d) => d.id === selectedMapDesign);
  if (!map?.areas || map.areas.length === 0) {
    return null;
  }
  
  const selectedZoneConfig = zones.find(z => z.id === selectedZone);
  if (!selectedZoneConfig) {
    return null;
  }
  
  // Filtrar todas las subáreas del mapa que pertenecen a la zona seleccionada
  const allSubAreas = map.areas.flatMap(area => 
    (area.subAreas || []).map(subArea => ({
      ...subArea,
      areaName: area.name,
      areaX: area.x,
      areaY: area.y,
      areaWidth: area.width,
      areaHeight: area.height
    }))
  );
  
  const mapAreas = allSubAreas.filter(subArea => {
    return subArea.areaId === selectedZone;
  });
  
  if (mapAreas.length === 0) {
    return null;
  }

  // Calcular el contenedor relativo basado en las dimensiones del mapa
  const maxX = Math.max(...mapAreas.map(area => area.x + area.width));
  const maxY = Math.max(...mapAreas.map(area => area.y + area.height));

  return (
    <div 
      className="relative bg-white/40 dark:bg-slate-950/40 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-12 overflow-hidden shadow-inner"
      style={{ 
        width: `${maxX + 50}px`, 
        height: `${maxY + 50}px`,
        position: 'relative'
      }}
    >
      {mapAreas.map((area, index) => {
        // Calcular posición y tamaño en píxeles
        const left = area.x;
        const top = area.y;
        const width = area.width;
        const height = area.height;

        return (
          <div
            key={`${area.id}-${index}`}
            className="absolute bg-brand-100 dark:bg-brand-900/30 border-2 border-brand-500 rounded-xl flex items-center justify-center"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              position: 'absolute'
            }}
          >
            <span className="text-brand-800 dark:text-brand-200 font-bold text-sm">
              {area.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};

  const selectedPalletZone = getBlockZone(getSelectedPallets()[0] || selectedBlock || ({} as Block));
  const orderedMoveZones = getZonesOrderedByPosition();
  const moveZones = selectedPalletZone
    ? [
        ...orderedMoveZones.filter((zone) => zone.id === selectedPalletZone),
        ...orderedMoveZones.filter((zone) => zone.id !== selectedPalletZone)
      ]
    : orderedMoveZones;

  const moveOptions = moveZones.flatMap((zone) => {
    const subzonesFromCollection = subzonas
      .filter((subzona) => subzona.zonaId === zone.id)
      .map((subzona) => ({
        zoneId: zone.id,
        zoneName: zone.name,
        subzone: subzona.nombre || subzona.name || subzona.id
      }));

    if (subzonesFromCollection.length > 0) return subzonesFromCollection;

    return Object.keys(zone.subzones || {}).map((subzone) => ({
      zoneId: zone.id,
      zoneName: zone.name,
      subzone
    }));
  });

  return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white transition-colors duration-300 font-sans">
      
      {loading && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-2xl">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl text-center">
            <div className="animate-spin w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full mx-auto mb-4"></div>
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
        <div className="bg-brand-100 dark:bg-brand-900/30 border border-brand-400 dark:border-brand-700 px-6 py-4 rounded-2xl m-6">
          <p className="font-bold text-brand-700 dark:text-brand-200">
            ✅ {blocks.length} productos cargados · {blocks.filter(block => block.zoneId && block.area).length} productos posicionados
          </p>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-6 p-6">
        
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shrink-0">
          <h1 className="text-base font-semibold flex items-center gap-2 tracking-tight text-slate-900 dark:text-white">
            <Zap size={18} className="text-brand-600 dark:text-brand-400" /> Triniglass <span className="text-slate-500 dark:text-slate-400 font-normal text-sm">| Gestión Dinámica</span>
          </h1>
          <div className="flex gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700"></div> <span>Libre</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-brand-400"></div> <span>&lt; 10d</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-400"></div> <span>10-20d</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400"></div> <span>20-30d</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500"></div> <span>&gt; 30d</span></div>
             <button
               onClick={() => setShowRuleEditor(true)}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded-md text-xs font-medium transition-colors"
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
              className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3.5 text-sm font-semibold shadow-md uppercase"
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
        <div className="h-[350px] relative bg-white dark:bg-black rounded-2xl border border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] shrink-0" style={{ paddingLeft: '80px', paddingRight: '80px', paddingTop: '24px', paddingBottom: '24px' }}>
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
                    const areaEndCol = areaStartCol + Math.floor(area.width / 40) - 1;
                    
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
              <button onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3.5 text-sm font-semibold shadow-md uppercase">
                <Layers size={18} className="text-brand-500" />
                <span>{zones.find(z => z.id === selectedZone)?.name}</span>
                <ChevronDown size={16} />
              </button>
              {isZoneDropdownOpen && (
                <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {getZonesOrderedByPosition().map(zone => (
                    <button key={zone.id} className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-brand-50 dark:hover:bg-slate-700 flex items-center justify-between" onClick={() => { setSelectedZone(zone.id); setIsZoneDropdownOpen(false); setSelectedBlock(null); setSelectedPalletGroup([]); }}>
                      {zone.name} {selectedZone === zone.id && <Check size={16} className="text-brand-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <button type="button" onClick={handleSearch} className="absolute left-5 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-blue-500 transition-colors">
                <Search size={18} />
              </button>
              <input type="text" placeholder="Buscar por código de barras o cliente..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-14 pr-6 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 dark:placeholder:text-slate-400" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSearchResults([]); }} onKeyDown={handleSearchKeyDown} />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-3 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50">
                  <div className="px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    {searchResults.length} palets encontrados
                  </div>
                  {searchResults.map(block => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => selectSearchResult(block)}
                      className="w-full text-left px-5 py-4 hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {block.codigo_barra || block.id}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {block.client}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {zones.find(z => z.id === getBlockZone(block))?.name || getBlockZone(block)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {getBlockSubzone(block)} {block.posicion ? `· ${block.posicion}` : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {renderSubzonesFromMap()}

          {/* Contenedor para tarjetas de palets */}
          <div className="w-full h-auto bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {zones.find(z => z.id === selectedZone)?.name}
            </h3>
            
            {/* Divs para cada subzona posicionados según el mapa */}
            {(() => {
              const map = designs.find((d) => d.id === selectedMapDesign);
              if (!map?.areas) return null;
              
              // Filtrar subzonas de Firebase por zonaId
              const zoneSubzonas = subzonas.filter(sub => sub.zonaId === selectedZone);
              
              if (zoneSubzonas.length === 0) return null;
              
              return (
                <div className="space-y-4">
                  {zoneSubzonas.map((subZone) => {
                    // Determinar si hay límite de capacidad
                    let tieneLimite = subZone.capacidadMaxima !== null && subZone.capacidadMaxima !== undefined;
                    let capacidad = tieneLimite ? subZone.capacidadMaxima! : null;
                    
                    // Calcular tarjetas por fila y total
                    let tarjetasPorFila: number;
                    let totalTarjetas: number;
                    
                    if (tieneLimite && capacidad) {
                      // Con límite: dividir en 2 filas
                      tarjetasPorFila = Math.ceil(capacidad / 2);
                      totalTarjetas = capacidad;
                    } else {
                      // Sin límite: se calculará después según el número de tarjetas reales
                      tarjetasPorFila = 0;
                      totalTarjetas = 0;
                    }
                    
                    // Filtrar palets que pertenecen a esta subzona (usando campos actualizados por reglas)
                    const paletsEnSubzona = blocks.filter(block => {
                      // Usar el campo actualizado por movimiento/reglas
                      const blockArea = block.area || (block as any).subzona;

                      // Solo filtrar por nombre de subzona, no por zona
                      return blockArea === subZone.nombre;
                    });

                    const capacidadFirestore = Number(subZone.capacidadMaxima);
                    const capacidadFallback = getDefaultSubzoneCapacity(selectedZone, subZone.nombre);
                    const capacidadObservada = getObservedCardsPerRow(paletsEnSubzona) * 2;
                    capacidad = Number.isFinite(capacidadFirestore) && capacidadFirestore > 0
                      ? capacidadFirestore
                      : capacidadFallback ?? (capacidadObservada > 0 ? capacidadObservada : null);
                    tieneLimite = capacidad !== null;
                    if (tieneLimite && capacidad) {
                      tarjetasPorFila = Math.ceil(capacidad / 2);
                      totalTarjetas = capacidad;
                    }
                    
                    // Depurar filtrado para primeras subzonas
                    if (zoneSubzonas.indexOf(subZone) < 3) {
                      console.log(`🎯 Subzona "${subZone.nombre}" (${selectedZone}):`, {
                        total_blocks: blocks.length,
                        palets_filtrados: paletsEnSubzona.length,
                        subzona_nombre: subZone.nombre,
                        zona_seleccionada: selectedZone,
                        palets_encontrados: paletsEnSubzona.slice(0, 3).map(p => ({
                          codigo: p.codigo_barra,
                          zona: (p as any).zona || p.zoneId,
                          subzona: (p as any).subzona || p.area
                        }))
                      });
                    }
                    
                    // Agrupar palets por código de barras para detectar agrupaciones (sin Map)
                    let tarjetas: {
                      id: string;
                      occupied: boolean;
                      daysInStorage: number;
                      pallet?: Block;
                      isGrouped?: boolean;
                      groupCount?: number;
                      allPalets?: Block[];
                    }[] = [];

                    if (tieneLimite && capacidad) {
                      tarjetas = Array.from({ length: totalTarjetas }, (_, index) => {
                        const fila = index < tarjetasPorFila ? 1 : 2;
                        const columna = index < tarjetasPorFila ? index + 1 : index - tarjetasPorFila + 1;
                        return {
                          id: `${subZone.id}-vacio-${fila}-${columna}`,
                          occupied: false,
                          daysInStorage: 0
                        };
                      });
                    }
                    
                    // Primero, identificar productos duplicados usando clave de agrupación
                    const clavesProcesadas: string[] = [];
                    
                    paletsEnSubzona.forEach(pallet => {
                      const claveAgrupacion = generarClaveAgrupacion(pallet);
                      
                      if (!clavesProcesadas.includes(claveAgrupacion)) {
                        // Primer palet con esta clave - buscar si hay más
                        const paletsMismaClave = paletsEnSubzona.filter(p => 
                          generarClaveAgrupacion(p) === claveAgrupacion
                        );
                        
                        if (paletsMismaClave.length > 1) {
                          // Múltiples productos con misma clave - tarjeta especial agrupada
                          const tarjetaAgrupada = {
                            id: claveAgrupacion,
                            occupied: true,
                            daysInStorage: Math.min(...paletsMismaClave.map(p => p.daysInStorage)),
                            pallet: paletsMismaClave[0],
                            isGrouped: true,
                            groupCount: paletsMismaClave.length,
                            allPalets: paletsMismaClave
                          };
                          const slot = getSlotFromPosition(paletsMismaClave[0].posicion);
                          const targetIndex = slot ? (slot.fila === 1 ? slot.columna - 1 : tarjetasPorFila + slot.columna - 1) : tarjetas.findIndex(t => !t.occupied);
                          if (tieneLimite && targetIndex >= 0 && targetIndex < tarjetas.length) {
                            tarjetas[targetIndex] = tarjetaAgrupada;
                          } else {
                            tarjetas.push(tarjetaAgrupada);
                          }
                        } else {
                          // Producto individual
                          const tarjetaIndividual = {
                            id: pallet.id,
                            occupied: true,
                            daysInStorage: pallet.daysInStorage,
                            pallet: pallet,
                            isGrouped: false,
                            groupCount: 1,
                            allPalets: [pallet]
                          };
                          const slot = getSlotFromPosition(pallet.posicion);
                          const targetIndex = slot ? (slot.fila === 1 ? slot.columna - 1 : tarjetasPorFila + slot.columna - 1) : tarjetas.findIndex(t => !t.occupied);
                          if (tieneLimite && targetIndex >= 0 && targetIndex < tarjetas.length) {
                            tarjetas[targetIndex] = tarjetaIndividual;
                          } else {
                            tarjetas.push(tarjetaIndividual);
                          }
                        }
                        
                        clavesProcesadas.push(claveAgrupacion);
                      }
                    });
                    
                    // Calcular filas dinámicamente si no hay límite
                    if (!tieneLimite) {
                      tarjetasPorFila = Math.ceil(tarjetas.length / 2);
                      totalTarjetas = tarjetas.length;
                    }
                    
                    // Dividir en dos filas
                    const filaSuperior = tarjetas.slice(0, tarjetasPorFila);
                    const filaInferior = tarjetas.slice(tarjetasPorFila, totalTarjetas);
                    
                    const isExpanded = expandedSubzones.has(subZone.id);
                    const selectTarjeta = (tarjeta: {
                      occupied: boolean;
                      pallet?: Block;
                      allPalets?: Block[];
                      isGrouped?: boolean;
                    }, fila: number, columna: number) => {
                      if (tarjeta.occupied && tarjeta.pallet) {
                        const cardPosition = generarCodigoUbicacion(
                          zones.find(z => z.id === selectedZone)?.name || '',
                          subZone.nombre,
                          fila,
                          columna
                        );
                        const palletsAtPosition = blocks.filter(block =>
                          getBlockZone(block) === selectedZone &&
                          getBlockSubzone(block) === subZone.nombre &&
                          block.posicion === cardPosition
                        );
                        setSelectedBlock(tarjeta.pallet);
                        setSelectedPalletGroup(tarjeta.isGrouped && tarjeta.allPalets ? tarjeta.allPalets : (palletsAtPosition.length > 0 ? palletsAtPosition : [tarjeta.pallet]));
                      }
                    };
                    
                    return (
                      <div key={subZone.id} className="space-y-3">
                        {/* Nombre de la subzona (clicable) */}
                        <button
                          onClick={() => toggleSubzone(subZone.id)}
                          className="w-full bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl border-2 border-brand-200 dark:border-slate-600 flex items-center justify-between shadow-lg hover:shadow-xl hover:shadow-brand-500/20 dark:hover:shadow-slate-500/20 p-5 transition-all duration-300 group relative overflow-hidden"
                        >
                          {/* Efecto de brillo */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                          
                          <div className="relative flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-gradient-to-r from-brand-400 to-indigo-500 rounded-full animate-pulse"></div>
                              <span className="text-base font-bold bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                {subZone.nombre}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {tieneLimite && capacidad 
                                  ? `${tarjetas.filter(t => t.occupied).length}/${capacidad} ocupados`
                                  : `${tarjetas.filter(t => t.occupied).length} ocupados`
                                }
                              </span>
                              <ChevronDown 
                                className={`text-brand-500 dark:text-brand-400 transition-all duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                size={20}
                              />
                            </div>
                          </div>
                        </button>
                        
                        {/* Tarjetas - solo se muestran si está expandido */}
                        {isExpanded && (
                          <div className="overflow-x-auto scrollbar-horizontal-custom">
                            <div className="space-y-4 pl-6 min-w-max py-4">
                              {/* Fila superior */}
                              <div className="flex justify-center gap-3">
                                {filaSuperior.map((tarjeta, index) => (
                                  <div
                                    key={tarjeta.id}
                                    className="group relative"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-indigo-400 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></div>
                                    {!tarjeta.occupied && (
                                      <span className="pointer-events-none absolute top-[72px] left-1/2 -translate-x-1/2 z-10 text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                                        {generarCodigoUbicacion(
                                          zones.find(z => z.id === selectedZone)?.name || '',
                                          subZone.nombre,
                                          1,
                                          index + 1
                                        )}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => selectTarjeta(tarjeta, 1, index + 1)}
                                      className={`relative rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-md hover:shadow-lg hover:shadow-brand-500/30 min-w-[110px] h-[110px] ${
                                        tarjeta.occupied 
                                          ? `bg-gradient-to-br from-white to-brand-50 dark:from-slate-800 dark:to-slate-700 ${getStorageBorderClasses(tarjeta.daysInStorage)} hover:scale-105`
                                          : `bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:scale-105`
                                      }`}
                                    >
                                      {tarjeta.occupied && tarjeta.pallet ? (
                                        <>
                                          {tarjeta.isGrouped && tarjeta.groupCount && tarjeta.groupCount > 1 ? (
                                            <>
                                              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-700 dark:to-pink-700 rounded-full flex items-center justify-center">
                                                <Layers size={16} className="text-purple-600 dark:text-purple-300" />
                                              </div>
                                              <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wide truncate max-w-[90px] text-center" title={tarjeta.pallet.codigo_barra || ''}>
                                                {tarjeta.pallet.codigo_barra || '\u00A0'}
                                              </span>
                                              <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                                <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                                  ×{tarjeta.groupCount}
                                                </span>
                                                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                  {tarjeta.daysInStorage}d
                                                </span>
                                              </div>
                                              <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide text-center">
                                                {generarCodigoUbicacion(
                                                  zones.find(z => z.id === selectedZone)?.name || '',
                                                  subZone.nombre,
                                                  1,
                                                  index + 1
                                                )}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-brand-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                                                <Package size={16} className="text-brand-500 dark:text-brand-400" />
                                              </div>
                                              <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wide truncate max-w-[90px] text-center" title={tarjeta.pallet.codigo_barra || ''}>
                                                {tarjeta.pallet.codigo_barra || '\u00A0'}
                                              </span>
                                              <span className="absolute top-16 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 dark:text-slate-400">
                                                {tarjeta.daysInStorage}d
                                              </span>
                                              <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wide text-center">
                                                {generarCodigoUbicacion(
                                                  zones.find(z => z.id === selectedZone)?.name || '',
                                                  subZone.nombre,
                                                  1,
                                                  index + 1
                                                )}
                                              </span>
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                                            <Box size={16} className="text-gray-400 dark:text-gray-500" />
                                          </div>
                                          <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate max-w-[90px] text-center">
                                            {'\u00A0'}
                                          </span>
                                          <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                            <span className="text-transparent px-1.5 py-0.5 rounded-full font-bold">
                                              {'\u00A0'}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                              {'\u00A0'}
                                            </span>
                                          </div>
                                          <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                                            {'\u00A0'}
                                          </span>
                                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                            Vacío
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {/* Fila inferior */}
                              <div className="flex justify-center gap-3">
                                {filaInferior.map((tarjeta, index) => (
                                  <div
                                    key={tarjeta.id}
                                    className="group relative"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-indigo-400 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></div>
                                    {!tarjeta.occupied && (
                                      <span className="pointer-events-none absolute top-[72px] left-1/2 -translate-x-1/2 z-10 text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                                        {generarCodigoUbicacion(
                                          zones.find(z => z.id === selectedZone)?.name || '',
                                          subZone.nombre,
                                          2,
                                          index + 1
                                        )}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => selectTarjeta(tarjeta, 2, index + 1)}
                                      className={`relative rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-md hover:shadow-lg hover:shadow-brand-500/30 min-w-[110px] h-[110px] ${
                                        tarjeta.occupied 
                                          ? `bg-gradient-to-br from-white to-brand-50 dark:from-slate-800 dark:to-slate-700 ${getStorageBorderClasses(tarjeta.daysInStorage)} hover:scale-105`
                                          : `bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:scale-105`
                                      }`}
                                    >
                                      {tarjeta.occupied && tarjeta.pallet ? (
                                        <>
                                          {tarjeta.isGrouped && tarjeta.groupCount && tarjeta.groupCount > 1 ? (
                                            <>
                                              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-700 dark:to-pink-700 rounded-full flex items-center justify-center">
                                                <Layers size={16} className="text-purple-600 dark:text-purple-300" />
                                              </div>
                                              <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wide truncate max-w-[90px] text-center" title={tarjeta.pallet.codigo_barra || ''}>
                                                {tarjeta.pallet.codigo_barra || '\u00A0'}
                                              </span>
                                              <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                                <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                                  ×{tarjeta.groupCount}
                                                </span>
                                                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                  {tarjeta.daysInStorage}d
                                                </span>
                                              </div>
                                              <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide text-center">
                                                {generarCodigoUbicacion(
                                                  zones.find(z => z.id === selectedZone)?.name || '',
                                                  subZone.nombre,
                                                  2,
                                                  index + 1
                                                )}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-brand-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                                                <Package size={16} className="text-brand-500 dark:text-brand-400" />
                                              </div>
                                              <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wide truncate max-w-[90px] text-center" title={tarjeta.pallet.codigo_barra || ''}>
                                                {tarjeta.pallet.codigo_barra || '\u00A0'}
                                              </span>
                                              <span className="absolute top-16 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 dark:text-slate-400">
                                                {tarjeta.daysInStorage}d
                                              </span>
                                              <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wide text-center">
                                                {generarCodigoUbicacion(
                                                  zones.find(z => z.id === selectedZone)?.name || '',
                                                  subZone.nombre,
                                                  2,
                                                  index + 1
                                                )}
                                              </span>
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                                            <Box size={16} className="text-gray-400 dark:text-gray-500" />
                                          </div>
                                          <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate max-w-[90px] text-center">
                                            {'\u00A0'}
                                          </span>
                                          <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                            <span className="text-transparent px-1.5 py-0.5 rounded-full font-bold">
                                              {'\u00A0'}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                              {'\u00A0'}
                                            </span>
                                          </div>
                                          <span className="absolute top-22 left-1/2 -translate-x-1/2 text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                                            {'\u00A0'}
                                          </span>
                                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                            Vacío
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* SIDEBAR DE DETALLES DEL PALET */}
      {selectedBlock && (
        <div className="fixed top-0 right-0 h-full w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 shadow-[-20px_0_60px_rgba(0,0,0,0.2)] animate-in slide-in-from-right duration-500 flex flex-col overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-500 rounded-2xl text-white shadow-lg">
                <Package size={24} />
              </div>
              <h2 className="text-xl font-semibold uppercase italic tracking-tight text-slate-800 dark:text-white leading-none">
                Detalle del Palet
              </h2>
            </div>
            <button
              onClick={() => {
                setSelectedBlock(null);
                setSelectedPalletGroup([]);
                setMoveMode(false);
                setMoveError(null);
                setDeleteError(null);
                setReleaseError(null);
              }}
              className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500"
            >
              <X size={32} strokeWidth={3}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-vertical-custom">
            <div className="bg-gradient-to-br from-brand-100 via-brand-50 to-white dark:from-brand-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl p-10 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden shadow-lg">
              <div className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-semibold mb-2 tracking-[0.4em]">
                GLASS ID
              </div>
              <div className="text-5xl font-semibold tracking-tight text-brand-600 dark:text-brand-400 leading-none break-all uppercase drop-shadow-lg">
                {selectedBlock.codigo_barra || 'Sin código'}
              </div>
              <div className="flex justify-center gap-2 mt-6">
                <div className="inline-flex px-4 py-1.5 rounded-full bg-brand-500/10 text-brand-500 text-[11px] font-semibold uppercase tracking-wide border border-brand-500/20">
                  Prioridad {selectedBlock.priority || 'N/A'}
                </div>
                {selectedPalletGroup.length > 1 && (
                  <div className="inline-flex px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-500 text-[11px] font-semibold uppercase tracking-wide border border-purple-500/20">
                    {selectedPalletGroup.length} pedidos
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 mt-2 grid grid-cols-1 gap-3 shadow-inner">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Código de barras</span><span className="text-sm font-mono break-all">{selectedBlock.codigo_barra || 'Sin código'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">ID documento</span><span className="text-sm font-mono break-all">{selectedBlock.id}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Cliente</span><span className="text-sm font-mono">{selectedBlock.client || 'Desconocido'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Dimensiones totales</span><span className="text-sm font-mono">{selectedPalletGroup.length > 1 ? getAggregatedDimensions(selectedPalletGroup) : selectedBlock.dimensions || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Peso total</span><span className="text-sm font-mono">{selectedPalletGroup.length > 1 ? getAggregatedWeight(selectedPalletGroup) : selectedBlock.weight || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Estado pedido</span><span className="text-sm font-mono">{selectedBlock.estadoPedido || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Referencia pedido</span><span className="text-sm font-mono">{selectedBlock.referencias || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Fecha entrega</span><span className="text-sm font-mono">{selectedBlock.lastUpdate || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Días en almacén</span><span className="text-sm font-mono">{selectedBlock.daysInStorage}d</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Zona</span><span className="text-sm font-mono">{zones.find(z => z.id === selectedBlock.zoneId)?.name || selectedBlock.zoneId || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Subzona</span><span className="text-sm font-mono">{selectedBlock.area || 'N/A'}</span></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 flex flex-col"><span className="font-bold text-xs text-blue-700 dark:text-blue-300 mb-1">Posicion</span><span className="text-sm font-mono">{selectedBlock.posicion || 'N/A'}</span></div>
            </div>

            {selectedPalletGroup.length > 1 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-2xl p-6 border border-purple-100 dark:border-purple-700 mt-2 grid grid-cols-1 gap-3 shadow-inner">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
                  Pedidos agrupados
                </h3>
                {selectedPalletGroup.map((pallet, index) => (
                  <div key={pallet.id} className="rounded-xl bg-purple-50 dark:bg-purple-950/30 p-3 flex flex-col border border-purple-100 dark:border-purple-800">
                    <span className="font-bold text-xs text-purple-700 dark:text-purple-300 mb-1">Pedido {index + 1}</span>
                    <span className="text-sm font-mono break-all">{pallet.referencias || pallet.numeroLineaPedido || pallet.id}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{pallet.client || 'Cliente desconocido'} · {pallet.dimensions || 'N/A'} · {pallet.weight || 'N/A'} · {pallet.type || 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-row flex-wrap gap-3 mt-6 mb-2 justify-center">
              <button
                className={`bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all ${moveMode ? 'ring-2 ring-green-400' : ''}`}
                onClick={() => {
                  setMoveError(null);
                  setReleaseError(null);
                  setMoveMode((currentMode) => !currentMode);
                }}
                disabled={moveLoading || deleteLoading || releaseLoading}
              >
                <Maximize2 size={16}/> {moveMode ? 'Cancelar' : 'Mover'}
              </button>
              <button
                className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all"
                disabled={moveLoading || deleteLoading || releaseLoading}
              >
                <Package size={16}/> Despachar
              </button>
              <button
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all"
                onClick={handleReleasePalletPosition}
                disabled={moveLoading || deleteLoading || releaseLoading}
              >
                <Box size={16}/> {releaseLoading ? 'Liberando...' : 'Liberar hueco'}
              </button>
              <button
                className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow active:scale-95 transition-all"
                onClick={handleDeletePallets}
                disabled={moveLoading || deleteLoading || releaseLoading}
              >
                <X size={16}/> {deleteLoading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>

            {deleteError && <div className="text-red-500 text-xs text-center font-bold">{deleteError}</div>}
            {releaseError && <div className="text-red-500 text-xs text-center font-bold">{releaseError}</div>}
          </div>
        </div>
      )}

      {selectedBlock && moveMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-brand-200 dark:border-brand-700 shadow-2xl p-8 flex flex-col items-center min-w-[320px] max-w-[520px] w-full mx-4 relative">
            <div className="text-lg font-semibold mb-6 text-brand-700 dark:text-brand-300 text-center">
              Selecciona la posición de destino
            </div>
            <div className="w-full max-h-[60vh] overflow-y-auto scrollbar-vertical-custom space-y-4 mb-4 pr-2">
              {moveOptions.map(({ zoneId, zoneName, subzone }) => {
                const availablePositions = getAvailablePositions(zoneId, subzone);
                if (availablePositions.length === 0) return null;

                return (
                  <div key={`${zoneId}-${subzone}`} className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                      {zoneName} - {subzone}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {availablePositions.map((position) => (
                        <button
                          key={`${zoneId}-${subzone}-${position}`}
                          className="bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 font-bold py-3 px-2 rounded-xl text-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all border border-brand-200 dark:border-brand-700 shadow"
                          onClick={() => handleMovePallets(zoneId, subzone, position)}
                          disabled={moveLoading}
                        >
                          {position}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {moveError && <div className="text-red-500 text-xs mb-2 text-center font-bold">{moveError}</div>}
            <button
              className="mt-2 px-6 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              onClick={() => setMoveMode(false)}
              disabled={moveLoading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDITOR DE REGLAS */}
      {showRuleEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl max-h-[90vh] flex flex-col">
            {/* ENCABEZADO DEL MODAL - ESTÁTICO */}
            <div className="flex justify-between items-center p-8 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurar Reglas de Asignación Dinámica</h2>
              <button 
                onClick={() => setShowRuleEditor(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* CONTENEDOR CON SCROLL PARA EL COMPONENTE RULEEDITOR */}
            <div className="flex-1 overflow-y-auto scrollbar-vertical-custom">
              <RuleEditor />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}