

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const getZones = async () => {
  const snapshot = await getDocs(collection(db, "zonas"));
  return snapshot.docs
    .filter(d => {
      const posiciones = d.data().posiciones;
      return Array.isArray(posiciones) && posiciones.every(p => typeof p === "string");
    })
    .map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.nombre ?? data.name,
        posiciones: data.posiciones as string[],
        subzones: data.subzones ?? {},
      };
    });
};

// Crear zona 
export const createCompleteZone = async (
  zoneName: string,
  tipo: "produccion" | "almacenamiento" | "expedicion",
  posiciones: string[],
  descripcion?: string
) => {
  try {
    const codigo = zoneName
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");

    if (!codigo) throw new Error("El nombre no puede contener solo caracteres especiales");

    const zoneRef = doc(collection(db, "zonas"), codigo);
    await setDoc(zoneRef, {
      codigo,
      nombre: zoneName,
      tipo,
      capacidadMaxima: posiciones.length,
      ocupacionActual: posiciones.length,
      posiciones,
      descripcion: descripcion ?? "",
      fechaCreacion: new Date(),
    });

    console.log(`✅ Zona "${zoneName}" creada (${posiciones.length} posiciones)`);
    return codigo;
  } catch (error) {
    console.error("❌ Error creando zona:", error);
    throw error;
  }
};
