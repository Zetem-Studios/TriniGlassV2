import { useMemo, useState, useEffect, useRef } from "react";
import { Search, Filter, ArrowUpDown, Plus, Eye, MoreVertical, X, Edit, Trash2, AlertCircle } from "lucide-react";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

// Límite máximo de resultados por query en Firestore
const MAX_FIRESTORE_RESULTS = 200;

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setDebouncedValue(value), delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Palet {
  id: string;
  docId: string; // ID único de Firestore para key de React
  type: string;
  dimensions: string;
  client: string;
  date: string; // Formato YYYY-MM-DD para poder filtrar bien
  location: string;
  status: string;
  zone?: string;
  codigo_barra?: string;
  codificador?: string;
  numero_linea_pedido?: string;
  referencia_linea_pedido?: string;
}

export default function Stock() {
  const [inventory, setInventory] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hitLimit, setHitLimit] = useState(false);

  const [serverFilters, setServerFilters] = useState({
    status: "",
    zone: "",
    codificador: "",
    codigo_barra: "",
    numero_linea_pedido: "",
    referencia_linea_pedido: "",
    dateFrom: "",
    dateTo: "",
  });

  const [clientFilters, setClientFilters] = useState({
    client: "",
    type: "",
    widthMin: "",
    widthMax: "",
    heightMin: "",
    heightMax: "",
    thickness: "",
  });

  const debouncedClient = useDebounce(clientFilters.client, 400);
  const debouncedType = useDebounce(clientFilters.type, 400);

  // --- ESTADOS DEL PANEL LATERAL DE EDICIÓN ---
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPalet, setSelectedPalet] = useState<Palet | null>(null);

  // --- ESTADOS DE PAGINADO ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const parseDimensions = (dimensions: string) => {
    const parts = dimensions.split('x').map(p => Number(p.trim()) || 0);
    return {
      width: parts[0] || 0,
      height: parts[1] || 0,
      thickness: parts[2] || 0
    };
  };

  useEffect(() => {
    const parseFirestoreDateToISO = (value: unknown): string => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyValue = value as any;
      if (!value) return "";
      if (value instanceof Date) return value.toISOString().split("T")[0];
      if (anyValue?.toDate && typeof anyValue.toDate === "function") {
        return anyValue.toDate().toISOString().split("T")[0];
      }
      if (typeof value === "string") {
        return value.includes("/") ? value.split("/").reverse().join("-") : value;
      }
      return "";
    };

    const fetchStock = async () => {
      setLoading(true);
      try {
        const conditions: ReturnType<typeof where>[] = [];

        if (serverFilters.dateFrom) {
          conditions.push(where("fecha_linea_pedido", ">=", Timestamp.fromDate(new Date(serverFilters.dateFrom))));
        }

        if (serverFilters.dateTo) {
          conditions.push(where("fecha_linea_pedido", "<=", Timestamp.fromDate(new Date(serverFilters.dateTo))));
        }

        if (serverFilters.status) {
          conditions.push(where("estado_pedido", "==", serverFilters.status));
        }

        if (serverFilters.zone) {
          conditions.push(where("subzona", "==", serverFilters.zone));
        }

        if (serverFilters.codificador) {
          conditions.push(where("codificador", "==", serverFilters.codificador));
        }

        if (serverFilters.codigo_barra) {
          conditions.push(where("codigo_barra", "==", serverFilters.codigo_barra));
        }

        if (serverFilters.numero_linea_pedido) {
          conditions.push(where("numero_linea_pedido", "==", serverFilters.numero_linea_pedido));
        }

        if (serverFilters.referencia_linea_pedido) {
          conditions.push(where("referencia_linea_pedido", "==", serverFilters.referencia_linea_pedido));
        }

        const productosQuery = query(
          collection(db, "productos"),
          ...conditions,
          orderBy("fecha_linea_pedido", "desc"),
          limit(MAX_FIRESTORE_RESULTS)
        );

        const querySnapshot = await getDocs(productosQuery);
        console.log("Firestore: productos encontrados", querySnapshot.size);
        setHitLimit(querySnapshot.size >= MAX_FIRESTORE_RESULTS);

        const firestoreInventory: Palet[] = querySnapshot.docs.map((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = doc.data() as any;
          const dateValue = data.fecha_entrega || data.fecha_linea_pedido || data.infos_entrega || "";
          const dateString = parseFirestoreDateToISO(dateValue);
          const ancho = Number(data.longitud ?? 0);
          const alto = Number(data.altura ?? 0);
          const grosor = Number(data.peso_pieza_kg ?? 0);
          const locationValue = data.subzona ? String(data.subzona) : "Sin zona";
          const estado = data.estado_pedido || data.estado_linea_pdd || "Pendiente";

          return {
            id: data.numero_linea_pedido || doc.id,
            docId: doc.id,
            type: data.descripcion_producido_longitud || data.estado_linea_pdd || "Sin descripción",
            dimensions: `${ancho || alto || 0}x${alto || 0}x${grosor || 0}`,
            client: data.apellido_cliente || data.nombre_abreviado || "Cliente desconocido",
            date: dateString,
            location: locationValue,
            status: estado,
            zone: data.subzona ? String(data.subzona) : "",
            codigo_barra: data.codigo_barra ? String(data.codigo_barra) : undefined,
            codificador: data.codificador ? String(data.codificador) : undefined,
            numero_linea_pedido: data.numero_linea_pedido ? String(data.numero_linea_pedido) : undefined,
            referencia_linea_pedido: data.referencia_linea_pedido ? String(data.referencia_linea_pedido) : undefined,
          };
        });

        console.log("Inventario normalizado", firestoreInventory.slice(0, 5));
        setInventory(firestoreInventory);
      } catch (error) {
        console.error("Error cargando inventario desde Firestore:", error);
        setInventory([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [serverFilters]);

  const updateServerFilter = (key: string, value: string) => {
    setServerFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const updateClientFilter = (key: string, value: string) => {
    setClientFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setServerFilters({
      status: "",
      zone: "",
      codificador: "",
      codigo_barra: "",
      numero_linea_pedido: "",
      referencia_linea_pedido: "",
      dateFrom: "",
      dateTo: "",
    });
    setClientFilters({
      client: "",
      type: "",
      widthMin: "",
      widthMax: "",
      heightMin: "",
      heightMax: "",
      thickness: "",
    });
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        item.id.toLowerCase().includes(search) ||
        item.client.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search) ||
        item.codigo_barra?.toLowerCase().includes(search) ||
        item.codificador?.toLowerCase().includes(search) ||
        item.numero_linea_pedido?.toLowerCase().includes(search) ||
        item.referencia_linea_pedido?.toLowerCase().includes(search);

      const matchesClient =
        debouncedClient === "" ||
        item.client.toLowerCase().includes(debouncedClient.toLowerCase());

      const matchesType =
        debouncedType === "" ||
        item.type.toLowerCase().includes(debouncedType.toLowerCase());

      const { width, height, thickness } = parseDimensions(item.dimensions);
      const matchesWidthMin = clientFilters.widthMin === "" || width >= Number(clientFilters.widthMin);
      const matchesWidthMax = clientFilters.widthMax === "" || width <= Number(clientFilters.widthMax);
      const matchesHeightMin = clientFilters.heightMin === "" || height >= Number(clientFilters.heightMin);
      const matchesHeightMax = clientFilters.heightMax === "" || height <= Number(clientFilters.heightMax);
      const matchesThickness = clientFilters.thickness === "" || thickness === Number(clientFilters.thickness);

      return (
        matchesSearch &&
        matchesClient &&
        matchesType &&
        matchesWidthMin &&
        matchesWidthMax &&
        matchesHeightMin &&
        matchesHeightMax &&
        matchesThickness
      );
    });
  }, [searchTerm, debouncedClient, debouncedType, clientFilters, inventory]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / rowsPerPage));
  
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredInventory.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredInventory, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, debouncedClient, debouncedType]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Formatear fecha a prueba de fallos
  const formatDateForDisplay = (dateString: string) => {
    if (dateString.includes('/')) {
      return dateString;
    }
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Inventario de Vidrio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestión de palets y bloques almacenados.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors shadow-sm">
          <Plus size={18} /> Nuevo Palet
        </button>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex-1 flex flex-col">
        
        {/* BARRA SUPERIOR DE BÚSQUEDA */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por ID, cliente o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showFilters 
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 border border-brand-200 dark:border-brand-800" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-transparent"
            }`}
          >
            <Filter size={18} /> {showFilters ? "Ocultar filtros" : "Filtros Avanzados"}
          </button>
        </div>

        {/* PANEL DE FILTROS COMPLETOS (DE FIGMA) */}
        {showFilters && (
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente </label>
                <input type="text" placeholder="Ej. Construcciones S.A." value={clientFilters.client} onChange={(e) => updateClientFilter("client", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de vidrio </label>
                <input type="text" placeholder="Ej. Vidrio Templado" value={clientFilters.type} onChange={(e) => updateClientFilter("type", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
                <select value={serverFilters.status} onChange={(e) => updateServerFilter("status", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none">
                  <option value="">Todos los estados</option>
                  <option value="Para verificar">Para verificar</option>
                  <option value="Codificada">Codificada</option>
                  <option value="Producción">Producción</option>
                  <option value="Producida">Producida</option>
                  <option value="Bloqueada">Bloqueada</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Zona del almacén</label>
                <input type="text" placeholder="Ej: A, B, H, D..." value={serverFilters.zone} onChange={(e) => updateServerFilter("zone", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ancho (mm) </label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={clientFilters.widthMin} onChange={(e) => updateClientFilter("widthMin", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
                  <input type="number" placeholder="Max" value={clientFilters.widthMax} onChange={(e) => updateClientFilter("widthMax", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alto (mm) </label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={clientFilters.heightMin} onChange={(e) => updateClientFilter("heightMin", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
                  <input type="number" placeholder="Max" value={clientFilters.heightMax} onChange={(e) => updateClientFilter("heightMax", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Grosor (mm) </label>
                <input type="number" placeholder="Ej. 8" value={clientFilters.thickness} onChange={(e) => updateClientFilter("thickness", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha desde</label>
                <input type="date" value={serverFilters.dateFrom} onChange={(e) => updateServerFilter("dateFrom", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha hasta</label>
                <input type="date" value={serverFilters.dateTo} onChange={(e) => updateServerFilter("dateTo", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>

            {hitLimit && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg mt-4">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Límite de {MAX_FIRESTORE_RESULTS} resultados alcanzado</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">Aplica filtros más específicos para ver otros resultados.</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={clearFilters} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors">
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* TABLA DE RESULTADOS */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800/80">
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400"><div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">ID Palet <ArrowUpDown size={14} /></div></th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400">Tipo / Dimensiones</th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400">Cliente</th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400">Ubicación</th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400">Fecha</th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400">Estado</th>
                <th className="px-3 py-3 font-medium text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">Cargando datos del inventario...</td></tr>
              ) : filteredInventory.length > 0 ? (
                paginatedInventory.map((item) => (
                  <tr key={item.docId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{item.id}</td>
                    <td className="px-3 py-3">
                      <div className="text-slate-900 dark:text-slate-200 font-medium">{item.type}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{item.dimensions} mm</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{item.client}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{item.location}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs tabular-nums whitespace-nowrap">{formatDateForDisplay(item.date)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        item.status === "Almacenado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                        item.status === "Pendiente" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                        item.status === "Reservado" ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" :
                        "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded transition-colors" title="Ver detalle">
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => { setSelectedPalet(item); setIsPanelOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors" title="Editar / Ubicar"
                        >
                          <Edit size={16} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <Filter size={24} className="text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">No se han encontrado resultados</p>
                      <p className="text-sm">Prueba a modificar o limpiar los filtros de búsqueda.</p>
                      <button onClick={clearFilters} className="mt-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors">
                        Limpiar todos los filtros
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE TABLA */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Mostrando {filteredInventory.length} resultado{filteredInventory.length !== 1 && 's'}</span>
            <span>• Página {currentPage} de {totalPages}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Mostrar</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- PANEL LATERAL DE EDICIÓN --- */}
      {isPanelOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsPanelOpen(false)} />}
      
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col ${
        isPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Editar Palet</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedPalet?.id}</p>
          </div>
          <button onClick={() => setIsPanelOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {selectedPalet && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente asignado</label>
                <input type="text" defaultValue={selectedPalet.client} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-white outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tipo de material</label>
                <input type="text" defaultValue={selectedPalet.type} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-white outline-none transition-shadow" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Dimensiones</label>
                  <input type="text" defaultValue={selectedPalet.dimensions} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-white outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ubicación</label>
                  <input type="text" defaultValue={selectedPalet.location} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-white outline-none transition-shadow" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Estado del palet</label>
                <select defaultValue={selectedPalet.status} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:text-white outline-none transition-shadow">
                  <option value="Almacenado">Almacenado</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Listo para carga">Listo para carga</option>
                </select>
              </div>
              <div className="pt-4 mt-6 border-t border-slate-200/80 dark:border-slate-800/80">
                 <button className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors">
                    <Trash2 size={18} /> Eliminar este palet del sistema
                 </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200/80 dark:border-slate-800/80 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
          <button onClick={() => setIsPanelOpen(false)} className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors">
            Cancelar
          </button>
          <button className="px-5 py-2.5 text-white bg-brand-600 rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-sm">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
