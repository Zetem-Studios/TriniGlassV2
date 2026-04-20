import React from 'react';
import Zone from './Zone';

interface Block {
  id: string;
  zoneId?: string;
  [key: string]: unknown;
}

interface ZoneConfig {
  id: string;
  name: string;
  subzones: { [key: string]: string[] };
}

interface ZonesProps {
  zones: ZoneConfig[];
  blocks: Block[];
  selectedZone: string;
  selectedBlock: Block | null;
  onBlockClick: (block: Block) => void;
  preview?: boolean;
}

const Zones: React.FC<ZonesProps> = ({ zones, blocks, selectedZone, selectedBlock, onBlockClick, preview = false }) => {
  return (
    <div className="flex flex-row flex-nowrap gap-1 justify-start items-start w-full overflow-hidden">
      {zones.map(zone => (
        <div key={zone.id} className={`flex-shrink-0 w-[16.5%] min-w-[150px] max-h-[320px] overflow-hidden relative ${!preview && zone.id === selectedZone ? 'ring-2 ring-cyan-500 rounded-3xl p-1' : !preview ? 'opacity-90' : ''}`}>
          <Zone
            zoneId={zone.id}
            zoneName={zone.name}
            subzones={zone.subzones}
            blocks={blocks.filter(b => b.zoneId === zone.id)}
            selectedBlock={selectedBlock}
            onBlockClick={onBlockClick}
            preview={preview}
          />
        </div>
      ))}
    </div>
  );
};

export default Zones;