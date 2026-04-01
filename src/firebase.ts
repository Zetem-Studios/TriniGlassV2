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
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
};

// Crear zona
export const createCompleteZone = async (
  zoneId: string,
  zoneName: string,
  type: "produccion" | "almacenamiento" | "expedicion",
  layout: "horizontal" | "vertical",
  positions: Array<{ name: string; locations: number }>
) => {
  try {
    const totalCapacity = positions.reduce((sum, p) => sum + p.locations, 0);

    const zoneRef = doc(collection(db, "zonas"), zoneId);
    await setDoc(zoneRef, {
      codigo: zoneId,
      nombre: zoneName,
      capacidadMaxima: totalCapacity,
      tipo: type,
      layout: layout,
      ocupacionActual: 0,
      posiciones: positions.map(p => ({ nombre: p.name, ubicaciones: p.locations })),
      fechaCreacion: new Date(),
    });

    console.log(`✅ Zona "${zoneName}" creada con ${positions.length} posiciones`);
    return true;
  } catch (error) {
    console.error("❌ Error creando zona:", error);
    throw error;
  }
};
