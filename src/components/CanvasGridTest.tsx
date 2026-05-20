import React, { useState, useRef, useEffect } from 'react';
import { MapDesignsManager } from './MapDesignsManager';
import { type MapDesign } from '../services/mapDesignsService';
import { Zap, Layers, Plus, X } from 'lucide-react';
import { getZonasWithSubzonas } from '../firebase';

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
  
  // Estado para zonas y subzonas desde Firebase
  const [zonesHierarchy, setZonesHierarchy] = useState<{
    id: string;
    nombre: string;
    tipo: "produccion" | "almacenamiento" | "expedicion";
    descripcion?: string;
    capacidadMaxima: number | null;
    fechaCreacion: any;
    activa: boolean;
    subzonas: {
      id: string;
      nombre: string;
      zonaId: string;
      posiciones: string[];
      capacidadMaxima: number | null;
      color?: string;
      activa: boolean;
      fechaCreacion: any;
    }[];
  }[]>([]);

  // Estado para zona y subzona seleccionadas
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedSubzone, setSelectedSubzone] = useState<string>('');

  // Cargar zonas desde Firebase al iniciar el componente
  useEffect(() => {
    const loadZones = async () => {
      try {
        const hierarchy = await getZonasWithSubzonas();
        console.log('📥 Zonas cargadas desde Firebase:', hierarchy);
        setZonesHierarchy(hierarchy);
      } catch (error) {
        console.error('❌ Error cargando zonas:', error);
      }
    };
    
    loadZones();
  }, []);
  
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

  // Función para scroll automático y expansión cuando el cursor se acerca a los bordes
  const autoScrollIfNeeded = (mouseX: number, mouseY: number) => {
    const scrollContainer = scrollContainerRef.current;
    const canvas = canvasRef.current;
    if (!scrollContainer || !canvas) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const viewportWidth = containerRect.width;
    const viewportHeight = containerRect.height;
    
    // Margen para activar el scroll/expansión (en píxeles)
    const scrollMargin = 50;
    const scrollSpeed = 10; // píxeles por frame
    
    // Calcular posición del cursor relativa al contenedor
    const relativeX = mouseX - containerRect.left;
    const relativeY = mouseY - containerRect.top;
    
    // Calcular posición del cursor relativa al canvas
    const canvasRelativeX = mouseX - canvasRect.left;
    const canvasRelativeY = mouseY - canvasRect.top;
    
    let scrollLeft = scrollContainer.scrollLeft;
    let scrollTop = scrollContainer.scrollTop;
    let needsScroll = false;
    let needsExpansion = false;
    
    // DEBUG: Mostrar valores para depuración
    console.log('=== DEBUG SCROLL/EXPANSIÓN AUTOMÁTICA ===');
    console.log('Cursor:', { mouseX, mouseY });
    console.log('Canvas:', { width: canvasRect.width, height: canvasRect.height });
    console.log('Posición relativa canvas:', { canvasRelativeX, canvasRelativeY });
    console.log('Scroll actual:', { scrollLeft, scrollTop });
    
    // Verificar si el cursor se acerca al borde del canvas para activar expansión
    const expansionMargin = 100; // Mayor margen para expansión
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const canvasWidth = columns.length * gridSize.cellWidth;
    const canvasHeight = (gridBounds.endRow - gridBounds.startRow + 1) * gridSize.cellHeight;
    
    // Expansión horizontal si el cursor se acerca al borde derecho del canvas
    if (canvasRelativeX > canvasWidth - expansionMargin && gridBounds.endCol < MAX_BOUNDS.endCol) {
      console.log('✅ ACTIVANDO EXPANSIÓN HORIZONTAL (cursor cerca borde derecho)');
      needsExpansion = true;
    }
    // Expansión vertical si el cursor se acerca al borde inferior del canvas
    if (canvasRelativeY > canvasHeight - expansionMargin && gridBounds.endRow < MAX_BOUNDS.endRow) {
      console.log('✅ ACTIVANDO EXPANSIÓN VERTICAL (cursor cerca borde inferior)');
      needsExpansion = true;
    }
    
    // Scroll horizontal si el cursor se acerca al borde derecho del viewport
    if (relativeX > viewportWidth - scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL DERECHA (cursor)');
      scrollLeft = Math.min(scrollLeft + scrollSpeed, scrollContainer.scrollWidth - viewportWidth);
      needsScroll = true;
    }
    // Scroll horizontal si el cursor se acerca al borde izquierdo del viewport
    else if (relativeX < scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL IZQUIERDA (cursor)');
      scrollLeft = Math.max(0, scrollLeft - scrollSpeed);
      needsScroll = true;
    }
    
    // Scroll vertical si el cursor se acerca al borde inferior del viewport
    if (relativeY > viewportHeight - scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL ABAJO (cursor)');
      scrollTop = Math.min(scrollTop + scrollSpeed, scrollContainer.scrollHeight - viewportHeight);
      needsScroll = true;
    }
    // Scroll vertical si el cursor se acerca al borde superior del viewport
    else if (relativeY < scrollMargin) {
      console.log('✅ ACTIVANDO SCROLL ARRIBA (cursor)');
      scrollTop = Math.max(0, scrollTop - scrollSpeed);
      needsScroll = true;
    }
    
    // Aplicar expansión si es necesario
    if (needsExpansion) {
      console.log('🚀 APLICANDO EXPANSIÓN POR PROXIMIDAD DE CURSOR');
      expandCanvasNearCursor(canvasRelativeX, canvasRelativeY);
    }
    
    // Aplicar scroll si es necesario
    if (needsScroll) {
      console.log('🚀 APLICANDO SCROLL A:', { scrollLeft, scrollTop });
      scrollContainer.scrollTo({
        left: scrollLeft,
        top: scrollTop
      });
    }
    
    if (!needsScroll && !needsExpansion) {
      console.log('❌ NO SE ACTIVA SCROLL/EXPANSIÓN - Cursor dentro de límites');
    }
    console.log('========================');
  };

  // Función para expandir canvas basado en la posición del cursor
  const expandCanvasNearCursor = (cursorX: number, cursorY: number) => {
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const maxColumns = generateColumnLetters(MAX_BOUNDS.startCol, MAX_BOUNDS.endCol);
    const currentEndIndex = columns.indexOf(gridBounds.endCol);
    const maxEndIndex = maxColumns.indexOf(MAX_BOUNDS.endCol);
    
    let newEndCol = gridBounds.endCol;
    let newEndRow = gridBounds.endRow;
    let needsHorizontalExpansion = false;
    let needsVerticalExpansion = false;
    
    // Calcular dimensiones actuales del canvas
    const canvasWidth = columns.length * gridSize.cellWidth;
    const canvasHeight = (gridBounds.endRow - gridBounds.startRow + 1) * gridSize.cellHeight;
    
    // Margen para activar expansión (en píxeles desde el borde)
    const expansionMargin = 150;
    
    console.log('=== DEBUG EXPANSIÓN POR CURSOR ===');
    console.log('Cursor position:', { cursorX, cursorY });
    console.log('Canvas dimensions:', { canvasWidth, canvasHeight });
    console.log('Grid bounds:', { startCol: gridBounds.startCol, endCol: gridBounds.endCol, startRow: gridBounds.startRow, endRow: gridBounds.endRow });
    
    // Expansión horizontal - si el cursor se acerca al borde derecho del canvas
    const horizontalThreshold = canvasWidth - expansionMargin;
    if (cursorX > horizontalThreshold && currentEndIndex < maxEndIndex) {
      console.log('✅ CURSOR CERCA BORDE DERECHO - cursorX:', cursorX, 'threshold:', horizontalThreshold);
      
      const currentBlockIndex = Math.floor(currentEndIndex / 26);
      const nextBlockIndex = currentBlockIndex + 1;
      const maxBlockIndex = Math.floor((maxColumns.length - 1) / 26);
      
      console.log('Block indices - current:', currentBlockIndex, 'next:', nextBlockIndex, 'max:', maxBlockIndex);
      
      if (nextBlockIndex <= maxBlockIndex) {
        const newEndIndex = Math.min((nextBlockIndex + 1) * 26 - 1, maxColumns.length - 1);
        newEndCol = maxColumns[newEndIndex];
        needsHorizontalExpansion = true;
        console.log('📈 EXPANSIÓN HORIZONTAL A:', newEndCol, 'índice:', newEndIndex);
      } else {
        console.log('❌ NO SE PUEDE EXPANDIR HORIZONTALMENTE - límite de bloques alcanzado');
      }
    } else {
      console.log('❌ NO SE ACTIVA EXPANSIÓN HORIZONTAL - cursorX:', cursorX, 'threshold:', horizontalThreshold, 'currentEndIndex:', currentEndIndex, 'maxEndIndex:', maxEndIndex);
    }
    
    // Expansión vertical - si el cursor se acerca al borde inferior del canvas
    const verticalThreshold = canvasHeight - expansionMargin;
    if (cursorY > verticalThreshold && gridBounds.endRow < MAX_BOUNDS.endRow) {
      console.log('✅ CURSOR CERCA BORDE INFERIOR - cursorY:', cursorY, 'threshold:', verticalThreshold);
      
      const currentEndRow = gridBounds.endRow;
      const nextBlockStart = Math.floor((currentEndRow - 1) / 26) * 26 + 27;
      const maxEndRow = MAX_BOUNDS.endRow;
      
      newEndRow = Math.min(nextBlockStart + 25, maxEndRow);
      needsVerticalExpansion = true;
      console.log('📈 EXPANSIÓN VERTICAL A:', newEndRow, 'desde:', currentEndRow);
    } else {
      console.log('❌ NO SE ACTIVA EXPANSIÓN VERTICAL - cursorY:', cursorY, 'threshold:', verticalThreshold, 'endRow:', gridBounds.endRow, 'maxEndRow:', MAX_BOUNDS.endRow);
    }
    
    // Aplicar expansión
    if (needsHorizontalExpansion || needsVerticalExpansion) {
      console.log('🚀 APLICANDO EXPANSIÓN - Horizontal:', needsHorizontalExpansion, 'Vertical:', needsVerticalExpansion);
      console.log('Nuevos bounds:', { endCol: newEndCol, endRow: newEndRow });
      
      setGridBounds(prev => ({
        ...prev,
        endCol: newEndCol,
        endRow: newEndRow
      }));
    } else {
      console.log('📦 SIN EXPANSIÓN APLICAR');
    }
    console.log('==========================');
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
      name: selectedZone ? (zonesHierarchy.find(z => z.id === selectedZone)?.nombre || '') : '', // Nombre de la zona seleccionada
      col: 'A',
      row: 1,
      x: 0,
      y: 0,
      width: gridSize.cellWidth,
      height: gridSize.cellHeight,
      subAreas: [],
      zoneCode: selectedZone // Asignar la zona seleccionada
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
    if (!selectedArea || !selectedSubzone) return;
    
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
      name: selectedSubzone ? (zonesHierarchy.find(z => z.id === selectedZone)?.subzonas.find((s: any) => s.id === selectedSubzone)?.nombre || '') : '', // Nombre de la subzona seleccionada
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
    console.log('Target closest área:', target.closest('.border-brand-600'));
    console.log('Target closest sub-área:', target.closest('.border-red-600'));
    
    // Verificar si el click fue en el canvas o en una celda del grid
    const isCanvasClick = target === e.currentTarget || target.classList.contains('border-gray-200');
    
    // Solo deseleccionar si no se hizo click en un área o sub-área
    if (isCanvasClick && !target.closest('.border-brand-600') && !target.closest('.border-red-600')) {
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

    // Actualizar desplegables de zona y subzona según el área seleccionada
    if (area.zoneCode) {
      setSelectedZone(area.zoneCode);
      
      // Buscar la primera subzona asignada a esta área (si existe)
      const areaSubzone = area.subAreas.length > 0 ? area.subAreas[0] : null;
      if (areaSubzone) {
        // Buscar el subzoneId correspondiente en la jerarquía de zonas
        const zone = zonesHierarchy.find(z => z.id === area.zoneCode);
        if (zone) {
          const matchingSubzone = zone.subzonas.find((s: any) => s.nombre === areaSubzone.name);
          if (matchingSubzone) {
            setSelectedSubzone(matchingSubzone.id);
          }
        }
      } else {
        // Si no hay subzonas, limpiar la selección
        setSelectedSubzone('');
      }
    }

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

    // Actualizar desplegables de zona y subzona según la sub-área seleccionada
    if (parentArea.zoneCode) {
      setSelectedZone(parentArea.zoneCode);
      
      // Buscar el subzoneId correspondiente en la jerarquía de zonas
      const zone = zonesHierarchy.find(z => z.id === parentArea.zoneCode);
      if (zone) {
        const matchingSubzone = zone.subzonas.find((s: any) => s.nombre === subArea.name);
        if (matchingSubzone) {
          setSelectedSubzone(matchingSubzone.id);
        }
      }
    }

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
      
      // Verificar expansión del canvas (siempre durante el movimiento)
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
        
        // Durante redimensionamiento, siempre verificar expansión
        console.log('=== ANTES DE checkAndExpandCanvas (RESIZE) ===');
        console.log('updatedArea que se pasa:', updatedArea);
        console.log('updatedArea.width:', updatedArea.width, 'updatedArea.height:', updatedArea.height);
        console.log('updatedArea.x:', updatedArea.x, 'updatedArea.y:', updatedArea.y);
        console.log('¿Estamos en redimensionamiento?', isResizing);
        console.log('¿Hay draggedArea?', draggedArea);
        console.log('¿Hay resizeHandle?', resizeHandle);
        
        checkAndExpandCanvas(updatedArea);
      }
    }
    
    // Verificar expansión también durante redimensionamiento (fuera de la condición de tamaño)
    if (isResizing && draggedArea) {
      const currentArea = areas.find(a => a.id === draggedArea);
      if (currentArea) {
        checkAndExpandCanvas(currentArea);
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

  // Función para verificar expansión horizontal (independiente)
  const checkHorizontalExpansion = (area: Area) => {
    console.log('=== DEBUG EXPANSIÓN HORIZONTAL INICIO ===');
    console.log('Grid bounds actuales:', gridBounds);
    console.log('MAX_BOUNDS:', MAX_BOUNDS);
    
    const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    console.log('Columnas generadas:', columns);
    console.log('Total columnas:', columns.length);
    
    const currentColIndex = columns.indexOf(area.col);
    console.log('Índice columna actual:', currentColIndex, 'columna:', area.col);
    
    // Calcular límite horizontal del área
    const areaEndColIndex = currentColIndex + Math.ceil(area.width / gridSize.cellWidth) - 1;
    const areaEndColLetter = columns[areaEndColIndex];
    console.log('Índice final área:', areaEndColIndex, 'columna final:', areaEndColLetter);
    console.log('Ancho área:', area.width, 'cellWidth:', gridSize.cellWidth);
    
    // Para comparación correcta de columnas
    const maxColumns = generateColumnLetters(MAX_BOUNDS.startCol, MAX_BOUNDS.endCol);
    console.log('Max columns (A-AZ):', maxColumns.length, 'primeras:', maxColumns.slice(0, 5), 'últimas:', maxColumns.slice(-5));
    
    const currentEndIndex = columns.indexOf(gridBounds.endCol);
    const maxEndIndex = maxColumns.indexOf(MAX_BOUNDS.endCol);
    console.log('Índices - actual end:', currentEndIndex, 'max end:', maxEndIndex);
    
    // Verificar si el área alcanza la última columna disponible
    const lastCurrentColLetter = gridBounds.endCol;
    const reachesLastColumn = areaEndColLetter === lastCurrentColLetter;
    const canExpandHorizontally = currentEndIndex < maxEndIndex;
    
    console.log('Condición - alcanza última columna?', reachesLastColumn);
    console.log('Condición - puede expandir?', canExpandHorizontally);
    console.log('Columna final área:', areaEndColLetter, 'última disponible:', lastCurrentColLetter);
    
    if (reachesLastColumn && canExpandHorizontally) {
      console.log('✅ CONDICIONES CUMPLIDAS - Activando expansión horizontal');
      
      // Expandir al siguiente bloque completo (AA-AZ, BA-BZ, etc.)
      const currentBlockIndex = Math.floor(currentEndIndex / 26);
      const nextBlockIndex = currentBlockIndex + 1;
      const maxBlockIndex = Math.floor((maxColumns.length - 1) / 26);
      
      console.log('Bloques - current:', currentBlockIndex, 'next:', nextBlockIndex, 'max:', maxBlockIndex);
      
      if (nextBlockIndex <= maxBlockIndex) {
        const newEndIndex = Math.min((nextBlockIndex + 1) * 26 - 1, maxColumns.length - 1);
        const newEndCol = maxColumns[newEndIndex];
        console.log('🚀 EXPANSIÓN HORIZONTAL APLICADA - Nueva columna:', newEndCol, 'índice:', newEndIndex);
        
        setGridBounds(prev => {
          console.log('Actualizando gridBounds de:', prev.endCol, 'a:', newEndCol);
          return {
            ...prev,
            endCol: newEndCol
          };
        });
        
        console.log('===============================');
        return true;
      } else {
        console.log('❌ Límite de bloques alcanzado');
      }
    } else {
      console.log('❌ CONDICIONES NO CUMPLIDAS');
      console.log('  - Alcanza última columna:', reachesLastColumn);
      console.log('  - Puede expandir:', canExpandHorizontally);
      console.log('  - Columna final área:', areaEndColLetter, 'última disponible:', lastCurrentColLetter);
    }
    
    console.log('===============================');
    return false;
  };

  // Función para verificar expansión vertical (independiente)
  const checkVerticalExpansion = (area: Area) => {
    //const columns = generateColumnLetters(gridBounds.startCol, gridBounds.endCol);
    const currentRowIndex = area.row - gridBounds.startRow;
    
    // Calcular límite vertical del área
    const areaEndRowIndex = currentRowIndex + Math.ceil(area.height / gridSize.cellHeight) - 1;
    const canvasHeight = gridBounds.endRow - gridBounds.startRow + 1;
    
    console.log('=== DEBUG EXPANSIÓN VERTICAL ===');
    console.log('Área:', area);
    console.log('areaEndRowIndex:', areaEndRowIndex, 'canvasHeight - 1:', canvasHeight - 1);
    console.log('gridBounds.endRow:', gridBounds.endRow, 'MAX_BOUNDS.endRow:', MAX_BOUNDS.endRow);
    console.log('Condición 1 (areaEndRowIndex >= canvasHeight - 1):', areaEndRowIndex >= canvasHeight - 1);
    console.log('Condición 2 (gridBounds.endRow < MAX_BOUNDS.endRow):', gridBounds.endRow < MAX_BOUNDS.endRow);
    
    if (areaEndRowIndex >= canvasHeight - 1 && gridBounds.endRow < MAX_BOUNDS.endRow) {
      console.log('✅ ACTIVANDO EXPANSIÓN VERTICAL');
      
      // Expandir al siguiente bloque completo de 26 filas
      const currentEndRow = gridBounds.endRow;
      const nextBlockStart = Math.floor((currentEndRow - 1) / 26) * 26 + 27;
      const maxEndRow = MAX_BOUNDS.endRow;
      
      const newEndRow = Math.min(nextBlockStart + 25, maxEndRow);
      console.log('🚀 EXPANSIÓN VERTICAL A:', newEndRow, 'desde:', currentEndRow);
      
      setGridBounds(prev => ({
        ...prev,
        endRow: newEndRow
      }));
      
      return true;
    } else {
      console.log('❌ NO SE ACTIVA EXPANSIÓN VERTICAL');
    }
    
    console.log('=============================');
    return false;
  };

  // Función principal que verifica ambas expansiones de forma independiente
  const checkAndExpandCanvas = (area: Area) => {
    console.log('=== VERIFICANDO EXPANSIÓN INDEPENDIENTE ===');
    
    // Verificar expansión horizontal (independiente)
    const horizontalExpanded = checkHorizontalExpansion(area);
    
    // Verificar expansión vertical (independiente)
    const verticalExpanded = checkVerticalExpansion(area);
    
    if (horizontalExpanded || verticalExpanded) {
      console.log('🚀 RESUMEN - Horizontal:', horizontalExpanded, 'Vertical:', verticalExpanded);
    } else {
      console.log('📦 SIN EXPANSIÓN APLICAR');
    }
    console.log('====================================');
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
    <div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white transition-colors duration-300 font-sans">
      
      {/* CABECERA */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0 m-6">
        <h1 className="text-xl font-semibold flex items-center gap-2 italic uppercase tracking-tight text-brand-600">
          <Zap size={24} /> Triniglass <span className="text-slate-400 font-light not-italic text-sm">| Editor de Mapas</span>
        </h1>
        <button
          onClick={() => setShowDesignsManager(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white px-7 py-3.5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Layers size={20} /> Gestión de Diseños
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6">
        
        {/* PANEL DE INFORMACIÓN */}
        <div className="bg-white dark:bg-slate-800/60 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-100 dark:bg-slate-900/40 rounded-2xl p-4">
              <div className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-semibold mb-2 tracking-[0.4em]">RANGO ACTUAL</div>
              <div className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {gridBounds.startCol}{gridBounds.startRow} - {gridBounds.endCol}{gridBounds.endRow}
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900/40 rounded-2xl p-4">
              <div className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-semibold mb-2 tracking-[0.4em]">DIMENSIONES</div>
              <div className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {canvasSize.width}x{canvasSize.height}px
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900/40 rounded-2xl p-4">
              <div className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-semibold mb-2 tracking-[0.4em]">CELDA HOVER</div>
              <div className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {hoveredCell || 'Ninguna'}
              </div>
            </div>
          </div>
          
          {/* SELECTORES DE ZONA Y SUBZONA */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Zona</label>
              <select 
                value={selectedZone}
                onChange={(e) => {
                  const zoneId = e.target.value;
                  setSelectedZone(zoneId);
                  setSelectedSubzone(''); // Resetear subzona al cambiar zona
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Selecciona una zona...</option>
                {zonesHierarchy.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedZone && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Subzona</label>
                <select 
                  value={selectedSubzone}
                  onChange={(e) => setSelectedSubzone(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  <option value="">Selecciona una subzona...</option>
                  {zonesHierarchy
                    .find(z => z.id === selectedZone)
                    ?.subzonas.map((subzone: any) => (
                      <option key={subzone.id} value={subzone.id}>
                        {subzone.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            
            <button
              onClick={addArea}
              disabled={!selectedZone}
              className={`bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                selectedZone 
                  ? 'bg-brand-600 hover:bg-brand-500' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus size={18} /> Añadir Área
            </button>
            <button
              onClick={addSubArea}
              disabled={!selectedArea || !selectedSubzone}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                selectedArea && selectedSubzone
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus size={18} /> Añadir Sub-área
            </button>
            <button
              onClick={deleteSelectedSubArea}
              disabled={!selectedSubArea}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                selectedSubArea 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <X size={18} /> Eliminar Sub-área
            </button>
            <button
              onClick={deleteSelectedArea}
              disabled={!selectedArea}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                selectedArea 
                  ? 'bg-red-600 hover:bg-red-500 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <X size={18} /> Eliminar Área
            </button>
          </div>
        </div>

        {/* CANVAS DEL EDITOR */}
        <div className="bg-white dark:bg-slate-800/60 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 overflow-x-auto shadow-inner relative">
          <div 
            ref={scrollContainerRef} 
            className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-auto" 
            style={{ height: '70vh', minHeight: '500px' }}
          >
            <div 
              ref={canvasRef}
              className="relative"
              style={{ 
                width: `${canvasSize.width}px`, 
                height: `${canvasSize.height}px`,
                minWidth: `${gridSize.cellWidth * 26}px`, // Mínimo para 26 columnas (A-Z)
                minHeight: `${gridSize.cellHeight * 25}px` // Mínimo para 25 filas
              }}
              onClick={handleCanvasClick}
            >
              {gridCells.map((cell) => (
                <div
                  key={`${cell.col}${cell.row}`}
                  className="absolute border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
                  style={{
                    left: `${cell.x}px`,
                    top: `${cell.y}px`,
                    width: `${gridSize.cellWidth}px`,
                    height: `${gridSize.cellHeight}px`
                  }}
                  onMouseEnter={() => handleCellHover(cell.col, cell.row)}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <span className="select-none text-slate-500 dark:text-slate-400 text-[10px] font-mono">
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
                      ? 'bg-brand-500 bg-opacity-50 border-brand-700 dark:border-brand-500' 
                      : 'bg-brand-500 bg-opacity-30 border-brand-600 dark:border-brand-400'
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
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-500 bg-opacity-90 dark:bg-brand-600/90">
                      <input
                        type="text"
                        value={tempName}
                        onChange={handleNameChange}
                        onKeyDown={handleKeyDown}
                        onBlur={handleNameSave}
                        className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-brand-700 dark:border-brand-500 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/50"
                        placeholder="Nombre del área"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-10 pt-1">
                      <span className="text-black dark:text-black font-medium text-sm drop-shadow-md bg-transparent px-0.5 py-0">
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
                          ? 'bg-red-600 bg-opacity-60 border-red-800 dark:border-red-600' 
                          : 'bg-red-500 bg-opacity-40 border-red-600 dark:border-red-400'
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
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-90 dark:bg-red-600/90">
                          <input
                            type="text"
                            value={tempName}
                            onChange={handleNameChange}
                            onKeyDown={handleKeyDown}
                            onBlur={handleNameSave}
                            className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-red-700 dark:border-red-500 rounded text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50"
                            placeholder="Nombre de sub-área"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-white dark:text-white font-medium text-xs drop-shadow-md">
                            {subArea.name || `${subArea.col}${subArea.row}`}
                          </span>
                        </div>
                      )}
                      
                      {/* Handles de redimensionamiento para sub-área seleccionada */}
                      {selectedSubArea?.subAreaId === subArea.id && (
                        <>
                          <div 
                            className="absolute w-3 h-3 bg-red-800 dark:bg-red-600 border border-white dark:border-slate-300 -top-1.5 -left-1.5 cursor-nw-resize z-10 hover:bg-red-600 dark:hover:bg-red-500"
                            title="Redimensionar esquina superior izquierda"
                            onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'nw')}
                          />
                          <div 
                            className="absolute w-3 h-3 bg-red-800 dark:bg-red-600 border border-white dark:border-slate-300 -top-1.5 -right-1.5 cursor-ne-resize z-10 hover:bg-red-600 dark:hover:bg-red-500"
                            title="Redimensionar esquina superior derecha"
                            onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'ne')}
                          />
                          <div 
                            className="absolute w-3 h-3 bg-red-800 dark:bg-red-600 border border-white dark:border-slate-300 -bottom-1.5 -left-1.5 cursor-sw-resize z-10 hover:bg-red-600 dark:hover:bg-red-500"
                            title="Redimensionar esquina inferior izquierda"
                            onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'sw')}
                          />
                          <div 
                            className="absolute w-3 h-3 bg-red-800 dark:bg-red-600 border border-white dark:border-slate-300 -bottom-1.5 -right-1.5 cursor-se-resize z-10 hover:bg-red-600 dark:hover:bg-red-500"
                            title="Redimensionar esquina inferior derecha"
                            onMouseDown={(e) => handleSubAreaResizeMouseDown(e, subArea.id, area.id, 'se')}
                          />
                        </>
                      )}
                    </div>
                  ))}
                
                  {/* Handles de redimensionamiento en las esquinas */}
                  <div 
                    className="absolute w-2 h-2 bg-brand-800 dark:bg-brand-600 -top-1 -left-1 cursor-nw-resize"
                    title="Redimensionar esquina superior izquierda"
                    onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'nw')}
                  />
                  <div 
                    className="absolute w-2 h-2 bg-brand-800 dark:bg-brand-600 -top-1 -right-1 cursor-ne-resize"
                    title="Redimensionar esquina superior derecha"
                    onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'ne')}
                  />
                  <div 
                    className="absolute w-2 h-2 bg-brand-800 dark:bg-brand-600 -bottom-1 -left-1 cursor-sw-resize"
                    title="Redimensionar esquina inferior izquierda"
                    onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'sw')}
                  />
                  <div 
                    className="absolute w-2 h-2 bg-brand-800 dark:bg-brand-600 -bottom-1 -right-1 cursor-se-resize"
                    title="Redimensionar esquina inferior derecha"
                    onMouseDown={(e) => handleResizeMouseDown(e, area.id, 'se')}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* PANEL DE INFORMACIÓN */}
        <div className="bg-brand-100 dark:bg-brand-900/30 border border-brand-400 dark:border-brand-700 px-6 py-4 rounded-2xl m-6">
          <p className="font-bold text-brand-700 dark:text-brand-200 mb-2">
            📋 Guía Rápida del Editor
          </p>
          <details className="text-sm text-brand-600 dark:text-brand-300 cursor-pointer">
            <summary>Ver instrucciones de uso</summary>
            <div className="mt-3 space-y-2 text-xs">
              <p>• <strong>Canvas:</strong> A-Z x 1-25 (650 celdas iniciales)</p>
              <p>• <strong>Tamaño celda:</strong> 40x40px</p>
              <p>• <strong>Hover:</strong> Muestra coordenadas de celda</p>
              <p>• <strong>Áreas:</strong> Click "Añadir Área" para crear en A1</p>
              <p>• <strong>Seleccionar:</strong> Click sobre área/sub-área</p>
              <p>• <strong>Sub-áreas:</strong> Se añaden dentro del área padre</p>
              <p>• <strong>Edición:</strong> Doble click para editar nombres</p>
              <p>• <strong>Redimensionar:</strong> Arrastrar desde esquinas</p>
              <p>• <strong>Mover:</strong> Arrastrar áreas/sub-áreas</p>
              <p>• <strong>Eliminación:</strong> Seleccionar y usar botones correspondientes</p>
            </div>
          </details>
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
