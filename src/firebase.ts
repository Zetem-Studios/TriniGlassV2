import { getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, getDoc, Timestamp, writeBatch } from "firebase/firestore";

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

// Nueva función para obtener estructura jerárquica de zonas/subzonas para el editor de mapas
export const getZonesHierarchy = async () => {
  const snapshot = await getDocs(collection(db, "zonas"));
  const zones = snapshot.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.nombre ?? data.name,
      posiciones: data.posiciones as string[],
      subzones: data.subzones ?? {},
    };
  });

  // Construir jerarquía: cada documento es una "zona" y sus subzonas están en subzones
  const hierarchy: Array<{
    zoneId: string;
    zoneName: string;
    subzones: Array<{
      subzoneId: string;
      subzoneName: string;
      positions: string[];
    }>;
  }> = [];

  zones.forEach(zone => {
    const subzoneEntries = Object.entries(zone.subzones || {});
    const subzonesList = subzoneEntries.map(([subzoneId, positions]) => ({
      subzoneId,
      subzoneName: subzoneId, // Usamos el ID como nombre (H, Mamparista, etc.)
      positions: Array.isArray(positions) ? positions : []
    }));

    hierarchy.push({
      zoneId: zone.id,
      zoneName: zone.name,
      subzones: subzonesList
    });
  });

  return hierarchy;
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

// Interfaces para las nuevas colecciones
export interface Zona {
  id: string;
  nombre: string;
  tipo: "produccion" | "almacenamiento" | "expedicion";
  descripcion?: string;
  capacidadMaxima: number;
  fechaCreacion: Timestamp;
  activa: boolean;
}

export interface Subzona {
  id: string;
  nombre: string;
  zonaId: string;
  posiciones: string[];
  capacidadMaxima: number;
  color?: string;
  activa: boolean;
  fechaCreacion: Timestamp;
}

// Funciones CRUD para Zonas
export const createZona = async (zona: Omit<Zona, 'id' | 'fechaCreacion'>): Promise<string> => {
  try {
    const zonaData = {
      ...zona,
      fechaCreacion: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, "zonas"), zonaData);
    console.log("✅ Zona creada con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error creando zona:", error);
    throw error;
  }
};

export const getZonasNew = async (): Promise<Zona[]> => {
  try {
    const snapshot = await getDocs(collection(db, "zonas"));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Zona[];
  } catch (error: any) {
    console.error("❌ Error obteniendo zonas:", error);
    // Si la colección no existe, devolver array vacío en lugar de lanzar error
    if (error.message && error.message.includes('permission-denied')) {
      throw error; // Permisos denegados sí es un error crítico
    }
    return []; // Para cualquier otro error (como colección inexistente), devolver vacío
  }
};

export const updateZona = async (id: string, zona: Partial<Zona>): Promise<void> => {
  try {
    const zonaRef = doc(db, "zonas", id);
    await updateDoc(zonaRef, zona);
    console.log("✅ Zona actualizada:", id);
  } catch (error) {
    console.error("❌ Error actualizando zona:", error);
    throw error;
  }
};

export const deleteZona = async (id: string): Promise<void> => {
  try {
    // Primero eliminar todas las subzonas asociadas
    const subzonasSnapshot = await getDocs(collection(db, "subzonas"));
    const subzonasToDelete = subzonasSnapshot.docs.filter(doc => doc.data().zonaId === id);
    
    await Promise.all(subzonasToDelete.map(doc => deleteDoc(doc.ref)));
    
    // Luego eliminar la zona
    await deleteDoc(doc(db, "zonas", id));
    console.log("✅ Zona eliminada:", id);
  } catch (error) {
    console.error("❌ Error eliminando zona:", error);
    throw error;
  }
};

// Funciones CRUD para Subzonas
export const createSubzona = async (subzona: Omit<Subzona, 'id' | 'fechaCreacion'>): Promise<string> => {
  try {
    const subzonaData = {
      ...subzona,
      fechaCreacion: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, "subzonas"), subzonaData);
    console.log("✅ Subzona creada con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error creando subzona:", error);
    throw error;
  }
};

export const getSubzonas = async (): Promise<Subzona[]> => {
  try {
    const snapshot = await getDocs(collection(db, "subzonas"));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Subzona[];
  } catch (error: any) {
    console.error("❌ Error obteniendo subzonas:", error);
    // Si la colección no existe, devolver array vacío en lugar de lanzar error
    if (error.message && error.message.includes('permission-denied')) {
      throw error; // Permisos denegados sí es un error crítico
    }
    return []; // Para cualquier otro error (como colección inexistente), devolver vacío
  }
};

export const getSubzonasByZona = async (zonaId: string): Promise<Subzona[]> => {
  try {
    const snapshot = await getDocs(collection(db, "subzonas"));
    return snapshot.docs
      .filter(doc => doc.data().zonaId === zonaId)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subzona[];
  } catch (error) {
    console.error("❌ Error obteniendo subzonas de zona:", error);
    throw error;
  }
};

export const updateSubzona = async (id: string, subzona: Partial<Subzona>): Promise<void> => {
  try {
    const subzonaRef = doc(db, "subzonas", id);
    await updateDoc(subzonaRef, subzona);
    console.log("✅ Subzona actualizada:", id);
  } catch (error) {
    console.error("❌ Error actualizando subzona:", error);
    throw error;
  }
};

export const deleteSubzona = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "subzonas", id));
    console.log("✅ Subzona eliminada:", id);
  } catch (error) {
    console.error("❌ Error eliminando subzona:", error);
    throw error;
  }
};

// Exportar funciones de Firestore para uso en scripts
export { collection, doc, getDocs, setDoc, Timestamp, writeBatch };

// Función para obtener la jerarquía completa (zonas con sus subzonas)
export const getZonasWithSubzonas = async (): Promise<(Zona & { subzonas: Subzona[] })[]> => {
  try {
    const zonas = await getZonasNew();
    const subzonas = await getSubzonas();
    
    return zonas.map(zona => ({
      ...zona,
      subzonas: subzonas.filter(subzona => subzona.zonaId === zona.id)
    }));
  } catch (error) {
    console.error("❌ Error obteniendo jerarquía de zonas:", error);
    throw error;
  }
};
