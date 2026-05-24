import type { PaletPendiente, CargaCamion } from "./CargaCamionService";
import type { Camion } from "./CamionService";

// ─── Configuración ────────────────────────────────────────────────────────────
// Límite de capacidad: 0.90 = se rellena hasta el 90% del peso máximo.
// Cambiar este valor para ajustar el margen de seguridad.
export const CAPACITY_LIMIT = 0.90;
// ─────────────────────────────────────────────────────────────────────────────

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
 * Estrategia (Triple técnico):
 *  1. Urgencia: los palets más antiguos (fecha_linea_pedido ASC) tienen prioridad.
 *     `subscribeToPalets` los devuelve ordenados DESC, así que los revertimos.
 *  2. Optimización de ruta: los palets del mismo cliente se agrupan juntos,
 *     manteniendo el orden de urgencia del primer palet del grupo.
 *  3. Relleno greedy: se añaden grupos completos de cliente hasta alcanzar
 *     CAPACITY_LIMIT del peso máximo del camión.
 *
 * @param pendientes  Palets disponibles (ya filtrados: sin asignar, estado visible).
 * @param camion      Camión destino con sus capacidades.
 * @param cargaActual Estado actual de la carga del camión (puede estar vacío).
 */
export const calcularCargaAutomatica = (
  pendientes: PaletPendiente[],
  camion: Camion,
  cargaActual: CargaCamion | undefined,
  limitePeso = CAPACITY_LIMIT,
  limiteVolumen = CAPACITY_LIMIT,
): ResultadoCargaAutomatica => {
  const pesoMaximo = camion.capacidadPeso * limitePeso;
  const volumenMaximo = camion.capacidadVolumen * limiteVolumen;

  // Peso y volumen ya cargados en el camión
  const pesoBase = cargaActual?.palets.reduce((a, p) => a + (p.pesoKg ?? 0), 0) ?? 0;
  const volBase = cargaActual?.palets.reduce((a, p) => a + (p.volumenM3 ?? 0), 0) ?? 0;

  // Excluir palets que ya están en este camión
  const yaAsignados = new Set(cargaActual?.palets.map((p) => p.docId) ?? []);
  const candidatos = pendientes.filter((p) => !yaAsignados.has(p.docId));

  // Paso 1: Invertir → más urgentes (fecha más antigua) primero
  const porUrgencia = [...candidatos].reverse();

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
