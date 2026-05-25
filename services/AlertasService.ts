import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../src/firebase";

const ALERTAS_UBICACION = "alertas_ubicacion";

export interface AlertaUbicacion {
  id: string;
  paletDocId: string;
  codigoBarra: string;
  cliente: string;
  ubicacionEsperada: string;
  reportadoPor: string;
  creadaEnIso: string;
}

export interface CrearAlertaUbicacionParams {
  paletDocId: string;
  codigoBarra: string;
  cliente: string;
  ubicacionEsperada: string;
  reportadoPor?: string;
}

/**
 * Registra una alerta de palet mal colocado. Se usa el docId del palet como id
 * del documento para que escanear el mismo palet varias veces no genere alertas
 * duplicadas (la última simplemente actualiza la existente).
 */
export const crearAlertaUbicacion = async ({
  paletDocId,
  codigoBarra,
  cliente,
  ubicacionEsperada,
  reportadoPor = "anónimo",
}: CrearAlertaUbicacionParams): Promise<void> => {
  await setDoc(doc(db, ALERTAS_UBICACION, paletDocId), {
    paletDocId,
    codigoBarra,
    cliente,
    ubicacionEsperada,
    reportadoPor,
    creadaEn: serverTimestamp(),
    creadaEnIso: new Date().toISOString(),
  });
};

export const obtenerAlertasUbicacion = async (): Promise<AlertaUbicacion[]> => {
  const snapshot = await getDocs(collection(db, ALERTAS_UBICACION));
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        paletDocId: String(data.paletDocId ?? d.id),
        codigoBarra: String(data.codigoBarra ?? ""),
        cliente: String(data.cliente ?? "Cliente desconocido"),
        ubicacionEsperada: String(data.ubicacionEsperada ?? "Sin ubicación"),
        reportadoPor: String(data.reportadoPor ?? "anónimo"),
        creadaEnIso: String(data.creadaEnIso ?? ""),
      };
    })
    .sort((a, b) => b.creadaEnIso.localeCompare(a.creadaEnIso));
};

/** Marca la alerta como resuelta eliminándola: el palet ya está en su sitio. */
export const resolverAlertaUbicacion = async (alertaId: string): Promise<void> => {
  await deleteDoc(doc(db, ALERTAS_UBICACION, alertaId));
};
