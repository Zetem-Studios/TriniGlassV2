import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface MapDesign {
  id?: string;
  name: string;
  description?: string;
  areas: AreaData[];
  gridBounds: GridBounds;
  gridSize: GridSize;
  activo?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AreaData {
  id: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  subAreas: SubAreaData[];
}

export interface SubAreaData {
  id: string;
  name: string;
  col: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  areaId: string;
}

export interface GridBounds {
  startCol: string;
  endCol: string;
  startRow: number;
  endRow: number;
}

export interface GridSize {
  cellWidth: number;
  cellHeight: number;
}

class MapDesignsService {
  private collection = 'mapDesigns';

  // Guardar un nuevo diseño
  async saveDesign(design: Omit<MapDesign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const designData = {
        ...design,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, this.collection), designData);
      return docRef.id;
    } catch (error) {
      console.error('Error al guardar diseño:', error);
      throw error;
    }
  }

  // Actualizar un diseño existente
  async updateDesign(id: string, design: Partial<Omit<MapDesign, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const designRef = doc(db, this.collection, id);
      const updateData = {
        ...design,
        updatedAt: Timestamp.now()
      };

      await updateDoc(designRef, updateData);
    } catch (error) {
      console.error('Error al actualizar diseño:', error);
      throw error;
    }
  }

  // Obtener un diseño por ID
  async getDesign(id: string): Promise<MapDesign | null> {
    try {
      const designRef = doc(db, this.collection, id);
      const designSnap = await getDoc(designRef);

      if (designSnap.exists()) {
        return {
          id: designSnap.id,
          ...designSnap.data()
        } as MapDesign;
      }

      return null;
    } catch (error) {
      console.error('Error al obtener diseño:', error);
      throw error;
    }
  }

  // Obtener todos los diseños
  async getAllDesigns(): Promise<MapDesign[]> {
    try {
      const q = query(collection(db, this.collection), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const designs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MapDesign[];
      
      return designs;
    } catch (error) {
      console.error('Error al obtener diseños:', error);
      throw error;
    }
  }

  // Eliminar un diseño
  async deleteDesign(id: string): Promise<void> {
    try {
      const designRef = doc(db, this.collection, id);
      await deleteDoc(designRef);
    } catch (error) {
      console.error('Error al eliminar diseño:', error);
      throw error;
    }
  }

  // Verificar si un nombre ya existe
  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    try {
      const designs = await this.getAllDesigns();
      const exists = designs.some(design =>
        design.name.toLowerCase() === name.toLowerCase() && design.id !== excludeId
      );
      return exists;
    } catch (error) {
      console.error('Error al verificar nombre:', error);
      return false;
    }
  }
}

export const mapDesignsService = new MapDesignsService();