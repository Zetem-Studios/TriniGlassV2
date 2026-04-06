import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface ZoneOccupancy {
  zoneId: string;
  zoneName: string;
  occupied: number;
  total: number;
  percentage: number;
}

export interface WarehouseStats {
  totalPalets: number;
  paletsLibres: number;
  paletsOcupados: number;
  ocupacionPorcentaje: number;
  zonas: ZoneOccupancy[];
  prioridadAlta: number;
  prioridadMedia: number;
  prioridadNormal: number;
  vidrioSimple: number;
  dobleAcristalamiento: number;
  pesoTotalKg: number;
  diasPromedioAlmacen: number;
}

const ZONE_CONFIGS: Record<string, { name: string; capacitySlots: number }> = {
  expediciones: { name: 'Expediciones', capacitySlots: 20 },
  zona_1: { name: 'Zona 1', capacitySlots: 5 },
  corte: { name: 'Corte', capacitySlots: 5 },
  cms: { name: 'CMS', capacitySlots: 12 },
  zona_2: { name: 'Zona 2', capacitySlots: 8 },
  zona_3: { name: 'Zona 3', capacitySlots: 15 },
};

const TOTAL_CAPACITY = Object.values(ZONE_CONFIGS).reduce((sum, z) => sum + z.capacitySlots, 0);

export function useWarehouseStats() {
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const productosRef = collection(db, 'productos');
        const snapshot = await getDocs(productosRef);
        const productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Conteo por zonas
        const zoneCounts: Record<string, number> = {};
        Object.keys(ZONE_CONFIGS).forEach(zoneId => {
          zoneCounts[zoneId] = 0;
        });

        let prioridadAlta = 0;
        let prioridadMedia = 0;
        let prioridadNormal = 0;
        let vidrioSimple = 0;
        let dobleAcristalamiento = 0;
        let pesoTotalKg = 0;
        let totalDias = 0;
        let productosConFecha = 0;

        productos.forEach((producto: any) => {
          // Determinar zona del producto
          const subzona = producto.subzona?.trim() || '';
          let zoneId = 'expediciones'; // default

          if (subzona) {
            if (['H', 'Mamparista'].includes(subzona)) zoneId = 'expediciones';
            else if (subzona === 'F') zoneId = 'zona_1';
            else if (subzona === 'E') zoneId = 'corte';
            else if (subzona === 'D') zoneId = 'cms';
            else if (['C', 'B'].includes(subzona)) zoneId = 'zona_2';
            else if (['A', '??'].includes(subzona)) zoneId = 'zona_3';
          }

          zoneCounts[zoneId] = (zoneCounts[zoneId] || 0) + 1;

          // Calcular días en almacén
          if (producto.fecha_linea_pedido) {
            const fechaPedido = parseFecha(producto.fecha_linea_pedido);
            if (fechaPedido) {
              const dias = Math.max(0, Math.floor((Date.now() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24)));
              totalDias += dias;
              productosConFecha++;

              if (dias > 30) prioridadAlta++;
              else if (dias > 20) prioridadMedia++;
              else prioridadNormal++;
            } else {
              prioridadNormal++;
            }
          } else {
            prioridadNormal++;
          }

          // Tipo de vidrio
          if (producto.vidrio_simple) {
            vidrioSimple++;
          } else {
            dobleAcristalamiento++;
          }

          // Peso
          pesoTotalKg += Number(producto.peso_total_kg) || 0;
        });

        // Calcular ocupación por zona
        const zonas: ZoneOccupancy[] = Object.entries(ZONE_CONFIGS).map(([zoneId, config]) => {
          const occupied = zoneCounts[zoneId] || 0;
          return {
            zoneId,
            zoneName: config.name,
            occupied,
            total: config.capacitySlots,
            percentage: Math.min(100, Math.round((occupied / config.capacitySlots) * 100)),
          };
        });

        const totalOcupados = productos.length;
        const totalLibres = Math.max(0, TOTAL_CAPACITY - totalOcupados);

        setStats({
          totalPalets: TOTAL_CAPACITY,
          paletsLibres: totalLibres,
          paletsOcupados: totalOcupados,
          ocupacionPorcentaje: Math.min(100, Math.round((totalOcupados / TOTAL_CAPACITY) * 100)),
          zonas,
          prioridadAlta,
          prioridadMedia,
          prioridadNormal,
          vidrioSimple,
          dobleAcristalamiento,
          pesoTotalKg: Math.round(pesoTotalKg),
          diasPromedioAlmacen: productosConFecha > 0 ? Math.round(totalDias / productosConFecha) : 0,
        });
      } catch (err) {
        console.error('Error fetching warehouse stats:', err);
        setError('Error al cargar estadísticas del almacén');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

function parseFecha(fecha: any): Date | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === 'object' && fecha.toDate instanceof Function) return fecha.toDate();

  if (typeof fecha !== 'string') {
    const parsed = Date.parse(String(fecha));
    return isNaN(parsed) ? null : new Date(parsed);
  }

  const normalized = fecha.replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ').replace(/\s+/g, ' ').trim();

  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  const match = normalized.match(/(\d{1,2}) de (\w+) de (\d{4}) a las (\d{1,2}:\d{2}:\d{2})\s*([ap]\.m\.)\s*UTC\s*([+-]?\d+)/i);
  if (match) {
    const [, diaStr, mesStr, yearStr, horaStr, ampm, tz] = match;
    const dia = Number(diaStr);
    const mes = meses[mesStr.toLowerCase()];
    const year = Number(yearStr);
    if (mes === undefined || isNaN(dia) || isNaN(year)) return null;

    let [hora, minuto, segundo] = horaStr.split(':').map(Number);
    if ([hora, minuto, segundo].some(isNaN)) return null;

    const ampmNorm = ampm.toLowerCase().replace(/\./g, '').trim();
    if ((ampmNorm === 'p' || ampmNorm === 'pm') && hora < 12) hora += 12;
    if ((ampmNorm === 'a' || ampmNorm === 'am') && hora === 12) hora = 0;

    const offset = Number(tz);
    if (isNaN(offset)) return null;

    const utcMillis = Date.UTC(year, mes, dia, hora, minuto, segundo) - offset * 3600 * 1000;
    return new Date(utcMillis);
  }

  const parsed = Date.parse(normalized.replace('UTC', 'GMT'));
  return isNaN(parsed) ? null : new Date(parsed);
}
