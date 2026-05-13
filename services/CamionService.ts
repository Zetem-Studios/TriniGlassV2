import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../src/firebase";

export type EstadoCamion =
  | "disponible"
  | "en_ruta"
  | "no_disponible"
  | "mantenimiento";

export const ESTADOS_CAMION: { value: EstadoCamion; label: string }[] = [
  { value: "disponible", label: "Disponible" },
  { value: "en_ruta", label: "En ruta" },
  { value: "no_disponible", label: "No disponible" },
  { value: "mantenimiento", label: "En mantenimiento" },
];

export const TIPOS_CAMION = [
  "Furgoneta",
  "Camión rígido",
  "Camión articulado",
  "Tráiler",
  "Plataforma",
] as const;

export type TipoCamion = (typeof TIPOS_CAMION)[number];

export interface Camion {
  matricula: string;
  tipo: TipoCamion | string;
  conductor: string;
  capacidadPeso: number;
  capacidadVolumen: number;
  estado: EstadoCamion;
}

const COLLECTION = "camiones";

const MATRICULA_REGEX = /^[A-Z0-9-]{4,12}$/;

export const normalizeMatricula = (matricula: string) =>
  matricula.trim().toUpperCase().replace(/\s+/g, "");

export const validateCamion = (data: Camion): string | null => {
  const matricula = normalizeMatricula(data.matricula);
  if (!matricula) return "La matrícula es obligatoria";
  if (!MATRICULA_REGEX.test(matricula))
    return "La matrícula solo admite letras, números y guiones (4-12 caracteres)";
  if (!data.tipo?.trim()) return "El tipo de camión es obligatorio";
  if (!data.conductor?.trim()) return "El conductor es obligatorio";
  if (!Number.isFinite(data.capacidadPeso) || data.capacidadPeso <= 0)
    return "La capacidad de peso debe ser mayor que 0";
  if (!Number.isFinite(data.capacidadVolumen) || data.capacidadVolumen <= 0)
    return "La capacidad de volumen debe ser mayor que 0";
  if (!data.estado) return "El estado es obligatorio";
  return null;
};

const ESTADOS_VALIDOS: ReadonlySet<EstadoCamion> = new Set([
  "disponible",
  "en_ruta",
  "no_disponible",
  "mantenimiento",
]);

const normalizeEstado = (raw: unknown): EstadoCamion => {
  if (typeof raw === "string" && ESTADOS_VALIDOS.has(raw as EstadoCamion)) {
    return raw as EstadoCamion;
  }
  return "disponible";
};

export const getCamiones = async (): Promise<Camion[]> => {
  const q = query(collection(db, COLLECTION), orderBy("matricula"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as Partial<Camion>;
    return {
      matricula: data.matricula ?? d.id,
      tipo: data.tipo ?? "",
      conductor: data.conductor ?? "",
      capacidadPeso: Number(data.capacidadPeso ?? 0),
      capacidadVolumen: Number(data.capacidadVolumen ?? 0),
      estado: normalizeEstado(data.estado),
    };
  });
};

export const saveCamion = async (
  data: Camion,
  { isNew }: { isNew: boolean }
): Promise<Camion> => {
  const error = validateCamion(data);
  if (error) throw new Error(error);

  const matricula = normalizeMatricula(data.matricula);
  const ref = doc(db, COLLECTION, matricula);

  await setDoc(
    ref,
    {
      matricula,
      tipo: data.tipo.trim(),
      conductor: data.conductor.trim(),
      capacidadPeso: Number(data.capacidadPeso),
      capacidadVolumen: Number(data.capacidadVolumen),
      estado: data.estado,
      ...(isNew ? { creadoEn: serverTimestamp() } : {}),
      actualizadoEn: serverTimestamp(),
    },
    { merge: !isNew }
  );

  return { ...data, matricula };
};

export const deleteCamion = async (matricula: string): Promise<void> => {
  const id = normalizeMatricula(matricula);
  await deleteDoc(doc(db, COLLECTION, id));
};

export const updateEstadoCamion = async (
  matricula: string,
  estado: EstadoCamion
): Promise<void> => {
  const id = normalizeMatricula(matricula);
  await setDoc(
    doc(db, COLLECTION, id),
    {
      estado,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};
