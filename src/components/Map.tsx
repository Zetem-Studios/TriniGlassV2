import React from 'react';
import Zones from './Zones';


interface MapProps {
  zones: Array<{
    id: string;
    name: string;
    subzones: { [key: string]: string[] };
  }>;
  blocks: any[];
  selectedZone: string;
  selectedBlock: any;
  onBlockClick: (block: any) => void;
  preview?: boolean;
  disableInteraction?: boolean;
}

const Map: React.FC<MapProps> = ({ zones, blocks, selectedZone, selectedBlock, onBlockClick, preview = false, disableInteraction = false }) => {
  return (
    <div className="w-full">
      <Zones
        zones={zones}
        blocks={blocks}
        selectedZone={selectedZone}
        selectedBlock={selectedBlock}
        onBlockClick={onBlockClick}
        preview={preview}
        disableInteraction={disableInteraction}
      />
    </div>
  );
};

export default Map;