import { useState, useEffect } from "react";
import { 
  Search, Plus, ChevronDown, Check, X, Package, 
  Box, Layers, Calendar, Clock, 
  User, BarChart3, Maximize2, Weight, View, Zap, DoorOpen
} from "lucide-react";
import { getZones } from "../firebase";
import NewZoneModal from "./NewZoneModal";

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
  const [blocks] = useState(ALL_BLOCKS);

  // Cargar zonas creadas en Firebase y añadirlas al dropdown (sin tocar las hardcodeadas)
  useEffect(() => {
    getZones().then(data => {
      const normalized = data.map((z: any) => ({
        id: z.id,
        name: z.name,
        areas: z.posiciones.length > 0 ? z.posiciones : Object.keys(z.subzones),
        layout: z.layout ?? "horizontal",
      }));
      const nuevas = normalized.filter(fz => !INITIAL_ZONES.some(iz => iz.id === fz.id));
      if (nuevas.length > 0) setZones([...INITIAL_ZONES, ...nuevas]);
    }).catch(() => {});
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
    const data = await getZones();
    const normalized = data.map((z: any) => ({
      id: z.id,
      name: z.name,
      areas: z.posiciones.length > 0 ? z.posiciones : Object.keys(z.subzones),
      layout: z.layout ?? "horizontal",
    }));
    const nuevas = normalized.filter(fz => !INITIAL_ZONES.some(iz => iz.id === fz.id));
    setZones([...INITIAL_ZONES, ...nuevas]);
    setSelectedZone(zoneId);
    setIsNewZoneModalOpen(false);
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

            {INITIAL_ZONES.map(zone => (
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

      <NewZoneModal
        isOpen={isNewZoneModalOpen}
        onClose={() => setIsNewZoneModalOpen(false)}
        onZoneCreated={handleZoneCreated}
      />

    </div>
  );
}
