// NOTA IMPORTANTE:
// El grid (A-E, 1-8) solo representa la disposición visual de la nave en el mapa de calor navegable.
// El número real de huecos de una subzona puede ser diferente (mayor o menor) al número de posiciones dibujadas en el mapa.
// Las posiciones del grid sirven únicamente para mostrar la forma y localización de la subzona, NO su capacidad real.

import React from 'react';
import BlockCard from './BlockCard';

interface Block {
  id: string;
  area?: string;
  [key: string]: unknown;
}

interface ZoneProps {
  zoneId: string;
  zoneName: string;
  subzones: { [key: string]: string[] };
  blocks: Block[];
  selectedBlock: Block | null;
  onBlockClick: (block: Block) => void;
  onEmptySlotClick?: (zoneId: string, subzone: string, position: string) => void;
  preview?: boolean;
  disableInteraction?: boolean;
}

const Zone: React.FC<ZoneProps> = ({ zoneId, zoneName, subzones, blocks, selectedBlock, onBlockClick, onEmptySlotClick, preview = false}) => {
    subzones = subzones ?? {};
  // Create a map of position to block
  const positionToBlock: { [key: string]: Block } = {};

  // For each subzone, assign blocks to positions
  Object.entries(subzones).forEach(([subzoneName, positions]) => {
    const subzoneBlocks = blocks.filter(b => b.area === subzoneName);
    // Asegurar que positions sea un array
    const positionsArray = Array.isArray(positions) ? positions : [];
    positionsArray.forEach((position, index) => {
      if (subzoneBlocks[index]) {
        positionToBlock[position] = subzoneBlocks[index];
      } else {
        // Empty slot
        positionToBlock[position] = {
          id: `${subzoneName}-empty-${position}`,
          zoneId,
          area: subzoneName,
          position,
          occupied: false,
          daysInStorage: 0
        };
      }
    });
  });

  const rows = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const cols = ['A', 'B', 'C', 'D', 'E'];

  // Crear un set de posiciones que pertenecen a subzonas
  const subzonePositions = new Set<string>();
  Object.entries(subzones).forEach(([, positions]) => {
    const positionsArray = Array.isArray(positions) ? positions : [];
    positionsArray.forEach(pos => subzonePositions.add(pos));
  });

  return (
    <div className="flex flex-col gap-1 text-[10px] relative overflow-hidden">
      <h2 className="font-semibold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider text-center">
        {zoneName}
      </h2>
      <div className="relative min-h-[280px] bg-white dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-1" style={{paddingTop: '2.5rem', paddingRight: '2.5rem', paddingBottom: '2.5rem', paddingLeft: '2.5rem'}}>
        {preview ? (
          // Renderizar cada subzona como un solo rectángulo absoluto, color según el pallet más antiguo, sin interactividad ni tooltips
          Object.entries(subzones).map(([subzoneName, positions]) => {
            // Asegurar que positions sea un array
            const positionsArray = Array.isArray(positions) ? positions : [];
            // Calcular bounding box de la subzona
            const colIdxs = positionsArray.map(pos => cols.indexOf(pos[0])).filter(i => i >= 0);
            const rowIdxs = positionsArray.map(pos => rows.indexOf(pos.slice(1))).filter(i => i >= 0);
            if (colIdxs.length === 0 || rowIdxs.length === 0) return null;
            const minCol = Math.min(...colIdxs);
            const maxCol = Math.max(...colIdxs);
            const minRow = Math.min(...rowIdxs);
            const maxRow = Math.max(...rowIdxs);

            // Calcular estilos absolutos
            const totalCols = cols.length;
            const totalRows = rows.length;
            const left = `${(minCol / totalCols) * 100}%`;
            const top = `${(minRow / totalRows) * 100}%`;
            const width = `${((maxCol - minCol + 1) / totalCols) * 100}%`;
            const height = `${((maxRow - minRow + 1) / totalRows) * 100}%`;

            // Determinar color según el pallet más antiguo de la subzona
            const subzoneBlocks = blocks.filter(b => b.area === subzoneName && b.occupied);
            let colorClass = "bg-brand-400 dark:bg-brand-600 border-brand-700 dark:border-brand-900";
            if (subzoneBlocks.length > 0) {
              // Buscar el pallet con más días en storage
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const oldest = subzoneBlocks.reduce((max: any, b: any) => (b.daysInStorage as number) > (max.daysInStorage as number) ? b : max, subzoneBlocks[0]);
              if ((oldest.daysInStorage as number) > 30) {
                colorClass = "bg-red-500 dark:bg-red-700 border-red-700 dark:border-red-900";
              } else if ((oldest.daysInStorage as number) > 20) {
                colorClass = "bg-orange-400 dark:bg-orange-600 border-orange-600 dark:border-orange-900";
              } else if ((oldest.daysInStorage as number) > 10) {
                colorClass = "bg-yellow-300 dark:bg-yellow-600 border-yellow-500 dark:border-yellow-900";
              } else {
                colorClass = "bg-brand-400 dark:bg-brand-600 border-brand-700 dark:border-brand-900";
              }
            }

            return (
              <div
                key={subzoneName}
                className={`absolute flex items-center justify-center rounded-lg opacity-70 border text-white font-bold text-xs text-center select-none ${colorClass}`}
                style={{ left, top, width, height }}
                // No pointer events ni tooltips
                tabIndex={-1}
                aria-hidden="true"
              >
                <span className="w-full text-center pointer-events-none" style={{textShadow: '0 1px 2px #0008'}}>{subzoneName}</span>
              </div>
            );
          })
        ) : (
          // Mostrar todos los pallets de las subzonas de la zona seleccionada como lista, sin cuadrícula
          <div className="flex flex-row gap-6 w-full h-full p-2">
            {Object.keys(subzones).map(subzoneName => {
              const subzoneBlocks = blocks.filter(b => b.area === subzoneName);
              const hasEmpty = subzoneBlocks.some(b => !b.occupied);
              return (
                <div key={subzoneName} className="flex-1 min-w-[200px]">
                  <div className="font-bold text-xs text-brand-700 dark:text-brand-300 mb-1 uppercase text-center">{subzoneName}</div>
                  <div
                    className="grid gap-y-2 gap-x-px"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gridAutoRows: '1fr'
                    }}
                  >
                    {!hasEmpty && (
                      <div className="aspect-square min-w-[80px] max-w-[120px] w-full">
                        <BlockCard
                          block={{ id: `add-${subzoneName}`, daysInStorage: 0, occupied: false }}
                          isSelected={false}
                          onClick={() => onEmptySlotClick && onEmptySlotClick(zoneId, subzoneName, '')}
                        />
                      </div>
                    )}
                    {subzoneBlocks.length === 0 ? (
                      <div className="text-slate-400 text-center w-full col-span-full py-6 select-none opacity-60">Sin pallets</div>
                    ) : (
                      subzoneBlocks.map((block: unknown) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const anyBlock = block as any;
                        return (
                          <div key={anyBlock.id} className="aspect-square min-w-[80px] max-w-[120px] w-full">
                            <BlockCard
                              block={anyBlock}
                              isSelected={selectedBlock?.id === anyBlock.id}
                              onClick={() => onBlockClick(anyBlock)}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Zone;