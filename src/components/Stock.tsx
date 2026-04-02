import { useMemo, useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Plus, Eye, MapPin, MoreVertical, X, Edit, Trash2, Camera } from "lucide-react";
import QRScanner from "./QRScanner";

interface Palet {
  id: string;
  type: string;
  dimensions: string;
  client: string;
  date: string; // Formato YYYY-MM-DD para poder filtrar bien
  location: string;
  status: string;
}

export default function Stock() {
  const [inventory, setInventory] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: "", type: "", widthMin: "", widthMax: "", heightMin: "", heightMax: "",
    thickness: "", status: "", dateFrom: "", dateTo: "", zone: "",
  });

  // --- ESTADOS DEL PANEL LATERAL DE EDICIÓN ---
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPalet, setSelectedPalet] = useState<Palet | null>(null);

  // SIMULACIÓN DE CONSULTA AL BaaS CON DATOS MEJORADOS
  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      try {
        setTimeout(() => {
          const clients = ["Construcciones S.A.", "Reformas Integrales", "Cristalería Paco", "Aluminios del Sur", "Fachadas Modernas"];
          const types = ["Vidrio Templado", "Vidrio Laminado 6+6", "Doble Acristalamiento", "Espejo Plata", "Vidrio Antireflejo"];
          const zones = ["Zona A", "Zona B", "Zona C", "Zona D"];
          const statuses = ["Almacenado", "Pendiente", "Reservado", "Listo para carga"];
          const thicknesses = [4, 6, 8, 10, 12];

          const MOCK_INVENTORY = Array.from({ length: 40 }).map((_, i) => {
            const width = Math.floor(Math.random() * 2000) + 1000; // Entre 1000 y 3000
            const height = Math.floor(Math.random() * 1000) + 1000; // Entre 1000 y 2000
            const thickness = thicknesses[i % thicknesses.length];
            
            // Generar fecha en formato YYYY-MM-DD para poder comparar
            const dateObj = new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
            const isoDate = dateObj.toISOString().split('T')[0];

            return {
              id: `PAL-${8000 + i}`,
              type: types[i % types.length],
              dimensions: `${width}x${height}x${thickness}`,
              client: clients[i % clients.length],
              date: isoDate,
              location: `${zones[i % zones.length]} - Pasillo ${Math.floor(i/10) + 1}`,
              status: statuses[i % statuses.length],
            };
          });

          setInventory(MOCK_INVENTORY);
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error("Error cargando inventario:", error);
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
      client: "", type: "", widthMin: "", widthMax: "", heightMin: "", heightMax: "",
      thickness: "", status: "", dateFrom: "", dateTo: "", zone: "",
    });
    setSearchTerm("");
  };

  const parseDimensions = (dimensions: string) => {
    const [width, height, thickness] = dimensions.split("x").map(Number);
    return { width: width || 0, height: height || 0, thickness: thickness || 0 };
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = item.id.toLowerCase().includes(search) || item.client.toLowerCase().includes(search) || item.type.toLowerCase().includes(search);
      const matchesClient = item.client.toLowerCase().includes(filters.client.toLowerCase());
      const matchesType = item.type.toLowerCase().includes(filters.type.toLowerCase());
      const matchesStatus = filters.status === "" || item.status === filters.status;
      const matchesZone = item.location.toLowerCase().includes(filters.zone.toLowerCase());
      
      const { width, height, thickness } = parseDimensions(item.dimensions);
      const matchesWidthMin = filters.widthMin === "" || width >= Number(filters.widthMin);
      const matchesWidthMax = filters.widthMax === "" || width <= Number(filters.widthMax);
      const matchesHeightMin = filters.heightMin === "" || height >= Number(filters.heightMin);
      const matchesHeightMax = filters.heightMax === "" || height <= Number(filters.heightMax);
      const matchesThickness = filters.thickness === "" || thickness === Number(filters.thickness);

      const matchesDateFrom = filters.dateFrom === "" || item.date >= filters.dateFrom;
      const matchesDateTo = filters.dateTo === "" || item.date <= filters.dateTo;

      return matchesSearch && matchesClient && matchesType && matchesStatus && matchesZone && 
             matchesWidthMin && matchesWidthMax && matchesHeightMin && matchesHeightMax && 
             matchesThickness && matchesDateFrom && matchesDateTo;
    });
  }, [searchTerm, filters, inventory]);

  // Formatear fecha a prueba de fallos
  const formatDateForDisplay = (dateString: string) => {
    // Si la fecha ya tiene barras (ej: 28/2/2026), la devolvemos tal cual
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // Si tiene guiones (ej: 2026-02-28), le damos la vuelta
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }

    // Por si acaso llega algo raro, mostramos lo que llegue
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
            onClick={() => setIsScanning(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
          >
            <Camera size={18} /> Escanear
          </button>
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
                  <option value="Pendiente">Pendiente</option>
                  <option value="Almacenado">Almacenado</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Listo para carga">Listo para carga</option>
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ancho (mm)</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={filters.widthMin} onChange={(e) => updateFilter("widthMin", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
                  <input type="number" placeholder="Max" value={filters.widthMax} onChange={(e) => updateFilter("widthMax", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alto (mm)</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={filters.heightMin} onChange={(e) => updateFilter("heightMin", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
                  <input type="number" placeholder="Max" value={filters.heightMax} onChange={(e) => updateFilter("heightMax", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Grosor (mm)</label>
                <input type="number" placeholder="Ej. 8" value={filters.thickness} onChange={(e) => updateFilter("thickness", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-slate-200 outline-none" />
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
              ) : filteredInventory.length > 0 ? (
                filteredInventory.map((item) => (
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
          <span>Mostrando {filteredInventory.length} resultado{filteredInventory.length !== 1 && 's'}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Anterior</button>
            <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors">Siguiente</button>
          </div>
        </div>
      </div>

      {/* --- MODAL LECTOR QR --- */}
      {isScanning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Escanear Código</h3>
              <button onClick={() => setIsScanning(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <QRScanner onScanSuccess={(text) => {
                setSearchTerm(text);
                setIsScanning(false);
              }} />
            </div>
          </div>
        </div>
      )}

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