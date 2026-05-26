import { RuleEngine, type ReglaAsignacion } from "../utils/RuleEngine";

export type ZoneLayout = "horizontal" | "vertical" | "single";

export interface WarehouseBlock {
  id: string;
  zoneId: string;
  area: string;
  type?: string;
  daysInStorage: number;
  client?: string;
  occupied: boolean;
  dimensions?: string;
  weight?: string;
  priority?: string;
  lastUpdate?: string;
  numeroCliente?: string;
  numeroLineaPedido?: string;
  estadoPedido?: string;
  empresa?: string;
  referencias?: string;
  nombreAbreviado?: string;
  position?: string;
  locationId?: string;
}

export interface WarehouseZone {
  id: string;
  name: string;
  areas: string[];
  subzones: Record<string, string[]>;
  layout: ZoneLayout;
  capacidadMaxima?: number;
  ocupacionActual?: number;
}

export interface RecommendationZone extends WarehouseZone {
  blocks: WarehouseBlock[];
}

export interface PalletLocationRecommendation {
  locationId: string | null;
  isSaturation: boolean;
  zoneId: string | null;
}

export const ZONE_CONFIGS = {
  expediciones: {
    name: "Expediciones",
    subzones: {
      H: ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5'],
      Mamparista: ['D1','D2','D3','D4','D5','E1','E2','E3','E4','E5']
    }
  },
  pulidoras: {
    name: "Pulidoras",
    subzones: {
      F: ['A5']
    }
  },
  corte: {
    name: "Corte",
    subzones: {
      E: ['A4']
    }
  },
  cms: {
    name: "CMS",
    subzones: {
      D: ['A1','A2','A3','A4','B1','B2','B3','B4']
    }
  },
  bilateral_taladros: {
    name: "Bilateral/Taladros",
    subzones: {
      C: ['A5'],
      B: ['E5']
    }
  },
  horno: {
    name: "Horno",
    subzones: {
      A: ['A1','A2','A3','B1','B2','B3','C1','C2','C3'],
      '??': ['A6','B6']
    }
  }
};

export const ZONES: WarehouseZone[] = Object.entries(ZONE_CONFIGS).map(([id, config]) => ({
  id,
  name: config.name,
  areas: Object.keys(config.subzones),
  subzones: config.subzones,
  layout: id === 'expediciones' || id === 'bilateral_taladros' ? 'horizontal' : id === 'horno' ? 'vertical' : 'single'
}));

export const INITIAL_ZONES = ZONES;

const normalizeText = (value: unknown) => String(value ?? "").trim().toUpperCase();

const normalizeNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildLocationId = (zoneId: string, area: string, position: string) => `${zoneId}-${area}-${position}`;

export const normalizeLocationId = (value: unknown) => String(value ?? "").trim().toUpperCase();

export const locationIdsMatch = (...ids: unknown[]) => {
  const [firstId, ...restIds] = ids.map(normalizeLocationId);
  return Boolean(firstId) && restIds.some(id => id === firstId);
};

export const getAreaPositions = (zone: WarehouseZone | undefined, area: string) => {
  if (!zone) return [];
  const configuredPositions = zone.subzones?.[area];
  if (Array.isArray(configuredPositions) && configuredPositions.length > 0) return configuredPositions;
  return zone.areas.includes(area) ? [area] : [];
};

export const normalizeFirestoreZones = (data: any[]): WarehouseZone[] =>
  data.map((z: any) => {
    const id = String(z.id).toLowerCase();
    const posiciones = Array.isArray(z.posiciones) ? z.posiciones.filter((p: unknown) => typeof p === "string") : [];
    const subzones =
      z.subzones && typeof z.subzones === "object" && Object.keys(z.subzones).length > 0
        ? z.subzones
        : posiciones.reduce((acc: Record<string, string[]>, position: string) => {
            acc[position] = [position];
            return acc;
          }, {});

    return {
      id,
      name: z.name ?? z.nombre ?? id,
      areas: Object.keys(subzones).length > 0 ? Object.keys(subzones) : posiciones,
      subzones,
      layout: "horizontal",
      capacidadMaxima: Number.isFinite(Number(z.capacidadMaxima)) ? Number(z.capacidadMaxima) : posiciones.length,
      ocupacionActual: Number.isFinite(Number(z.ocupacionActual)) ? Number(z.ocupacionActual) : undefined,
    };
  });

