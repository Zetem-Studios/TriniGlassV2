import React, { useState, useRef } from 'react';

interface GridCell {
  col: string;
  row: number;
  x: number;
  y: number;
}

interface Area {
  id: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CanvasGridTest: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [gridSize] = useState({ cellWidth: 40, cellHeight: 40 });
  
  // Límites máximos del canvas
  const MAX_BOUNDS = {
    startCol: 'A',
    endCol: 'AZ',
    startRow: 1,
    endRow: 52
  };
  
  const [gridBounds, setGridBounds] = useState({ 
    startCol: 'A', 
    endCol: 'Z', 
    startRow: 1, 
    endRow: 25 
  });
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedArea, setDraggedArea] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [areaStart, setAreaStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Generar letras para columnas (A-Z, AA-AZ, etc.)
  const generateColumnLetters = (start: string, end: string): string[] => {
    const letters: string[] = [];
    
    // Función para convertir letra a número
    const letterToNumber = (letter: string): number => {
      if (letter.length === 1) {
        return letter.charCodeAt(0) - 65; // A=0, B=1, ..., Z=25
      }
      // Para AA, AB, etc.
      const first = letter.charCodeAt(0) - 65;
      const second = letter.charCodeAt(1) - 65;
      return first * 26 + second + 26;
    };
    
    // Función para convertir número a letra
    const numberToLetter = (num: number): string => {
      if (num < 26) {
        return String.fromCharCode(65 + num);
      }
      const first = Math.floor(num / 26) - 1;
      const second = num % 26;
      return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
    };
    
    const startNum = letterToNumber(start);
    const endNum = letterToNumber(end);
    
    for (let i = startNum; i <= endNum; i++) {
      letters.push(numberToLetter(i));
    }
    
    return letters;
  };

  // Calcular dimensiones totales del canvas
  const calculateCanvasSize = () => {
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const rows = gridBounds.endRow - gridBounds.startRow + 1;
    
    return {
      width: columns.length * gridSize.cellWidth,
      height: rows * gridSize.cellHeight
    };
  };

  // Generar celdas del grid
  const generateGridCells = (): GridCell[] => {
    const cells: GridCell[] = [];
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (let row = gridBounds.startRow; row <= gridBounds.endRow; row++) {
        cells.push({
          col: columns[colIndex],
          row: row,
          x: colIndex * gridSize.cellWidth,
          y: (row - gridBounds.startRow) * gridSize.cellHeight
        });
      }
    }
    
    return cells;
  };

  // Expandir grid horizontalmente (añadir bloque completo AA-AZ)
  const expandHorizontal = () => {
    const currentEnd = gridBounds.endCol;
    const columns = generateColumnLetters(currentEnd, currentEnd);
    const lastCol = columns[columns.length - 1];
    
    // Si estamos en Z, añadir bloque completo AA-AZ
    if (lastCol === 'Z') {
      setGridBounds(prev => ({ ...prev, endCol: 'AZ' }));
    } else if (lastCol === 'AZ') {
      // Si ya llegamos a AZ, añadir bloque BA-BZ
      setGridBounds(prev => ({ ...prev, endCol: 'BZ' }));
    } else if (lastCol === 'BZ') {
      // Si ya llegamos a BZ, añadir bloque CA-CZ
      setGridBounds(prev => ({ ...prev, endCol: 'CZ' }));
    }
    // Podemos seguir añadiendo más bloques según sea necesario
  };

  // Expandir grid verticalmente (añadir bloque completo 00-025)
  const expandVertical = () => {
    const currentEnd = gridBounds.endRow;
    
    // Si estamos en 25, añadir bloque completo 00-025 (26 filas más)
    if (currentEnd === 25) {
      setGridBounds(prev => ({ ...prev, endRow: 51 })); // 25 + 26 = 51
    } else if (currentEnd === 51) {
      // Si ya llegamos a 51, añadir otro bloque 00-025
      setGridBounds(prev => ({ ...prev, endRow: 77 })); // 51 + 26 = 77
    } else if (currentEnd === 77) {
      // Si ya llegamos a 77, añadir otro bloque
      setGridBounds(prev => ({ ...prev, endRow: 103 })); // 77 + 26 = 103
    }
    // Podemos seguir añadiendo más bloques según sea necesario
  };

  // Convertir coordenadas de píxeles a coordenadas de grid
  const pixelsToGrid = (x: number, y: number) => {
    const col = Math.floor(x / gridSize.cellWidth);
    const row = Math.floor(y / gridSize.cellHeight);
    return { col, row };
  };

  // Convertir coordenadas de grid a píxeles (snap-to-grid)
  const gridToPixels = (col: number, row: number) => {
    return {
      x: col * gridSize.cellWidth,
      y: row * gridSize.cellHeight
    };
  };

  // Obtener coordenadas de celda alfanumérica
  const getCellCoordinates = (x: number, y: number) => {
    const { col, row } = pixelsToGrid(x, y);
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const actualRow = gridBounds.startRow + row;
    return {
      col: columns[col] || '',
      row: actualRow,
      x: col * gridSize.cellWidth,
      y: row * gridSize.cellHeight
    };
  };

  // Añadir área en posición A1
  const addArea = () => {
    const newArea: Area = {
      id: `area-${Date.now()}`,
      col: 'A',
      row: 1,
      x: 0,
      y: 0,
      width: gridSize.cellWidth,
      height: gridSize.cellHeight
    };
    setAreas(prev => [...prev, newArea]);
  };

  // Manejar hover en celdas
  const handleCellHover = (col: string, row: number) => {
    setHoveredCell(`${col}${row}`);
  };

  // Iniciar drag de área
  const handleAreaMouseDown = (e: React.MouseEvent, areaId: string) => {
    e.preventDefault();
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    setIsDragging(true);
    setDraggedArea(areaId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setAreaStart({ x: area.x, y: area.y, width: area.width, height: area.height });
  };

  // Iniciar redimensionamiento
  const handleResizeMouseDown = (e: React.MouseEvent, areaId: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    setIsResizing(true);
    setDraggedArea(areaId);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setAreaStart({ x: area.x, y: area.y, width: area.width, height: area.height });
  };

  // Manejar movimiento del mouse
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && draggedArea) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newX = areaStart.x + deltaX;
      let newY = areaStart.y + deltaY;
      
      // Snap-to-grid
      const { col, row } = pixelsToGrid(newX, newY);
      
      // RESTRICCIÓN: No permitir movimiento fuera del canvas
      const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
      const maxColIndex = columns.length - 1;
      const maxRowIndex = gridBounds.endRow - gridBounds.startRow;
      
      // Obtener el área actual para verificar su tamaño
      const currentArea = areas.find(a => a.id === draggedArea);
      const areaWidthInCols = Math.ceil(currentArea!.width / gridSize.cellWidth);
      const areaHeightInRows = Math.ceil(currentArea!.height / gridSize.cellHeight);
      
      // Limitar a los límites del canvas considerando el tamaño del área
      const constrainedCol = Math.max(0, Math.min(col, maxColIndex - areaWidthInCols + 1));
      const constrainedRow = Math.max(0, Math.min(row, maxRowIndex - areaHeightInRows + 1));
      
      newX = gridToPixels(constrainedCol, constrainedRow).x;
      newY = gridToPixels(constrainedCol, constrainedRow).y;
      
      const coords = getCellCoordinates(newX, newY);
      const updatedArea = { ...areas.find(a => a.id === draggedArea)!, x: newX, y: newY, col: coords.col, row: coords.row };
      
      setAreas(prev => prev.map(area => 
        area.id === draggedArea 
          ? updatedArea
          : area
      ));
      
      // Verificar si necesita expansión del canvas
      checkAndExpandCanvas(updatedArea);
    }
    
    if (isResizing && draggedArea && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newX = areaStart.x;
      let newY = areaStart.y;
      let newWidth = areaStart.width;
      let newHeight = areaStart.height;
      
      // Mejorar lógica de redimensionamiento para que sea más intuitivo
      // Obtener límites del canvas para restricción inmediata
      const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
      const maxColIndex = columns.length - 1;
      const maxRowIndex = gridBounds.endRow - gridBounds.startRow;
      
      switch (resizeHandle) {
        case 'nw':
          // Esquina superior izquierda: ajusta ambas dimensiones y mueve origen
          newX = areaStart.x + deltaX;
          newY = areaStart.y + deltaY;
          newWidth = areaStart.width - deltaX;
          newHeight = areaStart.height - deltaY;
          break;
        case 'ne':
          // Esquina superior derecha: ajusta ancho y mueve origen verticalmente
          newY = areaStart.y + deltaY;
          newWidth = areaStart.width + deltaX;
          newHeight = areaStart.height - deltaY;
          break;
        case 'sw':
          // Esquina inferior izquierda: ajusta alto y mueve origen horizontalmente
          newX = areaStart.x + deltaX;
          newWidth = areaStart.width - deltaX;
          newHeight = areaStart.height + deltaY;
          break;
        case 'se':
          // Esquina inferior derecha: ajusta ambos dimensiones
          newWidth = areaStart.width + deltaX;
          newHeight = areaStart.height + deltaY;
          break;
      }
      
      // RESTRICCIÓN INMEDIATA: Prevenir que las dimensiones excedan los límites del canvas
      if (newWidth < gridSize.cellWidth) newWidth = gridSize.cellWidth;
      if (newHeight < gridSize.cellHeight) newHeight = gridSize.cellHeight;
      
      // Calcular posiciones en grid para verificar límites
      const { col: tempStartCol, row: tempStartRow } = pixelsToGrid(newX, newY);
      const { col: tempEndCol, row: tempEndRow } = pixelsToGrid(newX + newWidth, newY + newHeight);
      
      // Ajustar inmediatamente si excede límites
      if (tempEndCol > maxColIndex) {
        const excessCols = tempEndCol - maxColIndex;
        newWidth -= excessCols * gridSize.cellWidth;
      }
      if (tempEndRow > maxRowIndex) {
        const excessRows = tempEndRow - maxRowIndex;
        newHeight -= excessRows * gridSize.cellHeight;
      }
      if (tempStartCol < 0) {
        const excessCols = -tempStartCol;
        newX += excessCols * gridSize.cellWidth;
        newWidth -= excessCols * gridSize.cellWidth;
      }
      if (tempStartRow < 0) {
        const excessRows = -tempStartRow;
        newY += excessRows * gridSize.cellHeight;
        newHeight -= excessRows * gridSize.cellHeight;
      }
      
      // RESTRICCIÓN: No permitir redimensionamiento fuera del canvas
      // Variables ya declaradas arriba
      
      // DEPURACIÓN: Verificar cálculo de redimensionamiento en tiempo real
      const { col: proposedStartCol, row: proposedStartRow } = pixelsToGrid(newX, newY);
      const { col: proposedEndCol, row: proposedEndRow } = pixelsToGrid(newX + newWidth, newY + newHeight);
      
      console.log('=== DEPURACIÓN REDIMENSIONAMIENTO ===');
      console.log('handle de redimensionamiento:', resizeHandle);
      console.log('Área inicial:', areaStart);
      console.log('Valores propuestos:');
      console.log('  proposedStartCol:', proposedStartCol, 'proposedStartRow:', proposedStartRow);
      console.log('  proposedEndCol:', proposedEndCol, 'proposedEndRow:', proposedEndRow);
      console.log('  Límites canvas - maxColIndex:', maxColIndex, 'maxRowIndex:', maxRowIndex);
      
      // BLOQUEO DURO: Forzar dentro de los límites absolutos del canvas
      const lockedStartCol = Math.max(0, Math.min(proposedStartCol, maxColIndex));
      const lockedStartRow = Math.max(0, Math.min(proposedStartRow, maxRowIndex));
      const lockedEndCol = Math.max(lockedStartCol, Math.min(proposedEndCol, maxColIndex));
      const lockedEndRow = Math.max(lockedStartRow, Math.min(proposedEndRow, maxRowIndex));
      
      console.log('Valores bloqueados:');
      console.log('  lockedStartCol:', lockedStartCol, 'lockedStartRow:', lockedStartRow);
      console.log('  lockedEndCol:', lockedEndCol, 'lockedEndRow:', lockedEndRow);
      
      // Snap-to-grid y tamaño mínimo - más permisivo para mejor UX
      if (newWidth >= gridSize.cellWidth && newHeight >= gridSize.cellHeight) {
        // Usar valores bloqueados - no hay escape posible
        const finalStartCol = lockedStartCol;
        const finalStartRow = lockedStartRow;
        const finalEndCol = lockedEndCol;
        const finalEndRow = lockedEndRow;
        
        const snappedStart = gridToPixels(finalStartCol, finalStartRow);
        const snappedEnd = gridToPixels(finalEndCol, finalEndRow);
        
        newX = snappedStart.x;
        newY = snappedStart.y;
        newWidth = snappedEnd.x - snappedStart.x;
        newHeight = snappedEnd.y - snappedStart.y;
        
        console.log('Valores finales aplicados:');
        console.log('  newX:', newX, 'newY:', newY);
        console.log('  newWidth:', newWidth, 'newHeight:', newHeight);
        console.log('  snappedStart:', snappedStart, 'snappedEnd:', snappedEnd);
        
        const resizeCoords = getCellCoordinates(newX, newY);
        const updatedArea = { ...areas.find(a => a.id === draggedArea)!, x: newX, y: newY, width: newWidth, height: newHeight, col: resizeCoords.col, row: resizeCoords.row };
        
        setAreas(prev => prev.map(area => 
          area.id === draggedArea 
            ? updatedArea
            : area
        ));
        
        // Verificar si necesita expansión del canvas
        console.log('=== ANTES DE checkAndExpandCanvas ===');
        console.log('updatedArea que se pasa:', updatedArea);
        console.log('updatedArea.width:', updatedArea.width, 'updatedArea.height:', updatedArea.height);
        console.log('updatedArea.x:', updatedArea.x, 'updatedArea.y:', updatedArea.y);
        console.log('¿Estamos en redimensionamiento?', isResizing);
        console.log('¿Hay draggedArea?', draggedArea);
        console.log('¿Hay resizeHandle?', resizeHandle);
        checkAndExpandCanvas(updatedArea);
      }
    }
  };

  // Función para detectar y expandir canvas automáticamente (lógica predictiva)
  const checkAndExpandCanvas = (area: Area) => {
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const currentColIndex = columns.indexOf(area.col);
    const currentRowIndex = area.row - gridBounds.startRow;
    
    // Calcular límites del área
    const areaEndColIndex = currentColIndex + Math.ceil(area.width / gridSize.cellWidth) - 1;
    const areaEndRowIndex = currentRowIndex + Math.ceil(area.height / gridSize.cellHeight) - 1;
    
    // Obtener dimensiones actuales del canvas
    const canvasWidth = columns.length;
    const canvasHeight = gridBounds.endRow - gridBounds.startRow + 1;
    
    // Para comparación correcta de columnas
    const maxColumns = generateColumnLetters(MAX_BOUNDS.startCol, MAX_BOUNDS.endCol);
    const currentEndIndex = columns.indexOf(gridBounds.endCol);
    const maxEndIndex = maxColumns.indexOf(MAX_BOUNDS.endCol);
    
    // DEBUG: Mostrar valores para depuración
    console.log('=== DEBUG EXPANSIÓN ===');
    console.log('Área:', area);
    console.log('area.col:', area.col);
    console.log('currentColIndex:', currentColIndex);
    console.log('areaEndColIndex:', areaEndColIndex);
    console.log('canvasWidth:', canvasWidth);
    console.log('canvasWidth - 1:', canvasWidth - 1);
    console.log('gridBounds.endCol:', gridBounds.endCol);
    console.log('MAX_BOUNDS.endCol:', MAX_BOUNDS.endCol);
    console.log('Condición horizontal:', areaEndColIndex >= canvasWidth - 1 && gridBounds.endCol < MAX_BOUNDS.endCol);
    console.log('Primera parte (areaEndColIndex >= canvasWidth - 1):', areaEndColIndex >= canvasWidth - 1);
    console.log('Segunda parte (currentEndIndex < maxEndIndex):', currentEndIndex < maxEndIndex);
    console.log('Comparación de índices - currentEndIndex:', currentEndIndex, 'maxEndIndex:', maxEndIndex);
    
    // LÓGICA PREDICTIVA: Expandir cuando el área alcance la última celda disponible
    let needsHorizontalExpansion = false;
    let needsVerticalExpansion = false;
    let newEndCol = gridBounds.endCol;
    let newEndRow = gridBounds.endRow;
    
    // Expansión horizontal predictiva: cuando área alcanza anchura-1
    if (areaEndColIndex >= canvasWidth - 1 && currentEndIndex < maxEndIndex) {
      console.log('✅ ACTIVANDO EXPANSIÓN HORIZONTAL');
      needsHorizontalExpansion = true;
      
      // Expandir al siguiente bloque completo (AA-AZ, BA-BZ, etc.)
      const currentBlockIndex = Math.floor(currentEndIndex / 26);
      const nextBlockIndex = currentBlockIndex + 1;
      const maxBlockIndex = Math.floor((maxColumns.length - 1) / 26);
      
      console.log('currentBlockIndex:', currentBlockIndex);
      console.log('nextBlockIndex:', nextBlockIndex);
      console.log('maxBlockIndex:', maxBlockIndex);
      
      if (nextBlockIndex <= maxBlockIndex) {
        const newEndIndex = Math.min((nextBlockIndex + 1) * 26 - 1, maxColumns.length - 1);
        newEndCol = maxColumns[newEndIndex];
        console.log('newEndCol:', newEndCol);
      }
    } else {
      console.log('❌ NO SE ACTIVA EXPANSIÓN HORIZONTAL');
    }
    
    // Expansión vertical predictiva: cuando área alcanza altura-1
    if (areaEndRowIndex >= canvasHeight - 1 && gridBounds.endRow < MAX_BOUNDS.endRow) {
      console.log('✅ ACTIVANDO EXPANSIÓN VERTICAL');
      needsVerticalExpansion = true;
      // Expandir al siguiente bloque completo de 26 filas
      const currentEndRow = gridBounds.endRow;
      const nextBlockStart = Math.floor((currentEndRow - 1) / 26) * 26 + 27;
      const maxEndRow = MAX_BOUNDS.endRow;
      
      newEndRow = Math.min(nextBlockStart + 25, maxEndRow);
      console.log('newEndRow:', newEndRow);
    }
    
    // Aplicar expansión si es necesario
    if (needsHorizontalExpansion || needsVerticalExpansion) {
      console.log('🚀 APLICANDO EXPANSIÓN - Horizontal:', needsHorizontalExpansion, 'Vertical:', needsVerticalExpansion);
      setGridBounds(prev => ({
        ...prev,
        endCol: newEndCol,
        endRow: newEndRow
      }));
    } else {
      console.log('📦 SIN EXPANSIÓN APLICAR');
    }
    console.log('========================');
  };

  // Finalizar drag/resize
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setDraggedArea(null);
    setResizeHandle(null);
  };

  const canvasSize = calculateCanvasSize();
  const gridCells = generateGridCells();

  // Añadir event listeners globales
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, draggedArea, resizeHandle, dragStart, areaStart]);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Canvas Expansible - Testing</h1>
        
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="text-sm">
              <span className="font-semibold">Rango actual:</span> {gridBounds.startCol}{gridBounds.startRow} - {gridBounds.endCol}{gridBounds.endRow}
            </div>
            <div className="text-sm">
              <span className="font-semibold">Dimensiones:</span> {canvasSize.width}x{canvasSize.height}px
            </div>
            <div className="text-sm">
              <span className="font-semibold">Celda hover:</span> {hoveredCell || 'Ninguna'}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={addArea}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              Añadir Área
            </button>
            <button
              onClick={expandHorizontal}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Expandir Horizontal (+bloque AA-AZ)
            </button>
            <button
              onClick={expandVertical}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Expandir Vertical (+bloque 00-025)
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 overflow-auto">
          <div 
            ref={canvasRef}
            className="relative border border-gray-300"
            style={{ 
              width: `${canvasSize.width}px`, 
              height: `${canvasSize.height}px`,
              minWidth: '800px',
              minHeight: '600px'
            }}
          >
            {gridCells.map((cell) => (
              <div
                key={`${cell.col}${cell.row}`}
                className="absolute border border-gray-200 flex items-center justify-center text-xs cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-colors"
                style={{
                  left: `${cell.x}px`,
                  top: `${cell.y}px`,
                  width: `${gridSize.cellWidth}px`,
                  height: `${gridSize.cellHeight}px`
                }}
                onMouseEnter={() => handleCellHover(cell.col, cell.row)}
                onMouseLeave={() => setHoveredCell(null)}
              >
                <span className="select-none text-gray-600">
                  {cell.col}{cell.row}
                </span>
              </div>
            ))}
            
            {/* Renderizar áreas */}
            {areas.map((area) => (
              <div
                key={area.id}
                className="absolute bg-blue-500 bg-opacity-30 border-2 border-blue-600 cursor-move hover:bg-opacity-40 transition-colors"
                style={{
                  left: `${area.x}px`,
                  top: `${area.y}px`,
                  width: `${area.width}px`,
                  height: `${area.height}px`
                }}
                onMouseDown={(e) => handleAreaMouseDown(e, area.id)}
              >
                {/* Handles de redimensionamiento en las esquinas */}
                <div 
                  className="absolute w-2 h-2 bg-blue-800 -top-1 -left-1 cursor-nw-resize"
                  title="Redimensionar esquina superior izquierda"
                  onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'nw')}
                />
                <div 
                  className="absolute w-2 h-2 bg-blue-800 -top-1 -right-1 cursor-ne-resize"
                  title="Redimensionar esquina superior derecha"
                  onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'ne')}
                />
                <div 
                  className="absolute w-2 h-2 bg-blue-800 -bottom-1 -left-1 cursor-sw-resize"
                  title="Redimensionar esquina inferior izquierda"
                  onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'sw')}
                />
                <div 
                  className="absolute w-2 h-2 bg-blue-800 -bottom-1 -right-1 cursor-se-resize"
                  title="Redimensionar esquina inferior derecha"
                  onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'se')}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Información del Testing:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Canvas inicial: A-Z x 1-25 (26x25 = 650 celdas)</li>
            <li>• Tamaño de celda: 40x40px (fijo, sin escalado)</li>
            <li>• Expansión horizontal: Z→AA-AZ→BA-BZ→CA-CZ...</li>
            <li>• Expansión vertical: 25→51→77→103... (bloques de 26 filas)</li>
            <li>• Hover sobre celdas para ver coordenadas</li>
            <li>• Scroll disponible si el canvas excede el viewport</li>
            <li>• Áreas: Click en "Añadir Área" para crear área en A1</li>
            <li>• Cursor mano al hover sobre el área</li>
            <li>• Cursor redimensionamiento en esquinas del área</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CanvasGridTest;
