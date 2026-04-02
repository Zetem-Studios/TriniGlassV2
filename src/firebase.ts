import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc } from "firebase/firestore";

// Mapeo de grid positions por zona y subzona (para compatibilidad con visualización)
const GRID_POSITIONS: { [key: string]: { [key: string]: string[] } } = {
  expediciones: {
    H: ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5'],
    Mamparista: ['D1','D2','D3','D4','D5','E1','E2','E3','E4','E5']
  },
  zona_1: {
    F: ['A5']
  },
  corte: {
    E: ['A4']
  },
  cms: {
    D: ['A1','A2','A3','A4','B1','B2','B3','B4']
  },
  zona_2: {
    C: ['A5'],
    B: ['E5']
  },
  zona_3: {
    A: ['A1','A2','A3','B1','B2','B3','C1','C2','C3'],
    '??': ['A6','B6']
  }
};

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
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.nombre ?? data.name,
      subzones: data.subzones ?? {},
      layout: data.layout ?? "horizontal"
    };
  });
};

// Crear zona con subzones (estructura compatible con visualización del compañero)
export const createCompleteZone = async (
  zoneId: string,
  zoneName: string,
  type: "produccion" | "almacenamiento" | "expedicion",
  layout: "horizontal" | "vertical",
  positions: Array<{ name: string; locations: number }>
) => {
  try {
    // Buscar grid positions en el mapeo, o generar IDs simples si no existen
    const zoneGrids = GRID_POSITIONS[zoneId] || {};
    const subzones: { [key: string]: string[] } = {};
    
    positions.forEach(pos => {
      const gridPositions = zoneGrids[pos.name] || Array.from({ length: pos.locations }, (_, i) => `${pos.name}-${i + 1}`);
      subzones[pos.name] = gridPositions;
    });

    const zoneRef = doc(collection(db, "zonas"), zoneId);
    await setDoc(zoneRef, {
      codigo: zoneId,
      nombre: zoneName,
      tipo: type,
      layout: layout,
      subzones: subzones,
      fechaCreacion: new Date(),
    });

    console.log(`✅ Zona "${zoneName}" creada con ${positions.length} subzonas`);
    return true;
  } catch (error) {
    console.error("❌ Error creando zona:", error);
    throw error;
  }
};