export const parseFechaLineaPedido = (fecha: any) => {
  if (!fecha) return null;

  if (fecha instanceof Date) {
    return fecha;
  }

  if (typeof fecha === 'object' && fecha.toDate instanceof Function) {
    return fecha.toDate();
  }

  if (typeof fecha !== 'string') {
    const parsed = Date.parse(String(fecha));
    return isNaN(parsed) ? null : new Date(parsed);
  }

  const normalized = fecha
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const meses: { [key: string]: number } = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  const match = normalized.match(/(\d{1,2}) de (\w+) de (\d{4}) a las (\d{1,2}:\d{2}:\d{2})\s*([ap]\.m\.)\s*UTC\s*([+-]?\d+)/i);
  if (match) {
    const [, diaStr, mesStr, yearStr, horaStr, ampm, tz] = match;
    const dia = Number(diaStr);
    const mes = meses[mesStr.toLowerCase()];
    const year = Number(yearStr);
    if (mes === undefined || Number.isNaN(dia) || Number.isNaN(year)) return null;

    let [hora, minuto, segundo] = horaStr.split(':').map(Number);
    if ([hora, minuto, segundo].some(val => Number.isNaN(val))) return null;

    const ampmNormalized = ampm.toLowerCase().replace(/[\.]/g, '').trim();
    if ((ampmNormalized === 'p' || ampmNormalized === 'pm') && hora < 12) hora += 12;
    if ((ampmNormalized === 'a' || ampmNormalized === 'am') && hora === 12) hora = 0;

    const offset = Number(tz);
    if (Number.isNaN(offset)) return null;

    const utcMillis = Date.UTC(year, mes, dia, hora, minuto, segundo) - offset * 3600 * 1000;
    return new Date(utcMillis);
  }

  const parsed = Date.parse(normalized.replace('UTC', 'GMT'));
  return isNaN(parsed) ? null : new Date(parsed);
};

