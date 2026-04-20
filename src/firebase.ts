import { getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const getZones = async () => {
  const snapshot = await getDocs(collection(db, "zonas"));
  return snapshot.docs
    .filter(d => {
      const posiciones = d.data().posiciones;
      return Array.isArray(posiciones) && posiciones.every(p => typeof p === "string");
    })
    .map(d => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  descripcion: string,
  capacidadMaxima: number
) => {
  try {
    // Generar código de las primeras letras mayúsculas de cada palabra (separadas por espacios, guiones o guiones bajos)
    const codigo = zoneName
      .split(/[\s_-]+/)
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase())
      .join("");

    if (!codigo) throw new Error("El nombre no puede contener solo caracteres especiales");

    const zoneRef = doc(collection(db, "zonas"), codigo);
    await setDoc(zoneRef, {
      codigo,
      nombre: zoneName,
      tipo,
      capacidadMaxima,
      ocupacionActual: 0,
      posiciones,
      descripcion: descripcion ?? "",
      fechaCreacion: new Date(),
    });

    console.log(`✅ Zona "${zoneName}" creada con código "${codigo}" (capacidad: ${capacidadMaxima})`);
    return codigo;
  } catch (error) {
    console.error("❌ Error creando zona:", error);
    throw error;
  }
};
