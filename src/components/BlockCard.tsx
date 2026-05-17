import { Box } from "lucide-react";


interface BlockCardProps {
  block: {
    id: string; // id interno de Firestore
    codigo_barra?: string; // mostrar en la UI
    daysInStorage: number;
    occupied: boolean;
  };
  isSelected: boolean;
  isRecommended?: boolean;
  onClick: () => void;
}

export default function BlockCard({ block, isSelected, isRecommended = false, onClick }: BlockCardProps) {
  // Determinar colores basados en días en storage
  let colors = "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-400";
  
  if (block.occupied) {
    if (block.daysInStorage > 30) {
      colors = "bg-red-100 dark:bg-red-500/20 border-red-400 dark:border-red-500 text-red-600 dark:text-red-400";
    } else if (block.daysInStorage > 20) {
      colors = "bg-orange-100 dark:bg-orange-500/20 border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400";
    } else if (block.daysInStorage > 10) {
      colors = "bg-yellow-100 dark:bg-yellow-500/20 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-500";
    } else {
      colors = "bg-blue-100 dark:bg-blue-500/20 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400";
    }
  }

  const selectedClasses = isSelected 
    ? 'ring-4 ring-cyan-500 scale-110 z-10' 
    : 'hover:scale-105';
  const recommendedClasses = isRecommended
    ? 'animate-pulse ring-4 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]'
    : '';

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 shadow-sm shrink-0 ${colors} ${selectedClasses} ${recommendedClasses} min-w-[40px] min-h-[35px] w-full h-full`}
    >
      {block.occupied ? (
        <>
          <span className="text-[13px] font-black tracking-tighter uppercase leading-tight break-all text-center">{block.codigo_barra ? block.codigo_barra : 'Sin código'}</span>
          <Box size={22} strokeWidth={2.5} />
          {block.daysInStorage > 0 && (
            <span className="text-[12px] font-bold">
              {block.daysInStorage}d
            </span>
          )}
        </>
      ) : (
        <span className="text-[11px] font-bold tracking-tight uppercase opacity-50">Vacío</span>
      )}
    </button>
  );
}
