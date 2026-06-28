import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  writeBatch,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CargaCamion, PaletCargado } from './CamionService';

export interface PaletPendiente {
  docId: string;
  codigoBarra: string;
  cliente: string;
  descripcion: string;
  pesoKg: number;
  volumenM3: number;
  estado: string;
  subzona?: string;
  zona?: string;
  posicion?: string;
  urgencia?: number;
}

export interface Parada {
  cliente: string;
  totalPalets: number;
  palets: PaletCargado[];
}

export interface ValidacionCarga {
  pesoTotal: number;
  volumenTotal: number;
  excedePeso: boolean;
  excedeVolumen: boolean;
}

const PRODUCTOS_COLLECTION = 'productos';
const CARGAS_COLLECTION = 'cargas';
const RUTAS_COLLECTION = 'rutas';
const PALETS_ENTREGADOS_COLLECTION = 'palets_entregados';

function mapProductoToPaletPendiente(data: Record<string, unknown>, docId: string): PaletPendiente {
  return {
    docId,
    codigoBarra: (data.codigo_barra as string) || docId,
    cliente: (data.apellido_cliente as string) || (data.nombre_abreviado as string) || 'Cliente desconocido',
    descripcion: (data.descripcion_producido_longitud as string) || 'Sin descripción',
    pesoKg: Number(data.peso_total_kg ?? 0),
    volumenM3: Number(data.volumen_total_m3 ?? 0),
    estado: (data.estado_pedido as string) || 'Pendiente',
    subzona: data.subzona as string | undefined,
    zona: data.zona as string | undefined,
    posicion: data.posicion as string | undefined,
  };
}

export function subscribeToPalets(callback: (palets: PaletPendiente[]) => void): () => void {
  const q = query(collection(db, PRODUCTOS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const palets: PaletPendiente[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      if (data.estado_pedido !== 'Entregado' && data.estado_pedido !== 'En tránsito') {
        palets.push(mapProductoToPaletPendiente(data, doc.id));
      }
    });
    callback(palets);
  });
}

export function subscribeToCargas(callback: (cargas: Record<string, CargaCamion>) => void): () => void {
  const q = query(collection(db, CARGAS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const cargas: Record<string, CargaCamion> = {};
    snapshot.docs.forEach((doc) => {
      cargas[doc.id] = doc.data() as CargaCamion;
    });
    callback(cargas);
  });
}

export async function assignPaletToCamion(params: {
  matricula: string;
  palet: Omit<PaletCargado, 'asignadoEn' | 'asignadoPor'>;
  capacidad: { peso: number; volumen: number };
  email: string;
}): Promise<void> {
  const { matricula, palet, capacidad, email } = params;
  const matriculaNorm = matricula.trim().toUpperCase();

  const cargaRef = doc(db, CARGAS_COLLECTION, matriculaNorm);
  const cargaSnap = await getDoc(cargaRef);

  let paletsActuales: PaletCargado[] = [];
  if (cargaSnap.exists()) {
    paletsActuales = (cargaSnap.data() as CargaCamion).palets || [];
  }

  const yaExiste = paletsActuales.some((p) => p.docId === palet.docId);
  if (yaExiste) throw new Error('El palet ya está asignado a este camión');

  const pesoTotal = paletsActuales.reduce((sum, p) => sum + p.pesoKg, 0) + palet.pesoKg;
  const volumenTotal = paletsActuales.reduce((sum, p) => sum + p.volumenM3, 0) + palet.volumenM3;

  if (pesoTotal > capacidad.peso) throw new Error(`Excede peso máximo (${capacidad.peso} kg)`);
  if (volumenTotal > capacidad.volumen) throw new Error(`Excede volumen máximo (${capacidad.volumen} m³)`);

  const nuevoPalet: PaletCargado = {
    ...palet,
    asignadoEn: Timestamp.now(),
    asignadoPor: email,
  };

  const paletsNuevos = [...paletsActuales, nuevoPalet];

  await updateDoc(cargaRef, {
    matricula: matriculaNorm,
    palets: paletsNuevos,
    actualizadoEn: Timestamp.now(),
    actualizadoPor: email,
  });
}

