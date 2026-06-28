import type { PaletPendiente } from './CargaCamionService';
import type { Camion } from './CamionService';
import type { CargaCamion } from './CamionService';

export interface MapaDiseno {
  areas: AreaData[];
  gridSize: GridSize;
}

export interface AreaData {
  id: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  subAreas: SubAreaData[];
}

export interface SubAreaData {
  id: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  areaId: string;
}

export interface GridSize {
  cellWidth: number;
  cellHeight: number;
}

export interface ResultadoCargaAutomatica {
  seleccionados: PaletPendiente[];
  omitidos: number;
  pesoTotal: number;
  volumenTotal: number;
  porcentajePeso: number;
  porcentajeVolumen: number;
}

export const CAPACITY_LIMIT = 0.95;

interface PaletConScore extends PaletPendiente {
  score: number;
  distancia?: number;
}

function parseMapDesignToZones(mapDesign: MapaDiseno): Map<string, SubAreaData[]> {
  const zonesMap = new Map<string, SubAreaData[]>();
  for (const area of mapDesign.areas) {
    if (area.subAreas && area.subAreas.length > 0) {
      zonesMap.set(area.id, area.subAreas);
    }
  }
  return zonesMap;
}

function calculateDistance(
  paletSubzona: string,
  subArea: SubAreaData
): number {
  if (!paletSubzona) return 9999;
  const subAreaName = subArea.name.toUpperCase().trim();
  const paletSubzonaUpper = paletSubzona.toUpperCase().trim();
  if (subAreaName === paletSubzonaUpper) return 0;
  return 1;
}

export function calcularCargaAutomatica(
  paletsPendientes: PaletPendiente[],
  camion: Camion,
  cargaActual: CargaCamion | undefined,
  limitePesoPct: number,
  limiteVolumenPct: number,
  mapaDiseno: MapaDiseno | null
): ResultadoCargaAutomatica {
  const paletsCargados = cargaActual?.palets ?? [];
  const docIdsCargados = new Set(paletsCargados.map((p) => p.docId));

  const disponibles = paletsPendientes.filter((p) => !docIdsCargados.has(p.docId));

  const pesoActual = paletsCargados.reduce((sum, p) => sum + p.pesoKg, 0);
  const volumenActual = paletsCargados.reduce((sum, p) => sum + p.volumenM3, 0);

  const pesoMaximo = camion.capacidadPeso * limitePesoPct;
  const volumenMaximo = camion.capacidadVolumen * limiteVolumenPct;

  const pesoDisponible = Math.max(0, pesoMaximo - pesoActual);
  const volumenDisponible = Math.max(0, volumenMaximo - volumenActual);

  if (pesoDisponible <= 0 && volumenDisponible <= 0) {
    return {
      seleccionados: [],
      omitidos: disponibles.length,
      pesoTotal: pesoActual,
      volumenTotal: volumenActual,
      porcentajePeso: (pesoActual / camion.capacidadPeso) * 100,
      porcentajeVolumen: (volumenActual / camion.capacidadVolumen) * 100,
    };
  }

  const zonasMapa = mapaDiseno ? parseMapDesignToZones(mapaDiseno) : new Map();

  const paletsConScore: PaletConScore[] = disponibles.map((palet) => {
    let score = 0;

    const diasEnAlmacen = palet.urgencia ?? 0;
    score += diasEnAlmacen * 10;

    let distancia: number | undefined;
    if (mapaDiseno && palet.subzona && zonasMapa.size > 0) {
      let minDist = 9999;
      for (const subAreas of zonasMapa.values()) {
        for (const subArea of subAreas) {
          const dist = calculateDistance(palet.subzona, subArea);
          if (dist < minDist) minDist = dist;
        }
      }
      distancia = minDist;
      score += (10 - minDist) * 5;
    }

    return { ...palet, score, distancia };
  });

  paletsConScore.sort((a, b) => b.score - a.score);

  const seleccionados: PaletPendiente[] = [];
  let pesoAcumulado = pesoActual;
  let volumenAcumulado = volumenActual;
  let omitidos = 0;

  for (const palet of paletsConScore) {
    const nuevoPeso = pesoAcumulado + palet.pesoKg;
    const nuevoVolumen = volumenAcumulado + palet.volumenM3;

    if (nuevoPeso <= pesoMaximo && nuevoVolumen <= volumenMaximo) {
      seleccionados.push(palet);
      pesoAcumulado = nuevoPeso;
      volumenAcumulado = nuevoVolumen;
    } else {
      omitidos++;
    }
  }

  return {
    seleccionados,
    omitidos,
    pesoTotal: pesoAcumulado,
    volumenTotal: volumenAcumulado,
    porcentajePeso: (pesoAcumulado / camion.capacidadPeso) * 100,
    porcentajeVolumen: (volumenAcumulado / camion.capacidadVolumen) * 100,
  };
}