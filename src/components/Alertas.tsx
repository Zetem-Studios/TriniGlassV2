import { useState, useEffect } from "react";
import { AlertTriangle, Clock, MapPin, User, Package } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface PaletAlerta {
  id: string;
  client: string;
  zone: string;
  dimensions: string;
  weight: string;
  daysInStorage: number;
  fechaPedido: string;
}

const parseFecha = (fecha: unknown): Date | null => {
  if (!fecha) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = fecha as any;
  if (fecha instanceof Date) return fecha;
  if (typeof any.toDate === "function") return any.toDate();
  const parsed = Date.parse(String(fecha));
  return isNaN(parsed) ? null : new Date(parsed);
};

export default function Alertas() {
  const [alertas, setAlertas] = useState<PaletAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const snapshot = await getDocs(collection(db, "productos"));
        const hoy = new Date();
        const resultado: PaletAlerta[] = [];

        snapshot.docs.forEach((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = doc.data() as any;
          const fechaPedido = parseFecha(data.fecha_linea_pedido);
          if (!fechaPedido) return;

          const daysInStorage = Math.max(
            0,
            Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24))
          );

          if (daysInStorage > 30) {
            resultado.push({
              id: data.codigo_barra || data.numero_linea_pedido || doc.id,
              client: data.apellido_cliente || data.nombre_abreviado || "Cliente desconocido",
              zone: data.subzona ? String(data.subzona) : "Sin zona",
              dimensions: `${data.altura || 0} x ${data.longitud || 0} mm`,
              weight: `${data.peso_total_kg || 0} kg`,
              daysInStorage,
              fechaPedido: fechaPedido.toLocaleDateString("es-ES"),
            });
          }
        });

        // Ordenar por días en almacén descendente (más crítico primero)
        resultado.sort((a, b) => b.daysInStorage - a.daysInStorage);
        setAlertas(resultado);
      } catch (err) {
        console.error("Error cargando alertas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Alertas del Sistema</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Palets con más de 30 días en almacén que requieren atención.
        </p>
      </div>

      {/* BANNER RESUMEN */}
      {!loading && alertas.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/5 border border-red-200/80 dark:border-red-500/20 rounded-xl">
          <div className="p-2 bg-red-100 dark:bg-red-500/10 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-medium text-sm text-red-700 dark:text-red-400">
              {alertas.length} palet{alertas.length !== 1 ? "s" : ""} en estado crítico
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Llevan más de 30 días almacenados sin salida registrada.
            </p>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800/80">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><Package size={12} /> ID / Código</div>
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><User size={12} /> Cliente</div>
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><MapPin size={12} /> Zona</div>
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Dimensiones / Peso</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><Clock size={12} /> Fecha entrada</div>
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Días en almacén</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando alertas...
                  </td>
                </tr>
              ) : alertas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-full">
                        <AlertTriangle size={20} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">Sin alertas activas</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Todos los palets llevan menos de 30 días en almacén.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => (
                  <tr
                    key={alerta.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{alerta.id}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{alerta.client}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {alerta.zone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      <div>{alerta.dimensions}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{alerta.weight}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 tabular-nums">{alerta.fechaPedido}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 tabular-nums">
                        <Clock size={11} />
                        {alerta.daysInStorage} días
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && alertas.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 text-xs text-slate-500 dark:text-slate-400">
            {alertas.length} palet{alertas.length !== 1 ? "s" : ""} con prioridad alta
          </div>
        )}
      </div>
    </div>
  );
}