export async function assignPaletsBatch(params: {
  matricula: string;
  palets: Omit<PaletCargado, 'asignadoEn' | 'asignadoPor'>[];
  email: string;
}): Promise<void> {
  const { matricula, palets, email } = params;
  const matriculaNorm = matricula.trim().toUpperCase();

  const cargaRef = doc(db, CARGAS_COLLECTION, matriculaNorm);
  const cargaSnap = await getDoc(cargaRef);

  let paletsActuales: PaletCargado[] = [];
  if (cargaSnap.exists()) {
    paletsActuales = (cargaSnap.data() as CargaCamion).palets || [];
  }

  const ahora = Timestamp.now();
  const nuevosPalets: PaletCargado[] = palets.map((p) => ({
    ...p,
    asignadoEn: ahora,
    asignadoPor: email,
  }));

  const paletsNuevos = [...paletsActuales, ...nuevosPalets];

  await updateDoc(cargaRef, {
    matricula: matriculaNorm,
    palets: paletsNuevos,
    actualizadoEn: ahora,
    actualizadoPor: email,
  });
}

export async function removePaletFromCamion(matricula: string, docId: string): Promise<void> {
  const matriculaNorm = matricula.trim().toUpperCase();
  const cargaRef = doc(db, CARGAS_COLLECTION, matriculaNorm);
  const cargaSnap = await getDoc(cargaRef);

  if (!cargaSnap.exists()) return;

  const paletsActuales = (cargaSnap.data() as CargaCamion).palets || [];
  const paletsFiltrados = paletsActuales.filter((p) => p.docId !== docId);

  await updateDoc(cargaRef, {
    palets: paletsFiltrados,
    actualizadoEn: Timestamp.now(),
  });
}

export async function vaciarCamion(matricula: string): Promise<number> {
  const matriculaNorm = matricula.trim().toUpperCase();
  const cargaRef = doc(db, CARGAS_COLLECTION, matriculaNorm);
  const cargaSnap = await getDoc(cargaRef);

  if (!cargaSnap.exists()) return 0;

  const paletsActuales = (cargaSnap.data() as CargaCamion).palets || [];
  const count = paletsActuales.length;

  await updateDoc(cargaRef, {
    palets: [],
    actualizadoEn: Timestamp.now(),
  });

  return count;
}

export function validarCarga(
  paletsActuales: PaletCargado[],
  paletNuevo: { pesoKg: number; volumenM3: number } | null,
  capacidad: { peso: number; volumen: number }
): ValidacionCarga {
  let pesoTotal = paletsActuales.reduce((sum, p) => sum + p.pesoKg, 0);
  let volumenTotal = paletsActuales.reduce((sum, p) => sum + p.volumenM3, 0);

  if (paletNuevo) {
    pesoTotal += paletNuevo.pesoKg;
    volumenTotal += paletNuevo.volumenM3;
  }

  return {
    pesoTotal,
    volumenTotal,
    excedePeso: pesoTotal > capacidad.peso,
    excedeVolumen: volumenTotal > capacidad.volumen,
  };
}