const getDaysUntil = (fecha: any) => {
  const parsedDate = parseFechaLineaPedido(fecha);
  if (!parsedDate) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTarget = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()).getTime();
  return Math.ceil((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
};

export const buildRuleEvaluationProduct = (producto: any) => {
  const fechaPedido = parseFechaLineaPedido(producto.fecha_linea_pedido);
  const fechaEntrega = parseFechaLineaPedido(producto.fecha_entrega);
  const hoy = new Date();
  const diasStock = fechaPedido
    ? Math.max(0, Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    ...producto,
    nombre_abreviado: producto.nombre_abreviado ?? producto.nombreAbreviado,
    numero_cliente: producto.numero_cliente ?? producto.numeroCliente,
    peso_total_kg: normalizeNumber(producto.peso_total_kg),
    altura: normalizeNumber(producto.altura),
    longitud: normalizeNumber(producto.longitud),
    vidrio_simple:
      typeof producto.vidrio_simple === "boolean"
        ? producto.vidrio_simple
        : String(producto.vidrio_simple ?? "").trim().toLowerCase() === "true" ||
          String(producto.vidrio_simple ?? "").trim() === "1",
    fecha_linea_pedido: fechaPedido ?? producto.fecha_linea_pedido,
    fecha_entrega: fechaEntrega ?? producto.fecha_entrega,
    dias_en_stock: diasStock,
    daysInStorage: diasStock,
    dias_hasta_entrega: getDaysUntil(producto.fecha_entrega),
  };
};

export const mapProductoToBlock = (producto: any, index: number): WarehouseBlock => {
  const fechaPedido = parseFechaLineaPedido(producto.fecha_linea_pedido);
  const hoy = new Date();
  let daysInStorage = 0;

  if (fechaPedido) {
    daysInStorage = Math.max(0, Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (producto.fecha_linea_pedido) {
    console.warn(`Fecha invalida para producto ${producto.codigo_barra || producto.id} -> fecha_linea_pedido='${producto.fecha_linea_pedido}'`);
  }

  const tipoVidrio = producto.vidrio_simple ? "Vidrio Simple" : "Doble Acristalamiento";

  let priority = "Normal";
  if (daysInStorage > 30) priority = "Alta";
  else if (daysInStorage > 20) priority = "Media";

  let area = "";
  let zoneId = "";
  if (typeof producto.subzona === "string" && producto.subzona.trim() !== "") {
    area = producto.subzona.trim();
    const zonaEncontrada = Object.entries(ZONE_CONFIGS).find(([, config]) =>
      Object.keys(config.subzones).includes(area)
    );
    if (zonaEncontrada) {
      zoneId = zonaEncontrada[0];
    } else {
      area = "";
    }
  }

  if (!area) {
    area = "H";
    zoneId = "expediciones";
    if (typeof producto.nombre_abreviado === "string") {
      const nombre = producto.nombre_abreviado.toUpperCase().trim();
      if (nombre === "DUSCHOLUX" || nombre === "VICOMAM") {
        area = "Mamparista";
        zoneId = "expediciones";
      } else {
        const H_KEYS = ["CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR"];
        if (H_KEYS.some(key => nombre.includes(key))) {
          area = "H";
          zoneId = "expediciones";
        } else {
          const E_KEYS = ["VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER"];
          if (E_KEYS.some(key => nombre.includes(key))) {
            area = "E";
            zoneId = "corte";
          } else {
            const D_KEYS = ["OTERO", "CLEMENTE", "FORNES"];
            if (D_KEYS.some(key => nombre.includes(key))) {
              area = "D";
              zoneId = "cms";
            } else {
              const F_KEYS = ["IBERPERFIL", "VALVERDE"];
              if (F_KEYS.some(key => nombre.includes(key))) {
                area = "F";
                zoneId = "pulidoras";
              } else {
                const C_KEYS = ["BARCELONA", "COMPANY"];
                if (C_KEYS.some(key => nombre.includes(key))) {
                  area = "C";
                  zoneId = "bilateral_taladros";
                } else {
                  const B_KEYS = ["PONSETI", "ALMANSA"];
                  if (B_KEYS.some(key => nombre.includes(key))) {
                    area = "B";
                    zoneId = "bilateral_taladros";
                  } else {
                    const A_KEYS = ["GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"];
                    if (A_KEYS.some(key => nombre.includes(key))) {
                      area = "??";
                      zoneId = "horno";
                    } else {
                      const ALL_KEYS = [
                        "DUSCHOLUX", "VICOMAM",
                        "CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR",
                        "VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER",
                        "OTERO", "CLEMENTE", "FORNES",
                        "IBERPERFIL", "VALVERDE",
                        "BARCELONA", "COMPANY",
                        "PONSETI", "ALMANSA",
                        "GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"
                      ];
                      if (!ALL_KEYS.some(key => nombre.includes(key))) {
                        area = "A";
                        zoneId = "horno";
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (index >= 0) {
    console.log(`${producto.nombre_abreviado} (${producto.codigo_barra}) -> Zona ${zoneId} / Subzona ${area}`);
  }

  return {
    id: producto.codigo_barra || `P-${index}`,
    zoneId,
    area,
    type: tipoVidrio,
    daysInStorage,
    client: producto.apellido_cliente || producto.nombre_abreviado || "Cliente Desconocido",
    occupied: true,
    dimensions: `${producto.altura || 0} x ${producto.longitud || 0} mm`,
    weight: `${producto.peso_total_kg || 0} kg`,
    priority,
    lastUpdate: (() => {
      const fechaEntregaDate = parseFechaLineaPedido(producto.fecha_entrega);
      if (fechaEntregaDate) return fechaEntregaDate.toLocaleDateString('es-ES');
      if (producto.fecha_entrega) {
        const fechaPlain = Date.parse(String(producto.fecha_entrega));
        if (!isNaN(fechaPlain)) return new Date(fechaPlain).toLocaleDateString('es-ES');
      }
      return "N/A";
    })(),
    numeroCliente: producto.numero_cliente ?? producto.numeroCliente,
    numeroLineaPedido: producto.numero_linea_pedido,
    estadoPedido: producto.estado_pedido,
    empresa: producto.empresa,
    referencias: producto.referencia_linea_pedido,
    nombreAbreviado: producto.nombre_abreviado ?? producto.nombreAbreviado
  };
};

export const buildRecommendationZones = (zones: WarehouseZone[], blocks: WarehouseBlock[]): RecommendationZone[] =>
  zones.map(zone => ({
    ...zone,
    blocks: blocks.filter(block => block.zoneId === zone.id),
    ocupacionActual: zone.ocupacionActual ?? blocks.filter(block => block.zoneId === zone.id && block.occupied).length,
    capacidadMaxima:
      zone.capacidadMaxima ??
      Object.values(zone.subzones ?? {}).reduce((total, positions) => total + positions.length, 0),
  }));

export const assignPositionsForArea = (zone: RecommendationZone, area: string) => {
  const positions = getAreaPositions(zone, area);
  const areaBlocks = zone.blocks.filter(block => block.area === area && block.occupied);

  return areaBlocks.map((block, index) => ({
    ...block,
    position: block.position ?? positions[index],
    locationId: block.locationId ?? (positions[index] ? buildLocationId(zone.id, area, positions[index]) : undefined),
  }));
};

const getAssignedBlock = (producto: any, reglas: ReglaAsignacion[] = []) => {
  if (reglas.length > 0) {
    const resultado = new RuleEngine(reglas).evaluarProducto(buildRuleEvaluationProduct(producto));
    if (resultado?.zona && resultado?.subzona) {
      return {
        ...mapProductoToBlock(producto, -1),
        zoneId: String(resultado.zona).trim().toLowerCase(),
        area: String(resultado.subzona).trim(),
      };
    }
  }

  return producto.zoneId && producto.area ? producto : mapProductoToBlock(producto, -1);
};

export const getBestLocation = (
  producto: any,
  todasLasZonas: RecommendationZone[],
  reglas: ReglaAsignacion[] = []
) => {
  const assignedBlock = getAssignedBlock(producto, reglas);
  const assignedZone = todasLasZonas.find(zone => zone.id === assignedBlock.zoneId);
  if (!assignedZone) return null;

  const assignedName = normalizeText(producto.nombre_abreviado ?? producto.nombreAbreviado);
  const assignedClient = normalizeText(producto.numero_cliente ?? producto.numeroCliente);

  const getFreeCandidates = (
    zone: RecommendationZone,
    preferredArea?: string,
    zoneOrder = 0,
    includeOtherAreas = true
  ) => {
    const orderedAreas = (
      preferredArea && !includeOtherAreas
        ? [preferredArea]
        : [
            preferredArea,
            ...zone.areas.filter(area => area !== preferredArea),
          ]
    ).filter(Boolean) as string[];
    const matchedBlocks = zone.blocks.filter(block => {
      const sameName = assignedName && normalizeText(block.nombreAbreviado) === assignedName;
      const sameClient = assignedClient && normalizeText(block.numeroCliente) === assignedClient;
      return block.occupied && (sameName || sameClient);
    });

    return orderedAreas.flatMap((area, areaOrder) => {
      const positions = getAreaPositions(zone, area);
      const positionedBlocks = assignPositionsForArea(zone, area);
      const occupiedPositions = new Set(positionedBlocks.map(block => block.position).filter(Boolean));
      const matchedAreaIndexes = positionedBlocks
        .filter(block => matchedBlocks.some(match => match.id === block.id))
        .map(block => positions.indexOf(block.position ?? ""))
        .filter(index => index >= 0);

      return positions
        .map((position, positionIndex) => ({
          id: buildLocationId(zone.id, area, position),
          area,
          position,
          positionIndex,
          areaOrder,
          zoneOrder,
          hasClientGroup: matchedAreaIndexes.length > 0,
          groupDistance:
            matchedAreaIndexes.length > 0
              ? Math.min(...matchedAreaIndexes.map(index => Math.abs(positionIndex - index)))
              : Number.MAX_SAFE_INTEGER,
        }))
        .filter(candidate => !occupiedPositions.has(candidate.position));
    });
  };

  const sortCandidates = <T extends {
    hasClientGroup: boolean;
    groupDistance: number;
    zoneOrder: number;
    areaOrder: number;
    positionIndex: number;
  }>(candidates: T[]) =>
    [...candidates].sort((a, b) => {
      if (a.hasClientGroup !== b.hasClientGroup) return a.hasClientGroup ? -1 : 1;
      if (a.groupDistance !== b.groupDistance) return a.groupDistance - b.groupDistance;
      if (a.zoneOrder !== b.zoneOrder) return a.zoneOrder - b.zoneOrder;
      if (a.areaOrder !== b.areaOrder) return a.areaOrder - b.areaOrder;
      return a.positionIndex - b.positionIndex;
    });

  const hasDynamicRules = reglas.length > 0;
  const defaultRule = reglas.find(regla => regla.activa && regla.esDefecto);
  const defaultZone = defaultRule?.acciones.zona
    ? todasLasZonas.find(zone => zone.id === String(defaultRule.acciones.zona).trim().toLowerCase())
    : null;
  const defaultArea = defaultRule?.acciones.subzona ? String(defaultRule.acciones.subzona).trim() : undefined;

  const originalZoneCandidates = sortCandidates(
    getFreeCandidates(assignedZone, assignedBlock.area, 0, !hasDynamicRules)
  );
  if (originalZoneCandidates.length > 0) return originalZoneCandidates[0].id;

  if (
    hasDynamicRules &&
    defaultZone &&
    defaultArea &&
    (defaultZone.id !== assignedZone.id || defaultArea !== assignedBlock.area)
  ) {
    const defaultCandidates = sortCandidates(getFreeCandidates(defaultZone, defaultArea, 0, false));
    if (defaultCandidates.length > 0) return defaultCandidates[0].id;
  }

  const alternativeZoneCandidates = sortCandidates(
    todasLasZonas
      .filter(zone => zone.id !== assignedZone.id)
      .flatMap((zone, zoneOrder) => getFreeCandidates(zone, undefined, zoneOrder))
  );
  if (alternativeZoneCandidates.length > 0) return alternativeZoneCandidates[0].id;

  const saturatedArea = assignedBlock.area || assignedZone.areas[0];
  const [firstPosition] = getAreaPositions(assignedZone, saturatedArea);
  return firstPosition ? buildLocationId(assignedZone.id, saturatedArea, firstPosition) : null;
};

export const isSaturationLocation = (locationId: string | null, recommendationZones: RecommendationZone[]) =>
  Boolean(locationId) &&
  recommendationZones.some(zone =>
    zone.areas.some(area =>
      assignPositionsForArea(zone, area).some(block =>
        block.occupied && locationIdsMatch(locationId, block.locationId, block.id)
      )
    )
  );

export const findZoneByLocationId = (locationId: string | null, zones: RecommendationZone[] | WarehouseZone[]) =>
  zones.find(zone => normalizeLocationId(locationId).startsWith(`${normalizeLocationId(zone.id)}-`)) ?? null;

export const recommendPalletLocation = (
  producto: any,
  zones: WarehouseZone[],
  blocks: WarehouseBlock[],
  reglas: ReglaAsignacion[] = [],
): PalletLocationRecommendation => {
  const recommendationZones = buildRecommendationZones(zones, blocks);
  const assignedBlock = getAssignedBlock(producto, reglas);
  const locationId = getBestLocation(producto, recommendationZones, reglas);
  const recommendedZone = findZoneByLocationId(locationId, recommendationZones);

  return {
    locationId,
    isSaturation: Boolean(locationId && recommendedZone && assignedBlock.zoneId && recommendedZone.id !== assignedBlock.zoneId),
    zoneId: recommendedZone?.id ?? null,
  };
};
