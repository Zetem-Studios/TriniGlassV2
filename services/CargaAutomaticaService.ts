import type { PaletPendiente, CargaCamion } from "./CargaCamionService";
import type { Camion } from "./CamionService";

// ─── Configuración ────────────────────────────────────────────────────────────
// Límite de capacidad: 0.90 = se rellena hasta el 90% del peso máximo.
// Cambiar este valor para ajustar el margen de seguridad.
export const CAPACITY_LIMIT = 0.90;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subconjunto mínimo del diseño de almacén necesario para calcular proximidad.
 * Compatible estructuralmente con MapDesign de mapDesignsService.
 */
export interface MapaDiseno {
  areas: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    subAreas: {
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  }[];
}

export interface ResultadoCargaAutomatica {
  seleccionados: PaletPendiente[];
  pesoTotal: number;
  volumenTotal: number;
  porcentajePeso: number;
  porcentajeVolumen: number;
  /** Número de palets que no cupieron por límite de peso o volumen */
  omitidos: number;
}

/**
 * Algoritmo de carga automática.
 *
 * Estrategia:
 *  1. Urgencia: los palets más antiguos (fecha_linea_pedido ASC) tienen prioridad.
 *     `subscribeToPalets` los devuelve ordenados DESC, así que los revertimos.
 *  2. Proximidad a Expediciones (opcional): si se proporciona el diseño del almacén
 *     se calcula la distancia euclidiana de la subzona de cada palet al área
 *     "Expediciones", combinando urgencia (70%) y proximidad (30%).
 *  3. Optimización de ruta: los palets del mismo cliente se agrupan juntos,
 *     manteniendo el orden de score del primer palet del grupo.
 *  4. Relleno greedy: se añaden grupos completos de cliente hasta alcanzar
 *     los límites configurados de peso y volumen.
 *
 * @param pendientes  Palets disponibles (ya filtrados: sin asignar, estado visible).
 * @param camion      Camión destino con sus capacidades.
 * @param cargaActual Estado actual de la carga del camión (puede estar vacío).
 * @param mapaDiseno  Diseño activo del almacén para calcular proximidad (opcional).
 */
export const calcularCargaAutomatica = (
  pendientes: PaletPendiente[],
  camion: Camion,
  cargaActual: CargaCamion | undefined,
  limitePeso = CAPACITY_LIMIT,
  limiteVolumen = CAPACITY_LIMIT,
  mapaDiseno?: MapaDiseno | null,
): ResultadoCargaAutomatica => {
  const pesoMaximo = camion.capacidadPeso * limitePeso;
  const volumenMaximo = camion.capacidadVolumen * limiteVolumen;

  // Peso y volumen ya cargados en el camión
  const pesoBase = cargaActual?.palets.reduce((a, p) => a + (p.pesoKg ?? 0), 0) ?? 0;
  const volBase = cargaActual?.palets.reduce((a, p) => a + (p.volumenM3 ?? 0), 0) ?? 0;

  // Excluir palets que ya están en este camión
  const yaAsignados = new Set(cargaActual?.palets.map((p) => p.docId) ?? []);
  const candidatos = pendientes.filter((p) => !yaAsignados.has(p.docId));

  // Paso 1: Ordenar por score combinado urgencia (70%) + proximidad a Expediciones (30%)
  // Si no hay mapa disponible, se usa únicamente el orden de urgencia (comportamiento original).
  let expedicionesCenter: { x: number; y: number } | null = null;
  const subzonaCoords = new Map<string, { x: number; y: number }>();

  if (mapaDiseno) {
    const expArea = mapaDiseno.areas.find((a) =>
      a.name.toLowerCase().includes("expediciones")
    );
    if (expArea) {
      expedicionesCenter = {
        x: expArea.x + expArea.width / 2,
        y: expArea.y + expArea.height / 2,
      };
    }
    for (const area of mapaDiseno.areas) {
      for (const sub of area.subAreas) {
        subzonaCoords.set(sub.name, {
          x: sub.x + sub.width / 2,
          y: sub.y + sub.height / 2,
        });
      }
    }
  }

  const getDistancia = (palet: PaletPendiente): number => {
    if (!expedicionesCenter || !palet.subzona) return Infinity;
    const coords = subzonaCoords.get(palet.subzona);
    if (!coords) return Infinity;
    const dx = coords.x - expedicionesCenter.x;
    const dy = coords.y - expedicionesCenter.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const n = candidatos.length;
  let porUrgencia: PaletPendiente[];

  if (expedicionesCenter) {
    const distancias = new Map<string, number>(
      candidatos.map((p) => [p.docId, getDistancia(p)])
    );
    const dists = [...distancias.values()].filter(isFinite);
    const maxDist = dists.length > 0 ? Math.max(...dists) : 1;

    // candidatos viene DESC (más reciente = índice 0 = menos urgente)
    // urgencia: i / (n-1) → 0 para el más reciente, 1 para el más antiguo
    porUrgencia = [...candidatos]
      .map((p, i) => {
        const dist = distancias.get(p.docId) ?? Infinity;
        const urgencia = i / Math.max(n - 1, 1);
        const prox = 1 - (isFinite(dist) ? dist / maxDist : 1);
        return { palet: p, score: urgencia * 0.7 + prox * 0.3 };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ palet }) => palet);
  } else {
    porUrgencia = [...candidatos].reverse();
  }

  // Paso 2: Agrupar por cliente manteniendo el orden de urgencia del grupo
  const gruposPorCliente = new Map<string, PaletPendiente[]>();
  const ordenClientes: string[] = [];

  for (const palet of porUrgencia) {
    if (!gruposPorCliente.has(palet.cliente)) {
      gruposPorCliente.set(palet.cliente, []);
      ordenClientes.push(palet.cliente);
    }
    gruposPorCliente.get(palet.cliente)!.push(palet);
  }

  // Paso 3: Relleno greedy por grupos de cliente
  const seleccionados: PaletPendiente[] = [];
  let pesoAcumulado = pesoBase;
  let volAcumulado = volBase;
  let omitidos = 0;

  for (const cliente of ordenClientes) {
    const grupo = gruposPorCliente.get(cliente) ?? [];
    for (const palet of grupo) {
      if (
        pesoAcumulado + palet.pesoKg <= pesoMaximo &&
        volAcumulado + palet.volumenM3 <= volumenMaximo
      ) {
        seleccionados.push(palet);
        pesoAcumulado += palet.pesoKg;
        volAcumulado += palet.volumenM3;
      } else {
        omitidos++;
      }
    }
  }

  return {
    seleccionados,
    pesoTotal: pesoAcumulado,
    volumenTotal: volAcumulado,
    porcentajePeso:
      camion.capacidadPeso > 0
        ? (pesoAcumulado / camion.capacidadPeso) * 100
        : 0,
    porcentajeVolumen:
      camion.capacidadVolumen > 0
        ? (volAcumulado / camion.capacidadVolumen) * 100
        : 0,
    omitidos,
  };
};
