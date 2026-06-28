import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "../src/firebase";

export interface PaletPendiente {
  docId: string;
  codigoBarra: string;
  cliente: string;
  descripcion: string;
  altura: number;
  longitud: number;
  pesoKg: number;
  volumenM3: number;
  estado: string;
  numeroLineaPedido?: string;
  subzona?: string;
}

export interface PaletAsignado {
  docId: string;
  codigoBarra: string;
  cliente: string;
  descripcion: string;
  pesoKg: number;
  volumenM3: number;
  asignadoPor: string;
  asignadoEnIso: string;
}

export interface CargaCamion {
  matricula: string;
  palets: PaletAsignado[];
}

const CARGAS = "cargas";
const PRODUCTOS = "productos";

const ESTADOS_VISIBLES_LIST = [
  "Pendiente",
  "Para verificar",
  "Codificada",
  "Producción",
  "Producida",
  "Listo para carga",
] as const;

const ESTADOS_VISIBLES = new Set<string>(ESTADOS_VISIBLES_LIST);

export const ESTADO_ENTREGADO = "Entregado";
export const ESTADO_EN_TRANSITO = "En tránsito";

export const computeVolumeM3 = (altura?: number, longitud?: number): number => {
  const h = Number(altura) || 0;
  const l = Number(longitud) || 0;
  if (!h || !l) return 0.5;
  const m3 = (h / 1000) * (l / 1000) * 0.1;
  return Math.max(0.05, Number(m3.toFixed(3)));
};

const mapDocToPalet = (
  id: string,
  data: Record<string, unknown>
): PaletPendiente => {
  const altura = Number((data.altura as number) ?? 0);
  const longitud = Number((data.longitud as number) ?? 0);
  const pesoKg =
    Number((data.peso_total_kg as number) ?? 0) ||
    Number((data.peso_pieza_kg as number) ?? 0);
  return {
    docId: id,
    codigoBarra: String(data.codigo_barra ?? id),
    cliente: String(
      data.apellido_cliente ?? data.nombre_abreviado ?? "Sin cliente"
    ),
    descripcion: String(
      data.descripcion_producido_longitud ?? data.estado_linea_pdd ?? ""
    ),
    altura,
    longitud,
    pesoKg: Number.isFinite(pesoKg) ? pesoKg : 0,
    volumenM3: computeVolumeM3(altura, longitud),
    estado: String(data.estado_pedido ?? "Pendiente"),
    numeroLineaPedido: data.numero_linea_pedido
      ? String(data.numero_linea_pedido)
      : undefined,
    subzona: data.subzona ? String(data.subzona) : undefined,
  };
};

export const subscribeToPalets = (
  cb: (palets: PaletPendiente[]) => void
): (() => void) => {
  const filteredQuery = query(
    collection(db, PRODUCTOS),
    where("estado_pedido", "in", [...ESTADOS_VISIBLES_LIST])
  );

  return onSnapshot(
    filteredQuery,
    (snap) => {
      const list = snap.docs.map((d) =>
        mapDocToPalet(d.id, d.data() as Record<string, unknown>)
      );
      cb(list);
    },
    (err) => {
      console.warn(
        "[subscribeToPalets] consulta filtrada falló, usando fallback:",
        err
      );
      const fallbackQuery = query(
        collection(db, PRODUCTOS),
        orderBy("fecha_linea_pedido", "desc")
      );
      onSnapshot(fallbackQuery, (snap) => {
        const list = snap.docs.map((d) =>
          mapDocToPalet(d.id, d.data() as Record<string, unknown>)
        );
        const visibles = list.filter((p) => ESTADOS_VISIBLES.has(p.estado));
        cb(
          visibles.length
            ? visibles
            : list.filter((p) => p.estado !== ESTADO_ENTREGADO)
        );
      });
    }
  );
};

