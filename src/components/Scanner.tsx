import { useState } from "react";
import QRScanner from "./QRScanner";
import {
  verificarPalet,
  entregarPaletEnRuta,
  ESTADO_EN_TRANSITO,
  ESTADO_ENTREGADO,
} from "../../services/CargaCamionService";
import { crearAlertaUbicacion } from "../../services/AlertasService";
import { useAuth } from "../context/useAuth";

import {
  CheckCircle2, AlertCircle, Smartphone, User, Clock, Truck, Search, Loader2,
  ChevronLeft, Navigation, Box, Maximize2, ArrowRightLeft, LogOut, PackageCheck
} from "lucide-react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";

import {
  buildLocationId,
  INITIAL_ZONES,
  mapProductoToBlock as mapProductoToRecommendationBlock,
  recommendPalletLocation,
  type WarehouseBlock,
  type WarehouseZone
} from "../domain/warehouseRecommendation";
import type { ReglaAsignacion } from "../utils/RuleEngine";

type MobileScannerProps = {
  showLogout?: boolean;
};

// Tipos para los estados
type ResultType = "success" | "waiting" | "error" | "notfound" | null;


type PaletData = {
  id: string;
  docId: string;
  prioridad: string;
  ubicacion: string;
  ubicacionSugerida: string | null;
  sugerenciaSaturacion: boolean;
  ubicacionYaAsignada: boolean;
  tipoVidrio: string;
  camionRuta: string;
  medidas: string;
  diasStock: number;
  nombreAbreviado?: string;
  estadoPedido: string;
};

type FoundPalet = {
  [key: string]: any;
  rawProducto: any;
};

type LookupDebug = {
  query: string;
  queryType: string;
  queryLength: number;
  queryHex: string;
  queryNormalized: string;
  found: boolean;
  tried: number;
  firestoreCodigoBarra?: string;
  firestoreCodigoBarraLength?: number;
  firestoreCodigoBarraHex?: string;
  firestoreCodigoBarraNormalized?: string;
  normalizedMatch?: boolean;
} | null;

