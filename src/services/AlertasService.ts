import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AlertaUbicacion {
  id: string;
  paletDocId: string;
  codigoBarra: string;
  cliente: string;
  ubicacionEsperada: string;
  ubicacionActual?: string;
  reportadoPor: string;
  creadaEn: Timestamp;
  creadaEnIso: string;
  resuelta: boolean;
  resueltaEn?: Timestamp;
  resueltaPor?: string;
}

const ALERTAS_COLECTION = 'alertas_ubicacion';

export async function obtenerAlertasUbicacion(): Promise<AlertaUbicacion[]> {
  const q = query(
    collection(db, ALERTAS_COLECTION),
    where('resuelta', '==', false),
    orderBy('creadaEn', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AlertaUbicacion[];
}

export async function crearAlertaUbicacion(params: {
  paletDocId: string;
  codigoBarra: string;
  cliente: string;
  ubicacionEsperada: string;
  reportadoPor: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const alertaData = {
    ...params,
    creadaEn: ahora,
    creadaEnIso: ahora.toDate().toISOString(),
    resuelta: false,
  };

  const docRef = await addDoc(collection(db, ALERTAS_COLECTION), alertaData);
  return docRef.id;
}

export async function resolverAlertaUbicacion(id: string): Promise<void> {
  const alertaRef = doc(db, ALERTAS_COLECTION, id);
  await updateDoc(alertaRef, {
    resuelta: true,
    resueltaEn: Timestamp.now(),
  });
}

export async function getAlertaById(id: string): Promise<AlertaUbicacion | null> {
  const snap = await getDocs(query(collection(db, ALERTAS_COLECTION), where('__name__', '==', id)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as AlertaUbicacion;
}

export async function obtenerTodasAlertas(): Promise<AlertaUbicacion[]> {
  const q = query(collection(db, ALERTAS_COLECTION), orderBy('creadaEn', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AlertaUbicacion[];
}