export const subscribeToCargas = (
  cb: (cargas: Record<string, CargaCamion>) => void
): (() => void) => {
  return onSnapshot(collection(db, CARGAS), (snap) => {
    const map: Record<string, CargaCamion> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as { palets?: PaletAsignado[] };
      map[d.id] = {
        matricula: d.id,
        palets: Array.isArray(data.palets) ? data.palets : [],
      };
    });
    cb(map);
  });
};

export interface AsignarParams {
  matricula: string;
  palet: Omit<PaletAsignado, "asignadoPor" | "asignadoEnIso">;
  capacidad: { peso: number; volumen: number };
  email: string;
}

/** Añade varios palets en una sola transacción (1 lectura + 1 escritura).
 *  Usar para carga automática en lugar del bucle de assignPaletToCamion. */
export const assignPaletsBatch = async ({
  matricula,
  palets,
  email,
}: {
  matricula: string;
  palets: Omit<PaletAsignado, "asignadoPor" | "asignadoEnIso">[];
  email: string;
}): Promise<void> => {
  const ref = doc(db, CARGAS, matricula);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current: PaletAsignado[] = snap.exists()
      ? ((snap.data().palets as PaletAsignado[]) ?? [])
      : [];

    const yaAsignados = new Set(current.map((p) => p.docId));
    const timestamp = new Date().toISOString();
    const nuevos: PaletAsignado[] = palets
      .filter((p) => !yaAsignados.has(p.docId))
      .map((p) => ({ ...p, asignadoPor: email || "anónimo", asignadoEnIso: timestamp }));

    tx.set(
      ref,
      { matricula, palets: [...current, ...nuevos], actualizadoEn: serverTimestamp() },
      { merge: true }
    );
  });
};

export const assignPaletToCamion = async ({
  matricula,
  palet,
  capacidad,
  email,
}: AsignarParams): Promise<void> => {
  const ref = doc(db, CARGAS, matricula);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current: PaletAsignado[] = snap.exists()
      ? ((snap.data().palets as PaletAsignado[]) ?? [])
      : [];

    if (current.find((p) => p.docId === palet.docId)) {
      throw new Error("Este palet ya está asignado a este camión.");
    }

    const totalPeso =
      current.reduce((a, p) => a + (p.pesoKg ?? 0), 0) + palet.pesoKg;
    const totalVol =
      current.reduce((a, p) => a + (p.volumenM3 ?? 0), 0) + palet.volumenM3;

    if (totalPeso > capacidad.peso) {
      throw new Error(
        `Excede el peso máximo (${totalPeso.toFixed(0)} / ${capacidad.peso} kg).`
      );
    }
    if (totalVol > capacidad.volumen) {
      throw new Error(
        `Excede el volumen máximo (${totalVol.toFixed(2)} / ${capacidad.volumen.toFixed(
          2
        )} m³).`
      );
    }

    const nuevo: PaletAsignado = {
      ...palet,
      asignadoPor: email || "anónimo",
      asignadoEnIso: new Date().toISOString(),
    };

    tx.set(
      ref,
      {
        matricula,
        palets: [...current, nuevo],
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  });
};

export const removePaletFromCamion = async (
  matricula: string,
  paletDocId: string
): Promise<void> => {
  const ref = doc(db, CARGAS, matricula);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current: PaletAsignado[] = (snap.data().palets as PaletAsignado[]) ?? [];
    tx.set(
      ref,
      {
        matricula,
        palets: current.filter((p) => p.docId !== paletDocId),
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  });
};

export const vaciarCamion = async (matricula: string): Promise<number> => {
  const ref = doc(db, CARGAS, matricula);
  let removed = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current: PaletAsignado[] = (snap.data().palets as PaletAsignado[]) ?? [];
    removed = current.length;
    tx.set(
      ref,
      {
        matricula,
        palets: [],
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  });
  return removed;
};

