import React from 'react';
import Zones from './Zones';

interface Block {
  id: string;
  [key: string]: unknown;
}

interface MapProps {
  zones: Array<{
    id: string;
    name: string;
    subzones: { [key: string]: string[] };
  }>;
  blocks: Block[];
  selectedZone: string;
  selectedBlock: Block | null;
  onBlockClick: (block: Block) => void;
  preview?: boolean;
}

const Map: React.FC<MapProps> = ({ zones, blocks, selectedZone, selectedBlock, onBlockClick, preview = false }) => {
  return (
    <div className="w-full">
      <Zones
        zones={zones}
        blocks={blocks}
        selectedZone={selectedZone}
        selectedBlock={selectedBlock}
        onBlockClick={onBlockClick}
        preview={preview}
      />
    </div>
  );
};

export default Map;