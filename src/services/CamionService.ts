import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  type Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export type EstadoCamion = 'disponible' | 'en_ruta' | 'no_disponible' | 'mantenimiento';

export interface Camion {
  matricula: string;
  tipo: string;
  conductor: string;
  capacidadPeso: number;
  capacidadVolumen: number;
  estado: EstadoCamion;
}

export interface CargaCamion {
  matricula: string;
  palets: PaletCargado[];
  actualizadoEn: Timestamp;
  actualizadoPor: string;
}

export interface PaletCargado {
  docId: string;
  codigoBarra: string;
  cliente: string;
  descripcion: string;
  pesoKg: number;
  volumenM3: number;
  asignadoEn: Timestamp;
  asignadoPor: string;
}

export const ESTADOS_CAMION: { value: EstadoCamion; label: string }[] = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_ruta', label: 'En ruta' },
  { value: 'no_disponible', label: 'No disponible' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
];

export const TIPOS_CAMION = [
  'Rígido 3 ejes',
  'Rígido 4 ejes',
  'Articulado',
  'Furgoneta',
  'Plataforma',
  'Cisterna',
  'Otro',
];

const CAMIONES_COLLECTION = 'camiones';
const CARGAS_COLLECTION = 'cargas';

export function normalizeMatricula(matricula: string): string {
  return matricula.trim().toUpperCase().replace(/\s+/g, '');
}

export async function getCamiones(): Promise<Camion[]> {
  const q = query(collection(db, CAMIONES_COLLECTION), orderBy('matricula'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    matricula: doc.id,
    ...doc.data(),
  })) as Camion[];
}

export async function saveCamion(camion: Camion, options?: { isNew: boolean }): Promise<Camion> {
  const matriculaNormalizada = normalizeMatricula(camion.matricula);
  const camionRef = doc(db, CAMIONES_COLLECTION, matriculaNormalizada);

  const dataToSave = {
    tipo: camion.tipo,
    conductor: camion.conductor,
    capacidadPeso: camion.capacidadPeso,
    capacidadVolumen: camion.capacidadVolumen,
    estado: camion.estado,
  };

  if (options?.isNew) {
    await addDoc(collection(db, CAMIONES_COLLECTION), {
      ...dataToSave,
      matricula: matriculaNormalizada,
    });
  } else {
    await updateDoc(camionRef, dataToSave);
  }

  return { matricula: matriculaNormalizada, ...dataToSave };
}

export async function deleteCamion(matricula: string): Promise<void> {
  const camionRef = doc(db, CAMIONES_COLLECTION, normalizeMatricula(matricula));
  await deleteDoc(camionRef);

  const batch = writeBatch(db);
  const cargasRef = collection(db, CARGAS_COLLECTION);
  const cargasSnap = await getDocs(cargasRef);
  cargasSnap.docs.forEach((cargaDoc) => {
    if (cargaDoc.id === matriculaNormalizada) {
      batch.delete(cargaDoc.ref);
    }
  });
  await batch.commit();
}

export async function updateEstadoCamion(matricula: string, estado: EstadoCamion): Promise<void> {
  const camionRef = doc(db, CAMIONES_COLLECTION, normalizeMatricula(matricula));
  await updateDoc(camionRef, { estado });
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

export async function getCargaCamion(matricula: string): Promise<CargaCamion | null> {
  const matriculaNorm = normalizeMatricula(matricula);
  const snap = await getDocs(query(collection(db, CARGAS_COLLECTION), where('matricula', '==', matriculaNorm)));
  if (snap.empty) return null;
  return snap.docs[0].data() as CargaCamion;
}