export interface ValidacionResultado {
  excedePeso: boolean;
  excedeVolumen: boolean;
  pesoTotal: number;
  volumenTotal: number;
  porcentajePeso: number;
  porcentajeVolumen: number;
}

export const validarCarga = (
  paletsActuales: PaletAsignado[],
  paletNuevo: { pesoKg: number; volumenM3: number } | null,
  capacidad: { peso: number; volumen: number }
): ValidacionResultado => {
  const pesoBase = paletsActuales.reduce((a, p) => a + (p.pesoKg ?? 0), 0);
  const volBase = paletsActuales.reduce((a, p) => a + (p.volumenM3 ?? 0), 0);
  const pesoTotal = pesoBase + (paletNuevo?.pesoKg ?? 0);
  const volumenTotal = volBase + (paletNuevo?.volumenM3 ?? 0);
  return {
    pesoTotal,
    volumenTotal,
    excedePeso: pesoTotal > capacidad.peso,
    excedeVolumen: volumenTotal > capacidad.volumen,
    porcentajePeso: capacidad.peso > 0 ? (pesoTotal / capacidad.peso) * 100 : 0,
    porcentajeVolumen:
      capacidad.volumen > 0 ? (volumenTotal / capacidad.volumen) * 100 : 0,
  };
};

export const verificarPalet = async (docId: string): Promise<void> => {
  const ref = doc(db, PRODUCTOS, docId);
  await updateDoc(ref, {
    estado_pedido: "Verificado",
    fechaUltimaRevision: serverTimestamp(),
  });
};

export interface EntregarPaletParams {
  paletDocId: string;
  email?: string;
}

export interface EntregarPaletResultado {
  matricula: string;
  rutaId: string;
  paletsRestantes: number;
}

