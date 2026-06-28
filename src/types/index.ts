import type { Timestamp } from 'firebase/firestore';

export type EstadoCamion = 'disponible' | 'en_ruta' | 'no_disponible' | 'mantenimiento';

export interface Camion {
  matricula: string;
  tipo: string;
  conductor: string;
  capacidadPeso: number;
  capacidadVolumen: number;
  estado: EstadoCamion;
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

export interface CargaCamion {
  matricula: string;
  palets: PaletCargado[];
  actualizadoEn: Timestamp;
  actualizadoPor: string;
}

export interface Zona {
  id: string;
  nombre: string;
  tipo: 'produccion' | 'almacenamiento' | 'expedicion';
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

export interface Block {
  id: string;
  codigo_barra?: string;
  zoneId?: string;
  area?: string;
  type?: string;
  daysInStorage?: number;
  client?: string;
  occupied?: boolean;
  dimensions?: string;
  weight?: string;
  priority?: string;
  lastUpdate?: string;
  numeroCliente?: string;
  numeroLineaPedido?: string;
  estadoPedido?: string;
  empresa?: string;
  fila?: number;
  [key: string]: unknown;
}
