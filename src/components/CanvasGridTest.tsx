import React, { useState, useRef } from 'react';
import { MapDesignsManager } from './MapDesignsManager';
import { type MapDesign } from '../services/mapDesignsService';

interface GridCell {
  col: string;
  row: number;
  x: number;
  y: number;
}

interface SubArea {
  id: string;
  parentId: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Area {
  id: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  subAreas: SubArea[];
  // NUEVO: Referencia a zona real de Firebase
  zoneCode?: string; // Código de zona (A, B, H, etc.)
}

const CanvasGridTest: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Referencia al contenedor con overflow-auto
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
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedArea, setDraggedArea] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [areaStart, setAreaStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // Estados para edición de nombres
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingSubArea, setEditingSubArea] = useState<{ parentId: string; subAreaId: string } | null>(null);
  const [tempName, setTempName] = useState('');
  
  // Estados para sub-áreas
  const [selectedSubArea, setSelectedSubArea] = useState<{ subAreaId: string; parentId: string } | null>(null);
  const [isDraggingSubArea, setIsDraggingSubArea] = useState(false);
  const [isResizingSubArea, setIsResizingSubArea] = useState(false);
  const [draggedSubArea, setDraggedSubArea] = useState<string | null>(null);
  const [draggedSubAreaParent, setDraggedSubAreaParent] = useState<string | null>(null);
  
  // Estado para el gestor de diseños
  const [showDesignsManager, setShowDesignsManager] = useState(false);

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

  // Función para scroll automático cuando el cursor se acerca a los bordes del contenedor
  const autoScrollIfNeeded = (mouseX: number, mouseY: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const viewportWidth = containerRect.width;
    const viewportHeight = containerRect.height;
    
    // Margen para activar el scroll (en píxeles)
    const scrollMargin = 50;
    const scrollSpeed = 10; // píxeles por_FRAME
    
    // Calcular posición del cursor relativa al contenedor
    const relativeX = mouseX - containerRect.left;
    const relativeY = mouseY - containerRect.top;
    
    let scrollLeft = scrollContainer.scrollLeft;
    let scrollTop = scrollContainer.scrollTop;
    let needsScroll = false;
    
    // DEBUG: Mostrar valores para depuración
    console.log('=== DEBUG SCROLL AUTOMÁTICO (CURSOR) ===');
    console.log('Cursor:', { mouseX, mouseY });
    console.log('Contenedor:', { viewportWidth, viewportHeight });
    console.log('Posición relativa:', { relativeX, relativeY });
    console.log('Scroll actual:', { scrollLeft, scrollTop });
    
    // Scroll horizontal si el cursor se acerca al borde derecho
    if (relativeX > viewportWidth - scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL DERECHA (cursor)');
      scrollLeft = Math.min(scrollLeft + scrollSpeed, scrollContainer.scrollWidth - viewportWidth);
      needsScroll = true;
    }
    // Scroll horizontal si el cursor se acerca al borde izquierdo
    else if (relativeX < scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL IZQUIERDA (cursor)');
      scrollLeft = Math.max(0, scrollLeft - scrollSpeed);
      needsScroll = true;
    }
    
    // Scroll vertical si el cursor se acerca al borde inferior
    if (relativeY > viewportHeight - scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL ABAJO (cursor)');
      scrollTop = Math.min(scrollTop + scrollSpeed, scrollContainer.scrollHeight - viewportHeight);
      needsScroll = true;
    }
    // Scroll vertical si el cursor se acerca al borde superior
    else if (relativeY < scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL ARRIBA (cursor)');
      scrollTop = Math.max(0, scrollTop - scrollSpeed);
      needsScroll = true;
    }
    
    if (!needsScroll) {
      console.log('❌ NO SE ACTIVA SCROLL - Cursor dentro de límites');
    }
    
    // Aplicar scroll si es necesario
    if (needsScroll) {
      console.log('🚀 APLICANDO SCROLL A:', { scrollLeft, scrollTop });
      scrollContainer.scrollTo({
        left: scrollLeft,
        top: scrollTop
      });
    }
    console.log('========================');
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
      name: '',
      col: 'A',
      row: 1,
      x: 0,
      y: 0,
      width: gridSize.cellWidth,
      height: gridSize.cellHeight,
      subAreas: []
    };
    setAreas(prev => [...prev, newArea]);
  };

  // Encontrar la próxima posición disponible para una sub-área
  const findNextAvailablePosition = (parentArea: Area) => {
    const areaCols = Math.ceil(parentArea.width / gridSize.cellWidth);
    const areaRows = Math.ceil(parentArea.height / gridSize.cellHeight);
    
    // Crear un mapa de celdas ocupadas
    const occupiedCells = new Set();
    
    parentArea.subAreas.forEach(subArea => {
      const subCol = Math.floor((subArea.x - parentArea.x) / gridSize.cellWidth);
      const subRow = Math.floor((subArea.y - parentArea.y) / gridSize.cellHeight);
      const subWidth = Math.ceil(subArea.width / gridSize.cellWidth);
      const subHeight = Math.ceil(subArea.height / gridSize.cellHeight);
      
      // Marcar todas las celdas ocupadas por esta sub-área
      for (let r = subRow; r < subRow + subHeight; r++) {
        for (let c = subCol; c < subCol + subWidth; c++) {
          occupiedCells.add(`${r},${c}`);
        }
      }
    });
    
    // Buscar la primera celda disponible
    for (let row = 0; row < areaRows; row++) {
      for (let col = 0; col < areaCols; col++) {
        if (!occupiedCells.has(`${row},${col}`)) {
          return { row, col };
        }
      }
    }
    
    return null; // No hay espacio disponible
  };

  // Añadir sub-área dentro del área seleccionada
  const addSubArea = () => {
    if (!selectedArea) return;
    
    const parentArea = areas.find(a => a.id === selectedArea);
    if (!parentArea) return;
    
    // Encontrar la próxima posición disponible
    const nextPos = findNextAvailablePosition(parentArea);
    if (!nextPos) {
      console.log('El área está completamente llena, no se pueden añadir más sub-áreas');
      return;
    }
    
    // Calcular coordenadas absolutas para la nueva sub-área
    const absoluteX = parentArea.x + (nextPos.col * gridSize.cellWidth);
    const absoluteY = parentArea.y + (nextPos.row * gridSize.cellHeight);
    
    // Obtener coordenadas de grid para la nueva posición
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const gridCol = columns.indexOf(parentArea.col) + nextPos.col;
    const gridRow = parentArea.row + nextPos.row;
    
    const newSubArea: SubArea = {
      id: `subarea-${Date.now()}`,
      parentId: selectedArea,
      name: '',
      col: columns[gridCol] || parentArea.col,
      row: gridRow,
      x: absoluteX,
      y: absoluteY,
      width: gridSize.cellWidth,
      height: gridSize.cellHeight
    };
    
    setAreas(prev => prev.map(area => 
      area.id === selectedArea 
        ? { ...area, subAreas: [...area.subAreas, newSubArea] }
        : area
    ));
  };

  // Eliminar sub-área seleccionada
  const deleteSelectedSubArea = () => {
    if (!selectedSubArea) return;
    
    setAreas(prev => prev.map(area => 
      area.id === selectedSubArea.parentId 
        ? {
            ...area,
            subAreas: area.subAreas.filter(subArea => subArea.id !== selectedSubArea.subAreaId)
          }
        : area
    ));
    
    // Resetear selección de sub-área
    setSelectedSubArea(null);
  };

  // Eliminar área seleccionada (con todas sus sub-áreas)
  const deleteSelectedArea = () => {
    if (!selectedArea) return;
    
    setAreas(prev => prev.filter(area => area.id !== selectedArea));
    
    // Resetear selecciones
    setSelectedArea(null);
    setSelectedSubArea(null);
  };

  // Manejar hover en celdas
  const handleCellHover = (col: string, row: number) => {
    setHoveredCell(`${col}${row}`);
  };

  // Deseleccionar elementos al hacer click en el canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Debug: mostrar información del target
    console.log('Click en canvas - Target:', target);
    console.log('Target classes:', target.className);
    console.log('Target closest área:', target.closest('.border-blue-600'));
    console.log('Target closest sub-área:', target.closest('.border-red-600'));
    
    // Verificar si el click fue en el canvas o en una celda del grid
    const isCanvasClick = target === e.currentTarget || target.classList.contains('border-gray-200');
    
    // Solo deseleccionar si no se hizo click en un área o sub-área
    if (isCanvasClick && !target.closest('.border-blue-600') && !target.closest('.border-red-600')) {
      console.log('Deseleccionando todo');
      setSelectedArea(null);
      setSelectedSubArea(null);
      // Cancelar edición si está activa
      setEditingArea(null);
      setEditingSubArea(null);
      setTempName('');
    } else {
      console.log('No se deselecciona - click en área/sub-área');
    }
  };

  // Manejar doble click en área para editar nombre
  const handleAreaDoubleClick = (e: React.MouseEvent, areaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    
    setEditingArea(areaId);
    setTempName(area.name || '');
  };

  // Manejar doble click en sub-área para editar nombre
  const handleSubAreaDoubleClick = (e: React.MouseEvent, subAreaId: string, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const parentArea = areas.find(a => a.id === parentId);
    if (!parentArea) return;
    
    const subArea = parentArea.subAreas.find(sa => sa.id === subAreaId);
    if (!subArea) return;
    
    setEditingSubArea({ parentId, subAreaId });
    setTempName(subArea.name || '');
  };

  // Guardar nombre editado
  const handleNameSave = () => {
    if (editingArea) {
      setAreas(prev => prev.map(area =>
        area.id === editingArea
          ? { ...area, name: tempName.trim() }
          : area
      ));
      setEditingArea(null);
    } else if (editingSubArea) {
      setAreas(prev => prev.map(area =>
        area.id === editingSubArea.parentId
          ? {
              ...area,
              subAreas: area.subAreas.map(subArea =>
                subArea.id === editingSubArea.subAreaId
                  ? { ...subArea, name: tempName.trim() }
                  : subArea
              )
            }
          : area
      ));
      setEditingSubArea(null);
    }
    setTempName('');
  };

  // Cancelar edición
  const handleNameCancel = () => {
    setEditingArea(null);
    setEditingSubArea(null);
    setTempName('');
  };

  // Manejar cambio en el input
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempName(e.target.value);
  };

  // Manejar tecla Enter para guardar
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  // Función para obtener el diseño actual del canvas
  const getCurrentCanvasDesign = () => {
    return {
      areas: areas.map(area => ({
        id: area.id,
        name: area.name,
        col: area.col,
        row: area.row,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        subAreas: area.subAreas.map(subArea => ({
          id: subArea.id,
          name: subArea.name,
          col: subArea.col,
          row: subArea.row,
          x: subArea.x,
          y: subArea.y,
          width: subArea.width,
          height: subArea.height,
          areaId: area.id
        }))
      })),
      gridBounds: { ...gridBounds },
      gridSize: { ...gridSize }
    };
  };

  // Función para cargar un diseño
  const loadDesign = (design: MapDesign) => {
    // Convertir AreaData[] a Area[]
    const convertedAreas = design.areas.map(area => ({
      id: area.id,
      name: area.name,
      col: area.col,
      row: area.row,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      subAreas: area.subAreas.map(subArea => ({
        id: subArea.id,
        parentId: subArea.areaId, // Usar areaId como parentId
        name: subArea.name,
        col: subArea.col,
        row: subArea.row,
        x: subArea.x,
        y: subArea.y,
        width: subArea.width,
        height: subArea.height
      }))
    }));
    
    setAreas(convertedAreas);
    setGridBounds(design.gridBounds);
    // El gridSize se mantiene constante, pero podríamos actualizarlo si es necesario
  };

  // Iniciar drag de área
  const handleAreaMouseDown = (e: React.MouseEvent, areaId: string) => {
    e.preventDefault();
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    // Seleccionar área para poder añadir sub-áreas
    setSelectedArea(areaId);

    setIsDragging(true);
    setDraggedArea(areaId);
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0, 
      scrollTop: scrollContainerRef.current?.scrollTop || 0 
    });
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
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0, 
      scrollTop: scrollContainerRef.current?.scrollTop || 0 
    });
    setAreaStart({ x: area.x, y: area.y, width: area.width, height: area.height });
  };

  // Manejar click en sub-área
  const handleSubAreaMouseDown = (e: React.MouseEvent, subAreaId: string, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const parentArea = areas.find(a => a.id === parentId);
    const subArea = parentArea?.subAreas.find(sa => sa.id === subAreaId);
    if (!parentArea || !subArea) return;

    // Seleccionar sub-área
    setSelectedSubArea({ subAreaId, parentId });
    setSelectedArea(parentId); // También seleccionar el área padre

    // Iniciar dragging de sub-área
    setIsDraggingSubArea(true);
    setDraggedSubArea(subAreaId);
    setDraggedSubAreaParent(parentId);
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0, 
      scrollTop: scrollContainerRef.current?.scrollTop || 0 
    });
    setAreaStart({ x: subArea.x, y: subArea.y, width: subArea.width, height: subArea.height });
  };

  // Iniciar redimensionamiento de sub-área
  const handleSubAreaResizeMouseDown = (e: React.MouseEvent, subAreaId: string, parentId: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const parentArea = areas.find(a => a.id === parentId);
    const subArea = parentArea?.subAreas.find(sa => sa.id === subAreaId);
    if (!parentArea || !subArea) return;

    setSelectedSubArea({ subAreaId, parentId });
    setIsResizingSubArea(true);
    setDraggedSubArea(subAreaId);
    setDraggedSubAreaParent(parentId);
    setResizeHandle(handle);
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0, 
      scrollTop: scrollContainerRef.current?.scrollTop || 0 
    });
    setAreaStart({ x: subArea.x, y: subArea.y, width: subArea.width, height: subArea.height });
  };

  // Manejar movimiento del mouse
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && draggedArea) {
      // NOTA: Variables de scroll eliminadas para optimizar rendimiento
      // El scroll automático maneja la visibilidad del área
      
      const dragDeltaX = e.clientX - dragStart.x;
      const dragDeltaY = e.clientY - dragStart.y;
      
      let newX = areaStart.x + dragDeltaX;
      let newY = areaStart.y + dragDeltaY;
      
      // MOVIMIENTO SUAVE: Sin snap-to-grid durante el arrastre
      // El snap-to-grid se aplicará solo al soltar el área
      
      // RESTRICCIÓN: No permitir movimiento fuera del canvas (límites en píxeles)
      const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
      const maxColIndex = columns.length - 1;
      const maxRowIndex = gridBounds.endRow - gridBounds.startRow;
      
      // Obtener el área actual para verificar su tamaño
      const currentArea = areas.find(a => a.id === draggedArea);
      const areaWidthInCols = Math.ceil(currentArea!.width / gridSize.cellWidth);
      const areaHeightInRows = Math.ceil(currentArea!.height / gridSize.cellHeight);
      
      // Límites en píxeles para movimiento suave
      const minPixelX = 0;
      const maxPixelX = (maxColIndex - areaWidthInCols + 1) * gridSize.cellWidth;
      const minPixelY = 0;
      const maxPixelY = (maxRowIndex - areaHeightInRows + 1) * gridSize.cellHeight;
      
      // Aplicar límites sin snap-to-grid
      newX = Math.max(minPixelX, Math.min(newX, maxPixelX));
      newY = Math.max(minPixelY, Math.min(newY, maxPixelY));
      
      const coords = getCellCoordinates(newX, newY);
      const originalArea = areas.find(a => a.id === draggedArea)!;
      const moveDeltaX = newX - originalArea.x;
      const moveDeltaY = newY - originalArea.y;
      
      // Actualizar el área principal
      const updatedArea = { ...originalArea, x: newX, y: newY, col: coords.col, row: coords.row };
      
      // Actualizar también todas las sub-áreas para que se muevan con el área padre
      // Mantener posición relativa constante dentro del área padre
      const updatedSubAreas = originalArea.subAreas.map(subArea => ({
        ...subArea,
        x: subArea.x + moveDeltaX,
        y: subArea.y + moveDeltaY,
        col: columns[columns.indexOf(subArea.col) + (columns.indexOf(coords.col) - columns.indexOf(originalArea.col))] || subArea.col,
        row: subArea.row + (coords.row - originalArea.row)
      }));
      
      setAreas(prev => prev.map(area => 
        area.id === draggedArea 
          ? { ...updatedArea, subAreas: updatedSubAreas }
          : area
      ));
      
      // Scroll automático si el cursor se acerca a los bordes del contenedor
      autoScrollIfNeeded(e.clientX, e.clientY);
      
      // Verificar si necesita expansión del canvas (solo si el área cambió significativamente)
      if (Math.abs(moveDeltaX) > gridSize.cellWidth || Math.abs(moveDeltaY) > gridSize.cellHeight) {
        checkAndExpandCanvas(updatedArea);
      }
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
      
      // REDIMENSIONAMIENTO SUAVE: Sin snap-to-grid durante el proceso
      // El snap-to-grid se aplicará solo al soltar el área
      if (newWidth >= gridSize.cellWidth && newHeight >= gridSize.cellHeight) {
        // Usar valores bloqueados pero sin snap-to-grid durante el redimensionamiento
        const finalStartCol = lockedStartCol;
        const finalStartRow = lockedStartRow;
        const finalEndCol = lockedEndCol;
        const finalEndRow = lockedEndRow;
        
        // Calcular valores en píxeles sin snap-to-grid para movimiento suave
        const pixelStart = gridToPixels(finalStartCol, finalStartRow);
        const pixelEnd = gridToPixels(finalEndCol, finalEndRow);
        
        newX = pixelStart.x;
        newY = pixelStart.y;
        newWidth = pixelEnd.x - pixelStart.x;
        newHeight = pixelEnd.y - pixelStart.y;
        
        // NOTA: Durante el redimensionamiento NO compensamos el scroll
        // Solo se cambia el tamaño, la posición se mantiene fija
        
        console.log('Valores finales aplicados:');
        console.log('  newX:', newX, 'newY:', newY);
        console.log('  newWidth:', newWidth, 'newHeight:', newHeight);
        console.log('  pixelStart:', pixelStart, 'pixelEnd:', pixelEnd);
        
        const resizeCoords = getCellCoordinates(newX, newY);
        const updatedArea = { ...areas.find(a => a.id === draggedArea)!, x: newX, y: newY, width: newWidth, height: newHeight, col: resizeCoords.col, row: resizeCoords.row };
        
        setAreas(prev => prev.map(area => 
          area.id === draggedArea 
            ? updatedArea
            : area
        ));
        
        // Scroll automático durante redimensionamiento para mantener el área visible
        console.log('🔄 LLAMANDO AUTO-SCROLL DURING RESIZE - Cursor:', e.clientX, e.clientY);
        autoScrollIfNeeded(e.clientX, e.clientY);
        
        // Verificar si necesita expansión del canvas (siempre durante redimensionamiento)
        console.log('=== ANTES DE checkAndExpandCanvas (RESIZE) ===');
        console.log('updatedArea que se pasa:', updatedArea);
        console.log('updatedArea.width:', updatedArea.width, 'updatedArea.height:', updatedArea.height);
        console.log('updatedArea.x:', updatedArea.x, 'updatedArea.y:', updatedArea.y);
        console.log('¿Estamos en redimensionamiento?', isResizing);
        console.log('¿Hay draggedArea?', draggedArea);
        console.log('¿Hay resizeHandle?', resizeHandle);
        
        // Durante redimensionamiento, siempre verificar expansión
        checkAndExpandCanvas(updatedArea);
      }
    }
    
    // Lógica para sub-áreas
    if (isDraggingSubArea && draggedSubArea && draggedSubAreaParent) {
      const dragDeltaX = e.clientX - dragStart.x;
      const dragDeltaY = e.clientY - dragStart.y;
      
      let newX = areaStart.x + dragDeltaX;
      let newY = areaStart.y + dragDeltaY;
      
      // Obtener el área padre para verificar límites
      const parentArea = areas.find(a => a.id === draggedSubAreaParent);
      if (!parentArea) return;
      
      // Snap-to-grid
      const { col, row } = pixelsToGrid(newX, newY);
      const snappedX = gridToPixels(col, row).x;
      const snappedY = gridToPixels(col, row).y;
      
      // RESTRICCIÓN: La sub-área no puede salir del área padre
      const parentLeft = parentArea.x;
      const parentTop = parentArea.y;
      const parentRight = parentArea.x + parentArea.width;
      const parentBottom = parentArea.y + parentArea.height;
      
      const subAreaWidth = areaStart.width;
      const subAreaHeight = areaStart.height;
      
      // Limitar movimiento dentro del área padre
      const constrainedX = Math.max(parentLeft, Math.min(snappedX, parentRight - subAreaWidth));
      const constrainedY = Math.max(parentTop, Math.min(snappedY, parentBottom - subAreaHeight));
      
      // Actualizar coordenadas de grid para la nueva posición
      const coords = getCellCoordinates(constrainedX, constrainedY);
      
      // Actualizar la sub-área
      setAreas(prev => prev.map(area => 
        area.id === draggedSubAreaParent 
          ? {
              ...area,
              subAreas: area.subAreas.map(subArea => 
                subArea.id === draggedSubArea 
                  ? { ...subArea, x: constrainedX, y: constrainedY, col: coords.col, row: coords.row }
                  : subArea
              )
            }
          : area
      ));
    }
    
    if (isResizingSubArea && draggedSubArea && draggedSubAreaParent && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newX = areaStart.x;
      let newY = areaStart.y;
      let newWidth = areaStart.width;
      let newHeight = areaStart.height;
      
      // Obtener el área padre para verificar límites
      const parentArea = areas.find(a => a.id === draggedSubAreaParent);
      if (!parentArea) return;
      
      console.log('=== REDIMENSIONAMIENTO SUB-ÁREA ===');
      console.log('Handle:', resizeHandle);
      console.log('Delta X/Y:', deltaX, deltaY);
      console.log('Posición inicial:', { x: areaStart.x, y: areaStart.y, width: areaStart.width, height: areaStart.height });
      
      switch (resizeHandle) {
        case 'nw':
          newX = areaStart.x + deltaX;
          newY = areaStart.y + deltaY;
          newWidth = areaStart.width - deltaX;
          newHeight = areaStart.height - deltaY;
          break;
        case 'ne':
          newY = areaStart.y + deltaY;
          newWidth = areaStart.width + deltaX;
          newHeight = areaStart.height - deltaY;
          break;
        case 'sw':
          newX = areaStart.x + deltaX;
          newWidth = areaStart.width - deltaX;
          newHeight = areaStart.height + deltaY;
          break;
        case 'se':
          newWidth = areaStart.width + deltaX;
          newHeight = areaStart.height + deltaY;
          break;
      }
      
      console.log('Posición después de cálculo:', { newX, newY, newWidth, newHeight });
      
      // Asegurar dimensiones mínimas
      newWidth = Math.max(gridSize.cellWidth, newWidth);
      newHeight = Math.max(gridSize.cellHeight, newHeight);
      
      // RESTRICCIÓN: La sub-área no puede salir del área padre
      const parentLeft = parentArea.x;
      const parentTop = parentArea.y;
      const parentRight = parentArea.x + parentArea.width;
      const parentBottom = parentArea.y + parentArea.height;
      
      console.log('Límites del área padre:', { parentLeft, parentTop, parentRight, parentBottom });
      
      // Ajustar para que no salga del área padre
      newX = Math.max(parentLeft, Math.min(newX, parentRight - newWidth));
      newY = Math.max(parentTop, Math.min(newY, parentBottom - newHeight));
      newWidth = Math.min(newWidth, parentRight - newX);
      newHeight = Math.min(newHeight, parentBottom - newY);
      
      console.log('Posición después de restricciones:', { newX, newY, newWidth, newHeight });
      
      // Snap-to-grid mejorado para sub-áreas
      const { col: startGridCol, row: startGridRow } = pixelsToGrid(newX, newY);
      const { col: endGridCol, row: endGridRow } = pixelsToGrid(newX + newWidth, newY + newHeight);
      
      console.log('Grid coords - Start:', { col: startGridCol, row: startGridRow }, 'End:', { col: endGridCol, row: endGridRow });
      
      const snappedStart = gridToPixels(startGridCol, startGridRow);
      const snappedEnd = gridToPixels(endGridCol, endGridRow);
      
      console.log('Snapped positions - Start:', snappedStart, 'End:', snappedEnd);
      
      newX = snappedStart.x;
      newY = snappedStart.y;
      newWidth = snappedEnd.x - snappedStart.x;
      newHeight = snappedEnd.y - snappedStart.y;
      
      console.log('Posición final después de snap:', { newX, newY, newWidth, newHeight });
      
      // Calcular coordenadas alfanuméricas correctas
      const finalCoords = getCellCoordinates(newX, newY);
      console.log('Coordenadas alfanuméricas finales:', finalCoords);
      
      // Actualizar la sub-área
      setAreas(prev => prev.map(area => 
        area.id === draggedSubAreaParent 
          ? {
              ...area,
              subAreas: area.subAreas.map(subArea => 
                subArea.id === draggedSubArea 
                  ? { ...subArea, x: newX, y: newY, width: newWidth, height: newHeight, col: finalCoords.col, row: finalCoords.row }
                  : subArea
              )
            }
          : area
      ));
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
    console.log('DEBUG VERTICAL - areaEndRowIndex:', areaEndRowIndex, 'canvasHeight - 1:', canvasHeight - 1);
    console.log('DEBUG VERTICAL - gridBounds.endRow:', gridBounds.endRow, 'MAX_BOUNDS.endRow:', MAX_BOUNDS.endRow);
    console.log('DEBUG VERTICAL - Condición 1 (areaEndRowIndex >= canvasHeight - 1):', areaEndRowIndex >= canvasHeight - 1);
    console.log('DEBUG VERTICAL - Condición 2 (gridBounds.endRow < MAX_BOUNDS.endRow):', gridBounds.endRow < MAX_BOUNDS.endRow);
    
    if (areaEndRowIndex >= canvasHeight - 1 && gridBounds.endRow < MAX_BOUNDS.endRow) {
      console.log('✅ ACTIVANDO EXPANSIÓN VERTICAL');
      needsVerticalExpansion = true;
      // Expandir al siguiente bloque completo de 26 filas
      const currentEndRow = gridBounds.endRow;
      const nextBlockStart = Math.floor((currentEndRow - 1) / 26) * 26 + 27;
      const maxEndRow = MAX_BOUNDS.endRow;
      
      newEndRow = Math.min(nextBlockStart + 25, maxEndRow);
      console.log('currentEndRow:', currentEndRow, 'nextBlockStart:', nextBlockStart, 'newEndRow:', newEndRow);
    } else {
      console.log('❌ NO SE ACTIVA EXPANSIÓN VERTICAL');
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
    // Aplicar snap-to-grid al soltar el área
    if (draggedArea && areas.length > 0) {
      const currentArea = areas.find(a => a.id === draggedArea);
      if (currentArea) {
        // Aplicar snap-to-grid solo a la posición, mantener tamaño original
        const { col: snappedCol, row: snappedRow } = pixelsToGrid(currentArea.x, currentArea.y);
        const snappedPosition = gridToPixels(snappedCol, snappedRow);
        
        // Mantener el tamaño original del área (no cambiar durante movimiento)
        const originalWidth = currentArea.width;
        const originalHeight = currentArea.height;
        
        // Actualizar área con snap-to-grid solo en posición
        const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
        const snappedColLetter = columns[snappedCol] || 'A';
        
        // Aplicar snap-to-grid también a las sub-áreas
        const updatedSubAreas = currentArea.subAreas.map(subArea => {
          const { col: subCol, row: subRow } = pixelsToGrid(subArea.x, subArea.y);
          const snappedSubPosition = gridToPixels(subCol, subRow);
          
          // Calcular nueva letra de columna para la sub-área
          const currentSubColIndex = columns.indexOf(subArea.col);
          const newSubColIndex = currentSubColIndex + (snappedCol - columns.indexOf(currentArea.col));
          const newSubColLetter = columns[newSubColIndex] || subArea.col;
          
          return {
            ...subArea,
            x: snappedSubPosition.x,
            y: snappedSubPosition.y,
            col: newSubColLetter,
            row: subRow + (snappedRow - currentArea.row)
          };
        });
        
        setAreas(prev => prev.map(area => 
          area.id === draggedArea 
            ? { ...area, x: snappedPosition.x, y: snappedPosition.y, width: originalWidth, height: originalHeight, col: snappedColLetter, row: snappedRow, subAreas: updatedSubAreas }
            : area
        ));
      }
    }
    
    setIsDragging(false);
    setIsResizing(false);
    setDraggedArea(null);
    setResizeHandle(null);
    
    // Resetear estados de sub-áreas
    setIsDraggingSubArea(false);
    setIsResizingSubArea(false);
    setDraggedSubArea(null);
    setDraggedSubAreaParent(null);
  };

  const canvasSize = calculateCanvasSize();
  const gridCells = generateGridCells();

  // Añadir event listeners globales
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    
    if (isDragging || isResizing || isDraggingSubArea || isResizingSubArea) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, isDraggingSubArea, isResizingSubArea, handleMouseMove, handleMouseUp]);

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
              onClick={addSubArea}
              disabled={!selectedArea}
              className={`px-4 py-2 rounded transition-colors ${
                selectedArea 
                  ? 'bg-orange-500 text-white hover:bg-orange-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Añadir Sub-área
            </button>
            <button
              onClick={deleteSelectedSubArea}
              disabled={!selectedSubArea}
              className={`px-4 py-2 rounded transition-colors ${
                selectedSubArea 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title="Eliminar sub-área seleccionada"
            >
              Eliminar Sub-área
            </button>
            <button
              onClick={deleteSelectedArea}
              disabled={!selectedArea}
              className={`px-4 py-2 rounded transition-colors ${
                selectedArea 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title="Eliminar área seleccionada y todas sus sub-áreas"
            >
              Eliminar Área
            </button>
                        <div className="border-l border-gray-300 h-8 mx-2"></div>
            <button
              onClick={() => setShowDesignsManager(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Gestión de Diseños
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="bg-white rounded-lg shadow-md p-4 overflow-auto" style={{ height: '80vh', minHeight: '600px' }}>
          <div 
            ref={canvasRef}
            className="relative border border-gray-300"
            style={{ 
              width: `${canvasSize.width}px`, 
              height: `${canvasSize.height}px`,
              minWidth: '800px',
              minHeight: '600px'
            }}
            onClick={handleCanvasClick}
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
                className={`absolute border-2 cursor-move hover:bg-opacity-40 transition-colors ${
                  selectedArea === area.id 
                    ? 'bg-blue-500 bg-opacity-50 border-blue-700' 
                    : 'bg-blue-500 bg-opacity-30 border-blue-600'
                }`}
                style={{
                  left: `${area.x}px`,
                  top: `${area.y}px`,
                  width: `${area.width}px`,
                  height: `${area.height}px`
                }}
                onMouseDown={(e) => handleAreaMouseDown(e, area.id)}
                onDoubleClick={(e) => handleAreaDoubleClick(e, area.id)}
              >
                {/* Nombre del área o input de edición */}
                {editingArea === area.id ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-90">
                    <input
                      type="text"
                      value={tempName}
                      onChange={handleNameChange}
                      onKeyDown={handleKeyDown}
                      onBlur={handleNameSave}
                      className="px-2 py-1 text-sm bg-white border border-blue-700 rounded"
                      placeholder="Nombre del área"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-medium text-sm drop-shadow-md">
                      {area.name || `${area.col}${area.row}`}
                    </span>
                  </div>
                )}

                {/* Renderizar sub-áreas */}
                {area.subAreas.map((subArea) => (
                  <div
                    key={subArea.id}
                    className={`absolute border cursor-move hover:bg-opacity-60 transition-colors box-border ${
                      selectedSubArea?.subAreaId === subArea.id 
                        ? 'bg-red-600 bg-opacity-60 border-red-800' 
                        : 'bg-red-500 bg-opacity-40 border-red-600'
                    }`}
                    style={{
                      left: `${subArea.x - area.x - 1}px`,
                      top: `${subArea.y - area.y - 1}px`,
                      width: `${subArea.width - 2}px`,
                      height: `${subArea.height - 2}px`,
                      boxSizing: 'border-box'
                    }}
                    onMouseDown={(e) => handleSubAreaMouseDown(e, subArea.id, area.id)}
                    onDoubleClick={(e) => handleSubAreaDoubleClick(e, subArea.id, area.id)}
                  >
                    {/* Nombre de sub-área o input de edición */}
                    {editingSubArea?.subAreaId === subArea.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-90">
                        <input
                          type="text"
                          value={tempName}
                          onChange={handleNameChange}
                          onKeyDown={handleKeyDown}
                          onBlur={handleNameSave}
                          className="px-2 py-1 text-xs bg-white border border-red-700 rounded"
                          placeholder="Nombre de sub-área"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white font-medium text-xs drop-shadow-md">
                          {subArea.name || `${subArea.col}${subArea.row}`}
                        </span>
                      </div>
                    )}
                    
                    {/* Handles de redimensionamiento para sub-área seleccionada */}
                    {selectedSubArea?.subAreaId === subArea.id && (
                      <>
                        <div 
                          className="absolute w-3 h-3 bg-red-800 border border-white -top-1.5 -left-1.5 cursor-nw-resize z-10 hover:bg-red-600"
                          title="Redimensionar esquina superior izquierda"
                          onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'nw')}
                        />
                        <div 
                          className="absolute w-3 h-3 bg-red-800 border border-white -top-1.5 -right-1.5 cursor-ne-resize z-10 hover:bg-red-600"
                          title="Redimensionar esquina superior derecha"
                          onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'ne')}
                        />
                        <div 
                          className="absolute w-3 h-3 bg-red-800 border border-white -bottom-1.5 -left-1.5 cursor-sw-resize z-10 hover:bg-red-600"
                          title="Redimensionar esquina inferior izquierda"
                          onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'sw')}
                        />
                        <div 
                          className="absolute w-3 h-3 bg-red-800 border border-white -bottom-1.5 -right-1.5 cursor-se-resize z-10 hover:bg-red-600"
                          title="Redimensionar esquina inferior derecha"
                          onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'se')}
                        />
                      </>
                    )}
                  </div>
                ))}
                
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
            <li>• Seleccionar área: Click sobre un área para seleccionarla (se vuelve más opaca)</li>
            <li>• Sub-áreas: Click en "Añadir Sub-área" después de seleccionar un área</li>
            <li>• Sub-áreas aparecen en rojo dentro del área padre seleccionada</li>
            <li>• Sub-áreas se añaden automáticamente en la primera celda disponible</li>
            <li>• Se pueden añadir sub-áreas hasta llenar completamente el área</li>
            <li>• Al mover un área, todas sus sub-áreas se mueven con ella</li>
            <li>• **NUEVO**: Click directo en sub-áreas para seleccionarlas (se vuelven más opacas)</li>
            <li>• **NUEVO**: Arrastrar sub-áreas seleccionadas dentro de su área padre</li>
            <li>• **NUEVO**: Redimensionar sub-áreas desde sus esquinas (solo cuando están seleccionadas)</li>
            <li>• **NUEVO**: Las sub-áreas NUNCA pueden salir de los límites de su área padre</li>
            <li>• **NUEVO**: Botón "Eliminar Sub-área" para eliminar la sub-área seleccionada</li>
            <li>• **NUEVO**: Botón "Eliminar Área" para eliminar área seleccionada con todas sus sub-áreas</li>
            <li>• Cursor mano al hover sobre áreas y sub-áreas</li>
            <li>• Cursor redimensionamiento en esquinas de áreas y sub-áreas seleccionadas</li>
          </ul>
        </div>
      </div>
      
      {/* Gestor de Diseños */}
      {showDesignsManager && (
        <MapDesignsManager
          onLoadDesign={loadDesign}
          onClose={() => setShowDesignsManager(false)}
          getCurrentCanvasDesign={getCurrentCanvasDesign}
        />
      )}
    </div>
  );
};

export default CanvasGridTest;