export const entregarPaletEnRuta = async ({
  paletDocId,
  email = "anónimo",
}: EntregarPaletParams): Promise<EntregarPaletResultado> => {
  const productoRef = doc(db, PRODUCTOS, paletDocId);
  const productoSnap = await getDoc(productoRef);
  if (!productoSnap.exists()) {
    throw new Error("El palet no existe en la base de datos.");
  }

  const productoData = productoSnap.data();
  if (productoData.estado_pedido !== ESTADO_EN_TRANSITO) {
    throw new Error("Este palet no está en tránsito.");
  }

  const rutaId = (productoData.rutaId as string | undefined) ?? null;
  if (!rutaId) {
    throw new Error("Este palet no tiene una ruta activa asociada.");
  }

  const rutaRef = doc(db, RUTAS, rutaId);
  const rutaSnap = await getDoc(rutaRef);
  if (!rutaSnap.exists()) {
    throw new Error("No se encontró la ruta asociada al palet.");
  }

  const matricula = (rutaSnap.data().matricula as string | undefined) ?? null;
  if (!matricula) {
    throw new Error("La ruta no tiene un camión asignado.");
  }

  const cargaRef = doc(db, CARGAS, matricula);
  const entregadoRef = doc(db, PALETS_ENTREGADOS, paletDocId);

  let paletsRestantes = 0;

  await runTransaction(db, async (tx) => {
    const cargaSnap = await tx.get(cargaRef);
    const rutaTxSnap = await tx.get(rutaRef);

    if (!cargaSnap.exists()) {
      throw new Error("El camión no tiene una carga registrada.");
    }

    const current: PaletAsignado[] =
      (cargaSnap.data().palets as PaletAsignado[]) ?? [];
    const paletEntregado = current.find((p) => p.docId === paletDocId);

    if (!paletEntregado) {
      throw new Error("Este palet no está cargado en el camión.");
    }

    const restantes = current.filter((p) => p.docId !== paletDocId);
    paletsRestantes = restantes.length;

    tx.set(
      cargaRef,
      {
        matricula,
        palets: restantes,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(entregadoRef, {
      ...productoData,
      docId: paletEntregado.docId,
      codigoBarra: paletEntregado.codigoBarra,
      cliente: paletEntregado.cliente,
      descripcion: paletEntregado.descripcion,
      pesoKg: paletEntregado.pesoKg,
      volumenM3: paletEntregado.volumenM3,
      asignadoPor: paletEntregado.asignadoPor,
      asignadoEnIso: paletEntregado.asignadoEnIso,
      matricula,
      estado: ESTADO_ENTREGADO,
      estado_pedido: ESTADO_ENTREGADO,
      entregadoEn: serverTimestamp(),
      entregadoPor: email,
      entregadoPorMatricula: matricula,
      rutaId,
      zona: null,
      subzona: null,
      posicion: null,
    });

    tx.delete(productoRef);

    if (rutaTxSnap.exists()) {
      const rutaTxData = rutaTxSnap.data();
      const paletsEntregadosActuales: PaletAsignado[] =
        (rutaTxData.paletsEntregados as PaletAsignado[]) ?? [];
      const paradasActuales: Parada[] =
        (rutaTxData.paradas as Parada[]) ?? [];

      const yaEntregado = paletsEntregadosActuales.some(
        (p) => p.docId === paletDocId
      );
      const nuevosPaletsEntregados = yaEntregado
        ? paletsEntregadosActuales
        : [...paletsEntregadosActuales, paletEntregado];

      const docIdsEntregados = new Set(
        nuevosPaletsEntregados.map((p) => p.docId)
      );

      const nuevasParadas = paradasActuales.map((parada) => {
        if (parada.entregado) return parada;
        const todosEntregados = parada.paletsIds.every((id) =>
          docIdsEntregados.has(id)
        );
        return todosEntregados ? { ...parada, entregado: true } : parada;
      });

      const pesoEntregado = nuevosPaletsEntregados.reduce(
        (a, p) => a + (p.pesoKg ?? 0),
        0
      );
      const volumenEntregado = nuevosPaletsEntregados.reduce(
        (a, p) => a + (p.volumenM3 ?? 0),
        0
      );

      tx.update(rutaRef, {
        paletsEntregados: nuevosPaletsEntregados,
        totalEntregados: nuevosPaletsEntregados.length,
        paradas: nuevasParadas,
        pesoEntregadoKg: Number(pesoEntregado.toFixed(2)),
        volumenEntregadoM3: Number(volumenEntregado.toFixed(3)),
        actualizadoEn: serverTimestamp(),
      });
    }
  });

  return { matricula, rutaId, paletsRestantes };
};

const CAMIONES = "camiones";
const PALETS_ENTREGADOS = "palets_entregados";
const RUTAS = "rutas";

export type RutaEstado = "en_curso" | "finalizada" | "cancelada";

export interface Parada {
  cliente: string;
  paletsIds: string[];
  totalPalets: number;
  orden: number;
  entregado: boolean;
}

export interface Ruta {
  id: string;
  matricula: string;
  conductor: string;
  tipo: string;
  estado: RutaEstado;
  origen: string;
  paradas: Parada[];
  totalPalets: number;
  totalEntregados?: number;
  pesoTotalKg: number;
  volumenTotalM3: number;
  iniciadoPor: string;
  finalizadoPor?: string;
  paletsCargados: PaletAsignado[];
  paletsEntregados?: PaletAsignado[];
}

export interface IniciarRutaParams {
  matricula: string;
  conductor: string;
  tipo: string;
  email: string;
  origen: string;
  paradas: Parada[];
}

export const computeParadasFromPalets = (
  palets: PaletAsignado[],
  ordenPrevio: string[] = []
): Parada[] => {
  const map = new Map<string, string[]>();
  palets.forEach((p) => {
    const key = p.cliente?.trim() || "Sin cliente";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p.docId);
  });

  const clientes = Array.from(map.keys());
  const ordenadosPrevios = ordenPrevio.filter((c) => map.has(c));
  const nuevos = clientes.filter((c) => !ordenadosPrevios.includes(c));
  const ordenFinal = [...ordenadosPrevios, ...nuevos];

  return ordenFinal.map((cliente, idx) => {
    const paletsIds = map.get(cliente) ?? [];
    return {
      cliente,
      paletsIds,
      totalPalets: paletsIds.length,
      orden: idx + 1,
      entregado: false,
    };
  });
};

export const iniciarRuta = async ({
  matricula,
  conductor,
  tipo,
  email,
  origen,
  paradas,
}: IniciarRutaParams): Promise<string> => {
  const cargaRef = doc(db, CARGAS, matricula);
  const camionRef = doc(db, CAMIONES, matricula);
  const rutaRef = doc(collection(db, RUTAS));

  await runTransaction(db, async (tx) => {
    const cargaSnap = await tx.get(cargaRef);
    const palets: PaletAsignado[] = cargaSnap.exists()
      ? ((cargaSnap.data().palets as PaletAsignado[]) ?? [])
      : [];

    if (palets.length === 0) {
      throw new Error("El camión no tiene palets cargados.");
    }

    const docIdsCarga = new Set(palets.map((p) => p.docId));
    const paradasConsistentes = paradas.every((p) =>
      p.paletsIds.every((id) => docIdsCarga.has(id))
    );
    if (!paradasConsistentes) {
      throw new Error(
        "Las paradas no coinciden con los palets cargados. Vuelve a abrir la página."
      );
    }

    const pesoTotal = palets.reduce((a, p) => a + (p.pesoKg ?? 0), 0);
    const volumenTotal = palets.reduce((a, p) => a + (p.volumenM3 ?? 0), 0);

    const paradasNormalizadas: Parada[] = paradas.map((p, idx) => ({
      cliente: p.cliente,
      paletsIds: p.paletsIds,
      totalPalets: p.paletsIds.length,
      orden: idx + 1,
      entregado: false,
    }));

    tx.set(rutaRef, {
      matricula,
      conductor: conductor || "",
      tipo: tipo || "",
      estado: "en_curso" as RutaEstado,
      origen: origen?.trim() || "",
      paradas: paradasNormalizadas,
      totalParadas: paradasNormalizadas.length,
      totalPalets: palets.length,
      pesoTotalKg: Number(pesoTotal.toFixed(2)),
      volumenTotalM3: Number(volumenTotal.toFixed(3)),
      iniciadoPor: email || "anónimo",
      paletsCargados: palets,
      fechaInicio: serverTimestamp(),
    });

    tx.set(
      camionRef,
      {
        estado: "en_ruta",
        rutaActivaId: rutaRef.id,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );

    const paradaPorPalet = new Map<string, number>();
    paradasNormalizadas.forEach((parada) => {
      parada.paletsIds.forEach((id) => paradaPorPalet.set(id, parada.orden));
    });

    palets.forEach((p) => {
      tx.update(doc(db, PRODUCTOS, p.docId), {
        estado_pedido: ESTADO_EN_TRANSITO,
        rutaId: rutaRef.id,
        paradaOrden: paradaPorPalet.get(p.docId) ?? null,
        enTransitoDesdeIso: new Date().toISOString(),
      });
    });
  });

  return rutaRef.id;
};

export interface FinalizarRutaResultado {
  paletsEliminados: number;
  rutaId: string | null;
}

export const finalizarRuta = async (
  matricula: string,
  email = "anónimo"
): Promise<FinalizarRutaResultado> => {
  const cargaRef = doc(db, CARGAS, matricula);
  const camionRef = doc(db, CAMIONES, matricula);

  const [cargaSnap, camionSnap] = await Promise.all([
    getDoc(cargaRef),
    getDoc(camionRef),
  ]);

  const palets: PaletAsignado[] = cargaSnap.exists()
    ? ((cargaSnap.data().palets as PaletAsignado[]) ?? [])
    : [];

  const rutaActivaId = camionSnap.exists()
    ? ((camionSnap.data().rutaActivaId as string | undefined) ?? null)
    : null;

  const pesoEntregado = palets.reduce((a, p) => a + (p.pesoKg ?? 0), 0);
  const volumenEntregado = palets.reduce((a, p) => a + (p.volumenM3 ?? 0), 0);

  const productoRefs = palets.map((p) => doc(db, PRODUCTOS, p.docId));
  const productoSnaps = await Promise.all(productoRefs.map((ref) => getDoc(ref)));
  const productosData = productoSnaps.map((snap) =>
    snap.exists() ? snap.data() : {}
  );

  const batch = writeBatch(db);

  palets.forEach((p, i) => {
    batch.set(doc(db, PALETS_ENTREGADOS, p.docId), {
      ...productosData[i],
      docId: p.docId,
      codigoBarra: p.codigoBarra,
      cliente: p.cliente,
      descripcion: p.descripcion,
      pesoKg: p.pesoKg,
      volumenM3: p.volumenM3,
      asignadoPor: p.asignadoPor,
      asignadoEnIso: p.asignadoEnIso,
      matricula,
      estado: ESTADO_ENTREGADO,
      estado_pedido: ESTADO_ENTREGADO,
      entregadoEn: serverTimestamp(),
      entregadoPor: email,
      entregadoPorMatricula: matricula,
      rutaId: rutaActivaId ?? null,
      zona: null,
      subzona: null,
      posicion: null,
    });

    if (productoSnaps[i].exists()) {
      batch.delete(productoRefs[i]);
    }
  });

  if (rutaActivaId) {
    batch.update(doc(db, RUTAS, rutaActivaId), {
      estado: "finalizada",
      paletsEntregados: palets,
      totalEntregados: palets.length,
      pesoEntregadoKg: Number(pesoEntregado.toFixed(2)),
      volumenEntregadoM3: Number(volumenEntregado.toFixed(3)),
      finalizadoPor: email,
      fechaFin: serverTimestamp(),
    });
  }

  batch.set(
    cargaRef,
    {
      matricula,
      palets: [],
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    camionRef,
    {
      estado: "no_disponible",
      rutaActivaId: null,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { paletsEliminados: palets.length, rutaId: rutaActivaId };
};

export interface CancelarRutaResultado {
  rutaId: string | null;
  paletsRevertidos: number;
}

export const cancelarRuta = async (
  matricula: string,
  email = "anónimo"
): Promise<CancelarRutaResultado> => {
  const cargaRef = doc(db, CARGAS, matricula);
  const camionRef = doc(db, CAMIONES, matricula);

  const [cargaSnap, camionSnap] = await Promise.all([
    getDoc(cargaRef),
    getDoc(camionRef),
  ]);

  const palets: PaletAsignado[] = cargaSnap.exists()
    ? ((cargaSnap.data().palets as PaletAsignado[]) ?? [])
    : [];

  const rutaActivaId = camionSnap.exists()
    ? ((camionSnap.data().rutaActivaId as string | undefined) ?? null)
    : null;

  const batch = writeBatch(db);

  palets.forEach((p) => {
    batch.update(doc(db, PRODUCTOS, p.docId), {
      estado_pedido: "Listo para carga",
      rutaId: null,
      paradaOrden: null,
      enTransitoDesdeIso: null,
    });
  });

  if (rutaActivaId) {
    batch.update(doc(db, RUTAS, rutaActivaId), {
      estado: "cancelada",
      canceladoPor: email,
      fechaCancelacion: serverTimestamp(),
    });
  }

  batch.set(
    cargaRef,
    {
      matricula,
      palets: [],
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    camionRef,
    {
      estado: "disponible",
      rutaActivaId: null,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { paletsRevertidos: palets.length, rutaId: rutaActivaId };
};
