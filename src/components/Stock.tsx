import { useMemo, useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Plus, Eye, MoreVertical, X, Edit, Trash2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface Palet {
  id: string;
  type: string;
  dimensions: string;
  client: string;
  date: string; // Formato YYYY-MM-DD para poder filtrar bien
  location: string;
  status: string;
  codigo_barra?: string;
  codificador?: string;
  numero_linea_pedido?: string;
  descripcion_producido_longitud?: string;
  referencia_linea_pedido?: string;
  cantidad_encargada?: number;
  cantidad_entregada?: number;
  cantidad_producida?: number;
  fecha_entrega?: string;
  fecha_linea_pedido?: string;
}

export default function Stock() {
  const [inventory, setInventory] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: "", type: "", status: "", zone: "", codificador: "", codigo_barra: "", numero_linea_pedido: "", referencia_linea_pedido: "", dateFrom: "", dateTo: "",
  });

  // --- ESTADOS DEL PANEL LATERAL DE EDICIÓN ---
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPalet, setSelectedPalet] = useState<Palet | null>(null);

  // --- ESTADOS DE PAGINADO ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // CARGAR STOCK DESDE FIREBASE FIRESTORE (`productos`)
  useEffect(() => {
    const parseFirestoreDateToISO = (value: any) => {
      if (!value) return "";
      if (value instanceof Date) return value.toISOString().split("T")[0];
      if (value?.toDate && typeof value.toDate === "function") {
        return value.toDate().toISOString().split("T")[0];
      }
      if (typeof value === "string") {
        return value.includes("/") ? value.split("/").reverse().join("-") : value;
      }
      return "";
    };

    const fetchStock = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "productos"));
        console.log("Firestore: productos encontrados", querySnapshot.size);

        const firestoreInventory: Palet[] = querySnapshot.docs.map((doc) => {
          const data = doc.data() as any;

          const dateValue = data.fecha_entrega || data.fecha_linea_pedido || data.infos_entrega || "";
          const dateString = parseFirestoreDateToISO(dateValue);

          const altura = Number(data.altura ?? 0);
          const ancho = Number(data.longitud ?? 0);
          const alto = Number(data.altura ?? 0);
          const grosor = Number(data.peso_pieza_kg ?? 0);

          const locationValue = data.numero_caballete ? `Caballete ${data.numero_caballete}` : (data.referencia_linea_pedido || "Sin ubicación");
          const estado = data.estado_pedido || data.estado_linea_pdd || "Pendiente";

          return {
            id: data.numero_linea_pedido || doc.id,
            type: data.descripcion_producido_longitud || data.estado_linea_pdd || "Sin descripción",
            dimensions: `${ancho || altura || 0}x${alto || 0}x${grosor || 0}`,
            client: data.apellido_cliente || data.nombre_abreviado || "Cliente desconocido",
            date: dateString,
            location: locationValue,
            status: estado,
            codigo_barra: data.codigo_barra,
            codificador: data.codificador,
            numero_linea_pedido: data.numero_linea_pedido,
            referencia_linea_pedido: data.referencia_linea_pedido,
            descripcion_producido_longitud: data.descripcion_producido_longitud,
            cantidad_encargada: Number(data.cantidad_encargada ?? 0),
            cantidad_entregada: Number(data.cantidad_entregada ?? 0),
            cantidad_producida: Number(data.cantidad_producida ?? 0),
            fecha_entrega: parseFirestoreDateToISO(data.fecha_entrega),
            fecha_linea_pedido: parseFirestoreDateToISO(data.fecha_linea_pedido),
          };
        });

        console.log("Inventario normalizado", firestoreInventory.slice(0, 4));
        setInventory(firestoreInventory);
      } catch (error) {
        console.error("Error cargando inventario desde Firestore:", error);
        setInventory([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  // --- LÓGICA DE FILTROS ---
  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      client: "", type: "", status: "", zone: "", codificador: "", codigo_barra: "", numero_linea_pedido: "", referencia_linea_pedido: "", dateFrom: "", dateTo: "",
    });
    setSearchTerm("");
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        item.id.toLowerCase().includes(search) ||
        item.client.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search) ||
        (item.codigo_barra?.toLowerCase().includes(search) ?? false) ||
        (item.codificador?.toLowerCase().includes(search) ?? false) ||
        (item.numero_linea_pedido?.toLowerCase().includes(search) ?? false);

      const matchesClient = item.client.toLowerCase().includes(filters.client.toLowerCase());
      const matchesType = item.type.toLowerCase().includes(filters.type.toLowerCase());
      const matchesStatus = filters.status === "" || item.status === filters.status;
      const matchesZone = item.location.toLowerCase().includes(filters.zone.toLowerCase());
      const matchesCodificador = item.codificador?.toLowerCase().includes(filters.codificador.toLowerCase()) ?? true;
      const matchesCodigoBarra = item.codigo_barra?.toLowerCase().includes(filters.codigo_barra.toLowerCase()) ?? true;
      const matchesPedido = item.numero_linea_pedido?.toLowerCase().includes(filters.numero_linea_pedido.toLowerCase()) ?? true;
      const matchesReferencia = item.referencia_linea_pedido?.toLowerCase().includes(filters.referencia_linea_pedido.toLowerCase()) ?? true;
      const matchesDateFrom = filters.dateFrom === "" || item.date >= filters.dateFrom;
      const matchesDateTo = filters.dateTo === "" || item.date <= filters.dateTo;

      return matchesSearch && matchesClient && matchesType && matchesStatus && matchesZone && matchesCodificador && matchesCodigoBarra && matchesPedido && matchesReferencia && matchesDateFrom && matchesDateTo;
    });
  }, [searchTerm, filters, inventory]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / rowsPerPage));

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    inventory.forEach((item) => {
      if (item.status?.trim()) statuses.add(item.status.trim());
    });

    if (statuses.size === 0) {
      ["Pendiente", "Almacenado", "Reservado", "Listo para carga"].forEach((status) => statuses.add(status));
    }

    return [...statuses].sort();
  }, [inventory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredInventory, rowsPerPage]);

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredInventory.slice(start, start + rowsPerPage);
  }, [filteredInventory, currentPage, rowsPerPage]);

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario de Vidrio</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestión de palets y bloques almacenados.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
          <Plus size={18} /> Nuevo Palet
        </button>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex-1 flex flex-col">
        
        {/* BARRA SUPERIOR DE BÚSQUEDA */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por ID, cliente o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showFilters 
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-transparent"
            }`}
          >
            <Filter size={18} /> {showFilters ? "Ocultar filtros" : "Filtros Avanzados"}
          </button>
        </div>

        {/* PANEL DE FILTROS COMPLETOS (DE FIGMA) */}
        {showFilters && (
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
                <input type="text" placeholder="Ej. Construcciones S.A." value={filters.client} onChange={(e) => updateFilter("client", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de vidrio</label>
                <input type="text" placeholder="Ej. Vidrio Templado" value={filters.type} onChange={(e) => updateFilter("type", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
                <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none">
                  <option value="">Todos los estados</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Zona del almacén</label>
                <select value={filters.zone} onChange={(e) => updateFilter("zone", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none">
                  <option value="">Todas las zonas</option>
                  <option value="zona a">Zona A</option>
                  <option value="zona b">Zona B</option>
                  <option value="zona c">Zona C</option>
                  <option value="zona d">Zona D</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Codificador</label>
                <input type="text" placeholder="Ej. AITOR" value={filters.codificador} onChange={(e) => updateFilter("codificador", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Código de barra</label>
                <input type="text" placeholder="Ej. *A/351240/PV*" value={filters.codigo_barra} onChange={(e) => updateFilter("codigo_barra", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Número línea pedido</label>
                <input type="text" placeholder="Ej. 2026-404587-045" value={filters.numero_linea_pedido} onChange={(e) => updateFilter("numero_linea_pedido", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Referencia pedido</label>
                <input type="text" placeholder="Ej. ALUTEC DELTA SLU" value={filters.referencia_linea_pedido} onChange={(e) => updateFilter("referencia_linea_pedido", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha desde</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha hasta</label>
                <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={clearFilters} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors">
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* TABLA DE RESULTADOS */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400"><div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">ID Palet <ArrowUpDown size={14} /></div></th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Tipo / Dimensiones</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Cliente</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Ubicación</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Fecha</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Estado</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">Cargando datos del inventario...</td></tr>
              ) : paginatedInventory.length > 0 ? (
                paginatedInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{item.id}</td>
                    <td className="p-4">
                      <div className="text-slate-900 dark:text-slate-200 font-medium">{item.type}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{item.dimensions} mm</div>
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{item.client}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{item.location}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-400 text-sm">{formatDateForDisplay(item.date)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status === "Almacenado" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" :
                        item.status === "Pendiente" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" :
                        item.status === "Reservado" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20" : 
                        "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors" title="Ver detalle">
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => { setSelectedPalet(item); setIsPanelOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors" title="Editar / Ubicar"
                        >
                          <Edit size={18} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors">
                          <MoreVertical size={18} />
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <span>Mostrando {Math.min(filteredInventory.length, rowsPerPage)} de {filteredInventory.length} resultado{filteredInventory.length !== 1 && 's'}</span>
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Filas por página:
              <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs focus:outline-none">
                {[5,10,15,20,50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              Anterior
            </button>
            <span className="px-2">Página {currentPage} de {totalPages}</span>
            <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* --- PANEL LATERAL DE EDICIÓN --- */}
      {isPanelOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsPanelOpen(false)} />}
      
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col ${
        isPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Editar Palet</h2>
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
                <input type="text" defaultValue={selectedPalet.client} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tipo de material</label>
                <input type="text" defaultValue={selectedPalet.type} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-shadow" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Dimensiones</label>
                  <input type="text" defaultValue={selectedPalet.dimensions} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ubicación</label>
                  <input type="text" defaultValue={selectedPalet.location} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-shadow" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Estado del palet</label>
                <select defaultValue={selectedPalet.status} className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-shadow">
                  <option value="Almacenado">Almacenado</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Listo para carga">Listo para carga</option>
                </select>
              </div>
              <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800">
                 <button className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors">
                    <Trash2 size={18} /> Eliminar este palet del sistema
                 </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
          <button onClick={() => setIsPanelOpen(false)} className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors">
            Cancelar
          </button>
          <button className="px-5 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