export default function MobileScanner({ showLogout = false }: MobileScannerProps = {}) {
  const { user } = useAuth();
      // Copiado de Warehouse.tsx
      const parseFechaLineaPedido = (fecha: any) => {
        if (!fecha) return null;
        if (fecha instanceof Date) return fecha;
        if (typeof fecha === 'object' && fecha.toDate instanceof Function) return fecha.toDate();
        if (typeof fecha !== 'string') {
          const parsed = Date.parse(String(fecha));
          return isNaN(parsed) ? null : new Date(parsed);
        }
        const normalized = fecha.replace(/\//g, '-');
        const parsed = Date.parse(normalized);
        return isNaN(parsed) ? null : new Date(parsed);
      };

      const mapProductoToBlock = (producto: any, _index: number, id: string) => {
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
        let area = "";
        let zoneId = "";
        if (typeof producto.subzona === "string" && producto.subzona.trim() !== "") {
          area = producto.subzona.trim();
          // No se incluye ZONE_CONFIGS aquí por simplicidad, fallback a lógica antigua
        }
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
                              "DUSCHOLUX", "VICOMAM", "CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR",
                              "VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER",
                              "OTERO", "CLEMENTE", "FORNES", "IBERPERFIL", "VALVERDE", "BARCELONA", "COMPANY", "PONSETI", "ALMANSA",
                              "GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"
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
        return {
          id,
          codigo_barra: producto.codigo_barra || '',
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
          nombre_abreviado: producto.nombre_abreviado,
          referencias: producto.referencia_linea_pedido
        };
      };
    // Utilidad para obtener el primer valor definido
    /* function getFirstDefined<T>(...args: (T | undefined | null)[]): T | undefined {
      return args.find((v) => v !== undefined && v !== null);
    } */
  const [activeTab, setActiveTab] = useState("scan");
  const [scanning, setScanning] = useState(false); // true = mostrando loader
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [result, setResult] = useState<ResultType>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [palets, setPalets] = useState<PaletData[]>([]);
  // Estado para controlar qué palet está desplegado
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [acceptingLocationDocId, setAcceptingLocationDocId] = useState<string | null>(null);
  const [acceptedLocationDocIds, setAcceptedLocationDocIds] = useState<string[]>([]);
  const [acceptLocationError, setAcceptLocationError] = useState<string | null>(null);
  const [deliveringDocId, setDeliveringDocId] = useState<string | null>(null);
  const [deliveredDocIds, setDeliveredDocIds] = useState<string[]>([]);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [placedOkDocIds, setPlacedOkDocIds] = useState<string[]>([]);
  const [misplacedDocIds, setMisplacedDocIds] = useState<string[]>([]);
  const [reportingDocId, setReportingDocId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const normalizeZoneId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const DEFAULT_SUBZONE_CAPACITIES: Record<string, number> = {
    "cms:D": 13,
  };

  const getDefaultSubzoneCapacity = (zoneId: string, subzone: string) =>
    DEFAULT_SUBZONE_CAPACITIES[`${zoneId}:${subzone}`] ?? null;

  const getZoneDisplayName = (zoneId: string) =>
    INITIAL_ZONES.find((zone) => zone.id === zoneId)?.name ?? zoneId;

  const buildPositionCode = (zoneId: string, subzone: string, index: number, capacity: number) => {
    const cardsPerRow = Math.ceil(capacity / 2);
    const row = index < cardsPerRow ? 1 : 2;
    const column = index < cardsPerRow ? index + 1 : index - cardsPerRow + 1;
    return `${zoneId.substring(0, 3).toUpperCase()}${subzone.substring(0, 3).toUpperCase()}${row}${column}`;
  };

  const buildRecommendationZonesFromFirestore = async (): Promise<WarehouseZone[]> => {
    const subzonasSnapshot = await getDocs(collection(db, "subzonas"));
    const zonesById = new Map<string, WarehouseZone>();

    subzonasSnapshot.docs.forEach((subzonaDoc) => {
      const subzona = subzonaDoc.data();
      const zoneId = normalizeZoneId(subzona.zonaId);
      const subzoneName = String(subzona.nombre ?? subzona.name ?? subzonaDoc.id).trim();
      if (!zoneId || !subzoneName) return;

      const capacityValue = Number(subzona.capacidadMaxima);
      const capacity =
        Number.isFinite(capacityValue) && capacityValue > 0
          ? capacityValue
          : getDefaultSubzoneCapacity(zoneId, subzoneName) ?? 1;
      const positions = Array.from({ length: capacity }, (_, index) =>
        buildPositionCode(zoneId, subzoneName, index, capacity)
      );

      const currentZone = zonesById.get(zoneId) ?? {
        id: zoneId,
        name: getZoneDisplayName(zoneId),
        areas: [],
        subzones: {},
        layout: "horizontal" as const,
      };

      zonesById.set(zoneId, {
        ...currentZone,
        areas: currentZone.areas.includes(subzoneName)
          ? currentZone.areas
          : [...currentZone.areas, subzoneName],
        subzones: {
          ...currentZone.subzones,
          [subzoneName]: positions,
        },
      });
    });

    const order = new Map(INITIAL_ZONES.map((zone, index) => [zone.id, index]));
    return [...zonesById.values()].sort(
      (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  };

  const mapProductoToOccupiedRecommendationBlock = (producto: any, index: number, docId: string): WarehouseBlock => {
    const block = mapProductoToRecommendationBlock(producto, index);
    const zoneId = normalizeZoneId(producto.zona);
    const area = String(producto.subzona ?? "").trim();
    const position = typeof producto.posicion === "string" && producto.posicion.trim() !== ""
      ? producto.posicion.trim()
      : undefined;

    return {
      ...block,
      id: docId,
      zoneId,
      area,
      position,
      locationId: position && zoneId && area ? buildLocationId(zoneId, area, position) : undefined,
      nombreAbreviado: producto.nombre_abreviado ?? producto.nombreAbreviado ?? block.nombreAbreviado,
      numeroCliente: producto.numero_cliente ?? producto.numeroCliente ?? block.numeroCliente,
    };
  };

  const hasStoredWarehouseLocation = (producto: any) =>
    Boolean(normalizeZoneId(producto.zona) && String(producto.subzona ?? "").trim());

  const getStoredWarehouseLocation = (producto: any) => {
    const zona = normalizeZoneId(producto.zona);
    const subzona = String(producto.subzona ?? "").trim();
    const posicion = typeof producto.posicion === "string" && producto.posicion.trim() !== ""
      ? producto.posicion.trim()
      : "";

    if (!zona || !subzona || !posicion) return null;
    return {
      zona,
      subzona,
      posicion,
      locationId: buildLocationId(zona, subzona, posicion),
    };
  };

  const parseSuggestedLocation = (locationId: string | null) => {
    if (!locationId) return null;
    const [zoneId, subzona, ...positionParts] = locationId.split("-");
    const posicion = positionParts.join("-");
    if (!zoneId || !subzona || !posicion) return null;
    return { zona: zoneId, subzona, posicion };
  };

  const getLocationRecommendation = async (rawProducto: any, docId: string) => {
    const storedLocation = getStoredWarehouseLocation(rawProducto);
    if (storedLocation) {
      return {
        locationId: storedLocation.locationId,
        isSaturation: false,
        zoneId: storedLocation.zona,
      };
    }

    const [productsSnapshot, firestoreZones, rulesSnapshot] = await Promise.all([
      getDocs(collection(db, "productos")),
      buildRecommendationZonesFromFirestore(),
      getDocs(collection(db, "reglas_asignacion")),
    ]);
    const zonesForRecommendation = firestoreZones.length > 0 ? firestoreZones : INITIAL_ZONES;
    const activeRules = rulesSnapshot.docs
      .map((ruleDoc) => ({ ...ruleDoc.data(), id: ruleDoc.id } as ReglaAsignacion))
      .filter((rule) => rule.activa)
      .sort((a, b) => a.prioridad - b.prioridad);
    const occupiedBlocks = productsSnapshot.docs
      .filter((doc) => doc.id !== docId)
      .filter((doc) => hasStoredWarehouseLocation(doc.data()))
      .map((doc, index) =>
        mapProductoToOccupiedRecommendationBlock({ ...doc.data(), id: doc.id }, index, doc.id)
      );

    return recommendPalletLocation(rawProducto, zonesForRecommendation, occupiedBlocks, activeRules);
  };

  const mapFoundPaletToData = async (palet: FoundPalet, fallbackCode: string): Promise<PaletData> => {
    const storedLocation = getStoredWarehouseLocation(palet.rawProducto);
    let recommendation = {
      locationId: null as string | null,
      isSaturation: false,
    };

    try {
      recommendation = await getLocationRecommendation(palet.rawProducto, palet.id);
    } catch (error) {
      console.error("Error calculando recomendacion tras escaneo:", error);
    }

    return {
      id: palet.codigo_barra || palet.id || fallbackCode,
      docId: palet.id,
      prioridad: palet.priority || "Normal",
      ubicacion: storedLocation?.subzona || palet.area || palet.zoneId || "---",
      ubicacionSugerida: recommendation.locationId,
      sugerenciaSaturacion: recommendation.isSaturation,
      ubicacionYaAsignada: Boolean(storedLocation),
      tipoVidrio: palet.type || "---",
      camionRuta: palet.empresa || "Ruta por asignar",
      medidas: palet.dimensions || "---",
      diasStock: palet.daysInStorage || 0,
      nombreAbreviado: palet.nombre_abreviado || palet.client || "---",
      estadoPedido: String(palet.estadoPedido ?? palet.rawProducto?.estado_pedido ?? "")
    };
  };

  const handleAcceptSuggestedLocation = async (palet: PaletData) => {
    const suggestedLocation = parseSuggestedLocation(palet.ubicacionSugerida);
    if (!suggestedLocation) {
      setAcceptLocationError("No hay ubicacion sugerida valida para aceptar.");
      return;
    }

    setAcceptingLocationDocId(palet.docId);
    setAcceptLocationError(null);

    try {
      await updateDoc(doc(db, "productos", palet.docId), suggestedLocation);
      setAcceptedLocationDocIds((prev) =>
        prev.includes(palet.docId) ? prev : [...prev, palet.docId]
      );
      setPalets((currentPalets) =>
        currentPalets.map((currentPalet) =>
          currentPalet.docId === palet.docId
            ? {
                ...currentPalet,
                ubicacion: suggestedLocation.subzona,
                ubicacionSugerida: palet.ubicacionSugerida,
                sugerenciaSaturacion: false,
                ubicacionYaAsignada: true,
              }
            : currentPalet
        )
      );
    } catch {
      setAcceptLocationError("Error al aceptar la ubicacion sugerida.");
    } finally {
      setAcceptingLocationDocId(null);
    }
  };

  const handleEntregarPalet = async (palet: PaletData) => {
    setDeliveringDocId(palet.docId);
    setDeliverError(null);
    try {
      await entregarPaletEnRuta({
        paletDocId: palet.docId,
        email: user?.email ?? "anónimo",
      });
      setDeliveredDocIds((prev) =>
        prev.includes(palet.docId) ? prev : [...prev, palet.docId]
      );
      setPalets((currentPalets) =>
        currentPalets.map((currentPalet) =>
          currentPalet.docId === palet.docId
            ? { ...currentPalet, estadoPedido: ESTADO_ENTREGADO }
            : currentPalet
        )
      );
    } catch (err) {
      setDeliverError(
        err instanceof Error ? err.message : "Error al marcar el palet como entregado."
      );
    } finally {
      setDeliveringDocId(null);
    }
  };

  // Confirmar que el palet está bien colocado: además lo marca como verificado
  const handlePaletColocado = async (palet: PaletData) => {
    setPlacedOkDocIds((prev) => (prev.includes(palet.docId) ? prev : [...prev, palet.docId]));
    // La verificación solo aplica a palets en almacén, no a los que están en ruta.
    if (palet.estadoPedido !== ESTADO_EN_TRANSITO && palet.estadoPedido !== ESTADO_ENTREGADO) {
      try {
        await verificarPalet(palet.docId);
      } catch (err) {
        console.error("Error al verificar el palet:", err);
      }
    }
  };

  // Reportar palet mal colocado: crea una alerta en la pantalla de Alertas
  const handlePaletMalColocado = async (palet: PaletData) => {
    setReportingDocId(palet.docId);
    setReportError(null);
    try {
      await crearAlertaUbicacion({
        paletDocId: palet.docId,
        codigoBarra: palet.id,
        cliente: palet.nombreAbreviado ?? "Cliente desconocido",
        ubicacionEsperada: palet.ubicacionSugerida || palet.ubicacion || "Sin ubicación",
        reportadoPor: user?.email ?? "anónimo",
      });
      setMisplacedDocIds((prev) => (prev.includes(palet.docId) ? prev : [...prev, palet.docId]));
    } catch {
      setReportError("No se pudo enviar la alerta. Inténtalo de nuevo.");
    } finally {
      setReportingDocId(null);
    }
  };

  // Búsqueda manual: busca por ID de bloque (igual que escaneo, pero usando searchQuery)
  const handleManualSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setShowDetails(false);
    setResult(null);
    setPalets([]);
    setExpandedIdx(null);
    setAcceptedLocationDocIds([]);
    setAcceptLocationError(null);
    setPlacedOkDocIds([]);
    setMisplacedDocIds([]);
    setReportError(null);
    setLastScan(searchQuery); // Para mostrar el texto buscado si no se encuentra
    try {
      const productosCol = collection(db, "productos");
      const cleanedQuery = searchQuery.replace(/\s+/g, "").toUpperCase();
      const q = query(productosCol, where("codigo_barra", ">=", cleanedQuery), where("codigo_barra", "<=", cleanedQuery + '\uf8ff'));
      const snapshot = await getDocs(q);
      let found: FoundPalet[] = [];
      if (!snapshot.empty) {
        const exactMatches = snapshot.docs
          .map(doc => {
            const rawProducto = { ...doc.data(), id: doc.id };
            return { ...mapProductoToBlock(rawProducto, 0, doc.id), rawProducto };
          })
          .filter(f => (f.codigo_barra || '').replace(/\s+/g, '').toUpperCase() === cleanedQuery);
        found = exactMatches;
      }
      if (found.length > 0) {
        setPalets(await Promise.all(found.map(f => mapFoundPaletToData(f, cleanedQuery))));
        setExpandedIdx(found.length === 1 ? 0 : null);
        setResult("success");
      } else {
        setPalets([]);
        setResult("notfound");
      }
    } catch (err) {
      setPalets([]);
      setResult("notfound");
    } finally {
      setIsSearching(false);
      setShowDetails(true);
      setActiveTab("scan");
    }
  };

  // Nuevo: callback para QRScanner
  // Para depuración: guardar el resultado de búsqueda
  const [, setLookupDebug] = useState<LookupDebug>(null);

  const onScanSuccess = async (decodedText: string) => {
    setLastScan(decodedText);
    setShowDetails(false);
    setScanning(true);
    setResult(null);
    setPalets([]);
    setAcceptedLocationDocIds([]);
    setAcceptLocationError(null);
    setPlacedOkDocIds([]);
    setMisplacedDocIds([]);
    setReportError(null);
    // Funciones utilitarias para debug
    function toHex(str: string) {
      return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    }
    function normalize(str: string) {
      return str.replace(/\s+/g, '').toUpperCase();
    }
    try {
      // Buscar solo el producto cuyo codigo_barra coincida (normalizado)
      const productosCol = collection(db, "productos");
      // Limpiar el código escaneado de saltos de línea y espacios invisibles
      const cleanedScan = decodedText.replace(/\s+/g, "").toUpperCase();
      // Buscar todos los productos cuyo codigo_barra normalizado coincida
      const q = query(productosCol, where("codigo_barra", ">=", cleanedScan), where("codigo_barra", "<=", cleanedScan + '\uf8ff'));
      const snapshot = await getDocs(q);
      let found: FoundPalet[] = [];
      //let tried = 0;
      let debugInfo: any = {
        query: decodedText,
        queryType: typeof decodedText,
        queryLength: decodedText.length,
        queryHex: toHex(decodedText),
        queryNormalized: cleanedScan,
        found: false,
        tried: 0,
        firestoreCodigoBarra: undefined,
        firestoreCodigoBarraLength: undefined,
        firestoreCodigoBarraHex: undefined,
        firestoreCodigoBarraNormalized: undefined,
        normalizedMatch: undefined
      };
      if (!snapshot.empty) {
        // Buscar todas las coincidencias exactas normalizadas (filtrado estricto)
        const exactMatches = snapshot.docs
          .map(doc => {
            const rawProducto = { ...doc.data(), id: doc.id };
            return { ...mapProductoToBlock(rawProducto, 0, doc.id), rawProducto };
          })
          .filter(f => (f.codigo_barra || '').replace(/\s+/g, '').toUpperCase() === cleanedScan);
        found = exactMatches;
        debugInfo.tried = snapshot.docs.length;
        debugInfo.found = found.length > 0;
        if (found.length > 0) {
          const first = found[0];
          debugInfo.firestoreCodigoBarra = first.codigo_barra;
          debugInfo.firestoreCodigoBarraLength = first.codigo_barra.length;
          debugInfo.firestoreCodigoBarraHex = toHex(first.codigo_barra);
          debugInfo.firestoreCodigoBarraNormalized = (first.codigo_barra || "").replace(/\s+/g, "").toUpperCase();
          debugInfo.normalizedMatch = true;
        } else {
          debugInfo.normalizedMatch = false;
        }
      } else {
        debugInfo.tried = 0;
      }
      setLookupDebug(debugInfo);
      // ...se eliminó el window.alert de depuración...
      if (found.length > 0) {
        setPalets(await Promise.all(found.map(f => mapFoundPaletToData(f, cleanedScan))));
        setExpandedIdx(found.length === 1 ? 0 : null);
        setResult("success");
      } else {
        setPalets([]);
        setResult("notfound");
      }
    } catch (err) {
      const errorDebug = {
        query: decodedText,
        queryType: typeof decodedText,
        queryLength: decodedText.length,
        queryHex: toHex(decodedText),
        queryNormalized: normalize(decodedText),
        found: false,
        tried: 0,
        firestoreCodigoBarra: undefined,
        firestoreCodigoBarraLength: undefined,
        firestoreCodigoBarraHex: undefined,
        firestoreCodigoBarraNormalized: undefined,
        normalizedMatch: undefined
      };
      setLookupDebug(errorDebug);
      // ...se eliminó el window.alert de depuración...
      setResult("notfound");
    } finally {
      setScanning(false);
      setShowDetails(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans flex flex-col overflow-hidden select-none">
      {!showMap && (
        <div className={`p-6 pt-12 pb-8 transition-colors duration-500 ${
          showDetails ? (result === 'success' ? 'bg-emerald-600' : result === 'error' ? 'bg-red-600' : 'bg-brand-600') : 'bg-brand-600'
        }`}>
          <div className="flex justify-between items-center mb-6 text-left">
            <h1 className="text-2xl font-semibold italic uppercase leading-none tracking-tight">Triniglass <span className="opacity-60 font-light not-italic">Móvil</span></h1>
            <div className="flex items-center gap-3">
              <Smartphone size={20} className="opacity-40" />
              {showLogout && (
                <button
                  onClick={() => signOut(auth).catch((err) => console.error("Error al cerrar sesión", err))}
                  aria-label="Cerrar sesión"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="flex bg-black/20 p-1 rounded-2xl backdrop-blur-md">
            <button onClick={() => { setActiveTab("scan"); setShowDetails(false); }} className={`flex-1 py-3 rounded-xl text-[10px] font-semibold uppercase transition-all ${activeTab === "scan" ? "bg-white text-brand-600 shadow-lg" : "text-white/60"}`}>Escanear</button>
            <button onClick={() => { setActiveTab("search"); setShowMap(false); }} className={`flex-1 py-3 rounded-xl text-[10px] font-semibold uppercase transition-all ${activeTab === "search" ? "bg-white text-brand-600 shadow-lg" : "text-white/60"}`}>Buscar</button>
          </div>
        </div>
      )}
      <div className="flex-1 relative flex flex-col p-6 overflow-y-auto">
        {/* VISTA MAPA INTEGRADA (placeholder visual) */}
        {showMap && (
          <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col h-full space-y-6">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowMap(false)} className="p-3 bg-slate-800 rounded-2xl active:scale-90 transition-all"><ChevronLeft size={24} /></button>
              <div className="text-left">
                <h2 className="text-lg font-semibold uppercase leading-none mb-1">Localización</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Zona - Área</p>
              </div>
            </div>
            <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 p-8 flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto bg-brand-500/10 rounded-full flex items-center justify-center border-2 border-brand-500/30">
                  <Clock size={40} className="text-brand-500" />
                </div>
                <h3 className="text-xl font-semibold uppercase text-brand-400">En Zona de Espera</h3>
                <p className="text-sm text-slate-400 max-w-[250px] mx-auto">Este palet está en zona de espera temporal. Ubicación asignada: <span className="font-bold text-white">---</span></p>
              </div>
            </div>
            <button onClick={() => setShowMap(false)} className="w-full bg-brand-600 py-5 rounded-xl font-semibold uppercase text-xs shadow-lg">Volver a detalles</button>
          </div>
        )}
        {/* PESTAÑA BUSCAR */}
        {activeTab === "search" && !showMap && (
          <div className="animate-in fade-in slide-in-from-right duration-300">
            <form onSubmit={handleManualSearch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ID de bloque (Ej: H-105)..." className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-5 pl-12 pr-4 text-sm outline-none focus:border-brand-500 transition-all text-white" />
              </div>
              <button type="submit" className="w-full bg-brand-600 py-4 rounded-2xl font-semibold uppercase text-xs flex items-center justify-center gap-3 shadow-lg">
                {isSearching ? <Loader2 className="animate-spin" /> : "Localizar Bloque"}
              </button>
            </form>
          </div>
        )}
        {/* VISOR ESCANEO REAL o LOADER */}
        {!showDetails && !showMap && activeTab === "scan" && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in">
            {scanning ? (
              <div className="flex flex-col items-center justify-center gap-6">
                <Loader2 className="animate-spin text-brand-400" size={64} />
                <span className="text-brand-400 font-semibold text-lg uppercase tracking-wide">Buscando...</span>
              </div>
            ) : (
              <>
                <QRScanner onScanSuccess={onScanSuccess} />
                <div className="text-center space-y-4 mt-8">
                  <h2 className="text-lg font-semibold uppercase tracking-tight leading-none">Enfoque el código</h2>
                  <p className="text-slate-500 text-xs max-w-[200px] mx-auto leading-relaxed font-medium">Lectura con cámara para validar ubicación.</p>
                  {lastScan && (
                    <div className="mt-4 text-xs text-slate-400">Último QR: <span className="font-mono text-white">{lastScan}</span></div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* DETALLES DEL BLOQUE (encontrado/no encontrado) */}
        {showDetails && !showMap && activeTab === "scan" && (
          <div className="animate-in slide-in-from-bottom duration-500 space-y-4 pb-12">
            {result === "success" && palets.length > 0 ? (
              <>
                <div className="mb-4 max-w-3xl mx-auto flex flex-col gap-2">
                  <button
                    onClick={() => { setShowDetails(false); setResult(null); setPalets([]); setLastScan(null); setActiveTab('scan'); setAcceptedLocationDocIds([]); setAcceptLocationError(null); setDeliveredDocIds([]); setDeliverError(null); setPlacedOkDocIds([]); setMisplacedDocIds([]); setReportError(null); setExpandedIdx(null); }}
                    className="w-full py-4 text-[10px] font-black uppercase tracking-widest rounded-xl bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all mb-2"
                  >
                    Volver a escanear
                  </button>
                  <div className="bg-brand-900/80 border border-brand-500/30 rounded-xl px-6 py-3 text-sm font-bold text-brand-200 shadow flex items-center gap-2">
                    <span className="text-lg font-semibold text-brand-300">{palets.length}</span>
                    <span>resultado{palets.length === 1 ? '' : 's'} encontrado{palets.length === 1 ? '' : 's'}:</span>
                  </div>
                </div>
                {palets.map((palet, idx) => {
                  const expanded = expandedIdx === idx;
                  return (
                    <div
                      key={palet.id + idx}
                      className={`transition-all duration-300 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg max-w-3xl mx-auto mb-4 cursor-pointer ${expanded ? 'ring-2 ring-brand-400' : 'hover:border-brand-500/40'}`}
                      onClick={() => setExpandedIdx(expanded ? null : idx)}
                    >
                      {/* Vista resumida */}
                      <div className="flex items-center gap-4 p-5">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-400/30">
                          <CheckCircle2 size={24} className="text-brand-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="font-semibold text-brand-400 text-base md:text-lg uppercase tracking-tight leading-none">{palet.id}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase">{palet.nombreAbreviado || '---'}</span>
                            <span className="text-xs font-bold text-emerald-400 uppercase">{palet.prioridad || '---'}</span>
                            <span className="text-xs font-bold text-purple-400 uppercase">{palet.ubicacion || '---'}</span>
                            {palet.ubicacionSugerida && (
                              <span className="text-xs font-bold text-amber-300 uppercase">
                                {palet.ubicacionYaAsignada ? 'Asignada' : 'Sugerida'}: {palet.ubicacionSugerida}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-2">
                          <span
                            className={`inline-block w-6 h-6 rounded-full flex items-center justify-center transition-all select-none ${expanded ? 'bg-brand-500 text-white' : 'bg-slate-800 text-brand-400'}`}
                            style={{ lineHeight: '1', fontSize: '1.35rem', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', paddingTop: '1px' }}
                          >
                            {expanded ? '-' : '+'}
                          </span>
                        </div>
                      </div>
                      {/* Vista detallada desplegable */}
                      {expanded && (
                        <div className="p-5 pt-0 space-y-3 text-left animate-in fade-in slide-in-from-top">
                          <div className="flex items-center gap-4 p-4 bg-slate-800/40 rounded-2xl border border-white/5 shadow-sm">
                            <User size={20} className="text-slate-500" />
                            <div className="flex-1"><p className="text-[9px] font-semibold text-slate-500 uppercase mb-1">Nombre abreviado</p><p className="text-sm font-bold leading-tight">{palet.nombreAbreviado || "---"}</p></div>
                          </div>
                          <div className={`flex items-center gap-4 p-4 rounded-2xl border shadow-sm bg-purple-500/10 border-purple-500/20`}>
                            <Navigation size={20} className="text-purple-400" />
                            <div className="flex-1">
                              <p className="text-[9px] font-semibold uppercase mb-1" style={{ color: '#c084fc' }}>Ubicación Asignada</p>
                              <p className="text-base md:text-lg font-bold leading-tight break-words">
                                {palet.ubicacion || "---"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 p-4 rounded-2xl border shadow-sm bg-amber-500/10 border-amber-500/20">
                            <Navigation size={20} className="text-amber-300" />
                            <div className="flex-1">
                              <p className="text-[9px] font-black text-amber-300 uppercase mb-1">
                                {palet.ubicacionYaAsignada ? 'Ubicacion Actual' : 'Ubicacion Sugerida'}
                              </p>
                              <p className="text-base md:text-lg font-bold leading-tight break-words text-amber-50">
                                {palet.ubicacionSugerida || "---"}
                              </p>
                              {palet.sugerenciaSaturacion && !palet.ubicacionYaAsignada && (
                                <p className="text-[10px] font-bold text-amber-200 mt-1 uppercase">
                                  Zona llena: sugerencia por saturacion
                                </p>
                              )}
                            </div>
                          </div>
                          {palet.ubicacionSugerida && (
                            palet.ubicacionYaAsignada || acceptedLocationDocIds.includes(palet.docId) ? (
                              <div className="w-full py-4 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 text-center text-[10px] font-black uppercase tracking-widest">
                                {palet.ubicacionYaAsignada ? 'Ubicacion ya asignada' : 'Ubicacion aceptada y guardada'}
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAcceptSuggestedLocation(palet); }}
                                  disabled={acceptingLocationDocId === palet.docId}
                                  className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                  {acceptingLocationDocId === palet.docId
                                    ? <><ArrowRightLeft size={14} className="animate-spin" /> Guardando ubicacion...</>
                                    : "Aceptar ubicacion sugerida"}
                                </button>
                                {acceptLocationError && acceptingLocationDocId === null && (
                                  <p className="text-xs text-red-400 text-center font-bold">{acceptLocationError}</p>
                                )}
                              </>
                            )
                          )}
                          <div className="flex items-center gap-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl shadow-sm">
                            <Box size={20} className="text-cyan-400" />
                            <div className="flex-1">
                              <p className="text-[9px] font-semibold text-cyan-400 uppercase mb-1">Tipo de Vidrio</p>
                              <p className="text-base md:text-lg font-bold leading-tight break-words">
                                {palet.tipoVidrio || "---"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl shadow-sm">
                            <Truck size={20} className="text-orange-400" />
                            <div className="flex-1">
                              <p className="text-[9px] font-semibold text-orange-400 uppercase mb-1">Camión / Ruta</p>
                              <p className="text-base md:text-lg font-bold leading-tight break-words">
                                {palet.camionRuta || "Ruta por asignar"}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-slate-800/40 rounded-2xl border border-white/5 text-center">
                              <Maximize2 size={16} className="text-slate-500 mx-auto mb-1" />
                              <p className="text-[8px] font-semibold text-slate-500 uppercase mb-1 leading-none">Medidas</p>
                              <p className="text-sm md:text-base font-bold leading-none break-words">
                                {palet.medidas || "---"}
                              </p>
                            </div>
                            <div className="p-4 rounded-2xl border border-white/5 text-center bg-brand-500 border-brand-400">
                              <Clock size={16} className="text-white mx-auto mb-1 opacity-70" />
                              <p className="text-[8px] font-semibold text-white uppercase mb-1 opacity-70 leading-none">Stock</p>
                              <p className="text-xs font-semibold text-white leading-none">{palet.diasStock !== undefined ? `${palet.diasStock} Días` : "--- Días"}</p>
                            </div>
                          </div>
                          {/* Verificación de ubicación: ¿el palet está bien colocado? */}
                          {misplacedDocIds.includes(palet.docId) ? (
                            <div className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-center text-[10px] font-black uppercase tracking-widest">
                              🚨 Alerta enviada · palet mal colocado
                            </div>
                          ) : placedOkDocIds.includes(palet.docId) ? (
                            <div className="w-full py-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center text-[10px] font-black uppercase tracking-widest">
                              ✅ Palet colocado correctamente
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                                ¿El palet está en su ubicación?
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePaletColocado(palet); }}
                                  className="py-4 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <CheckCircle2 size={14} /> Bien colocado
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePaletMalColocado(palet); }}
                                  disabled={reportingDocId === palet.docId}
                                  className="py-4 rounded-2xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-red-500 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                  {reportingDocId === palet.docId
                                    ? <><ArrowRightLeft size={14} className="animate-spin" /> Enviando...</>
                                    : <><AlertCircle size={14} /> Mal colocado</>}
                                </button>
                              </div>
                              {reportError && reportingDocId === null && (
                                <p className="text-xs text-red-400 text-center font-bold">{reportError}</p>
                              )}
                            </div>
                          )}
                          {/* Acción principal según el estado del palet */}
                          {palet.estadoPedido === ESTADO_EN_TRANSITO ? (
                            deliveredDocIds.includes(palet.docId) ? (
                              <div className="w-full py-4 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-center text-[10px] font-black uppercase tracking-widest">
                                📦 Palet entregado y descargado del camión
                              </div>
                            ) : (
                              <>
                                <div className="w-full py-3 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-center text-[10px] font-black uppercase tracking-widest">
                                  🚚 Palet en tránsito
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEntregarPalet(palet); }}
                                  disabled={deliveringDocId === palet.docId}
                                  className="w-full py-4 rounded-2xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                  {deliveringDocId === palet.docId
                                    ? <><ArrowRightLeft size={14} className="animate-spin" /> Marcando entrega...</>
                                    : <><PackageCheck size={14} /> Marcar como entregado</>}
                                </button>
                                {deliverError && deliveringDocId === null && (
                                  <p className="text-xs text-red-400 text-center font-bold">{deliverError}</p>
                                )}
                              </>
                            )
                          ) : palet.estadoPedido === ESTADO_ENTREGADO ? (
                            <div className="w-full py-4 rounded-2xl bg-slate-500/20 border border-slate-500/40 text-slate-300 text-center text-[10px] font-black uppercase tracking-widest">
                              ✅ Palet ya entregado
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : result === "notfound" ? (
              <div className={`p-5 rounded-[2rem] flex items-center gap-4 bg-red-500/10 border border-red-500/20`}>
                <div className={`p-3 rounded-2xl bg-red-500 text-white shadow-lg`}>
                  <AlertCircle size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold uppercase text-[9px] tracking-wide opacity-60 mb-0.5 leading-none">Palet no encontrado</p>
                  <p className="text-lg font-semibold uppercase tracking-tight leading-none">ID: {lastScan}</p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => { setShowDetails(false); setResult(null); setPalets([]); setLastScan(null); setDeliveredDocIds([]); setDeliverError(null); setPlacedOkDocIds([]); setMisplacedDocIds([]); setReportError(null); setExpandedIdx(null); }}
                className="w-full py-4 text-[9px] font-black uppercase text-slate-600 tracking-widest active:text-white border-b border-slate-700"
              >
                Nuevo Escaneo
              </button>
              <button
                onClick={() => { setShowDetails(false); setResult(null); setPalets([]); setLastScan(null); setActiveTab('scan'); setDeliveredDocIds([]); setDeliverError(null); setPlacedOkDocIds([]); setMisplacedDocIds([]); setReportError(null); setExpandedIdx(null); }}
                className="w-full py-4 text-[9px] font-black uppercase text-blue-500 tracking-widest active:text-white"
              >
                Volver a escanear
              </button>
            </div>
          </div>
        )}
        {/* ...se eliminó la sección de depuración... */}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line { 0% { top: 24px; } 100% { top: calc(100% - 24px); } }
        .animate-scan-line { animation: scan-line 2.5s ease-in-out infinite; }
      `}} />
    </div>
  );
}
