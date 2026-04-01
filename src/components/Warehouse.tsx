import { useState, useEffect } from "react";
import { 
  Search, Plus, ChevronDown, Check, X, Package, 
  Box, Layers, Calendar, Clock, 
  User, BarChart3, Maximize2, Weight, View, Zap, DoorOpen, AlertCircle, Trash2
} from "lucide-react";
import { createCompleteZone, getZones } from "../firebase";

// 1. CONFIGURACIÓN DE ZONAS (Fiel a mapaAlmacen.PNG)
const INITIAL_ZONES = [
  { id: "expediciones", name: "Expediciones", areas: ["H", "Mamparista"], layout: "horizontal" },
  { id: "zona_1", name: "Zona 1", areas: ["F"], layout: "single" },
  { id: "corte", name: "Corte", areas: ["E"], layout: "single" },
  { id: "cms", name: "CMS", areas: ["D"], layout: "single" },
  { id: "zona_2", name: "Zona 2", areas: ["C", "B"], layout: "horizontal" },
  { id: "zona_3", name: "Zona 3", areas: ["A", "??"], layout: "vertical" }, // A sobre ?? [1]
];

const generatePallets = (zoneId: string, areaName: string, count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${areaName}-${100 + i}`,
    zoneId: zoneId,
    area: areaName,
    type: i % 3 === 0 ? "Doble Acristalamiento" : i % 2 === 0 ? "Laminado" : "Templado",
    daysInStorage: Math.floor(Math.random() * 45),
    client: i % 4 === 0 ? "Vidrios del Norte S.L." : "Cristalería Central",
    occupied: Math.random() > 0.2,
    dimensions: "2400 x 1800 mm",
    weight: `${250 + Math.floor(Math.random() * 450)} kg`,
    priority: i % 5 === 0 ? "Alta" : "Normal",
    lastUpdate: "18/03/2026"
  }));
};

const ALL_BLOCKS = INITIAL_ZONES.flatMap(zone => 
  zone.areas.flatMap(area => generatePallets(zone.id, area, 12))
);

export default function Warehouse() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZone, setSelectedZone] = useState("expediciones");
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isNewZoneModalOpen, setIsNewZoneModalOpen] = useState(false);
  const [zones, setZones] = useState<any[]>(INITIAL_ZONES);
  const [blocks, setBlocks] = useState(() => ALL_BLOCKS);

  useEffect(() => {
    getZones().then(data => {
      if (data.length > 0) {
        const normalized = data.map((z: any) => ({
          id: z.id,
          name: z.nombre ?? z.name,
          areas: Array.isArray(z.posiciones)
            ? z.posiciones.map((p: any) => typeof p === "string" ? p : p.nombre)
            : [],
          layout: z.layout ?? "horizontal",
        }));
        setZones(normalized);
        setSelectedZone(normalized[0].id);
        // Generar bloques simulados a partir de las zonas reales
        setBlocks(normalized.flatMap((z: any) =>
          z.areas.flatMap((area: string) => generatePallets(z.id, area, 12))
        ));
      }
    });
  }, []);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState<"produccion" | "almacenamiento" | "expedicion">("almacenamiento");
  const [newZoneLayout, setNewZoneLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [newZonePositions, setNewZonePositions] = useState<Array<{ name: string; locations: number }>>([{ name: "A", locations: 10 }]);
  const [modalError, setModalError] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

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

  const handleAddZone = async () => {
    setModalError("");
    
    // Validaciones
    if (!newZoneName.trim()) {
      setModalError("El nombre de la zona es obligatorio");
      return;
    }
    if (newZonePositions.length === 0) {
      setModalError("Debes agregar al menos una posición");
      return;
    }
    if (newZonePositions.some(p => !p.name.trim() || p.locations <= 0)) {
      setModalError("Todas las posiciones deben tener nombre y ubicaciones > 0");
      return;
    }

    setIsCreatingZone(true);
    try {
      // Generar ID de zona (limpio, sin espacios)
      const zoneId = newZoneName
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");

      if (!zoneId) {
        setModalError("El nombre no puede contener solo caracteres especiales");
        setIsCreatingZone(false);
        return;
      }

      await createCompleteZone(
        zoneId,
        newZoneName,
        newZoneType,
        newZoneLayout,
        newZonePositions
      );

      // Recargar zonas desde Firebase
      const data = await getZones();
      if (data.length > 0) {
        const normalized = data.map((z: any) => ({
          id: z.id,
          name: z.nombre ?? z.name,
          areas: Array.isArray(z.posiciones)
            ? z.posiciones.map((p: any) => typeof p === "string" ? p : p.nombre)
            : [],
          layout: z.layout ?? "horizontal",
        }));
        setZones(normalized);
        setBlocks(normalized.flatMap((z: any) =>
          z.areas.flatMap((area: string) => generatePallets(z.id, area, 12))
        ));
        setSelectedZone(zoneId);
      }

      // Limpiar y cerrar
      setNewZoneName("");
      setNewZoneType("almacenamiento");
      setNewZoneLayout("horizontal");
      setNewZonePositions([{ name: "A", locations: 10 }]);
      setIsNewZoneModalOpen(false);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("❌ Error creando zona:", error);
      if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
        setModalError("Sin permisos en Firebase. Revisa las reglas de Firestore.");
      } else if (msg.includes("offline") || msg.includes("network")) {
        setModalError("Sin conexión. Comprueba tu internet.");
      } else {
        setModalError(`Error: ${msg}`);
      }
    } finally {
      setIsCreatingZone(false);
    }
  };

  const closeModal = () => {
    setIsNewZoneModalOpen(false);
    setNewZoneName("");
    setNewZoneType("almacenamiento");
    setNewZoneLayout("horizontal");
    setNewZonePositions([{ name: "A", locations: 10 }]);
    setModalError("");
  };

  const getAreaHeatColor = (areaName: string) => {
    const areaPallets = blocks.filter(b => b.area === areaName && b.occupied);
    if (areaPallets.length === 0) return "bg-slate-800/40 border-cyan-500/20";
    const avgDays = areaPallets.reduce((acc, b) => acc + b.daysInStorage, 0) / areaPallets.length;
    if (avgDays > 30) return "bg-red-500/40 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]";
    if (avgDays > 20) return "bg-orange-500/40 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]";
    if (avgDays > 10) return "bg-yellow-500/40 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]";
    return "bg-blue-500/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]";
  };

  const renderBlock = (block: any) => {
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
        <div className="h-[350px] relative bg-white dark:bg-black rounded-[2.5rem] border border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] shrink-0">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2 text-cyan-400 font-black text-[9px] uppercase tracking-widest italic animate-pulse">
            <View size={12}/> Mapa de Calor Navegable [Heat Map Mode]
          </div>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '25px 25px' }}></div>
          
          <div className="flex gap-2 p-6 items-center justify-center h-full overflow-x-auto relative z-0">
            {/* PUERTA ENTRADA EXP (Izquierda) [1] */}
            <div className="flex flex-col items-center gap-1 text-cyan-500/30 px-3">
              <DoorOpen size={28} />
              <span className="text-[12px] font-black uppercase vertical-text">Entrada Exp</span>
            </div>

            {zones.map(zone => (
              <button 
                key={zone.id} 
                onClick={() => setSelectedZone(zone.id)}
                className={`p-3 border-2 rounded-2xl flex flex-col items-center transition-all hover:scale-105 ${selectedZone === zone.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-500/20 bg-cyan-950/20'}`}
              >
                <span className="text-[7px] font-black text-cyan-500/60 mb-2 uppercase tracking-widest">{zone.name}</span>
                <div className={`flex ${zone.layout === 'vertical' ? 'flex-col' : 'flex-row'} gap-1.5`}>
                  {zone.areas.map((area: string) => (
                    <div key={area} className={`w-20 h-18 rounded border-2 flex items-center justify-center ${getAreaHeatColor(area)}`}>
                      <span className="text-[12px] font-black text-white/80">{area}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}

            {/* PUERTA SALIDA HORNO (Derecha) [1] */}
            <div className="flex flex-col items-center gap-1 text-cyan-500/30 px-3">
              <span className="text-[12px] font-black uppercase vertical-text">Salida Horno</span>
              <DoorOpen size={28} className="rotate-0" />
            </div>
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
            <button onClick={() => setIsNewZoneModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={20} /> Nueva Zona</button>
          </div>

          <div className="bg-white/40 dark:bg-slate-950/40 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-12 overflow-x-auto shadow-inner relative">
            <div className="min-w-max flex items-center justify-center">
               {/* CORRECCIÓN: El contenedor de áreas ahora respeta la propiedad layout (flex-col para Zona 3) */}
               <div className={`flex ${zones.find(z => z.id === selectedZone)?.layout === 'vertical' ? 'flex-col' : 'flex-row'} items-center gap-16`}>
                 {zones.find(z => z.id === selectedZone)?.areas.map((area: string, index: number) => (
                   <div key={area} className={`flex ${zones.find(z => z.id === selectedZone)?.layout === 'vertical' ? 'flex-col' : 'flex-row'} items-center gap-16`}>
                     {/* Pasillo vertical entre H y Mamparista */}
                     {selectedZone === "expediciones" && index === 1 && (
                       <div className="w-14 bg-slate-200 dark:bg-slate-800/30 rounded-xl min-h-[350px] border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                          <span className="rotate-90 text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Pasillo</span>
                       </div>
                     )}
                     {/* Pasillo vertical entre C y B */}
                     {selectedZone === "zona_2" && index === 1 && (
                       <div className="w-14 bg-slate-200 dark:bg-slate-800/30 rounded-xl min-h-[350px] border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                          <span className="rotate-90 text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Pasillo</span>
                       </div>
                     )}
                     {/* Pasillo horizontal entre A y ?? */}
                     {selectedZone === "zona_3" && index === 1 && (
                       <div className="h-14 bg-slate-200 dark:bg-slate-800/30 rounded-xl min-w-[350px] border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Pasillo</span>
                       </div>
                     )}
                     {renderArea(area)}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR DE DETALLES: OVERLAY CON ID REDUCIDO (text-5xl) */}
      {selectedBlock && (
        <div className="fixed top-0 right-0 h-full w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 shadow-[-20px_0_60px_rgba(0,0,0,0.2)] animate-in slide-in-from-right duration-500 flex flex-col overflow-hidden">
          
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg"><Package size={24} /></div>
               <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white leading-none">Detalle del Palet</h2>
            </div>
            <button onClick={() => setSelectedBlock(null)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500"><X size={32} strokeWidth={3}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden">
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-black mb-2 tracking-[0.4em]">ID Ubicación</div>
              {/* CORRECCIÓN: text-5xl para que no se desborde del marco */}
              <div className="text-5xl font-black tracking-tighter text-blue-600 dark:text-blue-400 leading-none break-all uppercase">{selectedBlock.id}</div>
              {selectedBlock.occupied && (
                <div className="mt-5 inline-flex px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Prioridad {selectedBlock.priority}</div>
              )}
              {!selectedBlock.occupied && (
                <div className="mt-5 inline-flex px-4 py-1.5 rounded-full bg-slate-500/10 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-500/20">Disponible</div>
              )}
            </div>

            {selectedBlock.occupied ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-transparent shadow-sm">
                    <div className="p-3.5 bg-blue-500/10 rounded-2xl text-blue-500"><User size={22} /></div>
                    <div className="flex-1"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Cliente / Destino</p><p className="text-lg font-bold">{selectedBlock.client}</p></div>
                  </div>
                  <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl">
                    <div className="p-3.5 bg-purple-500/10 rounded-2xl text-purple-500"><BarChart3 size={22} /></div>
                    <div className="flex-1"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Tipo de Vidrio</p><p className="text-lg font-bold">{selectedBlock.type}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl text-center shadow-sm">
                       <div className="flex items-center justify-center gap-2 text-slate-400 mb-2"><Maximize2 size={16} /><span className="text-[9px] font-black uppercase tracking-wider">Medidas</span></div>
                       <p className="text-base font-bold leading-none">{selectedBlock.dimensions}</p>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl text-center shadow-sm">
                       <div className="flex items-center justify-center gap-2 text-slate-400 mb-2"><Weight size={16} /><span className="text-[9px] font-black uppercase tracking-wider">Carga Total</span></div>
                       <p className="text-base font-bold leading-none">{selectedBlock.weight}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl hover:border-emerald-500/20 transition-all">
                    <div className="p-3.5 bg-emerald-500/10 rounded-2xl text-emerald-500 shadow-sm"><Clock size={22} /></div>
                    <div className="flex-1"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Días en Stock</p><p className={`text-lg font-black ${selectedBlock.daysInStorage > 30 ? 'text-red-500' : 'text-blue-500'}`}>{selectedBlock.daysInStorage} días</p></div>
                  </div>
                  <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl shadow-sm">
                    <div className="p-3.5 bg-slate-500/10 rounded-2xl text-slate-500 shadow-sm"><Calendar size={22} /></div>
                    <div className="flex-1"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Último Movimiento</p><p className="text-lg font-bold">{selectedBlock.lastUpdate}</p></div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4 pb-12 shrink-0">
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[1.8rem] shadow-xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 transition-all"><Check size={22} strokeWidth={3} /> Procesar Salida</button>
                  <div className="grid grid-cols-2 gap-4"><button className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase transition-all shadow-sm">Mover</button><button className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase transition-all shadow-sm">Editar</button></div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800/40 rounded-full flex items-center justify-center">
                  <Package size={40} className="text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-600 dark:text-slate-400 uppercase">Ubicación Disponible</h3>
                <p className="text-sm text-slate-500 max-w-[280px]">Esta ubicación está libre y lista para recibir nuevo material.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ZONA */}
      {isNewZoneModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg"><Plus size={24} /></div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">Nueva Zona Almacén</h2>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={24} strokeWidth={3}/></button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              {/* Error Message */}
              {modalError && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">{modalError}</p>
                </div>
              )}

              {/* Grid de 2 columnas */}
              <div className="grid grid-cols-2 gap-6">
                {/* Nombre Zona */}
                <div className="flex flex-col gap-3 col-span-1">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nombre de la Zona</label>
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={(e) => { setNewZoneName(e.target.value); setModalError(""); }}
                    placeholder="Ej: CMS"
                    className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
                  />
                </div>

                {/* Tipo de Zona */}
                <div className="flex flex-col gap-3 col-span-1">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tipo de Zona</label>
                  <select
                    value={newZoneType}
                    onChange={(e) => setNewZoneType(e.target.value as any)}
                    className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-semibold"
                  >
                    <option value="produccion">Producción</option>
                    <option value="almacenamiento">Almacenamiento</option>
                    <option value="expedicion">Expedición</option>
                  </select>
                </div>

              </div>

              {/* Layout */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Layout de posiciones</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewZoneLayout("horizontal")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-colors ${
                      newZoneLayout === "horizontal"
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    ↔ Horizontal
                  </button>
                  <button
                    onClick={() => setNewZoneLayout("vertical")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-colors ${
                      newZoneLayout === "vertical"
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    ↕ Vertical
                  </button>
                </div>
              </div>

              {/* Posiciones con Ubicaciones Individuales */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Posiciones con Ubicaciones</label>
                  <button
                    onClick={() => setNewZonePositions([...newZonePositions, { name: String.fromCharCode(65 + newZonePositions.length), locations: 10 }])}
                    className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {newZonePositions.map((pos, idx) => (
                    <div key={idx} className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                      {/* Nombre Posición */}
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Posición</label>
                        <input
                          type="text"
                          value={pos.name}
                          onChange={(e) => {
                            const updated = [...newZonePositions];
                            updated[idx].name = e.target.value.toUpperCase();
                            setNewZonePositions(updated);
                            setModalError("");
                          }}
                          placeholder="A, B, C..."
                          maxLength={3}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-sm"
                        />
                      </div>

                      {/* Ubicaciones */}
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Ubicaciones</label>
                        <input
                          type="number"
                          value={pos.locations}
                          onChange={(e) => {
                            const updated = [...newZonePositions];
                            updated[idx].locations = parseInt(e.target.value) || 1;
                            setNewZonePositions(updated);
                            setModalError("");
                          }}
                          min="1"
                          placeholder="10"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-sm"
                        />
                      </div>

                      {/* Eliminar */}
                      {newZonePositions.length > 1 && (
                        <button
                          onClick={() => setNewZonePositions(newZonePositions.filter((_, i) => i !== idx))}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-2xl">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  📊 Se crearán: <strong>{newZonePositions.length} posiciones con {newZonePositions.reduce((sum, p) => sum + p.locations, 0)} ubicaciones totales</strong>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 sticky bottom-0 bg-white dark:bg-slate-900">
              <button
                onClick={closeModal}
                disabled={isCreatingZone}
                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl uppercase text-sm tracking-wider transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddZone}
                disabled={isCreatingZone}
                className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-black rounded-2xl uppercase text-sm tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isCreatingZone ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check size={18} /> Crear Zona
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}