export async function iniciarRuta(params: {
  matricula: string;
  conductor: string;
  tipo: string;
  email: string;
  origen: string;
  paradas: Parada[];
}): Promise<void> {
  const { matricula, conductor, tipo, email, origen, paradas } = params;
  const matriculaNorm = matricula.trim().toUpperCase();

  const batch = writeBatch(db);

  // 1. Crear ruta
  const rutaRef = doc(collection(db, RUTAS_COLLECTION));
  const rutaData = {
    matricula: matriculaNorm,
    conductor,
    tipo,
    estado: 'en_curso' as const,
    origen,
    fechaInicio: Timestamp.now(),
    paradas: paradas.map((p) => ({
      cliente: p.cliente,
      totalPalets: p.totalPalets,
      palets: p.palets.map((pal) => ({
        docId: pal.docId,
        codigoBarra: pal.codigoBarra,
        cliente: pal.cliente,
        descripcion: pal.descripcion,
        pesoKg: pal.pesoKg,
        volumenM3: pal.volumenM3,
      })),
    })),
    creadoPor: email,
  };
  batch.set(rutaRef, rutaData);

  // 2. Mover palets de carga a ruta y actualizar estado en productos
  const cargaRef = doc(db, CARGAS_COLLECTION, matriculaNorm);
  const cargaSnap = await getDoc(cargaRef);
  if (cargaSnap.exists()) {
    const paletsCargados = (cargaSnap.data() as CargaCamion).palets || [];

    for (const palet of paletsCargados) {
      const productoRef = doc(db, PRODUCTOS_COLLECTION, palet.docId);
      batch.update(productoRef, {
        estado_pedido: 'En tránsito',
        camionRuta: matriculaNorm,
        enRutaDesde: Timestamp.now(),
      });
    }

    // Vaciar carga del camión
    batch.update(cargaRef, {
      palets: [],
      actualizadoEn: Timestamp.now(),
    });
  }

  // 3. Actualizar estado del camión
  const camionRef = doc(db, 'camiones', matriculaNorm);
  batch.update(camionRef, { estado: 'en_ruta' });

  await batch.commit();
}

export function computeParadasFromPalets(
  palets: PaletCargado[],
  ordenClientes: string[]
): Parada[] {
  const grupos = new Map<string, PaletCargado[]>();

  palets.forEach((p) => {
    const key = p.cliente;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(p);
  });

  const paradas: Parada[] = [];

  const clientesOrdenados = ordenClientes.length > 0
    ? ordenClientes.filter((c) => grupos.has(c))
    : Array.from(grupos.keys());

  clientesOrdenados.forEach((cliente) => {
    const paletsCliente = grupos.get(cliente) ?? [];
    paradas.push({
      cliente,
      totalPalets: paletsCliente.length,
      palets: paletsCliente,
    });
  });

  return paradas;
}

export async function verificarPalet(docId: string): Promise<void> {
  const productoRef = doc(db, PRODUCTOS_COLLECTION, docId);
  await updateDoc(productoRef, {
    estado_pedido: 'Codificada',
    verificadoEn: Timestamp.now(),
  });
}

export const ESTADO_EN_TRANSITO = 'En tránsito';
export const ESTADO_ENTREGADO = 'Entregado';

export async function entregarPaletEnRuta(params: {
  paletDocId: string;
  email: string;
}): Promise<void> {
  const { paletDocId, email } = params;

  const batch = writeBatch(db);

  // 1. Actualizar producto a entregado
  const productoRef = doc(db, PRODUCTOS_COLLECTION, paletDocId);
  batch.update(productoRef, {
    estado_pedido: ESTADO_ENTREGADO,
    entregadoEn: Timestamp.now(),
    entregadoPor: email,
  });

  // 2. Registrar en palets_entregados
  const productoSnap = await getDoc(productoRef);
  if (productoSnap.exists()) {
    const data = productoSnap.data() as Record<string, unknown>;
    const entregadoRef = doc(collection(db, PALETS_ENTREGADOS_COLLECTION));
    batch.set(entregadoRef, {
      matricula: (data.camionRuta as string) || '',
      codigoBarra: data.codigo_barra as string,
      cliente: (data.apellido_cliente as string) || (data.nombre_abreviado as string),
      descripcion: data.descripcion_producido_longitud as string,
      pesoKg: Number(data.peso_total_kg ?? 0),
      volumenM3: Number(data.volumen_total_m3 ?? 0),
      entregadoEn: Timestamp.now(),
      entregadoPor: email,
    });
  }

  await batch.commit();
}