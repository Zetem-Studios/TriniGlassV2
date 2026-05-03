import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  updateDoc,
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

const PALETS_QUERY_LIMIT = 300;

const ESTADOS_VISIBLES = new Set([
  "Pendiente",
  "Para verificar",
  "Codificada",
  "Producción",
  "Producida",
  "Listo para carga",
]);

export const computeVolumeM3 = (altura?: number, longitud?: number): number => {
  const h = Number(altura) || 0;
  const l = Number(longitud) || 0;
  if (!h || !l) return 0.5;
  const m3 = (h / 1000) * (l / 1000) * 0.1;
  return Math.max(0.05, Number(m3.toFixed(3)));
};

export const subscribeToPalets = (
  cb: (palets: PaletPendiente[]) => void
): (() => void) => {
  const q = query(
    collection(db, PRODUCTOS),
    orderBy("fecha_linea_pedido", "desc"),
    limit(PALETS_QUERY_LIMIT)
  );
  return onSnapshot(q, (snap) => {
    const list: PaletPendiente[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const altura = Number((data.altura as number) ?? 0);
      const longitud = Number((data.longitud as number) ?? 0);
      const pesoKg =
        Number((data.peso_total_kg as number) ?? 0) ||
        Number((data.peso_pieza_kg as number) ?? 0);
      return {
        docId: d.id,
        codigoBarra: String(data.codigo_barra ?? d.id),
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
    });
    const visibles = list.filter((p) => ESTADOS_VISIBLES.has(p.estado));
    cb(visibles.length ? visibles : list);
  });
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
