import { useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface EntregasPorDia {
  date: string; // ISO yyyy-mm-dd
  label: string; // ej. "Lun 13"
  entregas: number;
}

export interface EntregasPorCamion {
  matricula: string;
  entregas: number;
}

export interface FleetStats {
  totalCamiones: number;
  camionesDisponibles: number;
  camionesEnRuta: number;
  camionesNoDisponibles: number;
  camionesMantenimiento: number;
  rutasEnCurso: number;
  rutasFinalizadasTotal: number;
  rutasFinalizadasUltimos7Dias: number;
  paletsEnCarga: number;
  paletsEntregadosHoy: number;
  paletsEntregadosUltimos7Dias: number;
  paletsEntregadosTotal: number;
  pesoEntregadoTotalKg: number;
  duracionMediaMinutos: number;
  utilizacionMediaPesoPct: number;
  utilizacionMediaVolumenPct: number;
  entregasPorDia: EntregasPorDia[];
  topCamiones: EntregasPorCamion[];
}

const tsToDate = (raw: unknown): Date | null => {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return isNaN(parsed) ? null : new Date(parsed);
  }
  if (typeof raw === 'object' && 'toDate' in (raw)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (raw as any).toDate();
      return d instanceof Date ? d : null;
    } catch {
      return null;
    }
  }
  return null;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatDayLabel = (d: Date) => {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dias[d.getDay()]} ${d.getDate()}`;
};

const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface CamionDoc {
  matricula?: string;
  estado?: string;
  capacidadPeso?: number;
  capacidadVolumen?: number;
}

interface CargaDoc {
  palets?: { pesoKg?: number; volumenM3?: number }[];
}

interface RutaDoc {
  matricula?: string;
  estado?: 'en_curso' | 'finalizada';
  fechaInicio?: unknown;
  fechaFin?: unknown;
  totalEntregados?: number;
  pesoEntregadoKg?: number;
  pesoTotalKg?: number;
}

interface PaletEntregadoDoc {
  matricula?: string;
  pesoKg?: number;
  entregadoEn?: unknown;
}

export function useFleetStats() {
  const [camiones, setCamiones] = useState<Record<string, CamionDoc>>({});
  const [cargas, setCargas] = useState<Record<string, CargaDoc>>({});
  const [rutas, setRutas] = useState<RutaDoc[]>([]);
  const [entregados, setEntregados] = useState<PaletEntregadoDoc[]>([]);
  const [readiness, setReadiness] = useState({
    camiones: false,
    cargas: false,
    rutas: false,
    entregados: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const unsubCamiones = onSnapshot(
      collection(db, 'camiones'),
      snap => {
        const map: Record<string, CamionDoc> = {};
        snap.docs.forEach(d => {
          map[d.id] = d.data();
        });
        setCamiones(map);
        setReadiness(r => ({ ...r, camiones: true }));
      },
      err => {
        console.error('camiones:', err);
        setError('Error al cargar camiones');
      }
    );
    const unsubCargas = onSnapshot(
      collection(db, 'cargas'),
      snap => {
        const map: Record<string, CargaDoc> = {};
        snap.docs.forEach(d => {
          map[d.id] = d.data();
        });
        setCargas(map);
        setReadiness(r => ({ ...r, cargas: true }));
      },
      err => {
        console.error('cargas:', err);
        setError('Error al cargar cargas');
      }
    );
    const unsubRutas = onSnapshot(
      collection(db, 'rutas'),
      snap => {
        setRutas(snap.docs.map(d => d.data() as RutaDoc));
        setReadiness(r => ({ ...r, rutas: true }));
      },
      err => {
        console.error('rutas:', err);
        setReadiness(r => ({ ...r, rutas: true }));
      }
    );
    const unsubEntregados = onSnapshot(
      collection(db, 'palets_entregados'),
      snap => {
        setEntregados(snap.docs.map(d => d.data() as PaletEntregadoDoc));
        setReadiness(r => ({ ...r, entregados: true }));
      },
      err => {
        console.error('palets_entregados:', err);
        setReadiness(r => ({ ...r, entregados: true }));
      }
    );

    return () => {
      unsubCamiones();
      unsubCargas();
      unsubRutas();
      unsubEntregados();
    };
  }, []);

  const loading = !readiness.camiones || !readiness.cargas || !readiness.rutas || !readiness.entregados;

  const stats: FleetStats | null = (() => {
    if (loading) return null;

    const camionesList = Object.values(camiones);
    let camionesDisponibles = 0;
    let camionesEnRuta = 0;
    let camionesNoDisponibles = 0;
    let camionesMantenimiento = 0;
    camionesList.forEach(c => {
      switch (c.estado) {
        case 'disponible':
          camionesDisponibles++;
          break;
        case 'en_ruta':
          camionesEnRuta++;
          break;
        case 'no_disponible':
          camionesNoDisponibles++;
          break;
        case 'mantenimiento':
          camionesMantenimiento++;
          break;
      }
    });

    let paletsEnCarga = 0;
    Object.values(cargas).forEach(c => {
      paletsEnCarga += c.palets?.length ?? 0;
    });

    const ahora = new Date();
    const hoy = startOfDay(ahora);
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 6); // últimos 7 días incluyendo hoy

    let paletsEntregadosHoy = 0;
    let paletsEntregadosUltimos7Dias = 0;
    let pesoEntregadoTotalKg = 0;
    const entregasMatriculaCount = new Map<string, number>();
    const entregasPorDiaMap = new Map<string, number>();

    // pre-llenar últimos 7 días con 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7);
      d.setDate(hace7.getDate() + i);
      entregasPorDiaMap.set(isoDay(d), 0);
    }

    entregados.forEach(e => {
      pesoEntregadoTotalKg += Number(e.pesoKg ?? 0);
      const fecha = tsToDate(e.entregadoEn);
      if (fecha) {
        const dayStart = startOfDay(fecha);
        if (dayStart.getTime() === hoy.getTime()) paletsEntregadosHoy++;
        if (dayStart.getTime() >= hace7.getTime()) {
          paletsEntregadosUltimos7Dias++;
          const key = isoDay(dayStart);
          if (entregasPorDiaMap.has(key)) {
            entregasPorDiaMap.set(key, (entregasPorDiaMap.get(key) ?? 0) + 1);
          }
        }
      }
      if (e.matricula) {
        entregasMatriculaCount.set(
          e.matricula,
          (entregasMatriculaCount.get(e.matricula) ?? 0) + 1
        );
      }
    });

    const entregasPorDia: EntregasPorDia[] = Array.from(entregasPorDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, entregas]) => {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return { date: iso, label: formatDayLabel(date), entregas };
      });

    const topCamiones: EntregasPorCamion[] = Array.from(entregasMatriculaCount.entries())
      .map(([matricula, entregas]) => ({ matricula, entregas }))
      .sort((a, b) => b.entregas - a.entregas)
      .slice(0, 5);

    let rutasEnCurso = 0;
    let rutasFinalizadasTotal = 0;
    let rutasFinalizadasUltimos7Dias = 0;
    let duracionAcumMs = 0;
    let rutasConDuracion = 0;
    let utilPesoAcumPct = 0;
    let utilVolumenAcumPct = 0;
    let utilMuestras = 0;

    rutas.forEach(r => {
      if (r.estado === 'en_curso') rutasEnCurso++;
      else if (r.estado === 'finalizada') {
        rutasFinalizadasTotal++;
        const fin = tsToDate(r.fechaFin);
        const inicio = tsToDate(r.fechaInicio);
        if (fin && startOfDay(fin).getTime() >= hace7.getTime()) {
          rutasFinalizadasUltimos7Dias++;
        }
        if (fin && inicio) {
          duracionAcumMs += fin.getTime() - inicio.getTime();
          rutasConDuracion++;
        }
        // utilización: peso/volumen total al iniciar la ruta vs capacidad del camión
        const camion = r.matricula ? camiones[r.matricula] : undefined;
        const capPeso = Number(camion?.capacidadPeso ?? 0);
        const capVol = Number(camion?.capacidadVolumen ?? 0);
        const pesoRuta = Number(r.pesoTotalKg ?? r.pesoEntregadoKg ?? 0);
        if (capPeso > 0 && pesoRuta > 0) {
          utilPesoAcumPct += Math.min(100, (pesoRuta / capPeso) * 100);
          utilMuestras++;
        }
        if (capVol > 0) {
          // si la ruta no llevaba volumen guardado lo aproximamos a 0 (no penaliza)
          // pero solo contamos cuando hay muestras del peso para consistencia
        }
        if (capVol > 0 && pesoRuta > 0) {
          // se necesitaría volumenTotalM3 en la ruta — si no existe, se omite
          // (la ruta guarda pesoTotalKg/volumenTotalM3 desde iniciarRuta)
          const vol = Number((r as unknown as { volumenTotalM3?: number }).volumenTotalM3 ?? 0);
          if (vol > 0) {
            utilVolumenAcumPct += Math.min(100, (vol / capVol) * 100);
          }
        }
      }
    });

    return {
      totalCamiones: camionesList.length,
      camionesDisponibles,
      camionesEnRuta,
      camionesNoDisponibles,
      camionesMantenimiento,
      rutasEnCurso,
      rutasFinalizadasTotal,
      rutasFinalizadasUltimos7Dias,
      paletsEnCarga,
      paletsEntregadosHoy,
      paletsEntregadosUltimos7Dias,
      paletsEntregadosTotal: entregados.length,
      pesoEntregadoTotalKg: Math.round(pesoEntregadoTotalKg),
      duracionMediaMinutos:
        rutasConDuracion > 0 ? Math.round(duracionAcumMs / rutasConDuracion / 60000) : 0,
      utilizacionMediaPesoPct:
        utilMuestras > 0 ? Math.round(utilPesoAcumPct / utilMuestras) : 0,
      utilizacionMediaVolumenPct:
        utilMuestras > 0 ? Math.round(utilVolumenAcumPct / utilMuestras) : 0,
      entregasPorDia,
      topCamiones,
    };
  })();

  return { stats, loading, error };
}
